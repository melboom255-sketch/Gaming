import crypto from 'node:crypto';

export type SlotEngineType =
  | 'fruitslot'
  | 'hot7spin'
  | 'safari_spin'
  | 'pharaoh_spin'
  | 'candy_spin'
  | 'abyssinia_megaways'
  | 'cosmic_megaways'
  | 'spy_mission_spin'
  | 'hot_inferno_777'
  | 'vikings_valhalla_spin'
  | 'dragon_fortune_spin'
  | 'wild_west_bounty'
  | 'pirate_treasure_megaways'
  | 'zeus_olympus_megaways'
  | 'neon_vegas_nights'
  | 'emerald_leprechaun_spin'
  | 'gladiator_arena_megaways'
  | 'sheba_crown_megaways'
  | 'lalibela_gold_megaways'
  | 'abay_nile_riches'
  | 'blazing_diamond_777'
  | 'tropical_berry_frenzy'
  | 'royal_gold_bullion'
  | 'ruby_starlight_777'
  | 'golden_bell_jackpot'
  | 'samurai_blade_megaways'
  | 'atlantis_kraken_megaways'
  | 'cyberpunk_matrix_megaways'
  | 'volcano_eruption_megaways'
  | 'valhalla_storm_megaways'
  | 'cyber_heist_spin'
  | 'outlaw_gold_train'
  | 'arabian_genie_spin'
  | 'aztec_sun_spin'
  | 'imperial_panda_spin';

export type SlotLayoutMode = 'classic_3x3' | 'spin_5x3' | 'megaways';

export type SlotSymbolId =
  // Fruit Slot
  | 'cherry'
  | 'lemon'
  | 'orange'
  | 'grapes'
  | 'watermelon'
  | 'bell'
  | 'star'
  // Hot 7 Spin
  | 'bar1'
  | 'bar2'
  | 'diamond'
  | 'seven'
  | 'double7'
  | 'triple7'
  // Safari Spin
  | 'lion_wild'
  | 'elephant'
  | 'rhino'
  | 'zebra'
  | 'acacia'
  | 'shield'
  // Pharaoh Spin
  | 'pharaoh_wild'
  | 'scarab'
  | 'horus'
  | 'ankh'
  | 'sphinx'
  | 'lotus'
  // Candy Spin
  | 'candy_wild'
  | 'cupcake'
  | 'lollipop'
  | 'donut'
  | 'gummy'
  | 'candystar'
  // Axum Gold Megaways
  | 'axum_wild'
  | 'obelisk'
  | 'gold_coin'
  | 'amber_gem'
  | 'emerald_scarab'
  | 'royal_crown'
  // Cosmic Gem Megaways
  | 'nebula_wild'
  | 'plasma'
  | 'sapphire'
  | 'amethyst'
  | 'emerald_gem'
  | 'opal'
  // Spy Mission Spin
  | 'spy_wild'
  | 'spy_car'
  | 'spy_briefcase'
  | 'spy_pistol'
  | 'spy_watch'
  | 'spy_passport'
  // Hot Inferno 777
  | 'inferno_wild'
  | 'inferno_777'
  | 'molten_bell'
  | 'flame_dice'
  | 'ruby_heart'
  | 'gold_ingot'
  // Vikings Valhalla Spin
  | 'viking_wild'
  | 'viking_helm'
  | 'battle_axe'
  | 'longship'
  | 'thor_hammer'
  | 'runestone'
  // Dragon Fortune Spin
  | 'dragon_wild'
  | 'jade_tiger'
  | 'red_lantern'
  | 'koi_fish'
  | 'gold_sycee'
  | 'fortune_fan'
  // Wild West Bounty
  | 'sheriff_wild'
  | 'revolver'
  | 'dynamite'
  | 'cowboy_hat'
  | 'horseshoe'
  | 'whiskey_barrel'
  // Pirate Treasure Megaways
  | 'pirate_wild'
  | 'treasure_chest'
  | 'pirate_ship'
  | 'brass_compass'
  | 'spyglass'
  | 'rum_bottle'
  // Zeus Olympus Megaways
  | 'zeus_wild'
  | 'pegasus'
  | 'olympus_temple'
  | 'golden_chalice'
  | 'lightning_ring'
  | 'marble_lyre'
  // Neon Vegas Nights
  | 'vip_wild'
  | 'roulette_wheel'
  | 'royal_cards'
  | 'champagne'
  | 'casino_dice'
  | 'sports_car'
  // Emerald Leprechaun Spin
  | 'clover_wild'
  | 'pot_of_gold'
  | 'four_clover'
  | 'golden_harp'
  | 'rainbow_boot'
  | 'emerald_pint'
  // Gladiator Arena Megaways
  | 'gladiator_wild'
  | 'roman_helm'
  | 'golden_eagle'
  | 'war_chariot'
  | 'gladius_shield'
  | 'colosseum_coin';

export interface SlotSymbolSpec {
  id: SlotSymbolId;
  name: string;
  multiplier: number; // Base 3-match (or 3-reel) multiplier
  weight: number;
  isWild?: boolean;
}

export interface SlotWinningLine {
  lineIndex: number;
  lineName: string;
  symbolId: SlotSymbolId;
  symbolName: string;
  multiplier: number;
  matchCount?: number;
  waysCount?: number;
  cells: Array<[number, number]>; // [row, col]
}

export interface MegawaysCascadeStep {
  columns: SlotSymbolId[][]; // columns[col][row]
  waysCount: number;
  cascadeMultiplier: number;
  winningLines: SlotWinningLine[];
  stepMultiplier: number;
}

export interface EvaluatedSlotResult {
  layoutMode: SlotLayoutMode;
  winningLines: SlotWinningLine[];
  baseMultiplier: number;
  multiplierReel: number;
  totalMultiplier: number;
  waysCount?: number;
  cascades?: MegawaysCascadeStep[];
}

export interface GeneratedSlotSpin extends EvaluatedSlotResult {
  engine: SlotEngineType;
  grid: SlotSymbolId[][];
  columns?: SlotSymbolId[][];
}

export interface GeneratedBonusVault {
  index: number;
  kind: 'mult' | 'freespins';
  value: number;
  label: string;
}

export const PAYLINES_3X3: Array<{
  lineIndex: number;
  lineName: string;
  cells: Array<[number, number]>;
}> = [
  { lineIndex: 1, lineName: 'Middle Line', cells: [[1, 0], [1, 1], [1, 2]] },
  { lineIndex: 2, lineName: 'Top Line', cells: [[0, 0], [0, 1], [0, 2]] },
  { lineIndex: 3, lineName: 'Bottom Line', cells: [[2, 0], [2, 1], [2, 2]] },
  { lineIndex: 4, lineName: 'Diagonal ↘', cells: [[0, 0], [1, 1], [2, 2]] },
  { lineIndex: 5, lineName: 'Diagonal ↗', cells: [[2, 0], [1, 1], [0, 2]] },
];

export const PAYLINES_5X3: Array<{
  lineIndex: number;
  lineName: string;
  cells: Array<[number, number]>;
}> = [
  { lineIndex: 1, lineName: 'Middle Line', cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
  { lineIndex: 2, lineName: 'Top Line', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { lineIndex: 3, lineName: 'Bottom Line', cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
  { lineIndex: 4, lineName: 'V-Shape', cells: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]] },
  { lineIndex: 5, lineName: 'Inverted V', cells: [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]] },
  { lineIndex: 6, lineName: 'Top Crown', cells: [[0, 0], [0, 1], [1, 2], [0, 3], [0, 4]] },
  { lineIndex: 7, lineName: 'Bottom Crown', cells: [[2, 0], [2, 1], [1, 2], [2, 3], [2, 4]] },
  { lineIndex: 8, lineName: 'Step Up', cells: [[2, 0], [1, 1], [1, 2], [1, 3], [0, 4]] },
  { lineIndex: 9, lineName: 'Step Down', cells: [[0, 0], [1, 1], [1, 2], [1, 3], [2, 4]] },
  { lineIndex: 10, lineName: 'Wave Line', cells: [[1, 0], [0, 1], [1, 2], [2, 3], [1, 4]] },
];

export const ENGINE_SYMBOLS: Record<SlotEngineType, SlotSymbolSpec[]> = {
  fruitslot: [
    { id: 'cherry', name: 'Cherry', multiplier: 1.5, weight: 32 },
    { id: 'lemon', name: 'Lemon', multiplier: 2.0, weight: 25 },
    { id: 'orange', name: 'Orange', multiplier: 2.5, weight: 20 },
    { id: 'grapes', name: 'Grapes', multiplier: 3.5, weight: 14 },
    { id: 'watermelon', name: 'Watermelon', multiplier: 5.0, weight: 10 },
    { id: 'bell', name: 'Golden Bell', multiplier: 7.5, weight: 6 },
    { id: 'star', name: 'Wild Star', multiplier: 12.0, weight: 3, isWild: true },
  ],
  hot7spin: [
    { id: 'bar1', name: 'Single BAR', multiplier: 1.5, weight: 30 },
    { id: 'bar2', name: 'Double BAR', multiplier: 2.0, weight: 24 },
    { id: 'bell', name: 'Golden Bell', multiplier: 2.5, weight: 18 },
    { id: 'diamond', name: 'Diamond', multiplier: 3.5, weight: 14 },
    { id: 'seven', name: 'Hot Red 7', multiplier: 4.5, weight: 10 },
    { id: 'double7', name: 'Blazing 77', multiplier: 7.0, weight: 5 },
    { id: 'triple7', name: 'Crown 777', multiplier: 10.0, weight: 3, isWild: true },
  ],
  hot_inferno_777: [
    { id: 'gold_ingot', name: 'Bullion Ingot', multiplier: 1.6, weight: 30 },
    { id: 'ruby_heart', name: 'Ruby Heart', multiplier: 2.2, weight: 24 },
    { id: 'flame_dice', name: 'Flame Dice', multiplier: 2.8, weight: 18 },
    { id: 'molten_bell', name: 'Molten Bell', multiplier: 3.8, weight: 14 },
    { id: 'inferno_777', name: 'Inferno 777', multiplier: 6.5, weight: 8 },
    { id: 'inferno_wild', name: 'Inferno Wild', multiplier: 11.0, weight: 3, isWild: true },
  ],
  safari_spin: [
    { id: 'shield', name: 'Tribal Shield', multiplier: 1.4, weight: 30 },
    { id: 'acacia', name: 'Sunset Acacia', multiplier: 1.8, weight: 25 },
    { id: 'zebra', name: 'Zebra', multiplier: 2.2, weight: 20 },
    { id: 'rhino', name: 'Black Rhino', multiplier: 3.0, weight: 14 },
    { id: 'elephant', name: 'Elephant', multiplier: 4.5, weight: 9 },
    { id: 'lion_wild', name: 'Lion Crown', multiplier: 8.0, weight: 4, isWild: true },
  ],
  pharaoh_spin: [
    { id: 'lotus', name: 'Nile Lotus', multiplier: 1.4, weight: 30 },
    { id: 'ankh', name: 'Golden Ankh', multiplier: 1.8, weight: 25 },
    { id: 'horus', name: 'Eye of Horus', multiplier: 2.4, weight: 20 },
    { id: 'scarab', name: 'Golden Scarab', multiplier: 3.2, weight: 14 },
    { id: 'sphinx', name: 'Royal Sphinx', multiplier: 4.8, weight: 9 },
    { id: 'pharaoh_wild', name: 'Pharaoh Mask', multiplier: 9.0, weight: 4, isWild: true },
  ],
  candy_spin: [
    { id: 'gummy', name: 'Gummy Bear', multiplier: 1.4, weight: 30 },
    { id: 'donut', name: 'Glazed Donut', multiplier: 1.8, weight: 25 },
    { id: 'candystar', name: 'Sugar Star', multiplier: 2.2, weight: 20 },
    { id: 'cupcake', name: 'Cupcake', multiplier: 3.0, weight: 14 },
    { id: 'lollipop', name: 'Spiral Pop', multiplier: 4.5, weight: 9 },
    { id: 'candy_wild', name: 'Rainbow Bomb', multiplier: 8.5, weight: 4, isWild: true },
  ],
  spy_mission_spin: [
    { id: 'spy_passport', name: 'Cipher Passport', multiplier: 1.5, weight: 30 },
    { id: 'spy_watch', name: 'Laser Watch', multiplier: 2.0, weight: 25 },
    { id: 'spy_pistol', name: 'Silenced Pistol', multiplier: 2.6, weight: 20 },
    { id: 'spy_briefcase', name: 'Gold Briefcase', multiplier: 3.6, weight: 14 },
    { id: 'spy_car', name: 'Stealth Coupe', multiplier: 5.2, weight: 9 },
    { id: 'spy_wild', name: 'Agent 007 Wild', multiplier: 9.5, weight: 4, isWild: true },
  ],
  vikings_valhalla_spin: [
    { id: 'runestone', name: 'Norse Runestone', multiplier: 1.5, weight: 30 },
    { id: 'thor_hammer', name: "Thor's Hammer", multiplier: 2.0, weight: 25 },
    { id: 'longship', name: 'Dragon Longship', multiplier: 2.6, weight: 20 },
    { id: 'battle_axe', name: 'Twin Battle Axe', multiplier: 3.5, weight: 14 },
    { id: 'viking_helm', name: 'Horned Helm', multiplier: 5.0, weight: 9 },
    { id: 'viking_wild', name: 'Valhalla Wild', multiplier: 9.0, weight: 4, isWild: true },
  ],
  dragon_fortune_spin: [
    { id: 'fortune_fan', name: 'Imperial Fan', multiplier: 1.5, weight: 30 },
    { id: 'gold_sycee', name: 'Gold Sycee', multiplier: 2.0, weight: 25 },
    { id: 'koi_fish', name: 'Golden Koi', multiplier: 2.5, weight: 20 },
    { id: 'red_lantern', name: 'Silk Lantern', multiplier: 3.4, weight: 14 },
    { id: 'jade_tiger', name: 'Jade Tiger', multiplier: 5.0, weight: 9 },
    { id: 'dragon_wild', name: 'Emperor Dragon', multiplier: 9.5, weight: 4, isWild: true },
  ],
  wild_west_bounty: [
    { id: 'whiskey_barrel', name: 'Oak Barrel', multiplier: 1.4, weight: 30 },
    { id: 'horseshoe', name: 'Lucky Horseshoe', multiplier: 1.9, weight: 25 },
    { id: 'cowboy_hat', name: 'Outlaw Stetson', multiplier: 2.4, weight: 20 },
    { id: 'dynamite', name: 'TNT Bundle', multiplier: 3.3, weight: 14 },
    { id: 'revolver', name: 'Dual Colts', multiplier: 4.8, weight: 9 },
    { id: 'sheriff_wild', name: 'Sheriff Star Wild', multiplier: 8.8, weight: 4, isWild: true },
  ],
  neon_vegas_nights: [
    { id: 'sports_car', name: 'Strip Supercar', multiplier: 1.5, weight: 30 },
    { id: 'casino_dice', name: 'Neon Craps Dice', multiplier: 2.0, weight: 25 },
    { id: 'champagne', name: 'VIP Champagne', multiplier: 2.6, weight: 20 },
    { id: 'royal_cards', name: 'Royal Flush', multiplier: 3.5, weight: 14 },
    { id: 'roulette_wheel', name: 'Roulette Wheel', multiplier: 5.2, weight: 9 },
    { id: 'vip_wild', name: 'Vegas VIP Wild', multiplier: 9.5, weight: 4, isWild: true },
  ],
  emerald_leprechaun_spin: [
    { id: 'emerald_pint', name: 'Emerald Stout', multiplier: 1.4, weight: 30 },
    { id: 'rainbow_boot', name: 'Lucky Boot', multiplier: 1.9, weight: 25 },
    { id: 'golden_harp', name: 'Celtic Harp', multiplier: 2.4, weight: 20 },
    { id: 'four_clover', name: 'Emerald Clover', multiplier: 3.4, weight: 14 },
    { id: 'pot_of_gold', name: 'Pot of Gold', multiplier: 5.0, weight: 9 },
    { id: 'clover_wild', name: 'Leprechaun Wild', multiplier: 9.0, weight: 4, isWild: true },
  ],
  abyssinia_megaways: [
    { id: 'gold_coin', name: 'Axum Coin', multiplier: 0.6, weight: 32 },
    { id: 'amber_gem', name: 'Amber Gem', multiplier: 0.9, weight: 26 },
    { id: 'emerald_scarab', name: 'Emerald Scarab', multiplier: 1.2, weight: 20 },
    { id: 'royal_crown', name: 'Royal Crown', multiplier: 1.8, weight: 14 },
    { id: 'obelisk', name: 'Axum Obelisk', multiplier: 2.8, weight: 9 },
    { id: 'axum_wild', name: 'Axum Lion Wild', multiplier: 4.5, weight: 4, isWild: true },
  ],
  cosmic_megaways: [
    { id: 'opal', name: 'Starlight Opal', multiplier: 0.6, weight: 32 },
    { id: 'emerald_gem', name: 'Emerald Prism', multiplier: 0.9, weight: 26 },
    { id: 'amethyst', name: 'Amethyst Shard', multiplier: 1.3, weight: 20 },
    { id: 'sapphire', name: 'Sapphire Core', multiplier: 1.9, weight: 14 },
    { id: 'plasma', name: 'Plasma Nova', multiplier: 3.0, weight: 9 },
    { id: 'nebula_wild', name: 'Nebula Wild', multiplier: 4.5, weight: 4, isWild: true },
  ],
  pirate_treasure_megaways: [
    { id: 'rum_bottle', name: 'Captain Rum', multiplier: 0.65, weight: 32 },
    { id: 'spyglass', name: 'Brass Spyglass', multiplier: 0.95, weight: 26 },
    { id: 'brass_compass', name: 'Gold Compass', multiplier: 1.3, weight: 20 },
    { id: 'pirate_ship', name: 'Black Galleon', multiplier: 1.9, weight: 14 },
    { id: 'treasure_chest', name: 'Sunken Chest', multiplier: 2.9, weight: 9 },
    { id: 'pirate_wild', name: 'Corsair Wild', multiplier: 4.6, weight: 4, isWild: true },
  ],
  zeus_olympus_megaways: [
    { id: 'marble_lyre', name: 'Golden Lyre', multiplier: 0.65, weight: 32 },
    { id: 'lightning_ring', name: 'Storm Ring', multiplier: 0.95, weight: 26 },
    { id: 'golden_chalice', name: 'Ambrosia Chalice', multiplier: 1.35, weight: 20 },
    { id: 'olympus_temple', name: 'Olympus Temple', multiplier: 2.0, weight: 14 },
    { id: 'pegasus', name: 'Winged Pegasus', multiplier: 3.0, weight: 9 },
    { id: 'zeus_wild', name: 'Zeus Bolt Wild', multiplier: 4.8, weight: 4, isWild: true },
  ],
  gladiator_arena_megaways: [
    { id: 'colosseum_coin', name: 'Denarius Coin', multiplier: 0.65, weight: 32 },
    { id: 'gladius_shield', name: 'Arena Shield', multiplier: 0.95, weight: 26 },
    { id: 'war_chariot', name: 'War Chariot', multiplier: 1.35, weight: 20 },
    { id: 'golden_eagle', name: 'Imperial Eagle', multiplier: 1.95, weight: 14 },
    { id: 'roman_helm', name: 'Centurion Helm', multiplier: 2.95, weight: 9 },
    { id: 'gladiator_wild', name: 'Gladiator Wild', multiplier: 4.7, weight: 4, isWild: true },
  ],
  sheba_crown_megaways: [
    { id: 'gold_coin', name: 'Sheba Coin', multiplier: 0.65, weight: 32 },
    { id: 'amber_gem', name: 'Highland Amber', multiplier: 0.95, weight: 26 },
    { id: 'lotus', name: 'Nile Blossom', multiplier: 1.35, weight: 20 },
    { id: 'golden_chalice', name: 'Queen Chalice', multiplier: 1.95, weight: 14 },
    { id: 'royal_crown', name: 'Sheba Crown', multiplier: 3.0, weight: 9 },
    { id: 'axum_wild', name: 'Queen Wild', multiplier: 4.8, weight: 4, isWild: true },
  ],
  lalibela_gold_megaways: [
    { id: 'colosseum_coin', name: 'Monolith Coin', multiplier: 0.6, weight: 32 },
    { id: 'ankh', name: 'Sacred Cross', multiplier: 0.95, weight: 26 },
    { id: 'emerald_scarab', name: 'Emerald Relic', multiplier: 1.3, weight: 20 },
    { id: 'obelisk', name: 'Stone Stele', multiplier: 1.9, weight: 14 },
    { id: 'gold_ingot', name: 'Sacred Gold', multiplier: 2.95, weight: 9 },
    { id: 'pharaoh_wild', name: 'Lalibela Wild', multiplier: 4.7, weight: 4, isWild: true },
  ],
  abay_nile_riches: [
    { id: 'lotus', name: 'Blue Nile Lotus', multiplier: 1.4, weight: 30 },
    { id: 'gold_coin', name: 'River Gold', multiplier: 1.9, weight: 25 },
    { id: 'emerald_scarab', name: 'Nile Scarab', multiplier: 2.5, weight: 20 },
    { id: 'golden_chalice', name: 'Royal Vessel', multiplier: 3.4, weight: 14 },
    { id: 'sphinx', name: 'Guardian Lion', multiplier: 4.9, weight: 9 },
    { id: 'axum_wild', name: 'Abay Wild', multiplier: 9.2, weight: 4, isWild: true },
  ],
  blazing_diamond_777: [
    { id: 'bar1', name: 'Silver BAR', multiplier: 1.6, weight: 30 },
    { id: 'bar2', name: 'Gold 2BAR', multiplier: 2.2, weight: 24 },
    { id: 'sapphire', name: 'Blue Diamond', multiplier: 3.0, weight: 18 },
    { id: 'diamond', name: 'Flawless Gem', multiplier: 4.0, weight: 14 },
    { id: 'seven', name: 'Blazing 7', multiplier: 6.0, weight: 8 },
    { id: 'triple7', name: 'Diamond 777', multiplier: 11.5, weight: 3, isWild: true },
  ],
  tropical_berry_frenzy: [
    { id: 'cherry', name: 'Wild Cherry', multiplier: 1.4, weight: 30 },
    { id: 'lemon', name: 'Sun Citrus', multiplier: 1.8, weight: 25 },
    { id: 'orange', name: 'Sweet Mango', multiplier: 2.3, weight: 20 },
    { id: 'grapes', name: 'Berry Bunch', multiplier: 3.2, weight: 14 },
    { id: 'watermelon', name: 'Melon Slice', multiplier: 4.6, weight: 9 },
    { id: 'candy_wild', name: 'Star Burst', multiplier: 8.8, weight: 4, isWild: true },
  ],
  royal_gold_bullion: [
    { id: 'gold_coin', name: 'Mint Coin', multiplier: 1.5, weight: 30 },
    { id: 'gold_sycee', name: 'Imperial Ingot', multiplier: 2.0, weight: 25 },
    { id: 'gold_ingot', name: '24K Bullion', multiplier: 2.7, weight: 20 },
    { id: 'spy_briefcase', name: 'Reserve Case', multiplier: 3.6, weight: 14 },
    { id: 'royal_crown', name: 'Sovereign Crown', multiplier: 5.2, weight: 9 },
    { id: 'vip_wild', name: 'Vault Wild', multiplier: 9.5, weight: 4, isWild: true },
  ],
  ruby_starlight_777: [
    { id: 'ruby_heart', name: 'Ruby Gem', multiplier: 1.6, weight: 30 },
    { id: 'amethyst', name: 'Violet Star', multiplier: 2.2, weight: 24 },
    { id: 'flame_dice', name: 'Star Dice', multiplier: 2.9, weight: 18 },
    { id: 'double7', name: 'Starlight 77', multiplier: 4.2, weight: 14 },
    { id: 'inferno_777', name: 'Ruby 777', multiplier: 6.8, weight: 8 },
    { id: 'star', name: 'Starlight Wild', multiplier: 11.0, weight: 3, isWild: true },
  ],
  golden_bell_jackpot: [
    { id: 'cherry', name: 'Jackpot Cherry', multiplier: 1.5, weight: 30 },
    { id: 'bar1', name: 'Classic BAR', multiplier: 2.0, weight: 25 },
    { id: 'diamond', name: 'White Gem', multiplier: 2.8, weight: 20 },
    { id: 'molten_bell', name: 'Chime Bell', multiplier: 3.8, weight: 14 },
    { id: 'bell', name: 'Grand Bell', multiplier: 5.5, weight: 9 },
    { id: 'triple7', name: 'Bell 777 Wild', multiplier: 10.5, weight: 3, isWild: true },
  ],
  samurai_blade_megaways: [
    { id: 'fortune_fan', name: 'War Fan', multiplier: 0.65, weight: 32 },
    { id: 'gold_sycee', name: 'Koban Gold', multiplier: 0.95, weight: 26 },
    { id: 'koi_fish', name: 'Shogun Koi', multiplier: 1.35, weight: 20 },
    { id: 'jade_tiger', name: 'Jade Katana', multiplier: 1.95, weight: 14 },
    { id: 'red_lantern', name: 'Dojo Lantern', multiplier: 2.95, weight: 9 },
    { id: 'dragon_wild', name: 'Shogun Wild', multiplier: 4.7, weight: 4, isWild: true },
  ],
  atlantis_kraken_megaways: [
    { id: 'rum_bottle', name: 'Message Bottle', multiplier: 0.65, weight: 32 },
    { id: 'opal', name: 'Sea Pearl', multiplier: 0.95, weight: 26 },
    { id: 'brass_compass', name: 'Abyss Compass', multiplier: 1.35, weight: 20 },
    { id: 'sapphire', name: 'Trident Gem', multiplier: 1.95, weight: 14 },
    { id: 'treasure_chest', name: 'Atlantis Chest', multiplier: 2.95, weight: 9 },
    { id: 'pirate_wild', name: 'Kraken Wild', multiplier: 4.7, weight: 4, isWild: true },
  ],
  cyberpunk_matrix_megaways: [
    { id: 'casino_dice', name: 'Holo Cube', multiplier: 0.65, weight: 32 },
    { id: 'spy_watch', name: 'Neural Link', multiplier: 0.95, weight: 26 },
    { id: 'lightning_ring', name: 'Pulse Coil', multiplier: 1.35, weight: 20 },
    { id: 'plasma', name: 'Cyber Core', multiplier: 1.95, weight: 14 },
    { id: 'sports_car', name: 'Neon Interceptor', multiplier: 2.95, weight: 9 },
    { id: 'nebula_wild', name: 'Matrix Wild', multiplier: 4.8, weight: 4, isWild: true },
  ],
  volcano_eruption_megaways: [
    { id: 'amber_gem', name: 'Magma Shard', multiplier: 0.65, weight: 32 },
    { id: 'flame_dice', name: 'Ember Cube', multiplier: 0.95, weight: 26 },
    { id: 'ruby_heart', name: 'Lava Ruby', multiplier: 1.35, weight: 20 },
    { id: 'molten_bell', name: 'Volcano Gong', multiplier: 1.95, weight: 14 },
    { id: 'plasma', name: 'Caldera Core', multiplier: 3.0, weight: 9 },
    { id: 'inferno_wild', name: 'Eruption Wild', multiplier: 4.8, weight: 4, isWild: true },
  ],
  valhalla_storm_megaways: [
    { id: 'runestone', name: 'Storm Rune', multiplier: 0.65, weight: 32 },
    { id: 'lightning_ring', name: 'Thunder Ring', multiplier: 0.95, weight: 26 },
    { id: 'battle_axe', name: 'Frost Axe', multiplier: 1.35, weight: 20 },
    { id: 'longship', name: 'Storm Longship', multiplier: 1.95, weight: 14 },
    { id: 'viking_helm', name: 'Odin Helm', multiplier: 2.95, weight: 9 },
    { id: 'viking_wild', name: 'Valhalla Wild', multiplier: 4.8, weight: 4, isWild: true },
  ],
  cyber_heist_spin: [
    { id: 'spy_passport', name: 'Keycard', multiplier: 1.5, weight: 30 },
    { id: 'spy_watch', name: 'Hack Watch', multiplier: 2.0, weight: 25 },
    { id: 'spy_pistol', name: 'Pulse Blaster', multiplier: 2.6, weight: 20 },
    { id: 'spy_briefcase', name: 'Crypto Case', multiplier: 3.6, weight: 14 },
    { id: 'spy_car', name: 'Stealth Ride', multiplier: 5.2, weight: 9 },
    { id: 'spy_wild', name: 'Cipher Wild', multiplier: 9.5, weight: 4, isWild: true },
  ],
  outlaw_gold_train: [
    { id: 'whiskey_barrel', name: 'Powder Keg', multiplier: 1.4, weight: 30 },
    { id: 'horseshoe', name: 'Iron Shoe', multiplier: 1.9, weight: 25 },
    { id: 'cowboy_hat', name: 'Bandit Hat', multiplier: 2.5, weight: 20 },
    { id: 'dynamite', name: 'Rail Charge', multiplier: 3.4, weight: 14 },
    { id: 'gold_ingot', name: 'Train Bullion', multiplier: 5.0, weight: 9 },
    { id: 'sheriff_wild', name: 'Outlaw Wild', multiplier: 9.0, weight: 4, isWild: true },
  ],
  arabian_genie_spin: [
    { id: 'lotus', name: 'Desert Rose', multiplier: 1.4, weight: 30 },
    { id: 'amber_gem', name: 'Sultan Amber', multiplier: 1.9, weight: 25 },
    { id: 'golden_chalice', name: 'Magic Lamp', multiplier: 2.5, weight: 20 },
    { id: 'scarab', name: 'Oasis Jewel', multiplier: 3.4, weight: 14 },
    { id: 'royal_crown', name: 'Sultan Crown', multiplier: 5.0, weight: 9 },
    { id: 'pharaoh_wild', name: 'Genie Wild', multiplier: 9.2, weight: 4, isWild: true },
  ],
  aztec_sun_spin: [
    { id: 'shield', name: 'Sun Totem', multiplier: 1.4, weight: 30 },
    { id: 'gold_coin', name: 'Aztec Medallion', multiplier: 1.9, weight: 25 },
    { id: 'emerald_scarab', name: 'Jungle Jade', multiplier: 2.5, weight: 20 },
    { id: 'obelisk', name: 'Sun Pyramid', multiplier: 3.4, weight: 14 },
    { id: 'sphinx', name: 'Jaguar Idol', multiplier: 5.0, weight: 9 },
    { id: 'lion_wild', name: 'Sun God Wild', multiplier: 9.2, weight: 4, isWild: true },
  ],
  imperial_panda_spin: [
    { id: 'gummy', name: 'Bamboo Treat', multiplier: 1.4, weight: 30 },
    { id: 'fortune_fan', name: 'Silk Fan', multiplier: 1.9, weight: 25 },
    { id: 'koi_fish', name: 'Imperial Koi', multiplier: 2.5, weight: 20 },
    { id: 'red_lantern', name: 'Temple Lantern', multiplier: 3.4, weight: 14 },
    { id: 'jade_tiger', name: 'Jade Guardian', multiplier: 5.0, weight: 9 },
    { id: 'dragon_wild', name: 'Emperor Wild', multiplier: 9.4, weight: 4, isWild: true },
  ],
};

export const HOT7_MULTIPLIER_REEL: Array<{ value: number; weight: number }> = [
  { value: 1, weight: 46 },
  { value: 2, weight: 28 },
  { value: 3, weight: 15 },
  { value: 5, weight: 8 },
  { value: 7, weight: 3 },
];

export function isHotMultSlot(engine: SlotEngineType): boolean {
  return (
    engine === 'hot7spin' ||
    engine === 'hot_inferno_777' ||
    engine === 'blazing_diamond_777' ||
    engine === 'ruby_starlight_777'
  );
}

export function isMegaways6Reel(engine: SlotEngineType): boolean {
  return (
    engine === 'abyssinia_megaways' ||
    engine === 'pirate_treasure_megaways' ||
    engine === 'zeus_olympus_megaways' ||
    engine === 'sheba_crown_megaways' ||
    engine === 'samurai_blade_megaways' ||
    engine === 'atlantis_kraken_megaways' ||
    engine === 'volcano_eruption_megaways'
  );
}

export function getLayoutMode(engine: SlotEngineType): SlotLayoutMode {
  if (
    engine === 'abyssinia_megaways' ||
    engine === 'cosmic_megaways' ||
    engine === 'pirate_treasure_megaways' ||
    engine === 'zeus_olympus_megaways' ||
    engine === 'gladiator_arena_megaways' ||
    engine === 'sheba_crown_megaways' ||
    engine === 'lalibela_gold_megaways' ||
    engine === 'samurai_blade_megaways' ||
    engine === 'atlantis_kraken_megaways' ||
    engine === 'cyberpunk_matrix_megaways' ||
    engine === 'volcano_eruption_megaways' ||
    engine === 'valhalla_storm_megaways'
  ) {
    return 'megaways';
  }
  if (
    engine === 'fruitslot' ||
    engine === 'hot7spin' ||
    engine === 'hot_inferno_777' ||
    engine === 'blazing_diamond_777' ||
    engine === 'ruby_starlight_777' ||
    engine === 'golden_bell_jackpot'
  ) {
    return 'classic_3x3';
  }
  return 'spin_5x3';
}

function getWildId(engine: SlotEngineType): SlotSymbolId {
  const found = ENGINE_SYMBOLS[engine].find((s) => s.isWild);
  return found ? found.id : ENGINE_SYMBOLS[engine][ENGINE_SYMBOLS[engine].length - 1].id;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((acc, item) => acc + Math.max(1, item.weight), 0);
  let roll = crypto.randomInt(0, total);
  for (const item of items) {
    roll -= Math.max(1, item.weight);
    if (roll < 0) return item;
  }
  return items[0];
}

function roundMult(val: number): number {
  return Math.round(val * 100) / 100;
}

// Evaluate 3x3 or 5x3 grid
export function evaluateLineSlotGrid(
  engine: SlotEngineType,
  grid: SlotSymbolId[][],
  multiplierReel: number,
  maxMultiplier: number
): EvaluatedSlotResult {
  const layoutMode = getLayoutMode(engine);
  const symbols = ENGINE_SYMBOLS[engine];
  const specById = new Map(symbols.map((s) => [s.id, s]));
  const wildId = getWildId(engine);
  const paylines = layoutMode === 'spin_5x3' ? PAYLINES_5X3 : PAYLINES_3X3;
  const winningLines: SlotWinningLine[] = [];

  for (const line of paylines) {
    const lineSyms = line.cells.map(([r, c]) => grid[r][c]);

    if (layoutMode === 'classic_3x3') {
      const nonWilds = lineSyms.filter((id) => id !== wildId);
      if (nonWilds.length === 0) {
        const w = specById.get(wildId)!;
        winningLines.push({
          lineIndex: line.lineIndex,
          lineName: line.lineName,
          symbolId: w.id,
          symbolName: w.name,
          multiplier: w.multiplier,
          matchCount: 3,
          cells: line.cells,
        });
      } else if (nonWilds.every((id) => id === nonWilds[0])) {
        const t = specById.get(nonWilds[0]);
        if (t) {
          winningLines.push({
            lineIndex: line.lineIndex,
            lineName: line.lineName,
            symbolId: t.id,
            symbolName: t.name,
            multiplier: t.multiplier,
            matchCount: 3,
            cells: line.cells,
          });
        }
      }
    } else {
      let target: SlotSymbolId | null = null;
      let matchCount = 0;
      for (const sym of lineSyms) {
        if (sym === wildId) {
          matchCount++;
        } else if (target === null) {
          target = sym;
          matchCount++;
        } else if (sym === target) {
          matchCount++;
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        const resolvedId = target ?? wildId;
        const spec = specById.get(resolvedId);
        if (spec) {
          const lengthFactor = matchCount === 5 ? 3.2 : matchCount === 4 ? 1.85 : 1.0;
          const mult = roundMult(spec.multiplier * lengthFactor);
          winningLines.push({
            lineIndex: line.lineIndex,
            lineName: line.lineName,
            symbolId: spec.id,
            symbolName: spec.name,
            multiplier: mult,
            matchCount,
            cells: line.cells.slice(0, matchCount),
          });
        }
      }
    }
  }

  const baseMultiplier = roundMult(
    winningLines.reduce((sum, l) => sum + l.multiplier, 0)
  );
  const effectiveMultReel = isHotMultSlot(engine) ? multiplierReel : 1;
  const rawTotal = baseMultiplier > 0 ? roundMult(baseMultiplier * effectiveMultReel) : 0;
  const totalMultiplier =
    rawTotal > 0 ? Math.min(Math.max(1.5, maxMultiplier), rawTotal) : 0;

  return {
    layoutMode,
    winningLines,
    baseMultiplier,
    multiplierReel: effectiveMultReel,
    totalMultiplier,
  };
}

// Evaluate a single Megaways board (`columns[col][row]`)
export function evaluateMegawaysBoard(
  engine: SlotEngineType,
  columns: SlotSymbolId[][],
  cascadeMultiplier: number
): {
  waysCount: number;
  winningLines: SlotWinningLine[];
  stepMultiplier: number;
  matchedCellKeys: Set<string>;
} {
  const symbols = ENGINE_SYMBOLS[engine];
  const wildId = getWildId(engine);
  const waysCount = columns.reduce((acc, col) => acc * col.length, 1);

  const winningLines: SlotWinningLine[] = [];
  const matchedCellKeys = new Set<string>();
  let lineCounter = 1;

  for (const spec of symbols) {
    let matchedReels = 0;
    let waysForSymbol = 1;
    const cellsForSymbol: Array<[number, number]> = [];

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx];
      const matchingRows: number[] = [];
      for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
        const cellSym = col[rowIdx];
        if (spec.id === wildId ? cellSym === wildId : cellSym === spec.id || cellSym === wildId) {
          matchingRows.push(rowIdx);
        }
      }
      if (matchingRows.length === 0) break;
      matchedReels++;
      waysForSymbol *= matchingRows.length;
      for (const r of matchingRows) {
        cellsForSymbol.push([r, colIdx]);
      }
    }

    if (matchedReels >= 3) {
      const reelBonus =
        matchedReels === 6
          ? 3.0
          : matchedReels === 5
            ? 2.1
            : matchedReels === 4
              ? 1.45
              : 1.0;
      const waysFactor = 1 + Math.min(4, Math.log2(Math.max(1, waysForSymbol)) * 0.35);
      const mult = roundMult(spec.multiplier * reelBonus * waysFactor * cascadeMultiplier);

      winningLines.push({
        lineIndex: lineCounter++,
        lineName: `${matchedReels}-Reel Megaways (${waysForSymbol} Ways)`,
        symbolId: spec.id,
        symbolName: spec.name,
        multiplier: mult,
        matchCount: matchedReels,
        waysCount: waysForSymbol,
        cells: cellsForSymbol,
      });

      for (const [r, c] of cellsForSymbol) {
        matchedCellKeys.add(`${c}-${r}`);
      }
    }
  }

  const stepMultiplier = roundMult(
    winningLines.reduce((sum, l) => sum + l.multiplier, 0)
  );

  return {
    waysCount,
    winningLines,
    stepMultiplier,
    matchedCellKeys,
  };
}

function makeNonWinningLineGrid(engine: SlotEngineType): SlotSymbolId[][] {
  const layoutMode = getLayoutMode(engine);
  const cols = layoutMode === 'spin_5x3' ? 5 : 3;
  const symbols = ENGINE_SYMBOLS[engine];
  const wildId = getWildId(engine);
  const nonWilds = symbols.filter((s) => s.id !== wildId);

  for (let attempt = 0; attempt < 35; attempt++) {
    const grid: SlotSymbolId[][] = Array.from({ length: 3 }, () =>
      Array.from({ length: cols }, () => pickWeighted(symbols).id)
    );

    if (crypto.randomInt(0, 100) < 36) {
      const tease = pickWeighted(nonWilds).id;
      grid[1][0] = tease;
      grid[1][1] = tease;
      const alts = nonWilds.filter((s) => s.id !== tease);
      grid[1][2] = alts[crypto.randomInt(0, alts.length)].id;
    }

    const check = evaluateLineSlotGrid(engine, grid, 1, 25);
    if (check.winningLines.length === 0) {
      return grid;
    }
  }

  return Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const idx = (r * 2 + c) % nonWilds.length;
      return nonWilds[idx].id;
    })
  );
}

function makeWinningLineGrid(
  engine: SlotEngineType,
  maxMultiplier: number
): { grid: SlotSymbolId[][]; multiplierReel: number } {
  const layoutMode = getLayoutMode(engine);
  const cols = layoutMode === 'spin_5x3' ? 5 : 3;
  const symbols = ENGINE_SYMBOLS[engine];
  const wildId = getWildId(engine);
  const paylines = layoutMode === 'spin_5x3' ? PAYLINES_5X3 : PAYLINES_3X3;

  const chosenMultReel = isHotMultSlot(engine)
    ? pickWeighted(HOT7_MULTIPLIER_REEL).value
    : 1;

  const eligible = symbols.filter((s) => s.multiplier <= maxMultiplier);
  const targetSymbol = pickWeighted(eligible.length > 0 ? eligible : [symbols[0]]);
  const targetLine = paylines[crypto.randomInt(0, paylines.length)];
  const targetLength =
    layoutMode === 'spin_5x3'
      ? crypto.randomInt(0, 100) < 70
        ? 3
        : crypto.randomInt(0, 100) < 72
          ? 4
          : 5
      : 3;

  const useWildAssist =
    targetSymbol.id !== wildId && crypto.randomInt(0, 100) < 22;
  const wildSlotIdx = crypto.randomInt(0, targetLength);

  for (let attempt = 0; attempt < 25; attempt++) {
    const grid: SlotSymbolId[][] = Array.from({ length: 3 }, () =>
      Array.from({ length: cols }, () => pickWeighted(symbols).id)
    );

    targetLine.cells.slice(0, targetLength).forEach(([r, c], idx) => {
      grid[r][c] = useWildAssist && idx === wildSlotIdx ? wildId : targetSymbol.id;
    });

    const evalRes = evaluateLineSlotGrid(engine, grid, chosenMultReel, maxMultiplier);
    if (evalRes.winningLines.length >= 1 && evalRes.totalMultiplier > 0) {
      if (evalRes.winningLines.length === 1 || crypto.randomInt(0, 100) < 20) {
        return { grid, multiplierReel: chosenMultReel };
      }
    }
  }

  const nonWilds = symbols.filter((s) => s.id !== wildId && s.id !== targetSymbol.id);
  const fallbackGrid: SlotSymbolId[][] = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: cols }, (_, c) => nonWilds[(r * 2 + c) % nonWilds.length].id)
  );
  for (const [r, c] of targetLine.cells.slice(0, targetLength)) {
    fallbackGrid[r][c] = targetSymbol.id;
  }
  return { grid: fallbackGrid, multiplierReel: chosenMultReel };
}

function makeMegawaysSpin(params: {
  engine: SlotEngineType;
  playerWins: boolean;
  maxMultiplier: number;
}): GeneratedSlotSpin {
  const { engine, playerWins, maxMultiplier } = params;
  const symbols = ENGINE_SYMBOLS[engine];
  const wildId = getWildId(engine);
  const nonWilds = symbols.filter((s) => s.id !== wildId);
  const isSixReel = isMegaways6Reel(engine);
  const reelCount = isSixReel ? 6 : 5;
  const maxRows = isSixReel ? 6 : 5;

  const randomHeights = () =>
    Array.from({ length: reelCount }, () => crypto.randomInt(2, maxRows + 1));

  if (!playerWins) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const heights = randomHeights();
      const columns = heights.map((h) =>
        Array.from({ length: h }, () => pickWeighted(symbols).id)
      );
      const evalRes = evaluateMegawaysBoard(engine, columns, 1);
      if (evalRes.winningLines.length === 0) {
        return {
          engine,
          layoutMode: 'megaways',
          grid: columns,
          columns,
          waysCount: evalRes.waysCount,
          winningLines: [],
          baseMultiplier: 0,
          multiplierReel: 1,
          totalMultiplier: 0,
          cascades: [],
        };
      }
    }

    const heights = randomHeights();
    const symA = nonWilds[0].id;
    const symB = nonWilds[1].id;
    const symC = nonWilds[2].id;
    const symD = nonWilds[3].id;
    const columns = heights.map((h, colIdx) =>
      Array.from({ length: h }, () =>
        colIdx === 2 ? symD : colIdx % 2 === 0 ? symA : crypto.randomInt(0, 2) === 0 ? symB : symC
      )
    );
    const evalRes = evaluateMegawaysBoard(engine, columns, 1);
    return {
      engine,
      layoutMode: 'megaways',
      grid: columns,
      columns,
      waysCount: evalRes.waysCount,
      winningLines: [],
      baseMultiplier: 0,
      multiplierReel: 1,
      totalMultiplier: 0,
      cascades: [],
    };
  }

  const heights = randomHeights();
  let initialColumns: SlotSymbolId[][] = heights.map((h) =>
    Array.from({ length: h }, () => pickWeighted(symbols).id)
  );
  const targetSym = pickWeighted(symbols);
  const targetReels = crypto.randomInt(0, 100) < 68 ? 3 : crypto.randomInt(0, 100) < 75 ? 4 : Math.min(reelCount, 5);

  for (let c = 0; c < targetReels; c++) {
    const rowIdx = crypto.randomInt(0, initialColumns[c].length);
    initialColumns[c][rowIdx] = targetSym.id;
    if (initialColumns[c].length >= 3 && crypto.randomInt(0, 100) < 28) {
      const secondRow = (rowIdx + 1) % initialColumns[c].length;
      initialColumns[c][secondRow] = targetSym.id;
    }
  }

  const cascades: MegawaysCascadeStep[] = [];
  let workingCols = initialColumns.map((col) => [...col]);
  let cascadeMult = 1;
  let runningTotalMult = 0;
  let firstEval = evaluateMegawaysBoard(engine, workingCols, 1);

  for (let step = 0; step < 3; step++) {
    const stepEval = evaluateMegawaysBoard(engine, workingCols, cascadeMult);
    if (stepEval.winningLines.length === 0) break;

    if (step === 0) firstEval = stepEval;
    runningTotalMult = roundMult(runningTotalMult + stepEval.stepMultiplier);

    cascades.push({
      columns: workingCols.map((col) => [...col]),
      waysCount: stepEval.waysCount,
      cascadeMultiplier: cascadeMult,
      winningLines: stepEval.winningLines,
      stepMultiplier: stepEval.stepMultiplier,
    });

    if (runningTotalMult >= maxMultiplier) break;

    cascadeMult += 1;
    const allowContinueCascade = step === 0 && crypto.randomInt(0, 100) < 42;
    workingCols = workingCols.map((col, colIdx) => {
      const survivors = col.filter((_, rowIdx) => !stepEval.matchedCellKeys.has(`${colIdx}-${rowIdx}`));
      const needed = col.length - survivors.length;
      const refills = Array.from({ length: needed }, () => {
        if (!allowContinueCascade && colIdx === 2) {
          return nonWilds[(colIdx + crypto.randomInt(0, nonWilds.length)) % nonWilds.length].id;
        }
        return pickWeighted(symbols).id;
      });
      return [...refills, ...survivors];
    });

    if (!allowContinueCascade) {
      const col0Set = new Set(workingCols[0]);
      const col2Set = workingCols[2];
      for (let r = 0; r < col2Set.length; r++) {
        if (col2Set[r] === wildId || col0Set.has(col2Set[r])) {
          const safeChoice = nonWilds.find((s) => !col0Set.has(s.id));
          if (safeChoice) col2Set[r] = safeChoice.id;
        }
      }
    }
  }

  if (cascades.length === 0) {
    const forced = makeWinningLineGridFallbackMegaways(engine, heights, targetSym.id);
    initialColumns = forced;
    firstEval = evaluateMegawaysBoard(engine, initialColumns, 1);
    cascades.push({
      columns: initialColumns.map((col) => [...col]),
      waysCount: firstEval.waysCount,
      cascadeMultiplier: 1,
      winningLines: firstEval.winningLines,
      stepMultiplier: firstEval.stepMultiplier,
    });
    runningTotalMult = firstEval.stepMultiplier;
  }

  const finalTotalMult = Math.min(Math.max(1.5, maxMultiplier), Math.max(0.6, runningTotalMult));

  return {
    engine,
    layoutMode: 'megaways',
    grid: initialColumns,
    columns: initialColumns,
    waysCount: firstEval.waysCount,
    winningLines: firstEval.winningLines,
    baseMultiplier: firstEval.stepMultiplier,
    multiplierReel: cascades.length,
    totalMultiplier: roundMult(finalTotalMult),
    cascades,
  };
}

function makeWinningLineGridFallbackMegaways(
  engine: SlotEngineType,
  heights: number[],
  symId: SlotSymbolId
): SlotSymbolId[][] {
  const nonWilds = ENGINE_SYMBOLS[engine].filter((s) => !s.isWild && s.id !== symId);
  return heights.map((h, colIdx) =>
    Array.from({ length: h }, (_, rowIdx) =>
      colIdx < 3 && rowIdx === 0 ? symId : nonWilds[(colIdx + rowIdx) % nonWilds.length].id
    )
  );
}

export function generateAuthoritativeSlotSpin(params: {
  engine: SlotEngineType;
  playerWinPercent: number;
  maxMultiplier: number;
  forceWin?: boolean;
}): GeneratedSlotSpin {
  const safeWinPct = Math.max(5, Math.min(95, Math.round(params.playerWinPercent || 30)));
  const roll = crypto.randomInt(0, 10000);
  const playerWins = params.forceWin ? true : roll < safeWinPct * 100;
  const layoutMode = getLayoutMode(params.engine);

  if (layoutMode === 'megaways') {
    return makeMegawaysSpin({
      engine: params.engine,
      playerWins,
      maxMultiplier: params.maxMultiplier,
    });
  }

  if (playerWins) {
    const { grid, multiplierReel } = makeWinningLineGrid(
      params.engine,
      params.maxMultiplier
    );
    const evaluated = evaluateLineSlotGrid(
      params.engine,
      grid,
      multiplierReel,
      params.maxMultiplier
    );
    return {
      engine: params.engine,
      grid,
      ...evaluated,
    };
  }

  const lossGrid = makeNonWinningLineGrid(params.engine);
  const lossMultReel = isHotMultSlot(params.engine)
    ? pickWeighted(HOT7_MULTIPLIER_REEL).value
    : 1;
  const evaluated = evaluateLineSlotGrid(
    params.engine,
    lossGrid,
    lossMultReel,
    params.maxMultiplier
  );

  return {
    engine: params.engine,
    grid: lossGrid,
    ...evaluated,
  };
}

export function generateBonusVaults(params: {
  playerWinPercent: number;
  maxMultiplier: number;
}): GeneratedBonusVault[] {
  const safeWinPct = Math.max(5, Math.min(95, Math.round(params.playerWinPercent || 30)));
  // Calibrate bonus vault generosity around house edge while staying exciting for Bonus Buys & mid-game drops
  const boostFactor = safeWinPct >= 45 ? 1.25 : safeWinPct <= 25 ? 0.85 : 1.0;
  const cap = Math.max(4, params.maxMultiplier || 20);

  const rawPrizes: Array<{ kind: 'mult' | 'freespins'; value: number; label: string }> = [
    { kind: 'mult', value: roundMult(Math.min(cap * 0.25, 2.0 * boostFactor)), label: `${roundMult(Math.min(cap * 0.25, 2.0 * boostFactor))}x Vault` },
    { kind: 'mult', value: roundMult(Math.min(cap * 0.35, 3.5 * boostFactor)), label: `${roundMult(Math.min(cap * 0.35, 3.5 * boostFactor))}x Gold Chest` },
    { kind: 'mult', value: roundMult(Math.min(cap * 0.5, 5.0 * boostFactor)), label: `${roundMult(Math.min(cap * 0.5, 5.0 * boostFactor))}x Royal Jackpot` },
    { kind: 'mult', value: roundMult(Math.min(cap * 0.65, 8.0 * boostFactor)), label: `${roundMult(Math.min(cap * 0.65, 8.0 * boostFactor))}x Grand Vault` },
    { kind: 'mult', value: roundMult(Math.min(cap * 0.8, 10.0 * boostFactor)), label: `${roundMult(Math.min(cap * 0.8, 10.0 * boostFactor))}x Crown Prize` },
    { kind: 'freespins', value: 5, label: '+5 Free Spins' },
  ];

  // Fisher-Yates shuffle
  for (let i = rawPrizes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [rawPrizes[i], rawPrizes[j]] = [rawPrizes[j], rawPrizes[i]];
  }

  return rawPrizes.map((item, idx) => ({
    index: idx,
    kind: item.kind,
    value: item.value,
    label: item.label,
  }));
}
