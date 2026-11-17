export type UserRole = 'player' | 'admin';
export type AccountType = 'player' | 'agent' | 'admin';
export type PlayerStatus = 'active' | 'suspended';
export type AgentApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type GameCategory = 'Slots' | 'Strategy' | 'Arcade' | 'Puzzle' | 'Trivia';

export type GameProviderId =
  | 'axum_studios'
  | 'pragmatic_spin'
  | 'hacksaw_vault'
  | 'megaways_labs'
  | 'spribe_live'
  | 'royal_table';

export type SlotEngineType =
  | 'fruitslot'
  | 'hot7spin'
  | 'safari_spin'
  | 'pharaoh_spin'
  | 'candy_spin'
  | 'abyssinia_megaways'
  | 'cosmic_megaways'
  | 'spy_mission_spin'
  | 'hot_inferno_777'
  | 'vikings_valhalla_spin'
  | 'dragon_fortune_spin'
  | 'wild_west_bounty'
  | 'pirate_treasure_megaways'
  | 'zeus_olympus_megaways'
  | 'neon_vegas_nights'
  | 'emerald_leprechaun_spin'
  | 'gladiator_arena_megaways'
  | 'sheba_crown_megaways'
  | 'lalibela_gold_megaways'
  | 'abay_nile_riches'
  | 'blazing_diamond_777'
  | 'tropical_berry_frenzy'
  | 'royal_gold_bullion'
  | 'ruby_starlight_777'
  | 'golden_bell_jackpot'
  | 'samurai_blade_megaways'
  | 'atlantis_kraken_megaways'
  | 'cyberpunk_matrix_megaways'
  | 'volcano_eruption_megaways'
  | 'valhalla_storm_megaways'
  | 'cyber_heist_spin'
  | 'outlaw_gold_train'
  | 'arabian_genie_spin'
  | 'aztec_sun_spin'
  | 'imperial_panda_spin';

export type SkillEngineType =
  | 'tictactoe'
  | 'memory'
  | 'snake'
  | 'trivia'
  | 'gebeta'
  | 'mines'
  | 'keno'
  | 'bingo'
  | 'dice_duel'
  | 'crash_rocket'
  | 'plinko_drop'
  | 'tower_climb'
  | 'coin_flip_streak'
  | 'penalty_kick'
  | 'color_wheel'
  | 'word_scramble'
  | 'reaction_reflex'
  | 'blackjack_21'
  | 'royal_baccarat'
  | 'hilo_card_streak'
  | 'blitz_hilo'
  | 'limbo_multiplier'
  | 'cyber_limbo'
  | 'scratch_vault'
  | 'bomb_defusal'
  | 'aviator_jetx'
  | 'dragon_tiger_live'
  | 'imperial_dragon_tiger'
  | 'rps_duel_streak'
  | 'european_roulette';

export type GameEngine = SlotEngineType | SkillEngineType;

export type GameDifficulty = 'Casual' | 'Standard' | 'Challenging';

export type AvatarId =
  | 'lion'
  | 'obelisk'
  | 'compass'
  | 'crown'
  | 'shield'
  | 'star';

export interface TelebirrAgent {
  id: string;
  name: string;
  phone: string;
  note?: string;
  isActive: boolean;
  isPrimary: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string;
  displayName: string;
  avatarId: AvatarId;
  role: UserRole;
  accountType: AccountType;
  playerStatus: PlayerStatus;
  balanceBirr: number;
  bonusBirrReceived: number;
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
  agentCode?: string;
  agentApplicationStatus?: AgentApplicationStatus;
  joinedAt: string;
}

export interface GameCatalogItem {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: GameCategory;
  difficulty: GameDifficulty;
  minStakeBirr: number;
  playerWinPercent?: number; // Admin-only config (5..95, default 30 => 70% AI); omitted from non-admin payloads
  bonusBirr: number;
  maxMultiplier: number;
  cashoutEnabled: boolean;
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

export interface GameSessionRecord {
  id: string;
  userId: string;
  gameSlug: string;
  gameTitle: string;
  score: number;
  stakeBirr: number;
  payoutBirr: number;
  bonusBirr: number;
  multiplier: number;
  outcome: 'win' | 'draw' | 'cashed_out' | 'loss';
  playedAt: string;
}

export interface ActiveWagerSession {
  id: string;
  userId: string;
  gameSlug: string;
  engine: GameEngine;
  stakeBirr: number;
  playerWinPercent?: number;
  bonusBirr: number;
  aiFavored: boolean;
  maxAllowedMultiplier: number;
  status: 'active' | 'cashed_out' | 'won' | 'draw' | 'lost' | 'cancelled';
  payoutBirr: number;
  createdAt: string;
  settledAt?: string;
}

export interface DailyChallenge {
  id: string;
  code: string;
  title: string;
  description: string;
  gameSlug: string;
  engine: GameEngine;
  targetValue: number;
  rewardBirr: number;
  metricLabel: string;
}

export interface ChallengeProgress {
  challengeId: string;
  progressValue: number;
  isClaimed: boolean;
}

export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface DepositRequest {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  agentId: string;
  agentName: string;
  agentPhone: string;
  telebirrReference?: string;
  senderPhone?: string;
  screenshotDataUrl?: string;
  screenshotFileName?: string;
  status: DepositStatus;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  telebirrPhone: string;
  recipientName: string;
  payoutReference?: string;
  status: WithdrawalStatus;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface BonusGrantRecord {
  id: string;
  userId: string;
  username: string;
  amountBirr: number;
  reason: string;
  grantedBy: string;
  createdAt: string;
}

export interface SlotFreeSpinsState {
  gameSlug: string;
  remaining: number;
  stakeBirr: number;
  multiplierBoost: number;
  totalWonBirr: number;
  spinsPlayed: number;
  source: 'bought' | 'midgame' | 'bonus_vault';
}

export interface SlotBonusVaultItem {
  index: number;
  revealed: boolean;
  kind?: 'mult' | 'freespins';
  value?: number;
  label?: string;
}

export interface SlotBonusPickSession {
  id: string;
  gameSlug: string;
  stakeBirr: number;
  maxPicks: number;
  pickedIndices: number[];
  vaults: SlotBonusVaultItem[];
  status: 'active' | 'claimed';
  totalMultiplier: number;
  freeSpinsAwarded: number;
  payoutBirr: number;
  createdAt: string;
}

export interface AgentEligibilityConfig {
  minAccountAgeDays: number;
  minGamesPlayed: number;
  minTotalDepositedEtb: number;
  requirePhoneOnFile: boolean;
  allowAllVerifiedPlayers: boolean;
}

export interface RewardPolicyConfig {
  rewardsEnabled: boolean;
  rewardMode: 'fixed_per_verified_referral' | 'milestone_tier' | 'manual_admin_only';
  playerReferralBonusEtb: number;
  agentReferralBonusEtb: number;
  downstreamMilestoneBonusEtb: number;
  autoApproveRewards: boolean;
  autoApproveOnClientVerification: boolean;
  autoCreditAgentWalletOnApproval: boolean;
  allowSelfTransferToBalance: boolean;
  minRedeemEtb: number;
  policySummary: string;
}

export interface PlatformSettings {
  minDepositEtb: number;
  minWithdrawalEtb: number;
  defaultMinStakeEtb: number;
  agentEligibility: AgentEligibilityConfig;
  rewardPolicy: RewardPolicyConfig;
  updatedAt: string;
}

export interface AgentEligibilityCheck {
  eligible: boolean;
  reasons: string[];
  accountAgeDays: number;
  gamesPlayed: number;
  totalDepositedEtb: number;
  hasPhoneOnFile: boolean;
}

export interface AgentProfile {
  id: string;
  userId: string;
  username: string;
  agentCode?: string;
  agentCodeCreatedAt?: string;
  fullLegalName: string;
  phone: string;
  bankName: string;
  bankAccountName: string;
  maskedBankAccount: string;
  maskedCbeAccount: string;
  maskedTelebirrAccount: string;
  verificationStatus: VerificationStatus;
  verificationDocRef?: string;
  applicationStatus: AgentApplicationStatus;
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedAgentFinancialDetails {
  agentId: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  cbeAccountDetails: string;
  telebirrAccount: string;
  verificationDocRef?: string;
}

export interface ReferralRelationship {
  id: string;
  parentAgentId: string;
  parentAgentUserId: string;
  parentAgentCode: string;
  referredUserId: string;
  referredUsername: string;
  referredFullName: string;
  referralCode: string;
  referralType: 'player' | 'agent';
  playerStatus: PlayerStatus;
  isFlaggedDuplicate: boolean;
  fraudFlagReason?: string;
  createdAt: string;
}

export interface ReferralTreeNode {
  userId: string;
  agentId?: string;
  username: string;
  fullName: string;
  accountType: AccountType;
  agentCode?: string;
  verificationStatus?: VerificationStatus;
  applicationStatus?: AgentApplicationStatus;
  playerStatus: PlayerStatus;
  joinedAt: string;
  gamesPlayed: number;
  depth: number;
  directCount: number;
  totalDescendants: number;
  isFlaggedDuplicate?: boolean;
  children: ReferralTreeNode[];
}

export interface ReferralRewardRecord {
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

export interface PlatformTransaction {
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
  note?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  administratorId: string;
  administratorUsername: string;
  action: string;
  targetType: 'agent' | 'user' | 'referral' | 'reward' | 'deposit' | 'withdrawal' | 'game' | 'settings' | 'support';
  affectedUserId?: string;
  affectedLabel?: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface SupportTicketRecord {
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

export interface AgentDashboardSummary {
  profile: AgentProfile;
  referralLink: string;
  directReferralCount: number;
  totalNetworkMembers: number;
  activePlayerReferrals: number;
  activeAgentReferrals: number;
  directReferrals: ReferralRelationship[];
  downstreamReferrals: Array<ReferralRelationship & { depth: number }>;
  tree: ReferralTreeNode;
  rewards: ReferralRewardRecord[];
  rewardTotals: {
    eligibleEtb: number;
    pendingEtb: number;
    approvedEtb: number;
    redeemedEtb: number;
  };
}

export interface PlatformSnapshot {
  users: UserProfile[];
  games: GameCatalogItem[];
  agents: TelebirrAgent[];
  sessions: GameSessionRecord[];
  challenges: DailyChallenge[];
  challengeProgressByUser: Record<string, Record<string, ChallengeProgress>>;
  depositRequests: DepositRequest[];
  withdrawalRequests: WithdrawalRequest[];
  bonusGrants: BonusGrantRecord[];
  slotFreeSpins?: Record<string, SlotFreeSpinsState>;
  activeSlotBonuses?: Record<string, SlotBonusPickSession>;
  platformSettings: PlatformSettings;
  myAgentProfile: AgentProfile | null;
  myEligibility: AgentEligibilityCheck | null;
  myReferralParent: ReferralRelationship | null;
  myReferralRewards: ReferralRewardRecord[];
  agentProfiles: AgentProfile[];
  referralRelationships: ReferralRelationship[];
  referralRewards: ReferralRewardRecord[];
  transactions: PlatformTransaction[];
  auditLogs: AuditLogRecord[];
  supportTickets: SupportTicketRecord[];
  currentUserId: string | null;
}

export type ActiveRoute =
  | 'home'
  | 'games'
  | 'challenges'
  | 'leaderboard'
  | 'profile'
  | 'agent'
  | 'admin';

export interface ChallengeUpdatePayload {
  winIncrement?: number;
  playIncrement?: number;
  snakeScore?: number;
  triviaCorrect?: number;
  memoryMovesIfWon?: number;
}

export type LiveKenoPhase = 'picking' | 'drawing' | 'results';
export type LiveBingoPhase = 'lobby' | 'calling' | 'results';

export interface LiveRoundWinner {
  username: string;
  detail: string;
  payoutBirr: number;
  timestamp: string;
}

export interface LiveKenoState {
  roundId: number;
  phase: LiveKenoPhase;
  secondsRemaining: number;
  phaseDurationSeconds: number;
  drawnBalls: number[];
  totalBallsToDraw: number;
  nextBallInSeconds: number;
  activePlayers: number;
  lockedTicketsCount: number;
  winners: LiveRoundWinner[];
  serverTimeMs: number;
}

export interface BingoDeckCard {
  cardNumber: number;
  values: Array<number | 'FREE'>;
  takenBy: string | null;
}

export interface LiveBingoState {
  roundId: number;
  phase: LiveBingoPhase;
  secondsRemaining: number;
  phaseDurationSeconds: number;
  calledNumbers: number[];
  totalBallsToCall: number;
  currentBall: number | null;
  nextBallInSeconds: number;
  activePlayers: number;
  lockedCardsCount: number;
  takenCardNumbers: number[];
  houseTargetBall: number;
  houseBingoReached: boolean;
  winners: LiveRoundWinner[];
  serverTimeMs: number;
}

export interface LiveRoundsSnapshot {
  keno: LiveKenoState;
  bingo: LiveBingoState;
}

export type SlotLayoutMode = 'classic_3x3' | 'spin_5x3' | 'megaways';

export type SlotSymbolId =
  | 'cherry'
  | 'lemon'
  | 'orange'
  | 'grapes'
  | 'watermelon'
  | 'bell'
  | 'star'
  | 'bar1'
  | 'bar2'
  | 'diamond'
  | 'seven'
  | 'double7'
  | 'triple7'
  | 'lion_wild'
  | 'elephant'
  | 'rhino'
  | 'zebra'
  | 'acacia'
  | 'shield'
  | 'pharaoh_wild'
  | 'scarab'
  | 'horus'
  | 'ankh'
  | 'sphinx'
  | 'lotus'
  | 'candy_wild'
  | 'cupcake'
  | 'lollipop'
  | 'donut'
  | 'gummy'
  | 'candystar'
  | 'axum_wild'
  | 'obelisk'
  | 'gold_coin'
  | 'amber_gem'
  | 'emerald_scarab'
  | 'royal_crown'
  | 'nebula_wild'
  | 'plasma'
  | 'sapphire'
  | 'amethyst'
  | 'emerald_gem'
  | 'opal'
  // Spy Mission Spin
  | 'spy_wild'
  | 'spy_car'
  | 'spy_briefcase'
  | 'spy_pistol'
  | 'spy_watch'
  | 'spy_passport'
  // Hot Inferno 777
  | 'inferno_wild'
  | 'inferno_777'
  | 'molten_bell'
  | 'flame_dice'
  | 'ruby_heart'
  | 'gold_ingot'
  // Vikings Valhalla Spin
  | 'viking_wild'
  | 'viking_helm'
  | 'battle_axe'
  | 'longship'
  | 'thor_hammer'
  | 'runestone'
  // Dragon Fortune Spin
  | 'dragon_wild'
  | 'jade_tiger'
  | 'red_lantern'
  | 'koi_fish'
  | 'gold_sycee'
  | 'fortune_fan'
  // Wild West Bounty
  | 'sheriff_wild'
  | 'revolver'
  | 'dynamite'
  | 'cowboy_hat'
  | 'horseshoe'
  | 'whiskey_barrel'
  // Pirate Treasure Megaways
  | 'pirate_wild'
  | 'treasure_chest'
  | 'pirate_ship'
  | 'brass_compass'
  | 'spyglass'
  | 'rum_bottle'
  // Zeus Olympus Megaways
  | 'zeus_wild'
  | 'pegasus'
  | 'olympus_temple'
  | 'golden_chalice'
  | 'lightning_ring'
  | 'marble_lyre'
  // Neon Vegas Nights
  | 'vip_wild'
  | 'roulette_wheel'
  | 'royal_cards'
  | 'champagne'
  | 'casino_dice'
  | 'sports_car'
  // Emerald Leprechaun Spin
  | 'clover_wild'
  | 'pot_of_gold'
  | 'four_clover'
  | 'golden_harp'
  | 'rainbow_boot'
  | 'emerald_pint'
  // Gladiator Arena Megaways
  | 'gladiator_wild'
  | 'roman_helm'
  | 'golden_eagle'
  | 'war_chariot'
  | 'gladius_shield'
  | 'colosseum_coin';

export interface SlotWinningLine {
  lineIndex: number;
  lineName: string;
  symbolId: SlotSymbolId;
  symbolName: string;
  multiplier: number;
  matchCount?: number;
  waysCount?: number;
  cells: Array<[number, number]>;
}

export interface MegawaysCascadeStep {
  columns: SlotSymbolId[][];
  waysCount: number;
  cascadeMultiplier: number;
  winningLines: SlotWinningLine[];
  stepMultiplier: number;
}

export interface SlotSpinResultData {
  engine: SlotEngineType;
  layoutMode: SlotLayoutMode;
  grid: SlotSymbolId[][];
  columns?: SlotSymbolId[][];
  waysCount?: number;
  cascades?: MegawaysCascadeStep[];
  winningLines: SlotWinningLine[];
  baseMultiplier: number;
  multiplierReel: number;
  totalMultiplier: number;
}

export interface SlotSpinResponse {
  ok: boolean;
  spin: SlotSpinResultData;
  stakeBirr: number;
  payoutBirr: number;
  bonusBirrApplied: number;
  outcome: 'win' | 'loss';
  usedFreeSpin?: boolean;
  freeSpinsRemaining?: number;
  freeSpinsAwarded?: number;
  retriggeredFreeSpins?: number;
  bonusTriggered?: SlotBonusPickSession | null;
  snapshot: PlatformSnapshot;
}

export interface SlotBonusBuyResponse {
  ok: boolean;
  buyType: 'free_spins' | 'bonus_game';
  costBirr: number;
  freeSpins?: SlotFreeSpinsState;
  bonusSession?: SlotBonusPickSession;
  snapshot: PlatformSnapshot;
}

export interface SlotBonusPickResponse {
  ok: boolean;
  revealedVault: {
    index: number;
    kind: 'mult' | 'freespins';
    value: number;
    label: string;
  };
  bonusSession: SlotBonusPickSession;
  payoutBirr: number;
  bonusFreeSpins: number;
  snapshot: PlatformSnapshot;
}
