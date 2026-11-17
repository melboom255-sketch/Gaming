import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from 'lucide-react';

interface SnakeGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type SpeedMode = 'relaxed' | 'standard' | 'swift';
type GameState = 'READY' | 'PLAYING' | 'PAUSED' | 'CASHOUT' | 'LOST';
type OrbKind = 'plus_half' | 'plus_two' | 'minus_one';

interface MultiplierOrb {
  id: string;
  x: number;
  y: number;
  kind: OrbKind;
  delta: number;
  label: string;
}

const GRID_SIZE = 15;
const INITIAL_SNAKE: Point[] = [
  { x: 7, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 7 },
];

const SPEED_MS: Record<SpeedMode, number> = {
  relaxed: 155,
  standard: 118,
  swift: 86,
};

function spawnPointAvoiding(occupied: Point[], minHeadDistFrom?: Point): Point {
  const occupiedSet = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const candidates: Point[] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (occupiedSet.has(`${x},${y}`)) continue;
      if (
        minHeadDistFrom &&
        Math.abs(x - minHeadDistFrom.x) + Math.abs(y - minHeadDistFrom.y) < 3
      ) {
        continue;
      }
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return spawnPointAvoiding(occupied);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function rollOrbKind(playerWinPercent: number, aiFavored: boolean, forcePositive: boolean): OrbKind {
  if (forcePositive) {
    const baseTwoX = aiFavored ? 0.14 : 0.36;
    const twoXChance = Math.max(
      0.1,
      Math.min(0.55, baseTwoX + ((playerWinPercent - 30) / 100) * 0.25)
    );
    return Math.random() < twoXChance ? 'plus_two' : 'plus_half';
  }
  const hazardRate = aiFavored
    ? Math.max(0.45, Math.min(0.82, (100 - playerWinPercent) / 105))
    : Math.max(0.18, Math.min(0.45, (100 - playerWinPercent) / 180));
  if (Math.random() < hazardRate) return 'minus_one';
  return Math.random() < (aiFavored ? 0.18 : 0.35) ? 'plus_two' : 'plus_half';
}

function makeOrb(
  occupied: Point[],
  playerWinPercent: number,
  aiFavored: boolean,
  forcePositive: boolean,
  headPos?: Point
): MultiplierOrb {
  const pos = spawnPointAvoiding(occupied, forcePositive ? undefined : headPos);
  const kind = rollOrbKind(playerWinPercent, aiFavored, forcePositive);
  if (kind === 'plus_two') {
    return {
      id: `${Date.now()}_${Math.random()}`,
      x: pos.x,
      y: pos.y,
      kind,
      delta: 2,
      label: '+2x',
    };
  }
  if (kind === 'minus_one') {
    return {
      id: `${Date.now()}_${Math.random()}`,
      x: pos.x,
      y: pos.y,
      kind,
      delta: -1,
      label: '-1x',
    };
  }
  return {
    id: `${Date.now()}_${Math.random()}`,
    x: pos.x,
    y: pos.y,
    kind: 'plus_half',
    delta: 0.5,
    label: '+0.5x',
  };
}

export function SnakeGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: SnakeGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [speedMode, setSpeedMode] = useState<SpeedMode>('standard');
  const [gameState, setGameState] = useState<GameState>('READY');
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [orbs, setOrbs] = useState<MultiplierOrb[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [orbsEaten, setOrbsEaten] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);
  const [sideTouchEnabled, setSideTouchEnabled] = useState(true);
  const [activeEdge, setActiveEdge] = useState<Direction | null>(null);
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);

  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);
  const dirRef = useRef<Direction>('RIGHT');
  const nextDirRef = useRef<Direction>('RIGHT');
  const orbsRef = useRef<MultiplierOrb[]>([]);
  const scoreRef = useRef(0);
  const orbsEatenRef = useRef(0);
  const tickCountRef = useRef(0);
  const multRef = useRef(1.0);
  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const screenSwipeRef = useRef<{ x: number; y: number } | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const edgeTimeoutRef = useRef<number | null>(null);

  const buildInitialOrbs = useCallback(
    (aiFavored: boolean) => {
      const winPct = game.playerWinPercent ?? 30;
      const list: MultiplierOrb[] = [];
      const first = makeOrb(INITIAL_SNAKE, winPct, aiFavored, true);
      list.push(first);
      const totalOrbs = aiFavored ? 4 : 3;
      for (let i = 1; i < totalOrbs; i++) {
        const added = makeOrb(
          [...INITIAL_SNAKE, ...list],
          winPct,
          aiFavored,
          false,
          INITIAL_SNAKE[0]
        );
        list.push(added);
      }
      return list;
    },
    [game.playerWinPercent]
  );

  const changeDirection = useCallback((next: Direction) => {
    const current = dirRef.current;
    if (
      (current === 'UP' && next === 'DOWN') ||
      (current === 'DOWN' && next === 'UP') ||
      (current === 'LEFT' && next === 'RIGHT') ||
      (current === 'RIGHT' && next === 'LEFT')
    ) {
      return;
    }
    nextDirRef.current = next;
  }, []);

  const flashEdge = useCallback((dir: Direction) => {
    setActiveEdge(dir);
    if (edgeTimeoutRef.current !== null) {
      window.clearTimeout(edgeTimeoutRef.current);
    }
    edgeTimeoutRef.current = window.setTimeout(() => {
      setActiveEdge(null);
    }, 180);
  }, []);

  const steerFromScreenPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = boardRef.current?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      const dir: Direction =
        Math.abs(dx) >= Math.abs(dy)
          ? dx > 0
            ? 'RIGHT'
            : 'LEFT'
          : dy > 0
            ? 'DOWN'
            : 'UP';
      changeDirection(dir);
      flashEdge(dir);
    },
    [changeDirection, flashEdge]
  );

  const updateJoystickFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = joystickRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rawDx = clientX - cx;
      const rawDy = clientY - cy;
      const maxRadius = Math.max(28, rect.width * 0.28);
      const dist = Math.hypot(rawDx, rawDy);
      const scale = dist > maxRadius ? maxRadius / dist : 1;
      setStickOffset({ x: rawDx * scale, y: rawDy * scale });

      if (dist >= 12) {
        const dir: Direction =
          Math.abs(rawDx) >= Math.abs(rawDy)
            ? rawDx > 0
              ? 'RIGHT'
              : 'LEFT'
            : rawDy > 0
              ? 'DOWN'
              : 'UP';
        changeDirection(dir);
        flashEdge(dir);
      }
    },
    [changeDirection, flashEdge]
  );

  const startBirrRun = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
        const fsPromise = document.documentElement.requestFullscreen();
        if (fsPromise && typeof fsPromise.catch === 'function') {
          fsPromise.catch(() => {});
        }
      }
    } catch {
      // Safe fallback in restricted iframes
    }

    setError(null);
    setResultBanner(null);
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

      const freshOrbs = buildInitialOrbs(res.wager.aiFavored);
      snakeRef.current = INITIAL_SNAKE;
      setSnake(INITIAL_SNAKE);
      orbsRef.current = freshOrbs;
      setOrbs(freshOrbs);
      scoreRef.current = 0;
      setScore(0);
      orbsEatenRef.current = 0;
      setOrbsEaten(0);
      tickCountRef.current = 0;
      multRef.current = 1.0;
      setMultiplier(1.0);
      dirRef.current = 'RIGHT';
      nextDirRef.current = 'RIGHT';
      setGameState('PLAYING');
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Birr round.');
    } finally {
      setBusy(false);
    }
  }, [buildInitialOrbs, game.slug, onSnapshotSync, stakeBirr]);

  const handleFailure = useCallback(
    async (reason: string) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setGameState('LOST');
      soundFx.error();
      const wager = wagerRef.current;
      wagerRef.current = null;
      setActiveWager(null);
      setResultBanner(`${reason} · Stake lost (0 Birr)`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: scoreRef.current,
            challengeUpdates: { snakeScore: scoreRef.current },
          });
          onSnapshotSync(res.snapshot);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement sync warning.');
        }
      }
    },
    [onSnapshotSync]
  );

  const handleCashout = useCallback(async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || multRef.current <= 0 || orbsEatenRef.current < 1) return;
    settledRef.current = true;
    setBusy(true);
    setGameState('CASHOUT');
    wagerRef.current = null;
    setActiveWager(null);
    soundFx.win();

    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: multRef.current,
        score: scoreRef.current,
        challengeUpdates: { snakeScore: scoreRef.current },
      });
      onSnapshotSync(res.snapshot);
      setResultBanner(
        `Cashed out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}${
          res.bonusBirrApplied > 0 ? ` (includes +${formatBirr(res.bonusBirrApplied)} bonus)` : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  }, [onSnapshotSync]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
        }
      }
      if (key === 'arrowup' || key === 'w') changeDirection('UP');
      else if (key === 'arrowdown' || key === 's') changeDirection('DOWN');
      else if (key === 'arrowleft' || key === 'a') changeDirection('LEFT');
      else if (key === 'arrowright' || key === 'd') changeDirection('RIGHT');
      else if (key === ' ') {
        if (gameState === 'PLAYING') setGameState('PAUSED');
        else if (gameState === 'PAUSED') setGameState('PLAYING');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeDirection, gameState]);

  // Game loop tick
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const aiFavored = wagerRef.current?.aiFavored ?? true;
    const tickIntervalMs = aiFavored
      ? Math.round(SPEED_MS[speedMode] * 0.9)
      : SPEED_MS[speedMode];

    const interval = window.setInterval(() => {
      tickCountRef.current += 1;
      const prevSnake = snakeRef.current;
      const moveDir = nextDirRef.current;
      dirRef.current = moveDir;
      const head = prevSnake[0];
      const nextHead: Point = {
        x: head.x + (moveDir === 'RIGHT' ? 1 : moveDir === 'LEFT' ? -1 : 0),
        y: head.y + (moveDir === 'DOWN' ? 1 : moveDir === 'UP' ? -1 : 0),
      };

      if (
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE
      ) {
        void handleFailure('Hit arena wall');
        return;
      }

      const hitsBody = prevSnake.some(
        (seg, idx) => idx < prevSnake.length - 1 && seg.x === nextHead.x && seg.y === nextHead.y
      );
      if (hitsBody) {
        void handleFailure('Self-collision');
        return;
      }

      const currentOrbs = orbsRef.current;
      const hitIdx = currentOrbs.findIndex((o) => o.x === nextHead.x && o.y === nextHead.y);
      const eatenOrb = hitIdx >= 0 ? currentOrbs[hitIdx] : null;

      const nextSnake = [nextHead, ...prevSnake];
      if (!eatenOrb) {
        nextSnake.pop();
      }
      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (eatenOrb) {
        orbsEatenRef.current += 1;
        setOrbsEaten(orbsEatenRef.current);

        const maxMult = wagerRef.current?.maxAllowedMultiplier ?? game.maxMultiplier ?? 10;
        const nextMult = Math.min(maxMult, Math.round((multRef.current + eatenOrb.delta) * 100) / 100);
        multRef.current = nextMult;
        setMultiplier(nextMult);

        if (eatenOrb.delta < 0) {
          soundFx.error();
        } else if (eatenOrb.delta >= 2) {
          soundFx.bonus();
        } else {
          soundFx.eat();
        }

        if (nextMult <= 0) {
          void handleFailure('Multiplier dropped to 0.00x (-1x orb)');
          return;
        }

        const gainedScore = eatenOrb.delta > 0 ? Math.round(eatenOrb.delta * 20) : 0;
        scoreRef.current += gainedScore;
        setScore(scoreRef.current);
        setBestScore((prev) => Math.max(prev, scoreRef.current));

        const remaining = currentOrbs.filter((_, i) => i !== hitIdx);
        const hasPositive = remaining.some((o) => o.delta > 0);
        const occupied = [...nextSnake, ...remaining];
        const targetCount = aiFavored ? 4 : 3;

        while (remaining.length < targetCount) {
          const forcePos = !hasPositive && remaining.length === currentOrbs.length - 1;
          const added = makeOrb(occupied, game.playerWinPercent ?? 30, aiFavored, forcePos, nextHead);
          remaining.push(added);
          occupied.push(added);
        }
        orbsRef.current = remaining;
        setOrbs([...remaining]);
      } else if (tickCountRef.current % (aiFavored ? 14 : 26) === 0) {
        // Relocate -1x hazard orbs periodically away from the snake head to keep arena dynamic
        const occupied: Point[] = [...nextSnake];
        const shifted = currentOrbs.map((orb) => {
          if (orb.kind !== 'minus_one') {
            occupied.push(orb);
            return orb;
          }
          const pos = spawnPointAvoiding(occupied, nextHead);
          const nextOrb = { ...orb, x: pos.x, y: pos.y };
          occupied.push(nextOrb);
          return nextOrb;
        });
        orbsRef.current = shifted;
        setOrbs(shifted);
      }
    }, tickIntervalMs);

    return () => window.clearInterval(interval);
  }, [game.maxMultiplier, game.playerWinPercent, gameState, handleFailure, speedMode]);

  const snakeMap = new Map<string, number>();
  snake.forEach((seg, index) => snakeMap.set(`${seg.x},${seg.y}`, index));

  const orbMap = new Map<string, MultiplierOrb>();
  orbs.forEach((o) => orbMap.set(`${o.x},${o.y}`, o));

  const isRunning = gameState === 'PLAYING' || gameState === 'PAUSED';
  const canCashout = isRunning && multiplier > 0 && orbsEaten >= 1;

  return (
    <div className="relative flex flex-col items-center gap-3.5 w-full max-w-6xl mx-auto flex-1 justify-between">
      {/* All-Screen 4-Side Touch Layer (active while slithering; buttons & joystick stay above at z-20/z-30) */}
      {sideTouchEnabled && gameState === 'PLAYING' && (
        <div
          aria-label="Full-Screen Side Touch Controls"
          onPointerDown={(e) => {
            screenSwipeRef.current = { x: e.clientX, y: e.clientY };
            steerFromScreenPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!screenSwipeRef.current || e.buttons === 0) return;
            const dx = e.clientX - screenSwipeRef.current.x;
            const dy = e.clientY - screenSwipeRef.current.y;
            if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
            const dir: Direction =
              Math.abs(dx) >= Math.abs(dy)
                ? dx > 0
                  ? 'RIGHT'
                  : 'LEFT'
                : dy > 0
                  ? 'DOWN'
                  : 'UP';
            changeDirection(dir);
            flashEdge(dir);
            screenSwipeRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => {
            screenSwipeRef.current = null;
          }}
          className="fixed inset-0 z-10 touch-none select-none"
        >
          {/* Edge Touch Visual Feedback */}
          {activeEdge === 'UP' && (
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-violet-500/35 to-transparent pointer-events-none" />
          )}
          {activeEdge === 'DOWN' && (
            <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-violet-500/35 to-transparent pointer-events-none" />
          )}
          {activeEdge === 'LEFT' && (
            <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-violet-500/35 to-transparent pointer-events-none" />
          )}
          {activeEdge === 'RIGHT' && (
            <div className="absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-violet-500/35 to-transparent pointer-events-none" />
          )}
        </div>
      )}

      <div className="relative z-20 w-full space-y-3" data-no-side-touch="true">
        <GameStakeBar
          game={game}
          currentUser={currentUser}
          stakeBirr={stakeBirr}
          onChangeStake={setStakeBirr}
          activeWager={activeWager}
          isRoundRunning={isRunning}
          isBusy={busy}
          currentMultiplier={multiplier}
          canCashout={canCashout}
          cashoutDisabledReason="Eat 1+ orb to unlock Cash Out"
          onStartRound={startBirrRun}
          onCashout={handleCashout}
          onPromptSignIn={onPromptSignIn}
          onPromptDeposit={onPromptDeposit}
          startLabel="Start Serpent Run"
          error={error}
        />

        {/* Orb Legend + Speed Tier + All-Screen Side Touch Toggle */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5 bg-[#101426] border border-white/10 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center gap-1 bg-[#080A14] p-1 rounded-lg">
            {(['relaxed', 'standard', 'swift'] as SpeedMode[]).map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={isRunning}
                onClick={() => setSpeedMode(tier)}
                className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium capitalize whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                  speedMode === tier
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
              ● +0.5x Orb
            </span>
            <span className="px-2 py-1 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-300">
              ● +2x Gold
            </span>
            <span className="px-2 py-1 rounded-md bg-rose-500/15 border border-rose-400/30 text-rose-300">
              ● -1x Hazard
            </span>
            <button
              type="button"
              onClick={() => setSideTouchEnabled((v) => !v)}
              className={`px-2.5 py-1 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                sideTouchEnabled
                  ? 'bg-violet-600/25 border-violet-400/45 text-violet-200'
                  : 'bg-[#080A14] border-white/10 text-slate-400'
              }`}
            >
              <Hand className="w-3 h-3" />
              <span>Screen Touch: {sideTouchEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {resultBanner && (
          <div
            className={`w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold border ${
              gameState === 'CASHOUT'
                ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-200'
                : 'bg-rose-500/12 border-rose-400/35 text-rose-200'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span>{resultBanner}</span>
          </div>
        )}
      </div>

      {/* Full-Screen Centered Stage: Board + Run Bar + Centered Directional Joystick */}
      <div className="w-full flex-1 flex flex-col items-center justify-center gap-3.5 my-auto">
        {/* Center Arena Board */}
        <div
          ref={boardRef}
          className="relative z-10 w-full max-w-[min(86vw,430px)] sm:max-w-[min(50vh,460px)] aspect-square bg-[#080B16] border border-violet-500/35 rounded-2xl p-2 select-none touch-none overflow-hidden shadow-[0_0_40px_rgba(109,40,217,0.18)]"
          onPointerDown={(e) => {
            if (gameState !== 'PLAYING' || !sideTouchEnabled) return;
            screenSwipeRef.current = { x: e.clientX, y: e.clientY };
            steerFromScreenPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (gameState !== 'PLAYING' || !sideTouchEnabled || !screenSwipeRef.current || e.buttons === 0) {
              return;
            }
            const dx = e.clientX - screenSwipeRef.current.x;
            const dy = e.clientY - screenSwipeRef.current.y;
            if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
            const dir: Direction =
              Math.abs(dx) >= Math.abs(dy)
                ? dx > 0
                  ? 'RIGHT'
                  : 'LEFT'
                : dy > 0
                  ? 'DOWN'
                  : 'UP';
            changeDirection(dir);
            flashEdge(dir);
            screenSwipeRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => {
            screenSwipeRef.current = null;
          }}
        >
          <div
            className="grid w-full h-full gap-[1px]"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
              const x = idx % GRID_SIZE;
              const y = Math.floor(idx / GRID_SIZE);
              const key = `${x},${y}`;
              const segIndex = snakeMap.get(key);
              const orb = orbMap.get(key);

              let cellClass = 'bg-[#0D1122] rounded-[3px] flex items-center justify-center relative';
              if (segIndex === 0) {
                cellClass =
                  'bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500 rounded-[6px] flex items-center justify-center relative shadow-[0_0_8px_rgba(45,212,191,0.55)]';
              } else if (segIndex !== undefined) {
                const isTail = segIndex === snake.length - 1;
                cellClass = isTail
                  ? 'bg-violet-600/80 rounded-full scale-75 flex items-center justify-center'
                  : segIndex % 2 === 0
                    ? 'bg-emerald-500/90 rounded-[4px] flex items-center justify-center'
                    : 'bg-indigo-500/90 rounded-[4px] flex items-center justify-center';
              } else if (orb) {
                if (orb.kind === 'plus_two') {
                  cellClass =
                    'bg-amber-400 text-slate-950 rounded-full flex items-center justify-center text-[9px] font-black leading-none shadow-[0_0_8px_rgba(251,191,36,0.55)]';
                } else if (orb.kind === 'minus_one') {
                  cellClass =
                    'bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] font-black leading-none shadow-[0_0_6px_rgba(244,63,94,0.5)]';
                } else {
                  cellClass =
                    'bg-emerald-400 text-slate-950 rounded-full flex items-center justify-center text-[8px] font-black leading-none shadow-[0_0_6px_rgba(52,211,153,0.45)]';
                }
              }

              const headDir = dirRef.current;
              return (
                <div key={key} className={cellClass}>
                  {segIndex === 0 && (
                    <div
                      className={`w-full h-full flex items-center justify-center gap-[2px] ${
                        headDir === 'UP' || headDir === 'DOWN' ? 'flex-row' : 'flex-col'
                      }`}
                    >
                      <span className="w-[4px] h-[4px] rounded-full bg-slate-950" />
                      <span className="w-[4px] h-[4px] rounded-full bg-slate-950" />
                    </div>
                  )}
                  {segIndex === undefined && orb ? orb.label : null}
                </div>
              );
            })}
          </div>

          {/* Ready / Paused / Finished Overlay */}
          {gameState !== 'PLAYING' && (
            <div
              data-no-side-touch="true"
              className="absolute inset-0 z-20 bg-[#070912]/82 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center gap-3"
            >
              <h4 className="text-xl font-display font-bold text-white">
                {gameState === 'READY'
                  ? 'Stake Birr to Slither'
                  : gameState === 'PAUSED'
                    ? 'Run Paused'
                    : gameState === 'CASHOUT'
                      ? 'Cashed Out Safely!'
                      : 'Run Failed!'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xs">
                {gameState === 'PAUSED'
                  ? `Current multiplier: ${multiplier.toFixed(2)}x. Resume or Cash Out before collision.`
                  : gameState === 'CASHOUT' || gameState === 'LOST'
                    ? `Final score: ${score} · Select your Birr stake above to play another run.`
                    : `Choose ${formatBirr(minStake)}+ stake above, eat +0.5x & +2x orbs, dodge -1x hazards, and Cash Out before failure!`}
              </p>
              {gameState === 'PAUSED' && (
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
              )}
              {(gameState === 'READY' || gameState === 'CASHOUT' || gameState === 'LOST') &&
                currentUser &&
                currentUser.balanceBirr >= stakeBirr && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={startBirrRun}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
                  >
                    {gameState === 'READY' ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <span>
                      {busy ? 'Starting...' : `Start (${formatBirr(stakeBirr)})`}
                    </span>
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Centered Quick Run Bar (Orbs, Score, Pause, Cash Out) */}
        <div
          data-no-side-touch="true"
          className="relative z-20 flex flex-wrap items-center justify-center gap-2.5 w-full max-w-[460px]"
        >
          <div className="rounded-xl bg-[#101426] border border-white/10 px-3.5 py-2 flex items-center gap-2.5 text-xs tabular-nums">
            <span className="text-slate-400">Orbs · Score:</span>
            <span className="font-mono font-bold text-amber-300">
              {orbsEaten} · {score}
            </span>
            {bestScore > 0 && (
              <span className="text-slate-400 font-mono">· Best {bestScore}</span>
            )}
          </div>

          <button
            type="button"
            disabled={!isRunning}
            onClick={() =>
              setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
            }
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#131830] hover:bg-[#1C2345] disabled:opacity-40 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {gameState === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{gameState === 'PAUSED' ? 'Resume' : 'Pause'}</span>
          </button>

          {isRunning && game.cashoutEnabled && (
            <button
              type="button"
              disabled={!canCashout || busy}
              onClick={() => void handleCashout()}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer tabular-nums shadow-lg shadow-emerald-950/40"
            >
              <span>Cash Out ({multiplier.toFixed(2)}x)</span>
            </button>
          )}
        </div>

        {/* Centered Directional Joystick */}
        <div
          data-no-side-touch="true"
          className="relative z-20 w-full flex flex-col items-center justify-center gap-1.5"
        >
          <div
            ref={joystickRef}
            role="application"
            aria-label="Snake Joystick Control"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setStickActive(true);
              updateJoystickFromPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!stickActive) return;
              e.stopPropagation();
              updateJoystickFromPointer(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setStickActive(false);
              setStickOffset({ x: 0, y: 0 });
            }}
            onPointerCancel={() => {
              setStickActive(false);
              setStickOffset({ x: 0, y: 0 });
            }}
            className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-[#101426] border-2 border-violet-500/35 shadow-[0_0_28px_rgba(124,58,237,0.22)] flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
          >
            {/* Inner Directional Ring */}
            <div className="absolute inset-3 rounded-full border border-white/10 bg-[#090C19]" />

            <ArrowUp className="w-4 h-4 text-slate-400 absolute top-2.5 left-1/2 -translate-x-1/2 pointer-events-none" />
            <ArrowDown className="w-4 h-4 text-slate-400 absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-none" />
            <ArrowLeft className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ArrowRight className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Center Draggable Thumbstick Knob */}
            <div
              style={{
                transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
              }}
              className={`relative z-10 w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform ${
                stickActive
                  ? 'duration-0 bg-gradient-to-br from-amber-400 to-violet-500 border-white shadow-[0_0_18px_rgba(245,158,11,0.55)]'
                  : 'duration-150 bg-gradient-to-br from-violet-600 to-indigo-700 border-violet-300/70 shadow-lg'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white/30" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-400 text-center">
            {sideTouchEnabled
              ? 'Drag/tap center joystick or touch any side of screen'
              : 'Drag or tap center joystick'}
          </span>
        </div>
      </div>
    </div>
  );
}
