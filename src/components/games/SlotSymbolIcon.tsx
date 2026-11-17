import { useState } from 'react';
import type { SlotSymbolId } from '@/src/types/platform';

import symCherryImg from '../../assets/images/sym_cherry_1794751351473.jpg';
import symLemonImg from '../../assets/images/sym_lemon_1794751350821.jpg';
import symOrangeImg from '../../assets/images/sym_orange_1794751351993.jpg';
import symGrapesImg from '../../assets/images/sym_grapes_1794751351892.jpg';
import symWatermelonImg from '../../assets/images/sym_watermelon_1794751351937.jpg';
import symBellImg from '../../assets/images/sym_bell_1794751352721.jpg';
import symStarImg from '../../assets/images/sym_star_1794751353778.jpg';

import symBar1Img from '../../assets/images/sym_bar1_1794751354112.jpg';
import symBar2Img from '../../assets/images/sym_bar2_1794751353609.jpg';
import symDiamondImg from '../../assets/images/sym_diamond_1794751354783.jpg';
import symSevenImg from '../../assets/images/sym_seven_1794751354661.jpg';
import symDouble7Img from '../../assets/images/sym_double7_1794751355061.jpg';
import symTriple7Img from '../../assets/images/sym_triple7_1794751355818.jpg';

import symLionWildImg from '../../assets/images/sym_lion_wild_1794751370656.jpg';
import symElephantImg from '../../assets/images/sym_elephant_1794751369644.jpg';
import symRhinoImg from '../../assets/images/sym_rhino_1794751372221.jpg';
import symZebraImg from '../../assets/images/sym_zebra_1794751371359.jpg';
import symAcaciaImg from '../../assets/images/sym_acacia_1794751371889.jpg';
import symShieldImg from '../../assets/images/sym_shield_1794751372813.jpg';

import symPharaohWildImg from '../../assets/images/sym_pharaoh_wild_1794751374710.jpg';
import symSphinxImg from '../../assets/images/sym_sphinx_1794751373025.jpg';
import symScarabImg from '../../assets/images/sym_scarab_1794751373553.jpg';
import symHorusImg from '../../assets/images/sym_horus_1794751374395.jpg';
import symAnkhImg from '../../assets/images/sym_ankh_1794751374328.jpg';
import symLotusImg from '../../assets/images/sym_lotus_1794751375382.jpg';

import symCandyWildImg from '../../assets/images/sym_candy_wild_1794751390008.jpg';
import symLollipopImg from '../../assets/images/sym_lollipop_1794751389925.jpg';
import symCupcakeImg from '../../assets/images/sym_cupcake_1794751389949.jpg';
import symCandyStarImg from '../../assets/images/sym_candystar_1794751390845.jpg';
import symDonutImg from '../../assets/images/sym_donut_1794751391799.jpg';
import symGummyImg from '../../assets/images/sym_gummy_1794751391791.jpg';

import symAxumWildImg from '../../assets/images/sym_axum_wild_v2_1794751410825.jpg';
import symObeliskImg from '../../assets/images/sym_obelisk_1794751392488.jpg';
import symRoyalCrownImg from '../../assets/images/sym_royal_crown_1794751393071.jpg';
import symEmeraldScarabImg from '../../assets/images/sym_emerald_scarab_1794751411840.jpg';
import symAmberGemImg from '../../assets/images/sym_amber_gem_1794751412100.jpg';
import symGoldCoinImg from '../../assets/images/sym_gold_coin_1794751412384.jpg';

import symNebulaWildImg from '../../assets/images/sym_nebula_wild_1794751412896.jpg';
import symPlasmaImg from '../../assets/images/sym_plasma_1794751413180.jpg';
import symSapphireImg from '../../assets/images/sym_sapphire_1794751413803.jpg';
import symAmethystImg from '../../assets/images/sym_amethyst_1794751413434.jpg';
import symEmeraldGemImg from '../../assets/images/sym_emerald_gem_1794751413925.jpg';
import symOpalImg from '../../assets/images/sym_opal_1794751415203.jpg';

// Spy Mission Spin
import symSpyWildImg from '../../assets/images/sym_spy_wild_1794752247544.jpg';
import symSpyCarImg from '../../assets/images/sym_spy_car_1794752248754.jpg';
import symSpyBriefcaseImg from '../../assets/images/sym_spy_briefcase_1794752249522.jpg';
import symSpyPistolImg from '../../assets/images/sym_spy_pistol_1794752248417.jpg';
import symSpyWatchImg from '../../assets/images/sym_spy_watch_1794752249510.jpg';
import symSpyPassportImg from '../../assets/images/sym_spy_passport_1794752249899.jpg';

// Hot Inferno 777
import symInfernoWildImg from '../../assets/images/sym_inferno_wild_1794752250481.jpg';
import symInferno777Img from '../../assets/images/sym_inferno_777_1794752250129.jpg';
import symMoltenBellImg from '../../assets/images/sym_molten_bell_1794752251473.jpg';
import symFlameDiceImg from '../../assets/images/sym_flame_dice_1794752251488.jpg';
import symRubyHeartImg from '../../assets/images/sym_ruby_heart_1794752276475.jpg';
import symGoldIngotImg from '../../assets/images/sym_gold_ingot_1794752277004.jpg';

// Vikings Valhalla Spin
import symVikingWildImg from '../../assets/images/sym_viking_wild_1794752277540.jpg';
import symVikingHelmImg from '../../assets/images/sym_viking_helm_1794752278076.jpg';
import symBattleAxeImg from '../../assets/images/sym_battle_axe_1794752278227.jpg';
import symLongshipImg from '../../assets/images/sym_longship_1794752278774.jpg';
import symThorHammerImg from '../../assets/images/sym_thor_hammer_1794752279965.jpg';
import symRunestoneImg from '../../assets/images/sym_runestone_1794752280410.jpg';

// Dragon Fortune Spin
import symDragonWildImg from '../../assets/images/sym_dragon_wild_1794752280497.jpg';
import symJadeTigerImg from '../../assets/images/sym_jade_tiger_1794752281239.jpg';
import symRedLanternImg from '../../assets/images/sym_red_lantern_1794752281250.jpg';
import symKoiFishImg from '../../assets/images/sym_koi_fish_1794752283134.jpg';
import symGoldSyceeImg from '../../assets/images/sym_gold_sycee_1794752282205.jpg';
import symFortuneFanImg from '../../assets/images/sym_fortune_fan_1794752282302.jpg';

// Wild West Bounty
import symSheriffWildImg from '../../assets/images/sym_sheriff_wild_1794752298573.jpg';
import symRevolverImg from '../../assets/images/sym_revolver_1794752298590.jpg';
import symDynamiteImg from '../../assets/images/sym_dynamite_1794752299323.jpg';
import symCowboyHatImg from '../../assets/images/sym_cowboy_hat_1794752299895.jpg';
import symHorseshoeImg from '../../assets/images/sym_horseshoe_1794752300018.jpg';
import symWhiskeyBarrelImg from '../../assets/images/sym_whiskey_barrel_1794752300288.jpg';

// Pirate Treasure Megaways
import symPirateWildImg from '../../assets/images/sym_pirate_wild_1794752301922.jpg';
import symTreasureChestImg from '../../assets/images/sym_treasure_chest_1794752302577.jpg';
import symPirateShipImg from '../../assets/images/sym_pirate_ship_1794752302420.jpg';
import symBrassCompassImg from '../../assets/images/sym_brass_compass_1794752302780.jpg';
import symSpyglassImg from '../../assets/images/sym_spyglass_1794752302150.jpg';
import symRumBottleImg from '../../assets/images/sym_rum_bottle_1794752302980.jpg';

// Zeus Olympus Megaways
import symZeusWildImg from '../../assets/images/sym_zeus_wild_1794752304431.jpg';
import symPegasusImg from '../../assets/images/sym_pegasus_1794752305076.jpg';
import symOlympusTempleImg from '../../assets/images/sym_olympus_temple_1794752304526.jpg';
import symGoldenChaliceImg from '../../assets/images/sym_golden_chalice_1794752323342.jpg';
import symLightningRingImg from '../../assets/images/sym_lightning_ring_1794752322392.jpg';
import symMarbleLyreImg from '../../assets/images/sym_marble_lyre_1794752323677.jpg';

// Neon Vegas Nights
import symVipWildImg from '../../assets/images/sym_vip_wild_1794752324371.jpg';
import symRouletteWheelImg from '../../assets/images/sym_roulette_wheel_1794752324168.jpg';
import symRoyalCardsImg from '../../assets/images/sym_royal_cards_1794752324870.jpg';
import symChampagneImg from '../../assets/images/sym_champagne_1794752325150.jpg';
import symCasinoDiceImg from '../../assets/images/sym_casino_dice_1794752326261.jpg';
import symSportsCarImg from '../../assets/images/sym_sports_car_1794752326476.jpg';

// Emerald Leprechaun Spin
import symCloverWildImg from '../../assets/images/sym_clover_wild_1794752327207.jpg';
import symPotOfGoldImg from '../../assets/images/sym_pot_of_gold_1794752327549.jpg';
import symFourCloverImg from '../../assets/images/sym_four_clover_1794752327820.jpg';
import symGoldenHarpImg from '../../assets/images/sym_golden_harp_1794752328143.jpg';
import symRainbowBootImg from '../../assets/images/sym_rainbow_boot_1794752328408.jpg';
import symEmeraldPintImg from '../../assets/images/sym_emerald_pint_1794752329486.jpg';

// Gladiator Arena Megaways
import symGladiatorWildImg from '../../assets/images/sym_gladiator_wild_1794752346128.jpg';
import symRomanHelmImg from '../../assets/images/sym_roman_helm_1794752346896.jpg';
import symGoldenEagleImg from '../../assets/images/sym_golden_eagle_1794752346072.jpg';
import symWarChariotImg from '../../assets/images/sym_war_chariot_1794752347007.jpg';
import symGladiusShieldImg from '../../assets/images/sym_gladius_shield_1794752347511.jpg';
import symColosseumCoinImg from '../../assets/images/sym_colosseum_coin_1794752347843.jpg';

interface SymbolVisual {
  src: string;
  label: string;
  shortTag: string;
  fallbackGradient: string;
}

const SYMBOL_VISUALS: Record<SlotSymbolId, SymbolVisual> = {
  // Fruit Slot
  cherry: { src: symCherryImg, label: 'Ruby Cherry', shortTag: 'CH', fallbackGradient: 'from-rose-600/80 to-red-900/90' },
  lemon: { src: symLemonImg, label: 'Golden Lemon', shortTag: 'LM', fallbackGradient: 'from-yellow-400/80 to-amber-700/90' },
  orange: { src: symOrangeImg, label: 'Tangerine', shortTag: 'OR', fallbackGradient: 'from-orange-500/80 to-amber-800/90' },
  grapes: { src: symGrapesImg, label: 'Royal Grapes', shortTag: 'GR', fallbackGradient: 'from-purple-500/80 to-indigo-900/90' },
  watermelon: { src: symWatermelonImg, label: 'Watermelon', shortTag: 'WM', fallbackGradient: 'from-emerald-500/80 to-rose-700/90' },
  bell: { src: symBellImg, label: 'Golden Bell', shortTag: 'BL', fallbackGradient: 'from-amber-400/80 to-yellow-800/90' },
  star: { src: symStarImg, label: 'Wild Star', shortTag: 'WILD', fallbackGradient: 'from-amber-300/90 to-orange-700/90' },

  // Hot 7 Spin
  bar1: { src: symBar1Img, label: 'Single BAR', shortTag: 'BAR', fallbackGradient: 'from-slate-500/80 to-slate-800/90' },
  bar2: { src: symBar2Img, label: 'Double BAR', shortTag: '2BAR', fallbackGradient: 'from-violet-600/80 to-purple-900/90' },
  diamond: { src: symDiamondImg, label: 'Crystal Diamond', shortTag: 'DIA', fallbackGradient: 'from-sky-400/80 to-blue-800/90' },
  seven: { src: symSevenImg, label: 'Hot Red 7', shortTag: '7', fallbackGradient: 'from-red-500/80 to-rose-900/90' },
  double7: { src: symDouble7Img, label: 'Blazing 77', shortTag: '77', fallbackGradient: 'from-orange-500/80 to-red-800/90' },
  triple7: { src: symTriple7Img, label: 'Crown 777 Wild', shortTag: '777', fallbackGradient: 'from-amber-400/90 to-rose-800/90' },

  // Serengeti Safari Spin
  lion_wild: { src: symLionWildImg, label: 'Lion Crown Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-400/85 to-orange-800/90' },
  elephant: { src: symElephantImg, label: 'Bull Elephant', shortTag: 'ELP', fallbackGradient: 'from-slate-500/80 to-blue-900/90' },
  rhino: { src: symRhinoImg, label: 'Black Rhino', shortTag: 'RHN', fallbackGradient: 'from-slate-600/80 to-slate-900/90' },
  zebra: { src: symZebraImg, label: 'Savannah Zebra', shortTag: 'ZEB', fallbackGradient: 'from-zinc-400/80 to-slate-800/90' },
  acacia: { src: symAcaciaImg, label: 'Sunset Acacia', shortTag: 'SUN', fallbackGradient: 'from-orange-500/80 to-amber-900/90' },
  shield: { src: symShieldImg, label: 'Tribal Shield', shortTag: 'SHD', fallbackGradient: 'from-red-600/80 to-amber-900/90' },

  // Pharaoh's Scarab Spin
  pharaoh_wild: { src: symPharaohWildImg, label: 'Pharaoh Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-400/85 to-blue-900/90' },
  sphinx: { src: symSphinxImg, label: 'Royal Sphinx', shortTag: 'SPH', fallbackGradient: 'from-amber-500/80 to-yellow-900/90' },
  scarab: { src: symScarabImg, label: 'Golden Scarab', shortTag: 'SCR', fallbackGradient: 'from-emerald-500/80 to-amber-800/90' },
  horus: { src: symHorusImg, label: 'Eye of Horus', shortTag: 'EYE', fallbackGradient: 'from-sky-500/80 to-indigo-900/90' },
  ankh: { src: symAnkhImg, label: 'Golden Ankh', shortTag: 'ANK', fallbackGradient: 'from-yellow-500/80 to-amber-900/90' },
  lotus: { src: symLotusImg, label: 'Nile Lotus', shortTag: 'LOT', fallbackGradient: 'from-purple-500/80 to-indigo-900/90' },

  // Sugar Rush Candy Spin
  candy_wild: { src: symCandyWildImg, label: 'Rainbow Bomb Wild', shortTag: 'WILD', fallbackGradient: 'from-pink-500/85 to-violet-800/90' },
  lollipop: { src: symLollipopImg, label: 'Spiral Pop', shortTag: 'POP', fallbackGradient: 'from-rose-500/80 to-pink-800/90' },
  cupcake: { src: symCupcakeImg, label: 'Berry Cupcake', shortTag: 'CUP', fallbackGradient: 'from-purple-500/80 to-fuchsia-900/90' },
  candystar: { src: symCandyStarImg, label: 'Sugar Star', shortTag: 'STR', fallbackGradient: 'from-yellow-400/80 to-amber-700/90' },
  donut: { src: symDonutImg, label: 'Glazed Donut', shortTag: 'DNT', fallbackGradient: 'from-pink-400/80 to-orange-700/90' },
  gummy: { src: symGummyImg, label: 'Emerald Bear', shortTag: 'GMY', fallbackGradient: 'from-emerald-400/80 to-teal-800/90' },

  // Axum Gold Megaways
  axum_wild: { src: symAxumWildImg, label: 'Axum Lion Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-400/85 to-rose-900/90' },
  obelisk: { src: symObeliskImg, label: 'Axum Obelisk', shortTag: 'AXM', fallbackGradient: 'from-amber-500/80 to-yellow-900/90' },
  royal_crown: { src: symRoyalCrownImg, label: 'Royal Crown', shortTag: 'CRN', fallbackGradient: 'from-red-500/80 to-amber-800/90' },
  emerald_scarab: { src: symEmeraldScarabImg, label: 'Emerald Scarab', shortTag: 'GEM', fallbackGradient: 'from-emerald-500/80 to-green-900/90' },
  amber_gem: { src: symAmberGemImg, label: 'Amber Prism', shortTag: 'AMB', fallbackGradient: 'from-orange-500/80 to-amber-900/90' },
  gold_coin: { src: symGoldCoinImg, label: 'Axum Coin', shortTag: 'BR', fallbackGradient: 'from-yellow-500/80 to-amber-900/90' },

  // Cosmic Gem Megaways
  nebula_wild: { src: symNebulaWildImg, label: 'Nebula Wild', shortTag: 'WILD', fallbackGradient: 'from-fuchsia-500/85 to-indigo-900/90' },
  plasma: { src: symPlasmaImg, label: 'Plasma Nova', shortTag: 'PLS', fallbackGradient: 'from-orange-500/80 to-red-900/90' },
  sapphire: { src: symSapphireImg, label: 'Sapphire Core', shortTag: 'SAP', fallbackGradient: 'from-sky-500/80 to-blue-900/90' },
  amethyst: { src: symAmethystImg, label: 'Amethyst Shard', shortTag: 'AME', fallbackGradient: 'from-purple-500/80 to-violet-900/90' },
  emerald_gem: { src: symEmeraldGemImg, label: 'Emerald Prism', shortTag: 'EMR', fallbackGradient: 'from-emerald-500/80 to-teal-900/90' },
  opal: { src: symOpalImg, label: 'Starlight Opal', shortTag: 'OPL', fallbackGradient: 'from-blue-400/80 to-indigo-900/90' },

  // Agent 007: Spy Mission Spin
  spy_wild: { src: symSpyWildImg, label: 'Agent 007 Wild', shortTag: '007', fallbackGradient: 'from-amber-400/90 to-slate-900' },
  spy_car: { src: symSpyCarImg, label: 'Stealth Coupe', shortTag: 'CAR', fallbackGradient: 'from-slate-500/80 to-zinc-900' },
  spy_briefcase: { src: symSpyBriefcaseImg, label: 'Gold Briefcase', shortTag: 'CASE', fallbackGradient: 'from-amber-500/80 to-stone-900' },
  spy_pistol: { src: symSpyPistolImg, label: 'Silenced Pistol', shortTag: 'PPK', fallbackGradient: 'from-zinc-500/80 to-slate-900' },
  spy_watch: { src: symSpyWatchImg, label: 'Laser Watch', shortTag: 'WTC', fallbackGradient: 'from-cyan-500/80 to-slate-900' },
  spy_passport: { src: symSpyPassportImg, label: 'Cipher Passport', shortTag: 'DOC', fallbackGradient: 'from-blue-700/80 to-slate-900' },

  // Hot Inferno 777
  inferno_wild: { src: symInfernoWildImg, label: 'Inferno Wild', shortTag: 'WILD', fallbackGradient: 'from-orange-500/90 to-red-950' },
  inferno_777: { src: symInferno777Img, label: 'Inferno 777', shortTag: '777', fallbackGradient: 'from-red-500/90 to-amber-900' },
  molten_bell: { src: symMoltenBellImg, label: 'Molten Bell', shortTag: 'BELL', fallbackGradient: 'from-amber-500/80 to-orange-950' },
  flame_dice: { src: symFlameDiceImg, label: 'Flame Dice', shortTag: 'DICE', fallbackGradient: 'from-rose-600/80 to-red-950' },
  ruby_heart: { src: symRubyHeartImg, label: 'Ruby Heart', shortTag: 'HRT', fallbackGradient: 'from-red-600/80 to-rose-950' },
  gold_ingot: { src: symGoldIngotImg, label: 'Bullion Ingot', shortTag: 'GOLD', fallbackGradient: 'from-yellow-500/80 to-amber-950' },

  // Vikings Valhalla Spin
  viking_wild: { src: symVikingWildImg, label: 'Valhalla Wild', shortTag: 'WILD', fallbackGradient: 'from-sky-400/90 to-slate-900' },
  viking_helm: { src: symVikingHelmImg, label: 'Horned Helm', shortTag: 'HELM', fallbackGradient: 'from-amber-500/80 to-slate-900' },
  battle_axe: { src: symBattleAxeImg, label: 'Twin Battle Axe', shortTag: 'AXE', fallbackGradient: 'from-slate-400/80 to-zinc-900' },
  longship: { src: symLongshipImg, label: 'Dragon Longship', shortTag: 'SHIP', fallbackGradient: 'from-cyan-600/80 to-slate-900' },
  thor_hammer: { src: symThorHammerImg, label: "Thor's Hammer", shortTag: 'THOR', fallbackGradient: 'from-blue-500/80 to-indigo-950' },
  runestone: { src: symRunestoneImg, label: 'Norse Runestone', shortTag: 'RUNE', fallbackGradient: 'from-teal-500/80 to-slate-900' },

  // Dragon Fortune Spin
  dragon_wild: { src: symDragonWildImg, label: 'Emperor Dragon Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-400/90 to-red-900' },
  jade_tiger: { src: symJadeTigerImg, label: 'Jade Tiger', shortTag: 'JADE', fallbackGradient: 'from-emerald-500/80 to-teal-950' },
  red_lantern: { src: symRedLanternImg, label: 'Silk Lantern', shortTag: 'LANT', fallbackGradient: 'from-red-500/80 to-rose-950' },
  koi_fish: { src: symKoiFishImg, label: 'Golden Koi', shortTag: 'KOI', fallbackGradient: 'from-orange-500/80 to-amber-950' },
  gold_sycee: { src: symGoldSyceeImg, label: 'Gold Sycee', shortTag: 'GOLD', fallbackGradient: 'from-yellow-400/80 to-amber-900' },
  fortune_fan: { src: symFortuneFanImg, label: 'Imperial Fan', shortTag: 'FAN', fallbackGradient: 'from-rose-500/80 to-red-950' },

  // Wild West Bounty
  sheriff_wild: { src: symSheriffWildImg, label: 'Sheriff Star Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-400/90 to-stone-900' },
  revolver: { src: symRevolverImg, label: 'Dual Colts', shortTag: 'COLT', fallbackGradient: 'from-stone-500/80 to-zinc-950' },
  dynamite: { src: symDynamiteImg, label: 'TNT Bundle', shortTag: 'TNT', fallbackGradient: 'from-red-600/80 to-stone-950' },
  cowboy_hat: { src: symCowboyHatImg, label: 'Outlaw Stetson', shortTag: 'HAT', fallbackGradient: 'from-amber-700/80 to-stone-950' },
  horseshoe: { src: symHorseshoeImg, label: 'Lucky Horseshoe', shortTag: 'SHOE', fallbackGradient: 'from-yellow-500/80 to-stone-900' },
  whiskey_barrel: { src: symWhiskeyBarrelImg, label: 'Oak Barrel', shortTag: 'BRL', fallbackGradient: 'from-orange-700/80 to-stone-950' },

  // Pirate Treasure Megaways
  pirate_wild: { src: symPirateWildImg, label: 'Corsair Wild', shortTag: 'WILD', fallbackGradient: 'from-amber-500/90 to-slate-950' },
  treasure_chest: { src: symTreasureChestImg, label: 'Sunken Chest', shortTag: 'GOLD', fallbackGradient: 'from-yellow-500/80 to-amber-950' },
  pirate_ship: { src: symPirateShipImg, label: 'Black Galleon', shortTag: 'SHIP', fallbackGradient: 'from-sky-600/80 to-slate-950' },
  brass_compass: { src: symBrassCompassImg, label: 'Gold Compass', shortTag: 'COMP', fallbackGradient: 'from-amber-500/80 to-slate-900' },
  spyglass: { src: symSpyglassImg, label: 'Brass Spyglass', shortTag: 'GLAS', fallbackGradient: 'from-yellow-600/80 to-stone-950' },
  rum_bottle: { src: symRumBottleImg, label: 'Captain Rum', shortTag: 'RUM', fallbackGradient: 'from-emerald-600/80 to-slate-950' },

  // Zeus Olympus Megaways
  zeus_wild: { src: symZeusWildImg, label: 'Zeus Bolt Wild', shortTag: 'WILD', fallbackGradient: 'from-sky-400/90 to-indigo-950' },
  pegasus: { src: symPegasusImg, label: 'Winged Pegasus', shortTag: 'PEG', fallbackGradient: 'from-cyan-400/80 to-blue-950' },
  olympus_temple: { src: symOlympusTempleImg, label: 'Olympus Temple', shortTag: 'TMPL', fallbackGradient: 'from-amber-400/80 to-slate-900' },
  golden_chalice: { src: symGoldenChaliceImg, label: 'Ambrosia Chalice', shortTag: 'CUP', fallbackGradient: 'from-yellow-500/80 to-amber-950' },
  lightning_ring: { src: symLightningRingImg, label: 'Storm Ring', shortTag: 'RING', fallbackGradient: 'from-blue-400/80 to-indigo-950' },
  marble_lyre: { src: symMarbleLyreImg, label: 'Golden Lyre', shortTag: 'LYRE', fallbackGradient: 'from-amber-300/80 to-slate-900' },

  // Neon Vegas Nights
  vip_wild: { src: symVipWildImg, label: 'Vegas VIP Wild', shortTag: 'VIP', fallbackGradient: 'from-fuchsia-500/90 to-indigo-950' },
  roulette_wheel: { src: symRouletteWheelImg, label: 'Roulette Wheel', shortTag: 'WHL', fallbackGradient: 'from-rose-500/80 to-slate-950' },
  royal_cards: { src: symRoyalCardsImg, label: 'Royal Flush', shortTag: 'ACES', fallbackGradient: 'from-violet-500/80 to-slate-950' },
  champagne: { src: symChampagneImg, label: 'VIP Champagne', shortTag: 'CHMP', fallbackGradient: 'from-amber-400/80 to-slate-950' },
  casino_dice: { src: symCasinoDiceImg, label: 'Neon Craps Dice', shortTag: 'DICE', fallbackGradient: 'from-cyan-500/80 to-purple-950' },
  sports_car: { src: symSportsCarImg, label: 'Strip Supercar', shortTag: 'CAR', fallbackGradient: 'from-pink-500/80 to-slate-950' },

  // Emerald Leprechaun Spin
  clover_wild: { src: symCloverWildImg, label: 'Leprechaun Wild', shortTag: 'WILD', fallbackGradient: 'from-emerald-400/90 to-green-950' },
  pot_of_gold: { src: symPotOfGoldImg, label: 'Pot of Gold', shortTag: 'POT', fallbackGradient: 'from-yellow-400/80 to-emerald-950' },
  four_clover: { src: symFourCloverImg, label: 'Emerald Clover', shortTag: 'CLVR', fallbackGradient: 'from-green-500/80 to-emerald-950' },
  golden_harp: { src: symGoldenHarpImg, label: 'Celtic Harp', shortTag: 'HARP', fallbackGradient: 'from-amber-400/80 to-green-950' },
  rainbow_boot: { src: symRainbowBootImg, label: 'Lucky Boot', shortTag: 'BOOT', fallbackGradient: 'from-teal-500/80 to-green-950' },
  emerald_pint: { src: symEmeraldPintImg, label: 'Emerald Stout', shortTag: 'PINT', fallbackGradient: 'from-emerald-600/80 to-slate-950' },

  // Gladiator Arena Megaways
  gladiator_wild: { src: symGladiatorWildImg, label: 'Gladiator Wild', shortTag: 'WILD', fallbackGradient: 'from-red-500/90 to-amber-950' },
  roman_helm: { src: symRomanHelmImg, label: 'Centurion Helm', shortTag: 'HELM', fallbackGradient: 'from-amber-500/80 to-red-950' },
  golden_eagle: { src: symGoldenEagleImg, label: 'Imperial Eagle', shortTag: 'EAGL', fallbackGradient: 'from-yellow-500/80 to-stone-950' },
  war_chariot: { src: symWarChariotImg, label: 'War Chariot', shortTag: 'CHRT', fallbackGradient: 'from-orange-500/80 to-stone-950' },
  gladius_shield: { src: symGladiusShieldImg, label: 'Arena Shield', shortTag: 'SHLD', fallbackGradient: 'from-red-600/80 to-stone-950' },
  colosseum_coin: { src: symColosseumCoinImg, label: 'Denarius Coin', shortTag: 'COIN', fallbackGradient: 'from-amber-400/80 to-stone-950' },
};

interface SlotSymbolIconProps {
  symbolId: SlotSymbolId;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SlotSymbolIcon({
  symbolId,
  className,
  size = 'lg',
}: SlotSymbolIconProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const visual = SYMBOL_VISUALS[symbolId];

  const dim =
    className ||
    (size === 'sm'
      ? 'w-8 h-8 rounded-md'
      : size === 'md'
        ? 'w-11 h-11 rounded-lg'
        : 'w-full h-full rounded-lg');

  const showFallback = !visual || failedSrc === visual.src;

  if (showFallback) {
    return (
      <div
        className={`${dim} bg-gradient-to-br ${visual?.fallbackGradient || 'from-amber-500/80 to-slate-900'} flex items-center justify-center text-[10px] font-mono font-black text-white select-none`}
        title={visual?.label || symbolId}
      >
        {visual?.shortTag || symbolId.slice(0, 4).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`${dim} relative overflow-hidden bg-[#0A0E1B] ring-1 ring-white/15 shadow-inner select-none`}
    >
      <img
        src={visual.src}
        alt={visual.label}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedSrc(visual.src)}
        className={`w-full h-full ${className ? 'object-contain' : 'object-cover'} object-center contrast-[1.08] saturate-[1.12] brightness-[1.03] select-none block`}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
    </div>
  );
}
