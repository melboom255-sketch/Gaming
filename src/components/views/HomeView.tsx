import { useState } from 'react';
import { AvatarBadge } from '@/src/components/common/AvatarBadge';
import { GameArtwork } from '@/src/components/common/GameArtwork';
import {
  GAME_PROVIDERS,
  ProviderEmblem,
  ProviderTag,
} from '@/src/components/common/ProviderBadge';
import { formatBirr } from '@/src/services/platformService';
import heroBannerImg from '../../assets/images/abyssinia_hero_banner_1794567334349.jpg';
import type {
  ActiveRoute,
  ChallengeProgress,
  DailyChallenge,
  GameCatalogItem,
  GameCategory,
  GameProviderId,
  TelebirrAgent,
  UserProfile,
} from '@/src/types/platform';
import { ArrowRight, CheckCircle2, Gamepad2, Play, Search, Trophy } from 'lucide-react';

interface HomeViewProps {
  games: GameCatalogItem[];
  challenges: DailyChallenge[];
  challengeProgress: Record<string, ChallengeProgress>;
  users: UserProfile[];
  agents: TelebirrAgent[];
  currentUser: UserProfile | null;
  onLaunchGame: (game: GameCatalogItem) => void;
  onNavigate: (route: ActiveRoute) => void;
  onClaimChallenge: (challengeId: string) => void;
  onOpenWallet: (tab: 'deposit' | 'withdraw') => void;
}

const CATEGORIES: ('All' | GameCategory)[] = [
  'All',
  'Slots',
  'Strategy',
  'Arcade',
  'Puzzle',
  'Trivia',
];

export function HomeView({
  games,
  challenges,
  challengeProgress,
  users,
  agents,
  currentUser,
  onLaunchGame,
  onNavigate,
  onClaimChallenge,
  onOpenWallet,
}: HomeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | GameCategory>('All');
  const [selectedProvider, setSelectedProvider] = useState<'all' | GameProviderId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const activeGames = games.filter((g) => g.isActive);
  const slotGames = activeGames.filter((g) => g.category === 'Slots');
  const orderedActiveGames = [
    ...slotGames,
    ...activeGames.filter((g) => g.category !== 'Slots'),
  ];
  const featuredGame =
    orderedActiveGames.find((g) => g.isFeatured) ||
    slotGames[0] ||
    orderedActiveGames[0];
  const popularGames = [...orderedActiveGames]
    .filter((g) => g.isPopular)
    .slice(0, 4);

  const primaryAgent =
    agents.find((a) => a.isActive && a.isPrimary) ||
    agents.find((a) => a.isActive) ||
    agents[0];

  const filteredGames = orderedActiveGames.filter((g) => {
    const matchesCat = selectedCategory === 'All' || g.category === selectedCategory;
    const matchesProvider = selectedProvider === 'all' || g.providerId === selectedProvider;
    const matchesSearch =
      !searchQuery.trim() ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.provider || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesProvider && matchesSearch;
  });

  const topPlayers = [...users]
    .filter((u) => !u.isBanned)
    .sort((a, b) => b.balanceBirr - a.balanceBirr)
    .slice(0, 5);

  return (
    <div className="space-y-12 sm:space-y-14">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0D1020]">
        <div className="relative min-h-[380px] sm:min-h-[430px] flex items-end">
          {!heroImgFailed ? (
            <img
              src={heroBannerImg}
              alt="Abyssinia Games Citadel Arena"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-center contrast-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#19153A] via-[#0F1736] to-[#070912]" />
          )}

          {/* Measured contrast scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070912] via-[#070912]/75 to-[#070912]/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070912]/90 via-[#070912]/55 to-transparent" />

          <div className="relative z-10 w-full p-6 sm:p-10 lg:p-12 max-w-3xl space-y-5">
            <p className="text-xs sm:text-sm font-medium text-amber-300 tracking-wide">
              Abyssinia Games · HD Casino Slots, Skill Games &amp; Telebirr ETB
            </p>

            <h1 className="text-3xl sm:text-5xl font-display font-bold text-white leading-[1.08] text-balance">
              Stake in Birr. Spin, Outplay &amp; Cash Out Live.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Play from 0.10 ETB across {activeGames.length || 65} high-definition studio slots, Megaways, Blackjack, Crash, and tactical skill games with instant Telebirr ETB settlements.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {featuredGame && (
                <button
                  type="button"
                  onClick={() => onLaunchGame(featuredGame)}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play {featuredGame.title.split(':')[0]}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigate('games')}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Explore All {activeGames.length || 65} Games</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenWallet('deposit')}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#131830]/90 hover:bg-[#1B2242] border border-white/15 text-slate-100 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Deposit Birr
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Slots & Megaways Front Showcase */}
      {slotGames.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">
                Slots &amp; Megaways
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                HD 3×3, 5×3, and cascading Megaways titles from certified casino studios with Bonus Buy &amp; Free Spins.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('games')}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1"
            >
              <span>Browse All {activeGames.length} Games</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {slotGames.map((slot) => (
              <div
                key={slot.id}
                className="group rounded-2xl bg-[#0F1324] border border-amber-400/25 hover:border-amber-400/60 overflow-hidden flex flex-col transition-all"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#090C18]">
                  <GameArtwork
                    engine={slot.engine}
                    title={slot.title}
                    providerId={slot.providerId}
                    showProviderBadge
                    className="group-hover:scale-[1.04] transition-transform duration-300"
                  />
                  <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-md bg-[#070912]/85 border border-amber-400/30 text-[11px] font-mono font-bold text-amber-300 tabular-nums">
                    {slot.maxMultiplier}x Max
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-display font-bold text-white leading-snug truncate">
                      {slot.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {slot.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLaunchGame(slot)}
                    className="w-full min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Spin ({formatBirr(slot.minStakeBirr)}+)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Studio Providers Filter & Arcade Grid */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white">
              Games by Verified Provider
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Filter by game studio or genre — launch any title to see the official studio loader before play.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1324] border border-white/10 overflow-x-auto">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === category
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games or studio..."
                className="w-full sm:w-52 min-h-[42px] pl-9 pr-3 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
        </div>

        {/* Provider Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedProvider('all')}
            className={`rounded-xl border p-3 text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
              selectedProvider === 'all'
                ? 'bg-violet-600/20 border-violet-400 text-white'
                : 'bg-[#0F1324] border-white/10 hover:border-white/25 text-slate-300'
            }`}
          >
            <div className="text-xs font-bold">All Studios</div>
            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
              {activeGames.length} Games
            </div>
          </button>

          {GAME_PROVIDERS.map((prov) => {
            const count = activeGames.filter((g) => g.providerId === prov.id).length;
            const active = selectedProvider === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => setSelectedProvider(active ? 'all' : prov.id)}
                className={`rounded-xl border p-3 text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#161B33] border-amber-400/70 text-white'
                    : 'bg-[#0F1324] border-white/10 hover:border-white/25 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <ProviderEmblem providerId={prov.id} className="w-6 h-6 shrink-0" />
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">{count}</span>
                </div>
                <div className="text-xs font-bold text-white truncate">{prov.name}</div>
              </button>
            );
          })}
        </div>

        {filteredGames.length === 0 ? (
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center text-sm text-slate-400">
            No games match your current filter. Try selecting All Studios and All categories.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="group rounded-2xl bg-[#0F1324] border border-white/10 hover:border-violet-400/45 overflow-hidden flex flex-col transition-all"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#090C18]">
                  <GameArtwork
                    engine={game.engine}
                    title={game.title}
                    providerId={game.providerId}
                    showProviderBadge
                    className="group-hover:scale-[1.04] transition-transform duration-300"
                  />
                  <div className="absolute bottom-2.5 right-2.5 z-10 px-2.5 py-0.5 rounded-md bg-[#070912]/85 border border-white/15 text-[11px] font-mono font-bold text-amber-300 tabular-nums">
                    Up to {game.maxMultiplier}x
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400 tabular-nums">
                      <span>
                        {game.category} · Min {formatBirr(game.minStakeBirr)}
                      </span>
                      {game.bonusBirr > 0 && (
                        <span className="font-mono text-emerald-300">+{formatBirr(game.bonusBirr)}</span>
                      )}
                    </div>
                    <h3 className="text-base font-display font-bold text-white leading-snug">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {game.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/8">
                    <ProviderTag providerId={game.providerId} compact />
                    <button
                      type="button"
                      onClick={() => onLaunchGame(game)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Spotlight & Popular Games Strip */}
      {featuredGame && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 rounded-2xl bg-[#0F1324] border border-white/10 overflow-hidden flex flex-col sm:flex-row">
            <div className="sm:w-1/2 aspect-[16/10] sm:aspect-auto shrink-0 bg-[#0A0D1A]">
              <GameArtwork
                engine={featuredGame.engine}
                title={featuredGame.title}
                providerId={featuredGame.providerId}
                showProviderBadge
                className="h-full w-full"
              />
            </div>
            <div className="p-6 flex flex-col justify-between gap-4 flex-1">
              <div className="space-y-2.5">
                <div className="text-xs text-amber-300 font-medium">
                  Featured Release · Min {featuredGame.minStakeBirr} Birr · Up to{' '}
                  {featuredGame.maxMultiplier}x
                </div>
                <h2 className="text-2xl font-display font-bold text-white">
                  {featuredGame.title}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {featuredGame.description}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/8">
                <span className="text-xs text-slate-400 tabular-nums">
                  {featuredGame.playCount.toLocaleString()} plays
                </span>
                <button
                  type="button"
                  onClick={() => onLaunchGame(featuredGame)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Play Now
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#0F1324] border border-white/10 p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-display font-bold text-white">Popular Games</h3>
              <button
                type="button"
                onClick={() => onNavigate('games')}
                className="text-xs font-medium text-blue-300 hover:text-blue-200 cursor-pointer"
              >
                View Catalog
              </button>
            </div>
            <div className="divide-y divide-white/8">
              {popularGames.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLaunchGame(item)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-500 w-5 tabular-nums">
                      0{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.provider} · Min {item.minStakeBirr} Birr
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-amber-300 whitespace-nowrap shrink-0 tabular-nums">
                    {item.bonusBirr > 0 ? `+${item.bonusBirr} Birr` : `${item.maxMultiplier}x max`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Daily Challenges & Top Leaderboard Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Daily Bonuses &amp; Quests</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete skill goals across the arcade to claim bonus Birr directly to your wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('challenges')}
              className="text-xs font-medium text-blue-300 hover:text-blue-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              All Quests
            </button>
          </div>

          <div className="space-y-3">
            {challenges.map((chal) => {
              const prog = challengeProgress[chal.id] || {
                challengeId: chal.id,
                progressValue: 0,
                isClaimed: false,
              };
              const pct = Math.min(100, Math.round((prog.progressValue / chal.targetValue) * 100));
              const isReady = prog.progressValue >= chal.targetValue && !prog.isClaimed;
              const matchingGame = games.find((g) => g.slug === chal.gameSlug);

              return (
                <div
                  key={chal.id}
                  className="rounded-xl bg-[#141930] border border-white/8 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {chal.title}
                      </span>
                      <span className="text-xs font-mono font-semibold text-amber-300 whitespace-nowrap shrink-0 tabular-nums">
                        +{formatBirr(chal.rewardBirr)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{chal.description}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-[#090C18] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-300 tabular-nums shrink-0">
                        {prog.progressValue}/{chal.targetValue}
                      </span>
                    </div>
                  </div>

                  {prog.isClaimed ? (
                    <span className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Claimed</span>
                    </span>
                  ) : isReady && currentUser ? (
                    <button
                      type="button"
                      onClick={() => onClaimChallenge(chal.id)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Claim +{formatBirr(chal.rewardBirr)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => matchingGame && onLaunchGame(matchingGame)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1B2140] hover:bg-[#232B52] text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Play Game
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[#0F1324] border border-white/10 p-6 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-300" />
              <h2 className="text-xl font-display font-bold text-white">Top Standings</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('leaderboard')}
              className="text-xs font-medium text-blue-300 hover:text-blue-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full Table
            </button>
          </div>

          {topPlayers.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No players ranked yet. Register an account and play a game to claim the top spot.
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {topPlayers.map((player, index) => {
                const isMe = currentUser?.id === player.id;
                return (
                  <div
                    key={player.id}
                    className={`py-3 flex items-center justify-between gap-3 ${
                      isMe ? 'bg-violet-600/10 -mx-3 px-3 rounded-xl' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 text-sm font-mono font-bold tabular-nums ${
                          index === 0
                            ? 'text-amber-300'
                            : index === 1
                              ? 'text-slate-200'
                              : index === 2
                                ? 'text-amber-500'
                                : 'text-slate-500'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <AvatarBadge avatarId={player.avatarId} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {player.username}
                          {isMe ? ' (You)' : ''}
                        </div>
                        <div className="text-xs text-slate-400 tabular-nums">
                          {player.wins} wins · {player.gamesPlayed} played
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-amber-300 tabular-nums shrink-0">
                      {formatBirr(player.balanceBirr)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl bg-[#141930] border border-white/8 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-300 leading-relaxed">
              {primaryAgent ? (
                <>
                  Primary Telebirr Agent:{' '}
                  <span className="font-semibold text-white">{primaryAgent.name}</span> (
                  <span className="font-mono text-amber-300">{primaryAgent.phone}</span>)
                </>
              ) : (
                'Telebirr Wallet Deposits & Payouts'
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenWallet('deposit')}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => onOpenWallet('withdraw')}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
