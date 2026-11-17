import { useState } from 'react';
import type { SlotSymbolId } from '@/src/types/platform';

/**
 * Vite bundles each symbol image into the app, so missing individual artwork can
 * never turn a reel into a text-only label. New sym_*.jpg artwork is picked up
 * automatically without adding another import for every image.
 */
const SLOT_ART = import.meta.glob<string>('../../assets/images/sym_*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const SYMBOL_EMOJI: Partial<Record<SlotSymbolId, string>> = {
  cherry: '🍒', lemon: '🍋', orange: '🍊', grapes: '🍇', watermelon: '🍉', bell: '🔔', star: '⭐',
  bar1: '▰', bar2: '▰▰', diamond: '💎', seven: '7️⃣', double7: '7️⃣7️⃣', triple7: '7️⃣7️⃣7️⃣',
  lion_wild: '🦁', elephant: '🐘', rhino: '🦏', zebra: '🦓', acacia: '🌅', shield: '🛡️',
  pharaoh_wild: '𓂀', scarab: '🪲', horus: '𓂀', ankh: '☥', sphinx: '🗿', lotus: '🪷',
  candy_wild: '🌈', cupcake: '🧁', lollipop: '🍭', donut: '🍩', gummy: '🐻', candystar: '🌟',
  axum_wild: '🦁', obelisk: '🗿', gold_coin: '🪙', amber_gem: '💛', emerald_scarab: '🪲', royal_crown: '👑',
  nebula_wild: '🌌', plasma: '☄️', sapphire: '🔷', amethyst: '🔮', emerald_gem: '💚', opal: '🫧',
  spy_wild: '🕵️', spy_car: '🏎️', spy_briefcase: '💼', spy_pistol: '🔫', spy_watch: '⌚', spy_passport: '🛂',
  inferno_wild: '🔥', inferno_777: '🔥', molten_bell: '🔔', flame_dice: '🎲', ruby_heart: '❤️', gold_ingot: '🪙',
  viking_wild: '⚡', viking_helm: '🪖', battle_axe: '🪓', longship: '⛵', thor_hammer: '🔨', runestone: '🪨',
  dragon_wild: '🐉', jade_tiger: '🐅', red_lantern: '🏮', koi_fish: '🐠', gold_sycee: '🪙', fortune_fan: '🪭',
  sheriff_wild: '⭐', revolver: '🔫', dynamite: '🧨', cowboy_hat: '🤠', horseshoe: '🧲', whiskey_barrel: '🛢️',
  pirate_wild: '🏴‍☠️', treasure_chest: '🧰', pirate_ship: '⛵', brass_compass: '🧭', spyglass: '🔭', rum_bottle: '🍾',
  zeus_wild: '⚡', pegasus: '🪽', olympus_temple: '🏛️', golden_chalice: '🏆', lightning_ring: '💍', marble_lyre: '🎼',
  vip_wild: '💎', roulette_wheel: '🎡', royal_cards: '🃏', champagne: '🍾', casino_dice: '🎲', sports_car: '🏎️',
  clover_wild: '🍀', pot_of_gold: '🌈', four_clover: '🍀', golden_harp: '🎻', rainbow_boot: '🥾', emerald_pint: '🍺',
  gladiator_wild: '⚔️', roman_helm: '🪖', golden_eagle: '🦅', war_chariot: '🏇', gladius_shield: '🛡️', colosseum_coin: '🪙',
};

const SYMBOL_LABELS: Partial<Record<SlotSymbolId, string>> = {
  axum_wild: 'Axum Lion', triple7: '777 Wild', spy_pistol: 'Agent Gear', pharaoh_wild: 'Pharaoh Mask',
  nebula_wild: 'Nebula Wild', inferno_777: 'Inferno 777', viking_wild: 'Valhalla Wild',
  dragon_wild: 'Emperor Dragon', pirate_wild: 'Corsair Wild', zeus_wild: 'Zeus Bolt',
  vip_wild: 'Vegas VIP', clover_wild: 'Lucky Clover', gladiator_wild: 'Gladiator Wild',
};

function findArtwork(symbolId: SlotSymbolId): string | undefined {
  const key = Object.keys(SLOT_ART).find((path) =>
    path.split('/').pop()?.startsWith(`sym_${symbolId}_`)
  );
  return key ? SLOT_ART[key] : undefined;
}

interface SlotSymbolIconProps {
  symbolId: SlotSymbolId;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function SlotSymbolIcon({
  symbolId,
  className,
  size = 'lg',
  animated = true,
}: SlotSymbolIconProps) {
  const imageSrc = findArtwork(symbolId);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showArtwork = imageSrc && failedSrc !== imageSrc;
  const label = SYMBOL_LABELS[symbolId] || symbolId.replace(/_/g, ' ');
  const emoji = SYMBOL_EMOJI[symbolId] || '✨';
  const sizeClass = size === 'sm' ? 'slot-symbol-sm' : size === 'md' ? 'slot-symbol-md' : '';

  return (
    <div
      className={`slot-symbol-frame ${sizeClass} ${animated ? 'slot-symbol-animated' : ''} ${className || ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {showArtwork ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(imageSrc)}
          className="slot-symbol-image"
        />
      ) : (
        <span className="slot-symbol-emoji" aria-hidden="true">{emoji}</span>
      )}
      <span className="slot-symbol-gloss" aria-hidden="true" />
    </div>
  );
}
