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
import { Bomb, Crown, Gem, ShieldCheck, Sparkles, Trophy } from 'lucide-react';

interface ScratchVaultGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type CellKind = 'gem' | 'crown' | 'bomb';
interface VaultCell {
  id: number;
  revealed: boolean;
  kind: CellKind;
  boost: number;
}

function buildVaultBoard(trapCount = 2): VaultCell[] {
  const cells: VaultCell[] = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    revealed: false,
    kind: Math.random() < 0.25 ? 'crown' : 'gem',
    boost: Math.random() < 0.25 ? 0.55 : 0.3,
  }));
  const picked = new Set<number>();
  while (picked.size < trapCount) {
    picked.add(Math.floor(Math.random() * 9));
  }
  picked.forEach((idx) => {
    cells[idx] = { id: idx, revealed: false, kind: 'bomb', boost: 0 };
  });
  return cells;
}

export function ScratchVaultGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: ScratchVaultGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = Math.min(15, game.maxMultiplier || 15);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [cells, setCells] = useState<VaultCell[]>(() => buildVaultBoard(2));
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [safeReveals, setSafeReveals] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);

  const startScratch = async () => {
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
        setError(err instanceof Error ? err.message : 'Unable to unlock Scratch Vault.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    wagerRef.current = wager;
    setActiveWager(wager);
    setCells(buildVaultBoard(2));
    setMultiplier(1.0);
    setSafeReveals(0);
    setStatus('playing');
    soundFx.move();
  };

  const revealTile = async (idx: number) => {
    if (status !== 'playing' || busy || cells[idx]?.revealed) return;

    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    const next = [...cells];
    let cell = { ...next[idx], revealed: true };

    // Mild house protection on deeper picks when favored
    if (aiFavored && safeReveals >= 2 && cell.kind !== 'bomb' && Math.random() < 0.25) {
      cell = { ...cell, kind: 'bomb', boost: 0 };
    }
    next[idx] = cell;

    if (cell.kind === 'bomb') {
      // Reveal all tiles on trap hit
      const exposed = next.map((c) => ({ ...c, revealed: true }));
      setCells(exposed);
      setStatus('lost');
      wagerRef.current = null;
      setActiveWager(null);
      soundFx.error();

      if (!wager) {
        setBanner('Demo Alarm Tripped! Start a new Scratch Vault card.');
        return;
      }

      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          multiplier: 0,
          score: safeReveals,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setBanner(`Vault Alarm Triggered on Tile #${idx + 1}!`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
      }
      return;
    }

    soundFx.flip();
    const nextSafe = safeReveals + 1;
    const nextMult = Math.min(maxMult, Number((multiplier + cell.boost * nextSafe * 0.55).toFixed(2)));
    setCells(next);
    setSafeReveals(nextSafe);
    setMultiplier(nextMult);

    if (nextSafe >= 7 || nextMult >= maxMult) {
      await handleCashout(nextMult, nextSafe, next);
    }
  };

  const handleCashout = async (
    overrideMult?: number,
    overrideSafe?: number,
    board?: VaultCell[]
  ) => {
    const finalMult = overrideMult ?? multiplier;
    const finalSafe = overrideSafe ?? safeReveals;
    if (status !== 'playing' || finalSafe < 2) return;

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('won');
    setCells((board ?? cells).map((c) => ({ ...c, revealed: true })));
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Vault Cashout at ${finalMult.toFixed(2)}x (${finalSafe} tiles)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: finalMult,
        score: finalSafe,
        challengeUpdates: { playIncrement: 1, winIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Vault Cleared! Paid ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`);
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
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && safeReveals >= 2}
        cashoutDisabledReason="Scratch 2 safe tiles to unlock Cash Out"
        onStartRound={() => void startScratch()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Unlock Vault Card"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1324] border border-amber-400/30 p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Safe Reveals: <span className="font-mono text-white font-bold tabular-nums">{safeReveals}/7</span>
          </span>
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 font-mono font-bold text-amber-300 tabular-nums">
            {multiplier.toFixed(2)}x Value
          </span>
        </div>

        {/* 3x3 Metallic Vault Foil Grid */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {cells.map((cell) => (
            <button
              key={cell.id}
              type="button"
              disabled={status !== 'playing' || cell.revealed || busy}
              onClick={() => void revealTile(cell.id)}
              className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                !cell.revealed
                  ? 'bg-gradient-to-br from-[#232A4A] to-[#141933] border-amber-400/40 hover:border-amber-300 hover:scale-[1.03] shadow-lg'
                  : cell.kind === 'bomb'
                    ? 'bg-rose-600/25 border-rose-400 text-rose-300'
                    : cell.kind === 'crown'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              }`}
            >
              {!cell.revealed ? (
                <>
                  <span className="text-xs font-mono font-bold text-amber-300/90">SCRATCH</span>
                  <span className="text-[10px] text-slate-400">#{cell.id + 1}</span>
                </>
              ) : cell.kind === 'bomb' ? (
                <>
                  <Bomb className="w-7 h-7" />
                  <span className="text-[11px] font-bold">ALARM</span>
                </>
              ) : cell.kind === 'crown' ? (
                <>
                  <Crown className="w-7 h-7" />
                  <span className="text-[11px] font-mono font-bold">+CROWN</span>
                </>
              ) : (
                <>
                  <Gem className="w-7 h-7" />
                  <span className="text-[11px] font-mono font-bold">+GEM</span>
                </>
              )}
            </button>
          ))}
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
              <span>7 Gold Vault prizes &amp; 2 Alarms hidden. Scratch 2+ to Cash Out anytime!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
