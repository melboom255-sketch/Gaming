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
import { Coins, Crown, Shield, Sparkles, Trophy } from 'lucide-react';

interface CoinFlipStreakGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type CoinSide = 'lion' | 'crown';
type FlipStatus = 'idle' | 'playing' | 'flipping' | 'cashed_out' | 'won' | 'lost';

export function CoinFlipStreakGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: CoinFlipStreakGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 12;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<FlipStatus>('idle');
  const [coinSide, setCoinSide] = useState<CoinSide>('lion');
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const startRound = async () => {
    setError(null);
    setBanner(null);
    setStreak(0);
    setMultiplier(1.0);

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
      setError(err instanceof Error ? err.message : 'Unable to start Coin Flip.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || streak < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout after ${streak} flips at ${multiplier.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: streak * 30,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Cashed out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const flipCoin = (pick: CoinSide) => {
    if (status !== 'playing' || settledRef.current) return;
    setStatus('flipping');
    setError(null);
    soundFx.flip();

    window.setTimeout(() => {
      void resolveFlip(pick);
    }, 520);
  };

  const resolveFlip = async (pick: CoinSide) => {
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // House edge calibration on streaks
    const winProb = aiFavored ? (streak === 0 ? 0.56 : 0.44) : 0.68;
    const isHit = Math.random() < winProb;
    const landed: CoinSide = isHit ? pick : pick === 'lion' ? 'crown' : 'lion';
    setCoinSide(landed);

    if (!isHit) {
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('lost');
      soundFx.error();
      setBanner(`Coin landed on ${landed === 'lion' ? 'Imperial Lion' : 'Royal Crown'}! Streak lost.`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: streak * 30,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore
        }
      }
      return;
    }

    const nextStreak = streak + 1;
    const nextMult = Math.min(
      maxMult,
      Math.round((nextStreak === 1 ? 1.85 : multiplier * 1.55) * 100) / 100
    );
    setStreak(nextStreak);
    setMultiplier(nextMult);

    if (nextMult >= maxMult) {
      settledRef.current = true;
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
            score: nextStreak * 40,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`Max Streak ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement error.');
        }
      } else {
        setBanner(`Demo Max Streak ${nextMult.toFixed(2)}x!`);
      }
      return;
    }

    setStatus('playing');
    soundFx.match();
    setBanner(`Called ${landed.toUpperCase()}! ${nextStreak} in a row → ${nextMult.toFixed(2)}x`);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'playing' || status === 'flipping'}
        isBusy={busy}
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && streak >= 1}
        cashoutDisabledReason="Win 1+ flip to unlock Cash Out"
        onStartRound={() => void startRound()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Coin Flip"
        error={error}
      />

      {/* Minted Gold Coin Pedestal */}
      <div className="w-full rounded-2xl bg-gradient-to-b from-[#1A1308] via-[#100E1B] to-[#080A14] border-2 border-amber-400/35 p-6 space-y-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-amber-300 font-semibold flex items-center gap-1.5">
            <Coins className="w-4 h-4" />
            Imperial Mint Gold Birr Coin
          </span>
          <span className="font-mono font-bold text-emerald-300 tabular-nums">
            Streak: {streak} · {multiplier.toFixed(2)}x
          </span>
        </div>

        <div className="flex justify-center py-2">
          <div
            className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-700 shadow-[0_0_40px_rgba(245,158,11,0.35)] flex flex-col items-center justify-center text-slate-950 transition-all duration-500 ${
              status === 'flipping' ? 'animate-spin scale-90' : 'scale-100'
            }`}
          >
            {coinSide === 'lion' ? (
              <>
                <Shield className="w-12 h-12 stroke-[2.2]" />
                <span className="text-xs font-black tracking-wider mt-1">LION</span>
              </>
            ) : (
              <>
                <Crown className="w-12 h-12 stroke-[2.2]" />
                <span className="text-xs font-black tracking-wider mt-1">CROWN</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={status !== 'playing'}
            onClick={() => flipCoin('lion')}
            className="min-h-[54px] rounded-xl bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-45 border border-amber-400/50 text-amber-100 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-amber-300" />
            <span>Call LION (Heads)</span>
          </button>

          <button
            type="button"
            disabled={status !== 'playing'}
            onClick={() => flipCoin('crown')}
            className="min-h-[54px] rounded-xl bg-violet-500/20 hover:bg-violet-500/35 disabled:opacity-45 border border-violet-400/50 text-violet-100 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-violet-300" />
            <span>Call CROWN (Tails)</span>
          </button>
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Chain Lion/Crown calls up to {maxMult}x or Cash Out after any win!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
