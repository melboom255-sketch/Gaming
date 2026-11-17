import { useState } from 'react';
import { AvatarBadge } from '@/src/components/common/AvatarBadge';
import { formatBirr } from '@/src/services/platformService';
import type { UserProfile } from '@/src/types/platform';
import { Search, Trophy } from 'lucide-react';

interface LeaderboardViewProps {
  users: UserProfile[];
  currentUser: UserProfile | null;
}

type SortMetric = 'birr' | 'wins' | 'snake' | 'trivia';

export function LeaderboardView({ users, currentUser }: LeaderboardViewProps) {
  const [metric, setMetric] = useState<SortMetric>('wins');
  const [search, setSearch] = useState('');

  const ranked = [...users]
    .filter((u) => !u.isBanned)
    .filter(
      (u) =>
        !search.trim() ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.displayName.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (metric === 'wins') return b.wins - a.wins;
      if (metric === 'snake') return b.highScores.snake - a.highScores.snake;
      if (metric === 'trivia') return b.highScores.trivia - a.highScores.trivia;
      return b.balanceBirr - a.balanceBirr;
    });

  const metricLabel =
    metric === 'birr'
      ? 'Birr Balance'
      : metric === 'wins'
        ? 'Total Wins'
        : metric === 'snake'
          ? 'Snake High Score'
          : 'Trivia Best';

  const getMetricDisplay = (u: UserProfile) => {
    if (metric === 'wins') return `${u.wins} wins`;
    if (metric === 'snake') return `${u.highScores.snake} pts`;
    if (metric === 'trivia') return `${u.highScores.trivia} / 8`;
    return formatBirr(u.balanceBirr);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Community Leaderboard</h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Player standings across Birr balances, match victories, and arcade high scores.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="w-full sm:w-56 min-h-[42px] pl-9 pr-3 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {/* Metric Filter Segmented Control */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1324] border border-white/10 w-fit max-w-full overflow-x-auto">
        {(
          [
            { id: 'wins', label: 'Total Wins' },
            { id: 'snake', label: 'Snake Best' },
            { id: 'trivia', label: 'Trivia Best' },
            ...(currentUser?.role === 'admin'
              ? [{ id: 'birr' as SortMetric, label: 'ETB Balance (Admin)' }]
              : []),
          ] as { id: SortMetric; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMetric(tab.id)}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              metric === tab.id
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Podium Top 3 */}
      {ranked.length >= 3 && !search.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ranked.slice(0, 3).map((player, idx) => (
            <div
              key={player.id}
              className={`rounded-2xl border p-5 flex items-center gap-4 ${
                idx === 0
                  ? 'bg-gradient-to-br from-amber-500/12 to-[#0F1324] border-amber-400/35'
                  : 'bg-[#0F1324] border-white/10'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-sm tabular-nums shrink-0 ${
                  idx === 0
                    ? 'bg-amber-400/20 text-amber-300'
                    : idx === 1
                      ? 'bg-slate-400/15 text-slate-200'
                      : 'bg-amber-700/20 text-amber-400'
                }`}
              >
                #{idx + 1}
              </div>
              <AvatarBadge avatarId={player.avatarId} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">
                  {player.username}
                </div>
                <div className="text-xs font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                  {getMetricDisplay(player)}
                </div>
              </div>
              {idx === 0 && <Trophy className="w-5 h-5 text-amber-300 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 overflow-hidden">
        {ranked.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {search.trim()
              ? 'No players match your search query.'
              : 'No ranked players yet. Register an account and play a game to appear on the leaderboard.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400 bg-[#0B0E1B]">
                  <th className="py-3.5 px-4 font-medium">Rank</th>
                  <th className="py-3.5 px-4 font-medium">Player</th>
                  <th className="py-3.5 px-4 font-medium text-right">Games</th>
                  <th className="py-3.5 px-4 font-medium text-right">Win Rate</th>
                  <th className="py-3.5 px-4 font-medium text-right">{metricLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm">
                {ranked.map((player, index) => {
                  const winRate =
                    player.gamesPlayed > 0
                      ? Math.round((player.wins / player.gamesPlayed) * 100)
                      : 0;
                  const isMe = currentUser?.id === player.id;

                  return (
                    <tr
                      key={player.id}
                      className={isMe ? 'bg-violet-600/12' : 'hover:bg-white/[0.02]'}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-300 tabular-nums">
                        #{index + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBadge avatarId={player.avatarId} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {player.username}
                              {isMe ? ' (You)' : ''}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {player.displayName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {player.gamesPlayed}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {winRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-300 tabular-nums">
                        {getMetricDisplay(player)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
