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
import { Shield, Sparkles, Target, Trophy } from 'lucide-react';

interface PenaltyKickGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type ZoneId = 'top_left' | 'top_right' | 'center' | 'low_left' | 'low_right';
type KickStatus = 'idle' | 'playing' | 'kicking' | 'won' | 'cashed_out' | 'lost';

const ZONES: Array<{ id: ZoneId; label: string; x: number; y: number }> = [
  { id: 'top_left', label: 'Top Left', x: 18, y: 24 },
  { id: 'top_right', label: 'Top Right', x: 82, y: 24 },
  { id: 'center', label: 'Center', x: 50, y: 45 },
  { id: 'low_left', label: 'Low Left', x: 20, y: 74 },
  { id: 'low_right', label: 'Low Right', x: 80, y: 74 },
];

const SHOT_MULTS = [1.5, 2.25, 3.4, 5.2, 8.0];

export function PenaltyKickGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: PenaltyKickGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || 8;
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [status, setStatus] = useState<KickStatus>('idle');
  const [goals, setGoals] = useState(0);
  const [ballTarget, setBallTarget] = useState<ZoneId>('center');
  const [keeperDive, setKeeperDive] = useState<ZoneId>('center');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const multiplier = goals === 0 ? 1.0 : Math.min(maxMult, SHOT_MULTS[goals - 1] ?? 1.0);

  const startShootout = async () => {
    setError(null);
    setBanner(null);
    setGoals(0);
    setBallTarget('center');
    setKeeperDive('center');

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
      setError(err instanceof Error ? err.message : 'Unable to start shootout.');
    } finally {
      setBusy(false);
    }
  };

  const handleCashout = async () => {
    if (status !== 'playing' || goals < 1 || settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setStatus('cashed_out');
    soundFx.win();

    if (!wager) {
      setBanner(`Demo Cashout after ${goals} goals at ${multiplier.toFixed(2)}x!`);
      return;
    }

    setBusy(true);
    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier,
        score: goals * 50,
        challengeUpdates: { playIncrement: 1 },
      });
      onSnapshotSync(res.snapshot);
      setBanner(`Penalty Cashout after ${goals} goals (${res.multiplier.toFixed(2)}x)! Won ${formatBirr(res.payoutBirr)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const shootAt = (zone: ZoneId) => {
    if (status !== 'playing' || settledRef.current) return;
    setStatus('kicking');
    setBallTarget(zone);
    soundFx.flip();

    window.setTimeout(() => {
      void resolveShot(zone);
    }, 450);
  };

  const resolveShot = async (zone: ZoneId) => {
    const wager = wagerRef.current;
    const aiFavored = wager ? wager.aiFavored : Math.random() < 0.7;

    // Keeper guesses 1 of 5 corners, calibrated lightly when AI favored past shot 1
    const saveChance = aiFavored ? (goals === 0 ? 0.3 : 0.48) : 0.22;
    const saved = Math.random() < saveChance;
    const altZones = ZONES.filter((z) => z.id !== zone);
    const keeperZone = saved
      ? zone
      : altZones[Math.floor(Math.random() * altZones.length)].id;
    setKeeperDive(keeperZone);

    if (saved) {
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('lost');
      soundFx.error();
      setBanner(`SAVED by the Keeper! ${goals} goals scored before the block.`);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'loss',
            score: goals * 50,
            challengeUpdates: { playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
        } catch {
          // ignore
        }
      }
      return;
    }

    const nextGoals = goals + 1;
    setGoals(nextGoals);

    if (nextGoals >= 5) {
      settledRef.current = true;
      wagerRef.current = null;
      setActiveWager(null);
      setStatus('won');
      soundFx.bonus();
      const topMult = Math.min(maxMult, SHOT_MULTS[4]);

      if (wager) {
        try {
          const res = await settleWagerOnServer({
            wagerId: wager.id,
            outcome: 'win',
            multiplier: topMult,
            score: 300,
            challengeUpdates: { winIncrement: 1, playIncrement: 1 },
          });
          onSnapshotSync(res.snapshot);
          setBanner(`5/5 HAT-TRICK CHAMPION! Won ${formatBirr(res.payoutBirr)} (${res.multiplier.toFixed(2)}x)`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Settlement failed.');
        }
      } else {
        setBanner(`Demo 5/5 Penalty Champion at ${topMult.toFixed(2)}x!`);
      }
      return;
    }

    setStatus('playing');
    soundFx.match();
    setBanner(`GOAL #${nextGoals}! Multiplier → ${SHOT_MULTS[nextGoals - 1].toFixed(2)}x. Shoot again or Cash Out!`);
  };

  const ballPos = ZONES.find((z) => z.id === ballTarget) || ZONES[2];
  const keeperPos = ZONES.find((z) => z.id === keeperDive) || ZONES[2];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={status === 'playing' || status === 'kicking'}
        isBusy={busy}
        currentMultiplier={multiplier}
        canCashout={status === 'playing' && goals >= 1}
        cashoutDisabledReason="Score 1+ goal to unlock Cash Out"
        onStartRound={() => void startShootout()}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Kick Off Shootout"
        error={error}
      />

      {/* Stadium Goal Pitch */}
      <div className="w-full rounded-2xl bg-gradient-to-b from-[#0C192C] via-[#0B2219] to-[#081710] border-2 border-emerald-400/30 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
            <Trophy className="w-4 h-4" />
            Addis Stadium 5-Shot Shootout
          </span>
          <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] ${
                  n <= goals
                    ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                    : 'bg-[#09121B] border-white/15 text-slate-400'
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Interactive Goal Net */}
        <div className="relative w-full h-56 sm:h-64 rounded-xl bg-gradient-to-b from-[#07111F] to-[#0B2D1B] border border-white/15 overflow-hidden">
          {/* Goal Frame */}
          <div className="absolute inset-x-6 top-5 bottom-6 border-t-4 border-x-4 border-slate-200/85 rounded-t-lg bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:12px_12px]" />

          {/* Goalkeeper Dive Indicator */}
          <div
            style={{
              left: `${keeperPos.x}%`,
              top: `${keeperPos.y}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none z-10"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/30 border-2 border-amber-300 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-amber-300" />
            </div>
          </div>

          {/* Football Shot Indicator */}
          {(status === 'kicking' || goals > 0 || status === 'lost') && (
            <div
              style={{
                left: `${ballPos.x}%`,
                top: `${ballPos.y}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none z-20"
            >
              <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_16px_rgba(255,255,255,0.8)]" />
            </div>
          )}

          {/* 5 Target Reticle Buttons */}
          {ZONES.map((z) => (
            <button
              key={z.id}
              type="button"
              disabled={status !== 'playing'}
              onClick={() => shootAt(z.id)}
              style={{ left: `${z.x}%`, top: `${z.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 min-h-[38px] px-2.5 py-1 rounded-lg bg-[#0B1224]/85 hover:bg-emerald-500 hover:text-slate-950 disabled:opacity-45 border border-emerald-400/50 text-emerald-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Target className="w-3 h-3" />
              <span>{z.label}</span>
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
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>Aim at any of the 5 net corners. Score goals & Cash Out anytime!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
