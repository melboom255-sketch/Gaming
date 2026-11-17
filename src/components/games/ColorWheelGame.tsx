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

interface ColorWheelGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type WheelColor = 'emerald' | 'crimson' | 'sapphire' | 'gold';
type WheelStatus = 'idle' | 'playing' | 'spinning' | 'won' | 'cashed_out' | 'lost';

const WEDGES: Array<{ color: WheelColor; label: string; hex: string; mult: number }> = [
  { color: 'emerald', label: 'Emerald', hex: '#10B981', mult: 1.7 },
  { color: 'crimson', label: 'Crimson', hex: '#EF4444', mult: 1.7 },
  { color: 'sapphire', label: 'Sapphire', hex: '#3B82F6', mult: 1.7 },
  { color: 'emerald', label: 'Emerald', hex: '#10B981', mult: 1.7 },
  { color: 'crimson', label: 'Crimson', hex: '#EF4444', mult: 1.7 },
  { color: 'sapphire', label: 'Sapphire', hex: '#3B82F6', mult: 1.7 },
  { color: 'emerald', label: 'Emerald', hex: '#10B981', mult: 1.7 },
  { color: 'crimson', label: 'Crimson', hex: '#EF4444', mult: 1.7 },
  { color: 'sapphire', label: 'Sapphire', hex: '#3B82F6', mult: 1.7 },
  { color: 'gold', label: 'Gold Crown', hex: '#F59E0B', mult: 3.5 },
];

export function ColorWheelGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: ColorWheelGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 10;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<WheelStatus>('idle');
  const [selectedColor, setSelectedColor] = useState<WheelColor>('emerald');
  const [rotation, setRotation] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const drawWheel = (angleRad: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 14;
    const slice = (Math.PI * 2) / WEDGES.length;

    ctx.clearRect(0, 0, size, size);

    WEDGES.forEach((wedge, idx) => {
      const start = angleRad + idx * slice;
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = wedge.hex;
      ctx.fill();
      ctx.strokeStyle = '#0B0F20';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label inside wedge
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + slice / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(wedge.color === 'gold' ? '3.5x' : '1.7x', radius - 14, 4);
      ctx.restore();
    });

    // Gold center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 4;
    ctx.stroke();
  };

  useEffect(() => {
    drawWheel(rotation);
  }, [rotation]);

  const startRound = async () => {
    setError(null);
    setBanner(null);
    setStreak(0);
    setMultiplier(1.0);

    if (!currentUser) {
      wagerRef.current = null;
      setActiveWager(null);
      settledRef.current = false;
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
      setStatus('playing');
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Fortune Wheel.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || streak < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at ${multiplier.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: streak * 35,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Wheel Cashed Out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const spinWheel = () => {
    if (status !== 'playing' || settledRef.current) return;
    setStatus('spinning');
    setError(null);
    soundFx.flip();

    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Pick target wedge calibrated to house odds
    const matchingIndices = WEDGES.map((w, i) => (w.color === selectedColor ? i : -1)).filter(
      (i) => i >= 0
    );
    const otherIndices = WEDGES.map((w, i) => (w.color !== selectedColor ? i : -1)).filter(
      (i) => i >= 0
    );

    const hitChance =
      selectedColor === 'gold'
        ? aiFavored
          ? 0.22
          : 0.36
        : aiFavored
          ? streak === 0
            ? 0.45
            : 0.38
          : 0.58;
    const willHit = Math.random() < hitChance;
    const chosenIndex = willHit
      ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)]
      : otherIndices[Math.floor(Math.random() * otherIndices.length)];

    // Pointer sits at top (-PI/2). Solve angle so chosenIndex center aligns with -PI/2
    const slice = (Math.PI * 2) / WEDGES.length;
    const targetMod = -Math.PI / 2 - (chosenIndex + 0.5) * slice;
    const startAngle = rotation;
    const fullSpins = 4 * Math.PI * 2;
    const delta =
      fullSpins + (((targetMod - startAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    const startTime = performance.now();
    const duration = 1200;

    const frame = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const nextAngle = startAngle + delta * eased;
      setRotation(nextAngle);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        void resolveSpin(WEDGES[chosenIndex]);
      }
    };
    requestAnimationFrame(frame);
  };

  const resolveSpin = async (landed: (typeof WEDGES)[number]) => {
    const won = landed.color === selectedColor;
    if (!won) {
      settledRef.current = true;
      const wager = wagerRef.current;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('lost');
      soundFx.error();
      setBanner(`Wheel landed on ${landed.label}! Round ended.`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: streak * 35,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore
        }
      }
      return;
    }

    const nextStreak = streak + 1;
    const nextMult = Math.min(
      maxMult,
      Math.round((streak === 0 ? landed.mult : multiplier * 1.45) * 100) / 100
    );
    setStreak(nextStreak);
    setMultiplier(nextMult);

    if (nextMult >= maxMult) {
      settledRef.current = true;
      const wager = wagerRef.current;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('won');
      soundFx.bonus();

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'win',
            multiplier: nextMult,
            score: nextStreak * 60,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`Max Wheel Multiplier ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement error.');
        }
      } else {
        setBanner(`Demo Max Wheel Multiplier ${nextMult.toFixed(2)}x!`);
      }
      return;
    }

    setStatus('playing');
    soundFx.match();
    setBanner(`Hit ${landed.label}! Streak ${nextStreak} → ${nextMult.toFixed(2)}x. Spin again or Cash Out!`);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'playing' || status === 'spinning'}
        isBusy={busy}
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && streak >= 1}
        cashoutDisabledReason="Win 1+ wheel spin to unlock Cash Out"
        onStartRound={() => void startRound()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Enter Wheel Round"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0D1123] border border-white/12 p-4 sm:p-6 space-y-4">
        <div className="relative flex justify-center">
          {/* Top Pointer */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow" />
          <canvas ref={canvasRef} width={270} height={270} className="w-60 h-60 sm:w-68 sm:h-68" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'emerald', label: 'Emerald (1.7x)', cls: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200' },
              { id: 'crimson', label: 'Crimson (1.7x)', cls: 'border-rose-400/50 bg-rose-500/20 text-rose-200' },
              { id: 'sapphire', label: 'Sapphire (1.7x)', cls: 'border-blue-400/50 bg-blue-500/20 text-blue-200' },
              { id: 'gold', label: 'Gold (3.5x)', cls: 'border-amber-400/60 bg-amber-500/25 text-amber-200' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={status === 'spinning'}
              onClick={() => setSelectedColor(c.id)}
              className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                selectedColor === c.id ? `${c.cls} ring-2 ring-white` : 'bg-[#131932] border-white/10 text-slate-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={status !== 'playing'}
          onClick={spinWheel}
          className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 disabled:opacity-45 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <CircleDot className="w-4 h-4" />
          <span>{status === 'spinning' ? 'Spinning Wheel...' : `Spin Wheel (${selectedColor.toUpperCase()})`}</span>
        </button>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Pick a wedge color, spin the Monte Carlo wheel, and Cash Out streaks!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
