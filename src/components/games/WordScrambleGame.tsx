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
import { Clock, KeyRound, Sparkles, Trophy } from 'lucide-react';

interface WordScrambleGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type CipherStatus = 'idle' | 'playing' | 'won' | 'cashed_out' | 'lost';

const EASY_WORDS = ['AXUM', 'NILE', 'GOLD', 'LION', 'STAR', 'CROWN', 'TEFF', 'GEM', 'BIRR', 'PEAK'];
const HARD_WORDS = ['LALIBELA', 'ABYSSINIA', 'SIMIEN', 'OBELISK', 'MONOLITH', 'EMERALD', 'HIGHLAND', 'CASINO', 'FORTUNE'];

function scrambleWord(word: string): string {
  const arr = word.split('');
  for (let pass = 0; pass < 4; pass++) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.join('') !== word) break;
  }
  return arr.join('');
}

export function WordScrambleGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: WordScrambleGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 6;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<CipherStatus>('idle');
  const [targetWord, setTargetWord] = useState('AXUM');
  const [scrambled, setScrambled] = useState('UXMA');
  const [guess, setGuess] = useState('');
  const [solvedCount, setSolvedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);
  const solvedRef = useRef(0);

  const multiplier =
    solvedCount === 0
      ? 1.0
      : Math.min(maxMult, Math.round((1.0 + solvedCount * 0.75) * 100) / 100);

  const nextPuzzle = (aiFavored: boolean, count: number) => {
    const pool = aiFavored && count >= 1 ? HARD_WORDS : EASY_WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    setTargetWord(word);
    setScrambled(scrambleWord(word));
    setGuess('');
    setTimeLeft(aiFavored ? 14 : 20);
  };

  useEffect(() => {
    if (status !== 'playing') return;
    const iv = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(iv);
          void handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, targetWord]);

  const handleTimeout = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('lost');
    soundFx.error();
    setBanner(`Time expired! Word was ${targetWord}.`);

    if (wager) {
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          score: solvedRef.current * 40,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
      } catch {
        // ignore
      }
    }
  };

  const startCipher = async () => {
    setError(null);
    setBanner(null);
    setSolvedCount(0);
    solvedRef.current = 0;

    if (!currentUser) {
      wagerRef.current = null;
      setActiveWager(null);
      settledRef.current = false;
      nextPuzzle(Math.random() < 0.7, 0);
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
      nextPuzzle(res.wager.aiFavored, 0);
      setStatus('playing');
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Word Cipher.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || solvedCount < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout after ${solvedCount} words (${multiplier.toFixed(2)}x)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: solvedCount * 50,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Cipher Cashed Out at ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'playing' || settledRef.current) return;
    const clean = guess.trim().toUpperCase();
    if (clean !== targetWord) {
      soundFx.error();
      setBanner('Incorrect cipher — check the scrambled letters!');
      return;
    }

    const nextSolved = solvedCount + 1;
    setSolvedCount(nextSolved);
    solvedRef.current = nextSolved;
    const nextMult = Math.min(maxMult, Math.round((1.0 + nextSolved * 0.75) * 100) / 100);

    if (nextMult >= maxMult) {
      settledRef.current = true;
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
            score: nextSolved * 60,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`Cipher Grandmaster ${res.multiplier.toFixed(2)}x! Won ${formatBirr(res.payoutBirr)}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement error.');
        }
      } else {
        setBanner(`Demo Cipher Grandmaster at ${nextMult.toFixed(2)}x!`);
      }
      return;
    }

    soundFx.match();
    setBanner(`Decoded ${targetWord}! Multiplier → ${nextMult.toFixed(2)}x`);
    const aiFav = wagerRef.current ? wagerRef.current.aiFavored : true;
    nextPuzzle(aiFav, nextSolved);
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
        canCashout={status === 'playing' && solvedCount >= 1}
        cashoutDisabledReason="Decode 1+ word to unlock Cash Out"
        onStartRound={() => void startCipher()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Word Cipher"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1326] border border-white/12 p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-amber-300 font-semibold flex items-center gap-1.5">
            <KeyRound className="w-4 h-4" />
            Decoded: {solvedCount} · Mult: {multiplier.toFixed(2)}x
          </span>
          <span
            className={`font-mono font-bold flex items-center gap-1 tabular-nums ${
              timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-sky-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </span>
        </div>

        {/* Letter Tile Rack */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-3">
          {scrambled.split('').map((ch, i) => (
            <div
              key={`${ch}-${i}`}
              className="w-11 h-12 sm:w-13 sm:h-14 rounded-xl bg-gradient-to-b from-[#1E2547] to-[#111630] border-2 border-amber-400/45 flex items-center justify-center font-mono text-xl sm:text-2xl font-black text-amber-200 shadow-lg"
            >
              {ch}
            </div>
          ))}
        </div>

        <form onSubmit={(e) => void submitGuess(e)} className="flex gap-2">
          <input
            type="text"
            disabled={status !== 'playing'}
            value={guess}
            onChange={(e) => setGuess(e.target.value.toUpperCase())}
            placeholder={status === 'playing' ? 'Type decoded word...' : 'Press Start Word Cipher'}
            className="flex-1 min-h-[46px] px-4 rounded-xl bg-[#080B16] border border-white/15 text-sm sm:text-base font-mono font-bold text-white tracking-widest uppercase focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={status !== 'playing' || !guess.trim()}
            className="min-h-[46px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 font-bold text-sm cursor-pointer"
          >
            Decode
          </button>
        </form>

        <div className="min-h-[26px] flex items-center justify-center text-center text-xs sm:text-sm">
          {banner ? (
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{banner}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Unscramble each cipher before time runs out, or Cash Out anytime!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
