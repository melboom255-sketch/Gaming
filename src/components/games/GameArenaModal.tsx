import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';
import { ProviderSplashScreen, ProviderTag } from '@/src/components/common/ProviderBadge';
import { BaccaratGame } from '@/src/components/games/BaccaratGame';
import { BingoGame } from '@/src/components/games/BingoGame';
import { BlackjackGame } from '@/src/components/games/BlackjackGame';
import { BombDefusalGame } from '@/src/components/games/BombDefusalGame';
import { CoinFlipStreakGame } from '@/src/components/games/CoinFlipStreakGame';
import { ColorWheelGame } from '@/src/components/games/ColorWheelGame';
import { CrashRocketGame } from '@/src/components/games/CrashRocketGame';
import { DiceDuelGame } from '@/src/components/games/DiceDuelGame';
import { DragonTigerGame } from '@/src/components/games/DragonTigerGame';
import { GebetaGame } from '@/src/components/games/GebetaGame';
import { HiLoCardGame } from '@/src/components/games/HiLoCardGame';
import { KenoGame } from '@/src/components/games/KenoGame';
import { LimboGame } from '@/src/components/games/LimboGame';
import { MemoryMatchGame } from '@/src/components/games/MemoryMatchGame';
import { MinesGame } from '@/src/components/games/MinesGame';
import { PenaltyKickGame } from '@/src/components/games/PenaltyKickGame';
import { PlinkoDropGame } from '@/src/components/games/PlinkoDropGame';
import { ReactionReflexGame } from '@/src/components/games/ReactionReflexGame';
import { RockPaperScissorsGame } from '@/src/components/games/RockPaperScissorsGame';
import { RouletteGame } from '@/src/components/games/RouletteGame';
import { ScratchVaultGame } from '@/src/components/games/ScratchVaultGame';
import { SlotMachineGame } from '@/src/components/games/SlotMachineGame';
import { SnakeGame } from '@/src/components/games/SnakeGame';
import { TicTacToeGame } from '@/src/components/games/TicTacToeGame';
import { TowerClimbGame } from '@/src/components/games/TowerClimbGame';
import { TriviaQuizGame } from '@/src/components/games/TriviaQuizGame';
import { WordScrambleGame } from '@/src/components/games/WordScrambleGame';
import { formatBirr } from '@/src/services/platformService';
import type {
  GameCatalogItem,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import { isSoundEnabled, setSoundEnabled } from '@/src/utils/sound';
import {
  ArrowLeft,
  Gamepad2,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface GameArenaModalProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  snapshot?: PlatformSnapshot | null;
  onClose: () => void;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

const SLOT_ENGINES = new Set([
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
]);

const KNOWN_ENGINES = new Set([
  'tictactoe',
  'memory',
  'snake',
  'trivia',
  'gebeta',
  'mines',
  'keno',
  'bingo',
  'dice_duel',
  'crash_rocket',
  'aviator_jetx',
  'plinko_drop',
  'tower_climb',
  'coin_flip_streak',
  'penalty_kick',
  'color_wheel',
  'word_scramble',
  'reaction_reflex',
  'blackjack_21',
  'royal_baccarat',
  'hilo_card_streak',
  'blitz_hilo',
  'scratch_vault',
  'limbo_multiplier',
  'cyber_limbo',
  'bomb_defusal',
  'dragon_tiger_live',
  'imperial_dragon_tiger',
  'rps_duel_streak',
  'european_roulette',
  ...SLOT_ENGINES,
]);

export function GameArenaModal({
  game,
  currentUser,
  snapshot,
  onClose,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: GameArenaModalProps) {
  const [muted, setMuted] = useState(!isSoundEnabled());
  const [splashDone, setSplashDone] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const arenaRef = useRef<HTMLDivElement | null>(null);

  const engine = String(game?.engine || '').toLowerCase().trim();
  const isSlot = SLOT_ENGINES.has(engine);
  const safeTitle = game?.title || 'Arcade Arena';
  const safeCategory = game?.category || 'Arcade';
  const safeProviderId = game?.providerId || 'axum_studios';

  useEffect(() => {
    setSplashDone(false);
  }, [game?.id]);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleSound = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    setSoundEnabled(!nextMuted);
  };

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        const target = arenaRef.current || document.documentElement;
        target?.requestFullscreen?.().catch(() => {});
      }
    } catch {
      // Sandboxed iframes may disallow the Fullscreen API; layout remains full-viewport
    }
  };

  const handleExitArena = () => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {
      // ignore
    }
    onClose();
  };

  const sharedProps = {
    game,
    currentUser,
    onSnapshotSync,
    onPromptSignIn,
    onPromptDeposit,
  };

  return (
    <div
      ref={arenaRef}
      className={`fixed inset-0 z-50 w-screen h-[100dvh] bg-[#070912] flex flex-col ${
        isSlot ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`${safeTitle} Game Arena`}
    >
      {/* Sleek Single-Row Full-Width Arena Top Bar */}
      <div className="sticky top-0 z-30 shrink-0 w-full bg-[#070912]/95 backdrop-blur-md border-b border-white/10 px-2.5 sm:px-6 py-1.5 sm:py-2">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExitArena}
            className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-[#111528] hover:bg-[#19203B] border border-white/10 text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Back</span>
            <span className="hidden md:inline">to Arcade</span>
          </button>

          <div className="text-center min-w-0 flex-1 px-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xs sm:text-base font-display font-bold text-white truncate">
                {safeTitle}
              </h2>
              <span className="hidden md:inline-flex">
                <ProviderTag providerId={safeProviderId} compact />
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden sm:block">
              {game?.provider || 'Axum Studios'} · {safeCategory} · Min {game.minStakeBirr || 0.1} ETB · Up to {game.maxMultiplier}x
              {game.bonusBirr > 0 ? ` · +${formatBirr(game.bonusBirr)} Bonus` : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={onPromptDeposit}
                className="text-right tabular-nums px-2.5 sm:px-3 py-1 rounded-xl bg-[#111528] hover:bg-[#19203B] border border-white/10 cursor-pointer"
              >
                <div className="text-[9px] sm:text-[10px] text-slate-400 leading-none">
                  Balance
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-amber-300 leading-tight">
                  {formatBirr(currentUser.balanceBirr)}
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPromptSignIn}
                className="min-h-[38px] px-2.5 sm:px-3 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-400/30 text-violet-200 text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
              className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-xl bg-[#111528] hover:bg-[#19203B] border border-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isNativeFullscreen ? 'Exit browser fullscreen' : 'Enter browser fullscreen'}
              title={isNativeFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] rounded-xl bg-[#111528] hover:bg-[#19203B] border border-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              {isNativeFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Active Game Stage */}
      <div
        className={`flex-1 min-h-0 w-full flex flex-col ${
          isSlot
            ? 'overflow-hidden px-2 sm:px-5 lg:px-8 py-1.5 sm:py-2.5'
            : 'px-3 sm:px-6 lg:px-10 py-3 sm:py-5 justify-center'
        }`}
      >
        <ErrorBoundary
          resetKey={`${game?.id || safeSlugCheck(game)}:${engine}`}
          fallbackTitle={`Unable to load ${safeTitle}`}
        >
          {engine === 'tictactoe' && <TicTacToeGame {...sharedProps} />}
          {engine === 'memory' && <MemoryMatchGame {...sharedProps} />}
          {engine === 'snake' && <SnakeGame {...sharedProps} />}
          {engine === 'trivia' && <TriviaQuizGame {...sharedProps} />}
          {engine === 'gebeta' && <GebetaGame {...sharedProps} />}
          {engine === 'mines' && <MinesGame {...sharedProps} />}
          {engine === 'keno' && <KenoGame {...sharedProps} />}
          {engine === 'bingo' && <BingoGame {...sharedProps} />}
          {engine === 'dice_duel' && <DiceDuelGame {...sharedProps} />}
          {(engine === 'crash_rocket' || engine === 'aviator_jetx') && (
            <CrashRocketGame {...sharedProps} />
          )}
          {engine === 'plinko_drop' && <PlinkoDropGame {...sharedProps} />}
          {engine === 'tower_climb' && <TowerClimbGame {...sharedProps} />}
          {engine === 'coin_flip_streak' && <CoinFlipStreakGame {...sharedProps} />}
          {engine === 'penalty_kick' && <PenaltyKickGame {...sharedProps} />}
          {engine === 'color_wheel' && <ColorWheelGame {...sharedProps} />}
          {engine === 'word_scramble' && <WordScrambleGame {...sharedProps} />}
          {engine === 'reaction_reflex' && <ReactionReflexGame {...sharedProps} />}
          {engine === 'blackjack_21' && <BlackjackGame {...sharedProps} />}
          {engine === 'royal_baccarat' && <BaccaratGame {...sharedProps} />}
          {(engine === 'hilo_card_streak' || engine === 'blitz_hilo') && (
            <HiLoCardGame {...sharedProps} />
          )}
          {engine === 'scratch_vault' && <ScratchVaultGame {...sharedProps} />}
          {(engine === 'limbo_multiplier' || engine === 'cyber_limbo') && (
            <LimboGame {...sharedProps} />
          )}
          {engine === 'bomb_defusal' && <BombDefusalGame {...sharedProps} />}
          {(engine === 'dragon_tiger_live' || engine === 'imperial_dragon_tiger') && (
            <DragonTigerGame {...sharedProps} />
          )}
          {engine === 'rps_duel_streak' && <RockPaperScissorsGame {...sharedProps} />}
          {engine === 'european_roulette' && <RouletteGame {...sharedProps} />}
          {isSlot && <SlotMachineGame {...sharedProps} snapshot={snapshot} />}
          {!KNOWN_ENGINES.has(engine) && (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-8 text-center max-w-md mx-auto my-auto space-y-3">
              <Gamepad2 className="w-9 h-9 text-amber-300 mx-auto" />
              <div className="text-base font-display font-bold text-white">
                Game Engine Unavailable
              </div>
              <p className="text-xs text-slate-400">
                Unrecognized engine &quot;{String(game.engine)}&quot; for {game.title}.
              </p>
            </div>
          )}
        </ErrorBoundary>
      </div>

      {!splashDone && (
        <ProviderSplashScreen
          providerId={safeProviderId}
          gameTitle={safeTitle}
          gameCategory={safeCategory}
          onComplete={handleSplashComplete}
        />
      )}
    </div>
  );
}

function safeSlugCheck(game: GameCatalogItem | null | undefined): string {
  return game?.slug || 'arena';
}
