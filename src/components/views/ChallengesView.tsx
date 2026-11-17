import { formatBirr } from '@/src/services/platformService';
import type {
  ChallengeProgress,
  DailyChallenge,
  GameCatalogItem,
  UserProfile,
} from '@/src/types/platform';
import { Calendar, CheckCircle2, Play, Trophy } from 'lucide-react';

interface ChallengesViewProps {
  challenges: DailyChallenge[];
  challengeProgress: Record<string, ChallengeProgress>;
  games: GameCatalogItem[];
  currentUser: UserProfile | null;
  onLaunchGame: (game: GameCatalogItem) => void;
  onClaimChallenge: (challengeId: string) => void;
  onPromptSignIn: () => void;
}

export function ChallengesView({
  challenges,
  challengeProgress,
  games,
  currentUser,
  onLaunchGame,
  onClaimChallenge,
  onPromptSignIn,
}: ChallengesViewProps) {
  const completedCount = challenges.filter((c) => {
    const p = challengeProgress[c.id];
    return p && p.progressValue >= c.targetValue;
  }).length;

  const totalAvailableBirr = challenges.reduce((sum, c) => sum + c.rewardBirr, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Daily Birr Quests</h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Complete skill objectives across Abyssinia Games to claim Birr bonuses into your wallet.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm tabular-nums">
          <div>
            <span className="text-slate-400 mr-2">Completed</span>
            <span className="font-mono font-bold text-white">
              {completedCount}/{challenges.length}
            </span>
          </div>
          <div>
            <span className="text-slate-400 mr-2">Bonus Pool</span>
            <span className="font-mono font-bold text-amber-300">
              +{formatBirr(totalAvailableBirr)}
            </span>
          </div>
        </div>
      </div>

      {!currentUser && (
        <div className="rounded-2xl bg-[#101426] border border-violet-400/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm text-slate-200">
            Sign in or create a player account to track quest progress and claim Birr rewards.
          </div>
          <button
            type="button"
            onClick={onPromptSignIn}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-300" />
                      <span>Daily Objective · {chal.metricLabel}</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-white mt-1">
                      {chal.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300 tabular-nums shrink-0">
                    <Trophy className="w-4 h-4" />
                    <span>+{formatBirr(chal.rewardBirr)}</span>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">{chal.description}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-mono font-semibold text-white">
                      {prog.progressValue} / {chal.targetValue} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#070912] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {prog.isClaimed ? (
                    <span className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-sm font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Bonus Claimed</span>
                    </span>
                  ) : isReady && currentUser ? (
                    <button
                      type="button"
                      onClick={() => onClaimChallenge(chal.id)}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors cursor-pointer"
                    >
                      Claim +{formatBirr(chal.rewardBirr)}
                    </button>
                  ) : (
                    matchingGame && (
                      <button
                        type="button"
                        onClick={() => onLaunchGame(matchingGame)}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Play {matchingGame.title.split(':')[0]}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
