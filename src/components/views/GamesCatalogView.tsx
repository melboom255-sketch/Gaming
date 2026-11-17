import { useState } from 'react';
import { GameArtwork } from '@/src/components/common/GameArtwork';
import {
  GAME_PROVIDERS,
  ProviderEmblem,
  ProviderTag,
} from '@/src/components/common/ProviderBadge';
import { formatBirr } from '@/src/services/platformService';
import type {
  GameCatalogItem,
  GameCategory,
  GameProviderId,
} from '@/src/types/platform';
import { Play, Search } from 'lucide-react';

interface GamesCatalogViewProps {
  games: GameCatalogItem[];
  onLaunchGame: (game: GameCatalogItem) => void;
}

const CATEGORIES: ('All' | GameCategory)[] = [
  'All',
  'Slots',
  'Strategy',
  'Arcade',
  'Puzzle',
  'Trivia',
];

export function GamesCatalogView({ games, onLaunchGame }: GamesCatalogViewProps) {
  const [collectionMode, setCollectionMode] = useState<'all' | 'slots' | 'skill'>('all');
  const [category, setCategory] = useState<'All' | GameCategory>('All');
  const [selectedProvider, setSelectedProvider] = useState<'all' | GameProviderId>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'multiplier' | 'bonus'>('popular');
  const [query, setQuery] = useState('');

  const activeGames = games.filter((g) => g.isActive);
  const slotCount = activeGames.filter((g) => g.category === 'Slots').length;
  const skillCount = activeGames.length - slotCount;

  const filtered = activeGames
    .filter((g) => {
      if (collectionMode === 'slots') return g.category === 'Slots';
      if (collectionMode === 'skill') return g.category !== 'Slots';
      return true;
    })
    .filter((g) => category === 'All' || g.category === category)
    .filter((g) => selectedProvider === 'all' || g.providerId === selectedProvider)
    .filter(
      (g) =>
        !query.trim() ||
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        g.subtitle.toLowerCase().includes(query.toLowerCase()) ||
        (g.provider || '').toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'multiplier') return b.maxMultiplier - a.maxMultiplier;
      if (sortBy === 'bonus') return b.bonusBirr - a.bonusBirr;
      const aSlot = a.category === 'Slots' ? 0 : 1;
      const bSlot = b.category === 'Slots' ? 0 : 1;
      if (aSlot !== bSlot) return aSlot - bSlot;
      return b.playCount - a.playCount;
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Birr Game Library</h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Explore {activeGames.length} studio releases categorized by verified provider studios and live payout mechanics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find game or provider..."
              className="w-full sm:w-56 min-h-[42px] pl-9 pr-3 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'popular' | 'multiplier' | 'bonus')}
            aria-label="Sort games"
            className="min-h-[42px] px-3.5 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-violet-400 cursor-pointer"
          >
            <option value="popular">Most Popular</option>
            <option value="multiplier">Highest Max Multiplier</option>
            <option value="bonus">Highest Admin Bonus</option>
          </select>
        </div>
      </div>

      {/* Studio Provider Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-slate-400">
            Studio Providers
          </h2>
          {selectedProvider !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedProvider('all')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
            >
              Show All Providers
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedProvider('all')}
            className={`rounded-xl border p-3 text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
              selectedProvider === 'all'
                ? 'bg-violet-600/20 border-violet-400 text-white'
                : 'bg-[#0F1324] border-white/10 hover:border-white/25 text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">All Studios</div>
            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
              {activeGames.length} Titles
            </div>
          </button>

          {GAME_PROVIDERS.map((prov) => {
            const count = activeGames.filter((g) => g.providerId === prov.id).length;
            const isSelected = selectedProvider === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => setSelectedProvider(isSelected ? 'all' : prov.id)}
                className={`rounded-xl border p-3 text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#161B33] border-amber-400/70 text-white shadow-lg shadow-amber-950/20'
                    : 'bg-[#0F1324] border-white/10 hover:border-white/25 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <ProviderEmblem providerId={prov.id} className="w-6 h-6 shrink-0" />
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {count}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white truncate">{prov.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{prov.specialty}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collection Mode + Genre Category Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F1324] border border-white/10 w-fit max-w-full overflow-x-auto">
          {[
            { id: 'all' as const, label: `All Releases (${activeGames.length})` },
            { id: 'slots' as const, label: `Slots & Megaways (${slotCount})` },
            { id: 'skill' as const, label: `Skill & Table (${skillCount})` },
          ].map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => {
                setCollectionMode(col.id);
                if (col.id === 'slots') setCategory('All');
              }}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                collectionMode === col.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F1324] border border-white/10 w-fit max-w-full overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-12 text-center text-slate-400 text-sm">
          No active games match your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((game) => (
            <div
              key={game.id}
              className="group rounded-2xl bg-[#0F1324] border border-white/10 hover:border-violet-400/50 overflow-hidden flex flex-col transition-all"
            >
              {/* Spacious HD 16:10 artwork header */}
              <div className="relative aspect-[16/10] w-full bg-[#090C18] overflow-hidden">
                <GameArtwork
                  engine={game.engine}
                  title={game.title}
                  providerId={game.providerId}
                  showProviderBadge
                  className="group-hover:scale-[1.04] transition-transform duration-300"
                />
                <div className="absolute bottom-2.5 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-[#070912]/85 backdrop-blur-sm border border-white/15 text-[11px] font-mono font-bold text-amber-300 tabular-nums">
                  Up to {game.maxMultiplier}x
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 tabular-nums">
                    <span>
                      {game.category} · Min {formatBirr(game.minStakeBirr)}
                    </span>
                    <span className="text-slate-400">
                      {game.playCount.toLocaleString()} plays
                    </span>
                  </div>
                  <h2 className="text-lg font-display font-bold text-white leading-snug">
                    {game.title}
                  </h2>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/8">
                  <ProviderTag providerId={game.providerId} compact />

                  <button
                    type="button"
                    onClick={() => onLaunchGame(game)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      Play{game.bonusBirr > 0 ? ` (+${formatBirr(game.bonusBirr)})` : ''}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
