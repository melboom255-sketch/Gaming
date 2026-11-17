import { useEffect, useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import {
  cashoutWagerOnServer,
  formatBirr,
  MIN_STAKE_BIRR,
  settleWagerOnServer,
  startWagerOnServer,
} from '@/src/services/platformService';
import type {
  ActiveWagerSession,
  GameCatalogItem,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import { soundFx } from '@/src/utils/sound';
import { Flame, Rocket, Sparkles, Trophy } from 'lucide-react';

interface CrashRocketGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type CrashStatus = 'idle' | 'flying' | 'cashed_out' | 'crashed';

export function CrashRocketGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: CrashRocketGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 15;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<CrashStatus>('idle');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [autoCashout, setAutoCashout] = useState<number | null>(null);
  const [crashHistory, setCrashHistory] = useState<Array<{ mult: number; won: boolean }>>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);
  const multRef = useRef(1.0);
  const crashTargetRef = useRef(2.0);
  const startTimeRef = useRef(0);
  const autoCashoutRef = useRef<number | null>(null);

  useEffect(() => {
    autoCashoutRef.current = autoCashout;
  }, [autoCashout]);

  const drawCurve = (mult: number, crashed: boolean, cashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Deterministic starfield backdrop
    ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
    for (let i = 0; i < 28; i++) {
      const sx = ((i * 137 + 29) % (w - 20)) + 10;
      const sy = ((i * 89 + 17) % (h - 45)) + 10;
      const sr = i % 3 === 0 ? 1.5 : 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle cockpit grid + altitude multiplier markers
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 30; y < h; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const altitudeTicks = [2, 5, 10];
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    for (const tick of altitudeTicks) {
      if (tick > maxMult) continue;
      const tickProg = Math.min(1, Math.log(tick) / Math.log(maxMult));
      const ty = h - 32 - Math.pow(tickProg, 0.88) * (h - 72);
      ctx.fillText(`${tick}x`, 8, ty + 3);
    }

    const progress = Math.min(1, Math.log(Math.max(1, mult)) / Math.log(maxMult));
    const endX = 36 + progress * (w - 84);
    const endY = h - 32 - Math.pow(progress, 0.88) * (h - 72);

    // Fill area under trajectory
    const grad = ctx.createLinearGradient(0, endY, 0, h - 32);
    grad.addColorStop(
      0,
      crashed
        ? 'rgba(244, 63, 94, 0.35)'
        : cashed
          ? 'rgba(16, 185, 129, 0.32)'
          : 'rgba(245, 158, 11, 0.32)'
    );
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.beginPath();
    ctx.moveTo(36, h - 32);
    ctx.quadraticCurveTo(endX * 0.55, h - 32, endX, endY);
    ctx.lineTo(endX, h - 32);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Main curve stroke
    ctx.beginPath();
    ctx.moveTo(36, h - 32);
    ctx.quadraticCurveTo(endX * 0.55, h - 32, endX, endY);
    ctx.strokeStyle = crashed ? '#F43F5E' : cashed ? '#34D399' : '#FBBF24';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Engine flame trail while flying
    if (!crashed && !cashed && mult > 1.02) {
      ctx.beginPath();
      ctx.moveTo(endX - 18, endY + 12);
      ctx.lineTo(endX - 4, endY + 2);
      ctx.lineTo(endX - 10, endY + 18);
      ctx.closePath();
      ctx.fillStyle = 'rgba(251, 146, 60, 0.85)';
      ctx.fill();
    }

    // Glowing rocket nose node + subtle outer halo
    ctx.beginPath();
    ctx.arc(endX, endY, crashed ? 16 : 13, 0, Math.PI * 2);
    ctx.fillStyle = crashed
      ? 'rgba(251, 113, 133, 0.25)'
      : cashed
        ? 'rgba(52, 211, 153, 0.28)'
        : 'rgba(253, 224, 71, 0.28)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(endX, endY, crashed ? 11 : 7.5, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? '#FB7185' : cashed ? '#34D399' : '#FDE047';
    ctx.fill();
  };

  useEffect(() => {
    drawCurve(1.0, false, false);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickCrashTarget = (aiFavored: boolean): number => {
    const r = Math.random();
    if (aiFavored) {
      // 70% AI house bias: earlier crashes common (1.12x - 2.6x) with rare 4x-12x spikes
      if (r < 0.34) return Math.round((1.08 + Math.random() * 0.38) * 100) / 100;
      if (r < 0.78) return Math.round((1.46 + Math.random() * 1.1) * 100) / 100;
      return Math.round((2.6 + Math.random() * 6.5) * 100) / 100;
    }
    if (r < 0.2) return Math.round((1.2 + Math.random() * 0.5) * 100) / 100;
    return Math.min(maxMult, Math.round((1.75 + Math.random() * 6.2) * 100) / 100);
  };

  const triggerCrash = async (finalCrashMult: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('crashed');
    setCrashPoint(finalCrashMult);
    setCrashHistory((prev) => [{ mult: finalCrashMult, won: false }, ...prev].slice(0, 8));
    drawCurve(finalCrashMult, true, false);
    soundFx.error();
    setBanner(`DETONATED at ${finalCrashMult.toFixed(2)}x! Cash out earlier next launch.`);

    if (wager) {
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          score: 0,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
      } catch {
        // ignore
      }
    }
  };

  const triggerAutoCashout = async (lockedMult: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    setCrashHistory((prev) => [{ mult: lockedMult, won: true }, ...prev].slice(0, 8));
    drawCurve(lockedMult, false, true);
    soundFx.win();

    if (!wager) {
      setBanner(`Auto-Cashout locked at ${lockedMult.toFixed(2)}x (Demo)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: lockedMult,
        score: Math.round(lockedMult * 100),
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        `Auto-Cashed out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const launchLoop = () => {
    const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
    const nextMult = Math.min(
      maxMult,
      Math.round(Math.exp(elapsedSec * 0.22) * 100) / 100
    );
    multRef.current = nextMult;
    setMultiplier(nextMult);

    if (nextMult >= crashTargetRef.current) {
      setMultiplier(crashTargetRef.current);
      void triggerCrash(crashTargetRef.current);
      return;
    }

    const target = autoCashoutRef.current;
    if (target !== null && nextMult >= target && nextMult >= 1.05) {
      setMultiplier(target);
      multRef.current = target;
      void triggerAutoCashout(target);
      return;
    }

    drawCurve(nextMult, false, false);
    rafRef.current = requestAnimationFrame(launchLoop);
  };

  const startLaunch = async () => {
    setError(null);
    setBanner(null);
    setCrashPoint(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!currentUser) {
      wagerRef.current = null;
      setActiveWager(null);
      settledRef.current = false;
      crashTargetRef.current = pickCrashTarget(Math.random() < 0.7);
      multRef.current = 1.0;
      setMultiplier(1.0);
      setStatus('flying');
      startTimeRef.current = performance.now();
      soundFx.move();
      rafRef.current = requestAnimationFrame(launchLoop);
      return;
    }

    setBusy(true);
    try {
      const res = await startWagerOnServer({ gameSlug: game.slug, stakeBirr });
      onSnapshotSync(res.snapshot);
      wagerRef.current = res.wager;
      setActiveWager(res.wager);
      settledRef.current = false;
      crashTargetRef.current = pickCrashTarget(res.wager.aiFavored);
      multRef.current = 1.0;
      setMultiplier(1.0);
      setStatus('flying');
      startTimeRef.current = performance.now();
      soundFx.move();
      rafRef.current = requestAnimationFrame(launchLoop);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch Sky Crash.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'flying' || settledRef.current || multRef.current < 1.05) return;
    settledRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const lockedMult = multRef.current;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    setCrashHistory((prev) => [{ mult: lockedMult, won: true }, ...prev].slice(0, 8));
    drawCurve(lockedMult, false, true);
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at ${lockedMult.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: lockedMult,
        score: Math.round(lockedMult * 100),
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Cashed out safely at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'flying'}
        isBusy={busy}
        currentMultiplier={multiplier}
        canCashout={status === 'flying' && multiplier >= 1.05}
        cashoutDisabledReason="Wait for 1.05x+ altitude to unlock Cash Out"
        onStartRound={() => void startLaunch()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Launch Rocket"
        error={error}
      />

      {/* Live Canvas Trajectory Stage */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#0C1026] to-[#070A16] border border-white/12 p-4 sm:p-5 overflow-hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-amber-300" />
            Abyssinia Telemetry
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Auto-Cashout:</span>
            {[null, 1.5, 2.0, 3.0, 5.0].map((target) => (
              <button
                key={target === null ? 'manual' : target}
                type="button"
                disabled={status === 'flying'}
                onClick={() => setAutoCashout(target)}
                className={`min-h-[28px] px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold cursor-pointer disabled:opacity-50 transition-colors ${
                  autoCashout === target
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#131932] hover:bg-[#1B2245] text-slate-300 border border-white/10'
                }`}
              >
                {target === null ? 'Manual' : `${target.toFixed(1)}x`}
              </button>
            ))}
            <span className="font-mono text-slate-400 pl-1">Max {maxMult}x</span>
          </div>
        </div>

        {crashHistory.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
              Recent:
            </span>
            {crashHistory.map((item, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 border ${
                  item.won
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-400/35 text-rose-300'
                }`}
              >
                {item.mult.toFixed(2)}x
              </span>
            ))}
          </div>
        )}

        <div className="relative w-full rounded-xl bg-[#050712] border border-white/10 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={640}
            height={280}
            className="w-full h-56 sm:h-68 block"
          />
          {/* Live Centered Multiplier Overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`text-4xl sm:text-6xl font-mono font-black tabular-nums drop-shadow-lg ${
                status === 'crashed'
                  ? 'text-rose-400'
                  : status === 'cashed_out'
                    ? 'text-emerald-300'
                    : 'text-amber-300'
              }`}
            >
              {multiplier.toFixed(2)}x
            </div>
            {status === 'crashed' && (
              <div className="mt-1 px-3 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/50 text-rose-200 text-xs font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                CRASHED @ {crashPoint?.toFixed(2)}x
              </div>
            )}
            {status === 'flying' && (
              <div className="mt-1 text-xs font-mono text-emerald-300 tabular-nums">
                Cashout Now: {formatBirr(stakeBirr * multiplier)}
              </div>
            )}
          </div>
        </div>

        {/* Big Quick Cashout Action Strip while Flying */}
        {status === 'flying' && (
          <button
            type="button"
            disabled={multiplier < 1.05 || busy}
            onClick={() => void handleCashout()}
            className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base cursor-pointer shadow-lg tabular-nums transition-all"
          >
            CASH OUT {formatBirr(stakeBirr * multiplier)} ({multiplier.toFixed(2)}x)
          </button>
        )}

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                {status === 'flying'
                  ? 'Hit Cash Out before detonation to lock your Birr multiplier!'
                  : 'Stake Birr above and press Launch Rocket to climb.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
