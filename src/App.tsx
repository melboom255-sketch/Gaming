import { useEffect, useState } from 'react';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { GameArenaModal } from '@/src/components/games/GameArenaModal';
import { AdminDashboardView } from '@/src/components/views/AdminDashboardView';
import { AgentDashboardView } from '@/src/components/views/AgentDashboardView';
import { ChallengesView } from '@/src/components/views/ChallengesView';
import { GamesCatalogView } from '@/src/components/views/GamesCatalogView';
import { HomeView } from '@/src/components/views/HomeView';
import { LeaderboardView } from '@/src/components/views/LeaderboardView';
import { ProfileView } from '@/src/components/views/ProfileView';
import { WalletModal } from '@/src/components/wallet/WalletModal';
import {
  adminDeleteAgentOnServer,
  adminGrantBonusOnServer,
  adminReviewDepositOnServer,
  adminReviewWithdrawalOnServer,
  adminSaveAgentOnServer,
  adminSaveGameOnServer,
  adminUpdateUserOnServer,
  authenticateUser,
  claimChallengeOnServer,
  createEmptySnapshot,
  fetchPlatformBootstrap,
  formatBirr,
  registerNewUser,
  signOutUser,
  submitDepositOnServer,
  submitWithdrawalOnServer,
  updateProfileOnServer,
} from '@/src/services/platformService';
import type {
  ActiveRoute,
  AvatarId,
  GameCatalogItem,
  PlatformSnapshot,
  TelebirrAgent,
} from '@/src/types/platform';
import {
  Award,
  Compass,
  Gamepad2,
  Home,
  ShieldCheck,
  Trophy,
  User,
  X,
} from 'lucide-react';

const PENDING_REF_KEY = 'abyssinia_pending_ref';

function capturePendingReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const refParam = (params.get('ref') || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (refParam) {
      window.localStorage.setItem(PENDING_REF_KEY, refParam);
      return refParam;
    }
    return window.localStorage.getItem(PENDING_REF_KEY) || '';
  } catch {
    return '';
  }
}

function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_REF_KEY);
  } catch {
    // ignore
  }
}

function getInitialLocationState(): {
  route: ActiveRoute;
  authMode: 'login' | 'register' | null;
  walletTab: 'deposit' | 'withdraw' | null;
  referralCode: string;
} {
  if (typeof window === 'undefined') {
    return { route: 'home', authMode: null, walletTab: null, referralCode: '' };
  }
  const referralCode = capturePendingReferralCode();
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/login' || path === '/signin') {
    return { route: 'home', authMode: 'login', walletTab: null, referralCode };
  }
  if (path === '/register' || path === '/signup') {
    return { route: 'home', authMode: 'register', walletTab: null, referralCode };
  }
  if (path === '/deposit') {
    return { route: 'home', authMode: null, walletTab: 'deposit', referralCode };
  }
  if (path === '/withdraw' || path === '/withdrawal') {
    return { route: 'home', authMode: null, walletTab: 'withdraw', referralCode };
  }
  if (path === '/games') return { route: 'games', authMode: null, walletTab: null, referralCode };
  if (path === '/challenges') return { route: 'challenges', authMode: null, walletTab: null, referralCode };
  if (path === '/leaderboard') return { route: 'leaderboard', authMode: null, walletTab: null, referralCode };
  if (path === '/profile') return { route: 'profile', authMode: null, walletTab: null, referralCode };
  if (path === '/agent') return { route: 'agent', authMode: null, walletTab: null, referralCode };
  if (path === '/admin') return { route: 'admin', authMode: null, walletTab: null, referralCode };
  return {
    route: 'home',
    authMode: referralCode ? 'register' : null,
    walletTab: null,
    referralCode,
  };
}

export default function App() {
  const initialLocation = getInitialLocationState();
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(() =>
    createEmptySnapshot()
  );
  const [bootstrapped, setBootstrapped] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [route, setRoute] = useState<ActiveRoute>(initialLocation.route);
  const [activeGame, setActiveGame] = useState<GameCatalogItem | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(
    initialLocation.authMode !== null
  );
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>(
    initialLocation.authMode || 'login'
  );
  const [pendingReferralCode, setPendingReferralCode] = useState<string>(
    initialLocation.referralCode
  );
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw' | null>(
    initialLocation.walletTab
  );

  const currentUser =
    snapshot.users.find((u) => u.id === snapshot.currentUserId) || null;

  const currentChallengeProgress = currentUser
    ? snapshot.challengeProgressByUser[currentUser.id] || {}
    : {};

  const primaryAgent =
    snapshot.agents.find((a) => a.isActive && a.isPrimary) ||
    snapshot.agents.find((a) => a.isActive) ||
    snapshot.agents[0];

  useEffect(() => {
    let cancelled = false;
    fetchPlatformBootstrap()
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
          setBootstrapped(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setActionError(
            err instanceof Error ? err.message : 'Unable to reach platform server.'
          );
          setBootstrapped(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = getInitialLocationState();
      setRoute(next.route);
      if (next.referralCode) setPendingReferralCode(next.referralCode);
      if (next.authMode) {
        setAuthInitialMode(next.authMode);
        setAuthModalOpen(true);
      } else {
        setAuthModalOpen(false);
      }
      setWalletTab(next.walletTab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (next: ActiveRoute) => {
    setRoute(next);
    const targetPath = next === 'home' ? '/' : `/${next}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchGame = (game: GameCatalogItem) => {
    try {
      if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
        const fsPromise = document.documentElement.requestFullscreen();
        if (fsPromise && typeof fsPromise.catch === 'function') {
          fsPromise.catch(() => {});
        }
      }
    } catch {
      // Restricted iframe environments keep full-viewport fixed overlay without error
    }
    setActiveGame(game);
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setWalletTab(null);
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
    const targetPath = mode === 'register' ? '/register' : '/login';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    const fallbackPath = route === 'home' ? '/' : `/${route}`;
    if (
      window.location.pathname === '/login' ||
      window.location.pathname === '/signin' ||
      window.location.pathname === '/register' ||
      window.location.pathname === '/signup'
    ) {
      window.history.replaceState({}, '', fallbackPath);
    }
  };

  const openWalletModal = (tab: 'deposit' | 'withdraw') => {
    setAuthModalOpen(false);
    setWalletTab(tab);
    const targetPath = tab === 'deposit' ? '/deposit' : '/withdraw';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const closeWalletModal = () => {
    setWalletTab(null);
    const fallbackPath = route === 'home' ? '/' : `/${route}`;
    if (
      window.location.pathname === '/deposit' ||
      window.location.pathname === '/withdraw' ||
      window.location.pathname === '/withdrawal'
    ) {
      window.history.replaceState({}, '', fallbackPath);
    }
  };

  const runServerAction = async (
    fn: () => Promise<PlatformSnapshot>
  ): Promise<{ ok: boolean; error?: string }> => {
    setActionError(null);
    try {
      const next = await fn();
      setSnapshot(next);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed.';
      setActionError(message);
      return { ok: false, error: message };
    }
  };

  const handleLogin = async (identifier: string, password: string): Promise<string | null> => {
    const res = await authenticateUser(identifier, password);
    if (res.error || !res.nextSnapshot) {
      return res.error || 'Unable to sign in.';
    }
    setSnapshot(res.nextSnapshot);
    return null;
  };

  const handleRegister = async (params: {
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
    fullName: string;
    phone: string;
    referralCode?: string;
    displayName: string;
    avatarId: AvatarId;
  }): Promise<string | null> => {
    const res = await registerNewUser(params);
    if (res.error || !res.nextSnapshot) {
      return res.error || 'Unable to create account.';
    }
    clearPendingReferralCode();
    setPendingReferralCode('');
    setSnapshot(res.nextSnapshot);
    return null;
  };

  const handleSignOut = async () => {
    await runServerAction(() => signOutUser());
    if (route === 'admin' || route === 'agent') handleNavigate('home');
  };

  const handleClaimChallenge = (challengeId: string) => {
    void runServerAction(() => claimChallengeOnServer(challengeId));
  };

  const handleUpdateProfile = (updates: {
    displayName: string;
    fullName?: string;
    phone?: string;
    avatarId: AvatarId;
  }) => {
    if (!currentUser) return;
    void runServerAction(() => updateProfileOnServer(updates));
  };

  const handleSaveGame = (game: GameCatalogItem) => {
    return runServerAction(() => adminSaveGameOnServer(game));
  };

  const handleSaveAgent = (
    agent: Partial<TelebirrAgent> & { name: string; phone: string }
  ) => {
    return runServerAction(() => adminSaveAgentOnServer(agent));
  };

  const handleDeleteAgent = (agentId: string) => {
    return runServerAction(() => adminDeleteAgentOnServer(agentId));
  };

  const handleGrantBonus = (params: {
    targetUserId: string | 'ALL';
    amountBirr: number;
    reason: string;
  }) => {
    return runServerAction(async () => {
      const res = await adminGrantBonusOnServer(params);
      return res.snapshot;
    });
  };

  const handleToggleUserBan = (userId: string) => {
    return runServerAction(() => adminUpdateUserOnServer(userId, { toggleBan: true }));
  };

  const handleToggleUserRole = (userId: string) => {
    return runServerAction(() => adminUpdateUserOnServer(userId, { toggleRole: true }));
  };

  const handleAdjustUserBirr = (userId: string, delta: number) => {
    return runServerAction(() =>
      adminUpdateUserOnServer(userId, { birrDelta: delta })
    );
  };

  const handleSubmitDeposit = async (params: {
    amountBirr: number;
    agentId: string;
    telebirrReference?: string;
    senderPhone?: string;
    screenshotDataUrl?: string;
    screenshotFileName?: string;
  }) => {
    const res = await submitDepositOnServer(params);
    if (res.nextSnapshot) {
      setSnapshot(res.nextSnapshot);
    }
    return { request: res.request, error: res.error };
  };

  const handleSubmitWithdrawal = async (params: {
    amountBirr: number;
    telebirrPhone: string;
    recipientName: string;
  }) => {
    const res = await submitWithdrawalOnServer(params);
    if (res.nextSnapshot) {
      setSnapshot(res.nextSnapshot);
    }
    return { request: res.request, error: res.error };
  };

  const handleReviewDeposit = (
    requestId: string,
    decision: 'approved' | 'rejected',
    adminNote?: string
  ) => {
    return runServerAction(() =>
      adminReviewDepositOnServer(requestId, decision, adminNote)
    );
  };

  const handleReviewWithdrawal = (
    requestId: string,
    decision: 'approved' | 'rejected',
    payoutReference?: string,
    adminNote?: string
  ) => {
    return runServerAction(() =>
      adminReviewWithdrawalOnServer(requestId, decision, payoutReference, adminNote)
    );
  };

  const isApprovedAgent = Boolean(
    currentUser &&
      (currentUser.accountType === 'agent' ||
        snapshot.myAgentProfile?.applicationStatus === 'approved')
  );

  const navItems: { id: ActiveRoute; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'games', label: 'Games' },
    { id: 'challenges', label: 'Quests' },
    { id: 'leaderboard', label: 'Leaderboard' },
    ...(isApprovedAgent ? [{ id: 'agent' as ActiveRoute, label: 'Agent' }] : []),
    ...(currentUser ? [{ id: 'profile' as ActiveRoute, label: 'Dashboard' }] : []),
    ...(currentUser?.role === 'admin' ? [{ id: 'admin' as ActiveRoute, label: 'Admin' }] : []),
  ];

  // Keep activeGame synchronized with latest admin odds/bonus updates in snapshot
  const liveActiveGame = activeGame
    ? snapshot.games.find((g) => g.id === activeGame.id) || activeGame
    : null;

  return (
    <div className="min-h-screen bg-[#070912] text-slate-100 flex flex-col pb-16 md:pb-0">
      {/* Three-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-14 md:h-16 bg-[#070912]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Single-line brand wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="text-lg sm:text-xl font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Abyssinia Games
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium"
            aria-label="Primary Navigation"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
                  route === item.id
                    ? 'text-white border-violet-500'
                    : 'text-slate-400 hover:text-slate-100 border-transparent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#12162A] hover:bg-[#19203B] border border-white/12 text-xs sm:text-sm font-semibold text-amber-300 tabular-nums whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {formatBirr(currentUser.balanceBirr)} · {currentUser.username}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="min-h-[40px] px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {actionError && (
          <div className="mb-6 rounded-xl bg-rose-500/10 border border-rose-400/35 px-4 py-3 text-xs sm:text-sm text-rose-200 flex items-center justify-between gap-3">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="text-rose-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!bootstrapped ? (
          <div className="py-20 text-center text-sm text-slate-400">
            Loading Abyssinia Games...
          </div>
        ) : (
          <>
            {route === 'home' && (
              <HomeView
                games={snapshot.games}
                challenges={snapshot.challenges}
                challengeProgress={currentChallengeProgress}
                users={snapshot.users}
                agents={snapshot.agents}
                currentUser={currentUser}
                onLaunchGame={handleLaunchGame}
                onNavigate={handleNavigate}
                onClaimChallenge={handleClaimChallenge}
                onOpenWallet={openWalletModal}
              />
            )}

            {route === 'games' && (
              <GamesCatalogView games={snapshot.games} onLaunchGame={handleLaunchGame} />
            )}

            {route === 'challenges' && (
              <ChallengesView
                challenges={snapshot.challenges}
                challengeProgress={currentChallengeProgress}
                games={snapshot.games}
                currentUser={currentUser}
                onLaunchGame={handleLaunchGame}
                onClaimChallenge={handleClaimChallenge}
                onPromptSignIn={() => openAuthModal('login')}
              />
            )}

            {route === 'leaderboard' && (
              <LeaderboardView users={snapshot.users} currentUser={currentUser} />
            )}

            {route === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                sessions={snapshot.sessions}
                depositRequests={snapshot.depositRequests}
                withdrawalRequests={snapshot.withdrawalRequests}
                bonusGrants={snapshot.bonusGrants}
                agents={snapshot.agents}
                platformSettings={snapshot.platformSettings}
                myAgentProfile={snapshot.myAgentProfile}
                myEligibility={snapshot.myEligibility}
                myReferralParent={snapshot.myReferralParent}
                myReferralRewards={snapshot.myReferralRewards}
                transactions={snapshot.transactions}
                supportTickets={snapshot.supportTickets}
                onUpdateProfile={handleUpdateProfile}
                onSnapshotSync={setSnapshot}
                onSignOut={handleSignOut}
                onOpenAuth={() => openAuthModal('login')}
                onOpenWallet={openWalletModal}
                onNavigate={handleNavigate}
              />
            )}

            {route === 'agent' && (
              <AgentDashboardView
                currentUser={currentUser}
                platformSettings={snapshot.platformSettings}
                onSnapshotSync={setSnapshot}
                onNavigate={handleNavigate}
                onOpenAuth={() => openAuthModal('login')}
              />
            )}

            {route === 'admin' && (
              <AdminDashboardView
                currentUser={currentUser}
                games={snapshot.games}
                users={snapshot.users}
                agents={snapshot.agents}
                depositRequests={snapshot.depositRequests}
                withdrawalRequests={snapshot.withdrawalRequests}
                bonusGrants={snapshot.bonusGrants}
                platformSettings={snapshot.platformSettings}
                agentProfiles={snapshot.agentProfiles}
                referralRelationships={snapshot.referralRelationships}
                referralRewards={snapshot.referralRewards}
                transactions={snapshot.transactions}
                auditLogs={snapshot.auditLogs}
                supportTickets={snapshot.supportTickets}
                onSnapshotSync={setSnapshot}
                onSaveGame={handleSaveGame}
                onSaveAgent={handleSaveAgent}
                onDeleteAgent={handleDeleteAgent}
                onGrantBonus={handleGrantBonus}
                onToggleUserBan={handleToggleUserBan}
                onToggleUserRole={handleToggleUserRole}
                onAdjustUserBirr={handleAdjustUserBirr}
                onReviewDeposit={handleReviewDeposit}
                onReviewWithdrawal={handleReviewWithdrawal}
              />
            )}
          </>
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-white/8 bg-[#070912]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="space-y-1">
            <div className="font-display font-semibold text-slate-200">Abyssinia Games</div>
            <p>
              ETB gaming & agent network platform (from {formatBirr(snapshot.platformSettings.defaultMinStakeEtb)} stakes · min {formatBirr(snapshot.platformSettings.minDepositEtb)} deposit).{' '}
              {primaryAgent
                ? `Primary Telebirr agent: ${primaryAgent.name} (${primaryAgent.phone}).`
                : 'Telebirr agent deposits & direct ETB withdrawals.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('games')}
              className="hover:text-white cursor-pointer"
            >
              Games
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('challenges')}
              className="hover:text-white cursor-pointer"
            >
              Quests
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('leaderboard')}
              className="hover:text-white cursor-pointer"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => openWalletModal('deposit')}
              className="hover:text-white cursor-pointer"
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => openWalletModal('withdraw')}
              className="hover:text-white cursor-pointer"
            >
              Withdraw
            </button>
            <button
              type="button"
              onClick={() =>
                currentUser ? handleNavigate('profile') : openAuthModal('login')
              }
              className="hover:text-white cursor-pointer"
            >
              {currentUser ? 'Profile' : 'Sign In'}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Thumb Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#0B0E1B]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-5 items-center"
        aria-label="Mobile Navigation"
      >
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            route === 'home' ? 'text-violet-400' : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('games')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            route === 'games' ? 'text-violet-400' : 'text-slate-400'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Games</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('challenges')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            route === 'challenges' ? 'text-violet-400' : 'text-slate-400'
          }`}
        >
          <Award className="w-5 h-5" />
          <span className="text-[10px] font-medium">Quests</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('leaderboard')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            route === 'leaderboard' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-medium">Ranks</span>
        </button>

        <button
          type="button"
          onClick={() =>
            currentUser
              ? handleNavigate(
                  currentUser.role === 'admin' && route === 'profile' ? 'admin' : 'profile'
                )
              : openAuthModal('login')
          }
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            route === 'profile' || route === 'admin'
              ? 'text-violet-400'
              : 'text-slate-400'
          }`}
        >
          {currentUser?.role === 'admin' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : currentUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Compass className="w-5 h-5" />
          )}
          <span className="text-[10px] font-medium">
            {currentUser ? 'Account' : 'Sign In'}
          </span>
        </button>
      </nav>

      {/* Playable Game Arena Overlay */}
      {liveActiveGame && (
        <GameArenaModal
          game={liveActiveGame}
          currentUser={currentUser}
          snapshot={snapshot}
          onClose={() => setActiveGame(null)}
          onSnapshotSync={setSnapshot}
          onPromptSignIn={() => {
            setActiveGame(null);
            openAuthModal('login');
          }}
          onPromptDeposit={() => {
            setActiveGame(null);
            openWalletModal('deposit');
          }}
        />
      )}

      {/* Auth Modal */}
      {authModalOpen && (
        <AuthModal
          initialMode={authInitialMode}
          initialReferralCode={pendingReferralCode}
          isFirstAccount={snapshot.users.length === 0}
          onClose={closeAuthModal}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}

      {/* Telebirr Wallet Modal (Deposit & Withdraw) */}
      {walletTab !== null && (
        <WalletModal
          initialTab={walletTab}
          currentUser={currentUser}
          agents={snapshot.agents}
          minDepositEtb={snapshot.platformSettings.minDepositEtb}
          minWithdrawalEtb={snapshot.platformSettings.minWithdrawalEtb}
          onClose={closeWalletModal}
          onSubmitDeposit={handleSubmitDeposit}
          onSubmitWithdrawal={handleSubmitWithdrawal}
          onPromptSignIn={() => openAuthModal('login')}
        />
      )}
    </div>
  );
}
