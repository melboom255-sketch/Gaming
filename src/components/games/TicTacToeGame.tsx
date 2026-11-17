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
import { Cpu, Trophy } from 'lucide-react';

type Cell = 'X' | 'O' | null;

interface TicTacToeGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function evaluateWinner(board: Cell[]): { winner: 'X' | 'O' | 'draw' | null; line: number[] | null } {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

function minimax(board: Cell[], depth: number, isMax: boolean): number {
  const { winner } = evaluateWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (winner === 'draw') return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, depth + 1, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, depth + 1, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function pickAiMove(board: Cell[], playerWinPercent: number, aiFavored: boolean): number {
  const empty = board
    .map((val, idx) => (val === null ? idx : -1))
    .filter((idx) => idx !== -1);
  if (empty.length === 0) return -1;

  // When server flagged aiFavored (~70% default), AI plays sharply; when !aiFavored (~30%), AI leaves tactical openings
  const optimalChance = aiFavored
    ? Math.max(0.84, Math.min(0.98, (100 - playerWinPercent) / 72))
    : Math.max(0.08, Math.min(0.35, (100 - playerWinPercent) / 260));

  if (Math.random() > optimalChance) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'O';
    const score = minimax(copy, 0, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }
  return bestMove;
}

export function TicTacToeGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: TicTacToeGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [aiThinking, setAiThinking] = useState(false);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState({ x: 0, draws: 0, o: 0 });
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const { winner, line } = evaluateWinner(board);
  const playerMovesCount = board.filter((c) => c === 'X').length;
  const isPlaying = Boolean(activeWager && !winner && !settledRef.current);

  // Live Cashout multiplier increases slightly if player has good board count without losing
  const liveCashoutMult = playerMovesCount >= 2 ? 0.85 : 0.7;

  const startRound = async () => {
    setError(null);
    setBanner(null);
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
      setBoard(Array(9).fill(null));
      // When AI is favored under 70/30 odds, AI opens on center/corner ~55% of rounds
      const aiOpens = res.wager.aiFavored && Math.random() < 0.55;
      setTurn(aiOpens ? 'O' : 'X');
      setAiThinking(false);
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start duel.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || playerMovesCount < 1) return;
    settledRef.current = true;
    setBusy(true);
    wagerRef.current = null;
    setActiveWager(null);
    soundFx.match();
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: liveCashoutMult,
        score: playerMovesCount,
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        `Early Cash Out at ${res.multiplier.toFixed(2)}x · Returned ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const finalizeOutcome = async (result: 'X' | 'O' | 'draw') => {
    if (settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);

    if (result === 'X') {
      setScoreboard((prev) => ({ ...prev, x: prev.x + 1 }));
      soundFx.win();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'win',
          score: 1,
          multiplier: 1.95,
          challengeUpdates: { winIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setBanner(`Victory! Won ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`);
      }
    } else if (result === 'draw') {
      setScoreboard((prev) => ({ ...prev, draws: prev.draws + 1 }));
      soundFx.match();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'draw',
          score: 0,
        });
        onSnapshotSync(res.snapshot);
        setBanner(`Draw match · Stake refunded (${formatBirr(res.payoutBirr)})`);
      }
    } else {
      setScoreboard((prev) => ({ ...prev, o: prev.o + 1 }));
      soundFx.error();
      if (wager) {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          score: 0,
        });
        onSnapshotSync(res.snapshot);
        setBanner(`Axum AI won this duel · Stake settled (0 Birr)`);
      }
    }
  };

  useEffect(() => {
    if (!activeWager || turn !== 'O' || winner || settledRef.current) return;
    setAiThinking(true);
    const timer = window.setTimeout(() => {
      const aiIndex = pickAiMove(
        board,
        game.playerWinPercent ?? 30,
        activeWager.aiFavored
      );
      if (aiIndex !== -1) {
        const nextBoard = [...board];
        nextBoard[aiIndex] = 'O';
        setBoard(nextBoard);
        soundFx.move();
        const check = evaluateWinner(nextBoard);
        if (check.winner) {
          void finalizeOutcome(check.winner);
        } else {
          setTurn('X');
        }
      }
      setAiThinking(false);
    }, 450);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, activeWager, winner]);

  const handleCellClick = (index: number) => {
    if (!isPlaying || board[index] || winner || aiThinking || turn === 'O') return;

    const nextBoard = [...board];
    nextBoard[index] = 'X';
    setBoard(nextBoard);
    soundFx.move();

    const check = evaluateWinner(nextBoard);
    if (check.winner) {
      void finalizeOutcome(check.winner);
    } else {
      setTurn('O');
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={isPlaying}
        isBusy={busy}
        currentMultiplier={liveCashoutMult}
        canCashout={isPlaying && playerMovesCount >= 1}
        cashoutDisabledReason="Make 1+ move to unlock early Cash Out"
        onStartRound={() => void startRound()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Duel"
        error={error}
      />

      {/* Round Scoreboard */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div
          className={`rounded-xl border px-4 py-3 text-center transition-colors ${
            isPlaying && turn === 'X'
              ? 'bg-blue-500/10 border-blue-500/40'
              : 'bg-[#101426] border-white/10'
          }`}
        >
          <div className="text-xs text-slate-400">You (X)</div>
          <div className="text-2xl font-display font-bold text-blue-300 tabular-nums">
            {scoreboard.x}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#101426] px-4 py-3 text-center">
          <div className="text-xs text-slate-400">Draws (1.0x)</div>
          <div className="text-2xl font-display font-bold text-slate-200 tabular-nums">
            {scoreboard.draws}
          </div>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 text-center transition-colors ${
            isPlaying && turn === 'O'
              ? 'bg-violet-500/10 border-violet-500/40'
              : 'bg-[#101426] border-white/10'
          }`}
        >
          <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> Axum AI (O)
          </div>
          <div className="text-2xl font-display font-bold text-violet-300 tabular-nums">
            {scoreboard.o}
          </div>
        </div>
      </div>

      {/* Turn / Outcome Status Line */}
      <div className="min-h-[28px] flex items-center justify-center text-center">
        {banner ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Trophy className="w-4 h-4 shrink-0" />
            <span>{banner}</span>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-slate-300">
            {!isPlaying
              ? 'Choose your Birr stake above and click Start Duel (Win pays 1.95x + bonus)'
              : aiThinking
                ? 'Axum AI is analyzing the board...'
                : 'Your turn (X) — tap an empty square or Cash Out above'}
          </p>
        )}
      </div>

      {/* 3x3 Board */}
      <div
        className="grid grid-cols-3 gap-3 w-full max-w-[340px] sm:max-w-[380px] aspect-square bg-[#0D1020] p-3.5 rounded-2xl border border-amber-400/20"
        role="grid"
        aria-label="Tic-Tac-Toe Board"
      >
        {board.map((cell, idx) => {
          const isWinCell = line?.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCellClick(idx)}
              disabled={!isPlaying || Boolean(cell || winner || aiThinking || turn === 'O')}
              aria-label={`Square ${idx + 1}${cell ? `: ${cell}` : ''}`}
              className={`rounded-xl border text-4xl sm:text-5xl font-display font-bold flex items-center justify-center transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isWinCell
                  ? 'bg-amber-500/15 border-amber-400/60 scale-[1.02]'
                  : cell
                    ? 'bg-[#151A31] border-white/10'
                    : isPlaying
                      ? 'bg-[#12162A] border-white/10 hover:border-violet-400/40 hover:bg-[#191F3A] cursor-pointer'
                      : 'bg-[#0F1324] border-white/5 opacity-60'
              }`}
            >
              {cell === 'X' && <span className="text-blue-400">X</span>}
              {cell === 'O' && <span className="text-violet-400">O</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
