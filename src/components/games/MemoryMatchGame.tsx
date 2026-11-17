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
import {
  Coffee,
  Compass,
  Crown,
  Flame,
  Gem,
  Heart,
  Landmark,
  Moon,
  Shield,
  Sparkles,
  Star,
  Sun,
  Trophy,
} from 'lucide-react';

interface MemoryMatchGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type GridPreset = '4x3' | '4x4' | '6x4';

interface RelicCard {
  uid: number;
  relicId: string;
  label: string;
  colorClass: string;
  matched: boolean;
}

const RELIC_POOL = [
  { id: 'obelisk', label: 'Axum Stele', colorClass: 'text-amber-300', Icon: Landmark },
  { id: 'crown', label: 'Highland Crown', colorClass: 'text-amber-200', Icon: Crown },
  { id: 'star', label: 'Abyssinia Star', colorClass: 'text-violet-300', Icon: Star },
  { id: 'compass', label: 'Nile Compass', colorClass: 'text-blue-300', Icon: Compass },
  { id: 'coffee', label: 'Buna Jebena', colorClass: 'text-amber-400', Icon: Coffee },
  { id: 'shield', label: 'Royal Shield', colorClass: 'text-indigo-300', Icon: Shield },
  { id: 'gem', label: 'Amethyst Gem', colorClass: 'text-purple-300', Icon: Gem },
  { id: 'sun', label: 'Solstice Sun', colorClass: 'text-yellow-300', Icon: Sun },
  { id: 'moon', label: 'Crescent', colorClass: 'text-sky-300', Icon: Moon },
  { id: 'flame', label: 'Hearth Flame', colorClass: 'text-orange-300', Icon: Flame },
  { id: 'sparkles', label: 'Celestial', colorClass: 'text-violet-200', Icon: Sparkles },
  { id: 'trophy', label: 'Laurel Cup', colorClass: 'text-amber-300', Icon: Trophy },
];

function createDeck(preset: GridPreset): RelicCard[] {
  const pairCount = preset === '4x3' ? 6 : preset === '4x4' ? 8 : 12;
  const chosen = RELIC_POOL.slice(0, pairCount);
  const doubled = [...chosen, ...chosen].map((item, idx) => ({
    uid: idx,
    relicId: item.id,
    label: item.label,
    colorClass: item.colorClass,
    matched: false,
  }));

  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled;
}

export function MemoryMatchGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: MemoryMatchGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [preset, setPreset] = useState<GridPreset>('4x4');
  const [cards, setCards] = useState<RelicCard[]>(() => createDeck('4x4'));
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [missesLeft, setMissesLeft] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const totalPairs = cards.length / 2;
  const isFinished = Boolean(
    settledRef.current || (cards.length > 0 && matchedPairs === totalPairs) || missesLeft <= 0
  );
  const isPlaying = Boolean(activeWager && !isFinished);

  const stepMult = preset === '6x4' ? 0.28 : preset === '4x4' ? 0.35 : 0.4;
  const currentMultiplier =
    matchedPairs === 0
      ? 0.5
      : Math.min(
          game.maxMultiplier || 4,
          Math.round((0.55 + matchedPairs * stepMult) * 100) / 100
        );

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const computeLivesBudget = (nextPreset: GridPreset, aiFavored: boolean) => {
    const base = nextPreset === '4x3' ? 4 : nextPreset === '4x4' ? 5 : 7;
    const pctBoost = Math.round((((game.playerWinPercent ?? 30) - 30) / 30) * 2);
    return aiFavored
      ? Math.max(2, base - 2 + pctBoost)
      : Math.max(3, base + 1 + pctBoost);
  };

  const startBirrRound = async (nextPreset: GridPreset = preset) => {
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

      setPreset(nextPreset);
      setCards(createDeck(nextPreset));
      setFlippedIndices([]);
      setMoves(0);
      setMissesLeft(computeLivesBudget(nextPreset, res.wager.aiFavored));
      setSeconds(0);
      setLocked(false);
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Memory Match.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || matchedPairs < 1) return;
    settledRef.current = true;
    setBusy(true);
    wagerRef.current = null;
    setActiveWager(null);
    soundFx.win();

    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: currentMultiplier,
        score: matchedPairs,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(
        `Cashed out at ${res.multiplier.toFixed(2)}x (${matchedPairs} pairs)! Won ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCardTap = (index: number) => {
    if (!isPlaying || locked || settledRef.current) return;
    if (flippedIndices.includes(index) || cards[index].matched) return;

    soundFx.flip();
    const nextFlipped = [...flippedIndices, index];
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      setLocked(true);
      const nextMoves = moves + 1;
      setMoves(nextMoves);

      const [firstIdx, secondIdx] = nextFlipped;
      const firstCard = cards[firstIdx];
      const secondCard = cards[secondIdx];

      if (firstCard.relicId === secondCard.relicId) {
        window.setTimeout(async () => {
          const updated = cards.map((card, i) =>
            i === firstIdx || i === secondIdx ? { ...card, matched: true } : card
          );
          setCards(updated);
          setFlippedIndices([]);
          setLocked(false);
          soundFx.match();

          const allMatched = updated.every((c) => c.matched);
          if (allMatched && !settledRef.current) {
            settledRef.current = true;
            const wager = wagerRef.current;
            wagerRef.current = null;
            setActiveWager(null);
            soundFx.win();
            const fullMult = Math.min(
              game.maxMultiplier || 4,
              Math.round((0.55 + totalPairs * stepMult) * 100) / 100
            );
            if (wager) {
              try {
                const res = await settleWagerOnServer({
                  wagerId: wager.id,
                  outcome: 'win',
                  score: nextMoves,
                  multiplier: fullMult,
                  challengeUpdates: { playIncrement: 1, memoryMovesIfWon: nextMoves },
                });
                onSnapshotSync(res.snapshot);
                setBanner(
                  `Cleared board in ${nextMoves} moves! Won ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`
                );
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to settle Memory win.');
              }
            }
          }
        }, 280);
      } else {
        window.setTimeout(async () => {
          setFlippedIndices([]);
          setLocked(false);
          const nextMisses = missesLeft - 1;
          setMissesLeft(nextMisses);
          if (nextMisses <= 0 && !settledRef.current) {
            settledRef.current = true;
            const wager = wagerRef.current;
            wagerRef.current = null;
            setActiveWager(null);
            soundFx.error();
            setBanner(`Out of lives! Stake settled (0 Birr)`);
            if (wager) {
              try {
                const res = await settleWagerOnServer({
                  wagerId: wager.id,
                  outcome: 'loss',
                  score: nextMoves,
                });
                onSnapshotSync(res.snapshot);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to settle Memory round.');
              }
            }
          }
        }, 680);
      }
    }
  };

  const gridColsClass =
    preset === '6x4'
      ? 'grid-cols-4 sm:grid-cols-6 max-w-2xl'
      : 'grid-cols-4 max-w-lg';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={isPlaying}
        isBusy={busy}
        currentMultiplier={currentMultiplier}
        canCashout={isPlaying && matchedPairs >= 1}
        cashoutDisabledReason="Match 1+ pair to unlock Cash Out"
        onStartRound={() => void startBirrRound(preset)}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Deal Relics"
        error={error}
      />

      {/* Controls & Board Size */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-[#101426] border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-1 bg-[#080A14] p-1 rounded-lg">
          {(['4x3', '4x4', '6x4'] as GridPreset[]).map((size) => (
            <button
              key={size}
              type="button"
              disabled={isPlaying}
              onClick={() => {
                setPreset(size);
                setCards(createDeck(size));
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                preset === size
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {size} Grid
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm tabular-nums">
          <div className="flex items-center gap-1 text-rose-300 font-semibold">
            <Heart className="w-3.5 h-3.5" />
            <span>{missesLeft} lives</span>
          </div>
          <div>
            <span className="text-slate-400 mr-1">Pairs</span>
            <span className="font-mono font-semibold text-amber-300">
              {matchedPairs}/{totalPairs}
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-1">Time</span>
            <span className="font-mono font-semibold text-blue-300">{seconds}s</span>
          </div>
        </div>
      </div>

      {banner && (
        <div className="w-full rounded-xl bg-amber-500/10 border border-amber-400/35 px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-amber-200">
          <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Card Grid */}
      <div className={`grid ${gridColsClass} gap-2.5 sm:gap-3 w-full`}>
        {cards.map((card, index) => {
          const isFaceUp = card.matched || flippedIndices.includes(index);
          const relic = RELIC_POOL.find((r) => r.id === card.relicId) || RELIC_POOL[0];
          const IconComp = relic.Icon;

          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleCardTap(index)}
              disabled={!isPlaying || isFaceUp || locked}
              aria-label={isFaceUp ? card.label : `Hidden relic card ${index + 1}`}
              className="perspective-1000 aspect-square min-h-[60px] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl cursor-pointer disabled:cursor-default"
            >
              <div
                className={`relative w-full h-full transition-transform duration-300 transform-style-3d ${
                  isFaceUp ? 'rotate-y-180' : ''
                }`}
              >
                <div className="absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br from-[#161C38] to-[#0E1224] border border-white/10 hover:border-violet-400/40 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-md border border-amber-400/30 rotate-45 flex items-center justify-center">
                    <div className="w-2 h-2 bg-violet-400/60 rounded-xs" />
                  </div>
                </div>

                <div
                  className={`absolute inset-0 backface-hidden rotate-y-180 rounded-xl border flex flex-col items-center justify-center gap-1 p-2 ${
                    card.matched
                      ? 'bg-violet-600/20 border-amber-400/50'
                      : 'bg-[#19203E] border-blue-400/40'
                  }`}
                >
                  <IconComp className={`w-7 h-7 sm:w-8 sm:h-8 ${card.colorClass}`} />
                  <span className="text-[10px] sm:text-xs font-medium text-slate-200 truncate max-w-full">
                    {card.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
