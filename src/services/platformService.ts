import type {
  ActiveWagerSession,
  AgentDashboardSummary,
  AgentProfile,
  AvatarId,
  BonusGrantRecord,
  ChallengeUpdatePayload,
  DecryptedAgentFinancialDetails,
  DepositRequest,
  GameCatalogItem,
  GameEngine,
  LiveRoundsSnapshot,
  PlatformSettings,
  PlatformSnapshot,
  ReferralRelationship,
  ReferralTreeNode,
  SlotBonusBuyResponse,
  SlotBonusPickResponse,
  SlotSpinResponse,
  SupportTicketRecord,
  TelebirrAgent,
  UserProfile,
  VerificationStatus,
  WithdrawalRequest,
} from '@/src/types/platform';

export const MIN_STAKE_BIRR = 0.1;
export const MIN_DEPOSIT_BIRR = 5;
export const MIN_WITHDRAWAL_BIRR = 10;

export function formatBirr(amount: number): string {
  const clean = Math.round((Number(amount) || 0) * 100) / 100;
  return Number.isInteger(clean) ? `${clean} Birr` : `${clean.toFixed(2)} Birr`;
}

export function formatBirrNumber(amount: number): string {
  const clean = Math.round((Number(amount) || 0) * 100) / 100;
  return Number.isInteger(clean) ? String(clean) : clean.toFixed(2);
}

const TOKEN_KEY = 'abyssinia_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

export function createEmptySnapshot(): PlatformSnapshot {
  return {
    users: [],
    games: [],
    agents: [
      {
        id: 'agent-kura',
        name: 'kura',
        phone: '0911626671',
        note: 'Primary Telebirr Deposit Agent',
        isActive: true,
        isPrimary: true,
      },
    ],
    sessions: [],
    challenges: [],
    challengeProgressByUser: {},
    depositRequests: [],
    withdrawalRequests: [],
    bonusGrants: [],
    platformSettings: {
      minDepositEtb: 5,
      minWithdrawalEtb: 10,
      defaultMinStakeEtb: 0.1,
      agentEligibility: {
        minAccountAgeDays: 0,
        minGamesPlayed: 0,
        minTotalDepositedEtb: 0,
        requirePhoneOnFile: true,
        allowAllVerifiedPlayers: true,
      },
      rewardPolicy: {
        rewardsEnabled: true,
        rewardMode: 'fixed_per_verified_referral',
        playerReferralBonusEtb: 5,
        agentReferralBonusEtb: 15,
        downstreamMilestoneBonusEtb: 0,
        autoApproveRewards: false,
        autoApproveOnClientVerification: true,
        autoCreditAgentWalletOnApproval: true,
        allowSelfTransferToBalance: true,
        minRedeemEtb: 5,
        policySummary:
          'Non-deposit-funded promotional rewards granted strictly from the platform marketing budget after admin verification.',
      },
      updatedAt: new Date().toISOString(),
    },
    myAgentProfile: null,
    myEligibility: null,
    myReferralParent: null,
    myReferralRewards: [],
    agentProfiles: [],
    referralRelationships: [],
    referralRewards: [],
    transactions: [],
    auditLogs: [],
    supportTickets: [],
    currentUserId: null,
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function apiFetch<T>(
  url: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const token = getAuthToken();
  const { idempotencyKey, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(url, { ...fetchOptions, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchPlatformBootstrap(): Promise<PlatformSnapshot> {
  return apiFetch<PlatformSnapshot>('/api/bootstrap', { method: 'GET' });
}

export async function authenticateUser(
  identifier: string,
  password: string
): Promise<{ user?: UserProfile; error?: string; nextSnapshot?: PlatformSnapshot }> {
  const cleanId = identifier.trim();
  if (!cleanId || !password) {
    return { error: 'Please enter your email, username, or phone number and password.' };
  }

  try {
    const res = await apiFetch<{
      token: string;
      user: UserProfile;
      snapshot: PlatformSnapshot;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: cleanId, email: cleanId.toLowerCase(), password }),
    });
    setAuthToken(res.token);
    return { user: res.user, nextSnapshot: res.snapshot };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unable to sign in.' };
  }
}

export async function registerNewUser(params: {
  email: string;
  password: string;
  confirmPassword?: string;
  username: string;
  fullName: string;
  phone: string;
  referralCode?: string;
  displayName?: string;
  avatarId: AvatarId;
}): Promise<{ user?: UserProfile; error?: string; nextSnapshot?: PlatformSnapshot }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanUsername = params.username.trim().replace(/[^a-zA-Z0-9_]/g, '');
  const cleanFullName = params.fullName.trim();
  const cleanDisplay = (params.displayName || cleanFullName || cleanUsername).trim();

  try {
    const res = await apiFetch<{
      token: string;
      user: UserProfile;
      snapshot: PlatformSnapshot;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        password: params.password,
        confirmPassword: params.confirmPassword,
        username: cleanUsername,
        fullName: cleanFullName,
        phone: params.phone.trim(),
        referralCode: params.referralCode?.trim() || undefined,
        displayName: cleanDisplay,
        avatarId: params.avatarId,
      }),
    });
    setAuthToken(res.token);
    return { user: res.user, nextSnapshot: res.snapshot };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unable to register account.' };
  }
}

export async function signOutUser(): Promise<PlatformSnapshot> {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network issues on sign-out and still purge client token
    }
  }
  setAuthToken(null);
  return fetchPlatformBootstrap();
}

export async function updateProfileOnServer(updates: {
  displayName: string;
  fullName?: string;
  phone?: string;
  avatarId: AvatarId;
}): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.snapshot;
}

export async function startWagerOnServer(params: {
  gameSlug: string;
  stakeBirr: number;
}): Promise<{ wager: ActiveWagerSession; snapshot: PlatformSnapshot }> {
  return apiFetch<{ wager: ActiveWagerSession; snapshot: PlatformSnapshot }>(
    '/api/wagers/start',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}

export async function cashoutWagerOnServer(params: {
  wagerId: string;
  multiplier: number;
  score: number;
  challengeUpdates?: ChallengeUpdatePayload;
}): Promise<{
  ok: boolean;
  payoutBirr: number;
  bonusBirrApplied: number;
  multiplier: number;
  snapshot: PlatformSnapshot;
}> {
  return apiFetch('/api/wagers/cashout', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function settleWagerOnServer(params: {
  wagerId: string;
  outcome: 'win' | 'draw' | 'loss';
  score: number;
  multiplier?: number;
  challengeUpdates?: ChallengeUpdatePayload;
}): Promise<{
  ok: boolean;
  payoutBirr: number;
  bonusBirrApplied: number;
  multiplier: number;
  snapshot: PlatformSnapshot;
}> {
  return apiFetch('/api/wagers/settle', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function recordDemoResultOnServer(params: {
  gameSlug: string;
  gameTitle: string;
  engine: GameEngine;
  score: number;
  outcome: 'win' | 'draw' | 'cashed_out' | 'loss';
}): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/games/result', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.snapshot;
}

export async function claimChallengeOnServer(
  challengeId: string
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/challenges/${encodeURIComponent(challengeId)}/claim`,
    { method: 'POST' }
  );
  return res.snapshot;
}

export async function submitDepositOnServer(params: {
  amountBirr: number;
  agentId: string;
  telebirrReference?: string;
  senderPhone?: string;
  screenshotDataUrl?: string;
  screenshotFileName?: string;
}): Promise<{ request?: DepositRequest; error?: string; nextSnapshot?: PlatformSnapshot }> {
  try {
    const res = await apiFetch<{ request: DepositRequest; snapshot: PlatformSnapshot }>(
      '/api/wallet/deposits',
      {
        method: 'POST',
        idempotencyKey: createIdempotencyKey(),
        body: JSON.stringify(params),
      }
    );
    return { request: res.request, nextSnapshot: res.snapshot };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unable to submit deposit.' };
  }
}

export async function submitWithdrawalOnServer(params: {
  amountBirr: number;
  telebirrPhone: string;
  recipientName: string;
}): Promise<{
  request?: WithdrawalRequest;
  error?: string;
  nextSnapshot?: PlatformSnapshot;
}> {
  try {
    const res = await apiFetch<{
      request: WithdrawalRequest;
      snapshot: PlatformSnapshot;
    }>('/api/wallet/withdrawals', {
      method: 'POST',
      idempotencyKey: createIdempotencyKey(),
      body: JSON.stringify(params),
    });
    return { request: res.request, nextSnapshot: res.snapshot };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unable to submit withdrawal.' };
  }
}

export async function adminSaveGameOnServer(
  game: GameCatalogItem
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/admin/games', {
    method: 'POST',
    body: JSON.stringify(game),
  });
  return res.snapshot;
}

export async function adminSaveAgentOnServer(
  agent: Partial<TelebirrAgent> & { name: string; phone: string }
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/admin/agents', {
    method: 'POST',
    body: JSON.stringify(agent),
  });
  return res.snapshot;
}

export async function adminDeleteAgentOnServer(agentId: string): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/agents/${encodeURIComponent(agentId)}`,
    { method: 'DELETE' }
  );
  return res.snapshot;
}

export async function adminGrantBonusOnServer(params: {
  targetUserId: string | 'ALL';
  amountBirr: number;
  reason: string;
}): Promise<{ snapshot: PlatformSnapshot; bonusGrants?: BonusGrantRecord[] }> {
  return apiFetch<{ snapshot: PlatformSnapshot }>('/api/admin/bonuses/grant', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function adminUpdateUserOnServer(
  userId: string,
  action: { toggleBan?: boolean; toggleRole?: boolean; birrDelta?: number }
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(action),
    }
  );
  return res.snapshot;
}

export async function adminReviewDepositOnServer(
  requestId: string,
  decision: 'approved' | 'rejected',
  adminNote?: string
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/deposits/${encodeURIComponent(requestId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, adminNote }),
    }
  );
  return res.snapshot;
}

export async function adminReviewWithdrawalOnServer(
  requestId: string,
  decision: 'approved' | 'rejected',
  payoutReference?: string,
  adminNote?: string
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/withdrawals/${encodeURIComponent(requestId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, payoutReference, adminNote }),
    }
  );
  return res.snapshot;
}

const LIVE_CLIENT_KEY = 'abyssinia_live_client_id';
let fallbackMemoryClientId: string | null = null;

export function getLiveClientId(): string {
  if (typeof window === 'undefined') return 'ssr-client';
  try {
    let id = window.localStorage.getItem(LIVE_CLIENT_KEY);
    if (!id) {
      id = `cli_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      window.localStorage.setItem(LIVE_CLIENT_KEY, id);
    }
    return id;
  } catch {
    if (!fallbackMemoryClientId) {
      fallbackMemoryClientId = `cli_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    }
    return fallbackMemoryClientId;
  }
}

export async function fetchLiveRounds(): Promise<LiveRoundsSnapshot> {
  return apiFetch<LiveRoundsSnapshot>('/api/live-rounds', { method: 'GET' });
}

export async function lockLiveKenoTicket(params: {
  roundId: number;
  picks: number[];
  stakeBirr: number;
}): Promise<{ ok: boolean; snapshot: PlatformSnapshot; rounds: LiveRoundsSnapshot }> {
  return apiFetch('/api/live-rounds/keno/lock', {
    method: 'POST',
    body: JSON.stringify({
      roundId: params.roundId,
      picks: params.picks,
      stakeBirr: params.stakeBirr,
      clientId: getLiveClientId(),
    }),
  });
}

export async function settleLiveKenoTicket(params: {
  roundId: number;
  gameSlug: string;
  gameTitle: string;
}): Promise<{
  ok: boolean;
  result: {
    alreadySettled?: boolean;
    hits: number;
    stakeBirr: number;
    payoutBirr: number;
    multiplier: number;
    drawnBalls: number[];
    picks: number[];
    isWin: boolean;
  };
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
}> {
  return apiFetch('/api/live-rounds/keno/settle', {
    method: 'POST',
    body: JSON.stringify({
      roundId: params.roundId,
      gameSlug: params.gameSlug,
      gameTitle: params.gameTitle,
    }),
  });
}

export async function claimLiveBingoOnServer(params: {
  roundId: number;
  cardNumber?: number;
  cardValues: Array<number | 'FREE'>;
  gameSlug: string;
  gameTitle: string;
}): Promise<{
  ok: boolean;
  result: {
    alreadyClaimed?: boolean;
    cardNumber?: number;
    winningLine?: number[];
    ballsUsed: number;
    stakeBirr: number;
    payoutBirr: number;
    multiplier: number;
    score: number;
  };
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
}> {
  return apiFetch('/api/live-rounds/bingo/claim', {
    method: 'POST',
    body: JSON.stringify({
      roundId: params.roundId,
      cardNumber: params.cardNumber,
      cardValues: params.cardValues,
      gameSlug: params.gameSlug,
      gameTitle: params.gameTitle,
    }),
  });
}

export async function fetchBingoRoundDeck(roundId?: number): Promise<{
  roundId: number;
  cards: Array<{
    cardNumber: number;
    values: Array<number | 'FREE'>;
    takenBy: string | null;
  }>;
  myLockedCards: number[];
}> {
  const qs = new URLSearchParams();
  if (roundId !== undefined) qs.set('roundId', String(roundId));
  qs.set('clientId', getLiveClientId());
  return apiFetch(`/api/live-rounds/bingo/deck?${qs.toString()}`, {
    method: 'GET',
  });
}

export async function lockLiveBingoCards(params: {
  roundId: number;
  cardNumbers: number[];
  stakePerCardBirr: number;
}): Promise<{
  ok: boolean;
  lockedCards: number[];
  totalStakeBirr: number;
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
  deck: {
    roundId: number;
    cards: Array<{
      cardNumber: number;
      values: Array<number | 'FREE'>;
      takenBy: string | null;
    }>;
    myLockedCards: number[];
  };
}> {
  return apiFetch('/api/live-rounds/bingo/lock', {
    method: 'POST',
    body: JSON.stringify({
      roundId: params.roundId,
      cardNumbers: params.cardNumbers,
      stakePerCardBirr: params.stakePerCardBirr,
    }),
  });
}

export async function cashoutLiveKenoOnServer(params: {
  roundId: number;
  gameSlug: string;
  gameTitle: string;
}): Promise<{
  ok: boolean;
  result: {
    hits: number;
    stakeBirr: number;
    payoutBirr: number;
    multiplier: number;
    picks: number[];
    bonusApplied: number;
  };
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
}> {
  return apiFetch('/api/live-rounds/keno/cashout', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function cashoutLiveBingoOnServer(params: {
  roundId: number;
  gameSlug: string;
  gameTitle: string;
}): Promise<{
  ok: boolean;
  result: {
    stakeBirr: number;
    payoutBirr: number;
    multiplier: number;
    bestLine: number;
    bonusApplied: number;
  };
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
}> {
  return apiFetch('/api/live-rounds/bingo/cashout', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function settleBingoHouseLossOnServer(params: {
  roundId: number;
  gameSlug: string;
  gameTitle: string;
}): Promise<{
  ok: boolean;
  result: {
    alreadySettled?: boolean;
    stakeBirr: number;
    houseTargetBall: number;
  };
  snapshot: PlatformSnapshot;
  rounds: LiveRoundsSnapshot;
}> {
  return apiFetch('/api/live-rounds/bingo/settle-loss', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function spinSlotOnServer(params: {
  gameSlug: string;
  stakeBirr: number;
}): Promise<SlotSpinResponse> {
  return apiFetch<SlotSpinResponse>('/api/slots/spin', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function buySlotBonusOnServer(params: {
  gameSlug: string;
  stakeBirr: number;
  buyType: 'free_spins' | 'bonus_game';
}): Promise<SlotBonusBuyResponse> {
  return apiFetch<SlotBonusBuyResponse>('/api/slots/bonus-buy', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function pickSlotVaultOnServer(params: {
  bonusId: string;
  vaultIndex: number;
}): Promise<SlotBonusPickResponse> {
  return apiFetch<SlotBonusPickResponse>('/api/slots/bonus-pick', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// =========================================================================
// PLAYER-TO-AGENT, REFERRAL NETWORK, REWARDS, SUPPORT & ADMIN API WRAPPERS
// =========================================================================

export async function applyForAgentOnServer(params: {
  fullLegalName: string;
  phone: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  cbeAccountDetails: string;
  telebirrAccount: string;
  verificationDocRef?: string;
}): Promise<{ agentProfile: AgentProfile; snapshot: PlatformSnapshot }> {
  return apiFetch('/api/agent/apply', {
    method: 'POST',
    idempotencyKey: createIdempotencyKey(),
    body: JSON.stringify(params),
  });
}

export async function fetchOwnAgentFinancialDetails(): Promise<DecryptedAgentFinancialDetails> {
  return apiFetch<DecryptedAgentFinancialDetails>('/api/agent/financial-details', {
    method: 'GET',
  });
}

export async function generatePermanentReferralCodeOnServer(
  preferredCode?: string
): Promise<{ agentCode: string; referralLink: string; snapshot: PlatformSnapshot }> {
  return apiFetch('/api/agent/referral-code', {
    method: 'POST',
    body: JSON.stringify({ preferredCode }),
  });
}

export async function fetchAgentDashboardOnServer(
  userId?: string
): Promise<AgentDashboardSummary> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<AgentDashboardSummary>(`/api/agent/dashboard${qs}`, { method: 'GET' });
}

export async function redeemReferralRewardsOnServer(): Promise<{
  ok: boolean;
  redeemedAmountEtb: number;
  referenceNumber: string;
  snapshot: PlatformSnapshot;
}> {
  return apiFetch('/api/agent/rewards/redeem', {
    method: 'POST',
    idempotencyKey: createIdempotencyKey(),
  });
}

export async function submitSupportTicketOnServer(params: {
  category: SupportTicketRecord['category'];
  subject: string;
  message: string;
}): Promise<{ ticket: SupportTicketRecord; snapshot: PlatformSnapshot }> {
  return apiFetch('/api/support/tickets', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function adminReviewAgentApplicationOnServer(
  agentId: string,
  params: {
    decision: 'approve' | 'reject' | 'verify_only';
    verificationStatus?: VerificationStatus;
    rejectionReason?: string;
  }
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/agent-applications/${encodeURIComponent(agentId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
  return res.snapshot;
}

export async function adminSetAgentStatusOnServer(
  agentId: string,
  action: 'suspend' | 'reactivate',
  reason?: string
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/agents-profile/${encodeURIComponent(agentId)}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }
  );
  return res.snapshot;
}

export async function adminFetchAgentFinancialDetailsOnServer(
  agentId: string
): Promise<DecryptedAgentFinancialDetails> {
  return apiFetch<DecryptedAgentFinancialDetails>(
    `/api/admin/agents-profile/${encodeURIComponent(agentId)}/financial-details`,
    { method: 'GET' }
  );
}

export async function adminFetchNetworkOnServer(): Promise<{
  trees: ReferralTreeNode[];
  flaggedRelationships: ReferralRelationship[];
}> {
  return apiFetch('/api/admin/network', { method: 'GET' });
}

export async function adminReviewRewardOnServer(
  rewardId: string,
  decision: 'approve' | 'reject'
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/rewards/${encodeURIComponent(rewardId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }
  );
  return res.snapshot;
}

export async function adminGrantAgentRewardOnServer(params: {
  agentUserId: string;
  amountEtb: number;
  note?: string;
}): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/admin/rewards/grant', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.snapshot;
}

export async function adminSavePlatformSettingsOnServer(params: {
  settings: Partial<PlatformSettings>;
  applyMinStakeToAllGames?: boolean;
}): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>('/api/admin/settings', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.snapshot;
}

export async function adminUpdateSupportTicketOnServer(
  ticketId: string,
  params: { status?: SupportTicketRecord['status']; adminReply?: string }
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/support/${encodeURIComponent(ticketId)}/update`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
  return res.snapshot;
}

export async function adminResolveFraudAlertOnServer(
  relationshipId: string,
  action: 'clear' | 'suspend_referred' | 'suspend_both'
): Promise<PlatformSnapshot> {
  const res = await apiFetch<{ snapshot: PlatformSnapshot }>(
    `/api/admin/fraud/${encodeURIComponent(relationshipId)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
  return res.snapshot;
}

export async function downloadAdminCsvReport(
  reportType: 'users' | 'agents' | 'referrals' | 'rewards' | 'transactions' | 'audit'
): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(
    `/api/admin/reports/export?type=${encodeURIComponent(reportType)}`,
    {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to export report.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `abyssinia-${reportType}-report.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminApproveAllPendingRewardsOnServer(): Promise<{
  approvedCount: number;
  creditedEtb: number;
  snapshot: PlatformSnapshot;
}> {
  return apiFetch('/api/admin/rewards/approve-all-pending', {
    method: 'POST',
  });
}
