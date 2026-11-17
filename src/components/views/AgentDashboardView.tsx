import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ReferralTreeViewer } from '@/src/components/common/ReferralTreeViewer';
import {
  fetchAgentDashboardOnServer,
  fetchOwnAgentFinancialDetails,
  formatBirr,
  generatePermanentReferralCodeOnServer,
  redeemReferralRewardsOnServer,
} from '@/src/services/platformService';
import type {
  ActiveRoute,
  AgentDashboardSummary,
  DecryptedAgentFinancialDetails,
  PlatformSettings,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  KeyRound,
  Lock,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

interface AgentDashboardViewProps {
  currentUser: UserProfile | null;
  platformSettings: PlatformSettings;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onNavigate: (route: ActiveRoute) => void;
  onOpenAuth: () => void;
}

export function AgentDashboardView({
  currentUser,
  platformSettings,
  onSnapshotSync,
  onNavigate,
  onOpenAuth,
}: AgentDashboardViewProps) {
  const [dashboard, setDashboard] = useState<AgentDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preferredCode, setPreferredCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null);
  const [decryptedFinancials, setDecryptedFinancials] =
    useState<DecryptedAgentFinancialDetails | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [tab, setTab] = useState<'referrals' | 'tree' | 'rewards' | 'financials'>('referrals');

  const loadDashboard = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentDashboardOnServer();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Agent Dashboard.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-10 text-center max-w-lg mx-auto space-y-4 my-8">
        <ShieldCheck className="w-10 h-10 text-violet-300 mx-auto" />
        <h1 className="text-2xl font-display font-bold text-white">Agent Portal</h1>
        <p className="text-sm text-slate-300">
          Please register as a player first, log in, and apply for Agent status from your Player Dashboard.
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

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Loading Agent Dashboard...
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-8 max-w-xl mx-auto text-center space-y-4 my-8">
        <ShieldCheck className="w-10 h-10 text-amber-300 mx-auto" />
        <h1 className="text-2xl font-display font-bold text-white">Agent Access Required</h1>
        <p className="text-sm text-slate-300">
          {error ||
            'An approved agent profile is required to access the Agent Dashboard. Apply directly from your Player Dashboard.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
          >
            Go to Player Dashboard & Apply
          </button>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161C36] hover:bg-[#1E2648] border border-white/10 text-sm text-slate-200 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { profile, rewardTotals } = dashboard;
  const liveOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const liveReferralLink = profile.agentCode
    ? `${liveOrigin || ''}/register?ref=${encodeURIComponent(profile.agentCode)}`
    : dashboard.referralLink;

  const handleCopy = async (kind: 'code' | 'link', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(kind);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setNotice(`Copy manually: ${value}`);
    }
  };

  const handleShareLink = async () => {
    if (!liveReferralLink) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join Abyssinia Games',
          text: `Register on Abyssinia Games using my agent referral code ${profile.agentCode || ''}:`,
          url: liveReferralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopy('link', liveReferralLink);
  };

  const handleGenerateCode = async (e: FormEvent) => {
    e.preventDefault();
    setGeneratingCode(true);
    setError(null);
    setNotice(null);
    try {
      const res = await generatePermanentReferralCodeOnServer(preferredCode.trim() || undefined);
      onSnapshotSync(res.snapshot);
      setNotice(`Permanent referral code ${res.agentCode} activated.`);
      await loadDashboard();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to generate referral code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleRedeemRewards = async () => {
    setRedeeming(true);
    setNotice(null);
    try {
      const res = await redeemReferralRewardsOnServer();
      onSnapshotSync(res.snapshot);
      setNotice(
        `Redeemed ${formatBirr(res.redeemedAmountEtb)} into your ETB wallet (Ref: ${res.referenceNumber}).`
      );
      await loadDashboard();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to redeem rewards.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleToggleDecryptedFinancials = async () => {
    if (decryptedFinancials) {
      setDecryptedFinancials(null);
      return;
    }
    setLoadingFinancials(true);
    try {
      const details = await fetchOwnAgentFinancialDetails();
      setDecryptedFinancials(details);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to decrypt financial profile.');
    } finally {
      setLoadingFinancials(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Agent Header */}
      <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/35 text-violet-200 font-semibold">
              Approved Agent
            </span>
            <span className="font-mono text-slate-400">ID: {profile.id}</span>
            <span
              className={`px-2 py-0.5 rounded-md font-semibold ${
                profile.verificationStatus === 'verified'
                  ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-200'
                  : 'bg-amber-500/15 border border-amber-400/35 text-amber-200'
              }`}
            >
              KYC: {profile.verificationStatus.toUpperCase()}
            </span>
            <span className="text-slate-400">
              Registered {new Date(currentUser.joinedAt).toLocaleDateString()}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
            {profile.fullLegalName}
          </h1>
          <div className="text-xs text-slate-400">
            @{currentUser.username} · Wallet Balance:{' '}
            <span className="font-mono font-bold text-amber-300">
              {formatBirr(currentUser.balanceBirr)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#161C36] hover:bg-[#1E2648] border border-white/10 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white cursor-pointer"
          >
            Player Dashboard
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/35 px-4 py-3 text-xs sm:text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {/* A. Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Direct Referrals</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1 tabular-nums">
            {dashboard.directReferralCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Level 1 direct signups</div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Total Network Members</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-violet-300 mt-1 tabular-nums">
            {dashboard.totalNetworkMembers}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Unlimited-depth tree</div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Active Player Referrals</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-blue-300 mt-1 tabular-nums">
            {dashboard.activePlayerReferrals}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Active player accounts</div>
        </div>
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
          <div className="text-xs text-slate-400">Active Agent Referrals</div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
            {dashboard.activeAgentReferrals}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Sub-agents in your network</div>
        </div>
      </div>

      {/* B. Permanent Referral Code & Link */}
      <div className="rounded-2xl bg-[#0F1324] border border-amber-400/25 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-display font-bold text-white">
              Permanent Agent Referral Code & Link
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            One permanent code per approved agent · Existing players cannot be reassigned
          </span>
        </div>

        {!profile.agentCode ? (
          <form
            onSubmit={handleGenerateCode}
            className="rounded-xl bg-[#080B15] border border-white/10 p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-xs text-slate-300 mb-1.5">
                Preferred Code Tag (Optional, 4–12 uppercase letters/numbers)
              </label>
              <input
                type="text"
                maxLength={14}
                value={preferredCode}
                onChange={(e) =>
                  setPreferredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder="Leave blank to auto-generate e.g. AGT7K9X"
                className="w-full min-h-[42px] rounded-xl bg-[#0F1324] border border-white/12 px-3.5 text-sm font-mono text-amber-300 placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={generatingCode || profile.applicationStatus !== 'approved'}
              className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{generatingCode ? 'Generating...' : 'Generate Permanent Code'}</span>
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            <div className="lg:col-span-4 rounded-xl bg-[#080B15] border border-white/10 px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-400">Permanent Code</div>
                <div className="text-lg font-mono font-bold text-amber-300">
                  {profile.agentCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy('code', profile.agentCode!)}
                className="min-h-[36px] px-3 rounded-lg bg-[#161C36] hover:bg-violet-600/30 border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedField === 'code' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="lg:col-span-8 rounded-xl bg-[#080B15] border border-white/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">Shareable Live Domain Referral Link</div>
                <div className="text-xs sm:text-sm font-mono text-blue-300 truncate">
                  {liveReferralLink}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopy('link', liveReferralLink)}
                  className="min-h-[36px] px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareLink()}
                  className="min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0F1324] border border-white/10 overflow-x-auto max-w-full w-fit">
        <button
          type="button"
          onClick={() => setTab('referrals')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            tab === 'referrals'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Referrals ({dashboard.directReferrals.length + dashboard.downstreamReferrals.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('tree')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            tab === 'tree'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Network Tree</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('rewards')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            tab === 'rewards'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>
            Rewards ({formatBirr(rewardTotals.approvedEtb + rewardTotals.redeemedEtb)})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('financials')}
          className={`min-h-[40px] px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            tab === 'financials'
              ? 'bg-amber-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Encrypted Profile</span>
        </button>
      </div>

      {/* Tab: Direct & Downstream Referrals */}
      {tab === 'referrals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-white">Direct Referrals (Level 1)</h3>
              <span className="text-xs font-mono text-amber-300">
                {dashboard.directReferrals.length} members
              </span>
            </div>

            {dashboard.directReferrals.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No direct referrals yet. Share your permanent referral link to grow your network.
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {dashboard.directReferrals.map((ref) => (
                  <div key={ref.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {ref.referredFullName} <span className="text-slate-400">@{ref.referredUsername}</span>
                      </div>
                      <div className="text-slate-400">
                        Joined {new Date(ref.createdAt).toLocaleDateString()} · Code: {ref.referralCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold uppercase ${
                          ref.referralType === 'agent'
                            ? 'bg-violet-500/15 text-violet-200 border border-violet-400/35'
                            : 'bg-blue-500/15 text-blue-200 border border-blue-400/30'
                        }`}
                      >
                        {ref.referralType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold ${
                          ref.playerStatus === 'active'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {ref.playerStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold text-white">Downstream Referrals (Level 2+)</h3>
              <span className="text-xs font-mono text-violet-300">
                {dashboard.downstreamReferrals.length} members
              </span>
            </div>

            {dashboard.downstreamReferrals.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No Level 2+ downstream members yet. When your referred players become agents and refer members, they appear here.
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {dashboard.downstreamReferrals.map((ref) => (
                  <div key={ref.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {ref.referredFullName} <span className="text-slate-400">@{ref.referredUsername}</span>
                      </div>
                      <div className="text-slate-400">
                        Depth L{ref.depth} · Joined {new Date(ref.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold uppercase shrink-0 ${
                        ref.referralType === 'agent'
                          ? 'bg-violet-500/15 text-violet-200 border border-violet-400/35'
                          : 'bg-blue-500/15 text-blue-200 border border-blue-400/30'
                      }`}
                    >
                      {ref.referralType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Unlimited-Depth Tree */}
      {tab === 'tree' && (
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-display font-bold text-white">
                Hierarchical Referral Network
              </h3>
              <p className="text-xs text-slate-400">
                Expand and collapse unlimited generations. Private phone and financial accounts of network members remain hidden.
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-300">
              Total Network Size: {dashboard.totalNetworkMembers}
            </div>
          </div>

          <ReferralTreeViewer trees={[dashboard.tree]} />
        </div>
      )}

      {/* Tab: Non-Deposit-Funded Rewards */}
      {tab === 'rewards' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#0F1324] border border-emerald-400/25 p-4 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-emerald-300">Compliance Policy: </span>
              {platformSettings.rewardPolicy.policySummary}
            </div>
            <span className="font-mono text-xs text-amber-300 shrink-0">
              Min Redeem: {formatBirr(platformSettings.rewardPolicy.minRedeemEtb)}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
              <div className="text-xs text-slate-400">Total Eligible Rewards</div>
              <div className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
                {formatBirr(rewardTotals.eligibleEtb)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">All non-flagged referrals</div>
            </div>
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
              <div className="text-xs text-slate-400">Pending Review</div>
              <div className="text-2xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
                {formatBirr(rewardTotals.pendingEtb)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Activates automatically on client verification
              </div>
            </div>
            <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-5">
              <div className="text-xs text-slate-400">Approved (Transferable)</div>
              <div className="text-2xl font-mono font-bold text-emerald-300 mt-1 tabular-nums">
                {formatBirr(rewardTotals.approvedEtb)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Ready for manual transfer</div>
            </div>
            <div className="rounded-2xl bg-[#0F1324] border border-emerald-400/25 p-5">
              <div className="text-xs text-slate-400">Credited to Active ETB</div>
              <div className="text-2xl font-mono font-bold text-emerald-300 mt-1 tabular-nums">
                {formatBirr(rewardTotals.redeemedEtb)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Live inside wallet balance ({formatBirr(currentUser.balanceBirr)})
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-white">Reward History</h3>
              <button
                type="button"
                disabled={
                  redeeming ||
                  !platformSettings.rewardPolicy.allowSelfTransferToBalance ||
                  rewardTotals.approvedEtb < platformSettings.rewardPolicy.minRedeemEtb
                }
                onClick={() => void handleRedeemRewards()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>
                  {redeeming
                    ? 'Transferring...'
                    : `Transfer ${formatBirr(rewardTotals.approvedEtb)} to ETB Wallet`}
                </span>
              </button>
            </div>

            {dashboard.rewards.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No promotional referral rewards recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {dashboard.rewards.map((rw) => (
                  <div
                    key={rw.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {rw.rewardType.replace(/_/g, ' ').toUpperCase()} · @{rw.referredUsername}
                      </div>
                      <div className="text-slate-400 font-mono mt-0.5">
                        Ref: {rw.rewardReference} · {new Date(rw.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-slate-400 mt-0.5">{rw.policyNote}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-emerald-300 tabular-nums">
                        +{formatBirr(rw.rewardAmountEtb)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold uppercase ${
                          rw.rewardStatus === 'redeemed'
                            ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/25'
                            : rw.rewardStatus === 'approved'
                              ? 'bg-blue-500/15 text-blue-200'
                              : rw.rewardStatus === 'pending'
                                ? 'bg-amber-500/15 text-amber-200'
                                : 'bg-rose-500/15 text-rose-200'
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

      {/* Tab: Encrypted Financial Details (Owner-Only Decrypt) */}
      {tab === 'financials' && (
        <div className="rounded-2xl bg-[#0F1324] border border-white/10 p-6 space-y-5 max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-300" />
              <h3 className="text-lg font-display font-bold text-white">
                Encrypted Agent Financial Vault
              </h3>
            </div>
            <button
              type="button"
              disabled={loadingFinancials}
              onClick={() => void handleToggleDecryptedFinancials()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#161C36] hover:bg-violet-600/30 border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              {decryptedFinancials ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Full Numbers</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>{loadingFinancials ? 'Decrypting...' : 'Reveal My Full Details'}</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">Bank Name</div>
              <div className="font-semibold text-white mt-1">
                {decryptedFinancials?.bankName || profile.bankName}
              </div>
            </div>
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">Bank Account Holder Name</div>
              <div className="font-semibold text-white mt-1">
                {decryptedFinancials?.bankAccountName || profile.bankAccountName}
              </div>
            </div>
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">Bank Account Number (AES-256 Encrypted)</div>
              <div className="font-mono text-amber-300 mt-1">
                {decryptedFinancials?.bankAccountNumber || profile.maskedBankAccount}
              </div>
            </div>
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">CBE Account Details (AES-256 Encrypted)</div>
              <div className="font-mono text-blue-300 mt-1">
                {decryptedFinancials?.cbeAccountDetails || profile.maskedCbeAccount}
              </div>
            </div>
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">Telebirr Account (AES-256 Encrypted)</div>
              <div className="font-mono text-emerald-300 mt-1">
                {decryptedFinancials?.telebirrAccount || profile.maskedTelebirrAccount}
              </div>
            </div>
            <div className="rounded-xl bg-[#080B15] border border-white/10 p-4">
              <div className="text-xs text-slate-400">ID Verification Status</div>
              <div className="font-semibold text-emerald-300 mt-1 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{profile.verificationStatus.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
