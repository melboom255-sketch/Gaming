import { useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import {
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
import { Crown, Sparkles, Trophy } from 'lucide-react';

interface BaccaratGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type BetSide = 'player' | 'banker' | 'tie';
type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

interface BacCard {
  rank: string;
  suit: Suit;
  points: number;
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function rankPoints(rank: string): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

function drawCard(targetPoint?: number): BacCard {
  if (targetPoint !== undefined) {
    const matches = RANKS.filter((r) => rankPoints(r) === targetPoint);
    if (matches.length > 0) {
      const rank = matches[Math.floor(Math.random() * matches.length)];
      return {
        rank,
        suit: SUITS[Math.floor(Math.random() * SUITS.length)],
        points: rankPoints(rank),
      };
    }
  }
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  return {
    rank,
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    points: rankPoints(rank),
  };
}

function handTotal(cards: BacCard[]): number {
  return cards.reduce((sum, c) => sum + c.points, 0) % 10;
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

function CardTile({ card }: { card: BacCard }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  return (
    <div
      className={`w-14 h-20 sm:w-18 sm:h-26 rounded-xl bg-[#F8FAFC] border-2 border-slate-300 shadow-lg p-1.5 flex flex-col justify-between animate-[card-deal_0.22s_ease-out] ${
        isRed ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between leading-none">
        <span className="font-mono font-black text-xs sm:text-sm">{card.rank}</span>
        <SuitGlyph suit={card.suit} className="w-3 h-3" />
      </div>
      <div className="flex items-center justify-center">
        <SuitGlyph suit={card.suit} className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <div className="flex items-center justify-between leading-none rotate-180">
        <span className="font-mono font-black text-xs sm:text-sm">{card.rank}</span>
        <SuitGlyph suit={card.suit} className="w-3 h-3" />
      </div>
    </div>
  );
}

export function BaccaratGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: BaccaratGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 8;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [betSide, setBetSide] = useState<BetSide>('player');
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [dealing, setDealing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playerCards, setPlayerCards] = useState<BacCard[]>([]);
  const [bankerCards, setBankerCards] = useState<BacCard[]>([]);
  const [winnerSide, setWinnerSide] = useState<BetSide | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BetSide[]>([]);
  const timerRef = useRef<number | null>(null);

  const pScore = handTotal(playerCards);
  const bScore = handTotal(bankerCards);

  const handleDeal = async () => {
    if (dealing || busy) return;
    setError(null);
    setBanner(null);
    setWinnerSide(null);

    let wager: ActiveWagerSession | null = null;
    if (currentUser) {
      setBusy(true);
      try {
        const res = await startWagerOnServer({ gameSlug: game.slug, stakeBirr });
        onSnapshotSync(res.snapshot);
        wager = res.wager;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to place Baccarat bet.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setActiveWager(wager);
    setDealing(true);
    soundFx.move();

    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Deal initial 2-card hands
    const pHand: BacCard[] = [drawCard(), drawCard()];
    const bHand: BacCard[] = [drawCard(), drawCard()];

    let pTot = handTotal(pHand);
    let bTot = handTotal(bHand);

    // Classic Punto Banco 3rd-card rule (when no natural 8/9)
    if (pTot < 8 && bTot < 8) {
      let playerThirdVal: number | null = null;
      if (pTot <= 5) {
        const third = drawCard();
        pHand.push(third);
        playerThirdVal = third.points;
        pTot = handTotal(pHand);
      }
      const bankerShouldDraw =
        playerThirdVal === null
          ? bTot <= 5
          : bTot <= 2 ||
            (bTot === 3 && playerThirdVal !== 8) ||
            (bTot === 4 && playerThirdVal >= 2 && playerThirdVal <= 7) ||
            (bTot === 5 && playerThirdVal >= 4 && playerThirdVal <= 7) ||
            (bTot === 6 && (playerThirdVal === 6 || playerThirdVal === 7));

      if (bankerShouldDraw) {
        // Gentle house calibration on final card if favored
        if (aiFavored && betSide === 'player' && pTot >= bTot && Math.random() < 0.45) {
          const needed = (pTot + 1 - bTot + 10) % 10;
          bHand.push(drawCard(needed));
        } else if (aiFavored && betSide === 'banker' && bTot >= pTot && Math.random() < 0.35) {
          const badPoint = (pTot - 1 - bTot + 10) % 10;
          bHand.push(drawCard(badPoint));
        } else {
          bHand.push(drawCard());
        }
      }
    }

    // If AI favored and Tie was selected on natural tie, bias one extra tie break
    if (aiFavored && betSide === 'tie' && handTotal(pHand) === handTotal(bHand) && Math.random() < 0.55) {
      bHand[0] = drawCard((bHand[0].points + 1) % 10);
    }

    const finalP = handTotal(pHand);
    const finalB = handTotal(bHand);
    const actualWinner: BetSide = finalP > finalB ? 'player' : finalB > finalP ? 'banker' : 'tie';

    setPlayerCards(pHand);
    setBankerCards(bHand);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setWinnerSide(actualWinner);
      setHistory((prev) => [actualWinner, ...prev].slice(0, 12));

      const isWin = betSide === actualWinner;
      const isPushTie = actualWinner === 'tie' && betSide !== 'tie';
      const winMult =
        actualWinner === 'tie'
          ? Math.min(maxMult, 8.0)
          : actualWinner === 'banker'
            ? 1.95
            : 2.0;

      if (isWin) soundFx.win();
      else if (isPushTie) soundFx.flip();
      else soundFx.error();

      if (!wager) {
        setDealing(false);
        setActiveWager(null);
        setBanner(
          isWin
            ? `Demo Win! ${actualWinner.toUpperCase()} (${finalP} vs ${finalB}) · ${winMult.toFixed(2)}x`
            : isPushTie
              ? `Demo Tie Push (${finalP}–${finalB}) — Stake returned.`
              : `Demo: ${actualWinner.toUpperCase()} won (${finalP} vs ${finalB}).`
        );
        return;
      }

      setBusy(true);
      try {
        const outcome: 'win' | 'draw' | 'loss' = isWin ? 'win' : isPushTie ? 'draw' : 'loss';
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome,
          multiplier: isWin ? winMult : isPushTie ? 1 : 0,
          score: Math.max(finalP, finalB),
          challengeUpdates: {
            playIncrement: 1,
            winIncrement: isWin ? 1 : 0,
          },
        });
        onSnapshotSync(res.snapshot);
        setBanner(
          isWin
            ? `${actualWinner.toUpperCase()} Wins (${finalP}–${finalB})! Paid ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`
            : isPushTie
              ? `Tie at ${finalP}! ${formatBirr(res.payoutBirr)} refunded.`
              : `${actualWinner.toUpperCase()} won (${finalP}–${finalB}).`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
        setDealing(false);
        setActiveWager(null);
      }
    }, 380);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={dealing}
        isBusy={busy}
        currentMultiplier={betSide === 'tie' ? Math.min(maxMult, 8) : betSide === 'banker' ? 1.95 : 2.0}
        canCashout={false}
        cashoutDisabledReason="Resolves immediately on Deal"
        onStartRound={() => void handleDeal()}
        onCashout={() => {}}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Deal Baccarat"
        error={error}
      />

      <div
        className="w-full rounded-2xl border-2 border-amber-500/45 p-5 sm:p-6 space-y-5 shadow-2xl"
        style={{
          background:
            'radial-gradient(ellipse at top, #0E4D3B 0%, #083327 58%, #041D16 100%)',
        }}
      >
        {/* Bet Selection Bar */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'player' as const, label: 'Player', mult: '2.00x', accent: 'border-sky-400/70 bg-sky-500/20 text-sky-200' },
            { id: 'tie' as const, label: 'Tie', mult: `${Math.min(maxMult, 8).toFixed(2)}x`, accent: 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' },
            { id: 'banker' as const, label: 'Banker', mult: '1.95x', accent: 'border-rose-400/70 bg-rose-500/20 text-rose-200' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={dealing || busy}
              onClick={() => setBetSide(opt.id)}
              className={`min-h-[54px] rounded-xl border px-3 py-2 flex flex-col items-center justify-center transition-all cursor-pointer tabular-nums ${
                betSide === opt.id
                  ? `${opt.accent} ring-2 ring-amber-400/70 shadow-lg`
                  : 'border-white/15 bg-black/35 text-slate-300 hover:bg-black/50'
              }`}
            >
              <span className="text-xs sm:text-sm font-bold">{opt.label}</span>
              <span className="text-[11px] font-mono text-amber-300">{opt.mult}</span>
            </button>
          ))}
        </div>

        {/* Hands Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              winnerSide === 'player'
                ? 'border-sky-400 bg-sky-500/10'
                : 'border-white/10 bg-black/25'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-sky-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                PLAYER HAND
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-black/50 border border-white/15 font-mono font-bold text-white tabular-nums">
                {playerCards.length ? pScore : '--'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-h-[104px]">
              {playerCards.length === 0 ? (
                <span className="text-xs text-slate-400">Pick a side &amp; press Deal Baccarat</span>
              ) : (
                playerCards.map((c, idx) => <CardTile key={idx} card={c} />)
              )}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              winnerSide === 'banker'
                ? 'border-rose-400 bg-rose-500/10'
                : 'border-white/10 bg-black/25'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-rose-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                BANKER HAND
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-black/50 border border-white/15 font-mono font-bold text-white tabular-nums">
                {bankerCards.length ? bScore : '--'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 min-h-[104px]">
              {bankerCards.length === 0 ? (
                <span className="text-xs text-slate-400">Closest to 9 wins (Natural 8/9)</span>
              ) : (
                bankerCards.map((c, idx) => <CardTile key={idx} card={c} />)
              )}
            </div>
          </div>
        </div>

        {/* Bead Road History */}
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] text-slate-400 mr-1 shrink-0">Road:</span>
            {history.map((h, i) => (
              <span
                key={i}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                  h === 'player'
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : h === 'banker'
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                }`}
              >
                {h === 'player' ? 'P' : h === 'banker' ? 'B' : 'T'}
              </span>
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
            <div className="flex items-center gap-2 text-emerald-200/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Select Player (2x), Banker (1.95x), or Tie (8x) and Deal!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
