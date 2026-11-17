import { formatBirr, MIN_STAKE_BIRR } from '@/src/services/platformService';
import type { ActiveWagerSession, GameCatalogItem, UserProfile } from '@/src/types/platform';
import { Banknote, Coins, Gift, LogIn, ShieldAlert, TrendingUp, Wallet } from 'lucide-react';

interface GameStakeBarProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  stakeBirr: number;
  onChangeStake: (next: number) => void;
  activeWager: ActiveWagerSession | null;
  activeStakeBirr?: number;
  isRoundRunning: boolean;
  isBusy?: boolean;
  currentMultiplier?: number;
  canCashout?: boolean;
  cashoutDisabledReason?: string;
  error?: string | null;
  onStartRound?: () => void;
  onCashout?: () => void;
  onPromptSignIn: () => void;
  onPromptDeposit?: () => void;
  startLabel?: string;
  hideStartButton?: boolean;
  stakeMultiplierLabel?: string;
}

const PRESET_STAKES = [0.1, 1, 5, 10, 25, 50, 100];

export function GameStakeBar({
  game,
  currentUser,
  stakeBirr,
  onChangeStake,
  activeWager,
  activeStakeBirr,
  isRoundRunning,
  isBusy = false,
  currentMultiplier = 1,
  canCashout = false,
  cashoutDisabledReason,
  error,
  onStartRound,
  onCashout,
  onPromptSignIn,
  onPromptDeposit,
  startLabel = 'Play with Birr',
  hideStartButton = false,
  stakeMultiplierLabel,
}: GameStakeBarProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const bonusBirr = game.bonusBirr || 0;
  const balance = currentUser?.balanceBirr ?? 0;
  const insufficient = Boolean(currentUser && balance < stakeBirr);

  const effectiveStake = activeWager?.stakeBirr ?? activeStakeBirr ?? 0;
  const effectiveMaxMult = activeWager?.maxAllowedMultiplier ?? game.maxMultiplier ?? 5;
  const effectiveBonus = activeWager?.bonusBirr ?? bonusBirr;

  const potentialCashout = effectiveStake > 0
    ? Math.round(
        (effectiveStake * Math.min(effectiveMaxMult, currentMultiplier) +
          (currentMultiplier > 1 ? effectiveBonus : 0)) *
          100
      ) / 100
    : 0;

  return (
    <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-3.5 sm:p-4 space-y-3">
      {/* Stake, Multiplier, Bonus & Balance Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-[#151A31] border border-white/10 text-amber-200 font-semibold tabular-nums">
            Up to {effectiveMaxMult}x
          </span>
          {bonusBirr > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 font-semibold flex items-center gap-1 tabular-nums">
              <Gift className="w-3.5 h-3.5" />+{formatBirr(bonusBirr)} Bonus (&gt;1x)
            </span>
          )}
          <span className="text-slate-400 tabular-nums">
            Min stake: <strong className="text-slate-200">{minStake} Birr</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 tabular-nums">
          {currentUser ? (
            <div className="text-slate-300">
              Wallet:{' '}
              <strong className="text-amber-300 font-mono">
                {formatBirr(currentUser.balanceBirr)}
              </strong>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPromptSignIn}
              className="px-2.5 py-1 rounded-lg bg-violet-600/25 border border-violet-400/30 text-violet-200 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In to Play Birr
            </button>
          )}
        </div>
      </div>

      {/* Active Round Cashout / Running HUD vs Stake Selector */}
      {isRoundRunning && effectiveStake > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm tabular-nums">
            <div>
              <span className="text-slate-400">Stake:</span>{' '}
              <strong className="text-white font-mono">{formatBirr(effectiveStake)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Live Multiplier:</span>{' '}
              <strong
                className={`font-mono ${
                  currentMultiplier > 1
                    ? 'text-emerald-300'
                    : currentMultiplier > 0
                      ? 'text-amber-300'
                      : 'text-rose-300'
                }`}
              >
                {currentMultiplier.toFixed(2)}x
              </strong>
            </div>
            {game.cashoutEnabled && (
              <div>
                <span className="text-slate-400">Cashout Value:</span>{' '}
                <strong className="text-amber-300 font-mono">{formatBirr(potentialCashout)}</strong>
              </div>
            )}
          </div>

          {onCashout && game.cashoutEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              {!canCashout && cashoutDisabledReason && (
                <span className="text-[11px] text-slate-400">{cashoutDisabledReason}</span>
              )}
              <button
                type="button"
                disabled={!canCashout || isBusy || currentMultiplier <= 0}
                onClick={onCashout}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 cursor-pointer tabular-nums"
              >
                <Banknote className="w-4 h-4" />
                <span>Cash Out {formatBirr(potentialCashout)}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-300" />
              Stake:
            </span>
            {PRESET_STAKES.filter((s) => s >= minStake).map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={isRoundRunning || isBusy}
                onClick={() => onChangeStake(amt)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums cursor-pointer transition-colors ${
                  stakeBirr === amt
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#171C33] hover:bg-[#1E2542] text-slate-200 border border-white/10'
                }`}
              >
                {amt} Birr
              </button>
            ))}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                min={minStake}
                max={100000}
                step={0.1}
                value={stakeBirr}
                disabled={isRoundRunning || isBusy}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const rounded = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : minStake;
                  onChangeStake(Math.max(minStake, rounded));
                }}
                aria-label="Custom Birr Stake"
                className="w-20 px-2 py-1.5 rounded-lg bg-[#090C18] border border-white/15 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400">Birr</span>
            </div>
            {stakeMultiplierLabel && (
              <span className="text-[11px] text-amber-300 font-medium ml-1">
                ({stakeMultiplierLabel})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!currentUser ? (
              <button
                type="button"
                onClick={onPromptSignIn}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In to Stake Birr
              </button>
            ) : insufficient ? (
              <button
                type="button"
                onClick={onPromptDeposit}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                Deposit Birr ({formatBirr(stakeBirr - balance)} needed)
              </button>
            ) : (
              !hideStartButton &&
              onStartRound && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onStartRound}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer tabular-nums"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>
                    {isBusy ? 'Starting...' : `${startLabel} (${formatBirr(stakeBirr)})`}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 px-3 py-2 text-xs text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-300" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
