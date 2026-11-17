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
import { Flame, Shield, Sparkles, Trophy } from 'lucide-react';

interface DragonTigerGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type Side = 'dragon' | 'tiger' | 'tie';
type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

interface DTCard {
  rank: string;
  num: number;
  suit: Suit;
}

const RANKS: Array<{ rank: string; num: number }> = [
  { rank: 'A', num: 1 },
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
];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

function drawDTCard(minNum = 1, maxNum = 13): DTCard {
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

export function DragonTigerGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: DragonTigerGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 8;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [betSide, setBetSide] = useState<Side>('dragon');
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [dealing, setDealing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragonCard, setDragonCard] = useState<DTCard | null>(null);
  const [tigerCard, setTigerCard] = useState<DTCard | null>(null);
  const [winnerSide, setWinnerSide] = useState<Side | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

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
        setError(err instanceof Error ? err.message : 'Unable to start Dragon Tiger.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setActiveWager(wager);
    setDealing(true);
    soundFx.move();

    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;
    let dCard = drawDTCard();
    let tCard = drawDTCard();

    if (aiFavored && Math.random() < 0.4) {
      if (betSide === 'dragon' && dCard.num > tCard.num && dCard.num < 13) {
        tCard = drawDTCard(dCard.num + 1, 13);
      } else if (betSide === 'tiger' && tCard.num > dCard.num && tCard.num < 13) {
        dCard = drawDTCard(tCard.num + 1, 13);
      } else if (betSide === 'tie' && dCard.num === tCard.num) {
        tCard = drawDTCard(dCard.num === 13 ? 1 : dCard.num + 1, 13);
      }
    }

    setDragonCard(dCard);
    setTigerCard(tCard);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const winner: Side =
        dCard.num > tCard.num ? 'dragon' : tCard.num > dCard.num ? 'tiger' : 'tie';
      setWinnerSide(winner);

      const didWin = betSide === winner;
      const isHalfPush = winner === 'tie' && betSide !== 'tie';
      const mult = winner === 'tie' ? Math.min(maxMult, 8.0) : 2.0;

      if (didWin) soundFx.win();
      else if (isHalfPush) soundFx.flip();
      else soundFx.error();

      if (!wager) {
        setDealing(false);
        setActiveWager(null);
        setBanner(
          didWin
            ? `Demo Win! ${winner.toUpperCase()} (${dCard.rank} vs ${tCard.rank}) · ${mult.toFixed(2)}x`
            : isHalfPush
              ? `Demo Tie Push (${dCard.rank}–${tCard.rank}) — Stake returned.`
              : `Demo: ${winner.toUpperCase()} won (${dCard.rank} vs ${tCard.rank}).`
        );
        return;
      }

      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: didWin ? 'win' : isHalfPush ? 'draw' : 'loss',
          multiplier: didWin ? mult : isHalfPush ? 0.5 : 0,
          score: Math.max(dCard.num, tCard.num),
          challengeUpdates: {
            playIncrement: 1,
            winIncrement: didWin ? 1 : 0,
          },
        });
        onSnapshotSync(res.snapshot);
        setBanner(
          didWin
            ? `${winner.toUpperCase()} Wins (${dCard.rank} vs ${tCard.rank})! Paid ${formatBirr(res.payoutBirr)}`
            : isHalfPush
              ? `Tie (${dCard.rank}–${tCard.rank}) — 50% Stake Returned (${formatBirr(res.payoutBirr)})`
              : `${winner.toUpperCase()} took it (${dCard.rank} vs ${tCard.rank}).`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
        setDealing(false);
        setActiveWager(null);
      }
    }, 360);
  };

  const renderCard = (card: DTCard | null, label: string) => {
    if (!card) {
      return (
        <div className="w-24 h-36 rounded-2xl bg-[#161B36] border-2 border-white/15 flex items-center justify-center text-xs text-slate-400">
          {label}
        </div>
      );
    }
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    return (
      <div
        className={`w-24 h-36 rounded-2xl bg-[#F8FAFC] border-4 border-amber-400/70 shadow-2xl p-2 flex flex-col justify-between animate-[card-deal_0.22s_ease-out] ${
          isRed ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between leading-none">
          <span className="font-mono font-black text-xl">{card.rank}</span>
          <SuitGlyph suit={card.suit} className="w-4 h-4" />
        </div>
        <div className="flex items-center justify-center">
          <SuitGlyph suit={card.suit} className="w-10 h-10" />
        </div>
        <div className="flex items-center justify-between leading-none rotate-180">
          <span className="font-mono font-black text-xl">{card.rank}</span>
          <SuitGlyph suit={card.suit} className="w-4 h-4" />
        </div>
      </div>
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
        isRoundRunning={dealing}
        isBusy={busy}
        currentMultiplier={betSide === 'tie' ? Math.min(maxMult, 8) : 2.0}
        canCashout={false}
        cashoutDisabledReason="1-card showdown settles immediately"
        onStartRound={() => void handleDeal()}
        onCashout={() => {}}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Deal Showdown"
        error={error}
      />

      <div className="w-full rounded-2xl bg-gradient-to-b from-[#1B1020] via-[#120F24] to-[#0B0E1D] border border-amber-500/35 p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'dragon' as const, label: 'Dragon', mult: '2.00x', icon: Flame, active: 'border-rose-400 bg-rose-500/20 text-rose-200' },
            { id: 'tie' as const, label: 'Tie', mult: `${Math.min(maxMult, 8).toFixed(2)}x`, icon: Shield, active: 'border-emerald-400 bg-emerald-500/20 text-emerald-200' },
            { id: 'tiger' as const, label: 'Tiger', mult: '2.00x', icon: Flame, active: 'border-amber-400 bg-amber-500/20 text-amber-200' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={dealing || busy}
              onClick={() => setBetSide(opt.id)}
              className={`min-h-[54px] rounded-xl border px-3 py-2 flex flex-col items-center justify-center transition-all cursor-pointer tabular-nums ${
                betSide === opt.id
                  ? `${opt.active} ring-2 ring-amber-400/70 shadow-lg`
                  : 'border-white/15 bg-black/35 text-slate-300 hover:bg-black/50'
              }`}
            >
              <span className="text-xs sm:text-sm font-bold">{opt.label}</span>
              <span className="text-[11px] font-mono text-amber-300">{opt.mult}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div
            className={`rounded-xl border p-4 flex flex-col items-center gap-3 ${
              winnerSide === 'dragon'
                ? 'border-rose-400 bg-rose-500/15'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <span className="text-xs font-bold tracking-wider text-rose-300">DRAGON</span>
            {renderCard(dragonCard, 'Dragon')}
          </div>

          <div
            className={`rounded-xl border p-4 flex flex-col items-center gap-3 ${
              winnerSide === 'tiger'
                ? 'border-amber-400 bg-amber-500/15'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <span className="text-xs font-bold tracking-wider text-amber-300">TIGER</span>
            {renderCard(tigerCard, 'Tiger')}
          </div>
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
              <span>Highest single card wins (Ace = 1, King = 13). Ties pay 8x!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
