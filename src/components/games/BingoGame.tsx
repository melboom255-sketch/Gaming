import { useEffect, useMemo, useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import { useLiveRounds } from '@/src/hooks/useLiveRounds';
import {
  cashoutLiveBingoOnServer,
  claimLiveBingoOnServer,
  fetchBingoRoundDeck,
  formatBirr,
  lockLiveBingoCards,
  MIN_STAKE_BIRR,
  settleBingoHouseLossOnServer,
} from '@/src/services/platformService';
import type {
  BingoDeckCard,
  GameCatalogItem,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import { soundFx } from '@/src/utils/sound';
import {
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Eraser,
  Layers,
  Lock,
  Radio,
  Shuffle,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';

interface BingoGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const BINGO_LETTERS: ('B' | 'I' | 'N' | 'G' | 'O')[] = ['B', 'I', 'N', 'G', 'O'];
const MAX_COMBO_CARDS = 4;

const WIN_LINES: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

function getLetterForNumber(n: number): 'B' | 'I' | 'N' | 'G' | 'O' {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

function findWinningLine(
  values: Array<number | 'FREE'>,
  daubedSet: Set<number | 'FREE'>
): number[] | null {
  for (const line of WIN_LINES) {
    if (
      line.every((idx) => {
        const val = values[idx];
        return val === 'FREE' || daubedSet.has(val);
      })
    ) {
      return line;
    }
  }
  return null;
}

function getBestLineCount(
  values: Array<number | 'FREE'>,
  daubedSet: Set<number | 'FREE'>
): number {
  let best = 0;
  for (const line of WIN_LINES) {
    let count = 0;
    for (const idx of line) {
      const val = values[idx];
      if (val === 'FREE' || daubedSet.has(val)) {
        count += 1;
      }
    }
    if (count > best) best = count;
  }
  return best;
}

export function BingoGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: BingoGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const { rounds, setRounds, connected, liveError, retryNow } = useLiveRounds('bingo');
  const bingo = rounds?.bingo ?? null;

  const [stakePerCardBirr, setStakePerCardBirr] = useState<number>(minStake);
  const [deck, setDeck] = useState<BingoDeckCard[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [selectedCardNumbers, setSelectedCardNumbers] = useState<number[]>([1, 7]);
  const [lockedRoundId, setLockedRoundId] = useState<number | null>(null);
  const [lockedCardNumbers, setLockedCardNumbers] = useState<number[]>([]);
  const [lockedTotalStake, setLockedTotalStake] = useState<number>(0);
  const [manualDaubsByCard, setManualDaubsByCard] = useState<Record<number, number[]>>({});
  const [autoDaub, setAutoDaub] = useState(true);
  const [locking, setLocking] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [claimingCard, setClaimingCard] = useState<number | null>(null);
  const [claimedRoundId, setClaimedRoundId] = useState<number | null>(null);
  const [wonCardResult, setWonCardResult] = useState<{
    cardNumber: number;
    line: number[];
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prevRoundIdRef = useRef<number | null>(null);
  const prevCalledCountRef = useRef<number>(0);
  const settledLossRoundsRef = useRef<Set<number>>(new Set());

  const calledNumbers = bingo?.calledNumbers ?? [];
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const currentBall = bingo?.currentBall ?? null;
  const isLockedForCurrentRound = bingo !== null && lockedRoundId === bingo.roundId;
  const finishedThisRound = bingo !== null && claimedRoundId === bingo.roundId;

  useEffect(() => {
    if (!bingo) return;
    let cancelled = false;
    setDeckLoading(true);

    void fetchBingoRoundDeck(bingo.roundId)
      .then((res) => {
        if (cancelled) return;
        setDeck(res.cards);
        setDeckLoading(false);
        if (res.myLockedCards.length > 0) {
          setLockedRoundId(res.roundId);
          setLockedCardNumbers(res.myLockedCards);
          setSelectedCardNumbers(res.myLockedCards);
          setLockedTotalStake((prev) =>
            prev > 0 ? prev : res.myLockedCards.length * stakePerCardBirr
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDeckLoading(false);
          setErrorMsg(
            err instanceof Error ? err.message : 'Unable to load Bingo card deck.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bingo?.roundId, bingo?.lockedCardsCount]);

  useEffect(() => {
    if (!bingo) return;

    if (prevRoundIdRef.current === null) {
      prevRoundIdRef.current = bingo.roundId;
      prevCalledCountRef.current = bingo.calledNumbers.length;
      return;
    }

    if (prevRoundIdRef.current !== bingo.roundId) {
      prevCalledCountRef.current = 0;
      setManualDaubsByCard({});
      setWonCardResult(null);
      setClaimedRoundId(null);
      setBanner(null);
      setErrorMsg(null);
      setLockedRoundId(null);
      setLockedCardNumbers([]);
      setLockedTotalStake(0);
      soundFx.move();
    }
    prevRoundIdRef.current = bingo.roundId;

    if (bingo.calledNumbers.length > prevCalledCountRef.current) {
      const newlyPopped = bingo.calledNumbers.slice(prevCalledCountRef.current);
      const activeNums = isLockedForCurrentRound ? lockedCardNumbers : selectedCardNumbers;
      const activeCards = deck.filter((c) => activeNums.includes(c.cardNumber));
      const anyHit = activeCards.some((card) =>
        card.values.some((v) => typeof v === 'number' && newlyPopped.includes(v))
      );
      if (anyHit) {
        soundFx.match();
      } else {
        soundFx.move();
      }
      prevCalledCountRef.current = bingo.calledNumbers.length;
    } else if (bingo.calledNumbers.length < prevCalledCountRef.current) {
      prevCalledCountRef.current = bingo.calledNumbers.length;
    }
  }, [bingo, deck, isLockedForCurrentRound, lockedCardNumbers, selectedCardNumbers]);

  const handleLockCombo = async (roundId: number, cardNumsToLock: number[]) => {
    if (locking || cardNumsToLock.length === 0 || isLockedForCurrentRound) return;
    if (!currentUser) {
      onPromptSignIn();
      return;
    }
    const needed = stakePerCardBirr * cardNumsToLock.length;
    if (currentUser.balanceBirr < needed) {
      onPromptDeposit();
      return;
    }

    setLocking(true);
    setErrorMsg(null);
    try {
      const res = await lockLiveBingoCards({
        roundId,
        cardNumbers: cardNumsToLock,
        stakePerCardBirr,
      });
      setRounds(res.rounds);
      setDeck(res.deck.cards);
      if (res.snapshot) onSnapshotSync(res.snapshot);
      setLockedRoundId(roundId);
      setLockedCardNumbers(res.lockedCards);
      setSelectedCardNumbers(res.lockedCards);
      setLockedTotalStake(res.totalStakeBirr);
      soundFx.match();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to lock card combination.');
    } finally {
      setLocking(false);
    }
  };

  const takenSet = useMemo(
    () => new Set(bingo?.takenCardNumbers ?? []),
    [bingo?.takenCardNumbers]
  );

  const toggleCardChoice = (cardNumber: number) => {
    if (bingo?.phase !== 'lobby' || isLockedForCurrentRound) return;
    if (takenSet.has(cardNumber)) {
      soundFx.error();
      setErrorMsg(`Card #${cardNumber} is already picked by another player.`);
      return;
    }

    setErrorMsg(null);
    setSelectedCardNumbers((prev) => {
      if (prev.includes(cardNumber)) {
        soundFx.flip();
        return prev.filter((n) => n !== cardNumber);
      }
      if (prev.length >= MAX_COMBO_CARDS) {
        soundFx.error();
        setErrorMsg(`You can combine up to ${MAX_COMBO_CARDS} cards per round.`);
        return prev;
      }
      soundFx.move();
      return [...prev, cardNumber].sort((a, b) => a - b);
    });
  };

  const quickPickCombo = (count: number) => {
    if (bingo?.phase !== 'lobby' || isLockedForCurrentRound) return;
    setErrorMsg(null);
    const available = Array.from({ length: 40 }, (_, i) => i + 1).filter(
      (cn) => !takenSet.has(cn)
    );
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    setSelectedCardNumbers(available.slice(0, count).sort((a, b) => a - b));
    soundFx.match();
  };

  const handleCellClick = (cardNumber: number, val: number | 'FREE') => {
    if (finishedThisRound || val === 'FREE' || autoDaub) return;
    if (!calledSet.has(val)) {
      soundFx.error();
      return;
    }
    setManualDaubsByCard((prev) => {
      const existing = prev[cardNumber] || [];
      if (existing.includes(val)) return prev;
      soundFx.match();
      return { ...prev, [cardNumber]: [...existing, val] };
    });
  };

  const handleClaimBingo = async (card: BingoDeckCard) => {
    if (!bingo || finishedThisRound || claimingCard !== null) return;
    setClaimingCard(card.cardNumber);
    setErrorMsg(null);
    try {
      const res = await claimLiveBingoOnServer({
        roundId: bingo.roundId,
        cardNumber: card.cardNumber,
        cardValues: card.values,
        gameSlug: game.slug,
        gameTitle: game.title,
      });

      setRounds(res.rounds);
      if (res.snapshot) {
        onSnapshotSync(res.snapshot);
      }

      setWonCardResult({
        cardNumber: card.cardNumber,
        line: res.result.winningLine || [],
      });
      setClaimedRoundId(bingo.roundId);
      soundFx.win();
      setBanner(
        `Card #${card.cardNumber} BINGO at ${res.result.ballsUsed} balls (${res.result.multiplier.toFixed(2)}x)! Won ${formatBirr(res.result.payoutBirr)}`
      );
    } catch (err) {
      soundFx.error();
      setErrorMsg(err instanceof Error ? err.message : 'Unable to verify Bingo.');
    } finally {
      setClaimingCard(null);
    }
  };

  const displayedCardNumbers =
    bingo?.phase === 'lobby'
      ? selectedCardNumbers
      : isLockedForCurrentRound
        ? lockedCardNumbers
        : [];

  const displayedCards = useMemo(() => {
    const map = new Map(deck.map((c) => [c.cardNumber, c]));
    return displayedCardNumbers
      .map((cn) => map.get(cn))
      .filter((c): c is BingoDeckCard => Boolean(c));
  }, [deck, displayedCardNumbers]);

  const maxLockedBestLine = useMemo(() => {
    if (!isLockedForCurrentRound) return 0;
    let best = 0;
    for (const card of displayedCards) {
      const cardDaubSet = new Set<number | 'FREE'>(['FREE']);
      if (autoDaub) {
        for (const n of calledNumbers) cardDaubSet.add(n);
      } else {
        for (const n of manualDaubsByCard[card.cardNumber] || []) {
          cardDaubSet.add(n);
        }
      }
      best = Math.max(best, getBestLineCount(card.values, cardDaubSet));
    }
    return best;
  }, [isLockedForCurrentRound, displayedCards, autoDaub, calledNumbers, manualDaubsByCard]);

  const liveCashoutMult =
    maxLockedBestLine >= 5
      ? Math.min(game.maxMultiplier || 8, 1.85)
      : maxLockedBestLine === 4
        ? 1.15
        : maxLockedBestLine === 3
          ? 0.75
          : 0.5;

  const canEarlyCashout = Boolean(
    isLockedForCurrentRound &&
      bingo?.phase === 'calling' &&
      !bingo.houseBingoReached &&
      !finishedThisRound &&
      maxLockedBestLine >= 3 &&
      !cashingOut
  );

  // Settle House AI win automatically once House AI reaches its target ball
  useEffect(() => {
    if (!bingo) return;
    if (
      isLockedForCurrentRound &&
      bingo.houseBingoReached &&
      !finishedThisRound &&
      !settledLossRoundsRef.current.has(bingo.roundId)
    ) {
      settledLossRoundsRef.current.add(bingo.roundId);
      void settleBingoHouseLossOnServer({
        roundId: bingo.roundId,
        gameSlug: game.slug,
        gameTitle: game.title,
      })
        .then((res) => {
          setRounds(res.rounds);
          if (res.snapshot) {
            onSnapshotSync(res.snapshot);
          }
          setClaimedRoundId(bingo.roundId);
          soundFx.error();
          setBanner(
            `House AI reached Bingo at ball #${res.result.houseTargetBall}! Stake settled (0 Birr)`
          );
        })
        .catch(() => {
          settledLossRoundsRef.current.delete(bingo.roundId);
        });
    }
  }, [
    bingo,
    isLockedForCurrentRound,
    finishedThisRound,
    game.slug,
    game.title,
    onSnapshotSync,
    setRounds,
  ]);

  const handleEarlyCashout = async () => {
    if (!bingo || !canEarlyCashout) return;
    setCashingOut(true);
    setErrorMsg(null);
    try {
      const res = await cashoutLiveBingoOnServer({
        roundId: bingo.roundId,
        gameSlug: game.slug,
        gameTitle: game.title,
      });
      settledLossRoundsRef.current.add(bingo.roundId);
      setClaimedRoundId(bingo.roundId);
      setRounds(res.rounds);
      if (res.snapshot) {
        onSnapshotSync(res.snapshot);
      }
      soundFx.win();
      setBanner(
        `Cashed Out early (${res.result.bestLine}/5 line @ ${res.result.multiplier.toFixed(2)}x)! Won ${formatBirr(res.result.payoutBirr)}`
      );
    } catch (err) {
      soundFx.error();
      setErrorMsg(err instanceof Error ? err.message : 'Unable to cash out early.');
    } finally {
      setCashingOut(false);
    }
  };

  const totalPendingStake = stakePerCardBirr * Math.max(1, selectedCardNumbers.length);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      <div className="w-full">
        <GameStakeBar
          game={game}
          currentUser={currentUser}
          stakeBirr={stakePerCardBirr}
          onChangeStake={setStakePerCardBirr}
          activeWager={null}
          activeStakeBirr={isLockedForCurrentRound ? lockedTotalStake : 0}
          isRoundRunning={isLockedForCurrentRound && !finishedThisRound}
          isBusy={locking || cashingOut}
          currentMultiplier={liveCashoutMult}
          canCashout={canEarlyCashout}
          cashoutDisabledReason="Reach 3/5 on a line to unlock Early Cash Out"
          onCashout={() => void handleEarlyCashout()}
          hideStartButton
          stakeMultiplierLabel={`${selectedCardNumbers.length} card${selectedCardNumbers.length === 1 ? '' : 's'} = ${formatBirr(totalPendingStake)}`}
          onPromptSignIn={onPromptSignIn}
          onPromptDeposit={onPromptDeposit}
        />
      </div>

      {/* Live Synchronized Round Timer Header */}
      <div className="w-full rounded-2xl bg-[#101426] border border-violet-400/25 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 tabular-nums ${
              bingo?.phase === 'calling'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : bingo?.phase === 'results'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-violet-600/25 border-violet-400/50 text-white'
            }`}
          >
            <Clock className="w-4 h-4 mb-0.5" />
            <span className="text-xs font-mono font-bold leading-none">
              {bingo ? `${bingo.secondsRemaining}s` : '--'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-display font-bold text-white">
                {bingo ? `Live Bingo Round #${bingo.roundId}` : 'Syncing Live Bingo...'}
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
              {!bingo
                ? 'Connecting to shared 75-ball caller...'
                : bingo.phase === 'lobby'
                  ? `1-Minute Picker: choose 1–4 cards & lock Birr stake! Calls start in ${bingo.secondsRemaining}s`
                  : bingo.phase === 'calling'
                    ? `Shared balls (${calledNumbers.length}/${bingo.totalBallsToCall}) · Beat House AI before ball #${bingo.houseTargetBall}!`
                    : `Round #${bingo.roundId} complete · 1-minute card picking opens in ${bingo.secondsRemaining}s`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {bingo && bingo.phase !== 'lobby' && (
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 tabular-nums ${
                bingo.houseBingoReached
                  ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                  : 'bg-[#090C18] border-white/10 text-violet-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>
                {bingo.houseBingoReached
                  ? `House Bingo @ #${bingo.houseTargetBall}`
                  : `House AI Goal: #${bingo.houseTargetBall}`}
              </span>
            </div>
          )}
          <div className="px-2.5 py-1.5 rounded-lg bg-[#090C18] border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5 tabular-nums">
            <Users className="w-3.5 h-3.5 text-blue-300" />
            <span>{bingo?.activePlayers ?? 1} live</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDaub}
              onChange={(e) => setAutoDaub(e.target.checked)}
              className="accent-violet-500 w-4 h-4 rounded"
            />
            <span>Auto-Daub</span>
          </label>
        </div>
      </div>

      {/* Live Shared Ball Caller Bar */}
      <div className="w-full rounded-xl bg-[#0F1324] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 border border-amber-300/40 flex flex-col items-center justify-center shrink-0 shadow-lg">
            {currentBall !== null ? (
              <>
                <span className="text-[10px] font-bold text-amber-200 leading-none">
                  {getLetterForNumber(currentBall)}
                </span>
                <span className="text-base font-mono font-bold text-white tabular-nums leading-tight">
                  {currentBall}
                </span>
              </>
            ) : (
              <span className="text-xs text-white/70">--</span>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-white tabular-nums">
              {calledNumbers.length} / {bingo?.totalBallsToCall ?? 60} Shared Balls Popped
            </div>
            <div className="text-xs text-slate-400">
              {banner ? (
                <span className="text-amber-300 font-semibold inline-flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  {banner}
                </span>
              ) : bingo?.phase === 'lobby' ? (
                <span>
                  1-Minute Choosing Window · Combine 1–{MAX_COMBO_CARDS} cards ({formatBirr(stakePerCardBirr)}/card)
                </span>
              ) : isLockedForCurrentRound ? (
                <span>
                  Locked {lockedCardNumbers.length} card combo ({lockedCardNumbers.map((n) => `#${n}`).join(', ')}) · {formatBirr(lockedTotalStake)} staked
                </span>
              ) : (
                <span>
                  Round in progress — card choosing opens in {(bingo?.secondsRemaining ?? 0) + (bingo?.phase === 'calling' ? 8 : 0)}s
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {calledNumbers.slice(-6).reverse().map((num) => (
            <span
              key={num}
              className="px-2 py-1 rounded-lg bg-[#090C18] border border-white/10 text-[11px] font-mono text-slate-300 tabular-nums shrink-0"
            >
              {getLetterForNumber(num)}-{num}
            </span>
          ))}
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

      {/* 1-Minute Card Combination Picker */}
      {bingo?.phase === 'lobby' && (
        <div className="w-full rounded-2xl bg-[#0F1324] border border-white/10 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-300" />
                <span>Choose Card Combination (1 to {MAX_COMBO_CARDS} Cards)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tap #1–#40 below to build your combo and click Lock Cards to confirm your Birr stake.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isLockedForCurrentRound}
                onClick={() => quickPickCombo(1)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#161D3B] hover:bg-violet-600/30 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Shuffle className="w-3 h-3 text-violet-300" />
                <span>1 Card</span>
              </button>
              <button
                type="button"
                disabled={isLockedForCurrentRound}
                onClick={() => quickPickCombo(2)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#161D3B] hover:bg-violet-600/30 border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Shuffle className="w-3 h-3 text-blue-300" />
                <span>2 Combo</span>
              </button>
              <button
                type="button"
                disabled={isLockedForCurrentRound}
                onClick={() => quickPickCombo(4)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#161D3B] hover:bg-amber-500/25 border border-white/10 text-xs font-medium text-amber-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Shuffle className="w-3 h-3 text-amber-300" />
                <span>4 Combo</span>
              </button>
              <button
                type="button"
                disabled={isLockedForCurrentRound}
                onClick={() => {
                  setSelectedCardNumbers([]);
                  soundFx.flip();
                }}
                className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#090C18] hover:bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Eraser className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 40 }, (_, i) => i + 1).map((cn) => {
              const isSelected = selectedCardNumbers.includes(cn);
              const isMyLocked =
                isLockedForCurrentRound && lockedCardNumbers.includes(cn);
              const isTakenByOther = takenSet.has(cn) && !isMyLocked;

              return (
                <button
                  key={cn}
                  type="button"
                  disabled={isTakenByOther || isLockedForCurrentRound}
                  onClick={() => toggleCardChoice(cn)}
                  className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold tabular-nums transition-all cursor-pointer ${
                    isTakenByOther
                      ? 'bg-[#080A14] border-white/5 text-slate-600 cursor-not-allowed line-through'
                      : isMyLocked
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                        : isSelected
                          ? 'bg-violet-600 border-amber-300/70 text-white shadow-sm'
                          : 'bg-[#141932] border-white/10 text-slate-300 hover:border-violet-400/50'
                  }`}
                >
                  #{cn}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-300">
              Combo:{' '}
              <strong className="text-white font-mono">
                {selectedCardNumbers.length > 0
                  ? selectedCardNumbers.map((n) => `#${n}`).join(', ')
                  : 'None'}
              </strong>{' '}
              <span className="text-amber-300 font-semibold">
                ({formatBirr(totalPendingStake)} total)
              </span>
            </div>

            <button
              type="button"
              disabled={locking || selectedCardNumbers.length === 0 || isLockedForCurrentRound}
              onClick={() => bingo && void handleLockCombo(bingo.roundId, selectedCardNumbers)}
              className={`min-h-[44px] px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer ${
                isLockedForCurrentRound
                  ? 'bg-emerald-600/25 border border-emerald-400/45 text-emerald-200'
                  : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white'
              }`}
            >
              {isLockedForCurrentRound ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Locked {lockedCardNumbers.length} Cards ({formatBirr(lockedTotalStake)}) · {bingo.secondsRemaining}s
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>
                    {locking
                      ? 'Locking Cards...'
                      : `Lock ${selectedCardNumbers.length} Card${selectedCardNumbers.length === 1 ? '' : 's'} (${formatBirr(totalPendingStake)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Selected / Active Cards Grid */}
      {displayedCards.length > 0 ? (
        <div
          className={`w-full grid gap-4 ${
            displayedCards.length === 1
              ? 'grid-cols-1 max-w-[380px] mx-auto'
              : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {displayedCards.map((card) => {
            const cardDaubSet = new Set<number | 'FREE'>(['FREE']);
            if (autoDaub) {
              for (const n of calledNumbers) cardDaubSet.add(n);
            } else {
              for (const n of manualDaubsByCard[card.cardNumber] || []) {
                cardDaubSet.add(n);
              }
            }

            const readyLine = !finishedThisRound
              ? findWinningLine(card.values, cardDaubSet)
              : null;
            const bestCount = getBestLineCount(card.values, cardDaubSet);
            const isWonCard = wonCardResult?.cardNumber === card.cardNumber;
            const highlightLine = isWonCard ? wonCardResult.line : readyLine;

            return (
              <div
                key={card.cardNumber}
                className={`rounded-2xl bg-[#0B0E1D] border p-3 sm:p-4 space-y-2.5 transition-all ${
                  isWonCard || readyLine
                    ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                    : 'border-amber-400/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-violet-600/25 border border-violet-400/35 text-xs font-mono font-bold text-white">
                      Card #{card.cardNumber}
                    </span>
                    {bingo?.phase !== 'lobby' && (
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        Best line: <strong className="text-amber-300">{bestCount}/5</strong>
                      </span>
                    )}
                  </div>

                  {readyLine && bingo?.phase !== 'lobby' && !bingo?.houseBingoReached && (
                    <button
                      type="button"
                      disabled={claimingCard !== null}
                      onClick={() => void handleClaimBingo(card)}
                      className="min-h-[34px] px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>
                        {claimingCard === card.cardNumber ? 'Verifying...' : 'CALL BINGO!'}
                      </span>
                    </button>
                  )}
                  {!readyLine && canEarlyCashout && bestCount >= 3 && (
                    <button
                      type="button"
                      disabled={cashingOut}
                      onClick={() => void handleEarlyCashout()}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash Out {liveCashoutMult.toFixed(2)}x</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {BINGO_LETTERS.map((letter) => (
                    <div
                      key={letter}
                      className="h-8 rounded-lg bg-gradient-to-b from-violet-600/35 to-blue-600/25 border border-white/10 flex items-center justify-center font-display font-bold text-sm text-amber-300"
                    >
                      {letter}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {card.values.map((val, idx) => {
                    const isDaubed = val === 'FREE' || cardDaubSet.has(val);
                    const isCalled = val === 'FREE' || calledSet.has(val);
                    const isWinCell = highlightLine?.includes(idx);

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={finishedThisRound || bingo?.phase === 'lobby'}
                        onClick={() => handleCellClick(card.cardNumber, val)}
                        className={`aspect-square rounded-lg border font-mono font-bold text-xs sm:text-sm tabular-nums flex items-center justify-center relative transition-all cursor-pointer ${
                          isWinCell
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100 scale-[1.03]'
                            : isDaubed
                              ? 'bg-violet-600/40 border-amber-400/75 text-white'
                              : isCalled
                                ? 'bg-blue-500/20 border-blue-400/60 text-blue-200 animate-pulse'
                                : 'bg-[#141932] border-white/10 text-slate-200'
                        }`}
                      >
                        {val === 'FREE' ? (
                          <Star className="w-4 h-4 text-amber-300 fill-amber-300/30" />
                        ) : (
                          <span>{val}</span>
                        )}
                        {isDaubed && val !== 'FREE' && (
                          <Check className="w-2.5 h-2.5 text-amber-300 absolute top-0.5 right-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-[#0F1324] border border-white/10 p-8 text-center space-y-2">
          <Sparkles className="w-7 h-7 text-amber-300 mx-auto" />
          <div className="text-sm font-display font-bold text-white">
            {!bingo || deckLoading
              ? 'Loading live Bingo cards & draw clock...'
              : bingo.phase === 'lobby'
                ? 'Select 1 to 4 cards from the #1–#40 board above'
                : `Round #${bingo.roundId} balls are popping live!`}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {!bingo
              ? 'Synchronizing with the live 75-ball round server...'
              : bingo.phase === 'lobby'
                ? 'Pick your card combination & stake in Birr before the 1-minute countdown ends.'
                : `Next 1-minute card choosing window opens in ${bingo.secondsRemaining + (bingo.phase === 'calling' ? 8 : 0)} seconds.`}
          </p>
        </div>
      )}

      {bingo && bingo.winners.length > 0 && (
        <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="text-[11px] font-semibold text-amber-300">
            Round #{bingo.roundId} Winners:
          </span>
          {bingo.winners.slice(0, 6).map((w, i) => (
            <span
              key={`${w.username}-${i}`}
              className="px-2.5 py-1 rounded-lg bg-[#0F1324] border border-amber-400/25 text-[11px] text-slate-200 tabular-nums"
            >
              {w.username} · {w.detail} ({formatBirr(w.payoutBirr)})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
