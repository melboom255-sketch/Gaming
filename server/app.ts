import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  cashoutKenoTicket,
  cashoutLiveBingo,
  claimLiveBingo,
  getBingoRoundDeck,
  getLiveRoundsSnapshot,
  lockBingoCards,
  lockKenoTicket,
  setLiveRoundOddsConfig,
  settleBingoHouseLoss,
  settleKenoTicket,
} from './liveRounds.ts';
import {
  generateAuthoritativeSlotSpin,
  generateBonusVaults,
  type GeneratedBonusVault,
  type SlotEngineType,
} from './slotsEngine.ts';
import {
  appendAuditLog,
  appendTransaction,
  buildClientAuditLog,
  buildClientRewardRecord,
  buildClientSupportTicket,
  buildClientTransaction,
  buildEncryptedAgentFinancials,
  buildReferralTree,
  collectDownstreamRelationships,
  createDefaultPlatformSettings,
  createTxReference,
  decryptAgentFinancialDetails,
  detectReferralFraud,
  evaluateAgentEligibility,
  generateUniqueAgentCode,
  hasAncestorCycle,
  normalizePhoneKey,
  normalizePlatformSettings,
  resolvePublicOrigin,
  sanitizeAgentProfile,
  toCsvString,
  type StoredAgentProfile,
  type StoredAuditLog,
  type StoredReferralRelationship,
  type StoredReferralReward,
  type StoredSupportTicket,
  type StoredTransaction,
} from './agentSystem.ts';
import type {
  AccountType,
  AgentProfile,
  GameEngine,
  GameProviderId,
  PlatformSettings,
  PlayerStatus,
  ReferralRelationship,
} from '../src/types/platform.ts';

let cachedRoundSeed = process.env.SESSION_SECRET || '';
let onLiveRoundMutated: (() => void) | null = null;

export function setLiveRoundBroadcastHook(fn: () => void): void {
  onLiveRoundMutated = fn;
}

export async function getActiveRoundSeed(): Promise<string> {
  if (cachedRoundSeed) return cachedRoundSeed;
  const db = await readDb();
  cachedRoundSeed = db.liveRoundSeed || db.sessionSecret;
  return cachedRoundSeed;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const IS_VERCEL = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const DATA_DIR = IS_VERCEL ? '/tmp/abyssinia-data' : path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'platform-db.json');

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const HAS_KV = Boolean(KV_URL && KV_TOKEN);
const KV_DB_KEY = 'abyssinia_games_db_v1';

function normalizeSupabaseUrl(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^(VITE_)?SUPABASE_(URL|JWKS_URL)\s*=\s*/i, '')
    .trim();
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
}

function normalizeSecretValue(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^SUPABASE_(SERVICE_ROLE|SECRET)_KEY\s*=\s*/i, '')
    .trim();
}

const SUPABASE_URL = normalizeSupabaseUrl(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
);
const SUPABASE_SECRET = normalizeSecretValue(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
);
const HAS_SUPABASE = Boolean(
  SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('your-project-id') &&
    SUPABASE_SECRET.length > 20
);
const SUPABASE_STATE_ID = 'main';
const supabaseAdmin = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_SECRET, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const MIN_STAKE_BIRR = 0.1;
export const MIN_DEPOSIT_BIRR = 5;
export const MIN_WITHDRAWAL_BIRR = 10;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function roundBirr(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function clampWinPercent(value: unknown, fallback = 30): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(95, Math.round(n)));
}

export interface StoredAgent {
  id: string;
  name: string;
  phone: string;
  note?: string;
  isActive: boolean;
  isPrimary: boolean;
}

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string;
  displayName: string;
  avatarId: string;
  role: 'player' | 'admin';
  accountType: AccountType;
  playerStatus: PlayerStatus;
  passwordHash: string;
  passwordSalt: string;
  balanceBirr: number;
  bonusBirrReceived: number;
  virtualPoints?: number; // Legacy field retained only for pre-v2 migration
  gamesPlayed: number;
  wins: number;
  bestStreak: number;
  highScores: {
    snake: number;
    trivia: number;
    memoryMoves: number;
  };
  isBanned: boolean;
  referredByCode?: string;
  referredByAgentId?: string;
  signupIp?: string;
  tokenVersion?: number;
  joinedAt: string;
}

export interface StoredGame {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'Slots' | 'Strategy' | 'Arcade' | 'Puzzle' | 'Trivia';
  difficulty: 'Casual' | 'Standard' | 'Challenging';
  minStakeBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
  maxMultiplier: number;
  cashoutEnabled: boolean;
  rewardPoints?: number; // Legacy v1 field
  estimatedMinutes: string;
  engine: GameEngine;
  thumbnailKey: GameEngine;
  providerId: GameProviderId;
  provider: string;
  providerTagline: string;
  isFeatured: boolean;
  isPopular: boolean;
  isActive: boolean;
  playCount: number;
}

export interface StoredSession {
  id: string;
  userId: string;
  gameSlug: string;
  gameTitle: string;
  score: number;
  stakeBirr: number;
  payoutBirr: number;
  bonusBirr: number;
  multiplier: number;
  pointsEarned?: number; // Legacy v1 field
  outcome: 'win' | 'draw' | 'cashed_out' | 'loss';
  playedAt: string;
}

export interface StoredActiveWager {
  id: string;
  userId: string;
  gameSlug: string;
  engine: StoredGame['engine'];
  stakeBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
  aiFavored: boolean;
  maxAllowedMultiplier: number;
  status: 'active' | 'cashed_out' | 'won' | 'draw' | 'lost' | 'cancelled';
  payoutBirr: number;
  createdAt: string;
  settledAt?: string;
}

export interface StoredChallenge {
  id: string;
  code: string;
  title: string;
  description: string;
  gameSlug: string;
  engine: StoredGame['engine'];
  targetValue: number;
  rewardBirr: number;
  rewardPoints?: number; // Legacy v1 field
  metricLabel: string;
}

export interface StoredChallengeProgress {
  challengeId: string;
  progressValue: number;
  isClaimed: boolean;
}

export interface StoredDeposit {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  amountEtb?: number;
  virtualPointsRequested?: number;
  agentId: string;
  agentName: string;
  agentPhone: string;
  telebirrReference?: string;
  senderPhone?: string;
  screenshotDataUrl?: string;
  screenshotFileName?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface StoredWithdrawal {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  pointsRequested?: number;
  amountEtb?: number;
  telebirrPhone: string;
  recipientName: string;
  payoutReference?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface StoredBonusGrant {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  reason: string;
  grantedBy: string;
  createdAt: string;
}

export interface StoredSlotFreeSpins {
  gameSlug: string;
  remaining: number;
  stakeBirr: number;
  multiplierBoost: number;
  totalWonBirr: number;
  spinsPlayed: number;
  source: 'bought' | 'midgame' | 'bonus_vault';
}

export interface StoredSlotBonusPick {
  id: string;
  userId: string;
  gameSlug: string;
  stakeBirr: number;
  maxPicks: number;
  pickedIndices: number[];
  vaults: GeneratedBonusVault[];
  status: 'active' | 'claimed';
  totalMultiplier: number;
  freeSpinsAwarded: number;
  payoutBirr: number;
  createdAt: string;
}

export interface PlatformDatabase {
  currencyVersion: number;
  sessionSecret: string;
  liveRoundSeed?: string;
  agents: StoredAgent[];
  users: StoredUser[];
  games: StoredGame[];
  sessions: StoredSession[];
  activeWagers: StoredActiveWager[];
  challenges: StoredChallenge[];
  challengeProgressByUser: Record<string, Record<string, StoredChallengeProgress>>;
  depositRequests: StoredDeposit[];
  withdrawalRequests: StoredWithdrawal[];
  bonusGrants: StoredBonusGrant[];
  freeSpinsByUser: Record<string, Record<string, StoredSlotFreeSpins>>;
  slotBonusGames: Record<string, StoredSlotBonusPick>;
  platformSettings: PlatformSettings;
  agentProfiles: StoredAgentProfile[];
  referralRelationships: StoredReferralRelationship[];
  referralRewards: StoredReferralReward[];
  transactions: StoredTransaction[];
  auditLogs: StoredAuditLog[];
  supportTickets: StoredSupportTicket[];
  idempotencyKeys: Record<string, number>;
}

const DEFAULT_AGENTS: StoredAgent[] = [
  {
    id: 'agent-kura',
    name: 'kura',
    phone: '0911626671',
    note: 'Primary Telebirr Deposit Agent',
    isActive: true,
    isPrimary: true,
  },
];

const SLOT_ENGINE_SET = new Set<string>([
  'abyssinia_megaways',
  'cosmic_megaways',
  'hot7spin',
  'fruitslot',
  'safari_spin',
  'pharaoh_spin',
  'candy_spin',
  'spy_mission_spin',
  'hot_inferno_777',
  'vikings_valhalla_spin',
  'dragon_fortune_spin',
  'wild_west_bounty',
  'pirate_treasure_megaways',
  'zeus_olympus_megaways',
  'neon_vegas_nights',
  'emerald_leprechaun_spin',
  'gladiator_arena_megaways',
  'sheba_crown_megaways',
  'lalibela_gold_megaways',
  'abay_nile_riches',
  'blazing_diamond_777',
  'tropical_berry_frenzy',
  'royal_gold_bullion',
  'ruby_starlight_777',
  'golden_bell_jackpot',
  'samurai_blade_megaways',
  'atlantis_kraken_megaways',
  'cyberpunk_matrix_megaways',
  'volcano_eruption_megaways',
  'valhalla_storm_megaways',
  'cyber_heist_spin',
  'outlaw_gold_train',
  'arabian_genie_spin',
  'aztec_sun_spin',
  'imperial_panda_spin',
]);

const PROVIDER_CATALOG: Record<
  GameProviderId,
  { providerId: GameProviderId; provider: string; providerTagline: string }
> = {
  axum_studios: {
    providerId: 'axum_studios',
    provider: 'Axum Studios',
    providerTagline: 'Highland Flagship Mechanics',
  },
  pragmatic_spin: {
    providerId: 'pragmatic_spin',
    provider: 'Pragmatic Spin',
    providerTagline: 'Multipliers & Blazing 777s',
  },
  megaways_labs: {
    providerId: 'megaways_labs',
    provider: 'Megaways Labs',
    providerTagline: 'Cascading Dynamic Reels',
  },
  hacksaw_vault: {
    providerId: 'hacksaw_vault',
    provider: 'Hacksaw Vault',
    providerTagline: 'High-Volatility Vault & Tactical Grids',
  },
  spribe_live: {
    providerId: 'spribe_live',
    provider: 'Spribe Live',
    providerTagline: 'Instant Crash & Reflex Arcade',
  },
  royal_table: {
    providerId: 'royal_table',
    provider: 'Royal Table Works',
    providerTagline: 'Heritage & Epic Adventures',
  },
};

const GAME_PROVIDER_BY_ENGINE: Record<GameEngine, GameProviderId> = {
  // Axum Studios (5 existing + 5 extra = 10)
  abyssinia_megaways: 'axum_studios',
  gebeta: 'axum_studios',
  keno: 'axum_studios',
  bingo: 'axum_studios',
  blackjack_21: 'axum_studios',
  sheba_crown_megaways: 'axum_studios',
  lalibela_gold_megaways: 'axum_studios',
  abay_nile_riches: 'axum_studios',
  royal_baccarat: 'axum_studios',
  hilo_card_streak: 'axum_studios',

  // Pragmatic Spin (6 existing + 5 extra = 11)
  fruitslot: 'pragmatic_spin',
  hot7spin: 'pragmatic_spin',
  hot_inferno_777: 'pragmatic_spin',
  candy_spin: 'pragmatic_spin',
  neon_vegas_nights: 'pragmatic_spin',
  emerald_leprechaun_spin: 'pragmatic_spin',
  blazing_diamond_777: 'pragmatic_spin',
  tropical_berry_frenzy: 'pragmatic_spin',
  royal_gold_bullion: 'pragmatic_spin',
  ruby_starlight_777: 'pragmatic_spin',
  golden_bell_jackpot: 'pragmatic_spin',

  // Megaways Labs (4 existing + 5 extra = 9)
  cosmic_megaways: 'megaways_labs',
  pirate_treasure_megaways: 'megaways_labs',
  zeus_olympus_megaways: 'megaways_labs',
  gladiator_arena_megaways: 'megaways_labs',
  samurai_blade_megaways: 'megaways_labs',
  atlantis_kraken_megaways: 'megaways_labs',
  cyberpunk_matrix_megaways: 'megaways_labs',
  volcano_eruption_megaways: 'megaways_labs',
  valhalla_storm_megaways: 'megaways_labs',

  // Hacksaw Vault (6 existing + 5 extra = 11)
  spy_mission_spin: 'hacksaw_vault',
  wild_west_bounty: 'hacksaw_vault',
  mines: 'hacksaw_vault',
  tower_climb: 'hacksaw_vault',
  plinko_drop: 'hacksaw_vault',
  dice_duel: 'hacksaw_vault',
  cyber_heist_spin: 'hacksaw_vault',
  outlaw_gold_train: 'hacksaw_vault',
  scratch_vault: 'hacksaw_vault',
  limbo_multiplier: 'hacksaw_vault',
  bomb_defusal: 'hacksaw_vault',

  // Spribe Live (6 existing + 5 extra = 11)
  crash_rocket: 'spribe_live',
  coin_flip_streak: 'spribe_live',
  penalty_kick: 'spribe_live',
  reaction_reflex: 'spribe_live',
  snake: 'spribe_live',
  color_wheel: 'spribe_live',
  aviator_jetx: 'spribe_live',
  cyber_limbo: 'spribe_live',
  blitz_hilo: 'spribe_live',
  dragon_tiger_live: 'spribe_live',
  rps_duel_streak: 'spribe_live',

  // Royal Table Works (8 existing + 5 extra = 13)
  safari_spin: 'royal_table',
  pharaoh_spin: 'royal_table',
  vikings_valhalla_spin: 'royal_table',
  dragon_fortune_spin: 'royal_table',
  tictactoe: 'royal_table',
  memory: 'royal_table',
  trivia: 'royal_table',
  word_scramble: 'royal_table',
  arabian_genie_spin: 'royal_table',
  aztec_sun_spin: 'royal_table',
  imperial_panda_spin: 'royal_table',
  european_roulette: 'royal_table',
  imperial_dragon_tiger: 'royal_table',
};

function getGameProviderMeta(engine: GameEngine) {
  const pid = GAME_PROVIDER_BY_ENGINE[engine] || 'axum_studios';
  return PROVIDER_CATALOG[pid];
}

type RawGameDefinition = Omit<StoredGame, 'providerId' | 'provider' | 'providerTagline'>;

const RAW_DEFAULT_GAMES: RawGameDefinition[] = [
  {
    id: 'game-axum-megaways',
    slug: 'axum-gold-megaways',
    title: 'Axum Gold Megaways',
    subtitle: '6-Reel Megaways up to 46,656 Ways + Cascading Multiplier Wins',
    description:
      'Dynamic 2–6 symbol reels unlock up to 46,656 Ways to Win! Trigger exploding cascades with +1x rising multipliers on every tumble up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'abyssinia_megaways',
    thumbnailKey: 'abyssinia_megaways',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-cosmic-megaways',
    slug: 'cosmic-gem-megaways',
    title: 'Cosmic Gem Megaways',
    subtitle: '5-Reel Crystal Megaways up to 3,125 Ways + Cascade Boosts',
    description:
      'Variable 2–5 row futuristic crystal reels deliver up to 3,125 Megaways to win, Nebula Wilds, and cascading crystal multipliers up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'cosmic_megaways',
    thumbnailKey: 'cosmic_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-hot7spin',
    slug: 'hot-7-spin-slots',
    title: 'Hot 7 Spin: Multiplier Slots',
    subtitle: '3×3 Hot 777 matching slots + 4th Hot Multiplier Reel (1x–7x)',
    description:
      'Stake from 10 Birr across 5 fiery paylines with BAR, Bell, Diamond, 7, 77 & 777 symbols plus a dedicated 4th Multiplier Reel boosting line wins up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'hot7spin',
    thumbnailKey: 'hot7spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-fruitslot',
    slug: 'highland-fruit-slot',
    title: 'Highland Fruit Slot',
    subtitle: '5-payline classic 3×3 fruit matching slot with standard multipliers',
    description:
      'Stake from 10 Birr on 5 classic paylines. Match 3 cherries, lemons, oranges, grapes, watermelons, bells, or wild stars for up to 12x instant Birr payouts.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 12,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'fruitslot',
    thumbnailKey: 'fruitslot',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-safari-spin',
    slug: 'serengeti-safari-spin',
    title: 'Serengeti Safari Spin',
    subtitle: '5×3 10-Payline Wildlife Spin Slot with Lion Wilds',
    description:
      'Spin 5 reels across 10 savannah paylines! Land 3 to 5 Tribal Shields, Zebras, Rhinos, Elephants, and Lion Crown Wilds for up to 20x returns.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 20,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'safari_spin',
    thumbnailKey: 'safari_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-pharaoh-spin',
    slug: 'pharaoh-scarab-spin',
    title: "Pharaoh's Scarab Spin",
    subtitle: '5×3 10-Payline Ancient Relic Spin Slot with Golden Scarabs',
    description:
      'Uncover 3–5 matching Nile Lotus, Ankh, Eye of Horus, Golden Scarab, Royal Sphinx, and Pharaoh Wilds across 10 royal paylines up to 22x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'pharaoh_spin',
    thumbnailKey: 'pharaoh_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-candy-spin',
    slug: 'sugar-rush-candy-spin',
    title: 'Sugar Rush Candy Spin',
    subtitle: '5×3 10-Payline Sweet Spin Slot with Rainbow Wild Bombs',
    description:
      'Line up Gummy Bears, Glazed Donuts, Sugar Stars, Cupcakes, Spiral Pops, and Rainbow Bomb Wilds across 10 candy paylines up to 20x.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 20,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'candy_spin',
    thumbnailKey: 'candy_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-spy-mission-spin',
    slug: 'agent-007-spy-spin',
    title: 'Agent 007: Spy Mission',
    subtitle: '5×3 Covert Casino Slot · Free Spins & Secret Vault Bonus',
    description:
      'Infiltrate the high-stakes Monte Carlo vault with Agent 007 Wilds, Stealth Coupes, and Laser Watches. Buy Free Spins or trigger the Secret Vault Pick Bonus mid-spin.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'spy_mission_spin',
    thumbnailKey: 'spy_mission_spin',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-hot-inferno-777',
    slug: 'hot-inferno-777',
    title: 'Hot Inferno 777 Spins',
    subtitle: '3×3 Molten 777 + 4th 7x Multiplier Reel & Bonus Vaults',
    description:
      'Blazing casino classic with Ruby Hearts, Bullion Ingots, Molten Bells, and 4th Multiplier Reel (1x–7x) plus Free Spins Buy and mid-game Inferno Bonus drops.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'hot_inferno_777',
    thumbnailKey: 'hot_inferno_777',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-pirate-treasure-megaways',
    slug: 'pirate-treasure-megaways',
    title: 'Pirate Treasure Megaways',
    subtitle: '6-Reel Up to 46,656 Ways + Tumbling Chest Bonus',
    description:
      'Sail high seas across 6 dynamic reels with exploding cascade wins, Corsair Wilds, Buy Free Spins, and Sunken Chest Pick Bonuses up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'pirate_treasure_megaways',
    thumbnailKey: 'pirate_treasure_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-zeus-olympus-megaways',
    slug: 'zeus-olympus-megaways',
    title: 'Zeus Olympus Megaways',
    subtitle: '6-Reel Lightning Megaways + Free Spins & Temple Vaults',
    description:
      'Summon Zeus Thunderbolt Wilds, Winged Pegasus, and Ambrosia Chalices across 6 cascading reels with mid-game Free Spins and Bonus Buy.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'zeus_olympus_megaways',
    thumbnailKey: 'zeus_olympus_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-vikings-valhalla-spin',
    slug: 'vikings-valhalla-spin',
    title: 'Vikings Valhalla Spin',
    subtitle: '5×3 10-Payline Norse Raid Slot + Free Spins & Loot Bonus',
    description:
      'Raid across 10 fiery paylines with Horned Helms, Thor Hammers, and Dragon Longships. Trigger Free Spins mid-spin or buy direct entry.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'vikings_valhalla_spin',
    thumbnailKey: 'vikings_valhalla_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-dragon-fortune-spin',
    slug: 'dragon-fortune-spin',
    title: 'Dragon Fortune Spin',
    subtitle: '5×3 Imperial Prosperity Slot + 2x Free Spins',
    description:
      'Line up Emperor Dragons, Jade Tigers, and Gold Sycees across 10 paylines with instant Bonus Buy and mid-game Dragon Vault bonuses.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 24,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'dragon_fortune_spin',
    thumbnailKey: 'dragon_fortune_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-wild-west-bounty',
    slug: 'wild-west-bounty',
    title: 'Wild West Bounty',
    subtitle: '5×3 Saloon Heist Slot + Vault Bonus & Free Spins',
    description:
      'Spin with Sheriff Star Wilds, Dual Colts, and TNT Bundles across 10 frontier paylines. Crack 3 of 6 Saloon Safes in the Pick Bonus.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'wild_west_bounty',
    thumbnailKey: 'wild_west_bounty',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-neon-vegas-nights',
    slug: 'neon-vegas-nights',
    title: 'Neon Vegas Nights',
    subtitle: '5×3 VIP Strip Casino Slot + 2x Free Spins & Vaults',
    description:
      'High-roller Vegas nightlife featuring Roulette Wheels, Royal Flushes, VIP Champagne, and VIP Wilds with Bonus Buy & mid-spin Free Spins.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 24,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'neon_vegas_nights',
    thumbnailKey: 'neon_vegas_nights',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-emerald-leprechaun-spin',
    slug: 'emerald-leprechaun-spin',
    title: 'Emerald Leprechaun Spin',
    subtitle: '5×3 Gold Pot Slot + Rainbow Free Spins & Bonus',
    description:
      'Chase Golden Harps, Four-Leaf Clovers, and overflowing Pots of Gold across 10 emerald paylines with mid-game Free Spin bursts.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'emerald_leprechaun_spin',
    thumbnailKey: 'emerald_leprechaun_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-gladiator-arena-megaways',
    slug: 'gladiator-arena-megaways',
    title: 'Gladiator Arena Megaways',
    subtitle: '5-Reel Roman Megaways + Cascading Shield Bonuses',
    description:
      'Step into the Colosseum with up to 3,125 Megaways, Centurion Helms, Imperial Eagles, Buy Free Spins, and Emperor Vault Bonus Games.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'gladiator_arena_megaways',
    thumbnailKey: 'gladiator_arena_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-tictactoe',
    slug: 'royal-tic-tac-toe',
    title: 'Axum Grid: Tic-Tac-Toe',
    subtitle: 'Tactical 3×3 duels in Birr with adaptive AI & early cashout',
    description:
      'Stake from 10 Birr against adaptive AI. Outsmart the grid for 1.9x returns or cash out cleanly before defeat.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 3,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'tictactoe',
    thumbnailKey: 'tictactoe',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-memory',
    slug: 'highland-memory-match',
    title: 'Lalibela Relics: Memory Match',
    subtitle: 'Uncover paired Ethiopian relics & cash out any streak',
    description:
      'Stake from 10 Birr and flip matched relic pairs to climb your live multiplier (+0.3x per pair). Cash out anytime before lives expire.',
    category: 'Puzzle',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 4,
    cashoutEnabled: true,
    estimatedMinutes: '2–4 min',
    engine: 'memory',
    thumbnailKey: 'memory',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-snake',
    slug: 'obsidian-serpent-snake',
    title: 'Obsidian Serpent: Snake',
    subtitle: 'Eat +0.5x, +2x & avoid -1x orbs · Cash out before failure',
    description:
      'Stake from 10 Birr and steer through glowing multiplier orbs (+0.5x, +2x, -1x). Click Cash Out at any moment before collision or zero multiplier.',
    category: 'Arcade',
    difficulty: 'Challenging',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 10,
    cashoutEnabled: true,
    estimatedMinutes: '2–5 min',
    engine: 'snake',
    thumbnailKey: 'snake',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-trivia',
    slug: 'abyssinia-scholar-trivia',
    title: 'Highland Scholar: Trivia Quiz',
    subtitle: 'Climb Birr multipliers per answer & cash out anytime',
    description:
      'Stake from 10 Birr across 8 timed heritage & science questions. Every correct answer raises your Birr cashout multiplier.',
    category: 'Trivia',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 5,
    cashoutEnabled: true,
    estimatedMinutes: '3–5 min',
    engine: 'trivia',
    thumbnailKey: 'trivia',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-gebeta',
    slug: 'gebeta-mancala',
    title: 'Gebeta: Royal Mancala',
    subtitle: 'Traditional Ethiopian seed-sowing duel with Birr cashout',
    description:
      'Stake from 10 Birr in classic 2-row Ethiopian Gebeta. Chain extra turns, lead the board to unlock mid-game cashout, or win 1.95x.',
    category: 'Strategy',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 3,
    cashoutEnabled: true,
    estimatedMinutes: '3–5 min',
    engine: 'gebeta',
    thumbnailKey: 'gebeta',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-mines',
    slug: 'simien-relic-sweep',
    title: 'Simien Sweep: Relic Hunt',
    subtitle: 'Reveal safe tiles for climbing multipliers & instant cashout',
    description:
      'Stake from 10 Birr and uncover safe highland relics while dodging hidden traps. Cash out your Birr multiplier anytime before hitting a mine.',
    category: 'Puzzle',
    difficulty: 'Challenging',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: true,
    estimatedMinutes: '2–5 min',
    engine: 'mines',
    thumbnailKey: 'mines',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-keno',
    slug: 'axum-keno-draw',
    title: 'Axum Keno: Number Draw',
    subtitle: 'Live synchronized Birr timer draw on numbers 1–40 with cashout',
    description:
      'Lock 1–10 lucky numbers with a Birr stake (10+ Birr) during the shared timer countdown. Cash out early once 1+ ball hits or ride the full 10-ball draw.',
    category: 'Arcade',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 6,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'keno',
    thumbnailKey: 'keno',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-bingo',
    slug: 'highland-bingo-75',
    title: 'Highland Bingo: 75-Ball',
    subtitle: 'Pick 1–4 cards in Birr, beat House AI or cash out early',
    description:
      'Choose 1 to 4 Bingo cards starting from 10 Birr per card during the 1-minute picker, race House AI to a 5-in-a-row Bingo, or cash out early on a 3/5+ line.',
    category: 'Strategy',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 5,
    cashoutEnabled: true,
    estimatedMinutes: '2–4 min',
    engine: 'bingo',
    thumbnailKey: 'bingo',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-dice-duel',
    slug: 'axum-dice-duel',
    title: 'Axum High-Low Dice Duel',
    subtitle: 'Predict High, Low, or Exact 7 · Chain rolls & Cash Out anytime',
    description:
      'Stake from 10 Birr and duel the crimson & gold casino dice. Call High (8–12), Low (2–6), or Lucky 7 to build a streak multiplier or Cash Out anytime.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'dice_duel',
    thumbnailKey: 'dice_duel',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-crash-rocket',
    slug: 'abyssinia-sky-crash',
    title: 'Abyssinia Sky Crash',
    subtitle: 'Live climbing multiplier rocket · Cash Out before detonation',
    description:
      'Launch into the highlands sky from 10 Birr. Watch the live trajectory climb from 1.00x upward and hit Cash Out before the engine crashes.',
    category: 'Arcade',
    difficulty: 'Challenging',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 15,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'crash_rocket',
    thumbnailKey: 'crash_rocket',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-plinko-drop',
    slug: 'gold-vault-plinko',
    title: 'Gold Vault Plinko',
    subtitle: 'Drop golden orbs through brass pegs · Low/Med/High Cash Out',
    description:
      'Release glowing gold balls down an 8-row precision peg pyramid. Accumulate multipliers across drops and Cash Out your vault total anytime.',
    category: 'Arcade',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 12,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'plinko_drop',
    thumbnailKey: 'plinko_drop',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-tower-climb',
    slug: 'lalibela-tower-climb',
    title: 'Lalibela Tower Climb',
    subtitle: 'Pick safe stone doors across 8 floors · Cash Out every step',
    description:
      'Ascend 8 carved monolith floors choosing 1 of 3 stone portals each level. Every safe passage boosts your Birr multiplier—Cash Out before hitting a trap.',
    category: 'Puzzle',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 10,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'tower_climb',
    thumbnailKey: 'tower_climb',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-coin-flip-streak',
    slug: 'imperial-lion-coin-flip',
    title: 'Imperial Lion Coin Flip',
    subtitle: 'Chain Heads or Tails flips up to 12x · Cash Out any flip',
    description:
      'Call Lion (Heads) or Crown (Tails) on a minted gold Ethiopian coin. Each consecutive call climbs your multiplier toward 12x with instant Cash Out.',
    category: 'Arcade',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 12,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'coin_flip_streak',
    thumbnailKey: 'coin_flip_streak',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-penalty-kick',
    slug: 'addis-stadium-penalty',
    title: 'Addis Stadium Penalty',
    subtitle: '5-shot football shootout vs AI Keeper · Cash Out after any goal',
    description:
      'Aim Top-Left, Top-Right, Center, Low-Left, or Low-Right past the diving goalkeeper. Every goal raises your Birr payout—Cash Out anytime.',
    category: 'Arcade',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'penalty_kick',
    thumbnailKey: 'penalty_kick',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-color-wheel',
    slug: 'royal-fortune-wheel',
    title: 'Royal Fortune Wheel',
    subtitle: 'Pick Gold, Emerald, Crimson or Sapphire · Cash Out streaks',
    description:
      'Place your Birr round on your color wedge and spin the gilded Monte Carlo wheel. Chain winning spins up to 10x or Cash Out whenever ahead.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 10,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'color_wheel',
    thumbnailKey: 'color_wheel',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-word-scramble',
    slug: 'scholar-word-cipher',
    title: 'Scholar Word Cipher',
    subtitle: 'Unscramble timed cipher words · Climb multiplier & Cash Out',
    description:
      'Decode scrambled heritage & strategy words against the clock. Each solved cipher adds to your Birr multiplier before time runs out.',
    category: 'Trivia',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 6,
    cashoutEnabled: true,
    estimatedMinutes: '2–3 min',
    engine: 'word_scramble',
    thumbnailKey: 'word_scramble',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-reaction-reflex',
    slug: 'lightning-reflex-grid',
    title: 'Lightning Reflex Grid',
    subtitle: 'Hit neon target pads under strict timer · Cash Out high streaks',
    description:
      'Test pure arcade speed across a 4×4 illuminated reflex pad matrix. Strike targets cleanly to build your multiplier or Cash Out before a miss.',
    category: 'Arcade',
    difficulty: 'Challenging',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'reaction_reflex',
    thumbnailKey: 'reaction_reflex',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-blackjack-21',
    slug: 'monte-carlo-blackjack-21',
    title: 'Monte Carlo Blackjack 21',
    subtitle: 'Hit, Stand, Double Down or Early Cash Out vs Casino Dealer',
    description:
      'Play authentic 21 on velvet baize from 10 Birr. Hit 21 for 2.5x Blackjack, Double Down on strong hands, or take Early Surrender Cash Out anytime.',
    category: 'Strategy',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 3.5,
    cashoutEnabled: true,
    estimatedMinutes: '2–4 min',
    engine: 'blackjack_21',
    thumbnailKey: 'blackjack_21',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  // === 5 EXTRA GAMES PER PROVIDER (30 NEW GAMES) ===
  // 1. Axum Studios (+5)
  {
    id: 'game-sheba-crown-megaways',
    slug: 'sheba-crown-megaways',
    title: 'Queen of Sheba Megaways',
    subtitle: '6-Reel Royal Megaways · 46,656 Ways + Free Spins & Vault Bonus',
    description: 'Command 6 dynamic royal reels with Sabaean crowns, golden obelisks, and cascading rising multipliers up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'sheba_crown_megaways',
    thumbnailKey: 'sheba_crown_megaways',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-lalibela-gold-megaways',
    slug: 'lalibela-gold-megaways',
    title: 'Lalibela Gold Megaways',
    subtitle: '5-Reel Monolith Megaways · Expanding Gold Cascades & Free Spins',
    description: 'Carved stone obelisks, amber gems, and Axum Wilds tumble through up to 3,125 ways with Bonus Buy & Pick Bonus.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'lalibela_gold_megaways',
    thumbnailKey: 'lalibela_gold_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-abay-nile-riches',
    slug: 'abay-nile-riches',
    title: 'Blue Nile: Abay Riches',
    subtitle: '5×3 10-Payline Relic Slot · Free Spins & Treasure Pick Bonus',
    description: 'Sail the sacred Blue Nile across 10 royal paylines lined with Lotus blooms, Ankhs, Scarabs, and Golden Wilds.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'abay_nile_riches',
    thumbnailKey: 'abay_nile_riches',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-royal-baccarat',
    slug: 'axum-royal-baccarat',
    title: 'Axum Royal Baccarat',
    subtitle: 'Punto Banco Table · Player (2x), Banker (1.95x) & Tie (8x)',
    description: 'High-stakes emerald felt Baccarat with authentic 3rd-card drawing rules, Bead Road history, and instant ETB payouts.',
    category: 'Strategy',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'royal_baccarat',
    thumbnailKey: 'royal_baccarat',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-hilo-card-streak',
    slug: 'highland-hilo-streak',
    title: 'Highland Hi-Lo Streak',
    subtitle: 'Predict Higher or Lower Card-by-Card & Cash Out Up to 20x',
    description: 'Climb dynamic card-rank odds with every accurate Higher or Lower call and lock your Birr profit anytime.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 20,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'hilo_card_streak',
    thumbnailKey: 'hilo_card_streak',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  // 2. Pragmatic Spin (+5)
  {
    id: 'game-blazing-diamond-777',
    slug: 'blazing-diamond-777',
    title: 'Blazing Diamond 777',
    subtitle: '3×3 Vegas Reels + 4th 7x Multiplier Reel & Bonus Spins',
    description: 'Cut diamonds, triple 777s, and blazing gold bars ignite across 5 classic paylines with a dedicated multiplier wheel.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'blazing_diamond_777',
    thumbnailKey: 'blazing_diamond_777',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-tropical-berry-frenzy',
    slug: 'tropical-berry-frenzy',
    title: 'Tropical Berry Frenzy',
    subtitle: '5×3 10-Payline Fruit Fiesta · Free Spins & Wild Multipliers',
    description: 'Juicy watermelons, citrus bursts, and golden stars cascade across 5 vibrant reels with Bonus Buy free games.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 20,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'tropical_berry_frenzy',
    thumbnailKey: 'tropical_berry_frenzy',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-royal-gold-bullion',
    slug: 'royal-gold-bullion',
    title: 'Royal Gold Bullion',
    subtitle: '5×3 Sovereign Vault Slot · Stacked Bullion Bars & Bonus Vault',
    description: 'Heavy gold ingots, chalices, and VIP wilds lock across 10 bullion lines with mid-spin Vault Bonus triggers.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'royal_gold_bullion',
    thumbnailKey: 'royal_gold_bullion',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-ruby-starlight-777',
    slug: 'ruby-starlight-777',
    title: 'Ruby Starlight 777',
    subtitle: '3×3 Neon Ruby 7s + 4th Multiplier Reel Up to 25x',
    description: 'Gem-cut rubies, champagne wilds, and triple 7s shine across 5 neon paylines with Bonus Buy free spins.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'ruby_starlight_777',
    thumbnailKey: 'ruby_starlight_777',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-golden-bell-jackpot',
    slug: 'golden-bell-jackpot',
    title: 'Golden Bell Jackpot',
    subtitle: '3×3 Heritage Bell Slot · Free Spins & Classic Jackpot Tiers',
    description: 'Crisp molten bells, lucky clovers, and blazing 777 symbols deliver fast classic spins with Bonus Pick rounds.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 15,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'golden_bell_jackpot',
    thumbnailKey: 'golden_bell_jackpot',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  // 3. Megaways Labs (+5)
  {
    id: 'game-samurai-blade-megaways',
    slug: 'samurai-blade-megaways',
    title: 'Samurai Blade Megaways',
    subtitle: '6-Reel Eastern Megaways · 46,656 Ways & Dragon Cascades',
    description: 'Jade tigers, golden koi, and Dragon Wilds slash through 6 dynamic reels with escalating tumble multipliers.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'samurai_blade_megaways',
    thumbnailKey: 'samurai_blade_megaways',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-atlantis-kraken-megaways',
    slug: 'atlantis-kraken-megaways',
    title: 'Atlantis Kraken Megaways',
    subtitle: '6-Reel Sunken Vault Megaways · 46,656 Ways & Free Spins',
    description: 'Deep-sea treasure chests, brass compasses, and Kraken cascades surge with rising multipliers up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'atlantis_kraken_megaways',
    thumbnailKey: 'atlantis_kraken_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-cyberpunk-matrix-megaways',
    slug: 'cyberpunk-matrix-megaways',
    title: 'Cyberpunk Matrix Megaways',
    subtitle: '5-Reel Neon Cyber Megaways · 3,125 Ways & Plasma Wilds',
    description: 'Plasma orbs, lightning rings, and Nebula Wilds overdrive up to 3,125 neon ways with Bonus Buy free spins.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'cyberpunk_matrix_megaways',
    thumbnailKey: 'cyberpunk_matrix_megaways',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-volcano-eruption-megaways',
    slug: 'volcano-eruption-megaways',
    title: 'Volcano Eruption Megaways',
    subtitle: '6-Reel Magma Megaways · 46,656 Ways & Inferno Multipliers',
    description: 'Molten bells, flame dice, and Inferno Wilds erupt into chain-reaction cascades with rising multipliers up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'volcano_eruption_megaways',
    thumbnailKey: 'volcano_eruption_megaways',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-valhalla-storm-megaways',
    slug: 'valhalla-storm-megaways',
    title: 'Valhalla Storm Megaways',
    subtitle: '5-Reel Nordic Storm Megaways · 3,125 Ways & Thor Wilds',
    description: 'Thor hammers, runestones, and Viking longships clash across 5 dynamic Megaways reels up to 25x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'valhalla_storm_megaways',
    thumbnailKey: 'valhalla_storm_megaways',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  // 4. Hacksaw Vault (+5)
  {
    id: 'game-cyber-heist-spin',
    slug: 'cyber-heist-spin',
    title: 'Cyber Heist: Vault Zero',
    subtitle: '5×3 Tactical Heist Slot · Bonus Buy Free Spins & Vault Pick',
    description: 'Crack biometric briefcases, plasma drives, and covert VIP wilds across 10 high-volatility vault paylines.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'cyber_heist_spin',
    thumbnailKey: 'cyber_heist_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-outlaw-gold-train',
    slug: 'outlaw-gold-train',
    title: 'Outlaw Gold Express',
    subtitle: '5×3 Frontier Heist Slot · Dynamite Multipliers & Free Spins',
    description: 'Detonate armored bullion cars stacked with gold bars, revolvers, and Sheriff Wilds across 10 frontier paylines.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'outlaw_gold_train',
    thumbnailKey: 'outlaw_gold_train',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-scratch-vault',
    slug: 'gold-vault-scratch',
    title: 'Gold Vault Scratch',
    subtitle: '3×3 Foil Scratch Card · Uncover Gems & Crowns Up to 15x',
    description: 'Scratch metallic vault panels one by one to stack Gems and Royal Crowns—Cash Out after 2 safe reveals anytime.',
    category: 'Puzzle',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 15,
    cashoutEnabled: true,
    estimatedMinutes: '1 min',
    engine: 'scratch_vault',
    thumbnailKey: 'scratch_vault',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-limbo-multiplier',
    slug: 'vault-limbo-target',
    title: 'Vault Limbo Target',
    subtitle: 'Dial Your Target Multiplier (1.1x–25x) & Beat the Instant Roll',
    description: 'Pure high-precision probability: choose any target from 1.10x to 25.00x and win instantly when the roll clears your line.',
    category: 'Arcade',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: false,
    estimatedMinutes: '30 sec',
    engine: 'limbo_multiplier',
    thumbnailKey: 'limbo_multiplier',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-bomb-defusal',
    slug: 'tactical-bomb-defusal',
    title: 'Tactical Bomb Defusal',
    subtitle: 'Cut Safe Circuit Wires Step-by-Step · Cash Out Up to 10x',
    description: 'One hidden wire arms the detonator. Snip safe thermal & logic circuits to climb the multiplier ladder and Cash Out.',
    category: 'Puzzle',
    difficulty: 'Challenging',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 10,
    cashoutEnabled: true,
    estimatedMinutes: '1–2 min',
    engine: 'bomb_defusal',
    thumbnailKey: 'bomb_defusal',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  // 5. Spribe Live (+5)
  {
    id: 'game-aviator-jetx',
    slug: 'supersonic-aviator-jetx',
    title: 'Supersonic Aviator JetX',
    subtitle: 'Live Jet Multiplier Crash · Eject Before Flameout Up to 25x',
    description: 'Watch the telemetry curve accelerate in real time from 1.00x upward—lock your instant Birr payout before jet flameout.',
    category: 'Arcade',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: true,
    estimatedMinutes: '30 sec',
    engine: 'aviator_jetx',
    thumbnailKey: 'aviator_jetx',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-cyber-limbo',
    slug: 'spribe-cyber-limbo',
    title: 'Cyber Limbo Turbo',
    subtitle: 'Instant Neon Target Multiplier Roll Up to 25x',
    description: 'Set custom risk from ultra-safe 1.25x scalps to 25x moonshots with instant cryptographic roll resolution.',
    category: 'Arcade',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 25,
    cashoutEnabled: false,
    estimatedMinutes: '30 sec',
    engine: 'cyber_limbo',
    thumbnailKey: 'cyber_limbo',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-blitz-hilo',
    slug: 'spribe-blitz-hilo',
    title: 'Blitz Hi-Lo Live',
    subtitle: 'Rapid-Fire Higher/Lower Card Ladder · Cash Out Any Step',
    description: 'Fast arcade card-streak action with transparent odds per card rank and instant Birr Cash Out.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 20,
    cashoutEnabled: true,
    estimatedMinutes: '1 min',
    engine: 'blitz_hilo',
    thumbnailKey: 'blitz_hilo',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-dragon-tiger-live',
    slug: 'spribe-dragon-tiger-live',
    title: 'Dragon vs Tiger Live',
    subtitle: '1-Card Arena Showdown · Dragon (2x), Tiger (2x), Tie (8x)',
    description: 'Two cards dealt face-up—highest rank wins instantly. Tie returns 50% on main bets or pays 8x on Tie side bets.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: false,
    estimatedMinutes: '30 sec',
    engine: 'dragon_tiger_live',
    thumbnailKey: 'dragon_tiger_live',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-rps-duel-streak',
    slug: 'arena-rps-duel-streak',
    title: 'RPS Duel Multiplier',
    subtitle: 'Rock Paper Scissors Win Streak · 1.9x to 10x + Cash Out',
    description: 'Outread the Arena AI across Rock, Paper, Scissors clashes—each win climbs your multiplier up to 10x.',
    category: 'Arcade',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 10,
    cashoutEnabled: true,
    estimatedMinutes: '1 min',
    engine: 'rps_duel_streak',
    thumbnailKey: 'rps_duel_streak',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  // 6. Royal Table Works (+5)
  {
    id: 'game-arabian-genie-spin',
    slug: 'arabian-genie-palace-spin',
    title: 'Arabian Genie Palace',
    subtitle: '5×3 10-Payline Mystic Slot · Free Spins & Lamp Bonus',
    description: 'Emerald scarabs, golden chalices, and Royal Wilds illuminate desert palace paylines with Bonus Buy free games.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'arabian_genie_spin',
    thumbnailKey: 'arabian_genie_spin',
    isFeatured: false,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-aztec-sun-spin',
    slug: 'aztec-sun-temple-spin',
    title: 'Aztec Sun Temple',
    subtitle: '5×3 10-Payline Temple Slot · Sun Bonus & Free Spins',
    description: 'Carved obelisks, amber sunstones, and tribal shields align across 10 temple paylines up to 24x.',
    category: 'Slots',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 24,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'aztec_sun_spin',
    thumbnailKey: 'aztec_sun_spin',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-imperial-panda-spin',
    slug: 'imperial-bamboo-panda-spin',
    title: 'Imperial Fortune Lanterns',
    subtitle: '5×3 10-Payline Eastern Slot · Jade Sycee & Free Spins',
    description: 'Crimson lanterns, jade tigers, and gold sycees grant blessed payline streaks with Bonus Buy free spins.',
    category: 'Slots',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 22,
    cashoutEnabled: true,
    estimatedMinutes: '1–3 min',
    engine: 'imperial_panda_spin',
    thumbnailKey: 'imperial_panda_spin',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-european-roulette',
    slug: 'royal-european-roulette',
    title: 'Royal European Roulette',
    subtitle: 'Single-Zero Wheel · Red/Black (2x), Dozens (3x) & Zero (18x)',
    description: 'Classic European 0–36 velvet roulette board with live spin history, outside dozens, and Lucky 7 straight payouts.',
    category: 'Strategy',
    difficulty: 'Standard',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 18,
    cashoutEnabled: false,
    estimatedMinutes: '1–2 min',
    engine: 'european_roulette',
    thumbnailKey: 'european_roulette',
    isFeatured: true,
    isPopular: true,
    isActive: true,
    playCount: 0,
  },
  {
    id: 'game-imperial-dragon-tiger',
    slug: 'imperial-dragon-tiger',
    title: 'Imperial Dragon Tiger',
    subtitle: 'Royal 1-Card Showdown · Dragon (2x), Tiger (2x) & Tie (8x)',
    description: 'Heritage palace high-card duel featuring instant settlements and 8x Tie jackpots from 0.10 ETB.',
    category: 'Strategy',
    difficulty: 'Casual',
    minStakeBirr: 0.1,
    playerWinPercent: 30,
    bonusBirr: 0,
    maxMultiplier: 8,
    cashoutEnabled: false,
    estimatedMinutes: '30 sec',
    engine: 'imperial_dragon_tiger',
    thumbnailKey: 'imperial_dragon_tiger',
    isFeatured: false,
    isPopular: false,
    isActive: true,
    playCount: 0,
  },
];

const DEFAULT_GAMES: StoredGame[] = RAW_DEFAULT_GAMES.map((g) => ({
  ...g,
  ...getGameProviderMeta(g.engine),
}));

const DEFAULT_CHALLENGES: StoredChallenge[] = [
  {
    id: 'chal-ttt-wins',
    code: 'TTT_DOUBLE_WIN',
    title: 'Tactical Strategist',
    description: 'Win 2 rounds in Axum Grid: Tic-Tac-Toe.',
    gameSlug: 'royal-tic-tac-toe',
    engine: 'tictactoe',
    targetValue: 2,
    rewardBirr: 8,
    metricLabel: 'AI Wins',
  },
  {
    id: 'chal-snake-score',
    code: 'SNAKE_CENTURY',
    title: 'Golden Orb Hunter',
    description: 'Reach a score of 100 or higher in a single Snake run.',
    gameSlug: 'obsidian-serpent-snake',
    engine: 'snake',
    targetValue: 100,
    rewardBirr: 12,
    metricLabel: 'Best Run Score',
  },
  {
    id: 'chal-memory-clear',
    code: 'MEMORY_CLEARS',
    title: 'Keeper of Relics',
    description: 'Complete or cash out 1 match in Lalibela Relics: Memory Match.',
    gameSlug: 'highland-memory-match',
    engine: 'memory',
    targetValue: 1,
    rewardBirr: 6,
    metricLabel: 'Boards Completed',
  },
  {
    id: 'chal-trivia-correct',
    code: 'TRIVIA_SCHOLAR',
    title: 'Scholar of the Highlands',
    description: 'Answer 6 Trivia Quiz questions correctly across rounds.',
    gameSlug: 'abyssinia-scholar-trivia',
    engine: 'trivia',
    targetValue: 6,
    rewardBirr: 10,
    metricLabel: 'Correct Answers',
  },
  {
    id: 'chal-gebeta-win',
    code: 'GEBETA_VICTORY',
    title: 'Master of Gebeta',
    description: 'Win 1 full match in Gebeta: Royal Mancala.',
    gameSlug: 'gebeta-mancala',
    engine: 'gebeta',
    targetValue: 1,
    rewardBirr: 7,
    metricLabel: 'Matches Won',
  },
  {
    id: 'chal-mines-clear',
    code: 'MINES_CLEAR',
    title: 'Simien Pathfinder',
    description: 'Clear a full Relic Hunt board in Simien Sweep without hitting a trap.',
    gameSlug: 'simien-relic-sweep',
    engine: 'mines',
    targetValue: 1,
    rewardBirr: 8.5,
    metricLabel: 'Boards Cleared',
  },
];

function ensureStorageReady(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function createEmptyDb(): PlatformDatabase {
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  return {
    currencyVersion: 5,
    sessionSecret: secret,
    liveRoundSeed: crypto.randomBytes(32).toString('hex'),
    agents: DEFAULT_AGENTS.map((a) => ({ ...a })),
    users: [],
    games: DEFAULT_GAMES.map((g) => ({ ...g })),
    sessions: [],
    activeWagers: [],
    challenges: DEFAULT_CHALLENGES.map((c) => ({ ...c })),
    challengeProgressByUser: {},
    depositRequests: [],
    withdrawalRequests: [],
    bonusGrants: [],
    freeSpinsByUser: {},
    slotBonusGames: {},
    platformSettings: createDefaultPlatformSettings(),
    agentProfiles: [],
    referralRelationships: [],
    referralRewards: [],
    transactions: [],
    auditLogs: [],
    supportTickets: [],
    idempotencyKeys: {},
  };
}

function normalizeDb(parsed: Partial<PlatformDatabase> | null): PlatformDatabase {
  if (!parsed) return createEmptyDb();
  const prevVersion = parsed.currencyVersion ?? 1;
  const isV2 = prevVersion >= 2;
  const isV3 = prevVersion >= 3;
  const isV4 = prevVersion >= 4;
  const isV5 = prevVersion >= 5;

  const platformSettings = normalizePlatformSettings(parsed.platformSettings);

  const existingGamesRaw =
    Array.isArray(parsed.games) && parsed.games.length > 0
      ? [...parsed.games]
      : DEFAULT_GAMES.map((g) => ({ ...g }));

  const defByEngine = new Map(DEFAULT_GAMES.map((g) => [g.engine, g]));
  const games: StoredGame[] = existingGamesRaw.map((raw) => {
    const def = defByEngine.get(raw.engine) || DEFAULT_GAMES[0];
    const isSlot = SLOT_ENGINE_SET.has(raw.engine);
    const rawStake = Number(raw.minStakeBirr);
    const migratedStake =
      !isV5 && rawStake === 10
        ? platformSettings.defaultMinStakeEtb
        : Math.max(MIN_STAKE_BIRR, roundBirr(rawStake || def.minStakeBirr));
    return {
      id: raw.id || def.id,
      slug: raw.slug || def.slug,
      title: raw.title || def.title,
      subtitle:
        isV3 && raw.subtitle && !raw.subtitle.includes('AI odds')
          ? raw.subtitle
          : def.subtitle,
      description:
        isV3 && raw.description && !raw.description.includes('house odds')
          ? raw.description
          : def.description,
      category: !isV4 && isSlot ? 'Slots' : raw.category || def.category,
      difficulty: raw.difficulty || def.difficulty,
      minStakeBirr: migratedStake,
      playerWinPercent: clampWinPercent(raw.playerWinPercent, def.playerWinPercent),
      bonusBirr: Math.max(0, roundBirr(Number(raw.bonusBirr) || 0)),
      maxMultiplier: Math.max(1.5, Number(raw.maxMultiplier) || def.maxMultiplier),
      cashoutEnabled: isV3 && typeof raw.cashoutEnabled === 'boolean'
        ? raw.cashoutEnabled
        : def.cashoutEnabled,
      estimatedMinutes: raw.estimatedMinutes || def.estimatedMinutes,
      engine: raw.engine || def.engine,
      thumbnailKey: raw.thumbnailKey || def.thumbnailKey,
      ...getGameProviderMeta((raw.engine || def.engine) as GameEngine),
      isFeatured:
        !isV4 && raw.engine === 'tictactoe'
          ? false
          : typeof raw.isFeatured === 'boolean'
            ? raw.isFeatured
            : def.isFeatured,
      isPopular: typeof raw.isPopular === 'boolean' ? raw.isPopular : def.isPopular,
      isActive: typeof raw.isActive === 'boolean' ? raw.isActive : def.isActive,
      playCount: Math.max(0, Math.round(Number(raw.playCount) || 0)),
    };
  });

  const existingIds = new Set(games.map((g) => g.id));
  const existingSlugs = new Set(games.map((g) => g.slug));
  for (const def of DEFAULT_GAMES) {
    if (!existingIds.has(def.id) && !existingSlugs.has(def.slug)) {
      games.push({ ...def });
    }
  }

  // Always order Slot & Megaways games to the very front of the catalog
  const orderIndex = new Map(DEFAULT_GAMES.map((g, i) => [g.engine, i]));
  games.sort((a, b) => {
    const aSlot = SLOT_ENGINE_SET.has(a.engine) ? 0 : 1;
    const bSlot = SLOT_ENGINE_SET.has(b.engine) ? 0 : 1;
    if (aSlot !== bSlot) return aSlot - bSlot;
    return (orderIndex.get(a.engine) ?? 99) - (orderIndex.get(b.engine) ?? 99);
  });

  const agentProfiles: StoredAgentProfile[] = Array.isArray(parsed.agentProfiles)
    ? parsed.agentProfiles.map((ap) => ({ ...ap }))
    : [];
  const approvedAgentUserIds = new Set(
    agentProfiles
      .filter((a) => a.applicationStatus === 'approved')
      .map((a) => a.userId)
  );

  const users: StoredUser[] = Array.isArray(parsed.users)
    ? parsed.users.map((u) => {
        const hasBirr = typeof u.balanceBirr === 'number' && Number.isFinite(u.balanceBirr);
        const migratedBalance = isV2 && hasBirr
          ? roundBirr(Math.max(0, u.balanceBirr))
          : hasBirr
            ? roundBirr(Math.max(0, u.balanceBirr))
            : roundBirr(Math.max(0, Number(u.virtualPoints || 0) / 10));
        const role: 'player' | 'admin' = u.role === 'admin' ? 'admin' : 'player';
        const accountType: AccountType =
          role === 'admin'
            ? 'admin'
            : approvedAgentUserIds.has(u.id)
              ? 'agent'
              : u.accountType === 'agent' && approvedAgentUserIds.has(u.id)
                ? 'agent'
                : 'player';
        const playerStatus: PlayerStatus = u.isBanned
          ? 'suspended'
          : u.playerStatus === 'suspended'
            ? 'suspended'
            : 'active';
        return {
          id: u.id,
          email: u.email,
          username: u.username,
          fullName: (u.fullName || u.displayName || u.username || '').trim(),
          phone: (u.phone || '').trim(),
          displayName: u.displayName || u.fullName || u.username,
          avatarId: u.avatarId || 'lion',
          role,
          accountType,
          playerStatus,
          passwordHash: u.passwordHash,
          passwordSalt: u.passwordSalt,
          balanceBirr: migratedBalance,
          bonusBirrReceived: Math.max(0, roundBirr(Number(u.bonusBirrReceived) || 0)),
          gamesPlayed: Math.max(0, Number(u.gamesPlayed) || 0),
          wins: Math.max(0, Number(u.wins) || 0),
          bestStreak: Math.max(0, Number(u.bestStreak) || 0),
          highScores: u.highScores || { snake: 0, trivia: 0, memoryMoves: 0 },
          isBanned: Boolean(u.isBanned),
          referredByCode: u.referredByCode,
          referredByAgentId: u.referredByAgentId,
          signupIp: u.signupIp,
          tokenVersion: typeof u.tokenVersion === 'number' && u.tokenVersion >= 1 ? u.tokenVersion : 1,
          joinedAt: u.joinedAt || new Date().toISOString(),
        };
      })
    : [];

  const challenges: StoredChallenge[] =
    Array.isArray(parsed.challenges) && parsed.challenges.length > 0
      ? parsed.challenges.map((c) => {
          const def = DEFAULT_CHALLENGES.find((d) => d.id === c.id || d.code === c.code);
          const rewardBirr =
            typeof c.rewardBirr === 'number' && Number.isFinite(c.rewardBirr)
              ? roundBirr(c.rewardBirr)
              : def?.rewardBirr ?? Math.max(5, roundBirr(Number(c.rewardPoints || 50) / 10));
          return {
            id: c.id,
            code: c.code,
            title: c.title,
            description: isV2 ? c.description : def?.description || c.description,
            gameSlug: c.gameSlug || def?.gameSlug || 'royal-tic-tac-toe',
            engine: c.engine || def?.engine || 'tictactoe',
            targetValue: Math.max(1, Number(c.targetValue) || def?.targetValue || 1),
            rewardBirr,
            metricLabel: c.metricLabel || def?.metricLabel || 'Wins',
          };
        })
      : DEFAULT_CHALLENGES.map((c) => ({ ...c }));

  for (const def of DEFAULT_CHALLENGES) {
    if (!challenges.some((c) => c.code === def.code || c.id === def.id)) {
      challenges.push({ ...def });
    }
  }

  const depositRequests: StoredDeposit[] = Array.isArray(parsed.depositRequests)
    ? parsed.depositRequests.map((d) => ({
        id: d.id,
        userId: d.userId,
        username: d.username,
        amountBirr:
          typeof d.amountBirr === 'number' && Number.isFinite(d.amountBirr)
            ? roundBirr(d.amountBirr)
            : roundBirr(Number(d.amountEtb || 0)),
        agentId: d.agentId || 'agent-kura',
        agentName: d.agentName || 'kura',
        agentPhone: d.agentPhone || '0911626671',
        telebirrReference: d.telebirrReference,
        senderPhone: d.senderPhone,
        screenshotDataUrl: d.screenshotDataUrl,
        screenshotFileName: d.screenshotFileName,
        status: d.status,
        adminNote: d.adminNote,
        createdAt: d.createdAt,
        reviewedAt: d.reviewedAt,
      }))
    : [];

  const withdrawalRequests: StoredWithdrawal[] = Array.isArray(parsed.withdrawalRequests)
    ? parsed.withdrawalRequests.map((w) => ({
        id: w.id,
        userId: w.userId,
        username: w.username,
        amountBirr:
          typeof w.amountBirr === 'number' && Number.isFinite(w.amountBirr)
            ? roundBirr(w.amountBirr)
            : roundBirr(Number(w.amountEtb || Number(w.pointsRequested || 0) / 10)),
        telebirrPhone: w.telebirrPhone,
        recipientName: w.recipientName,
        payoutReference: w.payoutReference,
        status: w.status,
        adminNote: w.adminNote,
        createdAt: w.createdAt,
        reviewedAt: w.reviewedAt,
      }))
    : [];

  const sessions: StoredSession[] = Array.isArray(parsed.sessions)
    ? parsed.sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        gameSlug: s.gameSlug,
        gameTitle: s.gameTitle,
        score: Math.max(0, Number(s.score) || 0),
        stakeBirr: roundBirr(Number(s.stakeBirr) || 0),
        payoutBirr:
          typeof s.payoutBirr === 'number'
            ? roundBirr(s.payoutBirr)
            : roundBirr(Number(s.pointsEarned || 0) / 10),
        bonusBirr: roundBirr(Number(s.bonusBirr) || 0),
        multiplier: Number(s.multiplier) || 0,
        outcome:
          (s.outcome as string) === 'completed'
            ? 'win'
            : (s.outcome as StoredSession['outcome']),
        playedAt: s.playedAt,
      }))
    : [];

  const agents: StoredAgent[] =
    Array.isArray(parsed.agents) && parsed.agents.length > 0
      ? parsed.agents.map((a) => ({
          id: a.id || `agent_${crypto.randomUUID()}`,
          name: (a.name || 'Agent').trim(),
          phone: (a.phone || '').trim(),
          note: a.note ? String(a.note).trim() : undefined,
          isActive: typeof a.isActive === 'boolean' ? a.isActive : true,
          isPrimary: Boolean(a.isPrimary),
        }))
      : DEFAULT_AGENTS.map((a) => ({ ...a }));

  if (!agents.some((a) => a.isPrimary)) {
    agents[0].isPrimary = true;
  }

  const resolvedSeed =
    parsed.liveRoundSeed ||
    parsed.sessionSecret ||
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString('hex');
  cachedRoundSeed = resolvedSeed;

  // Sync live Keno/Bingo house odds with DB values
  const kenoGame = games.find((g) => g.engine === 'keno');
  const bingoGame = games.find((g) => g.engine === 'bingo');
  setLiveRoundOddsConfig({
    kenoPlayerWinPercent: kenoGame?.playerWinPercent ?? 30,
    bingoPlayerWinPercent: bingoGame?.playerWinPercent ?? 30,
  });

  // Prune old settled activeWagers (> 24 hours old)
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const activeWagers = Array.isArray(parsed.activeWagers)
    ? parsed.activeWagers
        .filter((w) => w.status === 'active' || Date.parse(w.createdAt) >= cutoffMs)
        .slice(0, 500)
    : [];

  const referralRelationships: StoredReferralRelationship[] = Array.isArray(parsed.referralRelationships)
    ? parsed.referralRelationships
    : [];
  const referralRewards: StoredReferralReward[] = Array.isArray(parsed.referralRewards)
    ? parsed.referralRewards
    : [];
  const auditLogs: StoredAuditLog[] = Array.isArray(parsed.auditLogs)
    ? parsed.auditLogs.slice(0, 1000)
    : [];
  const supportTickets: StoredSupportTicket[] = Array.isArray(parsed.supportTickets)
    ? parsed.supportTickets.slice(0, 500)
    : [];

  let transactions: StoredTransaction[] = Array.isArray(parsed.transactions)
    ? parsed.transactions.slice(0, 1000)
    : [];

  // Safe non-destructive backfill of unified Transactions ledger from historical deposits/withdrawals/bonuses
  if (transactions.length === 0 && (depositRequests.length > 0 || withdrawalRequests.length > 0)) {
    const backfilled: StoredTransaction[] = [];
    for (const d of depositRequests) {
      backfilled.push({
        id: `tx_dep_${d.id}`,
        userId: d.userId,
        username: d.username,
        transactionType: 'deposit',
        amount: roundBirr(d.amountBirr),
        currency: 'ETB',
        status: d.status === 'approved' ? 'approved' : d.status === 'rejected' ? 'rejected' : 'pending',
        referenceNumber: d.telebirrReference || `DEP-${d.id.slice(-8).toUpperCase()}`,
        note: `Telebirr deposit via ${d.agentName}`,
        createdAt: d.createdAt,
      });
    }
    for (const w of withdrawalRequests) {
      backfilled.push({
        id: `tx_wd_${w.id}`,
        userId: w.userId,
        username: w.username,
        transactionType: 'withdrawal',
        amount: roundBirr(w.amountBirr),
        currency: 'ETB',
        status: w.status === 'approved' ? 'approved' : w.status === 'rejected' ? 'refunded' : 'pending',
        referenceNumber: w.payoutReference || `WD-${w.id.slice(-8).toUpperCase()}`,
        note: `Telebirr withdrawal to ${w.telebirrPhone}`,
        createdAt: w.createdAt,
      });
    }
    backfilled.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    transactions = backfilled.slice(0, 1000);
  }

  const nowMs = Date.now();
  const idempotencyKeys: Record<string, number> = {};
  if (parsed.idempotencyKeys && typeof parsed.idempotencyKeys === 'object') {
    for (const [k, ts] of Object.entries(parsed.idempotencyKeys)) {
      if (typeof ts === 'number' && nowMs - ts < 24 * 60 * 60 * 1000) {
        idempotencyKeys[k] = ts;
      }
    }
  }

  return {
    currencyVersion: 5,
    sessionSecret:
      process.env.SESSION_SECRET ||
      parsed.sessionSecret ||
      crypto.randomBytes(32).toString('hex'),
    liveRoundSeed: resolvedSeed,
    agents,
    users,
    games,
    sessions: sessions.slice(0, 500),
    activeWagers,
    challenges,
    challengeProgressByUser: parsed.challengeProgressByUser || {},
    depositRequests,
    withdrawalRequests,
    bonusGrants: Array.isArray(parsed.bonusGrants) ? parsed.bonusGrants.slice(0, 200) : [],
    freeSpinsByUser:
      parsed.freeSpinsByUser && typeof parsed.freeSpinsByUser === 'object'
        ? parsed.freeSpinsByUser
        : {},
    slotBonusGames:
      parsed.slotBonusGames && typeof parsed.slotBonusGames === 'object'
        ? parsed.slotBonusGames
        : {},
    platformSettings,
    agentProfiles,
    referralRelationships,
    referralRewards,
    transactions,
    auditLogs,
    supportTickets,
    idempotencyKeys,
  };
}

// Async sequential mutation queue to prevent concurrent race conditions on JSONB writes
let dbMutationChain: Promise<unknown> = Promise.resolve();

function withDbMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbMutationChain.then(fn, fn);
  dbMutationChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readDb(): Promise<PlatformDatabase> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_state')
        .select('payload')
        .eq('id', SUPABASE_STATE_ID)
        .maybeSingle();

      if (!error) {
        if (data?.payload) {
          const raw = data.payload as Partial<PlatformDatabase>;
          const normalized = normalizeDb(raw);
          const needsMigrationWrite =
            raw.currencyVersion !== 5 ||
            !Array.isArray(raw.agents) ||
            raw.agents.length === 0;
          if (needsMigrationWrite) {
            await writeDb(normalized);
          }
          return normalized;
        }
        const fresh = createEmptyDb();
        await writeDb(fresh);
        return fresh;
      }
    } catch {
      // Fall through to KV or filesystem if Supabase table is not ready yet
    }
  }

  if (HAS_KV) {
    try {
      const res = await fetch(`${KV_URL}/get/${encodeURIComponent(KV_DB_KEY)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { result?: string | null };
        if (data.result) {
          return normalizeDb(JSON.parse(data.result) as Partial<PlatformDatabase>);
        }
      }
      const fresh = createEmptyDb();
      await writeDb(fresh);
      return fresh;
    } catch {
      // Fall through to file storage
    }
  }

  ensureStorageReady();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = createEmptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<PlatformDatabase>;
    return normalizeDb(parsed);
  } catch {
    const fresh = createEmptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }
}

async function writeDb(db: PlatformDatabase): Promise<void> {
  if (supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('platform_state').upsert({
        id: SUPABASE_STATE_ID,
        payload: db,
        updated_at: new Date().toISOString(),
      });
      if (!error) return;
    } catch {
      // Fall through to KV or filesystem fallback
    }
  }

  if (HAS_KV) {
    const res = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', KV_DB_KEY, JSON.stringify(db)]),
    });
    if (res.ok) return;
  }

  ensureStorageReady();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function signToken(userId: string, tokenVersion: number, secret: string): string {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, tv: tokenVersion, iat: now, exp: now + TOKEN_TTL_MS }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(
  token: string,
  secret: string
): { userId: string; tv: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      tv?: number;
      exp?: number;
    };
    if (typeof decoded.sub !== 'string') return null;
    if (typeof decoded.exp === 'number' && Date.now() > decoded.exp) return null;
    return { userId: decoded.sub, tv: typeof decoded.tv === 'number' ? decoded.tv : 1 };
  } catch {
    return null;
  }
}

function sanitizeUser(
  user: StoredUser,
  includePrivate: boolean,
  agentProfile?: StoredAgentProfile | null
) {
  return {
    id: user.id,
    email: includePrivate ? user.email : '',
    username: user.username,
    fullName: includePrivate ? user.fullName || user.displayName : user.displayName || user.username,
    phone: includePrivate ? user.phone || '' : '',
    displayName: user.displayName,
    avatarId: user.avatarId,
    role: user.role,
    accountType: user.accountType || (user.role === 'admin' ? 'admin' : 'player'),
    playerStatus: user.isBanned ? 'suspended' : user.playerStatus || 'active',
    balanceBirr: includePrivate ? roundBirr(user.balanceBirr) : 0,
    bonusBirrReceived: includePrivate ? roundBirr(user.bonusBirrReceived || 0) : 0,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    bestStreak: user.bestStreak,
    highScores: user.highScores,
    isBanned: user.isBanned,
    referredByCode: includePrivate ? user.referredByCode : undefined,
    referredByAgentId: includePrivate ? user.referredByAgentId : undefined,
    agentCode: agentProfile?.applicationStatus === 'approved' ? agentProfile.agentCode : undefined,
    agentApplicationStatus: includePrivate ? agentProfile?.applicationStatus : undefined,
    joinedAt: user.joinedAt,
  };
}

function extractClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function isValidEthiopianPhone(phone: string): boolean {
  return /^(09|07|\+?2519|\+?2517)\d{8}$/.test(phone.replace(/[\s-]/g, ''));
}

function saveScreenshotDataUrl(dataUrl: string): string | undefined {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return undefined;
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 4 * 1024 * 1024) return undefined;

  if (IS_VERCEL || HAS_KV || HAS_SUPABASE) {
    return dataUrl;
  }

  ensureStorageReady();
  const filename = `receipt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  return `/api/uploads/${filename}`;
}

// Sliding-window in-memory rate limiter for abuse protection
const rateLimitStore = new Map<string, number[]>();
const loginFailuresByEmail = new Map<string, number[]>();
const LOGIN_LOCK_WINDOW_MS = 10 * 60_000;
const MAX_LOGIN_FAILURES_PER_EMAIL = 8;

function createRateLimiter(bucket: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    const recent = (rateLimitStore.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }
    recent.push(now);
    rateLimitStore.set(key, recent);
    if (rateLimitStore.size > 2000) {
      for (const [k, list] of rateLimitStore.entries()) {
        if (list.every((ts) => now - ts >= windowMs)) rateLimitStore.delete(k);
      }
    }
    next();
  };
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  db?: PlatformDatabase;
}

function extractUserFromDb(req: Request, db: PlatformDatabase): StoredUser | null {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const verified = verifyToken(token, db.sessionSecret);
  if (!verified) return null;
  const user = db.users.find((u) => u.id === verified.userId) || null;
  if (!user || user.isBanned || user.playerStatus === 'suspended') return null;
  if ((user.tokenVersion ?? 1) !== verified.tv) return null;
  return user;
}

async function getAuthContext(
  req: Request
): Promise<{ db: PlatformDatabase; user: StoredUser | null }> {
  const db = await readDb();
  const user = extractUserFromDb(req, db);
  return { db, user };
}

async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { db, user } = await getAuthContext(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    req.db = db;
    req.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { db, user } = await getAuthContext(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    req.db = db;
    req.authUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

function applyChallengeProgress(
  db: PlatformDatabase,
  userId: string,
  updates?: {
    winIncrement?: number;
    playIncrement?: number;
    snakeScore?: number;
    triviaCorrect?: number;
  },
  engine?: StoredGame['engine']
): void {
  if (!updates) return;
  const userProgress = db.challengeProgressByUser[userId] || {};
  for (const chal of db.challenges) {
    const cur = userProgress[chal.id] || {
      challengeId: chal.id,
      progressValue: 0,
      isClaimed: false,
    };
    if (cur.isClaimed) continue;
    let nextVal = cur.progressValue;
    if (chal.code === 'TTT_DOUBLE_WIN' && updates.winIncrement && (!engine || engine === 'tictactoe')) {
      nextVal = Math.min(chal.targetValue, nextVal + updates.winIncrement);
    } else if (chal.code === 'SNAKE_CENTURY' && updates.snakeScore !== undefined && (!engine || engine === 'snake')) {
      nextVal = Math.min(chal.targetValue, Math.max(nextVal, updates.snakeScore));
    } else if (chal.code === 'MEMORY_CLEARS' && updates.playIncrement && engine === 'memory') {
      nextVal = Math.min(chal.targetValue, nextVal + updates.playIncrement);
    } else if (chal.code === 'TRIVIA_SCHOLAR' && updates.triviaCorrect && (!engine || engine === 'trivia')) {
      nextVal = Math.min(chal.targetValue, nextVal + updates.triviaCorrect);
    } else if (chal.code === 'GEBETA_VICTORY' && updates.winIncrement && engine === 'gebeta') {
      nextVal = Math.min(chal.targetValue, nextVal + updates.winIncrement);
    } else if (chal.code === 'MINES_CLEAR' && updates.winIncrement && engine === 'mines') {
      nextVal = Math.min(chal.targetValue, nextVal + updates.winIncrement);
    }
    userProgress[chal.id] = { ...cur, progressValue: nextVal };
  }
  db.challengeProgressByUser[userId] = userProgress;
}

function buildClientPayload(db: PlatformDatabase, currentUser: StoredUser | null) {
  const isAdmin = currentUser?.role === 'admin';
  const agentByUserId = new Map(db.agentProfiles.map((ap) => [ap.userId, ap]));
  const myAgentStored = currentUser ? agentByUserId.get(currentUser.id) || null : null;
  const myAgentProfile: AgentProfile | null = myAgentStored
    ? sanitizeAgentProfile(myAgentStored, db.sessionSecret)
    : null;

  const approvedDepositsTotalEtb = currentUser
    ? db.depositRequests
        .filter((d) => d.userId === currentUser.id && d.status === 'approved')
        .reduce((sum, d) => sum + (d.amountBirr || 0), 0)
    : 0;

  const myEligibility = currentUser
    ? evaluateAgentEligibility({
        user: currentUser,
        settings: db.platformSettings,
        approvedDepositsTotalEtb,
      })
    : null;

  const myReferralParent: ReferralRelationship | null = currentUser
    ? (() => {
        const rel = db.referralRelationships.find((r) => r.referredUserId === currentUser.id);
        if (!rel) return null;
        return { ...rel, playerStatus: currentUser.playerStatus || 'active' };
      })()
    : null;

  const userStatusById = new Map(
    db.users.map((u) => [u.id, (u.isBanned ? 'suspended' : u.playerStatus || 'active') as PlayerStatus])
  );

  const mapClientRel = (rel: StoredReferralRelationship): ReferralRelationship => ({
    ...rel,
    playerStatus: userStatusById.get(rel.referredUserId) || 'active',
  });

  return {
    users: db.users.map((u) =>
      sanitizeUser(u, Boolean(isAdmin || u.id === currentUser?.id), agentByUserId.get(u.id))
    ),
    games: isAdmin
      ? db.games
      : db.games.map(({ playerWinPercent: _hiddenWinPct, ...publicGame }) => publicGame),
    agents: isAdmin ? db.agents : db.agents.filter((a) => a.isActive),
    sessions: currentUser
      ? isAdmin
        ? db.sessions
        : db.sessions.filter((s) => s.userId === currentUser.id)
      : [],
    challenges: db.challenges,
    challengeProgressByUser: currentUser
      ? { [currentUser.id]: db.challengeProgressByUser[currentUser.id] || {} }
      : {},
    depositRequests: currentUser
      ? isAdmin
        ? db.depositRequests
        : db.depositRequests.filter((d) => d.userId === currentUser.id)
      : [],
    withdrawalRequests: currentUser
      ? isAdmin
        ? db.withdrawalRequests
        : db.withdrawalRequests.filter((w) => w.userId === currentUser.id)
      : [],
    bonusGrants: currentUser
      ? isAdmin
        ? db.bonusGrants
        : db.bonusGrants.filter((b) => b.userId === currentUser.id)
      : [],
    slotFreeSpins: currentUser ? db.freeSpinsByUser[currentUser.id] || {} : {},
    activeSlotBonuses: currentUser
      ? Object.fromEntries(
          Object.values(db.slotBonusGames)
            .filter((b) => b.userId === currentUser.id && b.status === 'active')
            .map((b) => [
              b.gameSlug,
              {
                id: b.id,
                gameSlug: b.gameSlug,
                stakeBirr: b.stakeBirr,
                maxPicks: b.maxPicks,
                pickedIndices: b.pickedIndices,
                vaults: b.vaults.map((v, idx) =>
                  b.pickedIndices.includes(idx)
                    ? { index: idx, revealed: true, kind: v.kind, value: v.value, label: v.label }
                    : { index: idx, revealed: false }
                ),
                status: b.status,
                totalMultiplier: b.totalMultiplier,
                freeSpinsAwarded: b.freeSpinsAwarded,
                payoutBirr: b.payoutBirr,
                createdAt: b.createdAt,
              },
            ])
        )
      : {},
    platformSettings: db.platformSettings,
    myAgentProfile,
    myEligibility,
    myReferralParent,
    myReferralRewards: currentUser
      ? db.referralRewards
          .filter((r) => r.agentUserId === currentUser.id)
          .map(buildClientRewardRecord)
      : [],
    agentProfiles: isAdmin
      ? db.agentProfiles.map((ap) => sanitizeAgentProfile(ap, db.sessionSecret))
      : [],
    referralRelationships: isAdmin
      ? db.referralRelationships.map(mapClientRel)
      : currentUser
        ? db.referralRelationships
            .filter((r) => r.parentAgentUserId === currentUser.id)
            .map(mapClientRel)
        : [],
    referralRewards: isAdmin
      ? db.referralRewards.map(buildClientRewardRecord)
      : currentUser
        ? db.referralRewards
            .filter((r) => r.agentUserId === currentUser.id)
            .map(buildClientRewardRecord)
        : [],
    transactions: currentUser
      ? isAdmin
        ? db.transactions.map(buildClientTransaction)
        : db.transactions
            .filter((t) => t.userId === currentUser.id)
            .map(buildClientTransaction)
      : [],
    auditLogs: isAdmin ? db.auditLogs.map(buildClientAuditLog) : [],
    supportTickets: currentUser
      ? isAdmin
        ? db.supportTickets.map(buildClientSupportTicket)
        : db.supportTickets
            .filter((s) => s.userId === currentUser.id)
            .map(buildClientSupportTicket)
      : [],
    currentUserId: currentUser ? currentUser.id : null,
  };
}

function activateReferralReward(params: {
  db: PlatformDatabase;
  reward: StoredReferralReward;
  actorUsername: string;
  nowIso: string;
}): boolean {
  const { db, reward, actorUsername, nowIso } = params;
  if (reward.rewardStatus === 'rejected' || reward.rewardStatus === 'redeemed') return false;
  if (reward.rewardStatus === 'pending') {
    reward.rewardStatus = 'approved';
    reward.approvedAt = nowIso;
    reward.approvedBy = actorUsername;
  }
  const policy = db.platformSettings.rewardPolicy;
  if (policy.autoCreditAgentWalletOnApproval && reward.rewardStatus === 'approved') {
    const agentUser = db.users.find((u) => u.id === reward.agentUserId);
    if (agentUser && !agentUser.isBanned && agentUser.playerStatus !== 'suspended') {
      const txRef = createTxReference('RDM');
      agentUser.balanceBirr = roundBirr(agentUser.balanceBirr + reward.rewardAmountEtb);
      reward.rewardStatus = 'redeemed';
      reward.redeemedAt = nowIso;
      reward.redemptionTxRef = txRef;
      appendTransaction(db.transactions, {
        userId: agentUser.id,
        username: agentUser.username,
        transactionType: 'reward_redemption',
        amount: reward.rewardAmountEtb,
        status: 'completed',
        referenceNumber: txRef,
        note: `Referral reward credited directly to active ETB wallet (${reward.referredUsername})`,
        createdAt: nowIso,
      });
      return true;
    }
  }
  return false;
}

function approveVerifiedClientRewards(params: {
  db: PlatformDatabase;
  referredUserId: string;
  actorUsername: string;
  nowIso: string;
}): number {
  const { db, referredUserId, actorUsername, nowIso } = params;
  if (!db.platformSettings.rewardPolicy.autoApproveOnClientVerification) return 0;
  const rel = db.referralRelationships.find((r) => r.referredUserId === referredUserId);
  if (rel?.isFlaggedDuplicate) return 0;
  let count = 0;
  for (const rw of db.referralRewards) {
    if (rw.referredUserId === referredUserId && rw.rewardStatus === 'pending') {
      activateReferralReward({ db, reward: rw, actorUsername, nowIso });
      count++;
    }
  }
  return count;
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  const authLimiter = createRateLimiter('auth', 25, 15 * 60_000);
  const walletLimiter = createRateLimiter('wallet', 40, 5 * 60_000);
  const wagerLimiter = createRateLimiter('wager', 120, 5 * 60_000);

  router.use('/uploads', express.static(UPLOADS_DIR));

  // Health check
  router.get('/health', async (_req, res) => {
    const base = {
      ok: true,
      currency: 'Birr',
      runtime: IS_VERCEL ? 'vercel-serverless' : 'node-express',
      storage: HAS_SUPABASE ? 'supabase' : HAS_KV ? 'kv-rest' : 'filesystem',
    };

    if (!supabaseAdmin) {
      res.json(base);
      return;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('platform_state')
        .select('id, updated_at, payload')
        .eq('id', SUPABASE_STATE_ID)
        .maybeSingle();

      if (error) {
        res.status(503).json({
          ...base,
          ok: false,
          supabase: {
            connected: false,
            platformStateReady: false,
            error: error.message,
          },
        });
        return;
      }

      const payload = (data?.payload || {}) as Partial<PlatformDatabase>;
      res.json({
        ...base,
        supabase: {
          connected: true,
          platformStateReady: Boolean(data),
          updatedAt: data?.updated_at || null,
          usersCount: Array.isArray(payload.users) ? payload.users.length : 0,
          gamesCount: Array.isArray(payload.games) ? payload.games.length : 0,
          agentsCount: Array.isArray(payload.agents) ? payload.agents.length : 0,
        },
      });
    } catch (err) {
      res.status(503).json({
        ...base,
        ok: false,
        supabase: {
          connected: false,
          platformStateReady: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        },
      });
    }
  });

  // Bootstrap platform state
  router.get('/bootstrap', async (req, res, next) => {
    try {
      const { db, user } = await getAuthContext(req);
      res.json(buildClientPayload(db, user));
    } catch (err) {
      next(err);
    }
  });

  const checkAndRecordIdempotency = (
    db: PlatformDatabase,
    scope: string,
    req: Request
  ): boolean => {
    const rawKey = (req.get('idempotency-key') || '').trim().slice(0, 100);
    if (!rawKey) return false;
    const composite = `${scope}:${rawKey}`;
    if (db.idempotencyKeys[composite]) return true;
    db.idempotencyKeys[composite] = Date.now();
    const keys = Object.keys(db.idempotencyKeys);
    if (keys.length > 500) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const k of keys) {
        if (db.idempotencyKeys[k] < cutoff) delete db.idempotencyKeys[k];
      }
    }
    return false;
  };

  // Register new user (always player-first; first account receives platform admin role)
  router.post('/auth/register', authLimiter, async (req, res, next) => {
    try {
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const {
          email,
          password,
          confirmPassword,
          username,
          fullName,
          phone,
          referralCode,
          displayName,
          avatarId,
        } = req.body as {
          email?: string;
          password?: string;
          confirmPassword?: string;
          username?: string;
          fullName?: string;
          phone?: string;
          referralCode?: string;
          displayName?: string;
          avatarId?: string;
        };

        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanUsername = (username || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
        const cleanFullName = (fullName || displayName || '').trim().slice(0, 80);
        const cleanDisplay = (displayName || cleanFullName || cleanUsername).trim().slice(0, 40);
        const cleanPhone = (phone || '').trim().slice(0, 24);
        const normPhone = normalizePhoneKey(cleanPhone);
        const cleanRefCode = (referralCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (cleanFullName.length < 2) {
          return { status: 400, error: 'Enter your full legal name (at least 2 characters).' };
        }
        if (cleanUsername.length < 3 || cleanUsername.length > 24) {
          return { status: 400, error: 'Username must be 3–24 alphanumeric characters.' };
        }
        if (!isValidEthiopianPhone(cleanPhone)) {
          return {
            status: 400,
            error: 'Enter a valid Ethiopian phone number (e.g. 0911223344).',
          };
        }
        if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length > 120) {
          return { status: 400, error: 'Enter a valid email address.' };
        }
        if (!password || password.length < 6 || password.length > 128) {
          return { status: 400, error: 'Password must be at least 6 characters.' };
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
          return { status: 400, error: 'Password confirmation does not match.' };
        }
        if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
          return { status: 409, error: 'An account with this email already exists.' };
        }
        if (db.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
          return { status: 409, error: 'That username is already taken.' };
        }
        if (normPhone && db.users.some((u) => normalizePhoneKey(u.phone) === normPhone)) {
          return { status: 409, error: 'An account with this phone number already exists.' };
        }

        let parentAgentProfile: StoredAgentProfile | null = null;
        let parentAgentUser: StoredUser | null = null;
        if (cleanRefCode) {
          parentAgentProfile =
            db.agentProfiles.find(
              (ap) => (ap.agentCode || '').toUpperCase() === cleanRefCode
            ) || null;
          if (!parentAgentProfile || parentAgentProfile.applicationStatus !== 'approved') {
            return {
              status: 400,
              error: 'The referral code entered is invalid or not currently active.',
            };
          }
          parentAgentUser =
            db.users.find((u) => u.id === parentAgentProfile!.userId) || null;
          if (!parentAgentUser || parentAgentUser.isBanned || parentAgentUser.playerStatus === 'suspended') {
            return {
              status: 400,
              error: 'The referring agent account is not currently active.',
            };
          }
        }

        const nowIso = new Date().toISOString();
        const signupIp = extractClientIp(req);
        const salt = crypto.randomBytes(16).toString('hex');
        const isFirstAccount = !db.users.some((u) => u.role === 'admin');
        const newUser: StoredUser = {
          id: `usr_${crypto.randomUUID()}`,
          email: cleanEmail,
          username: cleanUsername,
          fullName: cleanFullName,
          phone: cleanPhone,
          displayName: cleanDisplay,
          avatarId: avatarId || 'lion',
          role: isFirstAccount ? 'admin' : 'player',
          accountType: isFirstAccount ? 'admin' : 'player',
          playerStatus: 'active',
          passwordHash: hashPassword(password, salt),
          passwordSalt: salt,
          balanceBirr: 0,
          bonusBirrReceived: 0,
          gamesPlayed: 0,
          wins: 0,
          bestStreak: 0,
          highScores: { snake: 0, trivia: 0, memoryMoves: 0 },
          isBanned: false,
          referredByCode: parentAgentProfile?.agentCode,
          referredByAgentId: parentAgentProfile?.id,
          signupIp,
          joinedAt: nowIso,
        };

        if (parentAgentProfile && parentAgentUser) {
          if (hasAncestorCycle(parentAgentUser.id, newUser.id, db.referralRelationships)) {
            return { status: 400, error: 'Invalid circular referral relationship.' };
          }
          const fraud = detectReferralFraud({
            newUserEmail: cleanEmail,
            newUserPhone: cleanPhone,
            signupIp,
            parentAgentUser,
            existingUsers: db.users,
          });
          const rel: StoredReferralRelationship = {
            id: `ref_${crypto.randomUUID()}`,
            parentAgentId: parentAgentProfile.id,
            parentAgentUserId: parentAgentUser.id,
            parentAgentCode: parentAgentProfile.agentCode!,
            referredUserId: newUser.id,
            referredUsername: newUser.username,
            referredFullName: newUser.fullName,
            referralCode: parentAgentProfile.agentCode!,
            referralType: 'player',
            isFlaggedDuplicate: fraud.isFlagged,
            fraudFlagReason: fraud.reason,
            createdAt: nowIso,
          };
          db.referralRelationships.unshift(rel);

          const policy = db.platformSettings.rewardPolicy;
          if (
            policy.rewardsEnabled &&
            policy.rewardMode !== 'manual_admin_only' &&
            policy.playerReferralBonusEtb > 0
          ) {
            const autoApprove = policy.autoApproveRewards && !fraud.isFlagged;
            const rewRecord: StoredReferralReward = {
              id: `rew_${crypto.randomUUID()}`,
              agentId: parentAgentProfile.id,
              agentUserId: parentAgentUser.id,
              agentUsername: parentAgentUser.username,
              referralId: rel.id,
              referredUserId: newUser.id,
              referredUsername: newUser.username,
              rewardAmountEtb: policy.playerReferralBonusEtb,
              rewardType: 'player_referral',
              rewardStatus: 'pending',
              rewardReference: createTxReference('REW'),
              policyNote: fraud.isFlagged
                ? `Flagged for manual review (${fraud.reason})`
                : 'Non-deposit-funded promotional player referral reward',
              createdAt: nowIso,
            };
            db.referralRewards.unshift(rewRecord);
            if (autoApprove) {
              activateReferralReward({
                db,
                reward: rewRecord,
                actorUsername: 'policy-auto',
                nowIso,
              });
            }
          }
        }

        newUser.tokenVersion = 1;
        db.users.unshift(newUser);
        await writeDb(db);

        const token = signToken(newUser.id, newUser.tokenVersion, db.sessionSecret);
        return {
          status: 201,
          body: {
            token,
            user: sanitizeUser(newUser, true, null),
            snapshot: buildClientPayload(db, newUser),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Login user (supports email, username, or Ethiopian phone) with brute-force throttle
  router.post('/auth/login', authLimiter, async (req, res, next) => {
    try {
      const db = await readDb();
      const { email, identifier, password } = req.body as {
        email?: string;
        identifier?: string;
        password?: string;
      };
      const cleanId = (identifier || email || '').trim().toLowerCase();

      if (!cleanId || !password) {
        res.status(400).json({ error: 'Please enter both your account identifier and password.' });
        return;
      }

      const now = Date.now();
      const recentFails = (loginFailuresByEmail.get(cleanId) || []).filter(
        (ts) => now - ts < LOGIN_LOCK_WINDOW_MS
      );
      if (recentFails.length >= MAX_LOGIN_FAILURES_PER_EMAIL) {
        res.status(429).json({
          error: 'Too many failed sign-in attempts for this account. Wait 10 minutes and try again.',
        });
        return;
      }

      const normPhone = normalizePhoneKey(cleanId);
      const found = db.users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.username.toLowerCase() === cleanId ||
          (normPhone.length >= 9 && normalizePhoneKey(u.phone) === normPhone)
      );
      if (!found || !verifyPassword(password, found.passwordSalt, found.passwordHash)) {
        recentFails.push(now);
        loginFailuresByEmail.set(cleanId, recentFails);
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }
      if (found.isBanned || found.playerStatus === 'suspended') {
        res.status(403).json({ error: 'This account has been suspended by an administrator.' });
        return;
      }

      loginFailuresByEmail.delete(cleanId);
      const ap = db.agentProfiles.find((a) => a.userId === found.id) || null;
      const token = signToken(found.id, found.tokenVersion ?? 1, db.sessionSecret);
      res.json({
        token,
        user: sanitizeUser(found, true, ap),
        snapshot: buildClientPayload(db, found),
      });
    } catch (err) {
      next(err);
    }
  });

  // Server-side JWT session revocation on sign-out
  router.post('/auth/logout', async (req, res, next) => {
    try {
      await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (user) {
          user.tokenVersion = (user.tokenVersion ?? 1) + 1;
          await writeDb(db);
        }
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Update own profile & personal account settings
  router.patch('/profile', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { displayName, fullName, phone, avatarId } = req.body as {
        displayName?: string;
        fullName?: string;
        phone?: string;
        avatarId?: string;
      };
      const cleanName = (displayName || '').trim().slice(0, 40);
      const cleanFull = fullName !== undefined ? fullName.trim().slice(0, 80) : undefined;
      const cleanPhone = phone !== undefined ? phone.trim().slice(0, 24) : undefined;

      if (!cleanName && !cleanFull) {
        res.status(400).json({ error: 'Display name or full name cannot be empty.' });
        return;
      }
      if (cleanPhone !== undefined && cleanPhone !== '' && !isValidEthiopianPhone(cleanPhone)) {
        res.status(400).json({ error: 'Enter a valid Ethiopian phone number (e.g. 0911223344).' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        if (cleanPhone) {
          const norm = normalizePhoneKey(cleanPhone);
          const conflict = db.users.find(
            (u) => u.id !== user.id && normalizePhoneKey(u.phone) === norm
          );
          if (conflict) {
            return { status: 409, error: 'Another account already uses this phone number.' };
          }
          user.phone = cleanPhone;
        }
        if (cleanFull && cleanFull.length >= 2) {
          user.fullName = cleanFull;
        }
        if (cleanName) {
          user.displayName = cleanName;
        } else if (cleanFull) {
          user.displayName = cleanFull.slice(0, 40);
        }
        if (avatarId) user.avatarId = avatarId;
        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, user) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // START AUTHORITATIVE BIRR WAGER
  router.post('/wagers/start', wagerLimiter, async (req, res, next) => {
    try {
      const { gameSlug, stakeBirr } = req.body as {
        gameSlug?: string;
        stakeBirr?: number;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Sign in and deposit Birr to place stakes.' };
        }

        const game = db.games.find((g) => g.slug === gameSlug);
        if (!game || !game.isActive) {
          return { status: 404, error: 'This game arena is currently unavailable.' };
        }

        const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
        const cleanStake = roundBirr(Number(stakeBirr));
        if (!Number.isFinite(cleanStake) || cleanStake < minStake) {
          return { status: 400, error: `Minimum stake is ${minStake} Birr.` };
        }
        if (cleanStake > 100_000) {
          return { status: 400, error: 'Maximum single-round stake is 100,000 Birr.' };
        }
        if (user.balanceBirr < cleanStake) {
          return {
            status: 400,
            error: `Insufficient Birr balance (${user.balanceBirr.toFixed(2)} Birr available). Deposit via Telebirr first.`,
          };
        }

        user.balanceBirr = roundBirr(user.balanceBirr - cleanStake);
        game.playCount += 1;

        const roll = crypto.randomInt(0, 10_000) / 100; // 0.00 - 99.99
        const aiFavored = roll >= game.playerWinPercent;

        const wager: StoredActiveWager = {
          id: `wag_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: game.slug,
          engine: game.engine,
          stakeBirr: cleanStake,
          playerWinPercent: game.playerWinPercent,
          bonusBirr: game.bonusBirr || 0,
          aiFavored,
          maxAllowedMultiplier: game.maxMultiplier || 5,
          status: 'active',
          payoutBirr: 0,
          createdAt: new Date().toISOString(),
        };

        db.activeWagers.unshift(wager);
        if (db.activeWagers.length > 500) db.activeWagers = db.activeWagers.slice(0, 500);
        await writeDb(db);

        return {
          status: 201,
          body: {
            wager: {
              id: wager.id,
              gameSlug: wager.gameSlug,
              engine: wager.engine,
              stakeBirr: wager.stakeBirr,
              ...(user.role === 'admin' ? { playerWinPercent: wager.playerWinPercent } : {}),
              bonusBirr: wager.bonusBirr,
              aiFavored: wager.aiFavored,
              maxAllowedMultiplier: wager.maxAllowedMultiplier,
              status: wager.status,
              createdAt: wager.createdAt,
            },
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // CASHOUT BEFORE FAILURE (Authoritative Birr Payout)
  router.post('/wagers/cashout', wagerLimiter, async (req, res, next) => {
    try {
      const { wagerId, multiplier, score, challengeUpdates } = req.body as {
        wagerId?: string;
        multiplier?: number;
        score?: number;
        challengeUpdates?: {
          winIncrement?: number;
          playIncrement?: number;
          snakeScore?: number;
          triviaCorrect?: number;
        };
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Authentication required to cash out.' };
        }

        const wager = db.activeWagers.find((w) => w.id === wagerId && w.userId === user.id);
        if (!wager) {
          return { status: 404, error: 'Active wager not found.' };
        }
        if (wager.status !== 'active') {
          return { status: 400, error: 'This round has already been settled.' };
        }

        const game = db.games.find((g) => g.slug === wager.gameSlug);
        if (game && !game.cashoutEnabled) {
          return { status: 400, error: 'Early cash out is disabled for this game by Admin.' };
        }

        const elapsedMs = Date.now() - Date.parse(wager.createdAt);
        if (!Number.isFinite(elapsedMs) || elapsedMs < 400) {
          return { status: 400, error: 'Play at least 1 active turn before cashing out.' };
        }

        const rawMult = Number(multiplier);
        if (!Number.isFinite(rawMult) || rawMult <= 0) {
          return { status: 400, error: 'Cannot cash out when multiplier is 0 or below.' };
        }

        const elapsedSec = elapsedMs / 1000;
        const timeCappedMax = Math.min(
          wager.maxAllowedMultiplier,
          Math.max(1.5, roundBirr(1 + elapsedSec * 1.5))
        );
        const clampedMult = Math.min(timeCappedMax, roundBirr(rawMult));
        // Only grant bonus Birr when player actually achieved profitable (> 1.00x) progress
        const bonusApplied = clampedMult > 1 ? roundBirr(wager.bonusBirr || 0) : 0;
        const payoutBirr = roundBirr(wager.stakeBirr * clampedMult + bonusApplied);

        wager.status = 'cashed_out';
        wager.payoutBirr = payoutBirr;
        wager.settledAt = new Date().toISOString();

        user.balanceBirr = roundBirr(user.balanceBirr + payoutBirr);
        user.gamesPlayed += 1;
        if (payoutBirr >= wager.stakeBirr) {
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
        }

        const cleanScore = Math.max(0, Math.round(Number(score) || 0));
        if (wager.engine === 'snake' && cleanScore > user.highScores.snake) {
          user.highScores.snake = cleanScore;
        }
        if (wager.engine === 'trivia' && cleanScore > user.highScores.trivia) {
          user.highScores.trivia = cleanScore;
        }

        db.sessions.unshift({
          id: `ses_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: wager.gameSlug,
          gameTitle: game?.title || wager.gameSlug,
          score: cleanScore,
          stakeBirr: wager.stakeBirr,
          payoutBirr,
          bonusBirr: bonusApplied,
          multiplier: clampedMult,
          outcome: 'cashed_out',
          playedAt: new Date().toISOString(),
        });
        if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);

        applyChallengeProgress(db, user.id, challengeUpdates, wager.engine);
        await writeDb(db);

        return {
          status: 200,
          body: {
            ok: true,
            payoutBirr,
            bonusBirrApplied: bonusApplied,
            multiplier: clampedMult,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // SETTLE ACTIVE WAGER ON WIN / DRAW / LOSS
  router.post('/wagers/settle', wagerLimiter, async (req, res, next) => {
    try {
      const { wagerId, outcome: matchOutcome, score, multiplier, challengeUpdates } = req.body as {
        wagerId?: string;
        outcome?: 'win' | 'draw' | 'loss';
        score?: number;
        multiplier?: number;
        challengeUpdates?: {
          winIncrement?: number;
          playIncrement?: number;
          snakeScore?: number;
          triviaCorrect?: number;
        };
      };

      if (matchOutcome !== 'win' && matchOutcome !== 'draw' && matchOutcome !== 'loss') {
        res.status(400).json({ error: 'Invalid wager outcome.' });
        return;
      }

      const result = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Authentication required to settle round.' };
        }

        const wager = db.activeWagers.find((w) => w.id === wagerId && w.userId === user.id);
        if (!wager) {
          return { status: 404, error: 'Wager session not found.' };
        }
        if (wager.status !== 'active') {
          return { status: 400, error: 'Wager already settled.' };
        }

        const elapsedMs = Date.now() - Date.parse(wager.createdAt);
        if (matchOutcome === 'win' && (!Number.isFinite(elapsedMs) || elapsedMs < 400)) {
          return { status: 400, error: 'Invalid round duration.' };
        }

        const game = db.games.find((g) => g.slug === wager.gameSlug);
        let finalMult = 0;
        let bonusApplied = 0;
        let payoutBirr = 0;

        if (matchOutcome === 'win') {
          const engineWinCap =
            wager.engine === 'tictactoe' || wager.engine === 'gebeta'
              ? Math.min(wager.maxAllowedMultiplier, 2.0)
              : wager.maxAllowedMultiplier;
          const requestedMult = Number(multiplier);
          const safeMult = Number.isFinite(requestedMult)
            ? Math.max(1.1, Math.min(engineWinCap, roundBirr(requestedMult)))
            : Math.min(engineWinCap, 1.9);
          finalMult = safeMult;
          bonusApplied = roundBirr(wager.bonusBirr || 0);
          payoutBirr = roundBirr(wager.stakeBirr * finalMult + bonusApplied);
          wager.status = 'won';
        } else if (matchOutcome === 'draw') {
          finalMult = 1;
          payoutBirr = wager.stakeBirr;
          wager.status = 'draw';
        } else {
          finalMult = 0;
          payoutBirr = 0;
          wager.status = 'lost';
        }

        wager.payoutBirr = payoutBirr;
        wager.settledAt = new Date().toISOString();

        if (payoutBirr > 0) {
          user.balanceBirr = roundBirr(user.balanceBirr + payoutBirr);
        }
        user.gamesPlayed += 1;
        if (matchOutcome === 'win') {
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
        }

        const cleanScore = Math.max(0, Math.round(Number(score) || 0));
        if (wager.engine === 'snake' && cleanScore > user.highScores.snake) {
          user.highScores.snake = cleanScore;
        }
        if (wager.engine === 'trivia' && cleanScore > user.highScores.trivia) {
          user.highScores.trivia = cleanScore;
        }
        if (
          wager.engine === 'memory' &&
          matchOutcome === 'win' &&
          cleanScore > 0 &&
          (user.highScores.memoryMoves === 0 || cleanScore < user.highScores.memoryMoves)
        ) {
          user.highScores.memoryMoves = cleanScore;
        }

        db.sessions.unshift({
          id: `ses_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: wager.gameSlug,
          gameTitle: game?.title || wager.gameSlug,
          score: cleanScore,
          stakeBirr: wager.stakeBirr,
          payoutBirr,
          bonusBirr: bonusApplied,
          multiplier: finalMult,
          outcome: matchOutcome,
          playedAt: new Date().toISOString(),
        });
        if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);

        applyChallengeProgress(db, user.id, challengeUpdates, wager.engine);
        await writeDb(db);

        return {
          status: 200,
          body: {
            ok: true,
            payoutBirr,
            bonusBirrApplied: bonusApplied,
            multiplier: finalMult,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(result.status).json(result.body);
    } catch (err) {
      next(err);
    }
  });

  // Practice / Free Demo Mode Result (0 Birr payout — prevents client-side balance spoofing!)
  router.post('/games/result', wagerLimiter, async (req, res, next) => {
    try {
      const payload = req.body as {
        gameSlug: string;
        gameTitle: string;
        engine: StoredGame['engine'];
        score: number;
        outcome: 'win' | 'draw' | 'cashed_out' | 'loss';
      };

      const snapshot = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        const game = db.games.find((g) => g.slug === payload.gameSlug);
        if (game) game.playCount += 1;

        if (user) {
          db.sessions.unshift({
            id: `ses_${crypto.randomUUID()}`,
            userId: user.id,
            gameSlug: payload.gameSlug,
            gameTitle: payload.gameTitle || game?.title || payload.gameSlug,
            score: Math.max(0, Math.round(Number(payload.score) || 0)),
            stakeBirr: 0,
            payoutBirr: 0,
            bonusBirr: 0,
            multiplier: 0,
            outcome: payload.outcome === 'win' ? 'win' : payload.outcome === 'draw' ? 'draw' : 'loss',
            playedAt: new Date().toISOString(),
          });
          if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
        }
        await writeDb(db);
        return buildClientPayload(db, user);
      });

      res.json({ snapshot });
    } catch (err) {
      next(err);
    }
  });

  // SLOT MACHINE AUTHORITATIVE SPIN (All 17 Slots + Free Spins + Mid-Game Bonus Drops)
  router.post('/slots/spin', wagerLimiter, async (req, res, next) => {
    try {
      const { gameSlug, stakeBirr } = req.body as {
        gameSlug?: string;
        stakeBirr?: number;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Please sign in to spin with Birr.' };
        }
        if (user.isBanned) {
          return { status: 403, error: 'Account suspended.' };
        }

        const game = db.games.find((g) => g.slug === gameSlug && g.isActive);
        if (!game || !SLOT_ENGINE_SET.has(game.engine)) {
          return { status: 404, error: 'Slot game not found or inactive.' };
        }

        const existingActiveBonus = Object.values(db.slotBonusGames).find(
          (b) => b.userId === user.id && b.gameSlug === game.slug && b.status === 'active'
        );
        if (existingActiveBonus) {
          return {
            status: 400,
            error: 'Complete your active Pick-a-Vault Bonus Game before spinning again.',
          };
        }

        const userFreeSpinsMap = db.freeSpinsByUser[user.id] || {};
        const activeFS = userFreeSpinsMap[game.slug];
        const usingFreeSpin = Boolean(activeFS && activeFS.remaining > 0);

        const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
        const requestedStake = roundBirr(Number(stakeBirr));
        const stake = usingFreeSpin ? activeFS!.stakeBirr : requestedStake;

        if (!usingFreeSpin) {
          if (!Number.isFinite(stake) || stake < minStake) {
            return {
              status: 400,
              error: `Minimum stake for ${game.title} is ${minStake} Birr.`,
            };
          }
          if (stake > 100000) {
            return { status: 400, error: 'Maximum single spin stake is 100,000 Birr.' };
          }
          if (user.balanceBirr < stake) {
            return {
              status: 400,
              error: `Insufficient Birr balance (${user.balanceBirr} Birr). Please deposit first.`,
            };
          }
        }

        const maxMult = game.maxMultiplier || 20;
        const spin = generateAuthoritativeSlotSpin({
          engine: game.engine as SlotEngineType,
          playerWinPercent: usingFreeSpin
            ? Math.min(95, Math.round(game.playerWinPercent + 10))
            : game.playerWinPercent,
          maxMultiplier: maxMult,
        });

        let effectiveTotalMult = spin.totalMultiplier;
        if (usingFreeSpin && effectiveTotalMult > 0 && activeFS) {
          effectiveTotalMult = Math.min(
            maxMult,
            roundBirr(effectiveTotalMult * (activeFS.multiplierBoost || 2))
          );
          spin.totalMultiplier = effectiveTotalMult;
        }

        const isWin = effectiveTotalMult > 0 && spin.winningLines.length > 0;
        const bonusApplied = isWin && effectiveTotalMult > 1 ? roundBirr(game.bonusBirr || 0) : 0;
        const payoutBirr = isWin
          ? roundBirr(stake * effectiveTotalMult + bonusApplied)
          : 0;
        const spinOutcome: 'win' | 'loss' = isWin ? 'win' : 'loss';
        const score = isWin ? Math.round(effectiveTotalMult * 100) : 0;

        user.balanceBirr = roundBirr(
          user.balanceBirr - (usingFreeSpin ? 0 : stake) + payoutBirr
        );
        user.gamesPlayed += 1;
        if (isWin) {
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
        }
        game.playCount += 1;

        let freeSpinsAwarded = 0;
        let retriggeredFreeSpins = 0;
        let bonusTriggeredClient: {
          id: string;
          gameSlug: string;
          stakeBirr: number;
          maxPicks: number;
          pickedIndices: number[];
          vaults: Array<{ index: number; revealed: boolean }>;
          status: 'active';
          totalMultiplier: number;
          freeSpinsAwarded: number;
          payoutBirr: number;
          createdAt: string;
        } | null = null;

        if (usingFreeSpin && activeFS) {
          activeFS.remaining = Math.max(0, activeFS.remaining - 1);
          activeFS.spinsPlayed += 1;
          activeFS.totalWonBirr = roundBirr(activeFS.totalWonBirr + payoutBirr);

          if (crypto.randomInt(0, 100) < 8) {
            retriggeredFreeSpins = 3;
            activeFS.remaining += 3;
          }

          if (activeFS.remaining <= 0) {
            delete userFreeSpinsMap[game.slug];
          } else {
            userFreeSpinsMap[game.slug] = activeFS;
          }
          db.freeSpinsByUser[user.id] = userFreeSpinsMap;
        } else {
          // Paid spin: organic mid-game triggers (never rely on Bonus Buy alone!)
          const triggerRoll = crypto.randomInt(0, 1000);
          const bonusChanceThreshold = game.playerWinPercent >= 40 ? 55 : 42; // ~4.2%–5.5% Vault Bonus
          const fsChanceThreshold = bonusChanceThreshold + (game.playerWinPercent >= 40 ? 75 : 65); // ~6.5%–7.5% Mid-Game Free Spins

          if (triggerRoll < bonusChanceThreshold) {
            const vaults = generateBonusVaults({
              playerWinPercent: game.playerWinPercent,
              maxMultiplier: maxMult,
            });
            const bonusId = `sbon_${crypto.randomUUID()}`;
            const created: StoredSlotBonusPick = {
              id: bonusId,
              userId: user.id,
              gameSlug: game.slug,
              stakeBirr: stake,
              maxPicks: 3,
              pickedIndices: [],
              vaults,
              status: 'active',
              totalMultiplier: 0,
              freeSpinsAwarded: 0,
              payoutBirr: 0,
              createdAt: new Date().toISOString(),
            };
            db.slotBonusGames[bonusId] = created;
            bonusTriggeredClient = {
              id: created.id,
              gameSlug: created.gameSlug,
              stakeBirr: created.stakeBirr,
              maxPicks: created.maxPicks,
              pickedIndices: [],
              vaults: created.vaults.map((_, i) => ({ index: i, revealed: false })),
              status: 'active',
              totalMultiplier: 0,
              freeSpinsAwarded: 0,
              payoutBirr: 0,
              createdAt: created.createdAt,
            };
          } else if (triggerRoll < fsChanceThreshold) {
            freeSpinsAwarded = crypto.randomInt(0, 100) < 35 ? 8 : 5;
            userFreeSpinsMap[game.slug] = {
              gameSlug: game.slug,
              remaining: freeSpinsAwarded,
              stakeBirr: stake,
              multiplierBoost: 2,
              totalWonBirr: 0,
              spinsPlayed: 0,
              source: 'midgame',
            };
            db.freeSpinsByUser[user.id] = userFreeSpinsMap;
          }
        }

        db.sessions.unshift({
          id: `ses_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: game.slug,
          gameTitle: game.title,
          score,
          stakeBirr: usingFreeSpin ? 0 : stake,
          payoutBirr,
          bonusBirr: bonusApplied,
          multiplier: effectiveTotalMult,
          outcome: spinOutcome,
          playedAt: new Date().toISOString(),
        });
        if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);

        applyChallengeProgress(
          db,
          user.id,
          { playIncrement: 1, winIncrement: isWin ? 1 : 0 },
          game.engine
        );
        await writeDb(db);

        return {
          status: 200,
          body: {
            ok: true,
            spin,
            stakeBirr: stake,
            payoutBirr,
            bonusBirrApplied: bonusApplied,
            outcome: spinOutcome,
            usedFreeSpin: usingFreeSpin,
            freeSpinsRemaining: db.freeSpinsByUser[user.id]?.[game.slug]?.remaining || 0,
            freeSpinsAwarded,
            retriggeredFreeSpins,
            bonusTriggered: bonusTriggeredClient,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // SLOT BONUS BUY (Free Spins 12x Stake OR Pick-a-Vault Bonus Game 18x Stake — Slots Only)
  router.post('/slots/bonus-buy', wagerLimiter, async (req, res, next) => {
    try {
      const { gameSlug, stakeBirr, buyType } = req.body as {
        gameSlug?: string;
        stakeBirr?: number;
        buyType?: 'free_spins' | 'bonus_game';
      };

      if (buyType !== 'free_spins' && buyType !== 'bonus_game') {
        res.status(400).json({ error: 'Invalid slot bonus buy type.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Please sign in to buy slot bonuses.' };
        if (user.isBanned) return { status: 403, error: 'Account suspended.' };

        const game = db.games.find((g) => g.slug === gameSlug && g.isActive);
        if (!game || !SLOT_ENGINE_SET.has(game.engine)) {
          return { status: 404, error: 'Bonus Buy is exclusive to active Slot games.' };
        }

        const existingActiveBonus = Object.values(db.slotBonusGames).find(
          (b) => b.userId === user.id && b.gameSlug === game.slug && b.status === 'active'
        );
        if (existingActiveBonus) {
          return { status: 400, error: 'Finish your current Pick-a-Vault Bonus Game first.' };
        }

        const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
        const stake = roundBirr(Number(stakeBirr));
        if (!Number.isFinite(stake) || stake < minStake || stake > 10000) {
          return {
            status: 400,
            error: `Base stake for Bonus Buy must be between ${minStake} and 10,000 Birr.`,
          };
        }

        const costMultiplier = buyType === 'free_spins' ? 12 : 18;
        const costBirr = roundBirr(stake * costMultiplier);
        if (user.balanceBirr < costBirr) {
          return {
            status: 400,
            error: `Insufficient Birr (${user.balanceBirr} Birr). Need ${costBirr} Birr for this Bonus Buy.`,
          };
        }

        user.balanceBirr = roundBirr(user.balanceBirr - costBirr);

        if (buyType === 'free_spins') {
          const userMap = db.freeSpinsByUser[user.id] || {};
          const prev = userMap[game.slug];
          const nextState: StoredSlotFreeSpins = {
            gameSlug: game.slug,
            remaining: (prev?.remaining || 0) + 8,
            stakeBirr: prev ? Math.max(prev.stakeBirr, stake) : stake,
            multiplierBoost: 2,
            totalWonBirr: prev?.totalWonBirr || 0,
            spinsPlayed: prev?.spinsPlayed || 0,
            source: 'bought',
          };
          userMap[game.slug] = nextState;
          db.freeSpinsByUser[user.id] = userMap;
          await writeDb(db);
          return {
            status: 200,
            body: {
              ok: true,
              buyType,
              costBirr,
              freeSpins: nextState,
              snapshot: buildClientPayload(db, user),
            },
          };
        }

        const vaults = generateBonusVaults({
          playerWinPercent: game.playerWinPercent,
          maxMultiplier: game.maxMultiplier || 20,
        });
        const bonusId = `sbon_${crypto.randomUUID()}`;
        const created: StoredSlotBonusPick = {
          id: bonusId,
          userId: user.id,
          gameSlug: game.slug,
          stakeBirr: stake,
          maxPicks: 3,
          pickedIndices: [],
          vaults,
          status: 'active',
          totalMultiplier: 0,
          freeSpinsAwarded: 0,
          payoutBirr: 0,
          createdAt: new Date().toISOString(),
        };
        db.slotBonusGames[bonusId] = created;

        // Prune old claimed bonus games
        const bonusKeys = Object.keys(db.slotBonusGames);
        if (bonusKeys.length > 250) {
          for (const k of bonusKeys) {
            if (db.slotBonusGames[k].status === 'claimed') {
              delete db.slotBonusGames[k];
            }
          }
        }

        await writeDb(db);
        const maskedSession = buildClientPayload(db, user).activeSlotBonuses[game.slug];
        return {
          status: 200,
          body: {
            ok: true,
            buyType,
            costBirr,
            bonusSession: maskedSession,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // SLOT BONUS PICK-A-VAULT REVEAL & SETTLEMENT
  router.post('/slots/bonus-pick', wagerLimiter, async (req, res, next) => {
    try {
      const { bonusId, vaultIndex } = req.body as {
        bonusId?: string;
        vaultIndex?: number;
      };
      const idx = Number(vaultIndex);
      if (!bonusId || !Number.isInteger(idx) || idx < 0 || idx > 5) {
        res.status(400).json({ error: 'Invalid vault pick.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const session = db.slotBonusGames[bonusId];
        if (!session || session.userId !== user.id) {
          return { status: 404, error: 'Bonus game session not found.' };
        }
        if (session.status !== 'active') {
          return { status: 400, error: 'Bonus game already claimed.' };
        }
        if (session.pickedIndices.includes(idx)) {
          return { status: 400, error: 'Vault already opened.' };
        }

        const vault = session.vaults[idx];
        session.pickedIndices.push(idx);
        if (vault.kind === 'mult') {
          session.totalMultiplier = roundBirr(session.totalMultiplier + vault.value);
        } else {
          session.freeSpinsAwarded += vault.value;
        }

        let payoutBirr = 0;
        let bonusFreeSpins = 0;
        const completed = session.pickedIndices.length >= session.maxPicks;

        if (completed) {
          session.status = 'claimed';
          payoutBirr = roundBirr(session.stakeBirr * session.totalMultiplier);
          session.payoutBirr = payoutBirr;
          bonusFreeSpins = session.freeSpinsAwarded;

          if (payoutBirr > 0) {
            user.balanceBirr = roundBirr(user.balanceBirr + payoutBirr);
            user.wins += 1;
          }
          user.gamesPlayed += 1;

          const game = db.games.find((g) => g.slug === session.gameSlug);
          if (game) game.playCount += 1;

          if (bonusFreeSpins > 0) {
            const userMap = db.freeSpinsByUser[user.id] || {};
            const prev = userMap[session.gameSlug];
            userMap[session.gameSlug] = {
              gameSlug: session.gameSlug,
              remaining: (prev?.remaining || 0) + bonusFreeSpins,
              stakeBirr: prev ? Math.max(prev.stakeBirr, session.stakeBirr) : session.stakeBirr,
              multiplierBoost: 2,
              totalWonBirr: prev?.totalWonBirr || 0,
              spinsPlayed: prev?.spinsPlayed || 0,
              source: 'bonus_vault',
            };
            db.freeSpinsByUser[user.id] = userMap;
          }

          db.sessions.unshift({
            id: `ses_${crypto.randomUUID()}`,
            userId: user.id,
            gameSlug: session.gameSlug,
            gameTitle: `${game?.title || session.gameSlug} (Vault Bonus)`,
            score: Math.round(session.totalMultiplier * 100),
            stakeBirr: session.stakeBirr,
            payoutBirr,
            bonusBirr: 0,
            multiplier: session.totalMultiplier,
            outcome: payoutBirr > 0 ? 'win' : 'loss',
            playedAt: new Date().toISOString(),
          });
          if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
        }

        await writeDb(db);

        const clientSession = {
          id: session.id,
          gameSlug: session.gameSlug,
          stakeBirr: session.stakeBirr,
          maxPicks: session.maxPicks,
          pickedIndices: [...session.pickedIndices],
          vaults: session.vaults.map((v, i) =>
            completed || session.pickedIndices.includes(i)
              ? { index: i, revealed: true, kind: v.kind, value: v.value, label: v.label }
              : { index: i, revealed: false }
          ),
          status: session.status,
          totalMultiplier: session.totalMultiplier,
          freeSpinsAwarded: session.freeSpinsAwarded,
          payoutBirr: session.payoutBirr,
          createdAt: session.createdAt,
        };

        return {
          status: 200,
          body: {
            ok: true,
            revealedVault: vault,
            bonusSession: clientSession,
            payoutBirr,
            bonusFreeSpins,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Claim daily challenge Birr reward
  router.post('/challenges/:id/claim', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const result = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const challenge = db.challenges.find((c) => c.id === req.params.id);
        if (!challenge) return { status: 404, error: 'Challenge not found.' };

        const userProgress = db.challengeProgressByUser[user.id] || {};
        const entry = userProgress[challenge.id];
        if (!entry || entry.isClaimed || entry.progressValue < challenge.targetValue) {
          return { status: 400, error: 'Challenge is not ready to claim.' };
        }

        entry.isClaimed = true;
        userProgress[challenge.id] = entry;
        db.challengeProgressByUser[user.id] = userProgress;
        user.balanceBirr = roundBirr(user.balanceBirr + challenge.rewardBirr);
        user.bonusBirrReceived = roundBirr((user.bonusBirrReceived || 0) + challenge.rewardBirr);
        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, user) };
      });

      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ snapshot: result.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Submit Telebirr deposit request (1:1 ETB/Birr, dynamic admin min deposit)
  router.post('/wallet/deposits', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const {
        amountBirr,
        agentId,
        telebirrReference,
        senderPhone,
        screenshotDataUrl,
        screenshotFileName,
      } = req.body as {
        amountBirr?: number;
        agentId?: string;
        telebirrReference?: string;
        senderPhone?: string;
        screenshotDataUrl?: string;
        screenshotFileName?: string;
      };

      const amount = roundBirr(Number(amountBirr));
      const cleanRef = (telebirrReference || '').trim().slice(0, 64);
      const savedScreenshotUrl = screenshotDataUrl
        ? saveScreenshotDataUrl(screenshotDataUrl)
        : undefined;

      if (!cleanRef && !savedScreenshotUrl) {
        res.status(400).json({
          error: 'Please enter your Telebirr Reference No. or upload a payment screenshot.',
        });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        if (checkAndRecordIdempotency(db, `dep:${user.id}`, req)) {
          return { status: 409, error: 'Duplicate deposit submission detected. Please wait.' };
        }

        const minDep = Math.max(1, roundBirr(db.platformSettings.minDepositEtb || MIN_DEPOSIT_BIRR));
        if (!Number.isFinite(amount) || amount < minDep) {
          return { status: 400, error: `Minimum deposit amount is ${minDep} ETB.` };
        }

        const activeAgents = db.agents.filter((a) => a.isActive);
        const chosenAgent =
          activeAgents.find((a) => a.id === agentId) ||
          activeAgents.find((a) => a.isPrimary) ||
          activeAgents[0] ||
          db.agents[0];

        if (!chosenAgent) {
          return { status: 400, error: 'No active Telebirr deposit agent configured.' };
        }

        const nowIso = new Date().toISOString();
        const request: StoredDeposit = {
          id: `dep_${crypto.randomUUID()}`,
          userId: user.id,
          username: user.username,
          amountBirr: amount,
          agentId: chosenAgent.id,
          agentName: chosenAgent.name,
          agentPhone: chosenAgent.phone,
          telebirrReference: cleanRef || undefined,
          senderPhone: (senderPhone || '').trim().slice(0, 24) || undefined,
          screenshotDataUrl: savedScreenshotUrl,
          screenshotFileName: screenshotFileName?.slice(0, 120) || undefined,
          status: 'pending',
          createdAt: nowIso,
        };

        db.depositRequests.unshift(request);
        appendTransaction(db.transactions, {
          id: `tx_dep_${request.id}`,
          userId: user.id,
          username: user.username,
          transactionType: 'deposit',
          amount,
          status: 'pending',
          referenceNumber: cleanRef || createTxReference('DEP'),
          note: `Telebirr deposit via ${chosenAgent.name}`,
          createdAt: nowIso,
        });
        await writeDb(db);
        return { status: 201, request, snapshot: buildClientPayload(db, user) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(201).json({ request: outcome.request, snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Submit Telebirr withdrawal request (places ETB in pending hold)
  router.post('/wallet/withdrawals', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { amountBirr, telebirrPhone, recipientName } = req.body as {
        amountBirr?: number;
        telebirrPhone?: string;
        recipientName?: string;
      };

      const amount = roundBirr(Number(amountBirr));
      const cleanPhone = (telebirrPhone || '').trim();
      const cleanName = (recipientName || '').trim().slice(0, 60);
      if (!isValidEthiopianPhone(cleanPhone)) {
        res.status(400).json({
          error: 'Enter a valid Ethiopian Telebirr phone number (e.g. 0911223344).',
        });
        return;
      }
      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Enter the Telebirr account holder full name.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        if (checkAndRecordIdempotency(db, `wd:${user.id}`, req)) {
          return { status: 409, error: 'Duplicate withdrawal submission detected. Please wait.' };
        }

        const minWd = Math.max(1, roundBirr(db.platformSettings.minWithdrawalEtb || MIN_WITHDRAWAL_BIRR));
        if (!Number.isFinite(amount) || amount < minWd) {
          return { status: 400, error: `Minimum withdrawal is ${minWd} ETB.` };
        }
        if (amount > user.balanceBirr) {
          return { status: 400, error: 'Insufficient ETB balance for this withdrawal.' };
        }

        user.balanceBirr = roundBirr(user.balanceBirr - amount);
        const nowIso = new Date().toISOString();

        const withdrawal: StoredWithdrawal = {
          id: `wd_${crypto.randomUUID()}`,
          userId: user.id,
          username: user.username,
          amountBirr: amount,
          telebirrPhone: cleanPhone,
          recipientName: cleanName,
          status: 'pending',
          createdAt: nowIso,
        };

        db.withdrawalRequests.unshift(withdrawal);
        appendTransaction(db.transactions, {
          id: `tx_wd_${withdrawal.id}`,
          userId: user.id,
          username: user.username,
          transactionType: 'withdrawal',
          amount,
          status: 'pending',
          referenceNumber: createTxReference('WD'),
          note: `Telebirr withdrawal to ${cleanPhone}`,
          createdAt: nowIso,
        });
        await writeDb(db);
        return { status: 201, withdrawal, snapshot: buildClientPayload(db, user) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(201).json({ request: outcome.withdrawal, snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Update Game configuration (odds, bonuses, decimal min stake >= 0.10 ETB, visibility)
  router.post('/admin/games', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const payload = req.body as Partial<StoredGame> & { id: string };
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const idx = db.games.findIndex((g) => g.id === payload.id);
        if (idx < 0) return { status: 404, error: 'Game not found.' };

        const cur = db.games[idx];
        const nextGame: StoredGame = {
          ...cur,
          title: payload.title ? payload.title.trim().slice(0, 60) : cur.title,
          subtitle: payload.subtitle ? payload.subtitle.trim().slice(0, 120) : cur.subtitle,
          description: payload.description ? payload.description.trim().slice(0, 300) : cur.description,
          minStakeBirr: Math.max(
            MIN_STAKE_BIRR,
            roundBirr(Number(payload.minStakeBirr ?? cur.minStakeBirr))
          ),
          playerWinPercent: clampWinPercent(payload.playerWinPercent, cur.playerWinPercent),
          bonusBirr: Math.max(0, roundBirr(Number(payload.bonusBirr ?? cur.bonusBirr))),
          maxMultiplier: Math.max(
            1.5,
            Math.min(25, roundBirr(Number(payload.maxMultiplier ?? cur.maxMultiplier)))
          ),
          cashoutEnabled:
            typeof payload.cashoutEnabled === 'boolean'
              ? payload.cashoutEnabled
              : cur.cashoutEnabled,
          isFeatured: typeof payload.isFeatured === 'boolean' ? payload.isFeatured : cur.isFeatured,
          isPopular: typeof payload.isPopular === 'boolean' ? payload.isPopular : cur.isPopular,
          isActive: typeof payload.isActive === 'boolean' ? payload.isActive : cur.isActive,
        };
        db.games[idx] = nextGame;

        if (nextGame.engine === 'keno') {
          setLiveRoundOddsConfig({ kenoPlayerWinPercent: nextGame.playerWinPercent });
        } else if (nextGame.engine === 'bingo') {
          setLiveRoundOddsConfig({ bingoPlayerWinPercent: nextGame.playerWinPercent });
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'UPDATE_GAME_CONFIG',
          targetType: 'game',
          affectedLabel: nextGame.title,
          previousValue: `minStake=${cur.minStakeBirr}, winPct=${cur.playerWinPercent}, active=${cur.isActive}`,
          newValue: `minStake=${nextGame.minStakeBirr}, winPct=${nextGame.playerWinPercent}, active=${nextGame.isActive}`,
        });

        await writeDb(db);
        onLiveRoundMutated?.();
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Add or Update Telebirr Agent
  router.post('/admin/agents', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id, name, phone, note, isActive, isPrimary } = req.body as Partial<StoredAgent>;
      const cleanName = (name || '').trim().slice(0, 40);
      const cleanPhone = (phone || '').trim().slice(0, 24);

      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Agent name must be at least 2 characters.' });
        return;
      }
      if (!isValidEthiopianPhone(cleanPhone)) {
        res.status(400).json({ error: 'Enter a valid Ethiopian Telebirr phone number (e.g. 0911626671).' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const makePrimary = Boolean(isPrimary);
        if (makePrimary) {
          for (const a of db.agents) a.isPrimary = false;
        }

        if (id) {
          const existing = db.agents.find((a) => a.id === id);
          if (!existing) return { status: 404, error: 'Agent not found.' };
          existing.name = cleanName;
          existing.phone = cleanPhone;
          existing.note = note?.trim() || undefined;
          existing.isActive = typeof isActive === 'boolean' ? isActive : existing.isActive;
          if (makePrimary) {
            existing.isPrimary = true;
            existing.isActive = true;
          }
        } else {
          const agent: StoredAgent = {
            id: `agent_${crypto.randomUUID()}`,
            name: cleanName,
            phone: cleanPhone,
            note: note?.trim() || undefined,
            isActive: isActive !== false,
            isPrimary: makePrimary || db.agents.length === 0,
          };
          db.agents.push(agent);
        }

        if (!db.agents.some((a) => a.isPrimary) && db.agents.length > 0) {
          db.agents[0].isPrimary = true;
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: id ? 'UPDATE_TELEBIRR_DEPOSIT_NUMBER' : 'ADD_TELEBIRR_DEPOSIT_NUMBER',
          targetType: 'settings',
          affectedLabel: `${cleanName} (${cleanPhone})`,
          newValue: `primary=${makePrimary}`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Delete Telebirr Agent (must retain at least 1 agent)
  router.delete('/admin/agents/:id', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };
        if (db.agents.length <= 1) {
          return { status: 400, error: 'At least one Telebirr agent must remain active.' };
        }
        const idx = db.agents.findIndex((a) => a.id === req.params.id);
        if (idx < 0) return { status: 404, error: 'Agent not found.' };
        const removed = db.agents[idx];
        db.agents.splice(idx, 1);
        if (!db.agents.some((a) => a.isPrimary) && db.agents.length > 0) {
          db.agents[0].isPrimary = true;
          db.agents[0].isActive = true;
        }
        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'DELETE_TELEBIRR_DEPOSIT_NUMBER',
          targetType: 'settings',
          affectedLabel: `${removed.name} (${removed.phone})`,
        });
        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Grant Birr Bonus to a single player or all active players
  router.post('/admin/bonuses/grant', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { targetUserId, amountBirr, reason } = req.body as {
        targetUserId?: string | 'ALL';
        amountBirr?: number;
        reason?: string;
      };
      const amount = roundBirr(Number(amountBirr));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000) {
        res.status(400).json({ error: 'Bonus amount must be between 1 and 50,000 Birr.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const cleanReason = (reason || 'Admin Birr Bonus').trim().slice(0, 80);
        const nowIso = new Date().toISOString();

        if (targetUserId === 'ALL') {
          const targets = db.users.filter((u) => !u.isBanned);
          for (const u of targets) {
            u.balanceBirr = roundBirr(u.balanceBirr + amount);
            u.bonusBirrReceived = roundBirr((u.bonusBirrReceived || 0) + amount);
            appendTransaction(db.transactions, {
              userId: u.id,
              username: u.username,
              transactionType: 'bonus',
              amount,
              status: 'completed',
              referenceNumber: createTxReference('BON'),
              note: cleanReason,
              createdAt: nowIso,
            });
          }
          db.bonusGrants.unshift({
            id: `bon_${crypto.randomUUID()}`,
            userId: 'ALL',
            username: `All Active Players (${targets.length})`,
            amountBirr: amount,
            reason: cleanReason,
            grantedBy: admin.username,
            createdAt: nowIso,
          });
          appendAuditLog(db.auditLogs, {
            administratorId: admin.id,
            administratorUsername: admin.username,
            action: 'GRANT_BONUS_ALL',
            targetType: 'user',
            affectedLabel: `All Active (${targets.length})`,
            newValue: `+${amount} ETB (${cleanReason})`,
          });
        } else {
          const target = db.users.find((u) => u.id === targetUserId);
          if (!target) return { status: 404, error: 'Player not found.' };
          const prevBal = target.balanceBirr;
          target.balanceBirr = roundBirr(target.balanceBirr + amount);
          target.bonusBirrReceived = roundBirr((target.bonusBirrReceived || 0) + amount);
          db.bonusGrants.unshift({
            id: `bon_${crypto.randomUUID()}`,
            userId: target.id,
            username: target.username,
            amountBirr: amount,
            reason: cleanReason,
            grantedBy: admin.username,
            createdAt: nowIso,
          });
          appendTransaction(db.transactions, {
            userId: target.id,
            username: target.username,
            transactionType: 'bonus',
            amount,
            status: 'completed',
            referenceNumber: createTxReference('BON'),
            note: cleanReason,
            createdAt: nowIso,
          });
          appendAuditLog(db.auditLogs, {
            administratorId: admin.id,
            administratorUsername: admin.username,
            action: 'GRANT_BONUS_USER',
            targetType: 'user',
            affectedUserId: target.id,
            affectedLabel: target.username,
            previousValue: `${prevBal} ETB`,
            newValue: `${target.balanceBirr} ETB (+${amount} ETB: ${cleanReason})`,
          });
        }

        if (db.bonusGrants.length > 200) db.bonusGrants = db.bonusGrants.slice(0, 200);
        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Update User (role / ban / Birr delta)
  router.patch('/admin/users/:id', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { toggleBan, toggleRole, birrDelta } = req.body as {
        toggleBan?: boolean;
        toggleRole?: boolean;
        birrDelta?: number;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };
        const target = db.users.find((u) => u.id === req.params.id);
        if (!target) return { status: 404, error: 'User not found.' };

        const prevSummary = `role=${target.role}, banned=${target.isBanned}, bal=${target.balanceBirr}`;
        if (toggleBan && target.id !== admin.id) {
          target.isBanned = !target.isBanned;
          target.playerStatus = target.isBanned ? 'suspended' : 'active';
          target.tokenVersion = (target.tokenVersion ?? 1) + 1;
        }
        if (toggleRole && target.id !== admin.id) {
          target.role = target.role === 'admin' ? 'player' : 'admin';
          target.tokenVersion = (target.tokenVersion ?? 1) + 1;
          const ap = db.agentProfiles.find((a) => a.userId === target.id);
          target.accountType =
            target.role === 'admin'
              ? 'admin'
              : ap?.applicationStatus === 'approved'
                ? 'agent'
                : 'player';
        }
        if (typeof birrDelta === 'number' && Number.isFinite(birrDelta) && birrDelta !== 0) {
          if (Math.abs(birrDelta) > 100_000) {
            return { status: 400, error: 'Single balance adjustment cannot exceed 100,000 ETB.' };
          }
          target.balanceBirr = Math.max(0, roundBirr(target.balanceBirr + birrDelta));
          appendTransaction(db.transactions, {
            userId: target.id,
            username: target.username,
            transactionType: 'adjustment',
            amount: roundBirr(birrDelta),
            status: 'completed',
            referenceNumber: createTxReference('ADJ'),
            note: `Admin balance adjustment by ${admin.username}`,
          });
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'UPDATE_USER_ACCOUNT',
          targetType: 'user',
          affectedUserId: target.id,
          affectedLabel: target.username,
          previousValue: prevSummary,
          newValue: `role=${target.role}, banned=${target.isBanned}, bal=${target.balanceBirr}`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Review Deposit (1:1 ETB credit)
  router.post(
    '/admin/deposits/:id/review',
    walletLimiter,
    requireAdmin,
    async (req: AuthedRequest, res, next) => {
      try {
        const { decision, adminNote } = req.body as {
          decision: 'approved' | 'rejected';
          adminNote?: string;
        };
        if (decision !== 'approved' && decision !== 'rejected') {
          res.status(400).json({ error: 'Invalid review decision.' });
          return;
        }

        const outcome = await withDbMutation(async () => {
          const db = await readDb();
          const admin = extractUserFromDb(req, db);
          if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

          const dep = db.depositRequests.find((d) => d.id === req.params.id);
          if (!dep || dep.status !== 'pending') {
            return { status: 400, error: 'Pending deposit request not found.' };
          }

          dep.status = decision;
          dep.adminNote = (adminNote || '').trim().slice(0, 120) || undefined;
          dep.reviewedAt = new Date().toISOString();

          if (decision === 'approved') {
            const targetUser = db.users.find((u) => u.id === dep.userId);
            if (targetUser) {
              targetUser.balanceBirr = roundBirr(targetUser.balanceBirr + dep.amountBirr);
            }
            approveVerifiedClientRewards({
              db,
              referredUserId: dep.userId,
              actorUsername: admin.username,
              nowIso: dep.reviewedAt,
            });
          }

          const linkedTx = db.transactions.find((t) => t.id === `tx_dep_${dep.id}`);
          if (linkedTx) {
            linkedTx.status = decision === 'approved' ? 'approved' : 'rejected';
          } else {
            appendTransaction(db.transactions, {
              id: `tx_dep_${dep.id}`,
              userId: dep.userId,
              username: dep.username,
              transactionType: 'deposit',
              amount: dep.amountBirr,
              status: decision === 'approved' ? 'approved' : 'rejected',
              referenceNumber: dep.telebirrReference || createTxReference('DEP'),
              note: `Telebirr deposit (${decision})`,
            });
          }

          appendAuditLog(db.auditLogs, {
            administratorId: admin.id,
            administratorUsername: admin.username,
            action: decision === 'approved' ? 'APPROVE_DEPOSIT' : 'REJECT_DEPOSIT',
            targetType: 'deposit',
            affectedUserId: dep.userId,
            affectedLabel: `${dep.username} (${dep.amountBirr} ETB)`,
            previousValue: 'pending',
            newValue: `${decision}${dep.adminNote ? ` (${dep.adminNote})` : ''}`,
          });

          await writeDb(db);
          return { status: 200, snapshot: buildClientPayload(db, admin) };
        });

        if ('error' in outcome) {
          res.status(outcome.status).json({ error: outcome.error });
          return;
        }
        res.json({ snapshot: outcome.snapshot });
      } catch (err) {
        next(err);
      }
    }
  );

  // Admin: Review Withdrawal (approve payout or reject & refund Birr)
  router.post(
    '/admin/withdrawals/:id/review',
    walletLimiter,
    requireAdmin,
    async (req: AuthedRequest, res, next) => {
      try {
        const { decision, payoutReference, adminNote } = req.body as {
          decision: 'approved' | 'rejected';
          payoutReference?: string;
          adminNote?: string;
        };
        if (decision !== 'approved' && decision !== 'rejected') {
          res.status(400).json({ error: 'Invalid review decision.' });
          return;
        }

        const outcome = await withDbMutation(async () => {
          const db = await readDb();
          const admin = extractUserFromDb(req, db);
          if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

          const wd = db.withdrawalRequests.find((w) => w.id === req.params.id);
          if (!wd || wd.status !== 'pending') {
            return { status: 400, error: 'Pending withdrawal request not found.' };
          }

          wd.status = decision;
          wd.payoutReference = (payoutReference || '').trim().slice(0, 64) || undefined;
          wd.adminNote = (adminNote || '').trim().slice(0, 120) || undefined;
          wd.reviewedAt = new Date().toISOString();

          if (decision === 'rejected') {
            const targetUser = db.users.find((u) => u.id === wd.userId);
            if (targetUser) {
              targetUser.balanceBirr = roundBirr(targetUser.balanceBirr + wd.amountBirr);
            }
          }

          const linkedTx = db.transactions.find((t) => t.id === `tx_wd_${wd.id}`);
          if (linkedTx) {
            linkedTx.status = decision === 'approved' ? 'approved' : 'refunded';
            if (wd.payoutReference) linkedTx.referenceNumber = wd.payoutReference;
          } else {
            appendTransaction(db.transactions, {
              id: `tx_wd_${wd.id}`,
              userId: wd.userId,
              username: wd.username,
              transactionType: 'withdrawal',
              amount: wd.amountBirr,
              status: decision === 'approved' ? 'approved' : 'refunded',
              referenceNumber: wd.payoutReference || createTxReference('WD'),
              note: `Telebirr withdrawal (${decision})`,
            });
          }

          appendAuditLog(db.auditLogs, {
            administratorId: admin.id,
            administratorUsername: admin.username,
            action: decision === 'approved' ? 'APPROVE_WITHDRAWAL' : 'REJECT_WITHDRAWAL',
            targetType: 'withdrawal',
            affectedUserId: wd.userId,
            affectedLabel: `${wd.username} (${wd.amountBirr} ETB)`,
            previousValue: 'pending',
            newValue: `${decision}${wd.payoutReference ? ` ref:${wd.payoutReference}` : ''}`,
          });

          await writeDb(db);
          return { status: 200, snapshot: buildClientPayload(db, admin) };
        });

        if ('error' in outcome) {
          res.status(outcome.status).json({ error: outcome.error });
          return;
        }
        res.json({ snapshot: outcome.snapshot });
      } catch (err) {
        next(err);
      }
    }
  );

  // Live synchronized Keno & Bingo round status
  router.get('/live-rounds', async (_req, res, next) => {
    try {
      const seed = await getActiveRoundSeed();
      res.json(getLiveRoundsSnapshot(seed));
    } catch (err) {
      next(err);
    }
  });

  // Lock Keno numbers with Birr stake onto the active synchronized round
  router.post('/live-rounds/keno/lock', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, picks, stakeBirr } = req.body as {
        roundId?: number;
        picks?: number[];
        stakeBirr?: number;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Sign in and deposit Birr to play Keno.' };
        }

        const game = db.games.find((g) => g.engine === 'keno');
        const minStake = Math.max(MIN_STAKE_BIRR, game?.minStakeBirr ?? MIN_STAKE_BIRR);
        const cleanStake = roundBirr(Number(stakeBirr));
        if (!Number.isFinite(cleanStake) || cleanStake < minStake) {
          return { status: 400, error: `Minimum Keno stake is ${minStake} Birr.` };
        }
        if (user.balanceBirr < cleanStake) {
          return { status: 400, error: 'Insufficient Birr balance. Deposit via Telebirr first.' };
        }

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const result = lockKenoTicket({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
          userId: user.id,
          username: user.username,
          picks: Array.isArray(picks) ? picks : [],
          stakeBirr: cleanStake,
          playerWinPercent: game?.playerWinPercent ?? 30,
          bonusBirr: game?.bonusBirr ?? 0,
        });

        if (!result.ok) {
          return { status: 400, error: result.error || 'Could not lock Keno ticket.' };
        }

        user.balanceBirr = roundBirr(user.balanceBirr - cleanStake);
        if (game) game.playCount += 1;
        await writeDb(db);
        onLiveRoundMutated?.();

        return {
          status: 200,
          body: {
            ok: true,
            ticket: result.ticket,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Authoritatively settle a Keno round ticket in Birr
  router.post('/live-rounds/keno/settle', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, gameSlug, gameTitle } = req.body as {
        roundId?: number;
        gameSlug?: string;
        gameTitle?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const slug = gameSlug || 'axum-keno-draw';
        const game = db.games.find((g) => g.slug === slug);

        const settlement = settleKenoTicket({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
          username: user.username,
          playerWinPercent: game?.playerWinPercent ?? 30,
          bonusBirr: game?.bonusBirr ?? 0,
          maxMultiplier: game?.maxMultiplier ?? 6,
        });

        if (!settlement.ok) {
          return { status: 400, error: settlement.error || 'Could not settle Keno round.' };
        }

        if (!settlement.alreadySettled) {
          if (settlement.payoutBirr > 0) {
            user.balanceBirr = roundBirr(user.balanceBirr + settlement.payoutBirr);
          }
          user.gamesPlayed += 1;
          if (settlement.isWin) {
            user.wins += 1;
            user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
          }

          db.sessions.unshift({
            id: `ses_${crypto.randomUUID()}`,
            userId: user.id,
            gameSlug: slug,
            gameTitle: gameTitle || game?.title || 'Axum Keno: Number Draw',
            score: settlement.hits,
            stakeBirr: settlement.stakeBirr,
            payoutBirr: settlement.payoutBirr,
            bonusBirr: settlement.isWin ? game?.bonusBirr ?? 0 : 0,
            multiplier: settlement.multiplier,
            outcome: settlement.isWin ? 'win' : 'loss',
            playedAt: new Date().toISOString(),
          });
          if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
          await writeDb(db);
          onLiveRoundMutated?.();
        }

        return {
          status: 200,
          body: {
            ok: true,
            result: settlement,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Get the 40-card deck for a live Bingo round & which cards are taken
  router.get('/live-rounds/bingo/deck', async (req, res, next) => {
    try {
      const { db, user } = await getAuthContext(req);
      const seed = db.liveRoundSeed || db.sessionSecret;
      cachedRoundSeed = seed;

      const roundIdParam = req.query.roundId ? Number(req.query.roundId) : undefined;
      const clientIdParam =
        typeof req.query.clientId === 'string' ? req.query.clientId : 'anon';
      const playerKey = user
        ? `user:${user.id}`
        : `guest:${clientIdParam.slice(0, 64)}`;

      res.json(
        getBingoRoundDeck({
          seed,
          roundId: roundIdParam,
          playerKey,
        })
      );
    } catch (err) {
      next(err);
    }
  });

  // Lock 1-4 chosen Bingo cards with Birr stake per card
  router.post('/live-rounds/bingo/lock', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, cardNumbers, stakePerCardBirr } = req.body as {
        roundId?: number;
        cardNumbers?: number[];
        stakePerCardBirr?: number;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) {
          return { status: 401, error: 'Sign in and deposit Birr to play Bingo.' };
        }

        const game = db.games.find((g) => g.engine === 'bingo');
        const minStake = Math.max(MIN_STAKE_BIRR, game?.minStakeBirr ?? MIN_STAKE_BIRR);
        const cleanPerCard = roundBirr(Number(stakePerCardBirr));
        if (!Number.isFinite(cleanPerCard) || cleanPerCard < minStake) {
          return { status: 400, error: `Minimum stake per card is ${minStake} Birr.` };
        }

        const cardsCount = Array.isArray(cardNumbers) ? new Set(cardNumbers).size : 0;
        const neededTotal = roundBirr(cleanPerCard * cardsCount);
        if (cardsCount > 0 && user.balanceBirr < neededTotal) {
          return {
            status: 400,
            error: `Need ${neededTotal.toFixed(2)} Birr for ${cardsCount} card(s).`,
          };
        }

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;
        const playerKey = `user:${user.id}`;

        const result = lockBingoCards({
          seed,
          roundId: Number(roundId),
          playerKey,
          userId: user.id,
          username: user.username,
          cardNumbers: Array.isArray(cardNumbers) ? cardNumbers : [],
          stakePerCardBirr: cleanPerCard,
          playerWinPercent: game?.playerWinPercent ?? 30,
          bonusBirr: game?.bonusBirr ?? 0,
        });

        if (!result.ok) {
          return { status: 400, error: result.error || 'Could not lock Bingo cards.' };
        }

        const cost = result.totalStakeBirr || neededTotal;
        user.balanceBirr = roundBirr(Math.max(0, user.balanceBirr - cost));
        if (game) game.playCount += 1;
        await writeDb(db);
        onLiveRoundMutated?.();

        return {
          status: 200,
          body: {
            ok: true,
            lockedCards: result.lockedCards,
            totalStakeBirr: cost,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
            deck: getBingoRoundDeck({ seed, roundId: Number(roundId), playerKey }),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Authoritatively verify & claim a live synchronized Bingo win in Birr
  router.post('/live-rounds/bingo/claim', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, cardNumber, cardValues, gameSlug, gameTitle } = req.body as {
        roundId?: number;
        cardNumber?: number;
        cardValues?: Array<number | 'FREE'>;
        gameSlug?: string;
        gameTitle?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const slug = gameSlug || 'highland-bingo-75';
        const game = db.games.find((g) => g.slug === slug);

        const claim = claimLiveBingo({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
          username: user.username,
          cardNumber: cardNumber !== undefined ? Number(cardNumber) : undefined,
          cardValues: Array.isArray(cardValues) ? cardValues : [],
          playerWinPercent: game?.playerWinPercent ?? 30,
          bonusBirr: game?.bonusBirr ?? 0,
          maxMultiplier: game?.maxMultiplier ?? 5,
        });

        if (!claim.ok) {
          if (claim.houseWonFirst) {
            user.gamesPlayed += 1;
            db.sessions.unshift({
              id: `ses_${crypto.randomUUID()}`,
              userId: user.id,
              gameSlug: slug,
              gameTitle: gameTitle || game?.title || 'Highland Bingo: 75-Ball',
              score: 0,
              stakeBirr: claim.stakeBirr,
              payoutBirr: 0,
              bonusBirr: 0,
              multiplier: 0,
              outcome: 'loss',
              playedAt: new Date().toISOString(),
            });
            await writeDb(db);
            return {
              status: 400,
              error: claim.error || 'House AI called Bingo first.',
              snapshot: buildClientPayload(db, user),
            };
          }
          return { status: 400, error: claim.error || 'Could not verify Bingo claim.' };
        }

        if (!claim.alreadyClaimed) {
          user.balanceBirr = roundBirr(user.balanceBirr + claim.payoutBirr);
          user.gamesPlayed += 1;
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);

          db.sessions.unshift({
            id: `ses_${crypto.randomUUID()}`,
            userId: user.id,
            gameSlug: slug,
            gameTitle: gameTitle || game?.title || 'Highland Bingo: 75-Ball',
            score: claim.score,
            stakeBirr: claim.stakeBirr,
            payoutBirr: claim.payoutBirr,
            bonusBirr: game?.bonusBirr ?? 0,
            multiplier: claim.multiplier,
            outcome: 'win',
            playedAt: new Date().toISOString(),
          });
          if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
          await writeDb(db);
          onLiveRoundMutated?.();
        }

        return {
          status: 200,
          body: {
            ok: true,
            result: claim,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({
          error: outcome.error,
          ...('snapshot' in outcome ? { snapshot: outcome.snapshot } : {}),
        });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Early Cash Out on a live Keno round while balls are popping (requires 1+ hit)
  router.post('/live-rounds/keno/cashout', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, gameSlug, gameTitle } = req.body as {
        roundId?: number;
        gameSlug?: string;
        gameTitle?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const slug = gameSlug || 'axum-keno-draw';
        const game = db.games.find((g) => g.slug === slug);
        if (game && !game.cashoutEnabled) {
          return { status: 400, error: 'Early Cash Out is disabled for Keno.' };
        }

        const co = cashoutKenoTicket({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
          username: user.username,
          maxMultiplier: game?.maxMultiplier ?? 6,
        });

        if (!co.ok) {
          return { status: 400, error: co.error || 'Could not cash out Keno ticket.' };
        }

        if (co.payoutBirr > 0) {
          user.balanceBirr = roundBirr(user.balanceBirr + co.payoutBirr);
        }
        user.gamesPlayed += 1;
        if (co.payoutBirr >= co.stakeBirr) {
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
        }

        db.sessions.unshift({
          id: `ses_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: slug,
          gameTitle: gameTitle || game?.title || 'Axum Keno: Number Draw',
          score: co.hits,
          stakeBirr: co.stakeBirr,
          payoutBirr: co.payoutBirr,
          bonusBirr: co.bonusApplied,
          multiplier: co.multiplier,
          outcome: 'cashed_out',
          playedAt: new Date().toISOString(),
        });
        if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
        await writeDb(db);
        onLiveRoundMutated?.();

        return {
          status: 200,
          body: {
            ok: true,
            result: co,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Early Cash Out on a live Bingo round (3/5+ line before House AI reaches Bingo)
  router.post('/live-rounds/bingo/cashout', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, gameSlug, gameTitle } = req.body as {
        roundId?: number;
        gameSlug?: string;
        gameTitle?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const slug = gameSlug || 'highland-bingo-75';
        const game = db.games.find((g) => g.slug === slug);
        if (game && !game.cashoutEnabled) {
          return { status: 400, error: 'Early Cash Out is disabled for Bingo.' };
        }

        const co = cashoutLiveBingo({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
          username: user.username,
          maxMultiplier: game?.maxMultiplier ?? 5,
        });

        if (!co.ok) {
          return { status: 400, error: co.error || 'Could not cash out Bingo cards.' };
        }

        if (co.payoutBirr > 0) {
          user.balanceBirr = roundBirr(user.balanceBirr + co.payoutBirr);
        }
        user.gamesPlayed += 1;
        if (co.payoutBirr >= co.stakeBirr) {
          user.wins += 1;
          user.bestStreak = Math.max(user.bestStreak, user.bestStreak + 1);
        }

        db.sessions.unshift({
          id: `ses_${crypto.randomUUID()}`,
          userId: user.id,
          gameSlug: slug,
          gameTitle: gameTitle || game?.title || 'Highland Bingo: 75-Ball',
          score: co.bestLine,
          stakeBirr: co.stakeBirr,
          payoutBirr: co.payoutBirr,
          bonusBirr: co.bonusApplied,
          multiplier: co.multiplier,
          outcome: 'cashed_out',
          playedAt: new Date().toISOString(),
        });
        if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
        await writeDb(db);
        onLiveRoundMutated?.();

        return {
          status: 200,
          body: {
            ok: true,
            result: co,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Settle a locked Bingo round cleanly when House AI hits Bingo first
  router.post('/live-rounds/bingo/settle-loss', wagerLimiter, async (req, res, next) => {
    try {
      const { roundId, gameSlug, gameTitle } = req.body as {
        roundId?: number;
        gameSlug?: string;
        gameTitle?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const seed = db.liveRoundSeed || db.sessionSecret;
        cachedRoundSeed = seed;

        const slug = gameSlug || 'highland-bingo-75';
        const game = db.games.find((g) => g.slug === slug);

        const settled = settleBingoHouseLoss({
          seed,
          roundId: Number(roundId),
          playerKey: `user:${user.id}`,
        });

        if (!settled.ok) {
          return { status: 400, error: settled.error || 'Could not settle Bingo round.' };
        }

        if (!settled.alreadySettled) {
          user.gamesPlayed += 1;
          db.sessions.unshift({
            id: `ses_${crypto.randomUUID()}`,
            userId: user.id,
            gameSlug: slug,
            gameTitle: gameTitle || game?.title || 'Highland Bingo: 75-Ball',
            score: 0,
            stakeBirr: settled.stakeBirr,
            payoutBirr: 0,
            bonusBirr: 0,
            multiplier: 0,
            outcome: 'loss',
            playedAt: new Date().toISOString(),
          });
          if (db.sessions.length > 500) db.sessions = db.sessions.slice(0, 500);
          await writeDb(db);
          onLiveRoundMutated?.();
        }

        return {
          status: 200,
          body: {
            ok: true,
            result: settled,
            snapshot: buildClientPayload(db, user),
            rounds: getLiveRoundsSnapshot(seed),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // PLAYER-TO-AGENT CONVERSION, REFERRAL NETWORK, REWARDS, SUPPORT & ADMIN API
  // =========================================================================

  // Player: Submit Player-to-Agent Application (modifies existing player account, encrypted financials)
  router.post('/agent/apply', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const {
        fullLegalName,
        phone,
        bankName,
        bankAccountName,
        bankAccountNumber,
        cbeAccountDetails,
        telebirrAccount,
        verificationDocRef,
      } = req.body as {
        fullLegalName?: string;
        phone?: string;
        bankName?: string;
        bankAccountName?: string;
        bankAccountNumber?: string;
        cbeAccountDetails?: string;
        telebirrAccount?: string;
        verificationDocRef?: string;
      };

      const cleanLegal = (fullLegalName || '').trim().slice(0, 100);
      const cleanPhone = (phone || '').trim().slice(0, 24);
      const cleanBankName = (bankName || '').trim().slice(0, 80);
      const cleanBankAcctName = (bankAccountName || '').trim().slice(0, 100);
      const cleanBankAcctNum = (bankAccountNumber || '').trim().slice(0, 64);
      const cleanCbe = (cbeAccountDetails || '').trim().slice(0, 120);
      const cleanTelebirr = (telebirrAccount || '').trim().slice(0, 32);
      const cleanDocRef = (verificationDocRef || '').trim().slice(0, 80) || undefined;

      if (cleanLegal.length < 2) {
        res.status(400).json({ error: 'Enter your full legal name.' });
        return;
      }
      if (!isValidEthiopianPhone(cleanPhone)) {
        res.status(400).json({ error: 'Enter a valid Ethiopian contact phone number.' });
        return;
      }
      if (cleanBankName.length < 2 || cleanBankAcctName.length < 2 || cleanBankAcctNum.length < 4) {
        res.status(400).json({ error: 'Enter complete bank name, account holder name, and account number.' });
        return;
      }
      if (cleanCbe.length < 4) {
        res.status(400).json({ error: 'Enter your Commercial Bank of Ethiopia (CBE) account details.' });
        return;
      }
      if (!isValidEthiopianPhone(cleanTelebirr)) {
        res.status(400).json({ error: 'Enter a valid Ethiopian Telebirr account phone number.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        if (checkAndRecordIdempotency(db, `agent-apply:${user.id}`, req)) {
          return { status: 409, error: 'Duplicate agent application request.' };
        }

        const existing = db.agentProfiles.find((ap) => ap.userId === user.id);
        if (existing && (existing.applicationStatus === 'pending' || existing.applicationStatus === 'approved')) {
          return {
            status: 409,
            error:
              existing.applicationStatus === 'approved'
                ? 'Your account is already an approved agent.'
                : 'Your agent application is already pending administrator review.',
          };
        }
        if (existing && existing.applicationStatus === 'suspended') {
          return {
            status: 403,
            error: 'Your agent privileges are currently suspended. Contact customer support.',
          };
        }

        const approvedDepositsTotalEtb = db.depositRequests
          .filter((d) => d.userId === user.id && d.status === 'approved')
          .reduce((sum, d) => sum + (d.amountBirr || 0), 0);

        const elig = evaluateAgentEligibility({
          user,
          settings: db.platformSettings,
          approvedDepositsTotalEtb,
        });
        if (!elig.eligible) {
          return {
            status: 400,
            error: elig.reasons[0] || 'You do not yet meet agent eligibility requirements.',
          };
        }

        const encrypted = buildEncryptedAgentFinancials({
          bankAccountNumber: cleanBankAcctNum,
          cbeAccountDetails: cleanCbe,
          telebirrAccount: cleanTelebirr,
          secretSeed: db.sessionSecret,
        });

        const nowIso = new Date().toISOString();
        let saved: StoredAgentProfile;
        if (existing) {
          existing.fullLegalName = cleanLegal;
          existing.phone = cleanPhone;
          existing.bankName = cleanBankName;
          existing.bankAccountName = cleanBankAcctName;
          existing.encryptedBankAccount = encrypted.encryptedBankAccount;
          existing.encryptedCbeAccount = encrypted.encryptedCbeAccount;
          existing.encryptedTelebirrAccount = encrypted.encryptedTelebirrAccount;
          existing.verificationDocRef = cleanDocRef;
          existing.verificationStatus = 'pending';
          existing.applicationStatus = 'pending';
          existing.rejectionReason = undefined;
          existing.updatedAt = nowIso;
          saved = existing;
        } else {
          saved = {
            id: `agp_${crypto.randomUUID()}`,
            userId: user.id,
            username: user.username,
            fullLegalName: cleanLegal,
            phone: cleanPhone,
            bankName: cleanBankName,
            bankAccountName: cleanBankAcctName,
            encryptedBankAccount: encrypted.encryptedBankAccount,
            encryptedCbeAccount: encrypted.encryptedCbeAccount,
            encryptedTelebirrAccount: encrypted.encryptedTelebirrAccount,
            verificationStatus: 'pending',
            verificationDocRef: cleanDocRef,
            applicationStatus: 'pending',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          db.agentProfiles.unshift(saved);
        }

        await writeDb(db);
        return {
          status: 201,
          body: {
            agentProfile: sanitizeAgentProfile(saved, db.sessionSecret),
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Owner-only: Decrypt own Agent Financial Details
  router.get('/agent/financial-details', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { db, user } = await getAuthContext(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const profile = db.agentProfiles.find((ap) => ap.userId === user.id);
      if (!profile) {
        res.status(404).json({ error: 'No agent profile found for your account.' });
        return;
      }
      res.json(decryptAgentFinancialDetails(profile, db.sessionSecret));
    } catch (err) {
      next(err);
    }
  });

  // Approved Agent: Generate ONE permanent unique referral code
  router.post('/agent/referral-code', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { preferredCode } = req.body as { preferredCode?: string };
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        const profile = db.agentProfiles.find((ap) => ap.userId === user.id);
        if (!profile || profile.applicationStatus !== 'approved') {
          return {
            status: 403,
            error: 'Only approved agents can generate a permanent referral code.',
          };
        }
        if (profile.agentCode) {
          return {
            status: 409,
            error: 'Your permanent referral code has already been generated and cannot be duplicated.',
          };
        }

        const existingCodes = new Set(
          db.agentProfiles.map((ap) => (ap.agentCode || '').toUpperCase()).filter(Boolean)
        );
        const nextCode = generateUniqueAgentCode(user.username, existingCodes, preferredCode);
        const nowIso = new Date().toISOString();
        profile.agentCode = nextCode;
        profile.agentCodeCreatedAt = nowIso;
        profile.updatedAt = nowIso;

        await writeDb(db);
        const origin = resolvePublicOrigin(req);
        return {
          status: 201,
          body: {
            agentCode: nextCode,
            referralLink: `${origin}/register?ref=${encodeURIComponent(nextCode)}`,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Agent Dashboard Data (Overview, Referral List, Unlimited-Depth Tree, Rewards)
  router.get('/agent/dashboard', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { db, user } = await getAuthContext(req);
      if (!user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const targetUserId =
        user.role === 'admin' && typeof req.query.userId === 'string'
          ? req.query.userId
          : user.id;

      const profile = db.agentProfiles.find((ap) => ap.userId === targetUserId);
      if (!profile) {
        res.status(404).json({ error: 'Agent profile not found.' });
        return;
      }
      if (profile.applicationStatus !== 'approved' && user.role !== 'admin') {
        res.status(403).json({ error: 'Agent dashboard requires approved agent status.' });
        return;
      }

      const downstream = collectDownstreamRelationships({
        rootUserId: targetUserId,
        relationships: db.referralRelationships,
        users: db.users,
      });
      const directReferrals = downstream.filter((r) => r.depth === 1);
      const tree = buildReferralTree({
        rootUserId: targetUserId,
        users: db.users,
        agentProfiles: db.agentProfiles,
        relationships: db.referralRelationships,
      });

      const userById = new Map(db.users.map((u) => [u.id, u]));
      const activePlayerReferrals = downstream.filter((r) => {
        const u = userById.get(r.referredUserId);
        return r.referralType === 'player' && u && !u.isBanned && u.playerStatus !== 'suspended';
      }).length;
      const activeAgentReferrals = downstream.filter((r) => {
        const u = userById.get(r.referredUserId);
        return r.referralType === 'agent' && u && !u.isBanned && u.playerStatus !== 'suspended';
      }).length;

      const rewards = db.referralRewards
        .filter((r) => r.agentUserId === targetUserId)
        .map(buildClientRewardRecord);

      const pendingEtb = roundBirr(
        rewards
          .filter((r) => r.rewardStatus === 'pending')
          .reduce((sum, r) => sum + r.rewardAmountEtb, 0)
      );
      const approvedEtb = roundBirr(
        rewards
          .filter((r) => r.rewardStatus === 'approved')
          .reduce((sum, r) => sum + r.rewardAmountEtb, 0)
      );
      const redeemedEtb = roundBirr(
        rewards
          .filter((r) => r.rewardStatus === 'redeemed')
          .reduce((sum, r) => sum + r.rewardAmountEtb, 0)
      );

      const origin = resolvePublicOrigin(req);
      const referralLink = profile.agentCode
        ? `${origin}/register?ref=${encodeURIComponent(profile.agentCode)}`
        : '';

      res.json({
        profile: sanitizeAgentProfile(profile, db.sessionSecret),
        referralLink,
        directReferralCount: directReferrals.length,
        totalNetworkMembers: downstream.length,
        activePlayerReferrals,
        activeAgentReferrals,
        directReferrals,
        downstreamReferrals: downstream.filter((d) => d.depth >= 2),
        tree,
        rewards,
        rewardTotals: {
          eligibleEtb: roundBirr(approvedEtb + redeemedEtb),
          pendingEtb,
          approvedEtb,
          redeemedEtb,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Redeem approved non-deposit-funded referral rewards into Player ETB wallet (policy-governed)
  router.post('/agent/rewards/redeem', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };

        if (checkAndRecordIdempotency(db, `redeem:${user.id}`, req)) {
          return { status: 409, error: 'Duplicate reward redemption detected.' };
        }

        const policy = db.platformSettings.rewardPolicy;
        if (!policy.rewardsEnabled || !policy.allowSelfTransferToBalance) {
          return {
            status: 403,
            error: 'Self-transfer of referral rewards to ETB wallet is disabled by administrator policy.',
          };
        }

        const approved = db.referralRewards.filter(
          (r) => r.agentUserId === user.id && r.rewardStatus === 'approved'
        );
        const totalApproved = roundBirr(
          approved.reduce((sum, r) => sum + (r.rewardAmountEtb || 0), 0)
        );
        if (totalApproved <= 0) {
          return { status: 400, error: 'No approved rewards available to redeem.' };
        }
        if (totalApproved < policy.minRedeemEtb) {
          return {
            status: 400,
            error: `Minimum reward redemption is ${policy.minRedeemEtb} ETB (currently ${totalApproved} ETB approved).`,
          };
        }

        const nowIso = new Date().toISOString();
        const txRef = createTxReference('RDM');
        for (const rew of approved) {
          rew.rewardStatus = 'redeemed';
          rew.redeemedAt = nowIso;
          rew.redemptionTxRef = txRef;
        }

        user.balanceBirr = roundBirr(user.balanceBirr + totalApproved);
        appendTransaction(db.transactions, {
          userId: user.id,
          username: user.username,
          transactionType: 'reward_redemption',
          amount: totalApproved,
          status: 'completed',
          referenceNumber: txRef,
          note: `Redeemed ${approved.length} approved referral reward(s)`,
          createdAt: nowIso,
        });

        await writeDb(db);
        return {
          status: 200,
          body: {
            ok: true,
            redeemedAmountEtb: totalApproved,
            referenceNumber: txRef,
            snapshot: buildClientPayload(db, user),
          },
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.body);
    } catch (err) {
      next(err);
    }
  });

  // Player: Submit Customer Support Ticket
  router.post('/support/tickets', walletLimiter, requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { category, subject, message } = req.body as {
        category?: StoredSupportTicket['category'];
        subject?: string;
        message?: string;
      };
      const cleanSubj = (subject || '').trim().slice(0, 120);
      const cleanMsg = (message || '').trim().slice(0, 1200);
      if (cleanSubj.length < 3 || cleanMsg.length < 5) {
        res.status(400).json({ error: 'Enter a clear subject (3+ chars) and message (5+ chars).' });
        return;
      }

      const validCat: StoredSupportTicket['category'] =
        category === 'deposit' ||
        category === 'withdrawal' ||
        category === 'agent' ||
        category === 'referral' ||
        category === 'account'
          ? category
          : 'other';

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const user = extractUserFromDb(req, db);
        if (!user) return { status: 401, error: 'Authentication required.' };
        const nowIso = new Date().toISOString();
        const ticket: StoredSupportTicket = {
          id: `sup_${crypto.randomUUID()}`,
          userId: user.id,
          username: user.username,
          category: validCat,
          subject: cleanSubj,
          message: cleanMsg,
          status: 'open',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.supportTickets.unshift(ticket);
        if (db.supportTickets.length > 500) db.supportTickets = db.supportTickets.slice(0, 500);
        await writeDb(db);
        return { status: 201, ticket, snapshot: buildClientPayload(db, user) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(201).json({ ticket: outcome.ticket, snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Review Agent Application (approve / reject / verify ID; upgrades existing user cleanly)
  router.post('/admin/agent-applications/:agentId/review', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { decision, verificationStatus, rejectionReason } = req.body as {
        decision?: 'approve' | 'reject' | 'verify_only';
        verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
        rejectionReason?: string;
      };
      if (decision !== 'approve' && decision !== 'reject' && decision !== 'verify_only') {
        res.status(400).json({ error: 'Invalid agent review decision.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const profile = db.agentProfiles.find((ap) => ap.id === req.params.agentId);
        if (!profile) return { status: 404, error: 'Agent application not found.' };

        const targetUser = db.users.find((u) => u.id === profile.userId);
        if (!targetUser) return { status: 404, error: 'Associated player account not found.' };

        const prevStatus = `${profile.applicationStatus}/${profile.verificationStatus}`;
        const nowIso = new Date().toISOString();

        if (decision === 'verify_only') {
          if (verificationStatus) profile.verificationStatus = verificationStatus;
          profile.updatedAt = nowIso;
        } else if (decision === 'approve') {
          profile.applicationStatus = 'approved';
          profile.verificationStatus = verificationStatus || 'verified';
          profile.approvedAt = nowIso;
          profile.approvedBy = admin.username;
          profile.rejectionReason = undefined;
          profile.updatedAt = nowIso;

          // Upgrade existing player account in-place (never duplicate user!)
          if (targetUser.role !== 'admin') {
            targetUser.accountType = 'agent';
          }

          // Upgrade parent referral classification to 'agent' & activate pending/new promotional bonus if eligible
          approveVerifiedClientRewards({
            db,
            referredUserId: targetUser.id,
            actorUsername: admin.username,
            nowIso,
          });
          const parentRel = db.referralRelationships.find(
            (r) => r.referredUserId === targetUser.id
          );
          if (parentRel) {
            parentRel.referralType = 'agent';
            const parentAgentProfile = db.agentProfiles.find(
              (ap) => ap.id === parentRel.parentAgentId
            );
            const parentUser = db.users.find((u) => u.id === parentRel.parentAgentUserId);
            const policy = db.platformSettings.rewardPolicy;
            const alreadyIssued = db.referralRewards.some(
              (rw) =>
                rw.referredUserId === targetUser.id && rw.rewardType === 'agent_referral'
            );
            if (
              !alreadyIssued &&
              parentAgentProfile?.applicationStatus === 'approved' &&
              parentUser &&
              !parentUser.isBanned &&
              policy.rewardsEnabled &&
              policy.rewardMode !== 'manual_admin_only' &&
              policy.agentReferralBonusEtb > 0
            ) {
              const shouldAutoApprove =
                (policy.autoApproveRewards || policy.autoApproveOnClientVerification) &&
                !parentRel.isFlaggedDuplicate;
              const agentReward: StoredReferralReward = {
                id: `rew_${crypto.randomUUID()}`,
                agentId: parentAgentProfile.id,
                agentUserId: parentUser.id,
                agentUsername: parentUser.username,
                referralId: parentRel.id,
                referredUserId: targetUser.id,
                referredUsername: targetUser.username,
                rewardAmountEtb: policy.agentReferralBonusEtb,
                rewardType: 'agent_referral',
                rewardStatus: 'pending',
                rewardReference: createTxReference('REW'),
                policyNote: 'Non-deposit-funded promotional reward for referred player becoming verified agent',
                createdAt: nowIso,
              };
              db.referralRewards.unshift(agentReward);
              if (shouldAutoApprove) {
                activateReferralReward({
                  db,
                  reward: agentReward,
                  actorUsername: admin.username,
                  nowIso,
                });
              }
            }
          }
        } else {
          profile.applicationStatus = 'rejected';
          profile.verificationStatus = verificationStatus || 'rejected';
          profile.rejectionReason = (rejectionReason || '').trim().slice(0, 200) || undefined;
          profile.updatedAt = nowIso;
          if (targetUser.role !== 'admin') {
            targetUser.accountType = 'player';
          }
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action:
            decision === 'approve'
              ? 'APPROVE_AGENT_APPLICATION'
              : decision === 'reject'
                ? 'REJECT_AGENT_APPLICATION'
                : 'UPDATE_AGENT_VERIFICATION',
          targetType: 'agent',
          affectedUserId: targetUser.id,
          affectedLabel: `${targetUser.username} (${profile.fullLegalName})`,
          previousValue: prevStatus,
          newValue: `${profile.applicationStatus}/${profile.verificationStatus}`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Suspend or Reactivate an Approved Agent
  router.post('/admin/agents-profile/:agentId/status', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { action, reason } = req.body as { action?: 'suspend' | 'reactivate'; reason?: string };
      if (action !== 'suspend' && action !== 'reactivate') {
        res.status(400).json({ error: 'Invalid status action.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const profile = db.agentProfiles.find((ap) => ap.id === req.params.agentId);
        if (!profile) return { status: 404, error: 'Agent profile not found.' };

        const targetUser = db.users.find((u) => u.id === profile.userId);
        const prev = profile.applicationStatus;
        profile.applicationStatus = action === 'suspend' ? 'suspended' : 'approved';
        profile.rejectionReason =
          action === 'suspend'
            ? (reason || 'Suspended by administrator').trim().slice(0, 200)
            : undefined;
        profile.updatedAt = new Date().toISOString();

        if (targetUser && targetUser.role !== 'admin') {
          targetUser.accountType = action === 'suspend' ? 'player' : 'agent';
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: action === 'suspend' ? 'SUSPEND_AGENT' : 'REACTIVATE_AGENT',
          targetType: 'agent',
          affectedUserId: profile.userId,
          affectedLabel: profile.username,
          previousValue: prev,
          newValue: profile.applicationStatus,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Decrypt and audit-log inspection of an Agent's encrypted financial details
  router.get('/admin/agents-profile/:agentId/financial-details', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const profile = db.agentProfiles.find((ap) => ap.id === req.params.agentId);
        if (!profile) return { status: 404, error: 'Agent profile not found.' };

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'INSPECT_AGENT_FINANCIALS',
          targetType: 'agent',
          affectedUserId: profile.userId,
          affectedLabel: `${profile.username} (${profile.fullLegalName})`,
          newValue: 'Decrypted bank/CBE/Telebirr view',
        });
        await writeDb(db);
        return {
          status: 200,
          details: decryptAgentFinancialDetails(profile, db.sessionSecret),
        };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json(outcome.details);
    } catch (err) {
      next(err);
    }
  });

  // Admin: Complete Multi-Root Referral Hierarchy & Duplicate/Fraud Overview
  router.get('/admin/network', requireAdmin, async (_req: AuthedRequest, res, next) => {
    try {
      const db = await readDb();
      const childUserIds = new Set(db.referralRelationships.map((r) => r.referredUserId));
      const parentUserIds = new Set(db.referralRelationships.map((r) => r.parentAgentUserId));
      const approvedAgentUserIds = new Set(
        db.agentProfiles
          .filter((ap) => ap.applicationStatus === 'approved')
          .map((ap) => ap.userId)
      );

      const rootUserIds = new Set<string>();
      for (const uid of approvedAgentUserIds) {
        if (!childUserIds.has(uid)) rootUserIds.add(uid);
      }
      for (const uid of parentUserIds) {
        if (!childUserIds.has(uid)) rootUserIds.add(uid);
      }

      const trees = Array.from(rootUserIds)
        .map((rootId) =>
          buildReferralTree({
            rootUserId: rootId,
            users: db.users,
            agentProfiles: db.agentProfiles,
            relationships: db.referralRelationships,
          })
        )
        .filter((t): t is NonNullable<typeof t> => Boolean(t));

      const flaggedRelationships = db.referralRelationships.filter((r) => r.isFlaggedDuplicate);
      res.json({ trees, flaggedRelationships });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Approve or Reject Pending Referral Reward
  router.post('/admin/rewards/:rewardId/review', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { decision } = req.body as { decision?: 'approve' | 'reject' };
      if (decision !== 'approve' && decision !== 'reject') {
        res.status(400).json({ error: 'Invalid reward decision.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const rew = db.referralRewards.find((r) => r.id === req.params.rewardId);
        if (!rew || rew.rewardStatus !== 'pending') {
          return { status: 404, error: 'Pending referral reward not found.' };
        }

        const nowIso = new Date().toISOString();
        if (decision === 'approve') {
          activateReferralReward({
            db,
            reward: rew,
            actorUsername: admin.username,
            nowIso,
          });
        } else {
          rew.rewardStatus = 'rejected';
          rew.approvedAt = nowIso;
          rew.approvedBy = admin.username;
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: decision === 'approve' ? 'APPROVE_REFERRAL_REWARD' : 'REJECT_REFERRAL_REWARD',
          targetType: 'reward',
          affectedUserId: rew.agentUserId,
          affectedLabel: `${rew.agentUsername} (${rew.rewardReference})`,
          previousValue: 'pending',
          newValue: `${rew.rewardStatus} (${rew.rewardAmountEtb} ETB)`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Bulk-Approve & Activate All Non-Flagged Pending Referral Rewards
  router.post('/admin/rewards/approve-all-pending', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const nowIso = new Date().toISOString();
        const flaggedRelIds = new Set(
          db.referralRelationships.filter((r) => r.isFlaggedDuplicate).map((r) => r.id)
        );
        let approvedCount = 0;
        let creditedEtb = 0;

        for (const rew of db.referralRewards) {
          if (rew.rewardStatus !== 'pending') continue;
          if (rew.referralId && flaggedRelIds.has(rew.referralId)) continue;
          activateReferralReward({
            db,
            reward: rew,
            actorUsername: admin.username,
            nowIso,
          });
          approvedCount++;
          creditedEtb = roundBirr(creditedEtb + rew.rewardAmountEtb);
        }

        if (approvedCount > 0) {
          appendAuditLog(db.auditLogs, {
            administratorId: admin.id,
            administratorUsername: admin.username,
            action: 'BULK_APPROVE_PENDING_REWARDS',
            targetType: 'reward',
            affectedLabel: `${approvedCount} pending referral rewards`,
            newValue: `${creditedEtb} ETB activated`,
          });
          await writeDb(db);
        }

        return { status: 200, approvedCount, creditedEtb, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({
        approvedCount: outcome.approvedCount,
        creditedEtb: outcome.creditedEtb,
        snapshot: outcome.snapshot,
      });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Grant Promotional Agent Reward (Non-deposit-funded)
  router.post('/admin/rewards/grant', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { agentUserId, amountEtb, note } = req.body as {
        agentUserId?: string;
        amountEtb?: number;
        note?: string;
      };
      const cleanAmt = roundBirr(Number(amountEtb));
      if (!agentUserId || !Number.isFinite(cleanAmt) || cleanAmt <= 0 || cleanAmt > 50000) {
        res.status(400).json({ error: 'Enter a valid agent and reward amount (1 – 50,000 ETB).' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const profile = db.agentProfiles.find(
          (ap) => ap.userId === agentUserId && ap.applicationStatus === 'approved'
        );
        if (!profile) return { status: 404, error: 'Approved agent profile not found.' };

        const nowIso = new Date().toISOString();
        const ref = createTxReference('REW');
        const rewGrant: StoredReferralReward = {
          id: `rew_${crypto.randomUUID()}`,
          agentId: profile.id,
          agentUserId: profile.userId,
          agentUsername: profile.username,
          referredUserId: profile.userId,
          referredUsername: profile.username,
          rewardAmountEtb: cleanAmt,
          rewardType: 'admin_grant',
          rewardStatus: 'approved',
          rewardReference: ref,
          policyNote: (note || 'Administrator promotional agent reward').trim().slice(0, 160),
          createdAt: nowIso,
          approvedAt: nowIso,
          approvedBy: admin.username,
        };
        db.referralRewards.unshift(rewGrant);
        activateReferralReward({
          db,
          reward: rewGrant,
          actorUsername: admin.username,
          nowIso,
        });

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'GRANT_AGENT_PROMO_REWARD',
          targetType: 'reward',
          affectedUserId: profile.userId,
          affectedLabel: `${profile.username} (${ref})`,
          newValue: `${cleanAmt} ETB`,
        });

        await writeDb(db);
        return { status: 201, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.status(201).json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Update Platform Settings (Min Deposit, Min Withdrawal, Game Default Min Stake, Eligibility, Reward Policy)
  router.post('/admin/settings', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { settings, applyMinStakeToAllGames } = req.body as {
        settings?: Partial<PlatformSettings>;
        applyMinStakeToAllGames?: boolean;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const prev = db.platformSettings;
        const nextSettings = normalizePlatformSettings({
          ...prev,
          ...(settings || {}),
          agentEligibility: {
            ...prev.agentEligibility,
            ...(settings?.agentEligibility || {}),
          },
          rewardPolicy: {
            ...prev.rewardPolicy,
            ...(settings?.rewardPolicy || {}),
          },
          updatedAt: new Date().toISOString(),
        });

        db.platformSettings = nextSettings;
        if (applyMinStakeToAllGames) {
          for (const g of db.games) {
            g.minStakeBirr = nextSettings.defaultMinStakeEtb;
          }
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'UPDATE_PLATFORM_SETTINGS',
          targetType: 'settings',
          affectedLabel: applyMinStakeToAllGames
            ? 'Global Settings + All Game Stakes'
            : 'Global Settings',
          previousValue: `minDep=${prev.minDepositEtb}, defStake=${prev.defaultMinStakeEtb}, playerBonus=${prev.rewardPolicy.playerReferralBonusEtb}, agentBonus=${prev.rewardPolicy.agentReferralBonusEtb}`,
          newValue: `minDep=${nextSettings.minDepositEtb}, defStake=${nextSettings.defaultMinStakeEtb}, playerBonus=${nextSettings.rewardPolicy.playerReferralBonusEtb}, agentBonus=${nextSettings.rewardPolicy.agentReferralBonusEtb}`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Update / Reply to Support Ticket
  router.post('/admin/support/:ticketId/update', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { status, adminReply } = req.body as {
        status?: StoredSupportTicket['status'];
        adminReply?: string;
      };

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const ticket = db.supportTickets.find((t) => t.id === req.params.ticketId);
        if (!ticket) return { status: 404, error: 'Support ticket not found.' };

        const prev = ticket.status;
        if (status === 'open' || status === 'in_progress' || status === 'resolved' || status === 'closed') {
          ticket.status = status;
        }
        if (typeof adminReply === 'string' && adminReply.trim()) {
          ticket.adminReply = adminReply.trim().slice(0, 1200);
        }
        ticket.resolvedBy = admin.username;
        ticket.updatedAt = new Date().toISOString();

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'UPDATE_SUPPORT_TICKET',
          targetType: 'support',
          affectedUserId: ticket.userId,
          affectedLabel: `${ticket.username}: ${ticket.subject}`,
          previousValue: prev,
          newValue: ticket.status,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Resolve Duplicate / Referral Fraud Alert
  router.post('/admin/fraud/:relationshipId/resolve', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { action } = req.body as {
        action?: 'clear' | 'suspend_referred' | 'suspend_both';
      };
      if (action !== 'clear' && action !== 'suspend_referred' && action !== 'suspend_both') {
        res.status(400).json({ error: 'Invalid fraud resolution action.' });
        return;
      }

      const outcome = await withDbMutation(async () => {
        const db = await readDb();
        const admin = extractUserFromDb(req, db);
        if (!admin || admin.role !== 'admin') return { status: 403, error: 'Admin only.' };

        const rel = db.referralRelationships.find((r) => r.id === req.params.relationshipId);
        if (!rel) return { status: 404, error: 'Referral relationship not found.' };

        const prevFlag = rel.isFlaggedDuplicate;
        rel.isFlaggedDuplicate = false;

        if (action === 'suspend_referred' || action === 'suspend_both') {
          const refUser = db.users.find((u) => u.id === rel.referredUserId);
          if (refUser && refUser.id !== admin.id) {
            refUser.isBanned = true;
            refUser.playerStatus = 'suspended';
          }
          for (const rw of db.referralRewards) {
            if (rw.referralId === rel.id && rw.rewardStatus === 'pending') {
              rw.rewardStatus = 'rejected';
            }
          }
        }
        if (action === 'suspend_both') {
          const parentAp = db.agentProfiles.find((ap) => ap.id === rel.parentAgentId);
          if (parentAp) {
            parentAp.applicationStatus = 'suspended';
            parentAp.rejectionReason = 'Suspended due to confirmed referral fraud';
          }
        }

        appendAuditLog(db.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'RESOLVE_REFERRAL_FRAUD',
          targetType: 'referral',
          affectedUserId: rel.referredUserId,
          affectedLabel: `${rel.parentAgentCode} -> ${rel.referredUsername}`,
          previousValue: `flagged=${prevFlag}`,
          newValue: `resolution=${action}`,
        });

        await writeDb(db);
        return { status: 200, snapshot: buildClientPayload(db, admin) };
      });

      if ('error' in outcome) {
        res.status(outcome.status).json({ error: outcome.error });
        return;
      }
      res.json({ snapshot: outcome.snapshot });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Export CSV Reports (users | agents | referrals | rewards | transactions | audit)
  router.get('/admin/reports/export', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const reportType = String(req.query.type || 'transactions').toLowerCase();
      const db = await readDb();
      const admin = extractUserFromDb(req, db);
      if (!admin || admin.role !== 'admin') {
        res.status(403).json({ error: 'Administrator privileges required.' });
        return;
      }

      let csv = '';
      if (reportType === 'users') {
        csv = toCsvString(
          ['ID', 'Username', 'Full Name', 'Email', 'Phone', 'Account Type', 'Status', 'Balance (ETB)', 'Games Played', 'Referred By', 'Joined At'],
          db.users.map((u) => [
            u.id,
            u.username,
            u.fullName || u.displayName,
            u.email,
            u.phone || '',
            u.accountType,
            u.isBanned ? 'suspended' : u.playerStatus,
            roundBirr(u.balanceBirr),
            u.gamesPlayed,
            u.referredByCode || '',
            u.joinedAt,
          ])
        );
      } else if (reportType === 'agents') {
        csv = toCsvString(
          ['Agent ID', 'Username', 'Legal Name', 'Phone', 'Agent Code', 'Application Status', 'Verification Status', 'Bank Name', 'Masked Bank', 'Approved At', 'Created At'],
          db.agentProfiles.map((ap) => {
            const san = sanitizeAgentProfile(ap, db.sessionSecret);
            return [
              san.id,
              san.username,
              san.fullLegalName,
              san.phone,
              san.agentCode || '',
              san.applicationStatus,
              san.verificationStatus,
              san.bankName,
              san.maskedBankAccount,
              san.approvedAt || '',
              san.createdAt,
            ];
          })
        );
      } else if (reportType === 'referrals') {
        csv = toCsvString(
          ['ID', 'Parent Agent Code', 'Referred Username', 'Referred Full Name', 'Type', 'Flagged', 'Fraud Reason', 'Created At'],
          db.referralRelationships.map((r) => [
            r.id,
            r.parentAgentCode,
            r.referredUsername,
            r.referredFullName,
            r.referralType,
            r.isFlaggedDuplicate ? 'YES' : 'NO',
            r.fraudFlagReason || '',
            r.createdAt,
          ])
        );
      } else if (reportType === 'rewards') {
        csv = toCsvString(
          ['Reference', 'Agent Username', 'Referred Username', 'Type', 'Amount (ETB)', 'Status', 'Policy Note', 'Created At', 'Approved At', 'Redeemed At'],
          db.referralRewards.map((rw) => [
            rw.rewardReference,
            rw.agentUsername,
            rw.referredUsername,
            rw.rewardType,
            rw.rewardAmountEtb,
            rw.rewardStatus,
            rw.policyNote,
            rw.createdAt,
            rw.approvedAt || '',
            rw.redeemedAt || '',
          ])
        );
      } else if (reportType === 'audit') {
        csv = toCsvString(
          ['ID', 'Admin', 'Action', 'Target Type', 'Affected Label', 'Previous', 'New', 'Timestamp'],
          db.auditLogs.map((a) => [
            a.id,
            a.administratorUsername,
            a.action,
            a.targetType,
            a.affectedLabel || '',
            a.previousValue || '',
            a.newValue || '',
            a.timestamp,
          ])
        );
      } else {
        csv = toCsvString(
          ['Reference', 'Username', 'Type', 'Amount (ETB)', 'Currency', 'Status', 'Note', 'Created At'],
          db.transactions.map((t) => [
            t.referenceNumber,
            t.username,
            t.transactionType,
            t.amount,
            t.currency,
            t.status,
            t.note || '',
            t.createdAt,
          ])
        );
      }

      await withDbMutation(async () => {
        const latestDb = await readDb();
        appendAuditLog(latestDb.auditLogs, {
          administratorId: admin.id,
          administratorUsername: admin.username,
          action: 'EXPORT_CSV_REPORT',
          targetType: 'settings',
          affectedLabel: reportType,
        });
        await writeDb(latestDb);
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="abyssinia-${reportType.replace(/[^a-z0-9]/g, '')}-report.csv"`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createApiApp(options?: { mountRootAliases?: boolean }): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Origin/Referer CSRF defense for state-mutating browser API requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const origin = req.get('origin');
      const referer = req.get('referer');
      const reqHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
      const candidate = origin || referer;
      if (candidate && reqHost) {
        try {
          const parsedHost = new URL(candidate).host;
          if (parsedHost !== reqHost) {
            res.status(403).json({ error: 'Cross-origin request blocked by security policy.' });
            return;
          }
        } catch {
          res.status(403).json({ error: 'Invalid request origin.' });
          return;
        }
      }
    }
    next();
  });
  app.use(express.json({ limit: '6mb' }));

  const router = createApiRouter();
  app.use('/api', router);
  if (options?.mountRootAliases) {
    app.use('/', router);
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
