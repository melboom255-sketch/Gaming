import { useState } from 'react';
import tictactoeImg from '../../assets/images/game_thumb_tictactoe_1794567334709.jpg';
import memoryImg from '../../assets/images/game_thumb_memory_1794567335416.jpg';
import snakeImg from '../../assets/images/game_thumb_snake_1794567336244.jpg';
import triviaImg from '../../assets/images/game_thumb_trivia_1794567336736.jpg';
import gebetaImg from '../../assets/images/game_thumb_gebeta_1794582386683.jpg';
import minesImg from '../../assets/images/game_thumb_mines_1794582387190.jpg';
import kenoImg from '../../assets/images/game_thumb_keno_1794582579464.jpg';
import bingoImg from '../../assets/images/game_thumb_bingo_1794582579090.jpg';
import fruitslotImg from '../../assets/images/game_thumb_fruitslot_1794658063191.jpg';
import hot7spinImg from '../../assets/images/game_thumb_hot7spin_1794658063309.jpg';
import axumMegawaysImg from '../../assets/images/game_thumb_axum_megaways_1794658967688.jpg';
import cosmicMegawaysImg from '../../assets/images/game_thumb_cosmic_megaways_1794658968271.jpg';
import safariSpinImg from '../../assets/images/game_thumb_safari_spin_1794658968308.jpg';
import pharaohSpinImg from '../../assets/images/game_thumb_pharaoh_spin_1794658969139.jpg';
import candySpinImg from '../../assets/images/game_thumb_candy_spin_1794658968518.jpg';

// 10 New Slots
import spyMissionSpinImg from '../../assets/images/game_thumb_spy_mission_spin_1794752174574.jpg';
import hotInferno777Img from '../../assets/images/game_thumb_hot_inferno_777_1794752176026.jpg';
import vikingsValhallaImg from '../../assets/images/game_thumb_vikings_valhalla_spin_1794752176130.jpg';
import dragonFortuneImg from '../../assets/images/game_thumb_dragon_fortune_spin_1794752176453.jpg';
import wildWestBountyImg from '../../assets/images/game_thumb_wild_west_bounty_1794752176177.jpg';
import pirateTreasureMegawaysImg from '../../assets/images/game_thumb_pirate_treasure_megaways_1794752177783.jpg';
import zeusOlympusMegawaysImg from '../../assets/images/game_thumb_zeus_olympus_megaways_1794752177776.jpg';
import neonVegasNightsImg from '../../assets/images/game_thumb_neon_vegas_nights_1794752178269.jpg';
import emeraldLeprechaunImg from '../../assets/images/game_thumb_emerald_leprechaun_spin_1794752178395.jpg';
import gladiatorArenaMegawaysImg from '../../assets/images/game_thumb_gladiator_arena_megaways_1794752179167.jpg';

// 10 New Skill Games
import diceDuelImg from '../../assets/images/game_thumb_dice_duel_1794752180226.jpg';
import crashRocketImg from '../../assets/images/game_thumb_crash_rocket_1794752179558.jpg';
import plinkoDropImg from '../../assets/images/game_thumb_plinko_drop_1794752180223.jpg';
import towerClimbImg from '../../assets/images/game_thumb_tower_climb_1794752180848.jpg';
import coinFlipStreakImg from '../../assets/images/game_thumb_coin_flip_streak_1794752182102.jpg';
import colorWheelImg from '../../assets/images/game_thumb_color_wheel_1794752247166.jpg';
import wordScrambleImg from '../../assets/images/game_thumb_word_scramble_1794752247174.jpg';
import reactionReflexImg from '../../assets/images/game_thumb_reaction_reflex_1794752248180.jpg';
import blackjack21Img from '../../assets/images/game_thumb_blackjack_21_1794752247922.jpg';
import penaltyKickImg from '../../assets/images/game_thumb_penalty_kick_1794752276198.jpg';

// Curated HD Casino Symbol & Table Artwork (reused for extra provider titles to preserve fast <10 MB bundle)
import royalCrownImg from '../../assets/images/sym_royal_crown_1794751393071.jpg';
import obeliskGoldImg from '../../assets/images/sym_obelisk_1794751392488.jpg';
import pharaohWildImg from '../../assets/images/sym_pharaoh_wild_1794751374710.jpg';
import royalCardsImg from '../../assets/images/sym_royal_cards_1794752324870.jpg';
import vipWildImg from '../../assets/images/sym_vip_wild_1794752324371.jpg';
import diamond777Img from '../../assets/images/sym_diamond_1794751354783.jpg';
import watermelonFruitImg from '../../assets/images/sym_watermelon_1794751351937.jpg';
import goldIngotImg from '../../assets/images/sym_gold_ingot_1794752277004.jpg';
import rubyHeartImg from '../../assets/images/sym_ruby_heart_1794752276475.jpg';
import moltenBellImg from '../../assets/images/sym_molten_bell_1794752251473.jpg';
import koiFishImg from '../../assets/images/sym_koi_fish_1794752283134.jpg';
import treasureChestImg from '../../assets/images/sym_treasure_chest_1794752302577.jpg';
import plasmaGemImg from '../../assets/images/sym_plasma_1794751413180.jpg';
import infernoWildImg from '../../assets/images/sym_inferno_wild_1794752250481.jpg';
import thorHammerImg from '../../assets/images/sym_thor_hammer_1794752279965.jpg';
import spyBriefcaseImg from '../../assets/images/sym_spy_briefcase_1794752249522.jpg';
import dynamiteGoldImg from '../../assets/images/sym_dynamite_1794752299323.jpg';
import goldCoinVaultImg from '../../assets/images/sym_gold_coin_1794751412384.jpg';
import flameDiceImg from '../../assets/images/sym_flame_dice_1794752251488.jpg';
import spyPistolImg from '../../assets/images/sym_spy_pistol_1794752248417.jpg';
import sportsCarJetImg from '../../assets/images/sym_sports_car_1794752326476.jpg';
import nebulaWildImg from '../../assets/images/sym_nebula_wild_1794751412896.jpg';
import goldenChaliceImg from '../../assets/images/sym_golden_chalice_1794752323342.jpg';
import dragonWildImg from '../../assets/images/sym_dragon_wild_1794752280497.jpg';
import lightningRingImg from '../../assets/images/sym_lightning_ring_1794752322392.jpg';
import emeraldScarabImg from '../../assets/images/sym_emerald_scarab_1794751411840.jpg';
import amberGemImg from '../../assets/images/sym_amber_gem_1794751412100.jpg';
import jadeTigerImg from '../../assets/images/sym_jade_tiger_1794752281239.jpg';
import rouletteWheelImg from '../../assets/images/sym_roulette_wheel_1794752324168.jpg';
import redLanternImg from '../../assets/images/sym_red_lantern_1794752281250.jpg';

import type { GameEngine, GameProviderId } from '@/src/types/platform';
import { ProviderTag } from '@/src/components/common/ProviderBadge';
import {
  Anchor,
  Bomb,
  Brain,
  Candy,
  Castle,
  Cherry,
  CircleDot,
  Clover,
  Coins,
  Compass,
  Crown,
  Dices,
  Disc,
  Eye,
  Flame,
  Gamepad2,
  Gauge,
  Gem,
  Grid2X2,
  Grid3X3,
  Hash,
  HelpCircle,
  KeyRound,
  Rocket,
  Scissors,
  Shield,
  Spade,
  Sparkles,
  Sun,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

const GAME_THUMBNAILS: Record<GameEngine, string> = {
  tictactoe: tictactoeImg,
  memory: memoryImg,
  snake: snakeImg,
  trivia: triviaImg,
  gebeta: gebetaImg,
  mines: minesImg,
  keno: kenoImg,
  bingo: bingoImg,
  fruitslot: fruitslotImg,
  hot7spin: hot7spinImg,
  safari_spin: safariSpinImg,
  pharaoh_spin: pharaohSpinImg,
  candy_spin: candySpinImg,
  abyssinia_megaways: axumMegawaysImg,
  cosmic_megaways: cosmicMegawaysImg,
  spy_mission_spin: spyMissionSpinImg,
  hot_inferno_777: hotInferno777Img,
  vikings_valhalla_spin: vikingsValhallaImg,
  dragon_fortune_spin: dragonFortuneImg,
  wild_west_bounty: wildWestBountyImg,
  pirate_treasure_megaways: pirateTreasureMegawaysImg,
  zeus_olympus_megaways: zeusOlympusMegawaysImg,
  neon_vegas_nights: neonVegasNightsImg,
  emerald_leprechaun_spin: emeraldLeprechaunImg,
  gladiator_arena_megaways: gladiatorArenaMegawaysImg,
  dice_duel: diceDuelImg,
  crash_rocket: crashRocketImg,
  plinko_drop: plinkoDropImg,
  tower_climb: towerClimbImg,
  coin_flip_streak: coinFlipStreakImg,
  penalty_kick: penaltyKickImg,
  color_wheel: colorWheelImg,
  word_scramble: wordScrambleImg,
  reaction_reflex: reactionReflexImg,
  blackjack_21: blackjack21Img,
  // 30 Extra Provider Titles
  sheba_crown_megaways: royalCrownImg,
  lalibela_gold_megaways: obeliskGoldImg,
  abay_nile_riches: pharaohWildImg,
  royal_baccarat: royalCardsImg,
  hilo_card_streak: vipWildImg,
  blazing_diamond_777: diamond777Img,
  tropical_berry_frenzy: watermelonFruitImg,
  royal_gold_bullion: goldIngotImg,
  ruby_starlight_777: rubyHeartImg,
  golden_bell_jackpot: moltenBellImg,
  samurai_blade_megaways: koiFishImg,
  atlantis_kraken_megaways: treasureChestImg,
  cyberpunk_matrix_megaways: plasmaGemImg,
  volcano_eruption_megaways: infernoWildImg,
  valhalla_storm_megaways: thorHammerImg,
  cyber_heist_spin: spyBriefcaseImg,
  outlaw_gold_train: dynamiteGoldImg,
  scratch_vault: goldCoinVaultImg,
  limbo_multiplier: flameDiceImg,
  bomb_defusal: spyPistolImg,
  aviator_jetx: sportsCarJetImg,
  cyber_limbo: nebulaWildImg,
  blitz_hilo: goldenChaliceImg,
  dragon_tiger_live: dragonWildImg,
  rps_duel_streak: lightningRingImg,
  arabian_genie_spin: emeraldScarabImg,
  aztec_sun_spin: amberGemImg,
  imperial_panda_spin: redLanternImg,
  european_roulette: rouletteWheelImg,
  imperial_dragon_tiger: jadeTigerImg,
};

function getFallbackIcon(engine: GameEngine) {
  switch (engine) {
    case 'tictactoe':
      return Grid3X3;
    case 'memory':
      return Brain;
    case 'trivia':
      return HelpCircle;
    case 'gebeta':
      return CircleDot;
    case 'mines':
    case 'bomb_defusal':
      return Bomb;
    case 'keno':
      return Hash;
    case 'bingo':
      return Grid2X2;
    case 'fruitslot':
    case 'tropical_berry_frenzy':
      return Cherry;
    case 'hot7spin':
    case 'hot_inferno_777':
    case 'volcano_eruption_megaways':
    case 'dragon_tiger_live':
    case 'imperial_dragon_tiger':
      return Flame;
    case 'abyssinia_megaways':
    case 'dragon_fortune_spin':
    case 'sheba_crown_megaways':
    case 'royal_baccarat':
      return Crown;
    case 'cosmic_megaways':
    case 'neon_vegas_nights':
    case 'ruby_starlight_777':
    case 'arabian_genie_spin':
      return Sparkles;
    case 'safari_spin':
    case 'aztec_sun_spin':
      return Sun;
    case 'pharaoh_spin':
    case 'lalibela_gold_megaways':
    case 'abay_nile_riches':
      return Compass;
    case 'candy_spin':
      return Candy;
    case 'spy_mission_spin':
    case 'cyber_heist_spin':
      return Eye;
    case 'vikings_valhalla_spin':
    case 'gladiator_arena_megaways':
    case 'samurai_blade_megaways':
    case 'valhalla_storm_megaways':
      return Swords;
    case 'wild_west_bounty':
    case 'outlaw_gold_train':
      return Target;
    case 'pirate_treasure_megaways':
    case 'atlantis_kraken_megaways':
      return Anchor;
    case 'zeus_olympus_megaways':
    case 'reaction_reflex':
    case 'cyberpunk_matrix_megaways':
      return Zap;
    case 'emerald_leprechaun_spin':
      return Clover;
    case 'dice_duel':
      return Dices;
    case 'crash_rocket':
    case 'aviator_jetx':
      return Rocket;
    case 'plinko_drop':
    case 'royal_gold_bullion':
    case 'golden_bell_jackpot':
      return Coins;
    case 'tower_climb':
      return Castle;
    case 'coin_flip_streak':
    case 'imperial_panda_spin':
      return Shield;
    case 'penalty_kick':
      return Trophy;
    case 'color_wheel':
      return CircleDot;
    case 'word_scramble':
      return KeyRound;
    case 'blackjack_21':
    case 'hilo_card_streak':
    case 'blitz_hilo':
      return Spade;
    case 'blazing_diamond_777':
    case 'scratch_vault':
      return Gem;
    case 'limbo_multiplier':
    case 'cyber_limbo':
      return Gauge;
    case 'european_roulette':
      return Disc;
    case 'rps_duel_streak':
      return Scissors;
    default:
      return Gamepad2;
  }
}

interface GameArtworkProps {
  engine: GameEngine;
  title: string;
  providerId?: GameProviderId;
  showProviderBadge?: boolean;
  className?: string;
}

export function GameArtwork({
  engine,
  title,
  providerId,
  showProviderBadge = false,
  className = '',
}: GameArtworkProps) {
  const [failed, setFailed] = useState(false);
  const src = GAME_THUMBNAILS[engine];

  if (failed || !src) {
    const FallbackIcon = getFallbackIcon(engine);
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#161B36] via-[#1B1438] to-[#0D1326] flex flex-col items-center justify-center p-4 ${className}`}
      >
        <FallbackIcon className="w-12 h-12 text-amber-300/85 mb-2" />
        <span className="text-xs font-medium text-slate-200 text-center truncate max-w-full">
          {title}
        </span>
        {showProviderBadge && providerId && (
          <div className="absolute top-2.5 left-2.5">
            <ProviderTag providerId={providerId} compact />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080B16]">
      <img
        src={src}
        alt={title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`object-cover object-center w-full h-full contrast-[1.06] saturate-[1.08] brightness-[1.02] ${className}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070912]/80 via-transparent to-[#070912]/20" />
      {showProviderBadge && providerId && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <ProviderTag providerId={providerId} compact />
        </div>
      )}
    </div>
  );
}
