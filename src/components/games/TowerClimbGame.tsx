import { useRef, useState } from 'react';
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
import { Castle, Flame, KeyRound, ShieldCheck, Sparkles, Trophy } from 'lucide-react';

interface TowerClimbGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type TowerStatus = 'idle' | 'playing' | 'won' | 'cashed_out' | 'lost';

const TOTAL_FLOORS = 8;
const FLOOR_MULTIPLIERS = [1.35, 1.8, 2.4, 3.2, 4.3, 5.8, 7.8, 10.0];

export function TowerClimbGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: TowerClimbGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 10;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<TowerStatus>('idle');
  const [currentFloor, setCurrentFloor] = useState(0); // 0..7 climbing upward
  const [revealedPicks, setRevealedPicks] = useState<
    Record<number, { chosenCol: number; trapCol: number }>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const currentMultiplier =
    currentFloor === 0
      ? 1.0
      : Math.min(maxMult, FLOOR_MULTIPLIERS[currentFloor - 1] ?? 1.0);

  const startClimb = async () => {
    setError(null);
    setBanner(null);
    setRevealedPicks({});
    setCurrentFloor(0);

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
      setError(err instanceof Error ? err.message : 'Unable to start Tower Climb.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || currentFloor < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at Floor ${currentFloor} (${currentMultiplier.toFixed(2)}x)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: currentMultiplier,
        score: currentFloor * 50,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        `Descended from Floor ${currentFloor} at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const pickDoor = async (floorIdx: number, colIdx: number) => {
    if (status !== 'playing' || floorIdx !== currentFloor || settledRef.current) return;

    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // 1 trap per 3 doors normally; when aiFavored and floor >= 2, calibrated trap chance
    let trapCol = Math.floor(Math.random() * 3);
    if (aiFavored && floorIdx >= 1 && Math.random() < 0.25) {
      trapCol = colIdx;
    }

    setRevealedPicks((prev) => ({
      ...prev,
      [floorIdx]: { chosenCol: colIdx, trapCol },
    }));

    if (colIdx === trapCol) {
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('lost');
      soundFx.error();
      setBanner(`Sprung a stone trap on Floor ${floorIdx + 1}! Stake lost.`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: floorIdx * 50,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore
        }
      }
      return;
    }

    const nextFloor = floorIdx + 1;
    setCurrentFloor(nextFloor);

    if (nextFloor >= TOTAL_FLOORS) {
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('won');
      soundFx.bonus();
      const topMult = Math.min(maxMult, FLOOR_MULTIPLIERS[TOTAL_FLOORS - 1]);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'win',
            multiplier: topMult,
            score: TOTAL_FLOORS * 100,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`Summit Conquered at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement error.');
        }
      } else {
        setBanner(`Demo Summit Conquered at ${topMult.toFixed(2)}x!`);
      }
      return;
    }

    soundFx.match();
    setBanner(
      `Cleared Floor ${nextFloor} (${FLOOR_MULTIPLIERS[nextFloor - 1].toFixed(2)}x)! Climb higher or Cash Out.`
    );
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
        canCashout={status === 'playing' && currentFloor >= 1}
        cashoutDisabledReason="Clear Floor 1 to unlock Cash Out"
        onStartRound={() => void startClimb()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Enter Tower"
        error={error}
      />

      {/* Lalibela Monolith Tower (Top = Floor 8 down to Floor 1) */}
      <div className="w-full rounded-2xl bg-gradient-to-b from-[#171124] to-[#090B15] border border-amber-400/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
          <span className="font-semibold text-amber-200 flex items-center gap-1.5">
            <Castle className="w-4 h-4 text-amber-300" />
            Lalibela Monolith Ascent (8 Floors)
          </span>
          <span className="font-mono text-emerald-300 font-bold">
            Floor {currentFloor}/8 · {currentMultiplier.toFixed(2)}x
          </span>
        </div>

        <div className="flex flex-col-reverse gap-1.5">
          {Array.from({ length: TOTAL_FLOORS }, (_, floorIdx) => {
            const isActiveRow = status === 'playing' && floorIdx === currentFloor;
            const pick = revealedPicks[floorIdx];
            const mult = Math.min(maxMult, FLOOR_MULTIPLIERS[floorIdx]);

            return (
              <div
                key={floorIdx}
                className={`grid grid-cols-12 items-center gap-2 rounded-xl px-2.5 py-1.5 border ${
                  isActiveRow
                    ? 'bg-amber-500/15 border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                    : pick
                      ? 'bg-[#0C1020] border-white/10'
                      : 'bg-[#090C18]/70 border-white/5 opacity-75'
                }`}
              >
                <div className="col-span-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">F{floorIdx + 1}</span>
                  <span className="font-bold text-amber-300">{mult.toFixed(2)}x</span>
                </div>

                <div className="col-span-9 grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map((colIdx) => {
                    const isChosen = pick?.chosenCol === colIdx;
                    const isTrap = pick?.trapCol === colIdx;

                    return (
                      <button
                        key={colIdx}
                        type="button"
                        disabled={!isActiveRow}
                        onClick={() => void pickDoor(floorIdx, colIdx)}
                        className={`min-h-[36px] rounded-lg border flex items-center justify-center gap-1 text-xs font-semibold transition-all ${
                          pick
                            ? isTrap
                              ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                              : isChosen
                                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100'
                                : 'bg-[#0E1326] border-white/10 text-slate-500'
                            : isActiveRow
                              ? 'bg-[#1D2444] hover:bg-amber-500/25 border-amber-300/45 text-amber-100 cursor-pointer'
                              : 'bg-[#0E1222] border-white/10 text-slate-600'
                        }`}
                      >
                        {pick ? (
                          isTrap ? (
                            <Flame className="w-3.5 h-3.5 text-rose-300" />
                          ) : isChosen ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                          ) : (
                            <span>·</span>
                          )
                        ) : (
                          <>
                            <KeyRound className="w-3 h-3 opacity-80" />
                            <span>Door {colIdx + 1}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm pt-1">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Pick 1 of 3 stone portals per floor. Cash Out anytime before hitting a trap!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
