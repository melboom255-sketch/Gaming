import { useEffect, useRef, useState, type MouseEvent } from 'react';
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
import { Bomb, Flag, Pickaxe, Sparkles, Trophy } from 'lucide-react';

type Difficulty = 'scout' | 'explorer' | 'master';
type ToolMode = 'dig' | 'flag';
type GameStatus = 'idle' | 'playing' | 'won' | 'cashed_out' | 'lost';

interface CellState {
  isTrap: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentTraps: number;
}

interface MinesGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const DIFFICULTIES: Record<
  Difficulty,
  { label: string; size: number; baseTraps: number; stepMult: number }
> = {
  scout: { label: '6×6 Scout', size: 6, baseTraps: 6, stepMult: 0.14 },
  explorer: { label: '8×8 Explorer', size: 8, baseTraps: 12, stepMult: 0.18 },
  master: { label: '9×9 Master', size: 9, baseTraps: 17, stepMult: 0.24 },
};

function createBlankBoard(size: number): CellState[] {
  return Array.from({ length: size * size }, () => ({
    isTrap: false,
    isRevealed: false,
    isFlagged: false,
    adjacentTraps: 0,
  }));
}

function getNeighborIndices(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const neighbors: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        neighbors.push(nr * size + nc);
      }
    }
  }
  return neighbors;
}

function populateFullBoardTraps(
  size: number,
  trapCount: number
): CellState[] {
  const total = size * size;
  const board = createBlankBoard(size);

  const candidates = Array.from({ length: total }, (_, i) => i);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let t = 0; t < Math.min(trapCount, candidates.length); t++) {
    board[candidates[t]].isTrap = true;
  }

  for (let i = 0; i < total; i++) {
    if (board[i].isTrap) continue;
    board[i].adjacentTraps = getNeighborIndices(i, size).filter(
      (n) => board[n].isTrap
    ).length;
  }

  return board;
}

function getNumberColor(count: number): string {
  if (count === 1) return 'text-blue-300';
  if (count === 2) return 'text-emerald-300';
  if (count === 3) return 'text-amber-300';
  if (count === 4) return 'text-violet-300';
  return 'text-rose-300';
}

export function MinesGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: MinesGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [difficulty, setDifficulty] = useState<Difficulty>('explorer');
  const [tool, setTool] = useState<ToolMode>('dig');
  const [board, setBoard] = useState<CellState[]>(() =>
    createBlankBoard(DIFFICULTIES.explorer.size)
  );
  const [status, setStatus] = useState<GameStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [activeTrapCount, setActiveTrapCount] = useState(DIFFICULTIES.explorer.baseTraps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const cfg = DIFFICULTIES[difficulty];
  const flaggedCount = board.filter((c) => c.isFlagged).length;
  const revealedSafeCount = board.filter((c) => c.isRevealed && !c.isTrap).length;
  const totalSafeCells = cfg.size * cfg.size - activeTrapCount;
  const trapsRemaining = activeTrapCount - flaggedCount;

  const currentMultiplier =
    revealedSafeCount === 0
      ? 1.0
      : Math.min(
          game.maxMultiplier || 8,
          Math.round((1.0 + revealedSafeCount * cfg.stepMult) * 100) / 100
        );

  useEffect(() => {
    if (status !== 'playing') return;
    const interval = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const startBirrRound = async (nextDiff: Difficulty = difficulty) => {
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

      const d = DIFFICULTIES[nextDiff];
      const oddsTrapOffset = res.wager.aiFavored
        ? Math.max(2, Math.round((100 - (game.playerWinPercent ?? 30)) / 18))
        : -1;
      const trapCount = Math.max(4, Math.min(d.size * d.size - 8, d.baseTraps + oddsTrapOffset));
      setDifficulty(nextDiff);
      setActiveTrapCount(trapCount);
      setBoard(populateFullBoardTraps(d.size, trapCount));
      setStatus('playing');
      setElapsedSec(0);
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Mines round.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || revealedSafeCount < 1) return;
    settledRef.current = true;
    setBusy(true);
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: currentMultiplier,
        score: revealedSafeCount * 10,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        `Cashed out at ${res.multiplier.toFixed(2)}x with ${revealedSafeCount} safe relics! Won ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFlag = (idx: number) => {
    if (status !== 'playing') return;
    const next = board.map((c) => ({ ...c }));
    if (next[idx].isRevealed) return;
    next[idx].isFlagged = !next[idx].isFlagged;
    setBoard(next);
    soundFx.move();
  };

  const handleCellClick = async (idx: number) => {
    if (status !== 'playing' || settledRef.current) return;
    if (tool === 'flag') {
      toggleFlag(idx);
      return;
    }

    const currentCell = board[idx];
    if (currentCell.isRevealed || currentCell.isFlagged) return;

    const nextBoard = board.map((c) => ({ ...c }));
    const wager = wagerRef.current;

    // House odds guard: when AI is favored and player pushes past initial tiles, calibrate deep trap hit probability
    if (
      wager?.aiFavored &&
      !nextBoard[idx].isTrap &&
      revealedSafeCount >= 2 &&
      Math.random() < Math.max(0.15, Math.min(0.45, (100 - (game.playerWinPercent ?? 30)) / 210))
    ) {
      const hiddenTrapIdx = nextBoard.findIndex((c, i) => i !== idx && c.isTrap && !c.isRevealed);
      if (hiddenTrapIdx >= 0) {
        nextBoard[hiddenTrapIdx].isTrap = false;
        nextBoard[idx].isTrap = true;
      }
    }

    if (nextBoard[idx].isTrap) {
      for (const cell of nextBoard) {
        if (cell.isTrap) cell.isRevealed = true;
      }
      setBoard(nextBoard);
      setStatus('lost');
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      soundFx.error();
      setBanner(`Detonated hidden trap! Stake lost (0 Birr)`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: revealedSafeCount * 10,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore secondary error
        }
      }
      return;
    }

    nextBoard[idx].isRevealed = true;
    const nextRevealedSafe = nextBoard.filter((c) => c.isRevealed && !c.isTrap).length;

    if (nextRevealedSafe >= totalSafeCells) {
      for (const cell of nextBoard) {
        if (cell.isTrap) cell.isFlagged = true;
      }
      setBoard(nextBoard);
      setStatus('won');
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      soundFx.win();

      const fullMult = Math.min(
        game.maxMultiplier || 8,
        Math.round((1.0 + nextRevealedSafe * cfg.stepMult) * 100) / 100
      );
      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'win',
            score: Math.max(50, 300 - elapsedSec),
            multiplier: fullMult,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(
            `Sector cleared at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement failed.');
        }
      }
      return;
    }

    setBoard(nextBoard);
    soundFx.match();
  };

  const handleContextMenu = (e: MouseEvent, idx: number) => {
    e.preventDefault();
    toggleFlag(idx);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'playing'}
        isBusy={busy}
        currentMultiplier={currentMultiplier}
        canCashout={status === 'playing' && revealedSafeCount >= 1}
        cashoutDisabledReason="Reveal 1+ safe tile to unlock Cash Out"
        onStartRound={() => void startBirrRound(difficulty)}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Sweep"
        error={error}
      />

      {/* Difficulty & Mode Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-[#101426] border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-1 bg-[#080A14] p-1 rounded-lg overflow-x-auto">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
            <button
              key={key}
              type="button"
              disabled={status === 'playing'}
              onClick={() => {
                setDifficulty(key);
                setActiveTrapCount(DIFFICULTIES[key].baseTraps);
                setBoard(createBlankBoard(DIFFICULTIES[key].size));
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                difficulty === key
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {DIFFICULTIES[key].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-[#080A14] p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTool('dig')}
            className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              tool === 'dig'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pickaxe className="w-3.5 h-3.5" />
            <span>Dig</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('flag')}
            className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              tool === 'flag'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Flag</span>
          </button>
        </div>
      </div>

      {/* Live Metrics Strip */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="rounded-xl bg-[#101426] border border-white/10 px-4 py-3 text-center">
          <div className="text-xs text-slate-400">Traps Unflagged</div>
          <div className="text-xl font-mono font-bold text-amber-300 tabular-nums mt-0.5">
            {trapsRemaining}
          </div>
        </div>
        <div className="rounded-xl bg-[#101426] border border-white/10 px-4 py-3 text-center">
          <div className="text-xs text-slate-400">Safe Relics</div>
          <div className="text-xl font-mono font-bold text-blue-300 tabular-nums mt-0.5">
            {revealedSafeCount}/{totalSafeCells}
          </div>
        </div>
        <div className="rounded-xl bg-[#101426] border border-white/10 px-4 py-3 text-center">
          <div className="text-xs text-slate-400">Multiplier</div>
          <div className="text-xl font-mono font-bold text-emerald-300 tabular-nums mt-0.5">
            {currentMultiplier.toFixed(2)}x
          </div>
        </div>
      </div>

      {/* Outcome / Tip Line */}
      <div className="min-h-[28px] flex items-center justify-center gap-2 text-center">
        {banner ? (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-300">
            <Trophy className="w-4 h-4 shrink-0" />
            <span>{banner}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-blue-300 shrink-0" />
            <span>
              {status !== 'playing'
                ? 'Select your Birr stake above and click Start Sweep to unlock the relic grid.'
                : `Each safe relic raises your multiplier (+${cfg.stepMult}x). Cash Out anytime before hitting a trap!`}
            </span>
          </div>
        )}
      </div>

      {/* Relic Grid */}
      <div
        className="relative w-full max-w-[440px] aspect-square rounded-2xl bg-[#0B0F1F] border border-white/12 p-2.5 sm:p-3 grid gap-1 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cfg.size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Simien Sweep Relic Grid"
      >
        {board.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            disabled={status !== 'playing'}
            onClick={() => void handleCellClick(idx)}
            onContextMenu={(e) => handleContextMenu(e, idx)}
            aria-label={`Tile ${idx + 1}`}
            className={`rounded-lg border flex items-center justify-center font-mono font-bold text-sm sm:text-base tabular-nums transition-colors select-none ${
              cell.isRevealed
                ? cell.isTrap
                  ? 'bg-rose-500/25 border-rose-400/60 text-rose-200'
                  : 'bg-[#090C18] border-white/8'
                : cell.isFlagged
                  ? 'bg-amber-500/18 border-amber-400/50 text-amber-300 cursor-pointer'
                  : 'bg-[#171E3A] hover:bg-[#202A50] border-white/12 cursor-pointer active:scale-95 disabled:opacity-60'
            }`}
          >
            {cell.isRevealed ? (
              cell.isTrap ? (
                <Bomb className="w-4 h-4 sm:w-5 sm:h-5 text-rose-300" />
              ) : cell.adjacentTraps > 0 ? (
                <span className={getNumberColor(cell.adjacentTraps)}>
                  {cell.adjacentTraps}
                </span>
              ) : null
            ) : cell.isFlagged ? (
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
