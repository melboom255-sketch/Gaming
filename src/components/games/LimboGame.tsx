import { useState } from 'react';
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
import { Gauge, Sparkles, Trophy } from 'lucide-react';

interface LimboGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

export function LimboGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: LimboGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = Math.min(25, game.maxMultiplier || 25);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [targetMult, setTargetMult] = useState<number>(2.0);
  const [rolledMult, setRolledMult] = useState<number | null>(null);
  const [wonLast, setWonLast] = useState<boolean | null>(null);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRolls, setRecentRolls] = useState<Array<{ mult: number; won: boolean }>>([]);

  const impliedChance = Math.min(92, Math.max(3.8, Number((96 / targetMult).toFixed(1))));

  const handleRoll = async () => {
    if (busy) return;
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
        setError(err instanceof Error ? err.message : 'Unable to start Limbo roll.');
        setBusy(false);
        return;
      }
    }

    setActiveWager(wager);
    soundFx.move();

    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;
    const rawPass = Math.random() * 100 < impliedChance;
    // Calibrate win probability cleanly when house-favored
    const didWin = aiFavored ? rawPass && Math.random() < 0.78 : rawPass;

    let resultMult: number;
    if (didWin) {
      resultMult = Number((targetMult + Math.random() * (maxMult - targetMult) * 0.65).toFixed(2));
    } else {
      const belowMax = Math.max(1.01, targetMult - 0.02);
      resultMult = Number((1.0 + Math.random() * (belowMax - 1.0)).toFixed(2));
    }

    setRolledMult(resultMult);
    setWonLast(didWin);
    setRecentRolls((prev) => [{ mult: resultMult, won: didWin }, ...prev].slice(0, 10));

    if (didWin) soundFx.win();
    else soundFx.error();

    if (!wager) {
      setActiveWager(null);
      setBusy(false);
      setBanner(
        didWin
          ? `Demo Hit! Rolled ${resultMult.toFixed(2)}x (>= ${targetMult.toFixed(2)}x Target)`
          : `Demo Miss: Rolled ${resultMult.toFixed(2)}x (below ${targetMult.toFixed(2)}x)`
      );
      return;
    }

    try {
      const res = await settleWagerOnServer({
        wagerId: wager.id,
        outcome: didWin ? 'win' : 'loss',
        multiplier: didWin ? targetMult : 0,
        score: Math.round(resultMult * 100),
        challengeUpdates: {
          playIncrement: 1,
          winIncrement: didWin ? 1 : 0,
        },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        didWin
          ? `Target ${targetMult.toFixed(2)}x Cleared! Rolled ${resultMult.toFixed(2)}x · Won ${formatBirr(res.payoutBirr)}`
          : `Rolled ${resultMult.toFixed(2)}x — Needed ${targetMult.toFixed(2)}x+`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settlement failed.');
    } finally {
      setBusy(false);
      setActiveWager(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={busy}
        isBusy={busy}
        currentMultiplier={targetMult}
        canCashout={false}
        cashoutDisabledReason="Instant target roll settles immediately"
        onStartRound={() => void handleRoll()}
        onCashout={() => {}}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel={`Roll >= ${targetMult.toFixed(2)}x`}
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1324] border border-violet-500/30 p-5 sm:p-6 space-y-5 shadow-2xl">
        {/* Rolled Multiplier Display */}
        <div className="rounded-2xl bg-[#070A15] border border-white/10 py-8 px-4 flex flex-col items-center justify-center text-center space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-amber-300" />
            <span>Limbo Multiplier Output</span>
          </div>
          <div
            className={`text-5xl sm:text-6xl font-mono font-black tabular-nums transition-colors ${
              wonLast === true
                ? 'text-emerald-400'
                : wonLast === false
                  ? 'text-rose-400'
                  : 'text-amber-300'
            }`}
          >
            {rolledMult !== null ? `${rolledMult.toFixed(2)}x` : `${targetMult.toFixed(2)}x`}
          </div>
          <div className="text-xs text-slate-400 tabular-nums">
            Target: <span className="text-white font-semibold">{targetMult.toFixed(2)}x</span> · Win Chance:{' '}
            <span className="text-emerald-300 font-semibold">{impliedChance.toFixed(1)}%</span>
          </div>
        </div>

        {/* Target Multiplier Slider + Quick Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Set Target Multiplier</span>
            <span className="font-mono font-bold text-amber-300 tabular-nums">
              {targetMult.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={1.1}
            max={maxMult}
            step={0.1}
            value={targetMult}
            disabled={busy}
            onChange={(e) => setTargetMult(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex flex-wrap gap-2">
            {[1.25, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0]
              .filter((v) => v <= maxMult)
              .map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={busy}
                  onClick={() => setTargetMult(preset)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-mono font-bold border cursor-pointer tabular-nums whitespace-nowrap ${
                    Math.abs(targetMult - preset) < 0.05
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-[#161B36] text-slate-300 border-white/10 hover:border-white/25'
                  }`}
                >
                  {preset.toFixed(2)}x
                </button>
              ))}
          </div>
        </div>

        {recentRolls.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {recentRolls.map((r, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border shrink-0 tabular-nums ${
                  r.won
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-400/30 text-rose-300'
                }`}
              >
                {r.mult.toFixed(2)}x
              </span>
            ))}
          </div>
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
              <span>Choose any multiplier up to {maxMult}x and roll!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
