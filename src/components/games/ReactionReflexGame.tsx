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
import { Sparkles, Trophy, Zap } from 'lucide-react';

interface ReactionReflexGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type ReflexStatus = 'idle' | 'playing' | 'won' | 'cashed_out' | 'lost';

export function ReactionReflexGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: ReactionReflexGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 8;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<ReflexStatus>('idle');
  const [targetPad, setTargetPad] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const hitsRef = useRef(0);

  const multiplier =
    hits === 0 ? 1.0 : Math.min(maxMult, Math.round((1.0 + hits * 0.45) * 100) / 100);

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const failRun = async (reason: string) => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearTimer();
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setTargetPad(null);
    setStatus('lost');
    soundFx.error();
    setBanner(reason);

    if (wager) {
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          score: hitsRef.current * 25,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
      } catch {
        // ignore
      }
    }
  };

  const spawnNextPad = (currentHits: number, aiFavored: boolean) => {
    clearTimer();
    const nextIdx = Math.floor(Math.random() * 16);
    setTargetPad(nextIdx);

    // Window shrinks as streak builds (and slightly tighter when AI favored)
    const baseMs = aiFavored ? 1550 : 1950;
    const windowMs = Math.max(680, baseMs - currentHits * 110);
    timeoutRef.current = window.setTimeout(() => {
      void failRun(`Too slow! Missed reflex pad after ${currentHits} hits.`);
    }, windowMs);
  };

  const startGrid = async () => {
    clearTimer();
    setError(null);
    setBanner(null);
    setHits(0);
    hitsRef.current = 0;

    if (!currentUser) {
      wagerRef.current = null;
      setActiveWager(null);
      settledRef.current = false;
      setStatus('playing');
      soundFx.move();
      spawnNextPad(0, Math.random() < 0.7);
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
      spawnNextPad(0, res.wager.aiFavored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Reflex Grid.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || hits < 1 || settledRef.current) return;
    settledRef.current = true;
    clearTimer();
    setTargetPad(null);
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout after ${hits} hits at ${multiplier.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: hits * 30,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Reflex Cashed Out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const tapPad = async (idx: number) => {
    if (status !== 'playing' || settledRef.current) return;
    if (idx !== targetPad) {
      await failRun('Mis-clicked wrong reflex pad! Stake lost.');
      return;
    }

    const nextHits = hits + 1;
    setHits(nextHits);
    hitsRef.current = nextHits;
    const nextMult = Math.min(maxMult, Math.round((1.0 + nextHits * 0.45) * 100) / 100);

    if (nextMult >= maxMult) {
      settledRef.current = true;
      clearTimer();
      setTargetPad(null);
      const wager = wagerRef.current;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('won');
      soundFx.bonus();

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'win',
            multiplier: nextMult,
            score: nextHits * 40,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`Lightning Max ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement error.');
        }
      } else {
        setBanner(`Demo Lightning Max ${nextMult.toFixed(2)}x!`);
      }
      return;
    }

    soundFx.match();
    const aiFav = wagerRef.current ? wagerRef.current.aiFavored : true;
    spawnNextPad(nextHits, aiFav);
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
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && hits >= 1}
        cashoutDisabledReason="Strike 1+ target pad to unlock Cash Out"
        onStartRound={() => void startGrid()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Reflex Run"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0D1124] border border-cyan-400/25 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            4×4 Lightning Reflex Matrix
          </span>
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            Hits: {hits} · {multiplier.toFixed(2)}x
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-[380px] mx-auto">
          {Array.from({ length: 16 }, (_, idx) => {
            const isTarget = status === 'playing' && targetPad === idx;
            return (
              <button
                key={idx}
                type="button"
                disabled={status !== 'playing'}
                onClick={() => void tapPad(idx)}
                className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer disabled:cursor-default ${
                  isTarget
                    ? 'bg-gradient-to-br from-cyan-400 to-blue-600 border-white text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.65)] scale-[1.04]'
                    : 'bg-[#12172E] border-white/10 hover:border-white/25 text-slate-600'
                }`}
              >
                {isTarget && <Zap className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />}
              </button>
            );
          })}
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Strike the lit cyan pad before the timer expires — Cash Out anytime!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
