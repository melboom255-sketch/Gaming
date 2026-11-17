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
import { FileText, Hand, Scissors, Sparkles, Trophy } from 'lucide-react';

interface RockPaperScissorsGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type RpsMove = 'rock' | 'paper' | 'scissors';

const MOVES: Array<{ id: RpsMove; label: string; beats: RpsMove; icon: typeof Hand }> = [
  { id: 'rock', label: 'ROCK', beats: 'scissors', icon: Hand },
  { id: 'paper', label: 'PAPER', beats: 'rock', icon: FileText },
  { id: 'scissors', label: 'SCISSORS', beats: 'paper', icon: Scissors },
];

const STREAK_MULTS = [1.0, 1.9, 3.4, 6.0, 10.0];

export function RockPaperScissorsGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: RockPaperScissorsGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = Math.min(10, game.maxMultiplier || 10);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [streak, setStreak] = useState<number>(0);
  const [lastPlayerMove, setLastPlayerMove] = useState<RpsMove | null>(null);
  const [lastAiMove, setLastAiMove] = useState<RpsMove | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);

  const currentMult = Math.min(maxMult, STREAK_MULTS[streak] ?? maxMult);

  const startDuel = async () => {
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
        setError(err instanceof Error ? err.message : 'Unable to start RPS Duel.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    wagerRef.current = wager;
    setActiveWager(wager);
    setStreak(0);
    setLastPlayerMove(null);
    setLastAiMove(null);
    setStatus('playing');
    soundFx.move();
  };

  const playMove = async (move: RpsMove) => {
    if (status !== 'playing' || busy) return;
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    const allMoves: RpsMove[] = ['rock', 'paper', 'scissors'];
    let aiMove = allMoves[Math.floor(Math.random() * 3)];

    if (aiFavored && streak >= 1 && Math.random() < 0.35) {
      const counter = MOVES.find((m) => m.beats === move);
      if (counter) aiMove = counter.id;
    }

    setLastPlayerMove(move);
    setLastAiMove(aiMove);

    if (move === aiMove) {
      soundFx.flip();
      setBanner(`Draw (${move.toUpperCase()} vs ${aiMove.toUpperCase()}) — Pick again!`);
      return;
    }

    const playerMeta = MOVES.find((m) => m.id === move)!;
    const didWin = playerMeta.beats === aiMove;

    if (!didWin) {
      soundFx.error();
      setStatus('lost');
      wagerRef.current = null;
      setActiveWager(null);

      if (!wager) {
        setBanner(`Demo Loss: AI picked ${aiMove.toUpperCase()} vs your ${move.toUpperCase()}.`);
        return;
      }

      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          multiplier: 0,
          score: streak,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setBanner(`AI ${aiMove.toUpperCase()} beats your ${move.toUpperCase()}!`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
      }
      return;
    }

    soundFx.win();
    const nextStreak = streak + 1;
    setStreak(nextStreak);
    const nextMult = Math.min(maxMult, STREAK_MULTS[nextStreak] ?? maxMult);

    if (nextStreak >= 4) {
      await handleCashout(nextMult, nextStreak);
    } else {
      setBanner(`Win #${nextStreak}! Your ${move.toUpperCase()} beat ${aiMove.toUpperCase()}. Cash Out or push to ${STREAK_MULTS[nextStreak + 1].toFixed(1)}x!`);
    }
  };

  const handleCashout = async (overrideMult?: number, overrideStreak?: number) => {
    const finalMult = overrideMult ?? currentMult;
    const finalStreak = overrideStreak ?? streak;
    if (status !== 'playing' || finalStreak < 1) return;

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('won');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout at ${finalMult.toFixed(2)}x (${finalStreak} win streak)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: finalMult,
        score: finalStreak,
        challengeUpdates: { playIncrement: 1, winIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Duel Won! Paid ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`);
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
        currentMultiplier={currentMult}
        canCashout={status === 'playing' && streak >= 1}
        cashoutDisabledReason="Win 1 clash to unlock Cash Out"
        onStartRound={() => void startDuel()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Enter Duel"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1324] border border-cyan-500/30 p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold">
            Win Streak: <span className="font-mono text-white font-bold tabular-nums">{streak}/4</span>
          </span>
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 font-mono font-bold text-amber-300 tabular-nums">
            {currentMult.toFixed(2)}x Current
          </span>
        </div>

        {/* Last Clash Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#161B36] border border-white/10 p-4 text-center space-y-1">
            <div className="text-[11px] text-slate-400 uppercase">Your Throw</div>
            <div className="text-lg font-display font-bold text-cyan-300">
              {lastPlayerMove ? lastPlayerMove.toUpperCase() : '--'}
            </div>
          </div>
          <div className="rounded-xl bg-[#161B36] border border-white/10 p-4 text-center space-y-1">
            <div className="text-[11px] text-slate-400 uppercase">Arena Throw</div>
            <div className="text-lg font-display font-bold text-rose-300">
              {lastAiMove ? lastAiMove.toUpperCase() : '--'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          {MOVES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                disabled={status !== 'playing' || busy}
                onClick={() => void playMove(m.id)}
                className="min-h-[68px] rounded-xl bg-gradient-to-b from-[#1B2242] to-[#11152A] hover:from-violet-600/30 hover:to-violet-900/30 disabled:opacity-45 border border-white/15 hover:border-violet-400 text-white font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <Icon className="w-6 h-6 text-amber-300" />
                <span className="text-xs font-bold">{m.label}</span>
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
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Chain wins (1.9x → 3.4x → 6.0x → 10x) &amp; Cash Out anytime after a win!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
