import type { AvatarId } from '@/src/types/platform';
import { Compass, Crown, Landmark, Shield, Sparkles, Star } from 'lucide-react';

interface AvatarBadgeProps {
  avatarId: AvatarId;
  size?: 'sm' | 'md' | 'lg';
}

const AVATAR_STYLES: Record<
  AvatarId,
  { bg: string; ring: string; iconColor: string; label: string }
> = {
  lion: {
    bg: 'bg-amber-500/15',
    ring: 'border-amber-400/35',
    iconColor: 'text-amber-300',
    label: 'Highland Lion',
  },
  obelisk: {
    bg: 'bg-violet-500/15',
    ring: 'border-violet-400/35',
    iconColor: 'text-violet-300',
    label: 'Axum Stele',
  },
  compass: {
    bg: 'bg-blue-500/15',
    ring: 'border-blue-400/35',
    iconColor: 'text-blue-300',
    label: 'Navigator Compass',
  },
  crown: {
    bg: 'bg-amber-400/20',
    ring: 'border-amber-300/45',
    iconColor: 'text-amber-200',
    label: 'Royal Crown',
  },
  shield: {
    bg: 'bg-indigo-500/15',
    ring: 'border-indigo-400/35',
    iconColor: 'text-indigo-300',
    label: 'Obsidian Shield',
  },
  star: {
    bg: 'bg-purple-500/15',
    ring: 'border-purple-400/35',
    iconColor: 'text-purple-300',
    label: 'Abyssinian Star',
  },
};

export const AVATAR_OPTIONS: { id: AvatarId; label: string }[] = [
  { id: 'lion', label: 'Lion' },
  { id: 'obelisk', label: 'Obelisk' },
  { id: 'compass', label: 'Compass' },
  { id: 'crown', label: 'Crown' },
  { id: 'shield', label: 'Shield' },
  { id: 'star', label: 'Star' },
];

export function AvatarBadge({ avatarId, size = 'md' }: AvatarBadgeProps) {
  const style = AVATAR_STYLES[avatarId] || AVATAR_STYLES.star;

  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
        ? 'w-14 h-14 rounded-2xl'
        : 'w-10 h-10 rounded-xl';

  const iconClass =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';

  const renderIcon = () => {
    switch (avatarId) {
      case 'lion':
        return <Sparkles className={iconClass} />;
      case 'obelisk':
        return <Landmark className={iconClass} />;
      case 'compass':
        return <Compass className={iconClass} />;
      case 'crown':
        return <Crown className={iconClass} />;
      case 'shield':
        return <Shield className={iconClass} />;
      case 'star':
      default:
        return <Star className={iconClass} />;
    }
  };

  return (
    <div
      className={`${sizeClass} ${style.bg} ${style.ring} ${style.iconColor} border flex items-center justify-center shrink-0`}
      aria-label={style.label}
    >
      {renderIcon()}
    </div>
  );
}
