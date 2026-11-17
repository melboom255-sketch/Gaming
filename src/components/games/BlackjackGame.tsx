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
import { Hand, Plus, Spade, Sparkles, Trophy } from 'lucide-react';

interface BlackjackGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
interface PlayingCard {
  rank: string;
  suit: Suit;
  value: number;
}

type BjStatus = 'idle' | 'playing' | 'won' | 'draw' | 'cashed_out' | 'lost';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function cardValue(rank: string): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

function drawRandomCard(targetBiasValue?: number): PlayingCard {
  if (targetBiasValue !== undefined) {
    const matching = RANKS.filter((r) => cardValue(r) === targetBiasValue);
    if (matching.length > 0) {
      const rank = matching[Math.floor(Math.random() * matching.length)];
      return {
        rank,
        suit: SUITS[Math.floor(Math.random() * SUITS.length)],
        value: cardValue(rank),
      };
    }
  }
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  return {
    rank,
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    value: cardValue(rank),
  };
}

function handTotal(cards: PlayingCard[]): number {
  let sum = cards.reduce((acc, c) => acc + c.value, 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return sum;
}

function SuitGlyph({ suit, className = 'w-4 h-4' }: { suit: Suit; className?: string }) {
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

function CardView({ card, hidden = false }: { card?: PlayingCard; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border-2 border-amber-400/50 flex items-center justify-center shadow-lg animate-[card-deal_0.22s_ease-out]">
        <div className="w-10 h-16 rounded-lg border border-amber-400/35 bg-amber-500/10" />
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div
      className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-[#F8FAFC] border-2 border-slate-300 shadow-lg p-1.5 flex flex-col justify-between animate-[card-deal_0.22s_ease-out] ${
        isRed ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between leading-none">
        <span className="font-mono font-black text-sm sm:text-base">{card.rank}</span>
        <SuitGlyph suit={card.suit} className="w-3.5 h-3.5" />
      </div>
      <div className="flex items-center justify-center">
        <SuitGlyph suit={card.suit} className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <div className="flex items-center justify-between leading-none rotate-180">
        <span className="font-mono font-black text-sm sm:text-base">{card.rank}</span>
        <SuitGlyph suit={card.suit} className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

export function BlackjackGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: BlackjackGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 3.5;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<BjStatus>('idle');
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [hideDealerHole, setHideDealerHole] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [winStreak, setWinStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const playerScore = handTotal(playerCards);
  const dealerScore = hideDealerHole
    ? dealerCards[0]?.value ?? 0
    : handTotal(dealerCards);

  const settleOutcome = async (
    outcome: 'win' | 'draw' | 'loss',
    mult: number,
    message: string
  ) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setHideDealerHole(false);
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus(outcome === 'win' ? 'won' : outcome === 'draw' ? 'draw' : 'lost');

    if (outcome === 'win') {
      setWinStreak((prev) => {
        const next = prev + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      soundFx.win();
    } else if (outcome === 'draw') {
      soundFx.flip();
    } else {
      setWinStreak(0);
      soundFx.error();
    }

    if (!wager) {
      setBanner(`Demo: ${message}`);
      return;
    }

    setBusy(true);
    try {
      const res = await settleWagerOnServer({
        wagerId: wager.id,
        outcome,
        multiplier: Math.min(maxMult, mult),
        score: playerScore,
        challengeUpdates: {
          playIncrement: 1,
          winIncrement: outcome === 'win' ? 1 : 0,
        },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        outcome === 'win'
          ? `${message} Won ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`
          : outcome === 'draw'
            ? `Push Draw — ${formatBirr(res.payoutBirr)} refunded.`
            : message
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settlement failed.');
    } finally {
      setBusy(false);
    }
  };

  const dealHand = async () => {
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
        setError(err instanceof Error ? err.message : 'Unable to deal hand.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    wagerRef.current = wager;
    setActiveWager(wager);
    settledRef.current = false;

    const pHand = [drawRandomCard(), drawRandomCard()];
    const dHand = [drawRandomCard(), drawRandomCard()];
    setPlayerCards(pHand);
    setDealerCards(dHand);
    setHideDealerHole(true);
    setStatus('playing');
    soundFx.move();

    const pTotal = handTotal(pHand);
    const dTotal = handTotal(dHand);
    if (pTotal === 21) {
      if (dTotal === 21) {
        await settleOutcome('draw', 1.0, 'Double Blackjack Push!');
      } else {
        await settleOutcome('win', Math.min(maxMult, 2.5), 'Natural Blackjack 21!');
      }
    }
  };

  const handleHit = async (isDouble = false) => {
    if (status !== 'playing' || settledRef.current) return;
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Gentle house calibration when player hits on risky 13-16
    let nextCard = drawRandomCard();
    if (aiFavored && playerScore >= 13 && playerScore <= 16 && Math.random() < 0.35) {
      nextCard = drawRandomCard(10);
    }

    const nextHand = [...playerCards, nextCard];
    setPlayerCards(nextHand);
    soundFx.flip();

    const total = handTotal(nextHand);
    if (total > 21) {
      await settleOutcome('loss', 0, `Bust at ${total}! Dealer takes hand.`);
      return;
    }

    if (isDouble || total === 21) {
      await runDealerTurn(nextHand, isDouble ? Math.min(maxMult, 3.0) : 2.0);
    }
  };

  const runDealerTurn = async (finalPlayerHand: PlayingCard[], winMult = 2.0) => {
    setHideDealerHole(false);
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;
    const pTotal = handTotal(finalPlayerHand);

    const dHand = [...dealerCards];
    while (handTotal(dHand) < 17) {
      const currentD = handTotal(dHand);
      const needed = pTotal - currentD;
      if (aiFavored && needed >= 2 && needed <= 10 && Math.random() < 0.42) {
        dHand.push(drawRandomCard(needed));
      } else {
        dHand.push(drawRandomCard());
      }
    }
    setDealerCards(dHand);

    const dTotal = handTotal(dHand);
    if (dTotal > 21) {
      await settleOutcome('win', winMult, `Dealer busts at ${dTotal}!`);
    } else if (pTotal > dTotal) {
      await settleOutcome('win', winMult, `You ${pTotal} beat Dealer ${dTotal}!`);
    } else if (pTotal === dTotal) {
      await settleOutcome('draw', 1.0, `Push at ${pTotal}!`);
    } else {
      await settleOutcome('loss', 0, `Dealer ${dTotal} beats your ${pTotal}.`);
    }
  };

  const handleEarlyCashout = async () => {
    if (status !== 'playing' || settledRef.current || playerCards.length < 2) return;
    settledRef.current = true;
    setHideDealerHole(false);
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    const cashMult = playerScore >= 18 ? 1.25 : 0.75;
    if (!wager) {
      setBanner(`Demo Early Cashout at ${cashMult.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: cashMult,
        score: playerScore,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Early Surrender Cashout (${res.multiplier.toFixed(2)}x): ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
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
        currentMultiplier={playerScore >= 18 ? 1.25 : 0.75}
        canCashout={status === 'playing' && playerCards.length >= 2}
        cashoutDisabledReason="Deal cards to unlock Early Cashout"
        onStartRound={() => void dealHand()}
        onCashout={() => void handleEarlyCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Deal Blackjack"
        error={error}
      />

      {/* Monte Carlo Emerald Felt Table (#0F5132 radial felt + mahogany/gold rail) */}
      <div
        className="w-full rounded-2xl border-2 border-amber-500/45 p-5 sm:p-6 space-y-5 shadow-2xl"
        style={{
          background:
            'radial-gradient(ellipse at top, #0F5132 0%, #093622 58%, #051F14 100%)',
        }}
      >
        {/* Dealer Hand + Table Streak HUD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-emerald-100 font-semibold flex items-center gap-1.5">
              <Spade className="w-4 h-4 text-amber-300" />
              Dealer Hand (Stands on 17)
            </span>
            <div className="flex items-center gap-2 tabular-nums">
              {bestStreak > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-black/35 border border-amber-400/30 font-mono text-[11px] text-amber-200">
                  Streak {winStreak} · Best {bestStreak}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-md bg-black/45 border border-white/15 font-mono font-bold text-amber-300">
                {dealerCards.length === 0 ? '--' : hideDealerHole ? `${dealerScore} + ?` : dealerScore}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 min-h-[112px] items-center">
            {dealerCards.length === 0 ? (
              <div className="text-xs text-emerald-100/60">Press Deal Blackjack above to deal cards.</div>
            ) : (
              dealerCards.map((c, idx) => (
                <CardView key={idx} card={c} hidden={hideDealerHole && idx === 1} />
              ))
            )}
          </div>
        </div>

        {/* Player Hand */}
        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-semibold">Your Hand</span>
            <span className="px-2.5 py-0.5 rounded-md bg-black/45 border border-emerald-400/40 font-mono font-bold text-emerald-300 tabular-nums">
              {playerCards.length === 0 ? '--' : playerScore}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5 min-h-[112px] items-center">
            {playerCards.map((c, idx) => (
              <CardView key={idx} card={c} />
            ))}
          </div>
        </div>

        {/* Table Actions */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={status !== 'playing' || busy}
            onClick={() => void handleHit(false)}
            className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Hit</span>
          </button>

          <button
            type="button"
            disabled={status !== 'playing' || busy}
            onClick={() => void runDealerTurn(playerCards, 2.0)}
            className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Hand className="w-4 h-4" />
            <span>Stand</span>
          </button>

          <button
            type="button"
            disabled={status !== 'playing' || busy || playerCards.length !== 2}
            onClick={() => void handleHit(true)}
            title="Draw 1 final card for a 3.0x win payout"
            className="min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-45 text-white font-bold text-xs sm:text-sm cursor-pointer whitespace-nowrap px-2"
          >
            <span>Double (3x)</span>
          </button>
        </div>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-200/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Hit 21 for 2.5x Blackjack, Stand against Dealer, or take Early Cashout!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
