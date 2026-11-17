import { useEffect, useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import { useLiveRounds } from '@/src/hooks/useLiveRounds';
import {
  cashoutLiveKenoOnServer,
  formatBirr,
  lockLiveKenoTicket,
  MIN_STAKE_BIRR,
  settleLiveKenoTicket,
} from '@/src/services/platformService';
import type {
  GameCatalogItem,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import { soundFx } from '@/src/utils/sound';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Eraser,
  Lock,
  Radio,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

interface KenoGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const MAX_SPOTS = 10;
const TOTAL_NUMBERS = 40;

export function KenoGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: KenoGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const { rounds, setRounds, connected, liveError, retryNow } = useLiveRounds('keno');
  const keno = rounds?.keno ?? null;

  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [selected, setSelected] = useState<number[]>([7, 14, 21, 28, 35]);
  const [lockedRoundId, setLockedRoundId] = useState<number | null>(null);
  const [lockedPicks, setLockedPicks] = useState<number[]>([]);
  const [lockedStake, setLockedStake] = useState<number>(minStake);
  const [locking, setLocking] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prevBallCountRef = useRef<number>(0);
  const prevRoundIdRef = useRef<number | null>(null);
  const settledRoundsRef = useRef<Set<number>>(new Set());

  const isLockedForCurrentRound = keno !== null && lockedRoundId === keno.roundId;
  const activePicks = isLockedForCurrentRound ? lockedPicks : selected;

  // Ball pop sound cues & round reset
  useEffect(() => {
    if (!keno) return;

    if (prevRoundIdRef.current === null) {
      prevRoundIdRef.current = keno.roundId;
      prevBallCountRef.current = keno.drawnBalls.length;
      return;
    }

    if (prevRoundIdRef.current !== keno.roundId) {
      prevBallCountRef.current = 0;
      setBanner(null);
      setErrorMsg(null);
      setLockedRoundId(null);
      setLockedPicks([]);
    }
    prevRoundIdRef.current = keno.roundId;

    if (keno.drawnBalls.length > prevBallCountRef.current) {
      const newlyPopped = keno.drawnBalls.slice(prevBallCountRef.current);
      const checkSet = isLockedForCurrentRound ? lockedPicks : selected;
      for (const ball of newlyPopped) {
        if (checkSet.includes(ball)) {
          soundFx.bonus();
        } else {
          soundFx.move();
        }
      }
      prevBallCountRef.current = keno.drawnBalls.length;
    } else if (keno.drawnBalls.length < prevBallCountRef.current) {
      prevBallCountRef.current = keno.drawnBalls.length;
    }
  }, [keno, isLockedForCurrentRound, lockedPicks, selected]);

  const handleLockTicket = async (roundId: number, picksToLock: number[]) => {
    if (locking || picksToLock.length === 0 || isLockedForCurrentRound) return;
    if (!currentUser) {
      onPromptSignIn();
      return;
    }
    if (currentUser.balanceBirr < stakeBirr) {
      onPromptDeposit();
      return;
    }

    setLocking(true);
    setErrorMsg(null);
    try {
      const res = await lockLiveKenoTicket({
        roundId,
        picks: picksToLock,
        stakeBirr,
      });
      setRounds(res.rounds);
      if (res.snapshot) onSnapshotSync(res.snapshot);
      setLockedRoundId(roundId);
      setLockedPicks([...picksToLock]);
      setLockedStake(stakeBirr);
      soundFx.match();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to lock Keno picks.');
    } finally {
      setLocking(false);
    }
  };

  // Settle locked ticket automatically once the server reaches 'results' phase
  useEffect(() => {
    if (!keno) return;
    if (
      keno.phase === 'results' &&
      lockedRoundId === keno.roundId &&
      !settledRoundsRef.current.has(keno.roundId)
    ) {
      settledRoundsRef.current.add(keno.roundId);
      void settleLiveKenoTicket({
        roundId: keno.roundId,
        gameSlug: game.slug,
        gameTitle: game.title,
      })
        .then((res) => {
          setRounds(res.rounds);
          if (res.snapshot) {
            onSnapshotSync(res.snapshot);
          }
          const { hits, picks, payoutBirr, multiplier, isWin } = res.result;
          if (isWin || payoutBirr > 0) {
            soundFx.win();
            setBanner(
              `Round #${keno.roundId}: ${hits}/${picks.length} hits (${multiplier.toFixed(2)}x) · Won ${formatBirr(payoutBirr)}!`
            );
          } else {
            soundFx.error();
            setBanner(
              `Round #${keno.roundId}: ${hits}/${picks.length} hits · Below payout threshold (0 Birr)`
            );
          }
        })
        .catch(() => {
          settledRoundsRef.current.delete(keno.roundId);
        });
    }
  }, [keno, lockedRoundId, game.slug, game.title, onSnapshotSync, setRounds]);

  const toggleSpot = (num: number) => {
    if (isLockedForCurrentRound) return;
    setErrorMsg(null);
    setSelected((prev) => {
      if (prev.includes(num)) {
        soundFx.flip();
        return prev.filter((n) => n !== num);
      }
      if (prev.length >= MAX_SPOTS) {
        soundFx.error();
        return prev;
      }
      soundFx.move();
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const quickPick = (count: number) => {
    if (isLockedForCurrentRound) return;
    setErrorMsg(null);
    const pool = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSelected(pool.slice(0, count).sort((a, b) => a - b));
    soundFx.match();
  };

  const clearPicks = () => {
    if (isLockedForCurrentRound) return;
    setSelected([]);
    soundFx.flip();
  };

  const drawnBalls = keno?.drawnBalls ?? [];
  const hitsCount = activePicks.filter((n) => drawnBalls.includes(n)).length;
  const roundAlreadySettled = Boolean(keno && settledRoundsRef.current.has(keno.roundId));

  const liveMultiplier =
    hitsCount === 0
      ? 0.5
      : hitsCount === 1
        ? 0.85
        : Math.min(game.maxMultiplier || 10, Math.round((1.05 + (hitsCount - 1) * 0.45) * 100) / 100);

  const canEarlyCashout = Boolean(
    isLockedForCurrentRound &&
      keno?.phase === 'drawing' &&
      hitsCount >= 1 &&
      !roundAlreadySettled &&
      !cashingOut
  );

  const handleEarlyCashout = async () => {
    if (!keno || !canEarlyCashout) return;
    setCashingOut(true);
    setErrorMsg(null);
    try {
      const res = await cashoutLiveKenoOnServer({
        roundId: keno.roundId,
        gameSlug: game.slug,
        gameTitle: game.title,
      });
      settledRoundsRef.current.add(keno.roundId);
      setRounds(res.rounds);
      if (res.snapshot) {
        onSnapshotSync(res.snapshot);
      }
      soundFx.win();
      setBanner(
        `Cashed Out Round #${keno.roundId} (${res.result.hits} hits @ ${res.result.multiplier.toFixed(2)}x)! Won ${formatBirr(res.result.payoutBirr)}`
      );
    } catch (err) {
      soundFx.error();
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cash out early.');
    } finally {
      setCashingOut(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <div className="w-full">
        <GameStakeBar
          game={game}
          currentUser={currentUser}
          stakeBirr={stakeBirr}
          onChangeStake={setStakeBirr}
          activeWager={null}
          activeStakeBirr={isLockedForCurrentRound ? lockedStake : 0}
          isRoundRunning={isLockedForCurrentRound && !roundAlreadySettled}
          isBusy={locking || cashingOut}
          currentMultiplier={liveMultiplier}
          canCashout={canEarlyCashout}
          cashoutDisabledReason={
            keno?.phase === 'drawing'
              ? 'Hit 1+ popped ball to Cash Out early'
              : 'Live draw starting soon'
          }
          onCashout={() => void handleEarlyCashout()}
          hideStartButton
          onPromptSignIn={onPromptSignIn}
          onPromptDeposit={onPromptDeposit}
        />
      </div>

      {/* Live Synchronized Round Status & Timer Banner */}
      <div className="w-full rounded-2xl bg-[#101426] border border-violet-400/25 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 tabular-nums ${
              keno?.phase === 'drawing'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : keno?.phase === 'results'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-violet-600/25 border-violet-400/50 text-white'
            }`}
          >
            <Clock className="w-4 h-4 mb-0.5" />
            <span className="text-xs font-mono font-bold leading-none">
              {keno ? `${keno.secondsRemaining}s` : '--'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-display font-bold text-white">
                {keno ? `Live Round #${keno.roundId}` : 'Syncing Live Round...'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                  connected
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>{connected ? 'Live Sync' : 'Reconnecting'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {!keno
                ? 'Connecting to shared server draw clock...'
                : keno.phase === 'picking'
                  ? `Pick 1–10 spots & lock Birr ticket! Shared draw starts in ${keno.secondsRemaining}s`
                  : keno.phase === 'drawing'
                    ? `Popping shared balls (${keno.drawnBalls.length}/${keno.totalBallsToDraw}) · Next in ${keno.nextBallInSeconds}s`
                    : `Round #${keno.roundId} complete · Next round opens in ${keno.secondsRemaining}s`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
          <div className="px-2.5 py-1.5 rounded-lg bg-[#090C18] border border-white/10 text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-300" />
            <span>{keno?.activePlayers ?? 1} live</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-[#090C18] border border-white/10 text-amber-300">
            {keno?.lockedTicketsCount ?? 0} tickets
          </div>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-[#101426] border border-white/10 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLockedForCurrentRound}
            onClick={() => quickPick(5)}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#18203D] hover:bg-violet-600/30 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Shuffle className="w-3.5 h-3.5 text-violet-300" />
            <span>Quick Pick 5</span>
          </button>
          <button
            type="button"
            disabled={isLockedForCurrentRound}
            onClick={() => quickPick(8)}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#18203D] hover:bg-blue-600/30 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Shuffle className="w-3.5 h-3.5 text-blue-300" />
            <span>Quick Pick 8</span>
          </button>
          <button
            type="button"
            disabled={isLockedForCurrentRound}
            onClick={clearPicks}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#090C18] hover:bg-white/5 border border-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <span className="text-slate-300">
            Picks: <strong className="text-white">{activePicks.length}/{MAX_SPOTS}</strong>
          </span>
          <span className="text-amber-300">
            Hits: <strong>{hitsCount}</strong>
          </span>
        </div>
      </div>

      {/* Drawn Balls Strip */}
      <div className="w-full rounded-xl bg-[#0F1324] border border-white/10 p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Shared Popped Balls ({drawnBalls.length}/{keno?.totalBallsToDraw ?? 10})
          </span>
          {banner ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              <span>{banner}</span>
            </span>
          ) : isLockedForCurrentRound ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                Locked {lockedPicks.length} picks · {formatBirr(lockedStake)} staked
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span>Pick 1–10 spots & lock your Birr ticket before draw starts</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 min-h-[38px]">
          {Array.from({ length: 10 }).map((_, i) => {
            const ball = drawnBalls[i];
            const isHit = ball !== undefined && activePicks.includes(ball);
            return (
              <div
                key={i}
                className={`h-9 rounded-lg border flex items-center justify-center font-mono text-xs font-bold tabular-nums transition-all ${
                  ball === undefined
                    ? 'bg-[#080B16] border-white/8 text-slate-600'
                    : isHit
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)] scale-105'
                      : 'bg-blue-500/18 border-blue-400/45 text-blue-200'
                }`}
              >
                {ball ?? '—'}
              </div>
            );
          })}
        </div>
      </div>

      {(errorMsg || liveError) && (
        <div className="w-full rounded-xl bg-rose-500/10 border border-rose-400/35 px-3.5 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMsg || liveError}</span>
          {liveError && (
            <button
              type="button"
              onClick={retryNow}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-semibold shrink-0 cursor-pointer"
            >
              Retry Sync
            </button>
          )}
        </div>
      )}

      {/* 1-40 Keno Grid */}
      <div
        className="w-full grid grid-cols-5 sm:grid-cols-8 gap-2 bg-[#0B0E1D] border border-white/10 rounded-2xl p-3 sm:p-4"
        role="grid"
        aria-label="Keno Number Board"
      >
        {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map((num) => {
          const isPicked = activePicks.includes(num);
          const isDrawn = drawnBalls.includes(num);
          const isHit = isPicked && isDrawn;

          return (
            <button
              key={num}
              type="button"
              disabled={isLockedForCurrentRound}
              onClick={() => toggleSpot(num)}
              className={`min-h-[44px] sm:min-h-[48px] rounded-xl border font-mono font-bold text-sm tabular-nums transition-all cursor-pointer active:scale-95 ${
                isHit
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                  : isPicked
                    ? 'bg-violet-600 border-violet-400 text-white'
                    : isDrawn
                      ? 'bg-blue-500/18 border-blue-400/40 text-blue-200'
                      : 'bg-[#141932] border-white/10 text-slate-300 hover:border-violet-400/45 hover:bg-[#1B2244]'
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Round Lock Button & Live Winners Feed */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        {keno?.phase === 'picking' ? (
          <button
            type="button"
            disabled={locking || selected.length === 0 || isLockedForCurrentRound}
            onClick={() => keno && void handleLockTicket(keno.roundId, selected)}
            className={`min-h-[46px] px-7 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer ${
              isLockedForCurrentRound
                ? 'bg-emerald-600/25 border border-emerald-400/45 text-emerald-200'
                : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white'
            }`}
          >
            {isLockedForCurrentRound ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Ticket Locked ({formatBirr(lockedStake)}) · Draw in {keno.secondsRemaining}s</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>
                  {locking
                    ? 'Locking Birr Ticket...'
                    : `Lock ${selected.length} Picks (${formatBirr(stakeBirr)})`}
                </span>
              </>
            )}
          </button>
        ) : canEarlyCashout ? (
          <button
            type="button"
            disabled={cashingOut}
            onClick={() => void handleEarlyCashout()}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-lg cursor-pointer tabular-nums"
          >
            <Banknote className="w-4 h-4" />
            <span>
              Cash Out Early ({hitsCount} hits · {liveMultiplier.toFixed(2)}x)
            </span>
          </button>
        ) : (
          <div className="text-xs text-slate-300 bg-[#0F1324] border border-white/10 rounded-xl px-4 py-2.5">
            {keno?.phase === 'drawing'
              ? roundAlreadySettled
                ? banner || 'Ticket settled for this round!'
                : 'Live draw in progress — balls pop automatically every 1.8s (hit 1+ ball to Cash Out early)'
              : `Next round starts in ${keno?.secondsRemaining ?? '--'}s`}
          </div>
        )}

        {keno && keno.winners.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-[11px] font-semibold text-amber-300 shrink-0">
              Winners:
            </span>
            {keno.winners.slice(0, 4).map((w, i) => (
              <span
                key={`${w.username}-${i}`}
                className="px-2.5 py-1 rounded-lg bg-[#0F1324] border border-amber-400/25 text-[11px] text-slate-200 whitespace-nowrap shrink-0 tabular-nums"
              >
                {w.username} · {w.detail} ({formatBirr(w.payoutBirr)})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
