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
import { Bomb, Scissors, ShieldCheck, Sparkles, Trophy } from 'lucide-react';

interface BombDefusalGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

interface WireSlot {
  id: number;
  label: string;
  colorClass: string;
  cut: boolean;
  detonated: boolean;
}

const WIRE_DEFS: Array<{ label: string; colorClass: string }> = [
  { label: 'Red Thermal Wire', colorClass: 'from-rose-500 to-rose-700 border-rose-400/60' },
  { label: 'Cobalt Power Wire', colorClass: 'from-sky-500 to-blue-700 border-sky-400/60' },
  { label: 'Emerald Ground Wire', colorClass: 'from-emerald-500 to-emerald-700 border-emerald-400/60' },
  { label: 'Amber Relay Wire', colorClass: 'from-amber-400 to-amber-600 border-amber-300/60' },
  { label: 'Violet Logic Wire', colorClass: 'from-violet-500 to-purple-700 border-violet-400/60' },
  { label: 'Silver Shield Wire', colorClass: 'from-slate-300 to-slate-500 border-slate-200/60' },
];

const STEP_MULTS = [1.0, 1.35, 1.9, 2.75, 4.2, 7.5];

export function BombDefusalGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: BombDefusalGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = Math.min(10, game.maxMultiplier || 10);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [wires, setWires] = useState<WireSlot[]>(() =>
    WIRE_DEFS.map((w, i) => ({ ...w, id: i, cut: false, detonated: false }))
  );
  const [boobyWire, setBoobyWire] = useState<number>(0);
  const [safeCuts, setSafeCuts] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wagerRef = useRef<ActiveWagerSession | null>(null);

  const currentMult = Math.min(maxMult, STEP_MULTS[safeCuts] ?? maxMult);

  const startMission = async () => {
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
        setError(err instanceof Error ? err.message : 'Unable to arm Bomb Defusal.');
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    wagerRef.current = wager;
    setActiveWager(wager);
    setBoobyWire(Math.floor(Math.random() * WIRE_DEFS.length));
    setWires(WIRE_DEFS.map((w, i) => ({ ...w, id: i, cut: false, detonated: false })));
    setSafeCuts(0);
    setStatus('playing');
    soundFx.move();
  };

  const cutWire = async (idx: number) => {
    if (status !== 'playing' || busy || wires[idx]?.cut) return;
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    let hitTrap = idx === boobyWire;
    if (!hitTrap && aiFavored && safeCuts >= 1 && Math.random() < 0.25) {
      hitTrap = true;
    }

    const updated = wires.map((w) =>
      w.id === idx ? { ...w, cut: true, detonated: hitTrap } : w
    );
    setWires(updated);

    if (hitTrap) {
      soundFx.error();
      setStatus('lost');
      wagerRef.current = null;
      setActiveWager(null);
      if (!wager) {
        setBanner(`Demo Detonation on ${wires[idx].label}!`);
        return;
      }
      setBusy(true);
      try {
        const res = await settleWagerOnServer({
          wagerId: wager.id,
          outcome: 'loss',
          multiplier: 0,
          score: safeCuts,
          challengeUpdates: { playIncrement: 1 },
        });
        onSnapshotSync(res.snapshot);
        setBanner(`BOOM! ${wires[idx].label} tripped the fuse after ${safeCuts} safe cuts.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Settlement failed.');
      } finally {
        setBusy(false);
      }
      return;
    }

    soundFx.flip();
    const nextSafe = safeCuts + 1;
    setSafeCuts(nextSafe);
    if (nextSafe >= 5) {
      const topMult = Math.min(maxMult, STEP_MULTS[5]);
      await handleCashout(topMult, nextSafe);
    }
  };

  const handleCashout = async (overrideMult?: number, overrideCuts?: number) => {
    const finalMult = overrideMult ?? currentMult;
    const finalCuts = overrideCuts ?? safeCuts;
    if (status !== 'playing' || finalCuts < 1) return;

    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('won');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Bomb Disarmed at ${finalMult.toFixed(2)}x (${finalCuts} wires cut)!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: finalMult,
        score: finalCuts,
        challengeUpdates: { playIncrement: 1, winIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Device Disarmed! Paid ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`);
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
        canCashout={status === 'playing' && safeCuts >= 1}
        cashoutDisabledReason="Cut 1 safe wire to unlock Cash Out"
        onStartRound={() => void startMission()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Arm Circuit"
        error={error}
      />

      <div className="w-full rounded-2xl bg-[#0F1324] border border-rose-500/30 p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Bomb className="w-4 h-4 text-rose-400" />
            Safe Wires Cut: <span className="font-mono text-white font-bold tabular-nums">{safeCuts}/5</span>
          </span>
          <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 font-mono font-bold text-amber-300 tabular-nums">
            {currentMult.toFixed(2)}x Payout
          </span>
        </div>

        <div className="space-y-2.5">
          {wires.map((wire, i) => (
            <button
              key={wire.id}
              type="button"
              disabled={status !== 'playing' || wire.cut || busy}
              onClick={() => void cutWire(wire.id)}
              className={`w-full min-h-[50px] rounded-xl border px-4 py-2 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                wire.detonated
                  ? 'bg-rose-600/25 border-rose-400 text-rose-200'
                  : wire.cut
                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 opacity-75'
                    : 'bg-[#161B36] hover:bg-[#1E2548] border-white/10 text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-24 sm:w-40 h-3 rounded-full bg-gradient-to-r ${wire.colorClass} ${wire.cut ? 'opacity-30' : ''}`} />
                <span className="text-xs sm:text-sm font-semibold truncate">{wire.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                  Step {Math.min(maxMult, STEP_MULTS[Math.min(i + 1, 5)]).toFixed(2)}x
                </span>
                {wire.detonated ? (
                  <Bomb className="w-4 h-4 text-rose-400" />
                ) : wire.cut ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Scissors className="w-4 h-4 text-slate-300" />
                )}
              </div>
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
              <span>1 hidden fuse triggers detonation — cut safe wires &amp; Cash Out!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
