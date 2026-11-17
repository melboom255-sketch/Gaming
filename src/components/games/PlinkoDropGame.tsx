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
import { CircleDot, Sparkles, Trophy } from 'lucide-react';

interface PlinkoDropGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type RiskMode = 'low' | 'medium' | 'high';
type PlinkoStatus = 'idle' | 'playing' | 'dropping' | 'cashed_out' | 'lost';

const RISK_BINS: Record<RiskMode, number[]> = {
  low: [2.2, 1.4, 1.1, 0.8, 0.5, 0.8, 1.1, 1.4, 2.2],
  medium: [4.0, 2.0, 1.2, 0.6, 0.2, 0.6, 1.2, 2.0, 4.0],
  high: [8.0, 3.0, 1.1, 0.2, 0.0, 0.2, 1.1, 3.0, 8.0],
};

export function PlinkoDropGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: PlinkoDropGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 12;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [risk, setRisk] = useState<RiskMode>('medium');
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<PlinkoStatus>('idle');
  const [dropsCount, setDropsCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [lastBinIdx, setLastBinIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const rows = 8;

  const drawBoard = (ballPos?: { x: number; y: number } | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw brass pegs pyramid (row r has r + 3 pegs)
    const topY = 34;
    const rowSpacing = (h - 70) / rows;
    const colGap = 44;

    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const startX = w / 2 - ((count - 1) * colGap) / 2;
      const y = topY + r * rowSpacing;
      for (let c = 0; c < count; c++) {
        const x = startX + c * colGap;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 7.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (ballPos) {
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  useEffect(() => {
    drawBoard(null);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startRound = async () => {
    setError(null);
    setBanner(null);
    setLastBinIdx(null);
    if (!currentUser) {
      wagerRef.current = null;
      setActiveWager(null);
      settledRef.current = false;
      setDropsCount(0);
      setMultiplier(1.0);
      setStatus('playing');
      soundFx.move();
      return;
    }

    setBusy(true);
    try {
      const res = await startWagerOnServer({ gameSlug: game.slug, stakeBirr });
      onSnapshotSync(res.snapshot);
      wagerRef.current = res.wager;
      setActiveWager(res.wager);
      settledRef.current = false;
      setDropsCount(0);
      setMultiplier(1.0);
      setStatus('playing');
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Plinko.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || dropsCount < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at ${multiplier.toFixed(2)}x after ${dropsCount} drops!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: dropsCount * 20,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Vault Cashed Out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const dropBall = () => {
    if (status !== 'playing' || settledRef.current) return;
    setStatus('dropping');
    setLastBinIdx(null);
    soundFx.flip();

    const canvas = canvasRef.current;
    const w = canvas?.width || 480;
    const h = canvas?.height || 290;
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Precompute 8 left/right peg bounces ending in bin 0..8
    const dirs: number[] = [];
    for (let r = 0; r < rows; r++) {
      // Bias slightly toward center bins when AI favored
      const centerPull = aiFavored ? 0.56 : 0.45;
      const rightSum = dirs.reduce((a, b) => a + b, 0);
      const goRight =
        rightSum > r * 0.5
          ? Math.random() > centerPull
          : Math.random() < centerPull;
      dirs.push(goRight ? 1 : 0);
    }

    const binIdx = dirs.reduce((a, b) => a + b, 0);
    const waypoints: Array<{ x: number; y: number }> = [{ x: w / 2, y: 12 }];
    const topY = 34;
    const rowSpacing = (h - 70) / rows;
    const colGap = 44;

    let pos = 0;
    for (let r = 0; r < rows; r++) {
      pos += dirs[r] ? 1 : -1;
      const x = w / 2 + pos * (colGap / 2);
      const y = topY + r * rowSpacing + 14;
      waypoints.push({ x, y });
    }
    waypoints.push({ x: w / 2 + pos * (colGap / 2), y: h - 14 });

    let step = 0;
    const totalFrames = 44;
    const animate = () => {
      step++;
      const t = step / totalFrames;
      const scaled = t * (waypoints.length - 1);
      const idx = Math.min(waypoints.length - 2, Math.floor(scaled));
      const frac = scaled - idx;
      const p0 = waypoints[idx];
      const p1 = waypoints[idx + 1];
      drawBoard({
        x: p0.x + (p1.x - p0.x) * frac,
        y: p0.y + (p1.y - p0.y) * frac,
      });

      if (step < totalFrames) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        drawBoard(null);
        void resolveBin(binIdx);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  const resolveBin = async (binIdx: number) => {
    const bins = RISK_BINS[risk];
    const hitMult = bins[binIdx] ?? 0.5;
    setLastBinIdx(binIdx);

    const nextDrops = dropsCount + 1;
    setDropsCount(nextDrops);

    // If High risk lands on 0.0x or accumulated multiplier drops to <= 0.15x -> round lost
    const nextMult =
      hitMult === 0
        ? 0
        : Math.min(maxMult, Math.round(multiplier * hitMult * 100) / 100);
    setMultiplier(nextMult);

    if (nextMult <= 0.15) {
      settledRef.current = true;
      const wager = wagerRef.current;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('lost');
      soundFx.error();
      setBanner(`Ball dropped into ${hitMult.toFixed(1)}x trap! Stake lost.`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: nextDrops * 10,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore
        }
      }
      return;
    }

    setStatus('playing');
    if (hitMult >= 1.2) soundFx.match();
    else soundFx.flip();
    setBanner(`Hit ${hitMult.toFixed(1)}x bin → Total ${nextMult.toFixed(2)}x! Drop again or Cash Out.`);
  };

  const bins = RISK_BINS[risk];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'playing' || status === 'dropping'}
        isBusy={busy}
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && dropsCount >= 1 && multiplier > 0.2}
        cashoutDisabledReason="Drop 1+ ball to unlock Cash Out"
        onStartRound={() => void startRound()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Plinko"
        error={error}
      />

      {/* Risk Selector + Drop Button */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-[#101426] border border-white/10 rounded-xl p-2.5">
        <div className="flex items-center gap-1 bg-[#080A14] p-1 rounded-lg">
          {(['low', 'medium', 'high'] as RiskMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={status === 'playing' || status === 'dropping'}
              onClick={() => setRisk(mode)}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer disabled:opacity-50 ${
                risk === mode
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode} Risk
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={status !== 'playing'}
          onClick={dropBall}
          className="min-h-[38px] px-5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-45 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <CircleDot className="w-4 h-4" />
          <span>{status === 'dropping' ? 'Dropping...' : 'Drop Gold Ball'}</span>
        </button>
      </div>

      {/* Plinko Pyramid Board */}
      <div className="w-full rounded-2xl bg-[#090D1D] border border-white/12 p-3 sm:p-4 space-y-2">
        <canvas
          ref={canvasRef}
          width={520}
          height={290}
          className="w-full h-60 sm:h-72 rounded-xl bg-[#050812]"
        />

        {/* Multiplier Bins */}
        <div className="grid grid-cols-9 gap-1">
          {bins.map((val, idx) => (
            <div
              key={idx}
              className={`py-1.5 rounded-md text-center font-mono text-[10px] sm:text-xs font-black tabular-nums border transition-transform ${
                lastBinIdx === idx
                  ? 'scale-105 ring-2 ring-white bg-amber-500 text-slate-950 border-white'
                  : val >= 2
                    ? 'bg-rose-600/35 border-rose-400/50 text-rose-200'
                    : val >= 1
                      ? 'bg-amber-500/25 border-amber-400/40 text-amber-200'
                      : 'bg-[#141A33] border-white/10 text-slate-300'
              }`}
            >
              {val}x
            </div>
          ))}
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm pt-1">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>
                Start Plinko above, drop golden balls through pegs, and Cash Out anytime!
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
