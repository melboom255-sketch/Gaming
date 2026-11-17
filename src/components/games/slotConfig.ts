import type {
  MegawaysCascadeStep,
  SlotEngineType,
  SlotLayoutMode,
  SlotSpinResultData,
  SlotSymbolId,
  SlotWinningLine,
} from '@/src/types/platform';

export interface SlotSymbolMeta {
  id: SlotSymbolId;
  name: string;
  multiplier: number;
  accentHex: string;
  badgeText?: string;
}

export const FRUIT_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'star', name: 'Wild Star', multiplier: 12.0, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'bell', name: 'Golden Bell', multiplier: 7.5, accentHex: '#F59E0B' },
  { id: 'watermelon', name: 'Watermelon', multiplier: 5.0, accentHex: '#10B981' },
  { id: 'grapes', name: 'Grapes', multiplier: 3.5, accentHex: '#A855F7' },
  { id: 'orange', name: 'Orange', multiplier: 2.5, accentHex: '#FB923C' },
  { id: 'lemon', name: 'Lemon', multiplier: 2.0, accentHex: '#FACC15' },
  { id: 'cherry', name: 'Cherry', multiplier: 1.5, accentHex: '#F43F5E' },
];

export const HOT7_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'triple7', name: 'Crown 777', multiplier: 10.0, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'double7', name: 'Blazing 77', multiplier: 7.0, accentHex: '#F97316' },
  { id: 'seven', name: 'Hot Red 7', multiplier: 4.5, accentHex: '#EF4444' },
  { id: 'diamond', name: 'Diamond', multiplier: 3.5, accentHex: '#38BDF8' },
  { id: 'bell', name: 'Golden Bell', multiplier: 2.5, accentHex: '#F59E0B' },
  { id: 'bar2', name: 'Double BAR', multiplier: 2.0, accentHex: '#C084FC' },
  { id: 'bar1', name: 'Single BAR', multiplier: 1.5, accentHex: '#94A3B8' },
];

export const HOT_INFERNO_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'inferno_wild', name: 'Inferno Wild', multiplier: 11.0, accentHex: '#FB923C', badgeText: 'WILD' },
  { id: 'inferno_777', name: 'Inferno 777', multiplier: 6.5, accentHex: '#EF4444' },
  { id: 'molten_bell', name: 'Molten Bell', multiplier: 3.8, accentHex: '#F59E0B' },
  { id: 'flame_dice', name: 'Flame Dice', multiplier: 2.8, accentHex: '#FB7185' },
  { id: 'ruby_heart', name: 'Ruby Heart', multiplier: 2.2, accentHex: '#F43F5E' },
  { id: 'gold_ingot', name: 'Bullion Ingot', multiplier: 1.6, accentHex: '#FACC15' },
];

export const SAFARI_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'lion_wild', name: 'Lion Crown', multiplier: 8.0, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'elephant', name: 'Elephant', multiplier: 4.5, accentHex: '#60A5FA' },
  { id: 'rhino', name: 'Black Rhino', multiplier: 3.0, accentHex: '#94A3B8' },
  { id: 'zebra', name: 'Zebra', multiplier: 2.2, accentHex: '#E2E8F0' },
  { id: 'acacia', name: 'Sunset Acacia', multiplier: 1.8, accentHex: '#FB923C' },
  { id: 'shield', name: 'Tribal Shield', multiplier: 1.4, accentHex: '#EF4444' },
];

export const PHARAOH_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'pharaoh_wild', name: 'Pharaoh Mask', multiplier: 9.0, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'sphinx', name: 'Royal Sphinx', multiplier: 4.8, accentHex: '#F59E0B' },
  { id: 'scarab', name: 'Golden Scarab', multiplier: 3.2, accentHex: '#10B981' },
  { id: 'horus', name: 'Eye of Horus', multiplier: 2.4, accentHex: '#38BDF8' },
  { id: 'ankh', name: 'Golden Ankh', multiplier: 1.8, accentHex: '#FDE047' },
  { id: 'lotus', name: 'Nile Lotus', multiplier: 1.4, accentHex: '#C084FC' },
];

export const CANDY_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'candy_wild', name: 'Rainbow Bomb', multiplier: 8.5, accentHex: '#F472B6', badgeText: 'WILD' },
  { id: 'lollipop', name: 'Spiral Pop', multiplier: 4.5, accentHex: '#FB7185' },
  { id: 'cupcake', name: 'Cupcake', multiplier: 3.0, accentHex: '#C084FC' },
  { id: 'candystar', name: 'Sugar Star', multiplier: 2.2, accentHex: '#FACC15' },
  { id: 'donut', name: 'Glazed Donut', multiplier: 1.8, accentHex: '#F97316' },
  { id: 'gummy', name: 'Gummy Bear', multiplier: 1.4, accentHex: '#34D399' },
];

export const SPY_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'spy_wild', name: 'Agent 007 Wild', multiplier: 9.5, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'spy_car', name: 'Stealth Coupe', multiplier: 5.2, accentHex: '#94A3B8' },
  { id: 'spy_briefcase', name: 'Gold Briefcase', multiplier: 3.6, accentHex: '#F59E0B' },
  { id: 'spy_pistol', name: 'Silenced Pistol', multiplier: 2.6, accentHex: '#CBD5E1' },
  { id: 'spy_watch', name: 'Laser Watch', multiplier: 2.0, accentHex: '#38BDF8' },
  { id: 'spy_passport', name: 'Cipher Passport', multiplier: 1.5, accentHex: '#60A5FA' },
];

export const VIKING_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'viking_wild', name: 'Valhalla Wild', multiplier: 9.0, accentHex: '#38BDF8', badgeText: 'WILD' },
  { id: 'viking_helm', name: 'Horned Helm', multiplier: 5.0, accentHex: '#F59E0B' },
  { id: 'battle_axe', name: 'Twin Battle Axe', multiplier: 3.5, accentHex: '#94A3B8' },
  { id: 'longship', name: 'Dragon Longship', multiplier: 2.6, accentHex: '#22D3EE' },
  { id: 'thor_hammer', name: "Thor's Hammer", multiplier: 2.0, accentHex: '#60A5FA' },
  { id: 'runestone', name: 'Norse Runestone', multiplier: 1.5, accentHex: '#2DD4BF' },
];

export const DRAGON_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'dragon_wild', name: 'Emperor Dragon', multiplier: 9.5, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'jade_tiger', name: 'Jade Tiger', multiplier: 5.0, accentHex: '#10B981' },
  { id: 'red_lantern', name: 'Silk Lantern', multiplier: 3.4, accentHex: '#EF4444' },
  { id: 'koi_fish', name: 'Golden Koi', multiplier: 2.5, accentHex: '#FB923C' },
  { id: 'gold_sycee', name: 'Gold Sycee', multiplier: 2.0, accentHex: '#FACC15' },
  { id: 'fortune_fan', name: 'Imperial Fan', multiplier: 1.5, accentHex: '#F43F5E' },
];

export const WILD_WEST_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'sheriff_wild', name: 'Sheriff Star Wild', multiplier: 8.8, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'revolver', name: 'Dual Colts', multiplier: 4.8, accentHex: '#94A3B8' },
  { id: 'dynamite', name: 'TNT Bundle', multiplier: 3.3, accentHex: '#EF4444' },
  { id: 'cowboy_hat', name: 'Outlaw Stetson', multiplier: 2.4, accentHex: '#D97706' },
  { id: 'horseshoe', name: 'Lucky Horseshoe', multiplier: 1.9, accentHex: '#FACC15' },
  { id: 'whiskey_barrel', name: 'Oak Barrel', multiplier: 1.4, accentHex: '#EA580C' },
];

export const VEGAS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'vip_wild', name: 'Vegas VIP Wild', multiplier: 9.5, accentHex: '#E879F9', badgeText: 'WILD' },
  { id: 'roulette_wheel', name: 'Roulette Wheel', multiplier: 5.2, accentHex: '#FB7185' },
  { id: 'royal_cards', name: 'Royal Flush', multiplier: 3.5, accentHex: '#A855F7' },
  { id: 'champagne', name: 'VIP Champagne', multiplier: 2.6, accentHex: '#FBBF24' },
  { id: 'casino_dice', name: 'Neon Craps Dice', multiplier: 2.0, accentHex: '#38BDF8' },
  { id: 'sports_car', name: 'Strip Supercar', multiplier: 1.5, accentHex: '#F472B6' },
];

export const CLOVER_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'clover_wild', name: 'Leprechaun Wild', multiplier: 9.0, accentHex: '#34D399', badgeText: 'WILD' },
  { id: 'pot_of_gold', name: 'Pot of Gold', multiplier: 5.0, accentHex: '#FBBF24' },
  { id: 'four_clover', name: 'Emerald Clover', multiplier: 3.4, accentHex: '#10B981' },
  { id: 'golden_harp', name: 'Celtic Harp', multiplier: 2.4, accentHex: '#FACC15' },
  { id: 'rainbow_boot', name: 'Lucky Boot', multiplier: 1.9, accentHex: '#2DD4BF' },
  { id: 'emerald_pint', name: 'Emerald Stout', multiplier: 1.4, accentHex: '#34D399' },
];

export const AXUM_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'axum_wild', name: 'Axum Lion Wild', multiplier: 4.5, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'obelisk', name: 'Axum Obelisk', multiplier: 2.8, accentHex: '#F59E0B' },
  { id: 'royal_crown', name: 'Royal Crown', multiplier: 1.8, accentHex: '#EF4444' },
  { id: 'emerald_scarab', name: 'Emerald Scarab', multiplier: 1.2, accentHex: '#10B981' },
  { id: 'amber_gem', name: 'Amber Gem', multiplier: 0.9, accentHex: '#FB923C' },
  { id: 'gold_coin', name: 'Axum Coin', multiplier: 0.6, accentHex: '#FDE047' },
];

export const COSMIC_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'nebula_wild', name: 'Nebula Wild', multiplier: 4.5, accentHex: '#E879F9', badgeText: 'WILD' },
  { id: 'plasma', name: 'Plasma Nova', multiplier: 3.0, accentHex: '#F97316' },
  { id: 'sapphire', name: 'Sapphire Core', multiplier: 1.9, accentHex: '#38BDF8' },
  { id: 'amethyst', name: 'Amethyst Shard', multiplier: 1.3, accentHex: '#A855F7' },
  { id: 'emerald_gem', name: 'Emerald Prism', multiplier: 0.9, accentHex: '#10B981' },
  { id: 'opal', name: 'Starlight Opal', multiplier: 0.6, accentHex: '#93C5FD' },
];

export const PIRATE_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'pirate_wild', name: 'Corsair Wild', multiplier: 4.6, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'treasure_chest', name: 'Sunken Chest', multiplier: 2.9, accentHex: '#F59E0B' },
  { id: 'pirate_ship', name: 'Black Galleon', multiplier: 1.9, accentHex: '#38BDF8' },
  { id: 'brass_compass', name: 'Gold Compass', multiplier: 1.3, accentHex: '#FACC15' },
  { id: 'spyglass', name: 'Brass Spyglass', multiplier: 0.95, accentHex: '#D97706' },
  { id: 'rum_bottle', name: 'Captain Rum', multiplier: 0.65, accentHex: '#34D399' },
];

export const ZEUS_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'zeus_wild', name: 'Zeus Bolt Wild', multiplier: 4.8, accentHex: '#38BDF8', badgeText: 'WILD' },
  { id: 'pegasus', name: 'Winged Pegasus', multiplier: 3.0, accentHex: '#67E8F9' },
  { id: 'olympus_temple', name: 'Olympus Temple', multiplier: 2.0, accentHex: '#FBBF24' },
  { id: 'golden_chalice', name: 'Ambrosia Chalice', multiplier: 1.35, accentHex: '#F59E0B' },
  { id: 'lightning_ring', name: 'Storm Ring', multiplier: 0.95, accentHex: '#60A5FA' },
  { id: 'marble_lyre', name: 'Golden Lyre', multiplier: 0.65, accentHex: '#FDE047' },
];

export const GLADIATOR_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'gladiator_wild', name: 'Gladiator Wild', multiplier: 4.7, accentHex: '#EF4444', badgeText: 'WILD' },
  { id: 'roman_helm', name: 'Centurion Helm', multiplier: 2.95, accentHex: '#F59E0B' },
  { id: 'golden_eagle', name: 'Imperial Eagle', multiplier: 1.95, accentHex: '#FBBF24' },
  { id: 'war_chariot', name: 'War Chariot', multiplier: 1.35, accentHex: '#FB923C' },
  { id: 'gladius_shield', name: 'Arena Shield', multiplier: 0.95, accentHex: '#FB7185' },
  { id: 'colosseum_coin', name: 'Denarius Coin', multiplier: 0.65, accentHex: '#FDE047' },
];

export const SHEBA_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'axum_wild', name: 'Queen Wild', multiplier: 4.8, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'royal_crown', name: 'Sheba Crown', multiplier: 3.0, accentHex: '#F59E0B' },
  { id: 'golden_chalice', name: 'Queen Chalice', multiplier: 1.95, accentHex: '#FB923C' },
  { id: 'lotus', name: 'Nile Blossom', multiplier: 1.35, accentHex: '#C084FC' },
  { id: 'amber_gem', name: 'Highland Amber', multiplier: 0.95, accentHex: '#F97316' },
  { id: 'gold_coin', name: 'Sheba Coin', multiplier: 0.65, accentHex: '#FDE047' },
];

export const LALIBELA_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'pharaoh_wild', name: 'Lalibela Wild', multiplier: 4.7, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'gold_ingot', name: 'Sacred Gold', multiplier: 2.95, accentHex: '#F59E0B' },
  { id: 'obelisk', name: 'Stone Stele', multiplier: 1.9, accentHex: '#D97706' },
  { id: 'emerald_scarab', name: 'Emerald Relic', multiplier: 1.3, accentHex: '#10B981' },
  { id: 'ankh', name: 'Sacred Cross', multiplier: 0.95, accentHex: '#FDE047' },
  { id: 'colosseum_coin', name: 'Monolith Coin', multiplier: 0.6, accentHex: '#FACC15' },
];

export const ABAY_NILE_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'axum_wild', name: 'Abay Wild', multiplier: 9.2, accentHex: '#38BDF8', badgeText: 'WILD' },
  { id: 'sphinx', name: 'Guardian Lion', multiplier: 4.9, accentHex: '#F59E0B' },
  { id: 'golden_chalice', name: 'Royal Vessel', multiplier: 3.4, accentHex: '#FBBF24' },
  { id: 'emerald_scarab', name: 'Nile Scarab', multiplier: 2.5, accentHex: '#10B981' },
  { id: 'gold_coin', name: 'River Gold', multiplier: 1.9, accentHex: '#FACC15' },
  { id: 'lotus', name: 'Blue Nile Lotus', multiplier: 1.4, accentHex: '#60A5FA' },
];

export const BLAZING_DIAMOND_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'triple7', name: 'Diamond 777', multiplier: 11.5, accentHex: '#38BDF8', badgeText: 'WILD' },
  { id: 'seven', name: 'Blazing 7', multiplier: 6.0, accentHex: '#EF4444' },
  { id: 'diamond', name: 'Flawless Gem', multiplier: 4.0, accentHex: '#7DD3FC' },
  { id: 'sapphire', name: 'Blue Diamond', multiplier: 3.0, accentHex: '#3B82F6' },
  { id: 'bar2', name: 'Gold 2BAR', multiplier: 2.2, accentHex: '#F59E0B' },
  { id: 'bar1', name: 'Silver BAR', multiplier: 1.6, accentHex: '#94A3B8' },
];

export const TROPICAL_BERRY_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'candy_wild', name: 'Star Burst', multiplier: 8.8, accentHex: '#F472B6', badgeText: 'WILD' },
  { id: 'watermelon', name: 'Melon Slice', multiplier: 4.6, accentHex: '#10B981' },
  { id: 'grapes', name: 'Berry Bunch', multiplier: 3.2, accentHex: '#A855F7' },
  { id: 'orange', name: 'Sweet Mango', multiplier: 2.3, accentHex: '#FB923C' },
  { id: 'lemon', name: 'Sun Citrus', multiplier: 1.8, accentHex: '#FACC15' },
  { id: 'cherry', name: 'Wild Cherry', multiplier: 1.4, accentHex: '#F43F5E' },
];

export const GOLD_BULLION_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'vip_wild', name: 'Vault Wild', multiplier: 9.5, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'royal_crown', name: 'Sovereign Crown', multiplier: 5.2, accentHex: '#F59E0B' },
  { id: 'spy_briefcase', name: 'Reserve Case', multiplier: 3.6, accentHex: '#EAB308' },
  { id: 'gold_ingot', name: '24K Bullion', multiplier: 2.7, accentHex: '#FACC15' },
  { id: 'gold_sycee', name: 'Imperial Ingot', multiplier: 2.0, accentHex: '#FB923C' },
  { id: 'gold_coin', name: 'Mint Coin', multiplier: 1.5, accentHex: '#FDE047' },
];

export const RUBY_STARLIGHT_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'star', name: 'Starlight Wild', multiplier: 11.0, accentHex: '#F472B6', badgeText: 'WILD' },
  { id: 'inferno_777', name: 'Ruby 777', multiplier: 6.8, accentHex: '#FB7185' },
  { id: 'double7', name: 'Starlight 77', multiplier: 4.2, accentHex: '#E879F9' },
  { id: 'flame_dice', name: 'Star Dice', multiplier: 2.9, accentHex: '#C084FC' },
  { id: 'amethyst', name: 'Violet Star', multiplier: 2.2, accentHex: '#A855F7' },
  { id: 'ruby_heart', name: 'Ruby Gem', multiplier: 1.6, accentHex: '#F43F5E' },
];

export const GOLDEN_BELL_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'triple7', name: 'Bell 777 Wild', multiplier: 10.5, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'bell', name: 'Grand Bell', multiplier: 5.5, accentHex: '#F59E0B' },
  { id: 'molten_bell', name: 'Chime Bell', multiplier: 3.8, accentHex: '#FB923C' },
  { id: 'diamond', name: 'White Gem', multiplier: 2.8, accentHex: '#38BDF8' },
  { id: 'bar1', name: 'Classic BAR', multiplier: 2.0, accentHex: '#94A3B8' },
  { id: 'cherry', name: 'Jackpot Cherry', multiplier: 1.5, accentHex: '#F43F5E' },
];

export const SAMURAI_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'dragon_wild', name: 'Shogun Wild', multiplier: 4.7, accentHex: '#EF4444', badgeText: 'WILD' },
  { id: 'red_lantern', name: 'Dojo Lantern', multiplier: 2.95, accentHex: '#F43F5E' },
  { id: 'jade_tiger', name: 'Jade Katana', multiplier: 1.95, accentHex: '#10B981' },
  { id: 'koi_fish', name: 'Shogun Koi', multiplier: 1.35, accentHex: '#FB923C' },
  { id: 'gold_sycee', name: 'Koban Gold', multiplier: 0.95, accentHex: '#FACC15' },
  { id: 'fortune_fan', name: 'War Fan', multiplier: 0.65, accentHex: '#FB7185' },
];

export const ATLANTIS_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'pirate_wild', name: 'Kraken Wild', multiplier: 4.7, accentHex: '#22D3EE', badgeText: 'WILD' },
  { id: 'treasure_chest', name: 'Atlantis Chest', multiplier: 2.95, accentHex: '#F59E0B' },
  { id: 'sapphire', name: 'Trident Gem', multiplier: 1.95, accentHex: '#38BDF8' },
  { id: 'brass_compass', name: 'Abyss Compass', multiplier: 1.35, accentHex: '#FACC15' },
  { id: 'opal', name: 'Sea Pearl', multiplier: 0.95, accentHex: '#67E8F9' },
  { id: 'rum_bottle', name: 'Message Bottle', multiplier: 0.65, accentHex: '#34D399' },
];

export const CYBERPUNK_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'nebula_wild', name: 'Matrix Wild', multiplier: 4.8, accentHex: '#E879F9', badgeText: 'WILD' },
  { id: 'sports_car', name: 'Neon Interceptor', multiplier: 2.95, accentHex: '#F472B6' },
  { id: 'plasma', name: 'Cyber Core', multiplier: 1.95, accentHex: '#38BDF8' },
  { id: 'lightning_ring', name: 'Pulse Coil', multiplier: 1.35, accentHex: '#22D3EE' },
  { id: 'spy_watch', name: 'Neural Link', multiplier: 0.95, accentHex: '#60A5FA' },
  { id: 'casino_dice', name: 'Holo Cube', multiplier: 0.65, accentHex: '#A855F7' },
];

export const VOLCANO_MEGAWAYS_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'inferno_wild', name: 'Eruption Wild', multiplier: 4.8, accentHex: '#F97316', badgeText: 'WILD' },
  { id: 'plasma', name: 'Caldera Core', multiplier: 3.0, accentHex: '#EF4444' },
  { id: 'molten_bell', name: 'Volcano Gong', multiplier: 1.95, accentHex: '#F59E0B' },
  { id: 'ruby_heart', name: 'Lava Ruby', multiplier: 1.35, accentHex: '#FB7185' },
  { id: 'flame_dice', name: 'Ember Cube', multiplier: 0.95, accentHex: '#FB923C' },
  { id: 'amber_gem', name: 'Magma Shard', multiplier: 0.65, accentHex: '#FACC15' },
];

export const VALHALLA_STORM_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'viking_wild', name: 'Valhalla Wild', multiplier: 4.8, accentHex: '#38BDF8', badgeText: 'WILD' },
  { id: 'viking_helm', name: 'Odin Helm', multiplier: 2.95, accentHex: '#F59E0B' },
  { id: 'longship', name: 'Storm Longship', multiplier: 1.95, accentHex: '#22D3EE' },
  { id: 'battle_axe', name: 'Frost Axe', multiplier: 1.35, accentHex: '#94A3B8' },
  { id: 'lightning_ring', name: 'Thunder Ring', multiplier: 0.95, accentHex: '#60A5FA' },
  { id: 'runestone', name: 'Storm Rune', multiplier: 0.65, accentHex: '#2DD4BF' },
];

export const CYBER_HEIST_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'spy_wild', name: 'Cipher Wild', multiplier: 9.5, accentHex: '#A78BFA', badgeText: 'WILD' },
  { id: 'spy_car', name: 'Stealth Ride', multiplier: 5.2, accentHex: '#38BDF8' },
  { id: 'spy_briefcase', name: 'Crypto Case', multiplier: 3.6, accentHex: '#F59E0B' },
  { id: 'spy_pistol', name: 'Pulse Blaster', multiplier: 2.6, accentHex: '#CBD5E1' },
  { id: 'spy_watch', name: 'Hack Watch', multiplier: 2.0, accentHex: '#22D3EE' },
  { id: 'spy_passport', name: 'Keycard', multiplier: 1.5, accentHex: '#60A5FA' },
];

export const OUTLAW_TRAIN_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'sheriff_wild', name: 'Outlaw Wild', multiplier: 9.0, accentHex: '#FBBF24', badgeText: 'WILD' },
  { id: 'gold_ingot', name: 'Train Bullion', multiplier: 5.0, accentHex: '#F59E0B' },
  { id: 'dynamite', name: 'Rail Charge', multiplier: 3.4, accentHex: '#EF4444' },
  { id: 'cowboy_hat', name: 'Bandit Hat', multiplier: 2.5, accentHex: '#D97706' },
  { id: 'horseshoe', name: 'Iron Shoe', multiplier: 1.9, accentHex: '#FACC15' },
  { id: 'whiskey_barrel', name: 'Powder Keg', multiplier: 1.4, accentHex: '#EA580C' },
];

export const ARABIAN_GENIE_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'pharaoh_wild', name: 'Genie Wild', multiplier: 9.2, accentHex: '#A855F7', badgeText: 'WILD' },
  { id: 'royal_crown', name: 'Sultan Crown', multiplier: 5.0, accentHex: '#F59E0B' },
  { id: 'scarab', name: 'Oasis Jewel', multiplier: 3.4, accentHex: '#10B981' },
  { id: 'golden_chalice', name: 'Magic Lamp', multiplier: 2.5, accentHex: '#FBBF24' },
  { id: 'amber_gem', name: 'Sultan Amber', multiplier: 1.9, accentHex: '#FB923C' },
  { id: 'lotus', name: 'Desert Rose', multiplier: 1.4, accentHex: '#C084FC' },
];

export const AZTEC_SUN_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'lion_wild', name: 'Sun God Wild', multiplier: 9.2, accentHex: '#F59E0B', badgeText: 'WILD' },
  { id: 'sphinx', name: 'Jaguar Idol', multiplier: 5.0, accentHex: '#FBBF24' },
  { id: 'obelisk', name: 'Sun Pyramid', multiplier: 3.4, accentHex: '#D97706' },
  { id: 'emerald_scarab', name: 'Jungle Jade', multiplier: 2.5, accentHex: '#10B981' },
  { id: 'gold_coin', name: 'Aztec Medallion', multiplier: 1.9, accentHex: '#FACC15' },
  { id: 'shield', name: 'Sun Totem', multiplier: 1.4, accentHex: '#EF4444' },
];

export const IMPERIAL_PANDA_SYMBOLS_META: SlotSymbolMeta[] = [
  { id: 'dragon_wild', name: 'Emperor Wild', multiplier: 9.4, accentHex: '#10B981', badgeText: 'WILD' },
  { id: 'jade_tiger', name: 'Jade Guardian', multiplier: 5.0, accentHex: '#34D399' },
  { id: 'red_lantern', name: 'Temple Lantern', multiplier: 3.4, accentHex: '#EF4444' },
  { id: 'koi_fish', name: 'Imperial Koi', multiplier: 2.5, accentHex: '#FB923C' },
  { id: 'fortune_fan', name: 'Silk Fan', multiplier: 1.9, accentHex: '#F43F5E' },
  { id: 'gummy', name: 'Bamboo Treat', multiplier: 1.4, accentHex: '#22C55E' },
];

export const HOT7_MULT_STOPS = [1, 2, 3, 5, 7] as const;

export const CLIENT_PAYLINES_3X3: Array<{
  lineIndex: number;
  lineName: string;
  color: string;
  cells: Array<[number, number]>;
}> = [
  { lineIndex: 1, lineName: 'Middle Line', color: '#F59E0B', cells: [[1, 0], [1, 1], [1, 2]] },
  { lineIndex: 2, lineName: 'Top Line', color: '#10B981', cells: [[0, 0], [0, 1], [0, 2]] },
  { lineIndex: 3, lineName: 'Bottom Line', color: '#38BDF8', cells: [[2, 0], [2, 1], [2, 2]] },
  { lineIndex: 4, lineName: 'Diagonal ↘', color: '#A855F7', cells: [[0, 0], [1, 1], [2, 2]] },
  { lineIndex: 5, lineName: 'Diagonal ↗', color: '#FB7185', cells: [[2, 0], [1, 1], [0, 2]] },
];

export const CLIENT_PAYLINES_5X3: Array<{
  lineIndex: number;
  lineName: string;
  color: string;
  cells: Array<[number, number]>;
}> = [
  { lineIndex: 1, lineName: 'Middle Line', color: '#F59E0B', cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]] },
  { lineIndex: 2, lineName: 'Top Line', color: '#10B981', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { lineIndex: 3, lineName: 'Bottom Line', color: '#38BDF8', cells: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] },
  { lineIndex: 4, lineName: 'V-Shape', color: '#A855F7', cells: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]] },
  { lineIndex: 5, lineName: 'Inverted V', color: '#FB7185', cells: [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]] },
  { lineIndex: 6, lineName: 'Top Crown', color: '#FBBF24', cells: [[0, 0], [0, 1], [1, 2], [0, 3], [0, 4]] },
  { lineIndex: 7, lineName: 'Bottom Crown', color: '#2DD4BF', cells: [[2, 0], [2, 1], [1, 2], [2, 3], [2, 4]] },
  { lineIndex: 8, lineName: 'Step Up', color: '#818CF8', cells: [[2, 0], [1, 1], [1, 2], [1, 3], [0, 4]] },
  { lineIndex: 9, lineName: 'Step Down', color: '#F472B6', cells: [[0, 0], [1, 1], [1, 2], [1, 3], [2, 4]] },
  { lineIndex: 10, lineName: 'Wave Line', color: '#34D399', cells: [[1, 0], [0, 1], [1, 2], [2, 3], [1, 4]] },
];

export function isHotMultEngine(engine: SlotEngineType): boolean {
  return (
    engine === 'hot7spin' ||
    engine === 'hot_inferno_777' ||
    engine === 'blazing_diamond_777' ||
    engine === 'ruby_starlight_777'
  );
}

export function isMegaways6ReelEngine(engine: SlotEngineType): boolean {
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

export function getSlotLayoutMode(engine: SlotEngineType): SlotLayoutMode {
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

export function getSymbolsForEngine(engine: SlotEngineType): SlotSymbolMeta[] {
  switch (engine) {
    case 'fruitslot':
      return FRUIT_SYMBOLS_META;
    case 'hot7spin':
      return HOT7_SYMBOLS_META;
    case 'hot_inferno_777':
      return HOT_INFERNO_SYMBOLS_META;
    case 'safari_spin':
      return SAFARI_SYMBOLS_META;
    case 'pharaoh_spin':
      return PHARAOH_SYMBOLS_META;
    case 'candy_spin':
      return CANDY_SYMBOLS_META;
    case 'spy_mission_spin':
      return SPY_SYMBOLS_META;
    case 'vikings_valhalla_spin':
      return VIKING_SYMBOLS_META;
    case 'dragon_fortune_spin':
      return DRAGON_SYMBOLS_META;
    case 'wild_west_bounty':
      return WILD_WEST_SYMBOLS_META;
    case 'neon_vegas_nights':
      return VEGAS_SYMBOLS_META;
    case 'emerald_leprechaun_spin':
      return CLOVER_SYMBOLS_META;
    case 'abyssinia_megaways':
      return AXUM_MEGAWAYS_SYMBOLS_META;
    case 'cosmic_megaways':
      return COSMIC_MEGAWAYS_SYMBOLS_META;
    case 'pirate_treasure_megaways':
      return PIRATE_MEGAWAYS_SYMBOLS_META;
    case 'zeus_olympus_megaways':
      return ZEUS_MEGAWAYS_SYMBOLS_META;
    case 'gladiator_arena_megaways':
      return GLADIATOR_MEGAWAYS_SYMBOLS_META;
    case 'sheba_crown_megaways':
      return SHEBA_MEGAWAYS_SYMBOLS_META;
    case 'lalibela_gold_megaways':
      return LALIBELA_MEGAWAYS_SYMBOLS_META;
    case 'abay_nile_riches':
      return ABAY_NILE_SYMBOLS_META;
    case 'blazing_diamond_777':
      return BLAZING_DIAMOND_SYMBOLS_META;
    case 'tropical_berry_frenzy':
      return TROPICAL_BERRY_SYMBOLS_META;
    case 'royal_gold_bullion':
      return GOLD_BULLION_SYMBOLS_META;
    case 'ruby_starlight_777':
      return RUBY_STARLIGHT_SYMBOLS_META;
    case 'golden_bell_jackpot':
      return GOLDEN_BELL_SYMBOLS_META;
    case 'samurai_blade_megaways':
      return SAMURAI_MEGAWAYS_SYMBOLS_META;
    case 'atlantis_kraken_megaways':
      return ATLANTIS_MEGAWAYS_SYMBOLS_META;
    case 'cyberpunk_matrix_megaways':
      return CYBERPUNK_MEGAWAYS_SYMBOLS_META;
    case 'volcano_eruption_megaways':
      return VOLCANO_MEGAWAYS_SYMBOLS_META;
    case 'valhalla_storm_megaways':
      return VALHALLA_STORM_SYMBOLS_META;
    case 'cyber_heist_spin':
      return CYBER_HEIST_SYMBOLS_META;
    case 'outlaw_gold_train':
      return OUTLAW_TRAIN_SYMBOLS_META;
    case 'arabian_genie_spin':
      return ARABIAN_GENIE_SYMBOLS_META;
    case 'aztec_sun_spin':
      return AZTEC_SUN_SYMBOLS_META;
    case 'imperial_panda_spin':
      return IMPERIAL_PANDA_SYMBOLS_META;
  }
}

export function getInitialGridForEngine(engine: SlotEngineType): SlotSymbolId[][] {
  const syms = getSymbolsForEngine(engine);
  const w = syms[0].id;
  const s1 = syms[1].id;
  const s2 = syms[2].id;
  const s3 = syms[3].id;
  const s4 = syms[4].id;
  const s5 = syms[5 % syms.length].id;

  const layout = getSlotLayoutMode(engine);
  if (layout === 'megaways') return [];
  if (layout === 'classic_3x3') {
    return [
      [s5, s3, s4],
      [s1, w, s1],
      [s2, s4, s5],
    ];
  }
  return [
    [s5, s3, s2, s4, s1],
    [s1, w, s1, s2, s5],
    [s4, s2, s5, s3, s4],
  ];
}

export function getInitialMegawaysColumns(engine: SlotEngineType): SlotSymbolId[][] {
  const syms = getSymbolsForEngine(engine);
  const sixReels = isMegaways6ReelEngine(engine);
  const heights = sixReels ? [4, 5, 4, 6, 3, 4] : [4, 5, 3, 4, 5];
  return heights.map((h, colIdx) =>
    Array.from({ length: h }, (_, rowIdx) => syms[(colIdx * 2 + rowIdx + 1) % syms.length].id)
  );
}

export function randomSymbolForEngine(engine: SlotEngineType): SlotSymbolId {
  const list = getSymbolsForEngine(engine);
  return list[Math.floor(Math.random() * list.length)].id;
}

export function randomMegawaysColumns(engine: SlotEngineType): SlotSymbolId[][] {
  const sixReels = isMegaways6ReelEngine(engine);
  const reelCount = sixReels ? 6 : 5;
  const maxRows = sixReels ? 6 : 5;
  return Array.from({ length: reelCount }, () => {
    const h = 2 + Math.floor(Math.random() * (maxRows - 1));
    return Array.from({ length: h }, () => randomSymbolForEngine(engine));
  });
}

// Guest-only free preview spin generator (real Birr spins always run on the server)
export function generateDemoSlotSpin(
  engine: SlotEngineType,
  maxMultiplier: number
): SlotSpinResultData {
  const layoutMode = getSlotLayoutMode(engine);
  const list = getSymbolsForEngine(engine);
  const wildId = (list.find((s) => s.badgeText === 'WILD') || list[0]).id;
  const specMap = new Map(list.map((s) => [s.id, s]));

  if (layoutMode === 'megaways') {
    const columns = randomMegawaysColumns(engine);
    if (Math.random() < 0.38) {
      const sym = list[Math.floor(Math.random() * list.length)].id;
      for (let c = 0; c < 3; c++) columns[c][0] = sym;
    }
    const waysCount = columns.reduce((a, c) => a * c.length, 1);
    const winningLines: SlotWinningLine[] = [];
    for (const spec of list) {
      let matchedReels = 0;
      let waysForSym = 1;
      const cells: Array<[number, number]> = [];
      for (let c = 0; c < columns.length; c++) {
        const rows: number[] = [];
        columns[c].forEach((cellSym, r) => {
          if (spec.id === wildId ? cellSym === wildId : cellSym === spec.id || cellSym === wildId) {
            rows.push(r);
          }
        });
        if (rows.length === 0) break;
        matchedReels++;
        waysForSym *= rows.length;
        rows.forEach((r) => cells.push([r, c]));
      }
      if (matchedReels >= 3) {
        const mult = Math.round(spec.multiplier * (matchedReels === 3 ? 1 : matchedReels === 4 ? 1.5 : 2.2) * 100) / 100;
        winningLines.push({
          lineIndex: winningLines.length + 1,
          lineName: `${matchedReels}-Reel Megaways (${waysForSym} Ways)`,
          symbolId: spec.id,
          symbolName: spec.name,
          multiplier: mult,
          matchCount: matchedReels,
          waysCount: waysForSym,
          cells,
        });
      }
    }
    const baseMultiplier = Math.round(winningLines.reduce((s, l) => s + l.multiplier, 0) * 100) / 100;
    const totalMultiplier = baseMultiplier > 0 ? Math.min(maxMultiplier, baseMultiplier) : 0;
    const cascades: MegawaysCascadeStep[] =
      winningLines.length > 0
        ? [{ columns, waysCount, cascadeMultiplier: 1, winningLines, stepMultiplier: baseMultiplier }]
        : [];
    return {
      engine,
      layoutMode,
      grid: columns,
      columns,
      waysCount,
      cascades,
      winningLines,
      baseMultiplier,
      multiplierReel: cascades.length,
      totalMultiplier,
    };
  }

  const cols = layoutMode === 'spin_5x3' ? 5 : 3;
  const paylines = layoutMode === 'spin_5x3' ? CLIENT_PAYLINES_5X3 : CLIENT_PAYLINES_3X3;
  const grid: SlotSymbolId[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: cols }, () => list[Math.floor(Math.random() * list.length)].id)
  );

  if (Math.random() < 0.36) {
    const sample = list[Math.floor(Math.random() * list.length)];
    const line = paylines[Math.floor(Math.random() * paylines.length)];
    const len = layoutMode === 'spin_5x3' ? (Math.random() < 0.7 ? 3 : 4) : 3;
    for (const [r, c] of line.cells.slice(0, len)) {
      grid[r][c] = sample.id;
    }
  }

  const multReel = isHotMultEngine(engine)
    ? HOT7_MULT_STOPS[Math.floor(Math.random() * HOT7_MULT_STOPS.length)]
    : 1;

  const winningLines: SlotWinningLine[] = [];
  for (const line of paylines) {
    const lineSyms = line.cells.map(([r, c]) => grid[r][c]);
    if (layoutMode === 'classic_3x3') {
      const nonWilds = lineSyms.filter((id) => id !== wildId);
      if (nonWilds.length === 0) {
        const w = specMap.get(wildId)!;
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
        const t = specMap.get(nonWilds[0]);
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
        if (sym === wildId) matchCount++;
        else if (target === null) {
          target = sym;
          matchCount++;
        } else if (sym === target) matchCount++;
        else break;
      }
      if (matchCount >= 3) {
        const resolved = specMap.get(target ?? wildId);
        if (resolved) {
          const factor = matchCount === 5 ? 3.2 : matchCount === 4 ? 1.85 : 1.0;
          winningLines.push({
            lineIndex: line.lineIndex,
            lineName: line.lineName,
            symbolId: resolved.id,
            symbolName: resolved.name,
            multiplier: Math.round(resolved.multiplier * factor * 100) / 100,
            matchCount,
            cells: line.cells.slice(0, matchCount),
          });
        }
      }
    }
  }

  const baseMultiplier =
    Math.round(winningLines.reduce((sum, l) => sum + l.multiplier, 0) * 100) / 100;
  const totalMultiplier =
    baseMultiplier > 0
      ? Math.min(maxMultiplier, Math.round(baseMultiplier * multReel * 100) / 100)
      : 0;

  return {
    engine,
    layoutMode,
    grid,
    winningLines,
    baseMultiplier,
    multiplierReel: multReel,
    totalMultiplier,
  };
}

export function generateDemoBonusVaultItems(): Array<{
  kind: 'mult' | 'freespins';
  value: number;
  label: string;
}> {
  const items: Array<{ kind: 'mult' | 'freespins'; value: number; label: string }> = [
    { kind: 'mult', value: 2, label: '2.0x Vault' },
    { kind: 'mult', value: 3.5, label: '3.5x Chest' },
    { kind: 'mult', value: 5, label: '5.0x Crown' },
    { kind: 'mult', value: 8, label: '8.0x Grand Vault' },
    { kind: 'mult', value: 10, label: '10.0x Jackpot' },
    { kind: 'freespins', value: 5, label: '+5 Free Spins' },
  ];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
