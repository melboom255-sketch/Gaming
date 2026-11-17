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
import { Sparkles, Trophy } from 'lucide-react';

type PlayerTurn = 'p1' | 'p2';

interface GebetaGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const INITIAL_BOARD = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];

function sumSlice(board: number[], start: number, end: number): number {
  let total = 0;
  for (let i = start; i <= end; i++) total += board[i];
  return total;
}

function executeMove(
  currentBoard: number[],
  pitIndex: number,
  player: PlayerTurn
): {
  nextBoard: number[];
  nextTurn: PlayerTurn;
  extraTurn: boolean;
  captured: number;
  finished: boolean;
  winner: 'p1' | 'p2' | 'draw' | null;
} {
  const board = [...currentBoard];
  let seeds = board[pitIndex];
  board[pitIndex] = 0;

  const ownStore = player === 'p1' ? 6 : 13;
  const oppStore = player === 'p1' ? 13 : 6;
  let idx = pitIndex;

  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === oppStore) continue;
    board[idx] += 1;
    seeds -= 1;
  }

  let extraTurn = idx === ownStore;
  let captured = 0;

  const isOwnPit =
    player === 'p1' ? idx >= 0 && idx <= 5 : idx >= 7 && idx <= 12;
  if (!extraTurn && isOwnPit && board[idx] === 1) {
    const opposite = 12 - idx;
    if (board[opposite] > 0) {
      captured = board[opposite] + 1;
      board[ownStore] += captured;
      board[idx] = 0;
      board[opposite] = 0;
    }
  }

  const p1Empty = sumSlice(board, 0, 5) === 0;
  const p2Empty = sumSlice(board, 7, 12) === 0;

  if (p1Empty || p2Empty) {
    board[6] += sumSlice(board, 0, 5);
    board[13] += sumSlice(board, 7, 12);
    for (let i = 0; i <= 5; i++) board[i] = 0;
    for (let i = 7; i <= 12; i++) board[i] = 0;
    extraTurn = false;

    const winner =
      board[6] > board[13] ? 'p1' : board[13] > board[6] ? 'p2' : 'draw';

    return {
      nextBoard: board,
      nextTurn: player,
      extraTurn: false,
      captured,
      finished: true,
      winner,
    };
  }

  const nextTurn: PlayerTurn = extraTurn
    ? player
    : player === 'p1'
      ? 'p2'
      : 'p1';

  return {
    nextBoard: board,
    nextTurn,
    extraTurn,
    captured,
    finished: false,
    winner: null,
  };
}

function chooseAiPit(board: number[], playerWinPercent: number, aiFavored: boolean): number {
  const validPits = [7, 8, 9, 10, 11, 12].filter((idx) => board[idx] > 0);
  if (validPits.length === 0) return -1;

  const tacticalRate = aiFavored
    ? Math.max(0.82, Math.min(0.98, (100 - playerWinPercent) / 74))
    : Math.max(0.08, Math.min(0.32, (100 - playerWinPercent) / 260));

  if (Math.random() > tacticalRate) {
    return validPits[Math.floor(Math.random() * validPits.length)];
  }

  let bestPit = validPits[0];
  let bestScore = -Infinity;

  for (const pit of validPits) {
    const sim = executeMove(board, pit, 'p2');
    const storeGain = sim.nextBoard[13] - board[13];
    // 2-ply lookahead against best p1 counter
    let oppMaxGain = 0;
    if (!sim.finished && sim.nextTurn === 'p1') {
      const p1Pits = [0, 1, 2, 3, 4, 5].filter((i) => sim.nextBoard[i] > 0);
      for (const p1p of p1Pits) {
        const oppSim = executeMove(sim.nextBoard, p1p, 'p1');
        oppMaxGain = Math.max(oppMaxGain, oppSim.nextBoard[6] - sim.nextBoard[6]);
      }
    }
    const score =
      storeGain * 3 +
      (sim.extraTurn ? 6 : 0) +
      sim.captured * 2.5 -
      oppMaxGain * 1.5 +
      (sim.winner === 'p2' ? 60 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestPit = pit;
    }
  }

  return bestPit;
}

function SeedDots({ count }: { count: number }) {
  const visible = Math.min(count, 12);
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 max-w-[44px] min-h-[18px]">
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.6)]"
        />
      ))}
    </div>
  );
}

export function GebetaGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: GebetaGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [board, setBoard] = useState<number[]>(INITIAL_BOARD);
  const [turn, setTurn] = useState<PlayerTurn>('p1');
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Choose your Birr stake above and start a Gebeta match.'
  );
  const [lastPit, setLastPit] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boardRef = useRef<number[]>(INITIAL_BOARD);
  boardRef.current = board;
  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const isPlaying = Boolean(activeWager && !winner && !settledRef.current);
  const seedLead = board[6] - board[13];
  const canCashout = isPlaying && seedLead >= 2;
  const liveCashoutMult = Math.min(
    game.maxMultiplier || 3,
    Math.round((1.05 + Math.max(0, seedLead) * 0.08) * 100) / 100
  );

  const startMatch = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await startWagerOnServer({
        gameSlug: game.slug,
        stakeBirr,
      });
      onSnapshotSync(res.snapshot);
      wagerRef.current = res.wager;
      setActiveWager(res.wager);
      settledRef.current = false;
      setBoard(INITIAL_BOARD);
      boardRef.current = INITIAL_BOARD;
      setWinner(null);
      setLastPit(null);
      setAiThinking(false);
      // When AI is favored under 70/30 odds, AI opens first ~45% of rounds
      const aiFirst = res.wager.aiFavored && Math.random() < 0.45;
      setTurn(aiFirst ? 'p2' : 'p1');
      setStatusMessage(
        aiFirst
          ? 'Axum AI takes the opening turn...'
          : 'Your turn — choose any pit on the bottom row.'
      );
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Gebeta.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || !canCashout) return;
    settledRef.current = true;
    setBusy(true);
    wagerRef.current = null;
    setActiveWager(null);
    setWinner('p1');
    soundFx.win();

    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: liveCashoutMult,
        score: board[6],
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setStatusMessage(
        `Cashed out ahead (${board[6]} to ${board[13]}) at ${res.multiplier.toFixed(2)}x · Won ${formatBirr(res.payoutBirr)}!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const finishMatch = async (
    finalBoard: number[],
    matchWinner: 'p1' | 'p2' | 'draw'
  ) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setWinner(matchWinner);
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);

    if (matchWinner === 'p1') {
      soundFx.win();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'win',
          score: finalBoard[6],
          multiplier: 1.95,
          challengeUpdates: { winIncrement: 1, playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setStatusMessage(
          `Victory! ${finalBoard[6]} to ${finalBoard[13]} · Won ${formatBirr(res.payoutBirr)}`
        );
      }
    } else if (matchWinner === 'draw') {
      soundFx.match();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'draw',
          score: finalBoard[6],
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setStatusMessage(`Draw! 24 to 24 · Refunded ${formatBirr(res.payoutBirr)}`);
      }
    } else {
      soundFx.error();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          score: finalBoard[6],
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setStatusMessage(
          `Axum AI won ${finalBoard[13]} to ${finalBoard[6]} · Stake settled (0 Birr)`
        );
      }
    }
  };

  const applyPitSelection = (pitIndex: number, actor: PlayerTurn) => {
    const result = executeMove(boardRef.current, pitIndex, actor);
    setBoard(result.nextBoard);
    boardRef.current = result.nextBoard;
    setLastPit(pitIndex);

    if (result.captured > 0) {
      soundFx.eat();
    } else {
      soundFx.move();
    }

    if (result.finished && result.winner) {
      void finishMatch(result.nextBoard, result.winner);
      return;
    }

    setTurn(result.nextTurn);
    if (result.extraTurn) {
      const label = actor === 'p1' ? 'You' : 'Axum AI';
      setStatusMessage(`${label} landed in the Store — extra turn!`);
    } else if (result.captured > 0) {
      const label = actor === 'p1' ? 'You' : 'Axum AI';
      setStatusMessage(`${label} captured ${result.captured} golden seeds!`);
    } else {
      setStatusMessage(
        result.nextTurn === 'p1'
          ? 'Your turn — choose a bottom pit.'
          : 'Axum AI is planning a move...'
      );
    }
  };

  useEffect(() => {
    if (!activeWager || turn !== 'p2' || winner || settledRef.current) return;
    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const aiPit = chooseAiPit(
        boardRef.current,
        game.playerWinPercent ?? 30,
        activeWager.aiFavored
      );
      setAiThinking(false);
      if (aiPit !== -1) {
        applyPitSelection(aiPit, 'p2');
      }
    }, 620);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, activeWager, winner, board]);

  const handlePitClick = (pitIndex: number) => {
    if (!isPlaying || winner || aiThinking) return;
    if (board[pitIndex] === 0) return;
    if (turn !== 'p1' || pitIndex < 0 || pitIndex > 5) return;
    applyPitSelection(pitIndex, 'p1');
  };

  const topRowPits = [12, 11, 10, 9, 8, 7];
  const bottomRowPits = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={isPlaying}
        isBusy={busy}
        currentMultiplier={liveCashoutMult}
        canCashout={canCashout}
        cashoutDisabledReason="Lead AI by 2+ seeds in Store to unlock Cash Out"
        onStartRound={() => void startMatch()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Match"
        error={error}
      />

      {/* Turn / Outcome Banner */}
      <div className="w-full rounded-xl bg-[#0F1324] border border-white/10 px-4 py-3 flex items-center justify-center gap-2 text-center">
        {winner ? (
          <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
        ) : (
          <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-medium text-slate-200">
          {statusMessage}
        </span>
      </div>

      {/* Gebeta Carved Board */}
      <div className="w-full rounded-3xl bg-gradient-to-b from-[#131830] to-[#0B0E1D] border border-amber-400/25 p-2.5 sm:p-5 shadow-2xl overflow-hidden">
        <div className="grid grid-cols-8 gap-1 sm:gap-3 items-stretch">
          {/* AI Store (Left - Index 13) */}
          <div
            className={`min-w-0 rounded-xl sm:rounded-2xl border p-1.5 sm:p-3 flex flex-col items-center justify-between min-h-[168px] sm:min-h-[210px] ${
              isPlaying && turn === 'p2'
                ? 'bg-violet-500/12 border-violet-400/50'
                : 'bg-[#080B17] border-white/10'
            }`}
          >
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 text-center leading-tight">
              AI
            </span>
            <SeedDots count={board[13]} />
            <span className="text-lg sm:text-2xl font-mono font-bold text-violet-300 tabular-nums">
              {board[13]}
            </span>
          </div>

          {/* Center 2x6 Pits */}
          <div className="col-span-6 min-w-0 flex flex-col justify-between gap-2 sm:gap-4">
            <div className="grid grid-cols-6 gap-1 sm:gap-2.5">
              {topRowPits.map((pitIdx) => {
                const count = board[pitIdx];
                const isLast = lastPit === pitIdx;
                return (
                  <div
                    key={pitIdx}
                    className={`min-w-0 rounded-xl sm:rounded-2xl border p-1 sm:p-2.5 min-h-[78px] sm:min-h-[96px] flex flex-col items-center justify-between ${
                      isLast
                        ? 'bg-violet-500/20 border-violet-400'
                        : 'bg-[#080B17] border-white/10'
                    }`}
                  >
                    <span className="text-[11px] font-mono font-bold text-slate-300 tabular-nums">
                      {count}
                    </span>
                    <SeedDots count={count} />
                    <span className="text-[9px] text-slate-500">AI</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-6 gap-1 sm:gap-2.5">
              {bottomRowPits.map((pitIdx) => {
                const count = board[pitIdx];
                const canPlay =
                  isPlaying && turn === 'p1' && !winner && !aiThinking && count > 0;
                const isLast = lastPit === pitIdx;
                return (
                  <button
                    key={pitIdx}
                    type="button"
                    disabled={!canPlay}
                    onClick={() => handlePitClick(pitIdx)}
                    aria-label={`Your pit ${pitIdx + 1} with ${count} seeds`}
                    className={`min-w-0 rounded-xl sm:rounded-2xl border p-1 sm:p-2.5 min-h-[78px] sm:min-h-[96px] flex flex-col items-center justify-between transition-all ${
                      isLast
                        ? 'bg-amber-500/15 border-amber-400'
                        : canPlay
                          ? 'bg-[#171D38] border-blue-400/40 hover:border-amber-400 hover:bg-[#1E2648] cursor-pointer active:scale-95'
                          : 'bg-[#080B17] border-white/10 opacity-75'
                    }`}
                  >
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      P{pitIdx + 1}
                    </span>
                    <SeedDots count={count} />
                    <span className="text-xs sm:text-sm font-mono font-bold text-amber-300 tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Store (Right - Index 6) */}
          <div
            className={`min-w-0 rounded-xl sm:rounded-2xl border p-1.5 sm:p-3 flex flex-col items-center justify-between min-h-[168px] sm:min-h-[210px] ${
              isPlaying && turn === 'p1'
                ? 'bg-blue-500/12 border-blue-400/50'
                : 'bg-[#080B17] border-white/10'
            }`}
          >
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 text-center leading-tight">
              You
            </span>
            <SeedDots count={board[6]} />
            <span className="text-lg sm:text-2xl font-mono font-bold text-blue-300 tabular-nums">
              {board[6]}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Sow counter-clockwise. Land in your Store for an extra turn; capture opposite seeds on an empty pit. Lead by 2+ seeds to Cash Out early, or win 1.95x!
      </p>
    </div>
  );
}
