import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CLIENT_PAYLINES_3X3,
  CLIENT_PAYLINES_5X3,
  generateDemoBonusVaultItems,
  generateDemoSlotSpin,
  getInitialGridForEngine,
  getInitialMegawaysColumns,
  getSlotLayoutMode,
  getSymbolsForEngine,
  HOT7_MULT_STOPS,
  isHotMultEngine,
  isMegaways6ReelEngine,
  randomMegawaysColumns,
  randomSymbolForEngine,
} from '@/src/components/games/slotConfig';
import { SlotSymbolIcon } from '@/src/components/games/SlotSymbolIcon';
import {
  buySlotBonusOnServer,
  formatBirr,
  MIN_STAKE_BIRR,
  pickSlotVaultOnServer,
  spinSlotOnServer,
} from '@/src/services/platformService';
import type {
  GameCatalogItem,
  MegawaysCascadeStep,
  PlatformSnapshot,
  SlotBonusPickSession,
  SlotEngineType,
  SlotFreeSpinsState,
  SlotSpinResultData,
  SlotSymbolId,
  SlotWinningLine,
  UserProfile,
} from '@/src/types/platform';
import { soundFx } from '@/src/utils/sound';
import {
  BookOpen,
  Coins,
  Crown,
  Flame,
  Gift,
  Lock,
  LogIn,
  Play,
  Repeat,
  ShieldAlert,
  Sparkles,
  Square,
  Trophy,
  Unlock,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

interface SlotMachineGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  snapshot?: PlatformSnapshot | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

interface SpinHistoryItem {
  id: string;
  multiplier: number;
  payoutBirr: number;
  stakeBirr: number;
  isDemo: boolean;
  wasFreeSpin?: boolean;
}

const PRESET_STAKES = [0.1, 1, 5, 10, 25, 50, 100];
const AUTO_OPTIONS = [5, 10, 25] as const;

const ALL_SLOT_ENGINES: SlotEngineType[] = [
  'fruitslot',
  'hot7spin',
  'safari_spin',
  'pharaoh_spin',
  'candy_spin',
  'abyssinia_megaways',
  'cosmic_megaways',
  'spy_mission_spin',
  'hot_inferno_777',
  'vikings_valhalla_spin',
  'dragon_fortune_spin',
  'wild_west_bounty',
  'pirate_treasure_megaways',
  'zeus_olympus_megaways',
  'neon_vegas_nights',
  'emerald_leprechaun_spin',
  'gladiator_arena_megaways',
  'sheba_crown_megaways',
  'lalibela_gold_megaways',
  'abay_nile_riches',
  'blazing_diamond_777',
  'tropical_berry_frenzy',
  'royal_gold_bullion',
  'ruby_starlight_777',
  'golden_bell_jackpot',
  'samurai_blade_megaways',
  'atlantis_kraken_megaways',
  'cyberpunk_matrix_megaways',
  'volcano_eruption_megaways',
  'valhalla_storm_megaways',
  'cyber_heist_spin',
  'outlaw_gold_train',
  'arabian_genie_spin',
  'aztec_sun_spin',
  'imperial_panda_spin',
];

const THEME_CLASSES: Record<
  SlotEngineType,
  { cabinet: string; border: string; spinBtn: string }
> = {
  fruitslot: {
    cabinet: 'bg-gradient-to-b from-[#0E1824] via-[#0E1326] to-[#090C18]',
    border: 'border-emerald-500/35',
    spinBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50',
  },
  hot7spin: {
    cabinet: 'bg-gradient-to-b from-[#170D14] via-[#100D1E] to-[#0B0D19]',
    border: 'border-amber-500/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 shadow-rose-950/50',
  },
  hot_inferno_777: {
    cabinet: 'bg-gradient-to-b from-[#210A0C] via-[#140B18] to-[#0A0812]',
    border: 'border-orange-500/45',
    spinBtn:
      'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 shadow-red-950/50',
  },
  safari_spin: {
    cabinet: 'bg-gradient-to-b from-[#1A130D] via-[#120F1C] to-[#0A0C16]',
    border: 'border-orange-500/35',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-orange-950/50',
  },
  pharaoh_spin: {
    cabinet: 'bg-gradient-to-b from-[#0D1326] via-[#101325] to-[#080B16]',
    border: 'border-amber-400/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-amber-950/50',
  },
  candy_spin: {
    cabinet: 'bg-gradient-to-b from-[#1A0E24] via-[#120F26] to-[#090B17]',
    border: 'border-pink-500/35',
    spinBtn:
      'bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 shadow-pink-950/50',
  },
  abyssinia_megaways: {
    cabinet: 'bg-gradient-to-b from-[#19130A] via-[#111122] to-[#080A14]',
    border: 'border-amber-400/45',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/50',
  },
  cosmic_megaways: {
    cabinet: 'bg-gradient-to-b from-[#0E1028] via-[#12102B] to-[#070914]',
    border: 'border-cyan-400/40',
    spinBtn:
      'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 shadow-cyan-950/50',
  },
  spy_mission_spin: {
    cabinet: 'bg-gradient-to-b from-[#0A101D] via-[#0B1222] to-[#050811]',
    border: 'border-sky-400/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-amber-950/50',
  },
  vikings_valhalla_spin: {
    cabinet: 'bg-gradient-to-b from-[#0B1524] via-[#0F182C] to-[#070A14]',
    border: 'border-cyan-500/40',
    spinBtn:
      'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-blue-950/50',
  },
  dragon_fortune_spin: {
    cabinet: 'bg-gradient-to-b from-[#210A10] via-[#170C1B] to-[#090812]',
    border: 'border-rose-500/40',
    spinBtn:
      'bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 shadow-red-950/50',
  },
  wild_west_bounty: {
    cabinet: 'bg-gradient-to-b from-[#1D120B] via-[#151018] to-[#090910]',
    border: 'border-amber-600/45',
    spinBtn:
      'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-orange-950/50',
  },
  pirate_treasure_megaways: {
    cabinet: 'bg-gradient-to-b from-[#091520] via-[#0E1324] to-[#060912]',
    border: 'border-amber-400/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-teal-600 hover:from-amber-400 hover:to-teal-500 shadow-teal-950/50',
  },
  zeus_olympus_megaways: {
    cabinet: 'bg-gradient-to-b from-[#0C142B] via-[#111530] to-[#070916]',
    border: 'border-sky-400/45',
    spinBtn:
      'bg-gradient-to-r from-sky-400 to-indigo-600 hover:from-sky-300 hover:to-indigo-500 shadow-indigo-950/50',
  },
  neon_vegas_nights: {
    cabinet: 'bg-gradient-to-b from-[#1B0C29] via-[#120D28] to-[#080714]',
    border: 'border-fuchsia-500/40',
    spinBtn:
      'bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 shadow-purple-950/50',
  },
  emerald_leprechaun_spin: {
    cabinet: 'bg-gradient-to-b from-[#081C14] via-[#0B171D] to-[#060D11]',
    border: 'border-emerald-400/45',
    spinBtn:
      'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-emerald-950/50',
  },
  gladiator_arena_megaways: {
    cabinet: 'bg-gradient-to-b from-[#1E0E0E] via-[#15101F] to-[#080912]',
    border: 'border-red-500/40',
    spinBtn:
      'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-red-950/50',
  },
  sheba_crown_megaways: {
    cabinet: 'bg-gradient-to-b from-[#20140A] via-[#151020] to-[#090812]',
    border: 'border-amber-400/45',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 shadow-amber-950/50',
  },
  lalibela_gold_megaways: {
    cabinet: 'bg-gradient-to-b from-[#1D120D] via-[#140E1F] to-[#080A14]',
    border: 'border-orange-400/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-orange-950/50',
  },
  abay_nile_riches: {
    cabinet: 'bg-gradient-to-b from-[#0A1628] via-[#0E1326] to-[#060914]',
    border: 'border-sky-400/40',
    spinBtn:
      'bg-gradient-to-r from-sky-500 to-amber-500 hover:from-sky-400 hover:to-amber-400 shadow-sky-950/50',
  },
  blazing_diamond_777: {
    cabinet: 'bg-gradient-to-b from-[#0E1428] via-[#150E24] to-[#080914]',
    border: 'border-sky-400/45',
    spinBtn:
      'bg-gradient-to-r from-sky-500 to-rose-600 hover:from-sky-400 hover:to-rose-500 shadow-sky-950/50',
  },
  tropical_berry_frenzy: {
    cabinet: 'bg-gradient-to-b from-[#1A0E22] via-[#0E1824] to-[#080C15]',
    border: 'border-emerald-400/40',
    spinBtn:
      'bg-gradient-to-r from-emerald-500 to-pink-500 hover:from-emerald-400 hover:to-pink-400 shadow-emerald-950/50',
  },
  royal_gold_bullion: {
    cabinet: 'bg-gradient-to-b from-[#1D1609] via-[#13111E] to-[#080A12]',
    border: 'border-yellow-400/45',
    spinBtn:
      'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 shadow-amber-950/50',
  },
  ruby_starlight_777: {
    cabinet: 'bg-gradient-to-b from-[#200B1C] via-[#140E26] to-[#080914]',
    border: 'border-rose-400/45',
    spinBtn:
      'bg-gradient-to-r from-rose-500 to-fuchsia-600 hover:from-rose-400 hover:to-fuchsia-500 shadow-rose-950/50',
  },
  golden_bell_jackpot: {
    cabinet: 'bg-gradient-to-b from-[#1A1309] via-[#131020] to-[#090A14]',
    border: 'border-amber-400/40',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-950/50',
  },
  samurai_blade_megaways: {
    cabinet: 'bg-gradient-to-b from-[#210A12] via-[#130D1E] to-[#080812]',
    border: 'border-rose-500/45',
    spinBtn:
      'bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 shadow-rose-950/50',
  },
  atlantis_kraken_megaways: {
    cabinet: 'bg-gradient-to-b from-[#071B24] via-[#0B1528] to-[#050A14]',
    border: 'border-cyan-400/45',
    spinBtn:
      'bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 shadow-cyan-950/50',
  },
  cyberpunk_matrix_megaways: {
    cabinet: 'bg-gradient-to-b from-[#190A2B] via-[#0E132B] to-[#060814]',
    border: 'border-fuchsia-400/45',
    spinBtn:
      'bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:from-fuchsia-400 hover:to-cyan-400 shadow-fuchsia-950/50',
  },
  volcano_eruption_megaways: {
    cabinet: 'bg-gradient-to-b from-[#240B09] via-[#160D19] to-[#090810]',
    border: 'border-orange-500/45',
    spinBtn:
      'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 shadow-red-950/50',
  },
  valhalla_storm_megaways: {
    cabinet: 'bg-gradient-to-b from-[#0A1629] via-[#0F182E] to-[#060A14]',
    border: 'border-sky-400/45',
    spinBtn:
      'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-indigo-950/50',
  },
  cyber_heist_spin: {
    cabinet: 'bg-gradient-to-b from-[#110D28] via-[#0B1226] to-[#050812]',
    border: 'border-violet-400/45',
    spinBtn:
      'bg-gradient-to-r from-violet-500 to-sky-500 hover:from-violet-400 hover:to-sky-400 shadow-violet-950/50',
  },
  outlaw_gold_train: {
    cabinet: 'bg-gradient-to-b from-[#20130A] via-[#140E18] to-[#090810]',
    border: 'border-amber-500/45',
    spinBtn:
      'bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 shadow-orange-950/50',
  },
  arabian_genie_spin: {
    cabinet: 'bg-gradient-to-b from-[#180D2B] via-[#121028] to-[#070814]',
    border: 'border-purple-400/45',
    spinBtn:
      'bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 shadow-purple-950/50',
  },
  aztec_sun_spin: {
    cabinet: 'bg-gradient-to-b from-[#1D1508] via-[#101A14] to-[#070B0E]',
    border: 'border-amber-400/45',
    spinBtn:
      'bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 shadow-amber-950/50',
  },
  imperial_panda_spin: {
    cabinet: 'bg-gradient-to-b from-[#081C13] via-[#111520] to-[#06090F]',
    border: 'border-emerald-400/45',
    spinBtn:
      'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-950/50',
  },
};

export function SlotMachineGame({
  game,
  currentUser,
  snapshot,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: SlotMachineGameProps) {
  const engine = (
    ALL_SLOT_ENGINES.includes(game.engine as SlotEngineType)
      ? game.engine
      : 'fruitslot'
  ) as SlotEngineType;

  const layoutMode = getSlotLayoutMode(engine);
  const isHotMult = isHotMultEngine(engine);
  const isMegaways = layoutMode === 'megaways';
  const reelCount = isMegaways
    ? isMegaways6ReelEngine(engine)
      ? 6
      : 5
    : layoutMode === 'spin_5x3'
      ? 5
      : 3;

  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const maxMult = game.maxMultiplier || (isHotMult || isMegaways ? 25 : 20);
  const theme = THEME_CLASSES[engine];

  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [grid, setGrid] = useState<SlotSymbolId[][]>(() =>
    getInitialGridForEngine(engine)
  );
  const [megawaysCols, setMegawaysCols] = useState<SlotSymbolId[][]>(() =>
    getInitialMegawaysColumns(engine)
  );
  const [multReel, setMultReel] = useState<number>(isHotMult ? 3 : 1);
  const [activeCascadeMult, setActiveCascadeMult] = useState<number>(1);
  const [reelSpinning, setReelSpinning] = useState<boolean[]>(() =>
    Array.from({ length: 7 }, () => false)
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [turboMode, setTurboMode] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState<number>(0);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);

  // Free Spins & Pick-a-Vault Bonus State (Real server synced + Guest demo preview)
  const [demoFreeSpins, setDemoFreeSpins] = useState<SlotFreeSpinsState | null>(null);
  const [demoBonusSession, setDemoBonusSession] = useState<SlotBonusPickSession | null>(null);
  const [demoVaultSecrets, setDemoVaultSecrets] = useState<
    Array<{ kind: 'mult' | 'freespins'; value: number; label: string }>
  >([]);
  const [localBonusModal, setLocalBonusModal] = useState<SlotBonusPickSession | null>(null);
  const [bonusPickBusy, setBonusPickBusy] = useState(false);
  const [midgameNotice, setMidgameNotice] = useState<string | null>(null);

  const serverFreeSpins = currentUser
    ? snapshot?.slotFreeSpins?.[game.slug] ?? null
    : null;
  const serverActiveBonus = currentUser
    ? snapshot?.activeSlotBonuses?.[game.slug] ?? null
    : null;

  const activeFreeSpins = currentUser ? serverFreeSpins : demoFreeSpins;
  const activeFreeSpinsRemaining = activeFreeSpins?.remaining ?? 0;
  const activeBonusModal = currentUser
    ? localBonusModal || serverActiveBonus
    : localBonusModal || demoBonusSession;

  const [winningLines, setWinningLines] = useState<SlotWinningLine[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{
    isWin: boolean;
    totalMultiplier: number;
    baseMultiplier: number;
    multiplierReel: number;
    payoutBirr: number;
    bonusApplied: number;
    isDemo: boolean;
    wasFreeSpin?: boolean;
  } | null>(null);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const symbolsList = useMemo(() => getSymbolsForEngine(engine), [engine]);
  const currentWaysCount = useMemo(
    () =>
      isMegaways
        ? megawaysCols.reduce((acc, col) => acc * col.length, 1)
        : layoutMode === 'spin_5x3'
          ? 10
          : 5,
    [isMegaways, layoutMode, megawaysCols]
  );

  const timersRef = useRef<number[]>([]);
  const intervalsRef = useRef<number[]>([]);
  const pendingSnapshotRef = useRef<PlatformSnapshot | null>(null);
  const mountedRef = useRef(true);
  const autoTriggerRef = useRef<() => void>(() => {});

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    for (const id of intervalsRef.current) window.clearInterval(id);
    timersRef.current = [];
    intervalsRef.current = [];
  }, []);

  useEffect(() => {
    clearAllTimers();
    setGrid(getInitialGridForEngine(engine));
    setMegawaysCols(getInitialMegawaysColumns(engine));
    setMultReel(isHotMult ? 3 : 1);
    setActiveCascadeMult(1);
    setWinningLines([]);
    setLastOutcome(null);
    setHistory([]);
    setError(null);
    setAutoRemaining(0);
    setIsSpinning(false);
    setReelSpinning(Array.from({ length: 7 }, () => false));
    setPaytableOpen(false);
    setMidgameNotice(null);
    setLocalBonusModal(null);
    setDemoFreeSpins(null);
    setDemoBonusSession(null);
  }, [clearAllTimers, engine, isHotMult]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      if (pendingSnapshotRef.current) {
        onSnapshotSync(pendingSnapshotRef.current);
        pendingSnapshotRef.current = null;
      }
    };
  }, [clearAllTimers, onSnapshotSync]);

  const paylinePalette =
    layoutMode === 'spin_5x3' ? CLIENT_PAYLINES_5X3 : CLIENT_PAYLINES_3X3;

  const winningCellMap = useMemo(() => {
    const map = new Map<string, string>();
    const fallbackColors = ['#F59E0B', '#10B981', '#38BDF8', '#A855F7', '#FB7185'];
    for (const line of winningLines) {
      const color =
        paylinePalette.find((p) => p.lineIndex === line.lineIndex)?.color ||
        fallbackColors[(line.lineIndex - 1) % fallbackColors.length];
      for (const [r, c] of line.cells) {
        const key = `${r}-${c}`;
        if (!map.has(key)) map.set(key, color);
      }
    }
    return map;
  }, [paylinePalette, winningLines]);

  const finishSpinReveal = useCallback(
    (
      result: SlotSpinResultData,
      meta: {
        stakeUsed: number;
        payoutBirr: number;
        bonusApplied: number;
        isDemo: boolean;
        wasFreeSpin?: boolean;
        freeSpinsAwarded?: number;
        retriggeredFreeSpins?: number;
        bonusTriggered?: SlotBonusPickSession | null;
      }
    ) => {
      if (!mountedRef.current) return;
      if (pendingSnapshotRef.current) {
        onSnapshotSync(pendingSnapshotRef.current);
        pendingSnapshotRef.current = null;
      }

      const isWin = result.totalMultiplier > 0 && result.winningLines.length > 0;
      setLastOutcome({
        isWin,
        totalMultiplier: result.totalMultiplier,
        baseMultiplier: result.baseMultiplier,
        multiplierReel: result.multiplierReel,
        payoutBirr: meta.payoutBirr,
        bonusApplied: meta.bonusApplied,
        isDemo: meta.isDemo,
        wasFreeSpin: meta.wasFreeSpin,
      });
      setHistory((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            multiplier: result.totalMultiplier,
            payoutBirr: meta.payoutBirr,
            stakeBirr: meta.wasFreeSpin ? 0 : meta.stakeUsed,
            isDemo: meta.isDemo,
            wasFreeSpin: meta.wasFreeSpin,
          },
          ...prev,
        ].slice(0, 8)
      );

      if (meta.bonusTriggered) {
        soundFx.bonus();
        setAutoRemaining(0);
        setLocalBonusModal(meta.bonusTriggered);
        setMidgameNotice('MID-GAME BONUS! Pick 3 Luxury Vaults to reveal prizes!');
      } else if (meta.freeSpinsAwarded && meta.freeSpinsAwarded > 0) {
        soundFx.bonus();
        setMidgameNotice(
          `MID-GAME FREE SPINS! +${meta.freeSpinsAwarded} Free Spins unlocked at 2× Win Boost!`
        );
      } else if (meta.retriggeredFreeSpins && meta.retriggeredFreeSpins > 0) {
        soundFx.bonus();
        setMidgameNotice(`RETRIGGER! +${meta.retriggeredFreeSpins} Extra Free Spins!`);
      } else if (isWin) {
        if (result.totalMultiplier >= 5) soundFx.bonus();
        else soundFx.win();
      } else {
        soundFx.error();
      }
      setIsSpinning(false);
    },
    [onSnapshotSync]
  );

  const runReelAnimation = useCallback(
    (
      result: SlotSpinResultData,
      meta: {
        stakeUsed: number;
        payoutBirr: number;
        bonusApplied: number;
        isDemo: boolean;
        wasFreeSpin?: boolean;
        freeSpinsAwarded?: number;
        retriggeredFreeSpins?: number;
        bonusTriggered?: SlotBonusPickSession | null;
        snapshot: PlatformSnapshot | null;
      }
    ) => {
      clearAllTimers();
      pendingSnapshotRef.current = meta.snapshot;
      setActiveCascadeMult(1);

      const baseDelay = turboMode ? 240 : 480;
      const stepDelay = turboMode ? 90 : 185;
      const tickMs = turboMode ? 55 : 80;

      setReelSpinning(
        Array.from(
          { length: 7 },
          (_, i) => i < reelCount || (isHotMult && i === reelCount)
        )
      );

      if (isMegaways) {
        const finalCols = result.columns || result.grid;
        Array.from({ length: reelCount }).forEach((_, colIdx) => {
          const iv = window.setInterval(() => {
            if (!mountedRef.current) return;
            const randomCols = randomMegawaysColumns(engine);
            setMegawaysCols((prev) =>
              prev.map((col, idx) => (idx === colIdx ? randomCols[idx] : col))
            );
          }, tickMs);
          intervalsRef.current[colIdx] = iv;

          const stopMs = baseDelay + colIdx * stepDelay;
          const t = window.setTimeout(() => {
            window.clearInterval(iv);
            if (!mountedRef.current) return;
            setMegawaysCols((prev) =>
              prev.map((col, idx) => (idx === colIdx ? finalCols[colIdx] : col))
            );
            setReelSpinning((prev) =>
              prev.map((s, idx) => (idx === colIdx ? false : s))
            );
            soundFx.flip();
          }, stopMs);
          timersRef.current.push(t);
        });

        const allStoppedMs = baseDelay + (reelCount - 1) * stepDelay + 60;
        const cascades: MegawaysCascadeStep[] = result.cascades || [];

        if (cascades.length > 0) {
          let offset = allStoppedMs;
          cascades.forEach((step, idx) => {
            const showT = window.setTimeout(() => {
              if (!mountedRef.current) return;
              setMegawaysCols(step.columns);
              setActiveCascadeMult(step.cascadeMultiplier);
              setWinningLines(step.winningLines);
              soundFx.match();
            }, offset);
            timersRef.current.push(showT);
            offset += turboMode ? 360 : 620;

            if (idx === cascades.length - 1) {
              const endT = window.setTimeout(() => {
                finishSpinReveal(result, meta);
              }, offset);
              timersRef.current.push(endT);
            }
          });
        } else {
          const endT = window.setTimeout(() => {
            setWinningLines([]);
            finishSpinReveal(result, meta);
          }, allStoppedMs);
          timersRef.current.push(endT);
        }
        return;
      }

      // 3x3 or 5x3 grid animation
      Array.from({ length: reelCount }).forEach((_, colIdx) => {
        const iv = window.setInterval(() => {
          if (!mountedRef.current) return;
          setGrid((prev) =>
            prev.map((row) =>
              row.map((cell, c) =>
                c === colIdx ? randomSymbolForEngine(engine) : cell
              )
            )
          );
        }, tickMs);
        intervalsRef.current[colIdx] = iv;

        const stopMs = baseDelay + colIdx * stepDelay;
        const t = window.setTimeout(() => {
          window.clearInterval(iv);
          if (!mountedRef.current) return;
          setGrid((prev) =>
            prev.map((row, r) =>
              row.map((cell, c) => (c === colIdx ? result.grid[r][colIdx] : cell))
            )
          );
          setReelSpinning((prev) =>
            prev.map((s, idx) => (idx === colIdx ? false : s))
          );
          soundFx.flip();
        }, stopMs);
        timersRef.current.push(t);
      });

      if (isHotMult) {
        const multIv = window.setInterval(() => {
          if (!mountedRef.current) return;
          const next =
            HOT7_MULT_STOPS[Math.floor(Math.random() * HOT7_MULT_STOPS.length)];
          setMultReel(next);
        }, tickMs);
        intervalsRef.current[reelCount] = multIv;

        const multStopMs = baseDelay + reelCount * stepDelay;
        const mt = window.setTimeout(() => {
          window.clearInterval(multIv);
          if (!mountedRef.current) return;
          setMultReel(result.multiplierReel);
          setReelSpinning((prev) =>
            prev.map((s, idx) => (idx === reelCount ? false : s))
          );
          soundFx.flip();
        }, multStopMs);
        timersRef.current.push(mt);
      }

      const lastReelIndex = isHotMult ? reelCount : reelCount - 1;
      const finalRevealMs = baseDelay + lastReelIndex * stepDelay + 70;
      const revealTimeout = window.setTimeout(() => {
        setWinningLines(result.winningLines);
        finishSpinReveal(result, meta);
      }, finalRevealMs);
      timersRef.current.push(revealTimeout);
    },
    [
      clearAllTimers,
      engine,
      finishSpinReveal,
      isHotMult,
      isMegaways,
      reelCount,
      turboMode,
    ]
  );

  const openDemoBonusGame = useCallback(
    (stakeUsed: number) => {
      const secrets = generateDemoBonusVaultItems();
      setDemoVaultSecrets(secrets);
      const demoBonus: SlotBonusPickSession = {
        id: `demo-bon-${Date.now()}`,
        gameSlug: game.slug,
        stakeBirr: stakeUsed,
        maxPicks: 3,
        pickedIndices: [],
        vaults: secrets.map((_, i) => ({ index: i, revealed: false })),
        status: 'active',
        totalMultiplier: 0,
        freeSpinsAwarded: 0,
        payoutBirr: 0,
        createdAt: new Date().toISOString(),
      };
      setDemoBonusSession(demoBonus);
      setLocalBonusModal(demoBonus);
      return demoBonus;
    },
    [game.slug]
  );

  const handleSpin = useCallback(
    async (demoMode = false) => {
      if (isSpinning || buyBusy || activeBonusModal?.status === 'active') return;
      setError(null);
      setMidgameNotice(null);
      setWinningLines([]);

      if (demoMode || !currentUser) {
        setIsSpinning(true);
        soundFx.move();
        const usingDemoFS = Boolean(demoFreeSpins && demoFreeSpins.remaining > 0);
        const demoSpin = generateDemoSlotSpin(engine, maxMult);
        if (usingDemoFS && demoSpin.totalMultiplier > 0 && demoFreeSpins) {
          demoSpin.totalMultiplier = Math.min(
            maxMult,
            Math.round(demoSpin.totalMultiplier * demoFreeSpins.multiplierBoost * 100) / 100
          );
        }
        const effectiveStake = usingDemoFS ? demoFreeSpins!.stakeBirr : stakeBirr;
        const demoPayout =
          demoSpin.totalMultiplier > 0
            ? Math.round(effectiveStake * demoSpin.totalMultiplier * 100) / 100
            : 0;

        let awardedFS = 0;
        let retriggeredFS = 0;
        let bonusTrig: SlotBonusPickSession | null = null;

        if (usingDemoFS && demoFreeSpins) {
          const nextRem = demoFreeSpins.remaining - 1;
          if (Math.random() < 0.08) retriggeredFS = 3;
          if (nextRem + retriggeredFS <= 0) {
            setDemoFreeSpins(null);
          } else {
            setDemoFreeSpins({
              ...demoFreeSpins,
              remaining: nextRem + retriggeredFS,
              spinsPlayed: demoFreeSpins.spinsPlayed + 1,
              totalWonBirr: Math.round((demoFreeSpins.totalWonBirr + demoPayout) * 100) / 100,
            });
          }
        } else {
          const roll = Math.random();
          if (roll < 0.06) {
            bonusTrig = openDemoBonusGame(stakeBirr);
          } else if (roll < 0.14) {
            awardedFS = Math.random() < 0.35 ? 8 : 5;
            setDemoFreeSpins({
              gameSlug: game.slug,
              remaining: awardedFS,
              stakeBirr,
              multiplierBoost: 2,
              totalWonBirr: 0,
              spinsPlayed: 0,
              source: 'midgame',
            });
          }
        }

        runReelAnimation(demoSpin, {
          stakeUsed: effectiveStake,
          payoutBirr: demoPayout,
          bonusApplied: 0,
          isDemo: true,
          wasFreeSpin: usingDemoFS,
          freeSpinsAwarded: awardedFS,
          retriggeredFreeSpins: retriggeredFS,
          bonusTriggered: bonusTrig,
          snapshot: null,
        });
        return;
      }

      if (activeFreeSpinsRemaining <= 0 && currentUser.balanceBirr < stakeBirr) {
        setAutoRemaining(0);
        setError(`Insufficient Birr balance (${formatBirr(currentUser.balanceBirr)}).`);
        return;
      }

      setIsSpinning(true);
      soundFx.move();

      try {
        const res = await spinSlotOnServer({
          gameSlug: game.slug,
          stakeBirr,
        });
        if (!mountedRef.current) {
          onSnapshotSync(res.snapshot);
          return;
        }
        runReelAnimation(res.spin, {
          stakeUsed: res.stakeBirr,
          payoutBirr: res.payoutBirr,
          bonusApplied: res.bonusBirrApplied,
          isDemo: false,
          wasFreeSpin: res.usedFreeSpin,
          freeSpinsAwarded: res.freeSpinsAwarded,
          retriggeredFreeSpins: res.retriggeredFreeSpins,
          bonusTriggered: res.bonusTriggered,
          snapshot: res.snapshot,
        });
      } catch (err) {
        setAutoRemaining(0);
        setIsSpinning(false);
        setReelSpinning(Array.from({ length: 7 }, () => false));
        setError(err instanceof Error ? err.message : 'Unable to spin slot.');
      }
    },
    [
      activeBonusModal?.status,
      activeFreeSpinsRemaining,
      buyBusy,
      currentUser,
      demoFreeSpins,
      engine,
      game.slug,
      isSpinning,
      maxMult,
      onSnapshotSync,
      openDemoBonusGame,
      runReelAnimation,
      stakeBirr,
    ]
  );

  const handleBonusBuy = async (buyType: 'free_spins' | 'bonus_game') => {
    if (isSpinning || buyBusy || activeBonusModal?.status === 'active') return;
    setError(null);
    setMidgameNotice(null);
    setAutoRemaining(0);

    if (!currentUser) {
      soundFx.bonus();
      if (buyType === 'free_spins') {
        setDemoFreeSpins((prev) => ({
          gameSlug: game.slug,
          remaining: (prev?.remaining || 0) + 8,
          stakeBirr,
          multiplierBoost: 2,
          totalWonBirr: prev?.totalWonBirr || 0,
          spinsPlayed: prev?.spinsPlayed || 0,
          source: 'bought',
        }));
        setMidgameNotice('DEMO BONUS BUY: +8 Free Spins activated (2× Win Boost)!');
      } else {
        openDemoBonusGame(stakeBirr);
      }
      return;
    }

    const cost = stakeBirr * (buyType === 'free_spins' ? 12 : 18);
    if (currentUser.balanceBirr < cost) {
      setError(`Need ${formatBirr(cost)} to buy this feature.`);
      return;
    }

    setBuyBusy(true);
    try {
      const res = await buySlotBonusOnServer({
        gameSlug: game.slug,
        stakeBirr,
        buyType,
      });
      onSnapshotSync(res.snapshot);
      soundFx.bonus();
      if (buyType === 'free_spins') {
        setMidgameNotice(
          `BOUGHT +8 FREE SPINS! Spin for 0 Birr with 2× Win Multiplier Boost!`
        );
      } else if (res.bonusSession) {
        setLocalBonusModal(res.bonusSession);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bonus Buy failed.');
    } finally {
      setBuyBusy(false);
    }
  };

  const handlePickVault = async (vaultIndex: number) => {
    if (!activeBonusModal || bonusPickBusy || activeBonusModal.status !== 'active') return;
    if (activeBonusModal.pickedIndices.includes(vaultIndex)) return;

    if (!currentUser) {
      const secret = demoVaultSecrets[vaultIndex] || {
        kind: 'mult',
        value: 3,
        label: '3.0x Vault',
      };
      const picked = [...activeBonusModal.pickedIndices, vaultIndex];
      const nextMult =
        secret.kind === 'mult'
          ? Math.round((activeBonusModal.totalMultiplier + secret.value) * 100) / 100
          : activeBonusModal.totalMultiplier;
      const nextFS =
        secret.kind === 'freespins'
          ? activeBonusModal.freeSpinsAwarded + secret.value
          : activeBonusModal.freeSpinsAwarded;
      const completed = picked.length >= activeBonusModal.maxPicks;
      const payoutBirr = completed
        ? Math.round(activeBonusModal.stakeBirr * nextMult * 100) / 100
        : 0;

      const updated: SlotBonusPickSession = {
        ...activeBonusModal,
        pickedIndices: picked,
        vaults: activeBonusModal.vaults.map((v, idx) =>
          completed || picked.includes(idx)
            ? {
                index: idx,
                revealed: true,
                kind: demoVaultSecrets[idx]?.kind || 'mult',
                value: demoVaultSecrets[idx]?.value || 2,
                label: demoVaultSecrets[idx]?.label || '2x',
              }
            : v
        ),
        status: completed ? 'claimed' : 'active',
        totalMultiplier: nextMult,
        freeSpinsAwarded: nextFS,
        payoutBirr,
      };
      soundFx.match();
      setDemoBonusSession(updated);
      setLocalBonusModal(updated);

      if (completed && nextFS > 0) {
        setDemoFreeSpins((prev) => ({
          gameSlug: game.slug,
          remaining: (prev?.remaining || 0) + nextFS,
          stakeBirr: activeBonusModal.stakeBirr,
          multiplierBoost: 2,
          totalWonBirr: prev?.totalWonBirr || 0,
          spinsPlayed: prev?.spinsPlayed || 0,
          source: 'bonus_vault',
        }));
      }
      if (completed) soundFx.win();
      return;
    }

    setBonusPickBusy(true);
    try {
      const res = await pickSlotVaultOnServer({
        bonusId: activeBonusModal.id,
        vaultIndex,
      });
      soundFx.match();
      setLocalBonusModal(res.bonusSession);
      onSnapshotSync(res.snapshot);
      if (res.bonusSession.status === 'claimed') {
        soundFx.win();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open vault.');
    } finally {
      setBonusPickBusy(false);
    }
  };

  useEffect(() => {
    autoTriggerRef.current = () => {
      void handleSpin(!currentUser);
    };
  }, [currentUser, handleSpin]);

  useEffect(() => {
    if (isSpinning || autoRemaining <= 0 || activeBonusModal?.status === 'active') return;
    if (currentUser && activeFreeSpinsRemaining <= 0 && currentUser.balanceBirr < stakeBirr) {
      setAutoRemaining(0);
      return;
    }

    const delay = turboMode ? 240 : 480;
    const t = window.setTimeout(() => {
      setAutoRemaining((n) => Math.max(0, n - 1));
      autoTriggerRef.current();
    }, delay);
    return () => window.clearTimeout(t);
  }, [
    activeBonusModal?.status,
    activeFreeSpinsRemaining,
    autoRemaining,
    currentUser,
    isSpinning,
    stakeBirr,
    turboMode,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paytableOpen) {
        setPaytableOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.code === 'Space' && !isSpinning && activeBonusModal?.status !== 'active') {
        e.preventDefault();
        void handleSpin(!currentUser);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBonusModal?.status, currentUser, handleSpin, isSpinning, paytableOpen]);

  const insufficient = Boolean(
    currentUser && activeFreeSpinsRemaining <= 0 && currentUser.balanceBirr < stakeBirr
  );
  const freeSpinsBuyCost = stakeBirr * 12;
  const bonusGameBuyCost = stakeBirr * 18;

  const paytableContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <h4 className="text-sm font-display font-bold text-white">
          Multiplier Paytable
        </h4>
        <span className="text-[11px] text-slate-400">
          {isMegaways ? '3–6 Reels' : layoutMode === 'spin_5x3' ? '3–5 Match' : '3 on Line'}
        </span>
      </div>

      <div className="divide-y divide-white/8">
        {symbolsList.map((sym) => (
          <div
            key={sym.id}
            className="py-1.5 flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#090C18] border border-white/10 flex items-center justify-center shrink-0">
                <SlotSymbolIcon symbolId={sym.id} size="sm" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">
                  {sym.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {sym.badgeText === 'WILD'
                    ? 'Substitutes any symbol'
                    : isMegaways
                      ? 'Per-way base × reels'
                      : layoutMode === 'spin_5x3'
                        ? 'Up to 3.2× for 5-of-a-kind'
                        : 'Match 3 on payline'}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 tabular-nums">
              <div className="font-mono font-bold text-amber-300">
                {sym.multiplier.toFixed(1)}x
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {formatBirr(Math.min(maxMult, sym.multiplier) * stakeBirr)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-violet-500/10 border border-violet-400/25 p-2 text-[11px] text-violet-200 leading-relaxed">
        <strong>Free Spins & Vault Bonus:</strong> Trigger Free Spins (2× Win Boost) or Pick-a-Vault Bonus Games organically mid-spin OR unlock instantly with Bonus Buy!
      </div>

      {isHotMult && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-400/25 p-2 text-[11px] text-amber-200 leading-relaxed">
          <strong>4th Multiplier Reel:</strong> Multiplies matching paylines by{' '}
          <span className="font-mono font-bold">1x–7x</span> (up to {maxMult}x).
        </div>
      )}

      {isMegaways && (
        <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/25 p-2 text-[11px] text-cyan-200 leading-relaxed">
          <strong>Cascading Megaways:</strong> Matching symbols explode and drop fresh symbols with +1x rising multipliers per cascade!
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-1.5">
          <div className="text-xs font-semibold text-white">Recent Spins</div>
          {history.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-[11px] tabular-nums"
            >
              <span className="text-slate-400 font-mono">
                {item.wasFreeSpin ? 'FREE' : formatBirr(item.stakeBirr)}
                {item.isDemo ? ' Demo' : ''}
              </span>
              {item.multiplier > 0 ? (
                <span className="font-mono font-bold text-emerald-300">
                  {item.multiplier.toFixed(2)}x (+{formatBirr(item.payoutBirr)})
                </span>
              ) : (
                <span className="font-mono text-slate-500">0.00x</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2">
      {/* Slim Single-Viewport Info + Slot-Only Bonus Buy Strip */}
      <div className="shrink-0 rounded-xl bg-[#0F1324] border border-white/10 px-2.5 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-300 tabular-nums">
          <span className="font-mono text-amber-300 font-bold">
            {isMegaways
              ? `${currentWaysCount.toLocaleString()} Ways`
              : `${layoutMode === 'spin_5x3' ? 10 : 5} Paylines`}
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="hidden sm:inline">
            Max <strong className="text-amber-300">{maxMult}x</strong>
          </span>
          {activeFreeSpinsRemaining > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 font-mono font-bold shadow-[0_0_12px_rgba(16,185,129,0.28)]">
              FREE SPINS: {activeFreeSpinsRemaining} LEFT (2×)
            </span>
          )}
          {game.bonusBirr > 0 && (
            <span className="text-amber-200 font-semibold flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />+{formatBirr(game.bonusBirr)}
            </span>
          )}
        </div>

        {/* Slot-Only Bonus Buy & Feature Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isSpinning || buyBusy || activeBonusModal?.status === 'active'}
            onClick={() => void handleBonusBuy('free_spins')}
            className="min-h-[30px] px-2 sm:px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-500/45 hover:to-teal-500/45 border border-emerald-400/45 text-emerald-100 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-45 tabular-nums whitespace-nowrap"
          >
            <Sparkles className="w-3 h-3 text-emerald-300" />
            <span>Buy 8 Free Spins ({formatBirr(freeSpinsBuyCost)})</span>
          </button>

          <button
            type="button"
            disabled={isSpinning || buyBusy || activeBonusModal?.status === 'active'}
            onClick={() => void handleBonusBuy('bonus_game')}
            className="min-h-[30px] px-2 sm:px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/30 to-rose-600/30 hover:from-amber-500/45 hover:to-rose-500/45 border border-amber-400/45 text-amber-100 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-45 tabular-nums whitespace-nowrap"
          >
            <Gift className="w-3 h-3 text-amber-300" />
            <span>Buy Bonus Game ({formatBirr(bonusGameBuyCost)})</span>
          </button>

          <button
            type="button"
            onClick={() => setTurboMode((v) => !v)}
            className={`min-h-[30px] px-2 py-1 rounded-lg border text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              turboMode
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-[#141A31] border-white/10 text-slate-300'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span className="hidden xs:inline">Turbo</span>
          </button>

          <button
            type="button"
            onClick={() => setPaytableOpen(true)}
            className="lg:hidden min-h-[30px] px-2 py-1 rounded-lg bg-[#141A31] border border-white/10 text-slate-200 text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <BookOpen className="w-3 h-3 text-amber-300" />
            <span>Paytable</span>
          </button>
        </div>
      </div>

      {/* Main Fullscreen Stage: Left/Center Reels + Docked Spin Controls + Desktop Right Paytable */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div
          className={`lg:col-span-9 min-h-0 h-full rounded-2xl border p-2 sm:p-3.5 flex flex-col justify-between gap-1.5 sm:gap-2 ${theme.cabinet} ${theme.border}`}
        >
          {/* Compact Cabinet Title Bar */}
          <div className="shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isMegaways ? (
                <Crown className="w-4 h-4 text-amber-300 shrink-0" />
              ) : isHotMult ? (
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-display font-bold text-white truncate">
                {game.title}
              </span>
            </div>

            {isMegaways ? (
              <div className="flex items-center gap-2 text-xs font-mono font-bold tabular-nums shrink-0">
                {activeCascadeMult > 1 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200">
                    CASCADE {activeCascadeMult}x
                  </span>
                )}
                <span className="text-cyan-300">
                  {currentWaysCount.toLocaleString()} MEGAWAYS
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">
                {isHotMult ? '5 Lines + 4th Mult Reel' : `${layoutMode === 'spin_5x3' ? 10 : 5} Paylines`}
              </span>
            )}
          </div>

          {/* Flexible Reel Window (flex-1 min-h-0 guarantees Spin button & reels always fit 100dvh) */}
          <div className="flex-1 min-h-0 flex items-stretch gap-2 sm:gap-3">
            <div className="relative flex-1 min-h-0 h-full rounded-xl bg-[#050710] border-2 border-amber-400/25 p-1.5 sm:p-2 overflow-hidden flex flex-col">
              {!isMegaways && winningLines.length > 0 && !isSpinning && (
                <svg
                  viewBox={layoutMode === 'spin_5x3' ? '0 0 500 300' : '0 0 300 300'}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-1.5 sm:inset-2 w-[calc(100%-0.75rem)] sm:w-[calc(100%-1rem)] h-[calc(100%-0.75rem)] sm:h-[calc(100%-1rem)] z-20"
                  aria-hidden="true"
                >
                  {winningLines.map((line) => {
                    const color =
                      paylinePalette.find((p) => p.lineIndex === line.lineIndex)
                        ?.color || '#F59E0B';
                    const pts = line.cells
                      .map(([r, c]) => `${c * 100 + 50},${r * 100 + 50}`)
                      .join(' ');
                    return (
                      <polyline
                        key={line.lineIndex}
                        points={pts}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.9"
                      />
                    );
                  })}
                </svg>
              )}

              {!isMegaways && (
                <div className="hidden sm:flex flex-col justify-around py-2 pr-1 shrink-0 select-none" aria-hidden="true">
                  {paylinePalette.slice(0, layoutMode === 'spin_5x3' ? 10 : 5).map((lineMeta) => {
                    const isHit = !isSpinning && winningLines.some((w) => w.lineIndex === lineMeta.lineIndex);
                    return (
                      <div
                        key={lineMeta.lineIndex}
                        style={
                          isHit
                            ? { backgroundColor: lineMeta.color, borderColor: lineMeta.color, color: '#070912' }
                            : undefined
                        }
                        className={`w-5 h-5 rounded-md border text-[9px] font-mono font-bold flex items-center justify-center tabular-nums transition-colors ${
                          isHit
                            ? 'shadow-sm'
                            : 'bg-[#0C1124] border-white/10 text-slate-500'
                        }`}
                      >
                        {lineMeta.lineIndex}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isSpinning && lastOutcome?.isWin && lastOutcome.totalMultiplier >= 3 && (
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/95 via-yellow-400/95 to-amber-500/95 text-slate-950 font-display font-black text-xs sm:text-sm tracking-wide shadow-xl animate-[win-cell-pop_0.38s_ease-out] whitespace-nowrap">
                  BIG WIN · {lastOutcome.totalMultiplier.toFixed(2)}x (+{formatBirr(lastOutcome.payoutBirr)})
                </div>
              )}

              {isMegaways ? (
                <div
                  className={`grid flex-1 min-h-0 h-full gap-1 sm:gap-1.5 relative z-10 ${
                    reelCount === 6 ? 'grid-cols-6' : 'grid-cols-5'
                  }`}
                >
                  {megawaysCols.map((colSymbols, colIdx) => (
                    <div
                      key={colIdx}
                      className={`flex flex-col gap-1 min-h-0 h-full rounded-lg p-0.5 sm:p-1 ${
                        reelSpinning[colIdx]
                          ? 'bg-[#0F1630] ring-1 ring-amber-400/40 animate-[reel-spin_0.16s_linear_infinite]'
                          : 'bg-[#0A0E1E]'
                      }`}
                    >
                      {colSymbols.map((symbolId, rowIdx) => {
                        const winColor =
                          !isSpinning ? winningCellMap.get(`${rowIdx}-${colIdx}`) : undefined;
                        return (
                          <div
                            key={`${colIdx}-${rowIdx}`}
                            style={
                              winColor
                                ? {
                                    borderColor: winColor,
                                    boxShadow: `0 0 14px ${winColor}55`,
                                  }
                                : undefined
                            }
                            className={`flex-1 min-h-0 w-full rounded-lg border flex items-center justify-center overflow-hidden p-0.5 transition-transform duration-150 ${
                              reelSpinning[colIdx]
                                ? 'bg-[#0B0F20] border-white/10 opacity-85'
                                : winColor
                                  ? 'bg-[#0B0F20] border-2 scale-[1.02] animate-[win-cell-pop_0.38s_ease-out]'
                                  : 'bg-[#0B0F20] border-white/10'
                            }`}
                          >
                            <SlotSymbolIcon
                              symbolId={symbolId}
                              className="w-full h-full rounded-md"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={`grid flex-1 min-h-0 h-full gap-1.5 sm:gap-2 relative z-10 ${
                    layoutMode === 'spin_5x3' ? 'grid-cols-5' : 'grid-cols-3'
                  }`}
                >
                  {Array.from({ length: reelCount }).map((_, col) => (
                    <div
                      key={col}
                      className={`flex flex-col gap-1.5 sm:gap-2 min-h-0 h-full rounded-xl p-1 ${
                        reelSpinning[col]
                          ? 'bg-[#0E142B]/90 ring-1 ring-amber-400/35 animate-[reel-spin_0.16s_linear_infinite]'
                          : 'bg-[#0B0F20]/80'
                      }`}
                    >
                      {[0, 1, 2].map((row) => {
                        const symbolId = grid[row]?.[col] || symbolsList[0].id;
                        const winColor =
                          !isSpinning ? winningCellMap.get(`${row}-${col}`) : undefined;
                        return (
                          <div
                            key={`${row}-${col}`}
                            style={
                              winColor
                                ? {
                                    borderColor: winColor,
                                    boxShadow: `0 0 14px ${winColor}55`,
                                  }
                                : undefined
                            }
                            className={`flex-1 min-h-0 rounded-lg sm:rounded-xl border flex items-center justify-center overflow-hidden p-0.5 sm:p-1 transition-transform duration-150 ${
                              reelSpinning[col]
                                ? 'bg-[#0B0F20] border-white/10 opacity-85'
                                : winColor
                                  ? 'bg-[#0B0F20] border-2 scale-[1.02] animate-[win-cell-pop_0.38s_ease-out]'
                                  : 'bg-[#0B0F20] border-white/10'
                            }`}
                          >
                            <SlotSymbolIcon
                              symbolId={symbolId}
                              className="w-full h-full rounded-lg"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isHotMult && (
              <div className="w-16 sm:w-24 shrink-0 rounded-xl bg-[#070914] border-2 border-amber-500/40 p-2 flex flex-col items-center justify-center gap-1.5 text-center">
                <div className="text-[10px] font-semibold text-amber-300 uppercase">
                  Mult
                </div>
                <div
                  className={`w-12 h-16 sm:w-18 sm:h-24 rounded-xl border-2 flex flex-col items-center justify-center tabular-nums transition-all ${
                    reelSpinning[reelCount]
                      ? 'bg-[#1B1220] border-amber-400/40 text-amber-200 scale-95'
                      : lastOutcome?.isWin
                        ? 'bg-gradient-to-br from-amber-500/30 to-rose-600/30 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        : 'bg-[#121526] border-white/15 text-amber-300'
                  }`}
                >
                  <span className="text-xl sm:text-3xl font-mono font-black">
                    {multReel}x
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 leading-tight">
                  Line Boost
                </div>
              </div>
            )}
          </div>

          {/* Slim Outcome & Mid-Game Free Spin / Bonus Banner */}
          <div
            className={`shrink-0 rounded-xl px-3 py-1.5 border flex flex-wrap items-center justify-between gap-2 text-xs ${
              midgameNotice
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-100'
                : !isSpinning && lastOutcome?.isWin
                  ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100'
                  : 'bg-[#0B0E1D] border-white/10 text-slate-300'
            }`}
          >
            {isSpinning ? (
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
                <span>
                  {activeFreeSpinsRemaining > 0
                    ? `Playing FREE SPIN (2× Boost)...`
                    : isMegaways && activeCascadeMult > 1
                      ? `Cascading ×${activeCascadeMult} multiplier...`
                      : `Spinning for ${formatBirr(stakeBirr)}...`}
                </span>
              </div>
            ) : midgameNotice ? (
              <div className="flex items-center gap-2 font-bold text-amber-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>{midgameNotice}</span>
              </div>
            ) : lastOutcome?.isWin ? (
              <>
                <div className="flex items-center gap-1.5 font-semibold text-emerald-200 truncate max-w-[65%]">
                  <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate">
                    {lastOutcome.wasFreeSpin ? 'FREE SPIN: ' : lastOutcome.isDemo ? 'Demo: ' : ''}
                    {winningLines.map((l) => l.lineName).join(' + ')}
                  </span>
                </div>
                <div className="font-mono font-black text-amber-300 tabular-nums shrink-0">
                  {lastOutcome.totalMultiplier.toFixed(2)}x · +
                  {formatBirr(lastOutcome.payoutBirr)}
                </div>
              </>
            ) : lastOutcome ? (
              <span className="text-slate-400">
                {lastOutcome.wasFreeSpin
                  ? `Free spin finished — ${activeFreeSpinsRemaining} free spins remaining.`
                  : 'No match this spin — mid-game Free Spins or Vault Bonus can drop any spin!'}
              </span>
            ) : (
              <span className="text-slate-300">
                Pick Birr stake & press <strong>Spin</strong>, or trigger <strong>Free Spins & Bonus Game</strong>!
              </span>
            )}
          </div>

          {/* Pinned Bottom Stake & Spin Dock (Always visible simultaneously with reels!) */}
          <div className="shrink-0 rounded-xl bg-[#0B0E1C] border border-white/10 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-300 hidden sm:inline shrink-0" />
              {PRESET_STAKES.filter((s) => s >= minStake).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isSpinning || autoRemaining > 0 || activeFreeSpinsRemaining > 0}
                  onClick={() => setStakeBirr(amt)}
                  className={`min-h-[34px] px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold tabular-nums cursor-pointer disabled:opacity-50 ${
                    stakeBirr === amt
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#161B31] hover:bg-[#1E2544] text-slate-200 border border-white/10'
                  }`}
                >
                  {amt}
                </button>
              ))}
              <input
                type="number"
                min={minStake}
                max={100000}
                step={0.1}
                value={stakeBirr}
                disabled={isSpinning || autoRemaining > 0 || activeFreeSpinsRemaining > 0}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const rounded = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : minStake;
                  setStakeBirr(Math.max(minStake, rounded));
                }}
                aria-label="Custom Slot Birr Stake"
                className="w-16 sm:w-20 min-h-[34px] px-2 py-1 rounded-lg bg-[#070913] border border-white/15 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center gap-1 pl-1 border-l border-white/10">
                <Repeat className="w-3 h-3 text-slate-400 hidden sm:inline" />
                {autoRemaining > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAutoRemaining(0)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer tabular-nums"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Stop ({autoRemaining})</span>
                  </button>
                ) : (
                  AUTO_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={isSpinning || (Boolean(currentUser) && insufficient)}
                      onClick={() => {
                        setAutoRemaining(count - 1);
                        void handleSpin(!currentUser);
                      }}
                      className="min-h-[34px] px-2 py-1 rounded-lg bg-[#161B31] hover:bg-[#1E2544] disabled:opacity-45 border border-white/10 text-slate-300 text-[11px] font-semibold tabular-nums cursor-pointer"
                    >
                      {count}x
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Primary SPIN / FREE SPIN Action Button */}
            <div className="flex items-center gap-2 ml-auto">
              {!currentUser ? (
                <>
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => void handleSpin(true)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeFreeSpinsRemaining > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 text-white'
                        : 'bg-[#181E38] hover:bg-[#222B4E] border-white/15 text-slate-100'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {isSpinning
                        ? 'Spinning...'
                        : activeFreeSpinsRemaining > 0
                          ? `FREE SPIN (${activeFreeSpinsRemaining})`
                          : 'Demo Spin'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onPromptSignIn}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </>
              ) : insufficient ? (
                <button
                  type="button"
                  onClick={onPromptDeposit}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>
                    Deposit ({formatBirr(stakeBirr - currentUser.balanceBirr)})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => void handleSpin(false)}
                  className={`min-h-[44px] sm:min-h-[46px] px-6 sm:px-7 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-55 tabular-nums shadow-lg transition-colors ${
                    activeFreeSpinsRemaining > 0
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-950/60'
                      : theme.spinBtn
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isSpinning
                      ? 'Spinning...'
                      : activeFreeSpinsRemaining > 0
                        ? `FREE SPIN (0 Birr · ${activeFreeSpinsRemaining} left)`
                        : `Spin (${formatBirr(stakeBirr)})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="shrink-0 rounded-lg bg-rose-500/10 border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-300" />
              <span className="truncate">{error}</span>
            </div>
          )}
        </div>

        {/* Desktop Right Paytable Sidebar */}
        <div className="hidden lg:flex lg:col-span-3 flex-col min-h-0 h-full rounded-2xl bg-[#0F1324] border border-white/10 p-4 overflow-y-auto">
          {paytableContent}
        </div>
      </div>

      {/* Interactive 6-Vault Pick-a-Chest Bonus Game Modal (Slots Only) */}
      {activeBonusModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#17122B] to-[#0B0E1D] border-2 border-amber-400/45 p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-base sm:text-lg font-display font-bold text-white">
                    Bonus Game: Pick 3 Luxury Vaults
                  </h3>
                  <p className="text-xs text-slate-300">
                    Base Stake {formatBirr(activeBonusModal.stakeBirr)} · Picks left:{' '}
                    <strong className="text-amber-300">
                      {Math.max(0, activeBonusModal.maxPicks - activeBonusModal.pickedIndices.length)}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-[10px] text-slate-400 uppercase">Total Prize</div>
                <div className="text-lg font-mono font-black text-emerald-300">
                  {activeBonusModal.totalMultiplier.toFixed(1)}x
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {activeBonusModal.vaults.map((vault) => {
                const isPicked = activeBonusModal.pickedIndices.includes(vault.index);
                const isRevealed = vault.revealed;
                return (
                  <button
                    key={vault.index}
                    type="button"
                    disabled={
                      bonusPickBusy ||
                      activeBonusModal.status !== 'active' ||
                      isPicked
                    }
                    onClick={() => void handlePickVault(vault.index)}
                    className={`min-h-[96px] rounded-xl border-2 p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-default ${
                      isPicked
                        ? 'bg-gradient-to-b from-amber-500/25 to-emerald-500/20 border-amber-400 text-white scale-[1.02]'
                        : isRevealed
                          ? 'bg-[#0F1429] border-white/15 text-slate-400 opacity-75'
                          : 'bg-[#151B35] hover:bg-[#1D2548] border-amber-400/35 text-amber-200 hover:scale-[1.03]'
                    }`}
                  >
                    {isRevealed ? (
                      <>
                        <Unlock className="w-5 h-5 text-amber-300" />
                        <span className="text-xs sm:text-sm font-mono font-black text-center leading-tight">
                          {vault.label}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-6 h-6 text-amber-300" />
                        <span className="text-[11px] font-semibold">Vault #{vault.index + 1}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {activeBonusModal.status === 'claimed' ? (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/45 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-emerald-100">
                  Won{' '}
                  <strong className="font-mono text-amber-300">
                    {formatBirr(activeBonusModal.payoutBirr)}
                  </strong>
                  {activeBonusModal.freeSpinsAwarded > 0 && (
                    <span> + {activeBonusModal.freeSpinsAwarded} Free Spins!</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocalBonusModal(null);
                    setDemoBonusSession(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Collect & Continue
                </button>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400">
                Select {activeBonusModal.maxPicks - activeBonusModal.pickedIndices.length} more vault
                {activeBonusModal.maxPicks - activeBonusModal.pickedIndices.length === 1 ? '' : 's'} to win Birr multipliers or +5 Free Spins!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Paytable Drawer Overlay */}
      {paytableOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 lg:hidden"
          onClick={() => setPaytableOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[82vh] overflow-y-auto rounded-2xl bg-[#0F1324] border border-white/15 p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold text-white">
                {game.title}
              </span>
              <button
                type="button"
                onClick={() => setPaytableOpen(false)}
                className="p-1.5 rounded-lg bg-[#171D35] text-slate-300 cursor-pointer"
                aria-label="Close paytable"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {paytableContent}
          </div>
        </div>
      )}
    </div>
  );
}
