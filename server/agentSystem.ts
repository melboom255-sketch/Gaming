import crypto from 'node:crypto';
import type { Request } from 'express';
import { decryptSensitiveText, encryptSensitiveText, maskAccountValue } from './cryptoVault.ts';
import type {
  AccountType,
  AgentApplicationStatus,
  AgentEligibilityCheck,
  AgentEligibilityConfig,
  AgentProfile,
  AuditLogRecord,
  DecryptedAgentFinancialDetails,
  PlatformSettings,
  PlatformTransaction,
  PlayerStatus,
  ReferralRelationship,
  ReferralRewardRecord,
  ReferralTreeNode,
  RewardPolicyConfig,
  SupportTicketRecord,
  VerificationStatus,
} from '../src/types/platform.ts';

export interface StoredAgentProfile {
  id: string;
  userId: string;
  username: string;
  agentCode?: string;
  agentCodeCreatedAt?: string;
  fullLegalName: string;
  phone: string;
  bankName: string;
  bankAccountName: string;
  encryptedBankAccount: string;
  encryptedCbeAccount: string;
  encryptedTelebirrAccount: string;
  verificationStatus: VerificationStatus;
  verificationDocRef?: string;
  applicationStatus: AgentApplicationStatus;
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredReferralRelationship {
  id: string;
  parentAgentId: string;
  parentAgentUserId: string;
  parentAgentCode: string;
  referredUserId: string;
  referredUsername: string;
  referredFullName: string;
  referralCode: string;
  referralType: 'player' | 'agent';
  isFlaggedDuplicate: boolean;
  fraudFlagReason?: string;
  createdAt: string;
}

export interface StoredReferralReward {
  id: string;
  agentId: string;
  agentUserId: string;
  agentUsername: string;
  referralId?: string;
  referredUserId: string;
  referredUsername: string;
  rewardAmountEtb: number;
  rewardType: 'player_referral' | 'agent_referral' | 'downstream_milestone' | 'admin_grant';
  rewardStatus: 'pending' | 'approved' | 'rejected' | 'redeemed';
  rewardReference: string;
  policyNote: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  redeemedAt?: string;
  redemptionTxRef?: string;
}

export interface StoredTransaction {
  id: string;
  userId: string;
  username: string;
  transactionType:
    | 'deposit'
    | 'withdrawal'
    | 'reward_redemption'
    | 'bonus'
    | 'wager'
    | 'payout'
    | 'adjustment';
  amount: number;
  currency: 'ETB';
  status: 'pending' | 'completed' | 'approved' | 'rejected' | 'refunded';
  referenceNumber: string;
  idempotencyKey?: string;
  note?: string;
  createdAt: string;
}

export interface StoredAuditLog {
  id: string;
  administratorId: string;
  administratorUsername: string;
  action: string;
  targetType:
    | 'agent'
    | 'user'
    | 'referral'
    | 'reward'
    | 'deposit'
    | 'withdrawal'
    | 'game'
    | 'settings'
    | 'support';
  affectedUserId?: string;
  affectedLabel?: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface StoredSupportTicket {
  id: string;
  userId: string;
  username: string;
  category: 'deposit' | 'withdrawal' | 'agent' | 'referral' | 'account' | 'other';
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  adminReply?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MinimalUserRef {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string;
  displayName: string;
  role: 'player' | 'admin';
  accountType: AccountType;
  playerStatus: PlayerStatus;
  balanceBirr: number;
  gamesPlayed: number;
  isBanned: boolean;
  joinedAt: string;
  signupIp?: string;
}

export function createDefaultPlatformSettings(): PlatformSettings {
  return {
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
        'Non-deposit-funded promotional rewards granted from the platform marketing budget. Once a referred client is verified/approved by an administrator, promotional rewards activate directly into the agent ETB balance.',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePlatformSettings(raw?: Partial<PlatformSettings>): PlatformSettings {
  const def = createDefaultPlatformSettings();
  if (!raw || typeof raw !== 'object') return def;

  const minDeposit = Number(raw.minDepositEtb);
  const minWithdrawal = Number(raw.minWithdrawalEtb);
  const defaultMinStake = Number(raw.defaultMinStakeEtb);

  const eligRaw = (raw.agentEligibility || {}) as Partial<AgentEligibilityConfig>;
  const rewRaw = (raw.rewardPolicy || {}) as Partial<RewardPolicyConfig>;

  return {
    minDepositEtb:
      Number.isFinite(minDeposit) && minDeposit >= 1
        ? Math.round(minDeposit * 100) / 100
        : def.minDepositEtb,
    minWithdrawalEtb:
      Number.isFinite(minWithdrawal) && minWithdrawal >= 1
        ? Math.round(minWithdrawal * 100) / 100
        : def.minWithdrawalEtb,
    defaultMinStakeEtb:
      Number.isFinite(defaultMinStake) && defaultMinStake >= 0.1
        ? Math.round(defaultMinStake * 100) / 100
        : def.defaultMinStakeEtb,
    agentEligibility: {
      minAccountAgeDays: Math.max(0, Math.round(Number(eligRaw.minAccountAgeDays ?? def.agentEligibility.minAccountAgeDays))),
      minGamesPlayed: Math.max(0, Math.round(Number(eligRaw.minGamesPlayed ?? def.agentEligibility.minGamesPlayed))),
      minTotalDepositedEtb: Math.max(
        0,
        Math.round((Number(eligRaw.minTotalDepositedEtb ?? def.agentEligibility.minTotalDepositedEtb) || 0) * 100) / 100
      ),
      requirePhoneOnFile:
        typeof eligRaw.requirePhoneOnFile === 'boolean'
          ? eligRaw.requirePhoneOnFile
          : def.agentEligibility.requirePhoneOnFile,
      allowAllVerifiedPlayers:
        typeof eligRaw.allowAllVerifiedPlayers === 'boolean'
          ? eligRaw.allowAllVerifiedPlayers
          : def.agentEligibility.allowAllVerifiedPlayers,
    },
    rewardPolicy: {
      rewardsEnabled:
        typeof rewRaw.rewardsEnabled === 'boolean'
          ? rewRaw.rewardsEnabled
          : def.rewardPolicy.rewardsEnabled,
      rewardMode:
        rewRaw.rewardMode === 'fixed_per_verified_referral' ||
        rewRaw.rewardMode === 'milestone_tier' ||
        rewRaw.rewardMode === 'manual_admin_only'
          ? rewRaw.rewardMode
          : def.rewardPolicy.rewardMode,
      playerReferralBonusEtb: Math.max(
        0,
        Math.min(500, Math.round((Number(rewRaw.playerReferralBonusEtb ?? def.rewardPolicy.playerReferralBonusEtb) || 0) * 100) / 100)
      ),
      agentReferralBonusEtb: Math.max(
        0,
        Math.min(1000, Math.round((Number(rewRaw.agentReferralBonusEtb ?? def.rewardPolicy.agentReferralBonusEtb) || 0) * 100) / 100)
      ),
      downstreamMilestoneBonusEtb: Math.max(
        0,
        Math.min(250, Math.round((Number(rewRaw.downstreamMilestoneBonusEtb ?? def.rewardPolicy.downstreamMilestoneBonusEtb) || 0) * 100) / 100)
      ),
      autoApproveRewards:
        typeof rewRaw.autoApproveRewards === 'boolean'
          ? rewRaw.autoApproveRewards
          : def.rewardPolicy.autoApproveRewards,
      autoApproveOnClientVerification:
        typeof rewRaw.autoApproveOnClientVerification === 'boolean'
          ? rewRaw.autoApproveOnClientVerification
          : def.rewardPolicy.autoApproveOnClientVerification,
      autoCreditAgentWalletOnApproval:
        typeof rewRaw.autoCreditAgentWalletOnApproval === 'boolean'
          ? rewRaw.autoCreditAgentWalletOnApproval
          : def.rewardPolicy.autoCreditAgentWalletOnApproval,
      allowSelfTransferToBalance:
        typeof rewRaw.allowSelfTransferToBalance === 'boolean'
          ? rewRaw.allowSelfTransferToBalance
          : def.rewardPolicy.allowSelfTransferToBalance,
      minRedeemEtb: Math.max(
        1,
        Math.round((Number(rewRaw.minRedeemEtb ?? def.rewardPolicy.minRedeemEtb) || 5) * 100) / 100
      ),
      policySummary:
        typeof rewRaw.policySummary === 'string' && rewRaw.policySummary.trim()
          ? rewRaw.policySummary.trim().slice(0, 400)
          : def.rewardPolicy.policySummary,
    },
    updatedAt: raw.updatedAt || def.updatedAt,
  };
}

export function normalizePhoneKey(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('251') && digits.length >= 12) {
    return `0${digits.slice(3, 12)}`;
  }
  return digits;
}

export function sanitizeAgentProfile(
  profile: StoredAgentProfile,
  secretSeed: string
): AgentProfile {
  const bankDec = decryptSensitiveText(profile.encryptedBankAccount, secretSeed);
  const cbeDec = decryptSensitiveText(profile.encryptedCbeAccount, secretSeed);
  const tbDec = decryptSensitiveText(profile.encryptedTelebirrAccount, secretSeed);
  return {
    id: profile.id,
    userId: profile.userId,
    username: profile.username,
    agentCode: profile.agentCode,
    agentCodeCreatedAt: profile.agentCodeCreatedAt,
    fullLegalName: profile.fullLegalName,
    phone: profile.phone,
    bankName: profile.bankName,
    bankAccountName: profile.bankAccountName,
    maskedBankAccount: maskAccountValue(bankDec),
    maskedCbeAccount: maskAccountValue(cbeDec),
    maskedTelebirrAccount: maskAccountValue(tbDec),
    verificationStatus: profile.verificationStatus,
    verificationDocRef: profile.verificationDocRef,
    applicationStatus: profile.applicationStatus,
    rejectionReason: profile.rejectionReason,
    approvedAt: profile.approvedAt,
    approvedBy: profile.approvedBy,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function decryptAgentFinancialDetails(
  profile: StoredAgentProfile,
  secretSeed: string
): DecryptedAgentFinancialDetails {
  return {
    agentId: profile.id,
    bankName: profile.bankName,
    bankAccountName: profile.bankAccountName,
    bankAccountNumber: decryptSensitiveText(profile.encryptedBankAccount, secretSeed),
    cbeAccountDetails: decryptSensitiveText(profile.encryptedCbeAccount, secretSeed),
    telebirrAccount: decryptSensitiveText(profile.encryptedTelebirrAccount, secretSeed),
    verificationDocRef: profile.verificationDocRef,
  };
}

export function buildEncryptedAgentFinancials(params: {
  bankAccountNumber: string;
  cbeAccountDetails: string;
  telebirrAccount: string;
  secretSeed: string;
}) {
  return {
    encryptedBankAccount: encryptSensitiveText(params.bankAccountNumber, params.secretSeed),
    encryptedCbeAccount: encryptSensitiveText(params.cbeAccountDetails, params.secretSeed),
    encryptedTelebirrAccount: encryptSensitiveText(params.telebirrAccount, params.secretSeed),
  };
}

export function evaluateAgentEligibility(params: {
  user: MinimalUserRef;
  settings: PlatformSettings;
  approvedDepositsTotalEtb: number;
}): AgentEligibilityCheck {
  const { user, settings, approvedDepositsTotalEtb } = params;
  const elig = settings.agentEligibility;
  const reasons: string[] = [];

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(user.joinedAt || new Date().toISOString())) / (24 * 60 * 60 * 1000))
  );
  const hasPhone = Boolean(user.phone && normalizePhoneKey(user.phone).length >= 9);

  if (user.isBanned || user.playerStatus === 'suspended') {
    reasons.push('Suspended accounts are not eligible for agent status.');
  }
  if (elig.requirePhoneOnFile && !hasPhone) {
    reasons.push('Add a valid Ethiopian phone number in Account Settings first.');
  }
  if (ageDays < elig.minAccountAgeDays) {
    reasons.push(`Account age must be at least ${elig.minAccountAgeDays} day(s) (currently ${ageDays}).`);
  }
  if (user.gamesPlayed < elig.minGamesPlayed) {
    reasons.push(`Play at least ${elig.minGamesPlayed} game(s) first (currently ${user.gamesPlayed}).`);
  }
  if (approvedDepositsTotalEtb < elig.minTotalDepositedEtb) {
    reasons.push(
      `Minimum ${elig.minTotalDepositedEtb} ETB in approved deposits required (currently ${approvedDepositsTotalEtb} ETB).`
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    accountAgeDays: ageDays,
    gamesPlayed: user.gamesPlayed,
    totalDepositedEtb: approvedDepositsTotalEtb,
    hasPhoneOnFile: hasPhone,
  };
}

export function generateUniqueAgentCode(
  username: string,
  existingCodes: Set<string>,
  preferred?: string
): string {
  if (preferred) {
    const cleaned = preferred
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 14);
    if (cleaned.length >= 4 && !existingCodes.has(cleaned)) {
      return cleaned;
    }
  }
  const base =
    username
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || 'AGENT';

  for (let i = 0; i < 40; i++) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `ABY${base}${suffix}`.slice(0, 14);
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `ABY${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function hasAncestorCycle(
  candidateParentUserId: string,
  childUserId: string,
  relationships: StoredReferralRelationship[]
): boolean {
  if (candidateParentUserId === childUserId) return true;
  const parentByChild = new Map<string, string>();
  for (const rel of relationships) {
    parentByChild.set(rel.referredUserId, rel.parentAgentUserId);
  }
  const visited = new Set<string>([childUserId]);
  let cur: string | undefined = candidateParentUserId;
  while (cur) {
    if (visited.has(cur)) return true;
    visited.add(cur);
    cur = parentByChild.get(cur);
  }
  return false;
}

export function buildReferralTree(params: {
  rootUserId: string;
  users: MinimalUserRef[];
  agentProfiles: StoredAgentProfile[];
  relationships: StoredReferralRelationship[];
}): ReferralTreeNode | null {
  const { rootUserId, users, agentProfiles, relationships } = params;
  const userById = new Map(users.map((u) => [u.id, u]));
  const agentByUserId = new Map(agentProfiles.map((a) => [a.userId, a]));

  const childrenByParentUser = new Map<string, StoredReferralRelationship[]>();
  for (const rel of relationships) {
    const list = childrenByParentUser.get(rel.parentAgentUserId) || [];
    list.push(rel);
    childrenByParentUser.set(rel.parentAgentUserId, list);
  }

  const visited = new Set<string>();

  const buildNode = (userId: string, depth: number, flagged?: boolean): ReferralTreeNode | null => {
    const u = userById.get(userId);
    if (!u || visited.has(userId)) return null;
    visited.add(userId);

    const ap = agentByUserId.get(userId);
    const directRels = childrenByParentUser.get(userId) || [];
    const childNodes: ReferralTreeNode[] = [];
    for (const rel of directRels) {
      const child = buildNode(rel.referredUserId, depth + 1, rel.isFlaggedDuplicate);
      if (child) childNodes.push(child);
    }

    const totalDescendants = childNodes.reduce(
      (sum, c) => sum + 1 + c.totalDescendants,
      0
    );

    const accountType: AccountType =
      u.role === 'admin'
        ? 'admin'
        : ap && ap.applicationStatus === 'approved'
          ? 'agent'
          : 'player';

    return {
      userId: u.id,
      agentId: ap?.id,
      username: u.username,
      fullName: u.fullName || u.displayName || u.username,
      accountType,
      agentCode: ap?.agentCode,
      verificationStatus: ap?.verificationStatus,
      applicationStatus: ap?.applicationStatus,
      playerStatus: u.isBanned ? 'suspended' : u.playerStatus || 'active',
      joinedAt: u.joinedAt,
      gamesPlayed: u.gamesPlayed,
      depth,
      directCount: childNodes.length,
      totalDescendants,
      isFlaggedDuplicate: flagged,
      children: childNodes,
    };
  };

  return buildNode(rootUserId, 0);
}

export function collectDownstreamRelationships(params: {
  rootUserId: string;
  relationships: StoredReferralRelationship[];
  users: MinimalUserRef[];
}): Array<ReferralRelationship & { depth: number }> {
  const { rootUserId, relationships, users } = params;
  const userById = new Map(users.map((u) => [u.id, u]));
  const byParent = new Map<string, StoredReferralRelationship[]>();
  for (const rel of relationships) {
    const arr = byParent.get(rel.parentAgentUserId) || [];
    arr.push(rel);
    byParent.set(rel.parentAgentUserId, arr);
  }

  const results: Array<ReferralRelationship & { depth: number }> = [];
  const queue: Array<{ userId: string; depth: number }> = [{ userId: rootUserId, depth: 1 }];
  const seen = new Set<string>([rootUserId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = byParent.get(current.userId) || [];
    for (const rel of children) {
      if (seen.has(rel.referredUserId)) continue;
      seen.add(rel.referredUserId);
      const u = userById.get(rel.referredUserId);
      results.push({
        ...rel,
        playerStatus: u?.isBanned ? 'suspended' : u?.playerStatus || 'active',
        depth: current.depth,
      });
      queue.push({ userId: rel.referredUserId, depth: current.depth + 1 });
    }
  }
  return results;
}

export function detectReferralFraud(params: {
  newUserEmail: string;
  newUserPhone: string;
  signupIp: string;
  parentAgentUser: MinimalUserRef;
  existingUsers: MinimalUserRef[];
}): { isFlagged: boolean; reason?: string } {
  const { newUserEmail, newUserPhone, signupIp, parentAgentUser, existingUsers } = params;
  const normPhone = normalizePhoneKey(newUserPhone);
  const parentPhone = normalizePhoneKey(parentAgentUser.phone);

  if (normPhone && parentPhone && normPhone === parentPhone) {
    return { isFlagged: true, reason: 'Phone number matches referring agent.' };
  }

  const emailLocal = newUserEmail.split('@')[0]?.split('+')[0] || '';
  const parentLocal = parentAgentUser.email.split('@')[0]?.split('+')[0] || '';
  if (
    emailLocal &&
    parentLocal &&
    emailLocal === parentLocal &&
    newUserEmail.split('@')[1] === parentAgentUser.email.split('@')[1]
  ) {
    return { isFlagged: true, reason: 'Email alias pattern matches referring agent.' };
  }

  if (signupIp && signupIp !== 'unknown') {
    if (parentAgentUser.signupIp && parentAgentUser.signupIp === signupIp) {
      return { isFlagged: true, reason: 'Registration IP matches referring agent IP.' };
    }
    const recentSameIp = existingUsers.filter(
      (u) =>
        u.signupIp === signupIp &&
        Date.now() - Date.parse(u.joinedAt || '') < 24 * 60 * 60 * 1000
    );
    if (recentSameIp.length >= 2) {
      return {
        isFlagged: true,
        reason: `Multiple referred signups (${recentSameIp.length + 1}) from same IP within 24h.`,
      };
    }
  }

  return { isFlagged: false };
}

export function resolvePublicOrigin(req: Request): string {
  const configured = (process.env.APP_URL || '').trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }
  const originHeader = req.get('origin');
  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/+$/, '');
  }
  const protoHeader = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const hostHeader = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
  return `${protoHeader}://${hostHeader}`;
}

export function createTxReference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function appendTransaction(
  transactions: StoredTransaction[],
  tx: Omit<StoredTransaction, 'id' | 'currency' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  }
): StoredTransaction {
  const record: StoredTransaction = {
    id: tx.id || `tx_${crypto.randomUUID()}`,
    userId: tx.userId,
    username: tx.username,
    transactionType: tx.transactionType,
    amount: Math.round((Number(tx.amount) || 0) * 100) / 100,
    currency: 'ETB',
    status: tx.status,
    referenceNumber: tx.referenceNumber,
    idempotencyKey: tx.idempotencyKey,
    note: tx.note,
    createdAt: tx.createdAt || new Date().toISOString(),
  };
  transactions.unshift(record);
  if (transactions.length > 1000) transactions.length = 1000;
  return record;
}

export function appendAuditLog(
  auditLogs: StoredAuditLog[],
  entry: Omit<StoredAuditLog, 'id' | 'timestamp'>
): StoredAuditLog {
  const log: StoredAuditLog = {
    id: `aud_${crypto.randomUUID()}`,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 1000) auditLogs.length = 1000;
  return log;
}

export function toCsvString(headers: string[], rows: Array<Array<unknown>>): string {
  const escapeCell = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escapeCell).join(',')];
  for (const r of rows) {
    lines.push(r.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

export function buildClientRewardRecord(r: StoredReferralReward): ReferralRewardRecord {
  return {
    id: r.id,
    agentId: r.agentId,
    agentUserId: r.agentUserId,
    agentUsername: r.agentUsername,
    referralId: r.referralId,
    referredUserId: r.referredUserId,
    referredUsername: r.referredUsername,
    rewardAmountEtb: r.rewardAmountEtb,
    rewardType: r.rewardType,
    rewardStatus: r.rewardStatus,
    rewardReference: r.rewardReference,
    policyNote: r.policyNote,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
    redeemedAt: r.redeemedAt,
    redemptionTxRef: r.redemptionTxRef,
  };
}

export function buildClientTransaction(t: StoredTransaction): PlatformTransaction {
  return {
    id: t.id,
    userId: t.userId,
    username: t.username,
    transactionType: t.transactionType,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    referenceNumber: t.referenceNumber,
    note: t.note,
    createdAt: t.createdAt,
  };
}

export function buildClientAuditLog(a: StoredAuditLog): AuditLogRecord {
  return { ...a };
}

export function buildClientSupportTicket(s: StoredSupportTicket): SupportTicketRecord {
  return { ...s };
}
