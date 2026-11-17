import { useEffect, useState, type FormEvent } from 'react';
import { AVATAR_OPTIONS, AvatarBadge } from '@/src/components/common/AvatarBadge';
import {
  applyForAgentOnServer,
  fetchOwnAgentFinancialDetails,
  formatBirr,
  redeemReferralRewardsOnServer,
  submitSupportTicketOnServer,
} from '@/src/services/platformService';
import type {
  ActiveRoute,
  AgentEligibilityCheck,
  AgentProfile,
  AvatarId,
  BonusGrantRecord,
  DecryptedAgentFinancialDetails,
  DepositRequest,
  GameSessionRecord,
  PlatformSettings,
  PlatformSnapshot,
  PlatformTransaction,
  ReferralRelationship,
  ReferralRewardRecord,
  SupportTicketRecord,
  TelebirrAgent,
  UserProfile,
  WithdrawalRequest,
} from '@/src/types/platform';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Gift,
  HelpCircle,
  Lock,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  Share2,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  sessions: GameSessionRecord[];
  depositRequests: DepositRequest[];
  withdrawalRequests: WithdrawalRequest[];
  bonusGrants: BonusGrantRecord[];
  agents: TelebirrAgent[];
  platformSettings: PlatformSettings;
  myAgentProfile: AgentProfile | null;
  myEligibility: AgentEligibilityCheck | null;
  myReferralParent: ReferralRelationship | null;
  myReferralRewards: ReferralRewardRecord[];
  transactions: PlatformTransaction[];
  supportTickets: SupportTicketRecord[];
  onUpdateProfile: (updates: {
    displayName: string;
    fullName?: string;
    phone?: string;
    avatarId: AvatarId;
  }) => void;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
  onOpenWallet: (tab: 'deposit' | 'withdraw') => void;
  onNavigate: (route: ActiveRoute) => void;
}

type PlayerTab =
  | 'overview'
  | 'transactions'
  | 'referrals'
  | 'become_agent'
  | 'support'
  | 'settings';

export function ProfileView({
  currentUser,
  sessions,
  depositRequests,
  withdrawalRequests,
  bonusGrants,
  agents,
  platformSettings,
  myAgentProfile,
  myEligibility,
  myReferralParent,
  myReferralRewards,
  transactions,
  supportTickets,
  onUpdateProfile,
  onSnapshotSync,
  onSignOut,
  onOpenAuth,
  onOpenWallet,
  onNavigate,
}: ProfileViewProps) {
  const [tab, setTab] = useState<PlayerTab>('overview');
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatarId, setAvatarId] = useState<AvatarId>(currentUser?.avatarId || 'lion');
  const [savedNotice, setSavedNotice] = useState(false);

  // Transaction filter
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');

  // Agent Application Form
  const [appLegalName, setAppLegalName] = useState(currentUser?.fullName || '');
  const [appPhone, setAppPhone] = useState(currentUser?.phone || '');
  const [appBankName, setAppBankName] = useState('Commercial Bank of Ethiopia (CBE)');
  const [appBankAccountName, setAppBankAccountName] = useState(currentUser?.fullName || '');
  const [appBankAccountNumber, setAppBankAccountNumber] = useState('');
  const [appCbeDetails, setAppCbeDetails] = useState('');
  const [appTelebirrAccount, setAppTelebirrAccount] = useState(currentUser?.phone || '');
  const [appDocRef, setAppDocRef] = useState('');
  const [appBusy, setAppBusy] = useState(false);
  const [appMessage, setAppMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [decryptedFinancials, setDecryptedFinancials] =
    useState<DecryptedAgentFinancialDetails | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // Rewards & Referral Link copy/redeem
  const [copiedRef, setCopiedRef] = useState(false);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  // Support Ticket Form
  const [ticketCategory, setTicketCategory] =
    useState<SupportTicketRecord['category']>('account');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setFullName(currentUser.fullName || currentUser.displayName);
      setPhone(currentUser.phone || '');
      setAvatarId(currentUser.avatarId);
      setAppLegalName((prev) => prev || currentUser.fullName || currentUser.displayName);
      setAppPhone((prev) => prev || currentUser.phone || '');
      setAppBankAccountName((prev) => prev || currentUser.fullName || currentUser.displayName);
      setAppTelebirrAccount((prev) => prev || currentUser.phone || '');
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center max-w-lg mx-auto space-y-5 my-8">
        <h1 className="text-2xl font-display font-bold text-white">Player Dashboard</h1>
        <p className="text-sm text-slate-300">
          Register as a player or sign in to manage your ETB wallet, track match payouts, apply to become an agent, or contact support.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
        >
          Sign In / Register Player Account
        </button>
      </div>
    );
  }

  const userSessions = sessions.filter((s) => s.userId === currentUser.id);
  const userDeposits = depositRequests.filter((d) => d.userId === currentUser.id);
  const userWithdrawals = withdrawalRequests.filter((w) => w.userId === currentUser.id);
  const userBonuses = bonusGrants.filter(
    (b) => b.userId === currentUser.id || b.userId === 'ALL'
  );
  const userTransactions = transactions.filter(
    (t) => t.userId === currentUser.id && (txTypeFilter === 'all' || t.transactionType === txTypeFilter)
  );
  const userTickets = supportTickets.filter((t) => t.userId === currentUser.id);
  const primaryAgent =
    agents.find((a) => a.isActive && a.isPrimary) ||
    agents.find((a) => a.isActive) ||
    agents[0];

  const winRate =
    currentUser.gamesPlayed > 0
      ? Math.round((currentUser.wins / currentUser.gamesPlayed) * 100)
      : 0;

  const isApprovedAgent =
    currentUser.accountType === 'agent' || myAgentProfile?.applicationStatus === 'approved';

  const approvedRewardEtb = myReferralRewards
    .filter((r) => r.rewardStatus === 'approved')
    .reduce((sum, r) => sum + r.rewardAmountEtb, 0);
  const creditedRewardEtb = myReferralRewards
    .filter((r) => r.rewardStatus === 'redeemed')
    .reduce((sum, r) => sum + r.rewardAmountEtb, 0);
  const pendingRewardEtb = myReferralRewards
    .filter((r) => r.rewardStatus === 'pending')
    .reduce((sum, r) => sum + r.rewardAmountEtb, 0);

  const liveOrigin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const agentCode = myAgentProfile?.agentCode || currentUser.agentCode;
  const referralShareUrl = agentCode
    ? `${liveOrigin}/register?ref=${encodeURIComponent(agentCode)}`
    : '';

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !fullName.trim()) return;
    onUpdateProfile({
      displayName: displayName.trim(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      avatarId,
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleSubmitAgentApplication = async (e: FormEvent) => {
    e.preventDefault();
    setAppMessage(null);
    setAppBusy(true);
    try {
      const res = await applyForAgentOnServer({
        fullLegalName: appLegalName.trim(),
        phone: appPhone.trim(),
        bankName: appBankName.trim(),
        bankAccountName: appBankAccountName.trim(),
        bankAccountNumber: appBankAccountNumber.trim(),
        cbeAccountDetails: appCbeDetails.trim(),
        telebirrAccount: appTelebirrAccount.trim(),
        verificationDocRef: appDocRef.trim() || undefined,
      });
      onSnapshotSync(res.snapshot);
      setAppMessage({
        type: 'success',
        text: 'Agent application submitted with AES-256 encrypted financial protection. Pending Administrator review.',
      });
      setAppBankAccountNumber('');
      setAppCbeDetails('');
    } catch (err) {
      setAppMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to submit agent application.',
      });
    } finally {
      setAppBusy(false);
    }
  };

  const handleRevealOwnFinancials = async () => {
    if (decryptedFinancials) {
      setDecryptedFinancials(null);
      return;
    }
    setLoadingFinancials(true);
    try {
      const details = await fetchOwnAgentFinancialDetails();
      setDecryptedFinancials(details);
    } catch (err) {
      setAppMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to decrypt details.',
      });
    } finally {
      setLoadingFinancials(false);
    }
  };

  const handleRedeemRewards = async () => {
    setRedeemBusy(true);
    setRewardMessage(null);
    try {
      const res = await redeemReferralRewardsOnServer();
      onSnapshotSync(res.snapshot);
      setRewardMessage(
        `Credited ${formatBirr(res.redeemedAmountEtb)} to your ETB balance (Ref: ${res.referenceNumber}).`
      );
    } catch (err) {
      setRewardMessage(err instanceof Error ? err.message : 'Unable to redeem rewards.');
    } finally {
      setRedeemBusy(false);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!referralShareUrl) return;
    try {
      await navigator.clipboard.writeText(referralShareUrl);
      setCopiedRef(true);
      window.setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      setRewardMessage(`Copy your link: ${referralShareUrl}`);
    }
  };

  const handleSubmitTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketBody.trim()) return;
    setTicketBusy(true);
    setTicketNotice(null);
    try {
      const res = await submitSupportTicketOnServer({
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketBody.trim(),
      });
      onSnapshotSync(res.snapshot);
      setTicketSubject('');
      setTicketBody('');
      setTicketNotice('Support ticket submitted. An administrator will reply shortly.');
    } catch (err) {
      setTicketNotice(err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Player Dashboard Header */}
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <AvatarBadge avatarId={currentUser.avatarId} size="lg" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>@{currentUser.username}</span>
              <span>·</span>
              <span className="uppercase font-semibold text-violet-300">
                {currentUser.role === 'admin'
                  ? 'Administrator'
                  : isApprovedAgent
                    ? 'Player + Agent'
                    : 'Player'}
              </span>
              <span>·</span>
              <span>Registered {new Date(currentUser.joinedAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
              {currentUser.fullName || currentUser.displayName}
            </h1>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{currentUser.email}</span>
              {currentUser.phone && <span className="font-mono text-blue-300">{currentUser.phone}</span>}
              {myReferralParent && (
                <span className="text-emerald-300">
                  Referred by @{myReferralParent.parentAgentCode}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onOpenWallet('deposit')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit ETB</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenWallet('withdraw')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdraw ETB</span>
          </button>
          {isApprovedAgent && (
            <button
              type="button"
              onClick={() => onNavigate('agent')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              <span>Agent Dashboard</span>
            </button>
          )}
          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-sm font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#161B33] hover:bg-[#1E2544] border border-white/10 text-slate-200 text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 flex flex-col justify-between gap-2">
          <div>
            <div className="text-xs text-slate-400">Account Balance (ETB)</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
              {formatBirr(currentUser.balanceBirr)}
            </div>
            <div className="text-[11px] font-mono text-emerald-300 mt-0.5 tabular-nums">
              Min Deposit: {formatBirr(platformSettings.minDepositEtb)}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenWallet('deposit')}
              className="text-xs font-semibold text-violet-300 hover:text-violet-200 cursor-pointer"
            >
              + Deposit
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => onOpenWallet('withdraw')}
              className="text-xs font-semibold text-blue-300 hover:text-blue-200 cursor-pointer"
            >
              Withdraw
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Matches Played</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1 tabular-nums">
            {currentUser.gamesPlayed}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Win Rate: {winRate}% ({currentUser.wins} wins)
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Referral Rewards Credited</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-300 mt-1 tabular-nums">
            {formatBirr(creditedRewardEtb + approvedRewardEtb)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ready: {formatBirr(approvedRewardEtb)} · Pending: {formatBirr(pendingRewardEtb)}
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Agent Status</div>
          <div className="text-xl sm:text-2xl font-display font-bold text-violet-300 mt-1 capitalize">
            {myAgentProfile ? myAgentProfile.applicationStatus : 'Player Only'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {agentCode ? `Code: ${agentCode}` : 'Apply in Become an Agent'}
          </div>
        </div>
      </div>

      {/* Player Dashboard Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1324] border border-white/10 overflow-x-auto max-w-full">
        {[
          { id: 'overview' as const, label: 'Game History & Wallet', icon: Trophy },
          { id: 'transactions' as const, label: 'Transactions', icon: Receipt },
          { id: 'referrals' as const, label: 'Referrals & Rewards', icon: Users },
          { id: 'become_agent' as const, label: 'Become an Agent', icon: Briefcase },
          { id: 'support' as const, label: 'Customer Support', icon: HelpCircle },
          { id: 'settings' as const, label: 'Account Settings', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                tab === item.id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview (Game History, Deposits, Withdrawals, Bonuses) */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <h2 className="text-lg font-display font-bold text-white">Game History</h2>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {userSessions.length} recorded
              </span>
            </div>

            {userSessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No matches recorded yet. Launch any game from {formatBirr(platformSettings.defaultMinStakeEtb)} stakes to start playing.
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {userSessions.slice(0, 15).map((ses) => {
                  const outcomeLabel =
                    ses.outcome === 'cashed_out'
                      ? 'Cashed Out'
                      : ses.outcome === 'win'
                        ? 'Won'
                        : ses.outcome === 'draw'
                          ? 'Draw'
                          : 'Loss';
                  const isProfit = ses.payoutBirr > 0;
                  return (
                    <div
                      key={ses.id}
                      className="py-3.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{ses.gameTitle}</div>
                        <div className="text-xs text-slate-400 tabular-nums">
                          {outcomeLabel}
                          {ses.stakeBirr > 0 ? ` · Stake ${formatBirr(ses.stakeBirr)}` : ' · Practice'}
                          {ses.multiplier > 0 ? ` · ${ses.multiplier}x` : ''}
                          {' · '}
                          {new Date(ses.playedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold tabular-nums shrink-0">
                        {isProfit ? (
                          <span className="text-emerald-300">+{formatBirr(ses.payoutBirr)}</span>
                        ) : ses.stakeBirr > 0 ? (
                          <span className="text-rose-300">-{formatBirr(ses.stakeBirr)}</span>
                        ) : (
                          <span className="text-slate-400">Demo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {userBonuses.length > 0 && (
            <div className="rounded-2xl bg-[#0F1324] border border-emerald-400/20 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-300" />
                <h2 className="text-lg font-display font-bold text-white">Bonuses Credited</h2>
              </div>
              <div className="divide-y divide-white/8">
                {userBonuses.slice(0, 6).map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-white font-semibold">{b.reason}</span>
                      <span className="text-slate-400 ml-2">
                        by {b.grantedBy} · {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums">
                      +{formatBirr(b.amountBirr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Telebirr Deposit Requests */}
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-white">Deposit Requests</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {primaryAgent
                      ? `Primary Agent: ${primaryAgent.name} (${primaryAgent.phone}) · Min ${formatBirr(platformSettings.minDepositEtb)}`
                      : `Min deposit ${formatBirr(platformSettings.minDepositEtb)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenWallet('deposit')}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  New Deposit
                </button>
              </div>

              {userDeposits.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No deposit requests submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {userDeposits.map((dep) => (
                    <div
                      key={dep.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white tabular-nums">
                          +{formatBirr(dep.amountBirr)} → {dep.agentName} ({dep.agentPhone})
                        </div>
                        <div className="text-slate-400 truncate">
                          {dep.telebirrReference ? `Ref: ${dep.telebirrReference}` : 'Receipt uploaded'} ·{' '}
                          {new Date(dep.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`font-semibold inline-flex items-center gap-1 shrink-0 ${
                          dep.status === 'approved'
                            ? 'text-emerald-300'
                            : dep.status === 'pending'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }`}
                      >
                        {dep.status === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : dep.status === 'pending' ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span className="capitalize">{dep.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Telebirr Withdrawals */}
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display font-bold text-white">Withdrawal Requests</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subject to platform regulatory review · Min {formatBirr(platformSettings.minWithdrawalEtb)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenWallet('withdraw')}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  New Withdrawal
                </button>
              </div>

              {userWithdrawals.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No withdrawal requests submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {userWithdrawals.map((wd) => (
                    <div
                      key={wd.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white tabular-nums">
                          {formatBirr(wd.amountBirr)} → {wd.telebirrPhone}
                        </div>
                        <div className="text-slate-400 truncate">
                          {wd.recipientName} · {new Date(wd.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`font-semibold inline-flex items-center gap-1 shrink-0 ${
                          wd.status === 'approved'
                            ? 'text-emerald-300'
                            : wd.status === 'pending'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }`}
                      >
                        <span className="capitalize">
                          {wd.status === 'approved'
                            ? 'Paid'
                            : wd.status === 'rejected'
                              ? 'Refunded'
                              : 'Pending'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Unified Transactions Ledger */}
      {tab === 'transactions' && (
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-display font-bold text-white">
                Transaction History (ETB)
              </h2>
              <p className="text-xs text-slate-400">
                Unified audit ledger for deposits, withdrawals, reward redemptions, wagers, and payouts.
              </p>
            </div>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="min-h-[38px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-xs text-white"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="reward_redemption">Reward Redemptions</option>
              <option value="bonus">Bonuses</option>
              <option value="wager">Wagers</option>
              <option value="payout">Payouts</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>

          {userTransactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No transactions match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 bg-[#0B0E1B]">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3">Note</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {userTransactions.slice(0, 60).map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white uppercase">
                        {tx.transactionType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-3 font-mono text-blue-300">{tx.referenceNumber}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {tx.note || '—'}
                      </td>
                      <td className="py-3 px-3 capitalize text-slate-200">{tx.status}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-300 tabular-nums whitespace-nowrap">
                        {formatBirr(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Referral Invitation & Rewards */}
      {tab === 'referrals' && (
        <div className="space-y-6">
          {rewardMessage && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/35 px-4 py-3 text-xs sm:text-sm text-emerald-200">
              {rewardMessage}
            </div>
          )}

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  Referral Invitation & Network Access
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {platformSettings.rewardPolicy.policySummary}
                </p>
              </div>
              {isApprovedAgent && (
                <button
                  type="button"
                  onClick={() => onNavigate('agent')}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Open Full Agent Dashboard
                </button>
              )}
            </div>

            {isApprovedAgent ? (
              referralShareUrl ? (
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">
                      Your Permanent Agent Code: <span className="font-mono text-amber-300 font-bold">{agentCode}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-mono text-blue-300 truncate mt-0.5">
                      {referralShareUrl}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopyReferralLink()}
                      className="min-h-[36px] px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRef ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('agent')}
                      className="min-h-[36px] px-3 rounded-lg bg-[#161C36] border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Manage Tree</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#080B15] border border-amber-400/25 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                  <span>Your agent profile is approved. Generate your permanent referral code in the Agent Dashboard.</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('agent')}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold cursor-pointer"
                  >
                    Generate Code Now
                  </button>
                </div>
              )
            ) : (
              <div className="rounded-xl bg-[#080B15] border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                <span>
                  To generate a permanent referral code and invite players, apply for Agent status under the Become an Agent tab.
                </span>
                <button
                  type="button"
                  onClick={() => setTab('become_agent')}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold cursor-pointer"
                >
                  Apply to Become an Agent
                </button>
              </div>
            )}
          </div>

          {/* Available Rewards & Self-Transfer */}
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-display font-bold text-white">
                  Referral Rewards ({formatBirr(approvedRewardEtb)} Approved)
                </h3>
                <p className="text-xs text-slate-400">
                  Minimum redemption threshold: {formatBirr(platformSettings.rewardPolicy.minRedeemEtb)}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  redeemBusy ||
                  !platformSettings.rewardPolicy.allowSelfTransferToBalance ||
                  approvedRewardEtb < platformSettings.rewardPolicy.minRedeemEtb
                }
                onClick={() => void handleRedeemRewards()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>
                  {redeemBusy
                    ? 'Transferring...'
                    : `Transfer ${formatBirr(approvedRewardEtb)} to Player Balance`}
                </span>
              </button>
            </div>

            {myReferralRewards.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No referral rewards recorded on your account yet.
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {myReferralRewards.map((rw) => (
                  <div
                    key={rw.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {rw.rewardType.replace(/_/g, ' ').toUpperCase()} · @{rw.referredUsername}
                      </div>
                      <div className="text-slate-400 font-mono">
                        Ref: {rw.rewardReference} · {new Date(rw.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-300">
                        +{formatBirr(rw.rewardAmountEtb)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded uppercase font-semibold ${
                          rw.rewardStatus === 'redeemed'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : rw.rewardStatus === 'pending'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-white/5 text-slate-200'
                        }`}
                      >
                        {rw.rewardStatus === 'redeemed' ? 'Credited Active ETB' : rw.rewardStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Player-to-Agent Application & Status */}
      {tab === 'become_agent' && (
        <div className="space-y-6">
          {appMessage && (
            <div
              className={`rounded-xl px-4 py-3 text-xs sm:text-sm border ${
                appMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200'
                  : 'bg-rose-500/10 border-rose-400/35 text-rose-200'
              }`}
            >
              {appMessage.text}
            </div>
          )}

          {/* Eligibility Check */}
          {myEligibility && (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-display font-bold text-white">
                  Agent Eligibility Status
                </h2>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    myEligibility.eligible
                      ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-200'
                      : 'bg-amber-500/15 border border-amber-400/35 text-amber-200'
                  }`}
                >
                  {myEligibility.eligible ? 'Eligible to Apply' : 'Requirements Not Yet Met'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Account Age</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {myEligibility.accountAgeDays} days (Min {platformSettings.agentEligibility.minAccountAgeDays})
                  </div>
                </div>
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Games Played</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {myEligibility.gamesPlayed} (Min {platformSettings.agentEligibility.minGamesPlayed})
                  </div>
                </div>
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Approved Deposits</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {formatBirr(myEligibility.totalDepositedEtb)} (Min {formatBirr(platformSettings.agentEligibility.minTotalDepositedEtb)})
                  </div>
                </div>
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Phone on File</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {myEligibility.hasPhoneOnFile ? 'Verified' : 'Required'}
                  </div>
                </div>
              </div>
              {myEligibility.reasons.length > 0 && (
                <ul className="text-xs text-rose-300 list-disc pl-5 space-y-1">
                  {myEligibility.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Existing Agent Profile Status Card */}
          {myAgentProfile && (
            <div className="rounded-2xl bg-[#0F1324] border border-violet-400/30 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">
                    Application Submitted {new Date(myAgentProfile.createdAt).toLocaleDateString()}
                  </div>
                  <h3 className="text-lg font-display font-bold text-white">
                    {myAgentProfile.fullLegalName} ·{' '}
                    <span className="capitalize text-amber-300">
                      {myAgentProfile.applicationStatus}
                    </span>
                  </h3>
                  {myAgentProfile.rejectionReason && (
                    <p className="text-xs text-rose-300 mt-1">
                      Reason: {myAgentProfile.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingFinancials}
                    onClick={() => void handleRevealOwnFinancials()}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#161C36] border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {decryptedFinancials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{decryptedFinancials ? 'Hide Encrypted Fields' : 'View My Encrypted Info'}</span>
                  </button>
                  {myAgentProfile.applicationStatus === 'approved' && (
                    <button
                      type="button"
                      onClick={() => onNavigate('agent')}
                      className="min-h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      Open Agent Dashboard
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Bank Account Number</div>
                  <div className="font-mono text-amber-300 mt-1">
                    {decryptedFinancials?.bankAccountNumber || myAgentProfile.maskedBankAccount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">CBE Account Details</div>
                  <div className="font-mono text-blue-300 mt-1">
                    {decryptedFinancials?.cbeAccountDetails || myAgentProfile.maskedCbeAccount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <div className="text-slate-400">Telebirr Account</div>
                  <div className="font-mono text-emerald-300 mt-1">
                    {decryptedFinancials?.telebirrAccount || myAgentProfile.maskedTelebirrAccount}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Application Form (Shown when no profile yet or previously rejected) */}
          {(!myAgentProfile || myAgentProfile.applicationStatus === 'rejected') && (
            <form
              onSubmit={handleSubmitAgentApplication}
              className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-display font-bold text-white">
                    Player-to-Agent Upgrade Application
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your existing player account receives Agent permissions once approved. All bank, CBE, and Telebirr numbers are AES-256-GCM encrypted.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>AES-256 Encrypted</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={appLegalName}
                    onChange={(e) => setAppLegalName(e.target.value)}
                    placeholder="Abebe Bikila Kebede"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={appPhone}
                    onChange={(e) => setAppPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={appBankName}
                    onChange={(e) => setAppBankName(e.target.value)}
                    placeholder="Commercial Bank of Ethiopia"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bank Account Holder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={appBankAccountName}
                    onChange={(e) => setAppBankAccountName(e.target.value)}
                    placeholder="Account holder legal name"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={appBankAccountNumber}
                    onChange={(e) => setAppBankAccountNumber(e.target.value)}
                    placeholder="e.g. 1000xxxxxxxxx"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Commercial Bank of Ethiopia (CBE) Account Details
                  </label>
                  <input
                    type="text"
                    required
                    value={appCbeDetails}
                    onChange={(e) => setAppCbeDetails(e.target.value)}
                    placeholder="CBE Branch & 13-digit Account e.g. 1000123456789 (Bole)"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Telebirr Account Information
                  </label>
                  <input
                    type="text"
                    required
                    value={appTelebirrAccount}
                    onChange={(e) => setAppTelebirrAccount(e.target.value)}
                    placeholder="09xxxxxxxx / Telebirr Registered Name"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    National ID / Fayda / Kebele Ref (Optional)
                  </label>
                  <input
                    type="text"
                    value={appDocRef}
                    onChange={(e) => setAppDocRef(e.target.value)}
                    placeholder="ID verification reference"
                    className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={appBusy || (myEligibility !== null && !myEligibility.eligible)}
                className="min-h-[44px] px-6 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {appBusy ? 'Submitting Encrypted Application...' : 'Submit Agent Application'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 5: Customer Support */}
      {tab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSubmitTicket}
            className="lg:col-span-5 rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-300" />
              <h2 className="text-lg font-display font-bold text-white">Customer Support</h2>
            </div>

            {ticketNotice && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/35 px-3 py-2 text-xs text-emerald-200">
                {ticketNotice}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Category</label>
              <select
                value={ticketCategory}
                onChange={(e) =>
                  setTicketCategory(e.target.value as SupportTicketRecord['category'])
                }
                className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
              >
                <option value="account">Account & Verification</option>
                <option value="deposit">Deposit Inquiry</option>
                <option value="withdrawal">Withdrawal & Regulation</option>
                <option value="agent">Agent Application</option>
                <option value="referral">Referral & Rewards</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief summary of your request"
                className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Message</label>
              <textarea
                required
                rows={4}
                value={ticketBody}
                onChange={(e) => setTicketBody(e.target.value)}
                placeholder="Include Telebirr reference or relevant details..."
                className="w-full rounded-xl bg-[#080B15] border border-white/12 p-3 text-sm text-white"
              />
            </div>

            <button
              type="submit"
              disabled={ticketBusy}
              className="w-full min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              {ticketBusy ? 'Sending...' : 'Submit Support Request'}
            </button>
          </form>

          <div className="lg:col-span-7 rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-white">Your Support Tickets</h3>
            {userTickets.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No support requests opened yet.
              </div>
            ) : (
              <div className="space-y-3">
                {userTickets.map((tk) => (
                  <div
                    key={tk.id}
                    className="rounded-xl bg-[#080B15] border border-white/10 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">{tk.subject}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 uppercase font-semibold text-amber-300">
                        {tk.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-slate-300">{tk.message}</p>
                    {tk.adminReply && (
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/25 p-2.5 text-emerald-200">
                        <span className="font-semibold">Admin Reply:</span> {tk.adminReply}
                      </div>
                    )}
                    <div className="text-slate-500">
                      {tk.category} · {new Date(tk.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Personal Account Settings */}
      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-5 max-w-xl"
        >
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-300" />
            <h2 className="text-lg font-display font-bold text-white">Personal Account Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm text-white focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              className="w-full min-h-[44px] rounded-xl bg-[#080B15] border border-white/12 px-3.5 text-sm font-mono text-white focus:outline-none focus:border-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Player Emblem
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAvatarId(opt.id)}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                    avatarId === opt.id
                      ? 'bg-violet-600/20 border-amber-400'
                      : 'bg-[#080B15] border-white/10 hover:border-white/25'
                  }`}
                >
                  <AvatarBadge avatarId={opt.id} size="sm" />
                  <span className="text-[10px] text-slate-300">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save Account Settings</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

