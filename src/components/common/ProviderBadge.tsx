import { useEffect, useState } from 'react';
import type { GameProviderId } from '@/src/types/platform';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export interface ProviderMeta {
  id: GameProviderId;
  name: string;
  tagline: string;
  specialty: string;
  primaryHex: string;
  secondaryHex: string;
  pillClass: string;
  glowClass: string;
}

export const GAME_PROVIDERS: ProviderMeta[] = [
  {
    id: 'axum_studios',
    name: 'Axum Studios',
    tagline: 'Highland Flagship Mechanics',
    specialty: 'Megaways & Ethiopian Tables',
    primaryHex: '#F59E0B',
    secondaryHex: '#D97706',
    pillClass: 'border-amber-400/35 bg-amber-500/12 text-amber-200',
    glowClass: 'from-amber-500/25 via-amber-600/10 to-transparent',
  },
  {
    id: 'pragmatic_spin',
    name: 'Pragmatic Spin',
    tagline: 'Multipliers & Blazing 777s',
    specialty: 'Classic Reels & Hold-Win',
    primaryHex: '#FB7185',
    secondaryHex: '#E11D48',
    pillClass: 'border-rose-400/35 bg-rose-500/12 text-rose-200',
    glowClass: 'from-rose-500/25 via-orange-500/10 to-transparent',
  },
  {
    id: 'megaways_labs',
    name: 'Megaways Labs',
    tagline: 'Cascading Dynamic Reels',
    specialty: 'Up to 46,656 Ways',
    primaryHex: '#38BDF8',
    secondaryHex: '#2563EB',
    pillClass: 'border-sky-400/35 bg-sky-500/12 text-sky-200',
    glowClass: 'from-sky-500/25 via-indigo-500/10 to-transparent',
  },
  {
    id: 'hacksaw_vault',
    name: 'Hacksaw Vault',
    tagline: 'High-Volatility Vault & Tactical Grids',
    specialty: 'Bonus Buys & Minesweeper',
    primaryHex: '#A78BFA',
    secondaryHex: '#7C3AED',
    pillClass: 'border-violet-400/35 bg-violet-500/12 text-violet-200',
    glowClass: 'from-violet-500/25 via-purple-600/10 to-transparent',
  },
  {
    id: 'spribe_live',
    name: 'Spribe Live',
    tagline: 'Instant Crash & Reflex Arcade',
    specialty: 'Real-Time Cashout Loops',
    primaryHex: '#34D399',
    secondaryHex: '#059669',
    pillClass: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
    glowClass: 'from-emerald-500/25 via-teal-500/10 to-transparent',
  },
  {
    id: 'royal_table',
    name: 'Royal Table Works',
    tagline: 'Heritage & Epic Adventures',
    specialty: 'Cinema Slots & Classics',
    primaryHex: '#FBBF24',
    secondaryHex: '#B45309',
    pillClass: 'border-yellow-400/35 bg-yellow-500/12 text-yellow-200',
    glowClass: 'from-yellow-500/25 via-amber-700/10 to-transparent',
  },
];

export const PROVIDER_BY_ID: Record<GameProviderId, ProviderMeta> = Object.fromEntries(
  GAME_PROVIDERS.map((p) => [p.id, p])
) as Record<GameProviderId, ProviderMeta>;

export function getProviderMeta(providerId?: GameProviderId): ProviderMeta {
  return (providerId && PROVIDER_BY_ID[providerId]) || PROVIDER_BY_ID.axum_studios;
}

export function ProviderEmblem({
  providerId,
  className = 'w-6 h-6',
}: {
  providerId: GameProviderId;
  className?: string;
}) {
  const meta = getProviderMeta(providerId);

  switch (providerId) {
    case 'axum_studios':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="axumGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <polygon
            points="32,4 58,20 52,54 12,54 6,20"
            fill="#14182D"
            stroke="url(#axumGrad)"
            strokeWidth="3"
          />
          <polygon points="32,10 38,48 26,48" fill="url(#axumGrad)" />
          <circle cx="32" cy="21" r="3" fill="#0B0F1E" />
          <line x1="20" y1="48" x2="44" y2="48" stroke="#FDE68A" strokeWidth="3" />
        </svg>
      );

    case 'pragmatic_spin':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="pragGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="50%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="27" fill="#180D1B" stroke="url(#pragGrad)" strokeWidth="3.5" />
          <path
            d="M21 20 H44 L31 48 H23 L35 26 H21 Z"
            fill="url(#pragGrad)"
          />
          <circle cx="46" cy="18" r="4" fill="#FBBF24" />
        </svg>
      );

    case 'megaways_labs':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="megaGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7DD3FC" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <rect
            x="6"
            y="6"
            width="52"
            height="52"
            rx="14"
            fill="#0D162E"
            stroke="url(#megaGrad)"
            strokeWidth="3"
          />
          <rect x="14" y="18" width="8" height="28" rx="3" fill="#38BDF8" />
          <rect x="28" y="13" width="8" height="38" rx="3" fill="url(#megaGrad)" />
          <rect x="42" y="21" width="8" height="22" rx="3" fill="#93C5FD" />
        </svg>
      );

    case 'hacksaw_vault':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="hackGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#DDD6FE" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <path
            d="M32 5 L55 15 V33 C55 46 44 55 32 59 C20 55 9 46 9 33 V15 Z"
            fill="#14102A"
            stroke="url(#hackGrad)"
            strokeWidth="3"
          />
          <circle cx="32" cy="31" r="10" fill="none" stroke="#C4B5FD" strokeWidth="3" />
          <path d="M22 31 H42 M32 21 V41" stroke="#A78BFA" strokeWidth="2.5" />
        </svg>
      );

    case 'spribe_live':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="spribeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="27" fill="#0B1E1A" stroke="url(#spribeGrad)" strokeWidth="3" />
          <path
            d="M18 41 L30 27 L36 33 L47 18"
            fill="none"
            stroke="#34D399"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon points="49,15 39,17 47,26" fill="#6EE7B7" />
        </svg>
      );

    case 'royal_table':
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
          <defs>
            <linearGradient id="royalGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor={meta.secondaryHex} />
            </linearGradient>
          </defs>
          <rect
            x="8"
            y="8"
            width="48"
            height="48"
            rx="14"
            fill="#19130D"
            stroke="url(#royalGrad)"
            strokeWidth="3"
          />
          <path
            d="M18 42 L21 23 L32 32 L43 23 L46 42 Z"
            fill="url(#royalGrad)"
          />
          <rect x="18" y="45" width="28" height="4" rx="2" fill="#FDE047" />
        </svg>
      );
  }
}

export function ProviderTag({
  providerId,
  compact = false,
}: {
  providerId: GameProviderId;
  compact?: boolean;
}) {
  const meta = getProviderMeta(providerId);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold tracking-tight whitespace-nowrap shrink-0 ${meta.pillClass}`}
    >
      <ProviderEmblem providerId={meta.id} className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span>{meta.name}</span>
    </span>
  );
}

interface ProviderSplashScreenProps {
  providerId: GameProviderId;
  gameTitle: string;
  gameCategory: string;
  onComplete: () => void;
}

export function ProviderSplashScreen({
  providerId,
  gameTitle,
  gameCategory,
  onComplete,
}: ProviderSplashScreenProps) {
  const meta = getProviderMeta(providerId);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(62), 180);
    const t2 = window.setTimeout(() => setProgress(96), 650);
    const done = window.setTimeout(() => onComplete(), 1150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(done);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050711] flex flex-col items-center justify-center p-6 select-none overflow-hidden"
      role="status"
      aria-live="polite"
    >
      {/* Ambient studio radial lighting */}
      <div
        className={`absolute inset-0 bg-radial ${meta.glowClass} opacity-60 pointer-events-none`}
      />
      <div
        className="absolute w-[420px] h-[420px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: meta.primaryHex }}
      />

      <div className="relative z-10 max-w-md w-full flex flex-col items-center text-center space-y-6">
        {/* Studio crest medallion */}
        <div className="relative">
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-[#0D1122] border-2 flex items-center justify-center shadow-2xl"
            style={{
              borderColor: `${meta.primaryHex}66`,
              boxShadow: `0 0 50px -10px ${meta.primaryHex}66`,
            }}
          >
            <ProviderEmblem providerId={meta.id} className="w-20 h-20 sm:w-22 sm:h-22" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-[0.26em] text-slate-400">
            Official Studio Release
          </div>
          <h2
            className="text-3xl sm:text-4xl font-display font-black tracking-tight text-white"
            style={{ textShadow: `0 2px 24px ${meta.primaryHex}44` }}
          >
            {meta.name}
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-300">{meta.tagline}</p>
        </div>

        <div className="w-full rounded-2xl bg-[#0C1020]/90 border border-white/10 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white truncate">{gameTitle}</span>
            <span className="font-mono text-slate-400 shrink-0">{gameCategory}</span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#060812] border border-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${meta.secondaryHex}, ${meta.primaryHex})`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified RNG &amp; HD Assets Ready
            </span>
            <span className="font-mono tabular-nums text-slate-300">{progress}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>Enter Studio</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
