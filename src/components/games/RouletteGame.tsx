import { useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import {
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
import { Disc, Sparkles, Trophy } from 'lucide-react';

interface RouletteGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type RouletteBetType =
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'dozen1'
  | 'dozen2'
  | 'dozen3'
  | 'lucky7'
  | 'zero';

const RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const BET_OPTIONS: Array<{
  id: RouletteBetType;
  label: string;
  mult: number;
  check: (n: number) => boolean;
  tone: string;
}> = [
  { id: 'red', label: 'RED', mult: 2, check: (n) => RED_NUMS.has(n), tone: 'bg-rose-600/30 border-rose-400/60 text-rose-200' },
  { id: 'black', label: 'BLACK', mult: 2, check: (n) => n !== 0 && !RED_NUMS.has(n), tone: 'bg-slate-800 border-slate-500/60 text-slate-100' },
  { id: 'even', label: 'EVEN', mult: 2, check: (n) => n !== 0 && n % 2 === 0, tone: 'bg-indigo-600/25 border-indigo-400/50 text-indigo-200' },
  { id: 'odd', label: 'ODD', mult: 2, check: (n) => n % 2 === 1, tone: 'bg-indigo-600/25 border-indigo-400/50 text-indigo-200' },
  { id: 'dozen1', label: '1–12', mult: 3, check: (n) => n >= 1 && n <= 12, tone: 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200' },
  { id: 'dozen2', label: '13–24', mult: 3, check: (n) => n >= 13 && n <= 24, tone: 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200' },
  { id: 'dozen3', label: '25–36', mult: 3, check: (n) => n >= 25 && n <= 36, tone: 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200' },
  { id: 'lucky7', label: 'LUCKY 7', mult: 15, check: (n) => n === 7, tone: 'bg-amber-500/25 border-amber-400/60 text-amber-200' },
  { id: 'zero', label: 'ZERO 0', mult: 18, check: (n) => n === 0, tone: 'bg-emerald-500/30 border-emerald-400 text-emerald-100' },
];

export function RouletteGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: RouletteGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 18;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [selectedBet, setSelectedBet] = useState<RouletteBetType>('red');
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [landedNum, setLandedNum] = useState<number | null>(null);
  const [wheelAngle, setWheelAngle] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const currentOpt = BET_OPTIONS.find((o) => o.id === selectedBet) || BET_OPTIONS[0];
  const payoutMult = Math.min(maxMult, currentOpt.mult);

  const handleSpin = async () => {
    if (spinning || busy) return;
    setError(null);
    setBanner(null);

    let wager: ActiveWagerSession | null = null;
    if (currentUser) {
      setBusy(true);
      try {
        const res = await startWagerOnServer({ gameSlug: game.slug, stakeBirr });
        onSnapshotSync(res.snapshot);
        wager = res.wager;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start Roulette spin.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setActiveWager(wager);
    setSpinning(true);
    soundFx.move();

    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;
    let num = Math.floor(Math.random() * 37);

    // Gentle house calibration if bet wins and round is house-favored
    if (aiFavored && currentOpt.check(num) && Math.random() < 0.35) {
      const losingPool = Array.from({ length: 37 }, (_, i) => i).filter((n) => !currentOpt.check(n));
      if (losingPool.length > 0) {
        num = losingPool[Math.floor(Math.random() * losingPool.length)];
      }
    }

    setWheelAngle((prev) => prev + 1080 + num * 9.7);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setLandedNum(num);
      setHistory((prev) => [num, ...prev].slice(0, 12));
      const didWin = currentOpt.check(num);

      if (didWin) soundFx.win();
      else soundFx.error();

      const numColor = num === 0 ? 'GREEN' : RED_NUMS.has(num) ? 'RED' : 'BLACK';

      if (!wager) {
        setSpinning(false);
        setActiveWager(null);
        setBanner(
          didWin
            ? `Demo Win! Ball landed on ${num} (${numColor}) · ${payoutMult}x`
            : `Demo: Ball landed on ${num} (${numColor}).`
        );
        return;
      }

      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: didWin ? 'win' : 'loss',
          multiplier: didWin ? payoutMult : 0,
          score: num,
          challengeUpdates: {
            playIncrement: 1,
            winIncrement: didWin ? 1 : 0,
          },
        });
        onSnapshotSync(res.snapshot);
        setBanner(
          didWin
            ? `Ball on ${num} ${numColor}! Paid ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`
            : `Ball landed on ${num} (${numColor}). Try another pocket!`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
        setSpinning(false);
        setActiveWager(null);
      }
    }, 900);
  };

  const numColorClass =
    landedNum === null
      ? 'text-amber-300 border-amber-400/50 bg-[#0B1124]'
      : landedNum === 0
        ? 'text-emerald-300 border-emerald-400 bg-emerald-600/25'
        : RED_NUMS.has(landedNum)
          ? 'text-rose-200 border-rose-400 bg-rose-600/35'
          : 'text-slate-100 border-slate-400 bg-slate-800';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={spinning}
        isBusy={busy}
        currentMultiplier={payoutMult}
        canCashout={false}
        cashoutDisabledReason="Resolves on wheel stop"
        onStartRound={() => void handleSpin()}
        onCashout={() => {}}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel={`Spin (${currentOpt.label})`}
        error={error}
      />

      <div
        className="w-full rounded-2xl border-2 border-amber-500/45 p-5 sm:p-6 space-y-5 shadow-2xl"
        style={{
          background: 'radial-gradient(ellipse at top, #0E4836 0%, #07291E 60%, #041610 100%)',
        }}
      >
        {/* Roulette Wheel Centerpiece */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border-8 border-amber-500/70 shadow-2xl transition-transform duration-700 ease-out"
              style={{
                transform: `rotate(${wheelAngle}deg)`,
                background:
                  'conic-gradient(#059669 0deg 10deg, #DC2626 10deg 20deg, #0F172A 20deg 30deg, #DC2626 30deg 40deg, #0F172A 40deg 50deg, #DC2626 50deg 60deg, #0F172A 60deg 70deg, #DC2626 70deg 80deg, #0F172A 80deg 90deg, #DC2626 90deg 100deg, #0F172A 100deg 110deg, #DC2626 110deg 120deg, #0F172A 120deg 130deg, #DC2626 130deg 140deg, #0F172A 140deg 150deg, #DC2626 150deg 160deg, #0F172A 160deg 170deg, #DC2626 170deg 180deg, #0F172A 180deg 190deg, #DC2626 190deg 200deg, #0F172A 200deg 210deg, #DC2626 210deg 220deg, #0F172A 220deg 230deg, #DC2626 230deg 240deg, #0F172A 240deg 250deg, #DC2626 250deg 260deg, #0F172A 260deg 270deg, #DC2626 270deg 280deg, #0F172A 280deg 290deg, #DC2626 290deg 300deg, #0F172A 300deg 310deg, #DC2626 310deg 320deg, #0F172A 320deg 330deg, #DC2626 330deg 340deg, #0F172A 340deg 350deg, #DC2626 350deg 360deg)',
              }}
            />
            <div
              className={`relative z-10 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${numColorClass}`}
            >
              <Disc className={`w-4 h-4 mb-0.5 ${spinning ? 'animate-spin' : ''}`} />
              <span className="text-2xl font-mono font-black tabular-nums">
                {spinning ? '..' : landedNum !== null ? landedNum : '--'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
              Single-Zero European Wheel
            </div>
            <div className="text-lg font-display font-bold text-white">
              Active Bet: {currentOpt.label} ({payoutMult}x)
            </div>
            {history.length > 0 && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
                {history.map((n, idx) => (
                  <span
                    key={idx}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center border tabular-nums ${
                      n === 0
                        ? 'bg-emerald-600/35 border-emerald-400 text-emerald-200'
                        : RED_NUMS.has(n)
                          ? 'bg-rose-600/35 border-rose-400 text-rose-200'
                          : 'bg-slate-800 border-slate-500 text-slate-100'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bet Felt Board */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {BET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={spinning || busy}
              onClick={() => setSelectedBet(opt.id)}
              className={`min-h-[48px] rounded-xl border px-2.5 py-2 flex flex-col items-center justify-center transition-all cursor-pointer tabular-nums ${
                selectedBet === opt.id
                  ? `${opt.tone} ring-2 ring-amber-400 shadow-lg`
                  : 'bg-black/35 border-white/10 text-slate-300 hover:bg-black/50'
              }`}
            >
              <span className="text-xs font-bold">{opt.label}</span>
              <span className="text-[10px] font-mono text-amber-300">
                {Math.min(maxMult, opt.mult)}x
              </span>
            </button>
          ))}
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-200/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Pick Red/Black, Even/Odd, Dozens, or Lucky 0/7 and spin the wheel!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
