import { useEffect, useState, type FormEvent } from 'react';
import { AvatarBadge } from '@/src/components/common/AvatarBadge';
import { ReferralTreeViewer } from '@/src/components/common/ReferralTreeViewer';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import {
  adminApproveAllPendingRewardsOnServer,
  adminFetchAgentFinancialDetailsOnServer,
  adminFetchNetworkOnServer,
  adminGrantAgentRewardOnServer,
  adminResolveFraudAlertOnServer,
  adminReviewAgentApplicationOnServer,
  adminReviewRewardOnServer,
  adminSavePlatformSettingsOnServer,
  adminSetAgentStatusOnServer,
  adminUpdateSupportTicketOnServer,
  downloadAdminCsvReport,
  formatBirr,
} from '@/src/services/platformService';
import type {
  AgentProfile,
  AuditLogRecord,
  BonusGrantRecord,
  DecryptedAgentFinancialDetails,
  DepositRequest,
  GameCatalogItem,
  PlatformSettings,
  PlatformSnapshot,
  PlatformTransaction,
  ReferralRelationship,
  ReferralRewardRecord,
  ReferralTreeNode,
  SupportTicketRecord,
  TelebirrAgent,
  UserProfile,
  VerificationStatus,
  WithdrawalRequest,
} from '@/src/types/platform';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Briefcase,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileText,
  Gamepad2,
  Gift,
  GitBranch,
  HelpCircle,
  Lock,
  PhoneCall,
  Plus,
  Receipt,
  Save,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

interface AdminDashboardViewProps {
  currentUser: UserProfile | null;
  games: GameCatalogItem[];
  users: UserProfile[];
  agents: TelebirrAgent[];
  depositRequests: DepositRequest[];
  withdrawalRequests: WithdrawalRequest[];
  bonusGrants: BonusGrantRecord[];
  platformSettings: PlatformSettings;
  agentProfiles: AgentProfile[];
  referralRelationships: ReferralRelationship[];
  referralRewards: ReferralRewardRecord[];
  transactions: PlatformTransaction[];
  auditLogs: AuditLogRecord[];
  supportTickets: SupportTicketRecord[];
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onSaveGame: (game: GameCatalogItem) => Promise<AdminActionResult>;
  onSaveAgent: (
    agent: Partial<TelebirrAgent> & { name: string; phone: string }
  ) => Promise<AdminActionResult>;
  onDeleteAgent: (agentId: string) => Promise<AdminActionResult>;
  onGrantBonus: (params: {
    targetUserId: string | 'ALL';
    amountBirr: number;
    reason: string;
  }) => Promise<AdminActionResult>;
  onToggleUserBan: (userId: string) => Promise<AdminActionResult>;
  onToggleUserRole: (userId: string) => Promise<AdminActionResult>;
  onAdjustUserBirr: (userId: string, delta: number) => Promise<AdminActionResult>;
  onReviewDeposit: (
    requestId: string,
    decision: 'approved' | 'rejected',
    adminNote?: string
  ) => Promise<AdminActionResult>;
  onReviewWithdrawal: (
    requestId: string,
    decision: 'approved' | 'rejected',
    payoutReference?: string,
    adminNote?: string
  ) => Promise<AdminActionResult>;
}

interface GameDraft {
  minStakeBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
  maxMultiplier: number;
  cashoutEnabled: boolean;
}

interface AgentDraft {
  name: string;
  phone: string;
  note: string;
}

export function AdminDashboardView({
  currentUser,
  games,
  users,
  agents,
  depositRequests,
  withdrawalRequests,
  bonusGrants,
  platformSettings,
  agentProfiles,
  referralRelationships,
  referralRewards,
  transactions,
  auditLogs,
  supportTickets,
  onSnapshotSync,
  onSaveGame,
  onSaveAgent,
  onDeleteAgent,
  onGrantBonus,
  onToggleUserBan,
  onToggleUserRole,
  onAdjustUserBirr,
  onReviewDeposit,
  onReviewWithdrawal,
}: AdminDashboardViewProps) {
  const [tab, setTab] = useState<
    | 'deposits'
    | 'withdrawals'
    | 'games'
    | 'users'
    | 'agents'
    | 'agent_profiles'
    | 'network'
    | 'settings'
    | 'ledger'
    | 'audit'
  >('deposits');
  const [userSearch, setUserSearch] = useState('');
  const [previewScreenshot, setPreviewScreenshot] = useState<DepositRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Game configuration drafts
  const [gameDrafts, setGameDrafts] = useState<Record<string, GameDraft>>({});
  const [savedGameId, setSavedGameId] = useState<string | null>(null);

  // Bonus grant form & per-user Birr delta input
  const [bonusTarget, setBonusTarget] = useState<string>('ALL');
  const [bonusAmount, setBonusAmount] = useState<number>(25);
  const [bonusReason, setBonusReason] = useState<string>('Admin Player Bonus');
  const [customUserDeltas, setCustomUserDeltas] = useState<Record<string, number>>({});

  // Quick primary Telebirr deposit phone editor & agent drafts
  const [primaryNameDraft, setPrimaryNameDraft] = useState('');
  const [primaryPhoneDraft, setPrimaryPhoneDraft] = useState('');
  const [agentDrafts, setAgentDrafts] = useState<Record<string, AgentDraft>>({});
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentNote, setNewAgentNote] = useState('');
  const [newAgentPrimary, setNewAgentPrimary] = useState(false);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(null);

  // Agent profiles, network hierarchy, settings, ledger, support & audit state
  const [agentProfileSearch, setAgentProfileSearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState<string>('all');
  const [agentReviewReasons, setAgentReviewReasons] = useState<Record<string, string>>({});
  const [decryptedModal, setDecryptedModal] = useState<{
    agent: AgentProfile;
    details: DecryptedAgentFinancialDetails;
  } | null>(null);

  const [networkTrees, setNetworkTrees] = useState<ReferralTreeNode[]>([]);
  const [flaggedRelationships, setFlaggedRelationships] = useState<ReferralRelationship[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(platformSettings);
  const [applyStakeAll, setApplyStakeAll] = useState(false);
  const [grantRewardAgentUserId, setGrantRewardAgentUserId] = useState('');
  const [grantRewardAmount, setGrantRewardAmount] = useState(15);
  const [grantRewardNote, setGrantRewardNote] = useState('Promotional Agent Milestone Reward');

  const [txSearch, setTxSearch] = useState('');
  const [supportReplies, setSupportReplies] = useState<Record<string, string>>({});

  useEffect(() => {
    setSettingsDraft(platformSettings);
  }, [platformSettings]);

  useEffect(() => {
    const nextGameDrafts: Record<string, GameDraft> = {};
    for (const g of games) {
      nextGameDrafts[g.id] = {
        minStakeBirr: g.minStakeBirr,
        playerWinPercent: g.playerWinPercent ?? 30,
        bonusBirr: g.bonusBirr,
        maxMultiplier: g.maxMultiplier,
        cashoutEnabled: g.cashoutEnabled,
      };
    }
    setGameDrafts(nextGameDrafts);
  }, [games]);

  useEffect(() => {
    const nextAgentDrafts: Record<string, AgentDraft> = {};
    for (const a of agents) {
      nextAgentDrafts[a.id] = {
        name: a.name,
        phone: a.phone,
        note: a.note || '',
      };
    }
    setAgentDrafts(nextAgentDrafts);
    const activePrimary =
      agents.find((a) => a.isActive && a.isPrimary) ||
      agents.find((a) => a.isActive) ||
      agents[0];
    if (activePrimary) {
      setPrimaryNameDraft(activePrimary.name);
      setPrimaryPhoneDraft(activePrimary.phone);
    }
  }, [agents]);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center max-w-lg mx-auto space-y-3 my-8">
        <ShieldCheck className="w-10 h-10 text-amber-300 mx-auto" />
        <h1 className="text-2xl font-display font-bold text-white">Administrator Access Required</h1>
        <p className="text-sm text-slate-400">
          Sign in with an administrator account to configure game odds, Birr bonuses, Telebirr agents, deposits, withdrawals, and player permissions.
        </p>
      </div>
    );
  }

  const totalPoolBirr = users.reduce((sum, u) => sum + u.balanceBirr, 0);
  const totalPlays = games.reduce((sum, g) => sum + g.playCount, 0);
  const pendingDepositsCount = depositRequests.filter((d) => d.status === 'pending').length;
  const pendingWithdrawalsCount = withdrawalRequests.filter((w) => w.status === 'pending').length;
  const primaryAgent =
    agents.find((a) => a.isActive && a.isPrimary) ||
    agents.find((a) => a.isActive) ||
    agents[0];

  const runWithNotice = async (
    action: () => Promise<AdminActionResult>,
    successText: string
  ): Promise<boolean> => {
    setBusyAction(true);
    setStatusNotice(null);
    const res = await action();
    setBusyAction(false);
    if (res.ok) {
      setStatusNotice({ type: 'success', text: successText });
      return true;
    }
    setStatusNotice({ type: 'error', text: res.error || 'Action failed.' });
    return false;
  };

  const loadNetworkData = async () => {
    setLoadingNetwork(true);
    try {
      const res = await adminFetchNetworkOnServer();
      setNetworkTrees(res.trees);
      setFlaggedRelationships(res.flaggedRelationships);
    } catch (err) {
      setStatusNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load referral hierarchy.',
      });
    } finally {
      setLoadingNetwork(false);
    }
  };

  useEffect(() => {
    if (tab === 'network' && currentUser?.role === 'admin') {
      void loadNetworkData();
    }
  }, [tab, currentUser?.role, referralRelationships.length]);

  const handleSaveGameRow = async (game: GameCatalogItem) => {
    const draft = gameDrafts[game.id];
    if (!draft) return;
    const clampedPlayerPct = Math.max(
      5,
      Math.min(95, Math.round(Number(draft.playerWinPercent) || 30))
    );
    const cleanMinStake = Math.max(
      0.1,
      Math.round((Number(draft.minStakeBirr) || 0.1) * 100) / 100
    );
    const ok = await runWithNotice(
      () =>
        onSaveGame({
          ...game,
          minStakeBirr: cleanMinStake,
          playerWinPercent: clampedPlayerPct,
          bonusBirr: Math.max(0, Math.round((Number(draft.bonusBirr) || 0) * 100) / 100),
          maxMultiplier: Math.max(
            1.5,
            Math.min(25, Math.round((Number(draft.maxMultiplier) || 5) * 100) / 100)
          ),
          cashoutEnabled: draft.cashoutEnabled,
        }),
      `Saved ${game.title}: AI ${100 - clampedPlayerPct}% / Player ${clampedPlayerPct}% · Min ${formatBirr(cleanMinStake)}`
    );
    if (ok) {
      setSavedGameId(game.id);
      window.setTimeout(() => setSavedGameId((prev) => (prev === game.id ? null : prev)), 1500);
    }
  };

  const handleGrantBonusSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bonusAmount || bonusAmount <= 0) return;
    await runWithNotice(
      () =>
        onGrantBonus({
          targetUserId: bonusTarget || 'ALL',
          amountBirr: Number(bonusAmount),
          reason: bonusReason.trim() || 'Admin Birr Bonus',
        }),
      `Granted +${formatBirr(Number(bonusAmount))} bonus`
    );
  };

  const handlePrimaryPhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!primaryNameDraft.trim() || !primaryPhoneDraft.trim()) return;
    await runWithNotice(
      () =>
        onSaveAgent({
          ...(primaryAgent || {}),
          name: primaryNameDraft.trim(),
          phone: primaryPhoneDraft.trim(),
          isActive: true,
          isPrimary: true,
        }),
      `Updated Primary Deposit Telebirr number to ${primaryPhoneDraft.trim()}`
    );
  };

  const handleAddAgentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentPhone.trim()) return;
    const ok = await runWithNotice(
      () =>
        onSaveAgent({
          name: newAgentName.trim(),
          phone: newAgentPhone.trim(),
          note: newAgentNote.trim() || undefined,
          isActive: true,
          isPrimary: newAgentPrimary,
        }),
      `Added Telebirr agent ${newAgentName.trim()} (${newAgentPhone.trim()})`
    );
    if (ok) {
      setNewAgentName('');
      setNewAgentPhone('');
      setNewAgentNote('');
      setNewAgentPrimary(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !userSearch.trim() ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingAgentCount = agentProfiles.filter((a) => a.applicationStatus === 'pending').length;
  const pendingRewards = referralRewards.filter((r) => r.rewardStatus === 'pending');
  const pendingRewardsCount = pendingRewards.length;
  const openTicketsCount = supportTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;
  const flaggedCount = referralRelationships.filter((r) => r.isFlaggedDuplicate).length;

  const filteredAgentProfiles = agentProfiles.filter((ap) => {
    const matchesStatus =
      agentStatusFilter === 'all' || ap.applicationStatus === agentStatusFilter;
    const q = agentProfileSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      ap.id.toLowerCase().includes(q) ||
      ap.username.toLowerCase().includes(q) ||
      ap.fullLegalName.toLowerCase().includes(q) ||
      ap.phone.toLowerCase().includes(q) ||
      (ap.agentCode || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const getDirectAndIndirectCounts = (agentUserId: string) => {
    const direct = referralRelationships.filter((r) => r.parentAgentUserId === agentUserId);
    const visited = new Set<string>();
    const queue = direct.map((d) => d.referredUserId);
    while (queue.length > 0) {
      const uid = queue.shift()!;
      if (visited.has(uid)) continue;
      visited.add(uid);
      const children = referralRelationships.filter((r) => r.parentAgentUserId === uid);
      children.forEach((c) => queue.push(c.referredUserId));
    }
    return { direct: direct.length, total: visited.size, indirect: Math.max(0, visited.size - direct.length) };
  };

  const runDirectSyncAction = async (
    fn: () => Promise<PlatformSnapshot>,
    successText: string
  ) => {
    setBusyAction(true);
    setStatusNotice(null);
    try {
      const next = await fn();
      onSnapshotSync(next);
      setStatusNotice({ type: 'success', text: successText });
    } catch (err) {
      setStatusNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Action failed.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Admin Control Center</h1>
          <p className="text-sm text-slate-400 mt-1.5">
            Set AI/Player win odds per game, grant Birr bonuses, manage Telebirr agents, and approve Birr deposits & payouts.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0F1324] border border-white/10 rounded-xl px-3.5 py-2.5">
          <Database className="w-4 h-4 text-blue-300 shrink-0" />
          <span>
            {isSupabaseConfigured
              ? 'Supabase Connected · Express API Active'
              : 'Express Server & Persistent Database Active'}
          </span>
        </div>
      </div>

      {statusNotice && (
        <div
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3 border ${
            statusNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-200'
              : 'bg-rose-500/10 border-rose-400/35 text-rose-200'
          }`}
        >
          <span>{statusNotice.text}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            aria-label="Dismiss notice"
            className="hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Platform Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Active Games / Agents</div>
          <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {games.filter((g) => g.isActive).length} Games · {agents.filter((a) => a.isActive).length} Agents
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Registered Players</div>
          <div className="text-2xl font-mono font-bold text-blue-300 mt-1 tabular-nums">
            {users.length}
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Total Sessions</div>
          <div className="text-2xl font-mono font-bold text-violet-300 mt-1 tabular-nums">
            {totalPlays.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Player Pool (Birr)</div>
          <div className="text-2xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
            {formatBirr(totalPoolBirr)}
          </div>
        </div>
      </div>

      {/* Management Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1324] border border-white/10 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setTab('deposits')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'deposits'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Deposits ({pendingDepositsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('withdrawals')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'withdrawals'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdrawals ({pendingWithdrawalsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('games')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'games'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Games & Odds</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'users'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Bonuses</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('agents')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'agents'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>Telebirr Numbers ({agents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('agent_profiles')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'agent_profiles'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Agent Profiles ({pendingAgentCount} pending)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('network')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'network'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Network & Fraud ({flaggedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'settings'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>
              Rewards ({pendingRewardsCount} pending) & Settings
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'ledger'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Transactions & CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'audit'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Support ({openTicketsCount}) & Audit</span>
          </button>
        </div>
      </div>

      {/* Games & Odds Configuration */}
      {tab === 'games' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#0F1324] border border-amber-400/25 px-4 py-3 text-xs text-slate-300">
            Configure each game&apos;s <span className="text-amber-300 font-semibold">Player Win %</span> (AI / House automatically gets{' '}
            <span className="font-mono text-white">100% - Player %</span>, default 70% AI / 30% Player),{' '}
            <span className="text-emerald-300 font-semibold">Bonus Birr</span> added on win/cashout,{' '}
            <span className="text-white font-semibold">Min Stake (&ge; 0.10 ETB)</span>, and{' '}
            <span className="text-white font-semibold">Max Multiplier</span>.
          </div>

          <div className="space-y-3">
            {games.map((game) => {
              const draft = gameDrafts[game.id] || {
                minStakeBirr: game.minStakeBirr,
                playerWinPercent: game.playerWinPercent ?? 30,
                bonusBirr: game.bonusBirr,
                maxMultiplier: game.maxMultiplier,
                cashoutEnabled: game.cashoutEnabled,
              };
              const safePlayerPct = Math.max(
                5,
                Math.min(95, Math.round(Number(draft.playerWinPercent) || 30))
              );
              const aiPct = 100 - safePlayerPct;

              return (
                <div
                  key={game.id}
                  className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-display font-bold text-white">
                        {game.title}
                      </div>
                      <div className="text-xs text-slate-400">
                        {game.engine} · {game.category} · {game.playCount.toLocaleString()} plays · AI{' '}
                        <span className="text-rose-300 font-mono">{aiPct}%</span> / Player{' '}
                        <span className="text-emerald-300 font-mono">{safePlayerPct}%</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: { ...draft, cashoutEnabled: !draft.cashoutEnabled },
                          }))
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                          draft.cashoutEnabled
                            ? 'bg-blue-500/15 border-blue-400/35 text-blue-200'
                            : 'bg-[#151A31] border-white/10 text-slate-400'
                        }`}
                      >
                        {draft.cashoutEnabled ? 'Cashout: On' : 'Cashout: Off'}
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () => onSaveGame({ ...game, isFeatured: !game.isFeatured }),
                            `${game.title} ${!game.isFeatured ? 'featured' : 'unfeatured'}`
                          )
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                          game.isFeatured
                            ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                            : 'bg-[#151A31] border-white/10 text-slate-400'
                        }`}
                      >
                        {game.isFeatured ? 'Featured' : 'Feature'}
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () => onSaveGame({ ...game, isActive: !game.isActive }),
                            `${game.title} ${!game.isActive ? 'activated' : 'disabled'}`
                          )
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                          game.isActive
                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                            : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                        }`}
                      >
                        {game.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] text-rose-300 mb-1">
                        AI Win %
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={95}
                        value={aiPct}
                        onChange={(e) => {
                          const nextAi = Math.max(5, Math.min(95, Number(e.target.value) || 70));
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: {
                              ...draft,
                              playerWinPercent: 100 - nextAi,
                            },
                          }));
                        }}
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-rose-200 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-emerald-300 mb-1">
                        Player Win %
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={95}
                        value={draft.playerWinPercent}
                        onChange={(e) =>
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: {
                              ...draft,
                              playerWinPercent: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Bonus Birr (Win/Cashout)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        step="1"
                        value={draft.bonusBirr}
                        onChange={(e) =>
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: {
                              ...draft,
                              bonusBirr: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Min Stake (ETB &ge; 0.10)
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        step="0.1"
                        max={10000}
                        value={draft.minStakeBirr}
                        onChange={(e) =>
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: {
                              ...draft,
                              minStakeBirr: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Max Multiplier (x)
                      </label>
                      <input
                        type="number"
                        min={1.5}
                        max={25}
                        step="0.5"
                        value={draft.maxMultiplier}
                        onChange={(e) =>
                          setGameDrafts((prev) => ({
                            ...prev,
                            [game.id]: {
                              ...draft,
                              maxMultiplier: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-amber-300 tabular-nums"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => void handleSaveGameRow(game)}
                      className="min-h-[40px] px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savedGameId === game.id ? 'Saved!' : 'Save Odds'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users & Bonuses Management */}
      {tab === 'users' && (
        <div className="space-y-6">
          {/* Grant Direct Birr Bonus Form */}
          <form
            onSubmit={handleGrantBonusSubmit}
            className="rounded-2xl bg-[#0F1324] border border-emerald-400/25 p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-300" />
              <h2 className="text-base font-display font-bold text-white">
                Grant Birr Bonus to Players
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Recipient</label>
                <select
                  value={bonusTarget}
                  onChange={(e) => setBonusTarget(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                >
                  <option value="ALL">All Active Players ({users.filter((u) => !u.isBanned).length})</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      @{u.username} ({formatBirr(u.balanceBirr)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Bonus Amount (Birr)</label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  required
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Reason / Campaign</label>
                <input
                  type="text"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="Welcome or promo bonus"
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>Send {formatBirr(bonusAmount || 0)}</span>
              </button>
            </div>
          </form>

          <input
            type="search"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Filter users by username or email..."
            className="w-full sm:w-72 min-h-[42px] px-3.5 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
          />

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                No registered users match your filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-slate-400 bg-[#0B0E1B]">
                      <th className="py-3.5 px-4 font-medium">Player</th>
                      <th className="py-3.5 px-4 font-medium">Role</th>
                      <th className="py-3.5 px-4 font-medium text-right">Birr Balance</th>
                      <th className="py-3.5 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 text-sm">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <AvatarBadge avatarId={user.avatarId} size="sm" />
                            <div>
                              <div className="font-semibold text-white">
                                {user.username}
                                {user.isBanned ? ' (Suspended)' : ''}
                              </div>
                              <div className="text-xs text-slate-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 capitalize text-slate-300">{user.role}</td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <div className="font-bold text-amber-300">
                            {formatBirr(user.balanceBirr)}
                          </div>
                          <div className="text-[11px] text-emerald-300">
                            Bonuses: +{formatBirr(user.bonusBirrReceived || 0)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                            <input
                              type="number"
                              value={customUserDeltas[user.id] ?? 100}
                              onChange={(e) =>
                                setCustomUserDeltas((prev) => ({
                                  ...prev,
                                  [user.id]: Number(e.target.value),
                                }))
                              }
                              aria-label={`Custom Birr amount for ${user.username}`}
                              className="w-20 min-h-[34px] rounded-lg bg-[#080B15] border border-white/12 px-2 text-xs font-mono text-white text-right"
                            />
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => {
                                const delta = Number(customUserDeltas[user.id] ?? 100);
                                if (!delta) return;
                                void runWithNotice(
                                  () => onAdjustUserBirr(user.id, delta),
                                  `Adjusted ${user.username} by ${delta >= 0 ? '+' : ''}${formatBirr(delta)}`
                                );
                              }}
                              className="min-h-[34px] px-2.5 rounded-lg bg-[#161C36] hover:bg-blue-600/30 border border-white/10 text-xs font-mono text-blue-200 cursor-pointer"
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() =>
                                void runWithNotice(
                                  () => onAdjustUserBirr(user.id, 50),
                                  `Credited +50 Birr to ${user.username}`
                                )
                              }
                              className="min-h-[34px] px-2.5 rounded-lg bg-[#161C36] hover:bg-emerald-600/30 border border-white/10 text-xs font-mono text-emerald-200 cursor-pointer"
                            >
                              +50 Birr
                            </button>
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() =>
                                void runWithNotice(
                                  () => onAdjustUserBirr(user.id, -50),
                                  `Deducted -50 Birr from ${user.username}`
                                )
                              }
                              className="min-h-[34px] px-2.5 rounded-lg bg-[#161C36] hover:bg-rose-600/30 border border-white/10 text-xs font-mono text-rose-200 cursor-pointer"
                            >
                              -50 Birr
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runWithNotice(
                                  () => onToggleUserRole(user.id),
                                  `Updated role for ${user.username}`
                                )
                              }
                              disabled={busyAction || user.id === currentUser.id}
                              className="min-h-[34px] px-2.5 rounded-lg bg-[#161C36] hover:bg-violet-600/30 disabled:opacity-40 border border-white/10 text-xs text-slate-200 cursor-pointer"
                            >
                              {user.role === 'admin' ? 'Set Player' : 'Make Admin'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void runWithNotice(
                                  () => onToggleUserBan(user.id),
                                  `${user.isBanned ? 'Restored' : 'Suspended'} ${user.username}`
                                )
                              }
                              disabled={busyAction || user.id === currentUser.id}
                              className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium disabled:opacity-40 cursor-pointer ${
                                user.isBanned
                                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                                  : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                              }`}
                            >
                              {user.isBanned ? 'Restore' : 'Suspend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {bonusGrants.length > 0 && (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">Recent Bonus Grants</h3>
              <div className="divide-y divide-white/8 text-xs">
                {bonusGrants.slice(0, 12).map((grant) => (
                  <div key={grant.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-white">{grant.username}</span>
                      <span className="text-slate-400 ml-2">
                        · {grant.reason} · by {grant.grantedBy}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums shrink-0">
                      +{formatBirr(grant.amountBirr)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Telebirr Agents Management */}
      {tab === 'agents' && (
        <div className="space-y-6">
          <form
            onSubmit={handlePrimaryPhoneSubmit}
            className="rounded-2xl bg-[#0F1324] border border-emerald-400/30 p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-emerald-300" />
                <h2 className="text-base font-display font-bold text-white">
                  Primary Telebirr Deposit Number
                </h2>
              </div>
              {primaryAgent && (
                <span className="text-xs font-mono text-amber-300">
                  Active: {primaryAgent.name} ({primaryAgent.phone})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Agent Display Name</label>
                <input
                  type="text"
                  required
                  value={primaryNameDraft}
                  onChange={(e) => setPrimaryNameDraft(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Deposit Telebirr Phone
                </label>
                <input
                  type="tel"
                  required
                  value={primaryPhoneDraft}
                  onChange={(e) => setPrimaryPhoneDraft(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-amber-300"
                />
              </div>
              <button
                type="submit"
                disabled={busyAction}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Update Deposit Number</span>
              </button>
            </div>
          </form>

          <form
            onSubmit={handleAddAgentSubmit}
            className="rounded-2xl bg-[#0F1324] border border-amber-400/30 p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-300" />
              <h2 className="text-base font-display font-bold text-white">
                Add New Telebirr Deposit Agent
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Agent Name</label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Selam Agent"
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Telebirr Phone</label>
                <input
                  type="tel"
                  required
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">Note (Optional)</label>
                <input
                  type="text"
                  value={newAgentNote}
                  onChange={(e) => setNewAgentNote(e.target.value)}
                  placeholder="Fast 24/7 verification"
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAgentPrimary}
                  onChange={(e) => setNewAgentPrimary(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span>Set as Primary Deposit Number</span>
              </label>

              <button
                type="submit"
                disabled={busyAction}
                className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Agent</span>
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {agents.map((agent) => {
              const draft = agentDrafts[agent.id] || {
                name: agent.name,
                phone: agent.phone,
                note: agent.note || '',
              };
              return (
                <div
                  key={agent.id}
                  className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-display font-bold text-white">
                        {agent.name}
                      </span>
                      <span className="text-sm font-mono text-amber-300">{agent.phone}</span>
                      {agent.isPrimary && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 rounded-md">
                          <Star className="w-3 h-3 fill-current" />
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!agent.isPrimary && (
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void runWithNotice(
                              () =>
                                onSaveAgent({
                                  ...agent,
                                  name: draft.name,
                                  phone: draft.phone,
                                  note: draft.note || undefined,
                                  isPrimary: true,
                                  isActive: true,
                                }),
                              `${draft.name} set as Primary Telebirr agent`
                            )
                          }
                          className="min-h-[34px] px-3 rounded-lg bg-[#161C36] hover:bg-amber-500/20 border border-white/10 text-xs text-amber-200 cursor-pointer"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () =>
                              onSaveAgent({
                                ...agent,
                                name: draft.name,
                                phone: draft.phone,
                                note: draft.note || undefined,
                                isActive: !agent.isActive,
                              }),
                            `${draft.name} ${!agent.isActive ? 'activated' : 'paused'}`
                          )
                        }
                        className={`min-h-[34px] px-3 rounded-lg border text-xs font-medium cursor-pointer ${
                          agent.isActive
                            ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200'
                            : 'bg-rose-500/15 border-rose-400/35 text-rose-200'
                        }`}
                      >
                        {agent.isActive ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        disabled={busyAction || agents.length <= 1}
                        onClick={() =>
                          void runWithNotice(
                            () => onDeleteAgent(agent.id),
                            `Deleted agent ${agent.name}`
                          )
                        }
                        aria-label={`Delete agent ${agent.name}`}
                        className="min-h-[34px] px-2.5 rounded-lg bg-[#161C36] hover:bg-rose-500/20 disabled:opacity-40 border border-white/10 text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Agent Name</label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setAgentDrafts((prev) => ({
                            ...prev,
                            [agent.id]: { ...draft, name: e.target.value },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Telebirr Phone
                      </label>
                      <input
                        type="tel"
                        value={draft.phone}
                        onChange={(e) =>
                          setAgentDrafts((prev) => ({
                            ...prev,
                            [agent.id]: { ...draft, phone: e.target.value },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Note</label>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) =>
                          setAgentDrafts((prev) => ({
                            ...prev,
                            [agent.id]: { ...draft, note: e.target.value },
                          }))
                        }
                        className="w-full min-h-[40px] rounded-lg bg-[#080B15] border border-white/12 px-3 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={async () => {
                        const ok = await runWithNotice(
                          () =>
                            onSaveAgent({
                              ...agent,
                              name: draft.name,
                              phone: draft.phone,
                              note: draft.note || undefined,
                            }),
                          `Updated ${draft.name} (${draft.phone})`
                        );
                        if (ok) {
                          setSavedAgentId(agent.id);
                          window.setTimeout(
                            () => setSavedAgentId((p) => (p === agent.id ? null : p)),
                            1500
                          );
                        }
                      }}
                      className="min-h-[40px] px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savedAgentId === agent.id ? 'Updated!' : 'Update Agent'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Telebirr Deposits Verification */}
      {tab === 'deposits' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Primary Telebirr Agent:{' '}
              {primaryAgent ? (
                <>
                  <span className="text-white font-semibold">{primaryAgent.name}</span> ·{' '}
                  <span className="font-mono text-amber-300">{primaryAgent.phone}</span>
                </>
              ) : (
                'None configured'
              )}
            </span>
            <button
              type="button"
              onClick={() => setTab('agents')}
              className="text-amber-300 hover:text-amber-200 font-medium cursor-pointer"
            >
              Edit Deposit Numbers & Agents →
            </button>
          </div>

          {depositRequests.length === 0 ? (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center text-sm text-slate-400">
              No deposit verification requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {depositRequests.map((dep) => (
                <div
                  key={dep.id}
                  className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    {dep.screenshotDataUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewScreenshot(dep)}
                        className="relative group w-16 h-16 rounded-xl overflow-hidden border border-white/15 shrink-0 cursor-pointer"
                        aria-label="Inspect uploaded receipt screenshot"
                      >
                        <img
                          src={dep.screenshotDataUrl}
                          alt="Telebirr receipt thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-[#090C18] border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                        <Receipt className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {dep.username}
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                          +{formatBirr(dep.amountBirr)}
                        </span>
                        <span className="text-xs text-slate-400">
                          via {dep.agentName} ({dep.agentPhone})
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 space-x-2">
                        {dep.telebirrReference && (
                          <span className="font-mono text-blue-300">
                            Ref: {dep.telebirrReference}
                          </span>
                        )}
                        {dep.senderPhone && (
                          <span className="font-mono text-slate-400">
                            From: {dep.senderPhone}
                          </span>
                        )}
                        <span className="text-slate-500">
                          {new Date(dep.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {dep.screenshotDataUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewScreenshot(dep)}
                          className="text-xs font-medium text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Screenshot</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {dep.status === 'pending' ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={reviewNotes[dep.id] || ''}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [dep.id]: e.target.value }))
                        }
                        placeholder="Optional note..."
                        className="min-h-[38px] px-3 rounded-lg bg-[#080B15] border border-white/12 text-xs text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () =>
                              onReviewDeposit(dep.id, 'approved', reviewNotes[dep.id]),
                            `Approved ${formatBirr(dep.amountBirr)} deposit for ${dep.username}`
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Approve & Credit
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () =>
                              onReviewDeposit(dep.id, 'rejected', reviewNotes[dep.id]),
                            `Rejected deposit request from ${dep.username}`
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 border border-rose-400/35 text-rose-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      {dep.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                          <XCircle className="w-4 h-4" />
                          <span>Rejected</span>
                        </span>
                      )}
                      {dep.adminNote && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {dep.adminNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Telebirr Withdrawals Payout Processing */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Verify player payout requests, send Birr via Telebirr, and record the transaction reference. Rejecting automatically refunds held Birr.
          </div>

          {withdrawalRequests.length === 0 ? (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center text-sm text-slate-400">
              No withdrawal requests submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawalRequests.map((wd) => (
                <div
                  key={wd.id}
                  className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{wd.username}</span>
                      <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                        {formatBirr(wd.amountBirr)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Recipient: {wd.recipientName}</span>
                      <span className="font-mono text-blue-300">
                        Telebirr: {wd.telebirrPhone}
                      </span>
                      <span className="text-slate-500">
                        {new Date(wd.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {wd.status === 'pending' ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={payoutRefs[wd.id] || ''}
                        onChange={(e) =>
                          setPayoutRefs((prev) => ({ ...prev, [wd.id]: e.target.value }))
                        }
                        placeholder="Payout Tx Ref (optional)..."
                        className="min-h-[38px] px-3 rounded-lg bg-[#080B15] border border-white/12 text-xs font-mono text-white placeholder:text-slate-500"
                      />
                      <input
                        type="text"
                        value={reviewNotes[wd.id] || ''}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [wd.id]: e.target.value }))
                        }
                        placeholder="Optional note..."
                        className="min-h-[38px] px-3 rounded-lg bg-[#080B15] border border-white/12 text-xs text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () =>
                              onReviewWithdrawal(
                                wd.id,
                                'approved',
                                payoutRefs[wd.id],
                                reviewNotes[wd.id]
                              ),
                            `Approved & marked paid: ${formatBirr(wd.amountBirr)} to ${wd.username}`
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Approve & Mark Paid
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runWithNotice(
                            () =>
                              onReviewWithdrawal(
                                wd.id,
                                'rejected',
                                payoutRefs[wd.id],
                                reviewNotes[wd.id]
                              ),
                            `Rejected & refunded ${formatBirr(wd.amountBirr)} to ${wd.username}`
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 border border-rose-400/35 text-rose-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Reject & Refund
                      </button>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      {wd.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approved & Paid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                          <XCircle className="w-4 h-4" />
                          <span>Rejected & Refunded</span>
                        </span>
                      )}
                      {wd.payoutReference && (
                        <div className="text-[11px] font-mono text-blue-300 mt-0.5">
                          Ref: {wd.payoutReference}
                        </div>
                      )}
                      {wd.adminNote && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{wd.adminNote}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Profiles & Applications Management */}
      {tab === 'agent_profiles' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="search"
              value={agentProfileSearch}
              onChange={(e) => setAgentProfileSearch(e.target.value)}
              placeholder="Search agents by ID, legal name, @username, code, or phone..."
              className="w-full sm:w-96 min-h-[42px] px-3.5 rounded-xl bg-[#0F1324] border border-white/10 text-sm text-white placeholder:text-slate-500"
            />
            <select
              value={agentStatusFilter}
              onChange={(e) => setAgentStatusFilter(e.target.value)}
              className="min-h-[42px] rounded-xl bg-[#0F1324] border border-white/10 px-3 text-xs text-white"
            >
              <option value="all">All Statuses ({agentProfiles.length})</option>
              <option value="pending">Pending ({pendingAgentCount})</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {filteredAgentProfiles.length === 0 ? (
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center text-sm text-slate-400">
              No agent applications or profiles match your search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgentProfiles.map((ap) => {
                const counts = getDirectAndIndirectCounts(ap.userId);
                return (
                  <div
                    key={ap.id}
                    className="rounded-2xl bg-[#0F1324] border border-white/10 p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-display font-bold text-white">
                            {ap.fullLegalName}
                          </span>
                          <span className="text-xs font-mono text-slate-400">@{ap.username}</span>
                          <span className="text-xs font-mono text-blue-300">{ap.phone}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              ap.applicationStatus === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : ap.applicationStatus === 'pending'
                                  ? 'bg-amber-500/15 text-amber-200'
                                  : 'bg-rose-500/15 text-rose-200'
                            }`}
                          >
                            {ap.applicationStatus}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] font-mono text-slate-300">
                            KYC: {ap.verificationStatus}
                          </span>
                          {ap.agentCode && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/25 text-[11px] font-mono text-amber-300">
                              Code: {ap.agentCode}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Agent ID: {ap.id}</span>
                          <span>Bank: {ap.bankName} ({ap.bankAccountName})</span>
                          <span>Masked Acct: {ap.maskedBankAccount}</span>
                          <span>Masked CBE: {ap.maskedCbeAccount}</span>
                          <span>Direct: {counts.direct} · Indirect: {counts.indirect} · Total: {counts.total}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              const details = await adminFetchAgentFinancialDetailsOnServer(ap.id);
                              setDecryptedModal({ agent: ap, details });
                            } catch (err) {
                              setStatusNotice({
                                type: 'error',
                                text: err instanceof Error ? err.message : 'Unable to decrypt.',
                              });
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-[#161C36] hover:bg-violet-600/30 border border-white/10 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Decrypt Financials</span>
                        </button>

                        {ap.applicationStatus === 'pending' && (
                          <>
                            <input
                              type="text"
                              value={agentReviewReasons[ap.id] || ''}
                              onChange={(e) =>
                                setAgentReviewReasons((prev) => ({
                                  ...prev,
                                  [ap.id]: e.target.value,
                                }))
                              }
                              placeholder="Optional note/reason..."
                              className="min-h-[36px] px-2.5 rounded-lg bg-[#080B15] border border-white/12 text-xs text-white"
                            />
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() =>
                                void runDirectSyncAction(
                                  () =>
                                    adminReviewAgentApplicationOnServer(ap.id, {
                                      decision: 'approve',
                                      verificationStatus: 'verified',
                                    }),
                                  `Approved ${ap.fullLegalName} (@${ap.username}) as Agent`
                                )
                              }
                              className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                            >
                              Approve & Verify
                            </button>
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() =>
                                void runDirectSyncAction(
                                  () =>
                                    adminReviewAgentApplicationOnServer(ap.id, {
                                      decision: 'reject',
                                      rejectionReason: agentReviewReasons[ap.id] || 'Rejected by admin',
                                    }),
                                  `Rejected application for ${ap.fullLegalName}`
                                )
                              }
                              className="min-h-[36px] px-3 rounded-lg bg-rose-500/20 border border-rose-400/35 text-xs font-semibold text-rose-200 cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {ap.applicationStatus === 'approved' && (
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() =>
                              void runDirectSyncAction(
                                () =>
                                  adminSetAgentStatusOnServer(
                                    ap.id,
                                    'suspend',
                                    'Suspended via Admin Control Panel'
                                  ),
                                `Suspended agent ${ap.fullLegalName}`
                              )
                            }
                            className="min-h-[36px] px-3 rounded-lg bg-rose-500/20 border border-rose-400/35 text-xs font-semibold text-rose-200 cursor-pointer"
                          >
                            Suspend Agent
                          </button>
                        )}

                        {ap.applicationStatus === 'suspended' && (
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() =>
                              void runDirectSyncAction(
                                () => adminSetAgentStatusOnServer(ap.id, 'reactivate'),
                                `Reactivated agent ${ap.fullLegalName}`
                              )
                            }
                            className="min-h-[36px] px-3 rounded-lg bg-emerald-600 text-xs font-semibold text-white cursor-pointer"
                          >
                            Reactivate Agent
                          </button>
                        )}

                        {ap.verificationStatus !== 'verified' && ap.applicationStatus === 'approved' && (
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() =>
                              void runDirectSyncAction(
                                () =>
                                  adminReviewAgentApplicationOnServer(ap.id, {
                                    decision: 'verify_only',
                                    verificationStatus: 'verified' as VerificationStatus,
                                  }),
                                `Marked ID verified for ${ap.fullLegalName}`
                              )
                            }
                            className="min-h-[36px] px-3 rounded-lg bg-blue-600 text-xs font-semibold text-white cursor-pointer"
                          >
                            Mark ID Verified
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Network Hierarchy & Duplicate Fraud Alerts */}
      {tab === 'network' && (
        <div className="space-y-6">
          {flaggedRelationships.length > 0 && (
            <div className="rounded-2xl bg-[#0F1324] border border-rose-400/35 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h2 className="text-lg font-display font-bold text-white">
                  Duplicate Account & Referral Fraud Alerts ({flaggedRelationships.length})
                </h2>
              </div>

              <div className="space-y-3">
                {flaggedRelationships.map((rel) => (
                  <div
                    key={rel.id}
                    className="rounded-xl bg-[#080B15] border border-rose-400/25 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        @{rel.referredUsername} ({rel.referredFullName}) referred by code{' '}
                        <span className="font-mono text-amber-300">{rel.referralCode}</span>
                      </div>
                      <div className="text-rose-300 mt-0.5">
                        Flag Reason: {rel.fraudFlagReason || 'Potential duplicate account'}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runDirectSyncAction(async () => {
                            const next = await adminResolveFraudAlertOnServer(rel.id, 'clear');
                            await loadNetworkData();
                            return next;
                          }, `Cleared fraud flag for @${rel.referredUsername}`)
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Clear Flag
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runDirectSyncAction(async () => {
                            const next = await adminResolveFraudAlertOnServer(
                              rel.id,
                              'suspend_referred'
                            );
                            await loadNetworkData();
                            return next;
                          }, `Suspended referred account @${rel.referredUsername}`)
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold cursor-pointer"
                      >
                        Suspend Referred
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runDirectSyncAction(async () => {
                            const next = await adminResolveFraudAlertOnServer(rel.id, 'suspend_both');
                            await loadNetworkData();
                            return next;
                          }, 'Suspended both parent and referred accounts')
                        }
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                      >
                        Suspend Both
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  Complete Multi-Level Referral Hierarchy
                </h2>
                <p className="text-xs text-slate-400">
                  Unlimited-depth tree across all approved agents and downstream descendants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadNetworkData()}
                className="px-3.5 py-2 rounded-xl bg-[#161C36] border border-white/10 text-xs font-semibold text-white cursor-pointer"
              >
                {loadingNetwork ? 'Refreshing...' : 'Refresh Tree'}
              </button>
            </div>

            <ReferralTreeViewer
              trees={networkTrees}
              emptyMessage="No agent referral roots created yet."
            />
          </div>

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-3">
            <h3 className="text-base font-display font-bold text-white">
              All Referral Relationships ({referralRelationships.length})
            </h3>
            {referralRelationships.length === 0 ? (
              <div className="text-xs text-slate-400">No referral attributions recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Parent Agent Code</th>
                      <th className="py-2.5 px-3">Referred Account</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {referralRelationships.slice(0, 50).map((rel) => (
                      <tr key={rel.id}>
                        <td className="py-2.5 px-3 text-slate-400">
                          {new Date(rel.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-300">
                          {rel.parentAgentCode}
                        </td>
                        <td className="py-2.5 px-3 text-white">
                          {rel.referredFullName} (@{rel.referredUsername})
                        </td>
                        <td className="py-2.5 px-3 uppercase text-violet-300">{rel.referralType}</td>
                        <td className="py-2.5 px-3">
                          {rel.isFlaggedDuplicate ? (
                            <span className="text-rose-300 font-semibold">Flagged Duplicate</span>
                          ) : (
                            <span className="text-emerald-300">{rel.playerStatus}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rewards & Platform Policy Settings */}
      {tab === 'settings' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runDirectSyncAction(
                () =>
                  adminSavePlatformSettingsOnServer({
                    settings: settingsDraft,
                    applyMinStakeToAllGames: applyStakeAll,
                  }),
                'Saved platform deposit/stake limits, agent eligibility, and non-deposit-funded reward rules'
              );
            }}
            className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-6"
          >
            <h2 className="text-lg font-display font-bold text-white">
              Deposit Minimums, Stake Minimums, Eligibility & Non-Deposit-Funded Reward Rules
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Min Player Deposit (ETB, default 5)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={settingsDraft.minDepositEtb}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      minDepositEtb: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Min Player Withdrawal (ETB)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={settingsDraft.minWithdrawalEtb}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      minWithdrawalEtb: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Default Game Min Stake (ETB, initial 0.10)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={settingsDraft.defaultMinStakeEtb}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      defaultMinStakeEtb: Number(e.target.value),
                    }))
                  }
                  className="w-full min-h-[42px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyStakeAll}
                onChange={(e) => setApplyStakeAll(e.target.checked)}
                className="rounded border-white/20"
              />
              <span>Apply Default Game Min Stake ({formatBirr(settingsDraft.defaultMinStakeEtb)}) to all {games.length} games</span>
            </label>

            <div className="border-t border-white/10 pt-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-white">
                Player-to-Agent Eligibility Rules
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Account Age (Days)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft.agentEligibility.minAccountAgeDays}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        agentEligibility: {
                          ...prev.agentEligibility,
                          minAccountAgeDays: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Games Played</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft.agentEligibility.minGamesPlayed}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        agentEligibility: {
                          ...prev.agentEligibility,
                          minGamesPlayed: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Approved Deposits (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsDraft.agentEligibility.minTotalDepositedEtb}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        agentEligibility: {
                          ...prev.agentEligibility,
                          minTotalDepositedEtb: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsDraft.agentEligibility.requirePhoneOnFile}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          agentEligibility: {
                            ...prev.agentEligibility,
                            requirePhoneOnFile: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Require Phone on File</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5 space-y-3">
              <h3 className="text-sm font-display font-bold text-emerald-300">
                Non-Deposit-Funded Promotional Reward Policy
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Player Referral Bonus (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={settingsDraft.rewardPolicy.playerReferralBonusEtb}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        rewardPolicy: {
                          ...prev.rewardPolicy,
                          playerReferralBonusEtb: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Agent Referral Bonus (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={settingsDraft.rewardPolicy.agentReferralBonusEtb}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        rewardPolicy: {
                          ...prev.rewardPolicy,
                          agentReferralBonusEtb: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Redeem Threshold (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={settingsDraft.rewardPolicy.minRedeemEtb}
                    onChange={(e) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        rewardPolicy: {
                          ...prev.rewardPolicy,
                          minRedeemEtb: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-white"
                  />
                </div>
                <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsDraft.rewardPolicy.rewardsEnabled}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          rewardPolicy: {
                            ...prev.rewardPolicy,
                            rewardsEnabled: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Rewards Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsDraft.rewardPolicy.allowSelfTransferToBalance}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          rewardPolicy: {
                            ...prev.rewardPolicy,
                            allowSelfTransferToBalance: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Allow Self Transfer to ETB</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.rewardPolicy.autoApproveOnClientVerification)}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          rewardPolicy: {
                            ...prev.rewardPolicy,
                            autoApproveOnClientVerification: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Auto-Approve on Client Verification</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft.rewardPolicy.autoCreditAgentWalletOnApproval)}
                      onChange={(e) =>
                        setSettingsDraft((prev) => ({
                          ...prev,
                          rewardPolicy: {
                            ...prev.rewardPolicy,
                            autoCreditAgentWalletOnApproval: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Credit Approved Rewards to Active ETB</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Policy Compliance Note</label>
                <input
                  type="text"
                  value={settingsDraft.rewardPolicy.policySummary}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      rewardPolicy: {
                        ...prev.rewardPolicy,
                        policySummary: e.target.value,
                      },
                    }))
                  }
                  className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyAction}
              className="min-h-[44px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Platform Settings</span>
            </button>
          </form>

          {/* Grant Promotional Agent Reward */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!grantRewardAgentUserId || grantRewardAmount <= 0) return;
              void runDirectSyncAction(
                () =>
                  adminGrantAgentRewardOnServer({
                    agentUserId: grantRewardAgentUserId,
                    amountEtb: Number(grantRewardAmount),
                    note: grantRewardNote,
                  }),
                `Granted ${formatBirr(grantRewardAmount)} promotional reward`
              );
            }}
            className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-300" />
              <h3 className="text-base font-display font-bold text-white">
                Grant Promotional Reward to Agent
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Approved Agent</label>
                <select
                  required
                  value={grantRewardAgentUserId}
                  onChange={(e) => setGrantRewardAgentUserId(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-xs text-white"
                >
                  <option value="">Select agent...</option>
                  {agentProfiles
                    .filter((a) => a.applicationStatus === 'approved')
                    .map((a) => (
                      <option key={a.id} value={a.userId}>
                        {a.fullLegalName} (@{a.username})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount (ETB)</label>
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={grantRewardAmount}
                  onChange={(e) => setGrantRewardAmount(Number(e.target.value))}
                  className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-sm font-mono text-emerald-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Policy Note</label>
                <input
                  type="text"
                  value={grantRewardNote}
                  onChange={(e) => setGrantRewardNote(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={busyAction || !grantRewardAgentUserId}
                className="min-h-[40px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Issue Approved Reward
              </button>
            </div>
          </form>

          {/* Referral Rewards Approval Queue */}
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-display font-bold text-white">
                  Referral Rewards Ledger ({referralRewards.length}) ·{' '}
                  <span className="text-amber-300">{pendingRewardsCount} Pending</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Approving rewards immediately credits the agent&apos;s active ETB balance when auto-credit is active.
                </p>
              </div>

              {pendingRewardsCount > 0 && (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() =>
                    void runDirectSyncAction(
                      async () => {
                        const res = await adminApproveAllPendingRewardsOnServer();
                        return res.snapshot;
                      },
                      `Approved & credited all ${pendingRewardsCount} pending agent referral rewards to active ETB balances`
                    )
                  }
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve &amp; Credit All Pending ({pendingRewardsCount})</span>
                </button>
              )}
            </div>
            {referralRewards.length === 0 ? (
              <div className="text-xs text-slate-400">No referral rewards generated yet.</div>
            ) : (
              <div className="divide-y divide-white/8">
                {referralRewards.slice(0, 60).map((rw) => (
                  <div
                    key={rw.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        Agent @{rw.agentUsername} · Referred @{rw.referredUsername} ·{' '}
                        <span className="text-emerald-300 font-mono tabular-nums">
                          +{formatBirr(rw.rewardAmountEtb)}
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono">
                        Ref: {rw.rewardReference} · {rw.rewardType} · Status:{' '}
                        <span
                          className={
                            rw.rewardStatus === 'pending'
                              ? 'text-amber-300'
                              : rw.rewardStatus === 'redeemed'
                                ? 'text-emerald-300'
                                : 'text-slate-200'
                          }
                        >
                          {rw.rewardStatus === 'redeemed' ? 'credited_to_active_etb' : rw.rewardStatus}
                        </span>
                      </div>
                    </div>

                    {rw.rewardStatus === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void runDirectSyncAction(
                              () => adminReviewRewardOnServer(rw.id, 'approve'),
                              `Approved & credited reward ${rw.rewardReference} to @${rw.agentUsername}`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                        >
                          Approve &amp; Credit
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            void runDirectSyncAction(
                              () => adminReviewRewardOnServer(rw.id, 'reject'),
                              `Rejected reward ${rw.rewardReference}`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/35 text-rose-200 font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unified Transactions & CSV Exports */}
      {tab === 'ledger' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-300" />
              <h2 className="text-lg font-display font-bold text-white">Export CSV Reports</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {(
                [
                  { type: 'users', label: 'Users CSV' },
                  { type: 'agents', label: 'Agent Profiles CSV' },
                  { type: 'referrals', label: 'Referral Relationships CSV' },
                  { type: 'rewards', label: 'Rewards CSV' },
                  { type: 'transactions', label: 'Transactions CSV' },
                  { type: 'audit', label: 'Audit Logs CSV' },
                ] as const
              ).map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => void downloadAdminCsvReport(item.type)}
                  className="min-h-[38px] px-4 rounded-xl bg-[#161C36] hover:bg-blue-600/30 border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-300" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-white">
                Platform Transactions ({transactions.length})
              </h3>
              <input
                type="search"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search by username, ref, or type..."
                className="w-full sm:w-72 min-h-[38px] rounded-xl bg-[#080B15] border border-white/12 px-3 text-xs text-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {transactions
                    .filter(
                      (tx) =>
                        !txSearch.trim() ||
                        tx.username.toLowerCase().includes(txSearch.toLowerCase()) ||
                        tx.referenceNumber.toLowerCase().includes(txSearch.toLowerCase()) ||
                        tx.transactionType.toLowerCase().includes(txSearch.toLowerCase())
                    )
                    .slice(0, 80)
                    .map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-white">@{tx.username}</td>
                        <td className="py-2.5 px-3 uppercase font-semibold text-violet-300">
                          {tx.transactionType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-blue-300">{tx.referenceNumber}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-200">{tx.status}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300">
                          {formatBirr(tx.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Support Requests & Immutable Audit Logs */}
      {tab === 'audit' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-white">
              Customer Support Queue ({supportTickets.length})
            </h2>
            {supportTickets.length === 0 ? (
              <div className="text-xs text-slate-400">No customer support tickets yet.</div>
            ) : (
              <div className="space-y-3">
                {supportTickets.map((tk) => (
                  <div
                    key={tk.id}
                    className="rounded-xl bg-[#080B15] border border-white/10 p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm text-white">{tk.subject}</span>
                        <span className="text-slate-400 ml-2">
                          by @{tk.username} · {tk.category}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white/5 uppercase font-semibold text-amber-300">
                        {tk.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-slate-300">{tk.message}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={supportReplies[tk.id] ?? tk.adminReply ?? ''}
                        onChange={(e) =>
                          setSupportReplies((prev) => ({ ...prev, [tk.id]: e.target.value }))
                        }
                        placeholder="Write admin reply..."
                        className="flex-1 min-h-[38px] rounded-lg bg-[#0F1324] border border-white/12 px-3 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() =>
                          void runDirectSyncAction(
                            () =>
                              adminUpdateSupportTicketOnServer(tk.id, {
                                status: 'resolved',
                                adminReply: supportReplies[tk.id] ?? tk.adminReply,
                              }),
                            `Resolved ticket "${tk.subject}"`
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Reply & Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-white">
              Administrator Audit Log ({auditLogs.length})
            </h2>
            {auditLogs.length === 0 ? (
              <div className="text-xs text-slate-400">No administrative audit entries yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {auditLogs.slice(0, 100).map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          @{log.administratorUsername}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-300">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {log.affectedLabel || log.targetType}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-sm truncate">
                          {log.previousValue ? `${log.previousValue} → ` : ''}
                          {log.newValue || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decrypted Financial Profile Modal */}
      {decryptedModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Decrypted Agent Financial Details"
        >
          <div className="max-w-lg w-full rounded-2xl bg-[#0F1324] border border-amber-400/35 p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-300" />
                <h3 className="text-lg font-display font-bold text-white">
                  Decrypted Agent Financials · @{decryptedModal.agent.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecryptedModal(null)}
                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#161C36] text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                <span className="text-slate-400 block">Bank Name & Account Holder</span>
                <span className="text-white font-semibold">
                  {decryptedModal.details.bankName} — {decryptedModal.details.bankAccountName}
                </span>
              </div>
              <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                <span className="text-slate-400 block">Bank Account Number</span>
                <span className="font-mono text-amber-300 text-sm">
                  {decryptedModal.details.bankAccountNumber}
                </span>
              </div>
              <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                <span className="text-slate-400 block">CBE Account Details</span>
                <span className="font-mono text-blue-300 text-sm">
                  {decryptedModal.details.cbeAccountDetails}
                </span>
              </div>
              <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                <span className="text-slate-400 block">Telebirr Account</span>
                <span className="font-mono text-emerald-300 text-sm">
                  {decryptedModal.details.telebirrAccount}
                </span>
              </div>
              {decryptedModal.details.verificationDocRef && (
                <div className="rounded-xl bg-[#080B15] border border-white/10 p-3">
                  <span className="text-slate-400 block">ID Verification Ref</span>
                  <span className="font-mono text-white">
                    {decryptedModal.details.verificationDocRef}
                  </span>
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              This decryption access has been recorded in the Administrator Audit Log.
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox */}
      {previewScreenshot && previewScreenshot.screenshotDataUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Telebirr Receipt Screenshot Preview"
        >
          <div className="max-w-lg w-full rounded-2xl bg-[#0F1324] border border-white/15 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold text-white">
                {previewScreenshot.username} · {formatBirr(previewScreenshot.amountBirr)}
              </div>
              <button
                type="button"
                onClick={() => setPreviewScreenshot(null)}
                aria-label="Close screenshot preview"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#161C36] text-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewScreenshot.screenshotDataUrl}
              alt="Full Telebirr receipt"
              className="w-full max-h-[70vh] object-contain rounded-xl bg-black/40"
            />
            {previewScreenshot.telebirrReference && (
              <div className="text-xs font-mono text-blue-300">
                Reference No: {previewScreenshot.telebirrReference}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
