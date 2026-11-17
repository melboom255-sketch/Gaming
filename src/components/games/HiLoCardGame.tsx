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
import { ArrowDown, ArrowUp, Sparkles, Trophy } from 'lucide-react';

interface HiLoCardGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
interface HiLoCard {
  rank: string;
  num: number; // 2..14 (Ace=14)
  suit: Suit;
}

const RANKS: Array<{ rank: string; num: number }> = [
  { rank: '2', num: 2 },
  { rank: '3', num: 3 },
  { rank: '4', num: 4 },
  { rank: '5', num: 5 },
  { rank: '6', num: 6 },
  { rank: '7', num: 7 },
  { rank: '8', num: 8 },
  { rank: '9', num: 9 },
  { rank: '10', num: 10 },
  { rank: 'J', num: 11 },
  { rank: 'Q', num: 12 },
  { rank: 'K', num: 13 },
  { rank: 'A', num: 14 },
];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function drawCard(minNum = 2, maxNum = 14): HiLoCard {
  const pool = RANKS.filter((r) => r.num >= minNum && r.num <= maxNum);
  const picked = pool[Math.floor(Math.random() * pool.length)] || RANKS[6];
  return {
    rank: picked.rank,
    num: picked.num,
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  };
}

function SuitGlyph({ suit, className = 'w-5 h-5' }: { suit: Suit; className?: string }) {
  if (suit === 'hearts') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  if (suit === 'diamonds') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 2L20 12L12 22L4 12Z" />
      </svg>
    );
  }
  if (suit === 'clubs') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <circle cx="12" cy="7.5" r="4" />
        <circle cx="7.5" cy="13" r="4" />
        <circle cx="16.5" cy="13" r="4" />
        <path d="M10.5 14h3l1 7h-5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C9 7 4 10.5 4 14.5C4 17 6 19 8.5 19C10 19 11 18.2 11.5 17.5L10 22H14L12.5 17.5C13 18.2 14 19 15.5 19C18 19 20 17 20 14.5C20 10.5 15 7 12 2Z" />
    </svg>
  );
}

export function HiLoCardGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: HiLoCardGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 20;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [currentCard, setCurrentCard] = useState<HiLoCard>(() => drawCard(5, 10));
  const [trail, setTrail] = useState<HiLoCard[]>([]);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [steps, setSteps] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);

  const hiFactor = Math.max(1.08, Number((12.2 / Math.max(1, 14 - currentCard.num)).toFixed(2)));
  const loFactor = Math.max(1.08, Number((12.2 / Math.max(1, currentCard.num - 2)).toFixed(2)));

  const startRound = async () => {
    setError(null);
    setBanner(null);

    let wager: ActiveWagerSession | null = null;
    if (currentUser) {
      setBusy(true);
      try {
        const res = await startWagerOnServer({ gameSlug: game.slug, stakeBirr });
        onSnapshotSync(res.snapshot);
        wager = res.wager;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start Hi-Lo round.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    wagerRef.current = wager;
    setActiveWager(wager);
    const first = drawCard(4, 11);
    setCurrentCard(first);
    setTrail([first]);
    setMultiplier(1.0);
    setSteps(0);
    setStatus('playing');
    soundFx.move();
  };

  const makeGuess = async (direction: 'hi' | 'lo') => {
    if (status !== 'playing' || busy) return;
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Draw next card (gentle house protection on later steps if aiFavored)
    let nextCard = drawCard();
    if (aiFavored && steps >= 1 && Math.random() < 0.36) {
      if (direction === 'hi' && currentCard.num > 2) {
        nextCard = drawCard(2, currentCard.num - 1);
      } else if (direction === 'lo' && currentCard.num < 14) {
        nextCard = drawCard(currentCard.num + 1, 14);
      }
    }

    const wonPick =
      direction === 'hi'
        ? nextCard.num >= currentCard.num
        : nextCard.num <= currentCard.num;

    setCurrentCard(nextCard);
    setTrail((prev) => [nextCard, ...prev].slice(0, 7));

    if (!wonPick) {
      soundFx.error();
      setStatus('lost');
      wagerRef.current = null;
      setActiveWager(null);
      if (!wager) {
        setBanner(`Demo Bust! ${nextCard.rank} was not ${direction === 'hi' ? 'Higher' : 'Lower'}.`);
        return;
      }
      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          multiplier: 0,
          score: steps,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setBanner(`Missed at ${nextCard.rank}! Streak ended at Step ${steps}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
      }
      return;
    }

    soundFx.flip();
    const factor = direction === 'hi' ? hiFactor : loFactor;
    const nextMult = Math.min(maxMult, Number((multiplier * (1 + (factor - 1) * 0.45)).toFixed(2)));
    const nextSteps = steps + 1;
    setMultiplier(nextMult);
    setSteps(nextSteps);

    if (nextMult >= maxMult) {
      await handleCashout(nextMult, nextSteps);
    }
  };

  const handleCashout = async (overrideMult?: number, overrideSteps?: number) => {
    const finalMult = overrideMult ?? multiplier;
    const finalSteps = overrideSteps ?? steps;
    if (status !== 'playing' || finalSteps < 1) return;

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('won');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at ${finalMult.toFixed(2)}x (${finalSteps} streak)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: finalMult,
        score: finalSteps,
        challengeUpdates: { playIncrement: 1, winIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Cashed Out ${formatBirr(res.payoutBirr)} at ${res.multiplier.toFixed(2)}x!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const isRed = currentCard.suit === 'hearts' || currentCard.suit === 'diamonds';

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
        canCashout={status === 'playing' && steps >= 1}
        cashoutDisabledReason="Win 1 card pick to unlock Cash Out"
        onStartRound={() => void startRound()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Deal Card"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1324] border border-amber-400/25 p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold">
            Streak Step <span className="font-mono text-white font-bold tabular-nums">{steps}</span>
          </span>
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 font-mono font-bold text-amber-300 tabular-nums">
            {multiplier.toFixed(2)}x Multiplier
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          <button
            type="button"
            disabled={status !== 'playing' || busy || currentCard.num === 14}
            onClick={() => void makeGuess('hi')}
            className="w-full sm:w-44 min-h-[60px] rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 disabled:opacity-40 border border-emerald-400/50 text-emerald-200 font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-sm">
              <ArrowUp className="w-4 h-4" />
              <span>HIGHER / EQ</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
              +{((hiFactor - 1) * 45).toFixed(0)}% Mult
            </span>
          </button>

          {/* Active Card */}
          <div
            className={`w-28 h-40 rounded-2xl bg-[#F8FAFC] border-4 border-amber-400/60 shadow-2xl p-2.5 flex flex-col justify-between ${
              isRed ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between leading-none">
              <span className="font-mono font-black text-2xl">{currentCard.rank}</span>
              <SuitGlyph suit={currentCard.suit} className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-center">
              <SuitGlyph suit={currentCard.suit} className="w-12 h-12" />
            </div>
            <div className="flex items-center justify-between leading-none rotate-180">
              <span className="font-mono font-black text-2xl">{currentCard.rank}</span>
              <SuitGlyph suit={currentCard.suit} className="w-5 h-5" />
            </div>
          </div>

          <button
            type="button"
            disabled={status !== 'playing' || busy || currentCard.num === 2}
            onClick={() => void makeGuess('lo')}
            className="w-full sm:w-44 min-h-[60px] rounded-xl bg-rose-600/20 hover:bg-rose-600/35 disabled:opacity-40 border border-rose-400/50 text-rose-200 font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-sm">
              <ArrowDown className="w-4 h-4" />
              <span>LOWER / EQ</span>
            </div>
            <span className="text-[11px] font-mono text-rose-300 tabular-nums">
              +{((loFactor - 1) * 45).toFixed(0)}% Mult
            </span>
          </button>
        </div>

        {/* Trail */}
        {trail.length > 0 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pt-1">
            {trail.map((c, idx) => (
              <div
                key={idx}
                className={`px-2.5 py-1 rounded-lg bg-[#161B36] border border-white/10 font-mono text-xs font-bold ${
                  c.suit === 'hearts' || c.suit === 'diamonds' ? 'text-rose-400' : 'text-slate-200'
                }`}
              >
                {c.rank}
              </div>
            ))}
          </div>
        )}

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Guess Higher or Lower card-by-card and Cash Out before a miss!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
