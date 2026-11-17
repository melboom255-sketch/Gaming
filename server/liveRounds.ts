import crypto from 'node:crypto';

export type LiveKenoPhase = 'picking' | 'drawing' | 'results';
export type LiveBingoPhase = 'lobby' | 'calling' | 'results';

export interface LiveRoundWinner {
  username: string;
  detail: string;
  payoutBirr: number;
  timestamp: string;
}

export interface BingoDeckCard {
  cardNumber: number;
  values: Array<number | 'FREE'>;
  takenBy: string | null;
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

export interface KenoTicketEntry {
  playerKey: string;
  userId?: string;
  username: string;
  picks: number[];
  stakeBirr: number;
  playerWinPercent: number;
  aiFavored: boolean;
  bonusBirr: number;
  settled: boolean;
  hits?: number;
  payoutBirr?: number;
}

export interface BingoClaimEntry {
  playerKey: string;
  username: string;
  cardNumber: number;
  ballsUsed: number;
  payoutBirr: number;
}

export interface BingoLockedEntry {
  playerKey: string;
  userId?: string;
  username: string;
  cardNumbers: number[];
  stakePerCardBirr: number;
  totalStakeBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
  settled: boolean;
}

// Keno cycle: 15s picking + 18s drawing (10 balls * 1.8s) + 7s results = 40s
export const KENO_PICKING_MS = 15_000;
export const KENO_BALL_INTERVAL_MS = 1_800;
export const KENO_TOTAL_BALLS = 10;
export const KENO_DRAWING_MS = KENO_BALL_INTERVAL_MS * KENO_TOTAL_BALLS; // 18_000
export const KENO_RESULTS_MS = 7_000;
export const KENO_CYCLE_MS = KENO_PICKING_MS + KENO_DRAWING_MS + KENO_RESULTS_MS; // 40_000

// Bingo cycle: 60s choosing cards (1 full minute) + 60s calling (60 balls * 1.0s) + 8s results = 128s
export const BINGO_LOBBY_MS = 60_000;
export const BINGO_BALL_INTERVAL_MS = 1_000;
export const BINGO_TOTAL_BALLS = 60;
export const BINGO_CALLING_MS = BINGO_BALL_INTERVAL_MS * BINGO_TOTAL_BALLS; // 60_000
export const BINGO_RESULTS_MS = 8_000;
export const BINGO_CYCLE_MS = BINGO_LOBBY_MS + BINGO_CALLING_MS + BINGO_RESULTS_MS; // 128_000

export const BINGO_DECK_SIZE = 40;
export const BINGO_MAX_COMBO_CARDS = 4;

// Admin-configured live odds (defaults to 30% Player / 70% House AI)
let liveOddsConfig = {
  kenoPlayerWinPercent: 30,
  bingoPlayerWinPercent: 30,
};

export function setLiveRoundOddsConfig(config: {
  kenoPlayerWinPercent?: number;
  bingoPlayerWinPercent?: number;
}): void {
  if (typeof config.kenoPlayerWinPercent === 'number') {
    liveOddsConfig.kenoPlayerWinPercent = Math.max(5, Math.min(95, config.kenoPlayerWinPercent));
  }
  if (typeof config.bingoPlayerWinPercent === 'number') {
    liveOddsConfig.bingoPlayerWinPercent = Math.max(5, Math.min(95, config.bingoPlayerWinPercent));
  }
}

function roundBirr(val: number): number {
  return Math.round(val * 100) / 100;
}

// Deterministic, cryptographically seeded Fisher-Yates draw so every user in a round sees identical numbers
function seededDraw(
  seed: string,
  channel: string,
  roundId: number,
  maxNumber: number,
  count: number
): number[] {
  const pool = Array.from({ length: maxNumber }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const digest = crypto
      .createHmac('sha256', seed)
      .update(`${channel}:${roundId}:${i}`)
      .digest();
    const rand = digest.readUInt32BE(0);
    const j = rand % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function seededShuffleRange(
  seed: string,
  tag: string,
  min: number,
  max: number,
  count: number
): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  for (let i = pool.length - 1; i > 0; i--) {
    const digest = crypto
      .createHmac('sha256', seed)
      .update(`${tag}:${i}`)
      .digest();
    const rand = digest.readUInt32BE(0);
    const j = rand % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function generateBingoDeckCard(
  seed: string,
  roundId: number,
  cardNumber: number
): Array<number | 'FREE'> {
  const cols: number[][] = [
    seededShuffleRange(seed, `bingo-card:${roundId}:${cardNumber}:B`, 1, 15, 5),
    seededShuffleRange(seed, `bingo-card:${roundId}:${cardNumber}:I`, 16, 30, 5),
    seededShuffleRange(seed, `bingo-card:${roundId}:${cardNumber}:N`, 31, 45, 5),
    seededShuffleRange(seed, `bingo-card:${roundId}:${cardNumber}:G`, 46, 60, 5),
    seededShuffleRange(seed, `bingo-card:${roundId}:${cardNumber}:O`, 61, 75, 5),
  ];

  const values: Array<number | 'FREE'> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const isCenter = row === 2 && col === 2;
      values.push(isCenter ? 'FREE' : cols[col][row]);
    }
  }
  return values;
}

export function getKenoRoundBalls(seed: string, roundId: number): number[] {
  return seededDraw(seed, 'keno', roundId, 40, KENO_TOTAL_BALLS);
}

export function getBingoRoundBalls(seed: string, roundId: number): number[] {
  return seededDraw(seed, 'bingo', roundId, 75, BINGO_TOTAL_BALLS);
}

// Compute the ball number at which the House AI finishes Bingo, calibrated to real 75-ball line distribution
// At 30% playerWinPercent (70% AI win), AI finishes around ball 31-42; higher playerWinPercent pushes AI target later (up to 58).
export function getBingoHouseTargetBall(
  seed: string,
  roundId: number,
  playerWinPercent: number
): number {
  const pct = Math.max(5, Math.min(95, playerWinPercent));
  const minBall = Math.round(23 + (pct / 100) * 30); // ~32 at 30%, ~50 at 90%
  const maxBall = Math.min(59, minBall + 10);
  const digest = crypto
    .createHmac('sha256', seed)
    .update(`bingo-house-target:${roundId}`)
    .digest();
  const spread = Math.max(1, maxBall - minBall + 1);
  return minBall + (digest.readUInt32BE(0) % spread);
}

// Keno payout in Birr: calibrated to picksCount, hits, aiFavored roll, and Admin playerWinPercent
export function computeKenoPayoutBirr(params: {
  picksCount: number;
  hits: number;
  stakeBirr: number;
  playerWinPercent: number;
  aiFavored?: boolean;
  bonusBirr: number;
  maxMultiplier: number;
}): { payoutBirr: number; multiplier: number; isWin: boolean } {
  const { picksCount, hits, stakeBirr, playerWinPercent, aiFavored = true, bonusBirr, maxMultiplier } = params;
  if (picksCount === 0 || hits === 0) {
    return { payoutBirr: 0, multiplier: 0, isWin: false };
  }

  // Realistic hypergeometric calibration for 10 balls out of 40:
  // - 1 pick: 1 hit (25%)
  // - 2-3 picks: 2 hits normally (~6-16%), OR 1 hit when roll favored player (or Admin set >= 55%)
  // - 4-6 picks: 2 hits (~25-49%)
  // - 7-10 picks: 3 hits (~31-58%), or 2 hits when Admin set >= 60% or !aiFavored
  let requiredMinHits: number;
  if (picksCount === 1) {
    requiredMinHits = 1;
  } else if (picksCount <= 3) {
    requiredMinHits = !aiFavored || playerWinPercent >= 55 ? 1 : 2;
  } else if (picksCount <= 6) {
    requiredMinHits = playerWinPercent >= 70 && !aiFavored ? 1 : 2;
  } else {
    requiredMinHits = !aiFavored || playerWinPercent >= 60 ? 2 : 3;
  }

  if (hits < requiredMinHits) {
    if (playerWinPercent >= 45 && hits >= 2) {
      const mult = 0.55;
      return {
        payoutBirr: roundBirr(stakeBirr * mult),
        multiplier: mult,
        isWin: false,
      };
    }
    return { payoutBirr: 0, multiplier: 0, isWin: false };
  }

  const ratio = hits / picksCount;
  const oddsBoost = 0.85 + (playerWinPercent / 100) * 0.45;
  const rawMult = Math.min(maxMultiplier, Math.max(1.35, (1.15 + ratio * 2.5) * oddsBoost));
  const multiplier = Math.round(rawMult * 100) / 100;
  const appliedBonus = multiplier > 1 ? Math.max(0, bonusBirr) : 0;
  const payoutBirr = roundBirr(stakeBirr * multiplier + appliedBonus);
  return { payoutBirr, multiplier, isWin: true };
}

export function validateBingoCardLine(
  cardValues: Array<number | 'FREE'>,
  calledNumbers: number[]
): number[] | null {
  if (!Array.isArray(cardValues) || cardValues.length !== 25) return null;
  if (cardValues[12] !== 'FREE') return null;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const val = cardValues[idx];
      if (idx === 12) continue;
      if (typeof val !== 'number' || !Number.isInteger(val)) return null;
      const min = col * 15 + 1;
      const max = col * 15 + 15;
      if (val < min || val > max) return null;
    }
  }

  const numericVals = cardValues.filter((v): v is number => typeof v === 'number');
  if (new Set(numericVals).size !== 24) return null;

  const calledSet = new Set(calledNumbers);
  const lines: number[][] = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  for (const line of lines) {
    const complete = line.every((idx) => {
      const val = cardValues[idx];
      return val === 'FREE' || calledSet.has(val);
    });
    if (complete) return line;
  }
  return null;
}

// In-memory authoritative state for tickets, locked card combos, claims, winners, and presence
const kenoTicketsByRound = new Map<number, Map<string, KenoTicketEntry>>();
const kenoWinnersByRound = new Map<number, LiveRoundWinner[]>();
const bingoLockedByRound = new Map<number, Map<string, BingoLockedEntry>>();
const bingoClaimsByRound = new Map<number, Map<string, BingoClaimEntry>>();
const bingoWinnersByRound = new Map<number, LiveRoundWinner[]>();

let presenceCounts = { keno: 0, bingo: 0 };

export function setLiveRoomPresence(counts: { keno: number; bingo: number }): void {
  presenceCounts = counts;
}

function pruneOldRounds(currentKenoRound: number, currentBingoRound: number): void {
  for (const key of kenoTicketsByRound.keys()) {
    if (key < currentKenoRound - 6) kenoTicketsByRound.delete(key);
  }
  for (const key of kenoWinnersByRound.keys()) {
    if (key < currentKenoRound - 6) kenoWinnersByRound.delete(key);
  }
  for (const key of bingoLockedByRound.keys()) {
    if (key < currentBingoRound - 6) bingoLockedByRound.delete(key);
  }
  for (const key of bingoClaimsByRound.keys()) {
    if (key < currentBingoRound - 6) bingoClaimsByRound.delete(key);
  }
  for (const key of bingoWinnersByRound.keys()) {
    if (key < currentBingoRound - 6) bingoWinnersByRound.delete(key);
  }
}

export function getLiveKenoState(seed: string, nowMs = Date.now()): LiveKenoState {
  const roundId = Math.floor(nowMs / KENO_CYCLE_MS);
  const elapsed = nowMs % KENO_CYCLE_MS;
  const allBalls = getKenoRoundBalls(seed, roundId);

  let phase: LiveKenoPhase;
  let secondsRemaining: number;
  let phaseDurationSeconds: number;
  let drawnCount: number;
  let nextBallInSeconds: number;

  if (elapsed < KENO_PICKING_MS) {
    phase = 'picking';
    secondsRemaining = Math.max(1, Math.ceil((KENO_PICKING_MS - elapsed) / 1000));
    phaseDurationSeconds = KENO_PICKING_MS / 1000;
    drawnCount = 0;
    nextBallInSeconds = secondsRemaining;
  } else if (elapsed < KENO_PICKING_MS + KENO_DRAWING_MS) {
    phase = 'drawing';
    const drawElapsed = elapsed - KENO_PICKING_MS;
    secondsRemaining = Math.max(1, Math.ceil((KENO_DRAWING_MS - drawElapsed) / 1000));
    phaseDurationSeconds = KENO_DRAWING_MS / 1000;
    drawnCount = Math.min(
      KENO_TOTAL_BALLS,
      Math.floor(drawElapsed / KENO_BALL_INTERVAL_MS) + 1
    );
    const msIntoCurrentBall = drawElapsed % KENO_BALL_INTERVAL_MS;
    nextBallInSeconds =
      drawnCount >= KENO_TOTAL_BALLS
        ? 0
        : Math.max(1, Math.ceil((KENO_BALL_INTERVAL_MS - msIntoCurrentBall) / 1000));
  } else {
    phase = 'results';
    const resultsElapsed = elapsed - KENO_PICKING_MS - KENO_DRAWING_MS;
    secondsRemaining = Math.max(1, Math.ceil((KENO_RESULTS_MS - resultsElapsed) / 1000));
    phaseDurationSeconds = KENO_RESULTS_MS / 1000;
    drawnCount = KENO_TOTAL_BALLS;
    nextBallInSeconds = 0;
  }

  const ticketsMap = kenoTicketsByRound.get(roundId);
  const winners = kenoWinnersByRound.get(roundId) || [];

  return {
    roundId,
    phase,
    secondsRemaining,
    phaseDurationSeconds,
    drawnBalls: allBalls.slice(0, drawnCount),
    totalBallsToDraw: KENO_TOTAL_BALLS,
    nextBallInSeconds,
    activePlayers: Math.max(1, presenceCounts.keno),
    lockedTicketsCount: ticketsMap ? ticketsMap.size : 0,
    winners,
    serverTimeMs: nowMs,
  };
}

export function getLiveBingoState(seed: string, nowMs = Date.now()): LiveBingoState {
  const roundId = Math.floor(nowMs / BINGO_CYCLE_MS);
  const elapsed = nowMs % BINGO_CYCLE_MS;
  const allBalls = getBingoRoundBalls(seed, roundId);

  let phase: LiveBingoPhase;
  let secondsRemaining: number;
  let phaseDurationSeconds: number;
  let calledCount: number;
  let nextBallInSeconds: number;

  if (elapsed < BINGO_LOBBY_MS) {
    phase = 'lobby';
    secondsRemaining = Math.max(1, Math.ceil((BINGO_LOBBY_MS - elapsed) / 1000));
    phaseDurationSeconds = BINGO_LOBBY_MS / 1000;
    calledCount = 0;
    nextBallInSeconds = secondsRemaining;
  } else if (elapsed < BINGO_LOBBY_MS + BINGO_CALLING_MS) {
    phase = 'calling';
    const callElapsed = elapsed - BINGO_LOBBY_MS;
    secondsRemaining = Math.max(1, Math.ceil((BINGO_CALLING_MS - callElapsed) / 1000));
    phaseDurationSeconds = BINGO_CALLING_MS / 1000;
    calledCount = Math.min(
      BINGO_TOTAL_BALLS,
      Math.floor(callElapsed / BINGO_BALL_INTERVAL_MS) + 1
    );
    const msIntoBall = callElapsed % BINGO_BALL_INTERVAL_MS;
    nextBallInSeconds =
      calledCount >= BINGO_TOTAL_BALLS
        ? 0
        : Math.max(1, Math.ceil((BINGO_BALL_INTERVAL_MS - msIntoBall) / 1000));
  } else {
    phase = 'results';
    const resultsElapsed = elapsed - BINGO_LOBBY_MS - BINGO_CALLING_MS;
    secondsRemaining = Math.max(1, Math.ceil((BINGO_RESULTS_MS - resultsElapsed) / 1000));
    phaseDurationSeconds = BINGO_RESULTS_MS / 1000;
    calledCount = BINGO_TOTAL_BALLS;
    nextBallInSeconds = 0;
  }

  const calledNumbers = allBalls.slice(0, calledCount);
  const winners = bingoWinnersByRound.get(roundId) || [];
  const lockedMap = bingoLockedByRound.get(roundId);
  const takenCardNumbers: number[] = [];
  if (lockedMap) {
    for (const entry of lockedMap.values()) {
      for (const cn of entry.cardNumbers) {
        takenCardNumbers.push(cn);
      }
    }
  }
  takenCardNumbers.sort((a, b) => a - b);

  const houseTargetBall = getBingoHouseTargetBall(
    seed,
    roundId,
    liveOddsConfig.bingoPlayerWinPercent
  );
  const houseBingoReached = phase !== 'lobby' && calledNumbers.length >= houseTargetBall;

  return {
    roundId,
    phase,
    secondsRemaining,
    phaseDurationSeconds,
    calledNumbers,
    totalBallsToCall: BINGO_TOTAL_BALLS,
    currentBall: calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null,
    nextBallInSeconds,
    activePlayers: Math.max(1, presenceCounts.bingo),
    lockedCardsCount: takenCardNumbers.length,
    takenCardNumbers,
    houseTargetBall,
    houseBingoReached,
    winners,
    serverTimeMs: nowMs,
  };
}

export function getLiveRoundsSnapshot(seed: string, nowMs = Date.now()): LiveRoundsSnapshot {
  const keno = getLiveKenoState(seed, nowMs);
  const bingo = getLiveBingoState(seed, nowMs);
  pruneOldRounds(keno.roundId, bingo.roundId);
  return { keno, bingo };
}

export function getBingoRoundDeck(params: {
  seed: string;
  roundId?: number;
  playerKey?: string;
}): {
  roundId: number;
  cards: BingoDeckCard[];
  myLockedCards: number[];
} {
  const current = getLiveBingoState(params.seed);
  const roundId =
    params.roundId && Number.isInteger(params.roundId) ? params.roundId : current.roundId;

  const lockedMap = bingoLockedByRound.get(roundId);
  const takenByCard = new Map<number, string>();
  let myLockedCards: number[] = [];

  if (lockedMap) {
    for (const entry of lockedMap.values()) {
      if (params.playerKey && entry.playerKey === params.playerKey) {
        myLockedCards = [...entry.cardNumbers];
      }
      for (const cn of entry.cardNumbers) {
        takenByCard.set(cn, entry.username);
      }
    }
  }

  const cards: BingoDeckCard[] = [];
  for (let cn = 1; cn <= BINGO_DECK_SIZE; cn++) {
    cards.push({
      cardNumber: cn,
      values: generateBingoDeckCard(params.seed, roundId, cn),
      takenBy: takenByCard.get(cn) || null,
    });
  }

  return { roundId, cards, myLockedCards };
}

export function getKenoTicketEntry(roundId: number, playerKey: string): KenoTicketEntry | undefined {
  return kenoTicketsByRound.get(roundId)?.get(playerKey);
}

export function getBingoLockedEntry(roundId: number, playerKey: string): BingoLockedEntry | undefined {
  return bingoLockedByRound.get(roundId)?.get(playerKey);
}

export function lockBingoCards(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  userId?: string;
  username: string;
  cardNumbers: number[];
  stakePerCardBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
}): {
  ok: boolean;
  error?: string;
  lockedCards?: number[];
  stakeDeltaBirr?: number;
  totalStakeBirr?: number;
} {
  const current = getLiveBingoState(params.seed);
  if (params.roundId !== current.roundId) {
    return { ok: false, error: 'This Bingo round is no longer active for card picking.' };
  }
  if (current.phase !== 'lobby') {
    return {
      ok: false,
      error: 'Card selection closed because ball calling has already started.',
    };
  }

  const cleanCards = Array.from(
    new Set(
      params.cardNumbers.filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= BINGO_DECK_SIZE
      )
    )
  ).sort((a, b) => a - b);

  if (cleanCards.length < 1 || cleanCards.length > BINGO_MAX_COMBO_CARDS) {
    return {
      ok: false,
      error: `Choose a combination of 1 to ${BINGO_MAX_COMBO_CARDS} cards.`,
    };
  }

  let lockedMap = bingoLockedByRound.get(params.roundId);
  if (!lockedMap) {
    lockedMap = new Map<string, BingoLockedEntry>();
    bingoLockedByRound.set(params.roundId, lockedMap);
  }

  const existing = lockedMap.get(params.playerKey);
  if (existing) {
    return {
      ok: false,
      error: `Your combination (${existing.cardNumbers.map((c) => `#${c}`).join(', ')}) is already locked for this round.`,
    };
  }

  for (const [otherKey, entry] of lockedMap.entries()) {
    if (otherKey === params.playerKey) continue;
    const conflict = cleanCards.find((cn) => entry.cardNumbers.includes(cn));
    if (conflict !== undefined) {
      return {
        ok: false,
        error: `Card #${conflict} was just picked by ${entry.username}. Choose another card.`,
      };
    }
  }

  const totalStakeBirr = roundBirr(cleanCards.length * params.stakePerCardBirr);
  lockedMap.set(params.playerKey, {
    playerKey: params.playerKey,
    userId: params.userId,
    username: params.username,
    cardNumbers: cleanCards,
    stakePerCardBirr: params.stakePerCardBirr,
    totalStakeBirr,
    playerWinPercent: params.playerWinPercent,
    bonusBirr: params.bonusBirr,
    settled: false,
  });

  return {
    ok: true,
    lockedCards: cleanCards,
    stakeDeltaBirr: totalStakeBirr,
    totalStakeBirr,
  };
}

export function lockKenoTicket(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  userId?: string;
  username: string;
  picks: number[];
  stakeBirr: number;
  playerWinPercent: number;
  bonusBirr: number;
}): { ok: boolean; error?: string; ticket?: KenoTicketEntry } {
  const current = getLiveKenoState(params.seed);
  if (params.roundId !== current.roundId) {
    return { ok: false, error: 'This round has already closed. Lock onto the active round.' };
  }
  if (current.phase !== 'picking') {
    return { ok: false, error: 'Ball draw already started! Wait for the next round timer.' };
  }

  const cleanPicks = Array.from(
    new Set(params.picks.filter((n) => Number.isInteger(n) && n >= 1 && n <= 40))
  ).sort((a, b) => a - b);

  if (cleanPicks.length < 1 || cleanPicks.length > 10) {
    return { ok: false, error: 'Select between 1 and 10 numbers before locking.' };
  }

  let map = kenoTicketsByRound.get(params.roundId);
  if (!map) {
    map = new Map<string, KenoTicketEntry>();
    kenoTicketsByRound.set(params.roundId, map);
  }

  const existing = map.get(params.playerKey);
  if (existing) {
    return {
      ok: false,
      error: `Your ${existing.stakeBirr} Birr ticket is already locked for Round #${params.roundId}.`,
    };
  }

  const roll = crypto.randomInt(0, 10_000) / 100;
  const aiFavored = roll >= params.playerWinPercent;

  const entry: KenoTicketEntry = {
    playerKey: params.playerKey,
    userId: params.userId,
    username: params.username,
    picks: cleanPicks,
    stakeBirr: params.stakeBirr,
    playerWinPercent: params.playerWinPercent,
    aiFavored,
    bonusBirr: params.bonusBirr,
    settled: false,
  };
  map.set(params.playerKey, entry);
  return { ok: true, ticket: entry };
}

export function cashoutKenoTicket(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  username: string;
  maxMultiplier: number;
}): {
  ok: boolean;
  error?: string;
  hits: number;
  stakeBirr: number;
  payoutBirr: number;
  multiplier: number;
  picks: number[];
  bonusApplied: number;
} {
  const current = getLiveKenoState(params.seed);
  if (params.roundId !== current.roundId || current.phase !== 'drawing') {
    return {
      ok: false,
      error: 'Early Cash Out is only available while balls are popping.',
      hits: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      picks: [],
      bonusApplied: 0,
    };
  }

  const map = kenoTicketsByRound.get(params.roundId);
  const entry = map?.get(params.playerKey);
  if (!entry) {
    return {
      ok: false,
      error: 'No locked Keno ticket found for this round.',
      hits: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      picks: [],
      bonusApplied: 0,
    };
  }
  if (entry.settled) {
    return {
      ok: false,
      error: 'This Keno ticket is already settled.',
      hits: entry.hits || 0,
      stakeBirr: entry.stakeBirr,
      payoutBirr: entry.payoutBirr || 0,
      multiplier: 0,
      picks: entry.picks,
      bonusApplied: 0,
    };
  }

  const hits = entry.picks.filter((p) => current.drawnBalls.includes(p)).length;
  if (hits < 1) {
    return {
      ok: false,
      error: 'Hit at least 1 popped ball to Cash Out early.',
      hits: 0,
      stakeBirr: entry.stakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      picks: entry.picks,
      bonusApplied: 0,
    };
  }

  const baseMult =
    hits === 1
      ? 0.85
      : Math.min(params.maxMultiplier, Math.round((1.05 + (hits - 1) * 0.45) * 100) / 100);
  const bonusApplied = baseMult > 1 ? Math.max(0, entry.bonusBirr) : 0;
  const payoutBirr = roundBirr(entry.stakeBirr * baseMult + bonusApplied);

  entry.settled = true;
  entry.hits = hits;
  entry.payoutBirr = payoutBirr;
  map!.set(params.playerKey, entry);

  const existingWinners = kenoWinnersByRound.get(params.roundId) || [];
  existingWinners.unshift({
    username: params.username,
    detail: `Cashed Out (${hits}/${entry.picks.length})`,
    payoutBirr,
    timestamp: new Date().toISOString(),
  });
  kenoWinnersByRound.set(params.roundId, existingWinners.slice(0, 12));

  return {
    ok: true,
    hits,
    stakeBirr: entry.stakeBirr,
    payoutBirr,
    multiplier: baseMult,
    picks: entry.picks,
    bonusApplied,
  };
}

export function settleKenoTicket(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  username: string;
  fallbackPicks?: number[];
  playerWinPercent: number;
  bonusBirr: number;
  maxMultiplier: number;
}): {
  ok: boolean;
  alreadySettled?: boolean;
  error?: string;
  hits: number;
  stakeBirr: number;
  payoutBirr: number;
  multiplier: number;
  drawnBalls: number[];
  picks: number[];
  isWin: boolean;
} {
  const nowMs = Date.now();
  const currentRoundId = Math.floor(nowMs / KENO_CYCLE_MS);
  const elapsed = nowMs % KENO_CYCLE_MS;

  const isRoundFinished =
    params.roundId < currentRoundId ||
    (params.roundId === currentRoundId && elapsed >= KENO_PICKING_MS + KENO_DRAWING_MS);

  if (!isRoundFinished) {
    return {
      ok: false,
      error: 'Round balls are still popping. Wait until all 10 balls are drawn.',
      hits: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      drawnBalls: [],
      picks: [],
      isWin: false,
    };
  }

  const map = kenoTicketsByRound.get(params.roundId);
  const entry = map?.get(params.playerKey);
  const drawnBalls = getKenoRoundBalls(params.seed, params.roundId);

  if (!entry) {
    return {
      ok: false,
      error: 'No locked Birr ticket found for this Keno round.',
      hits: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      drawnBalls,
      picks: [],
      isWin: false,
    };
  }

  if (entry.settled) {
    const hits = entry.hits || 0;
    const payoutBirr = entry.payoutBirr || 0;
    return {
      ok: true,
      alreadySettled: true,
      hits,
      stakeBirr: entry.stakeBirr,
      payoutBirr,
      multiplier: entry.stakeBirr > 0 ? roundBirr(payoutBirr / entry.stakeBirr) : 0,
      drawnBalls,
      picks: entry.picks,
      isWin: payoutBirr >= entry.stakeBirr,
    };
  }

  const hits = entry.picks.filter((p) => drawnBalls.includes(p)).length;
  const calc = computeKenoPayoutBirr({
    picksCount: entry.picks.length,
    hits,
    stakeBirr: entry.stakeBirr,
    playerWinPercent: entry.playerWinPercent || params.playerWinPercent,
    aiFavored: entry.aiFavored,
    bonusBirr: entry.bonusBirr ?? params.bonusBirr,
    maxMultiplier: params.maxMultiplier,
  });

  entry.settled = true;
  entry.hits = hits;
  entry.payoutBirr = calc.payoutBirr;
  map!.set(params.playerKey, entry);

  const existingWinners = kenoWinnersByRound.get(params.roundId) || [];
  if (calc.payoutBirr > 0) {
    existingWinners.unshift({
      username: params.username,
      detail: `${hits}/${entry.picks.length} hits`,
      payoutBirr: calc.payoutBirr,
      timestamp: new Date().toISOString(),
    });
    kenoWinnersByRound.set(params.roundId, existingWinners.slice(0, 12));
  }

  return {
    ok: true,
    alreadySettled: false,
    hits,
    stakeBirr: entry.stakeBirr,
    payoutBirr: calc.payoutBirr,
    multiplier: calc.multiplier,
    drawnBalls,
    picks: entry.picks,
    isWin: calc.isWin,
  };
}

export function claimLiveBingo(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  username: string;
  cardNumber?: number;
  cardValues: Array<number | 'FREE'>;
  playerWinPercent: number;
  bonusBirr: number;
  maxMultiplier: number;
}): {
  ok: boolean;
  alreadyClaimed?: boolean;
  houseWonFirst?: boolean;
  error?: string;
  cardNumber?: number;
  winningLine?: number[];
  ballsUsed: number;
  stakeBirr: number;
  payoutBirr: number;
  multiplier: number;
  score: number;
} {
  const current = getLiveBingoState(params.seed);
  if (params.roundId !== current.roundId) {
    return {
      ok: false,
      error: 'This Bingo round has ended. Join the live round!',
      ballsUsed: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }
  if (current.phase === 'lobby') {
    return {
      ok: false,
      error: 'Wait for the 1-minute card choosing countdown to finish and balls to pop!',
      ballsUsed: 0,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }

  const lockedMap = bingoLockedByRound.get(params.roundId);
  const lockedEntry = lockedMap?.get(params.playerKey);
  if (!lockedEntry) {
    return {
      ok: false,
      error: 'Lock 1–4 cards with Birr during the lobby countdown first.',
      ballsUsed: current.calledNumbers.length,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }

  let claims = bingoClaimsByRound.get(params.roundId);
  if (!claims) {
    claims = new Map<string, BingoClaimEntry>();
    bingoClaimsByRound.set(params.roundId, claims);
  }

  const existing = claims.get(params.playerKey);
  if (existing) {
    return {
      ok: true,
      alreadyClaimed: true,
      cardNumber: existing.cardNumber,
      ballsUsed: existing.ballsUsed,
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: existing.payoutBirr,
      multiplier:
        lockedEntry.totalStakeBirr > 0
          ? roundBirr(existing.payoutBirr / lockedEntry.totalStakeBirr)
          : 0,
      score: Math.max(10, 100 - existing.ballsUsed),
    };
  }

  // Enforce House AI race calibrated to playerWinPercent (e.g. 70% House win / 30% Player win)
  const houseTargetBall = getBingoHouseTargetBall(
    params.seed,
    params.roundId,
    lockedEntry.playerWinPercent || params.playerWinPercent
  );
  if (current.calledNumbers.length >= houseTargetBall) {
    lockedEntry.settled = true;
    return {
      ok: false,
      houseWonFirst: true,
      error: `House AI reached Bingo at ball #${houseTargetBall}! Stake settled for this round.`,
      ballsUsed: current.calledNumbers.length,
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }

  const resolvedCardNum = params.cardNumber;
  if (
    resolvedCardNum === undefined ||
    !Number.isInteger(resolvedCardNum) ||
    !lockedEntry.cardNumbers.includes(resolvedCardNum)
  ) {
    return {
      ok: false,
      error: 'Select one of your locked cards with a completed Bingo line.',
      ballsUsed: current.calledNumbers.length,
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }

  const verifiedValues = generateBingoDeckCard(params.seed, params.roundId, resolvedCardNum);
  const winningLine = validateBingoCardLine(verifiedValues, current.calledNumbers);
  if (!winningLine) {
    return {
      ok: false,
      error: 'No completed 5-in-a-row line matches the live called balls yet.',
      ballsUsed: current.calledNumbers.length,
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      score: 0,
    };
  }

  const comboSize = lockedEntry.cardNumbers.length;
  const ballsUsed = current.calledNumbers.length;
  const speedBonusMult = ballsUsed <= 18 ? 0.9 : ballsUsed <= 28 ? 0.5 : 0.25;
  const comboBoost = comboSize > 1 ? (comboSize - 1) * 0.15 : 0;
  const multiplier = Math.min(
    params.maxMultiplier,
    Math.round((1.9 + speedBonusMult + comboBoost) * 100) / 100
  );
  const payoutBirr = roundBirr(
    lockedEntry.totalStakeBirr * multiplier + Math.max(0, lockedEntry.bonusBirr ?? params.bonusBirr)
  );
  const score = Math.max(10, 100 - ballsUsed);

  lockedEntry.settled = true;

  claims.set(params.playerKey, {
    playerKey: params.playerKey,
    username: params.username,
    cardNumber: resolvedCardNum,
    ballsUsed,
    payoutBirr,
  });

  const existingWinners = bingoWinnersByRound.get(params.roundId) || [];
  existingWinners.unshift({
    username: params.username,
    detail: `Card #${resolvedCardNum} · ${ballsUsed} balls`,
    payoutBirr,
    timestamp: new Date().toISOString(),
  });
  bingoWinnersByRound.set(params.roundId, existingWinners.slice(0, 12));

  return {
    ok: true,
    alreadyClaimed: false,
    cardNumber: resolvedCardNum,
    winningLine,
    ballsUsed,
    stakeBirr: lockedEntry.totalStakeBirr,
    payoutBirr,
    multiplier,
    score,
  };
}

function getBestCardLineHits(cardValues: Array<number | 'FREE'>, calledSet: Set<number>): number {
  const lines: number[][] = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];
  let best = 0;
  for (const line of lines) {
    let hits = 0;
    for (const idx of line) {
      const val = cardValues[idx];
      if (val === 'FREE' || calledSet.has(val)) hits += 1;
    }
    if (hits > best) best = hits;
  }
  return best;
}

export function cashoutLiveBingo(params: {
  seed: string;
  roundId: number;
  playerKey: string;
  username: string;
  maxMultiplier: number;
}): {
  ok: boolean;
  error?: string;
  stakeBirr: number;
  payoutBirr: number;
  multiplier: number;
  bestLine: number;
  bonusApplied: number;
} {
  const current = getLiveBingoState(params.seed);
  if (params.roundId !== current.roundId || current.phase !== 'calling') {
    return {
      ok: false,
      error: 'Early Cash Out is only available while balls are being called.',
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      bestLine: 0,
      bonusApplied: 0,
    };
  }
  if (current.houseBingoReached) {
    return {
      ok: false,
      error: `House AI already reached Bingo at ball #${current.houseTargetBall}.`,
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      bestLine: 0,
      bonusApplied: 0,
    };
  }

  const lockedEntry = bingoLockedByRound.get(params.roundId)?.get(params.playerKey);
  if (!lockedEntry) {
    return {
      ok: false,
      error: 'No locked Bingo cards found for this round.',
      stakeBirr: 0,
      payoutBirr: 0,
      multiplier: 0,
      bestLine: 0,
      bonusApplied: 0,
    };
  }
  if (lockedEntry.settled) {
    return {
      ok: false,
      error: 'Your Bingo cards for this round are already settled.',
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      bestLine: 0,
      bonusApplied: 0,
    };
  }

  const calledSet = new Set(current.calledNumbers);
  let bestLine = 0;
  for (const cn of lockedEntry.cardNumbers) {
    const vals = generateBingoDeckCard(params.seed, params.roundId, cn);
    bestLine = Math.max(bestLine, getBestCardLineHits(vals, calledSet));
  }

  if (bestLine < 3) {
    return {
      ok: false,
      error: 'Reach at least 3/5 on any line to unlock Early Cash Out.',
      stakeBirr: lockedEntry.totalStakeBirr,
      payoutBirr: 0,
      multiplier: 0,
      bestLine,
      bonusApplied: 0,
    };
  }

  const mult =
    bestLine >= 5
      ? Math.min(params.maxMultiplier, 1.85)
      : bestLine === 4
        ? 1.15
        : 0.75;
  const bonusApplied = mult > 1 ? Math.max(0, lockedEntry.bonusBirr) : 0;
  const payoutBirr = roundBirr(lockedEntry.totalStakeBirr * mult + bonusApplied);

  lockedEntry.settled = true;

  const existingWinners = bingoWinnersByRound.get(params.roundId) || [];
  existingWinners.unshift({
    username: params.username,
    detail: `Cash Out (${bestLine}/5 line)`,
    payoutBirr,
    timestamp: new Date().toISOString(),
  });
  bingoWinnersByRound.set(params.roundId, existingWinners.slice(0, 12));

  return {
    ok: true,
    stakeBirr: lockedEntry.totalStakeBirr,
    payoutBirr,
    multiplier: mult,
    bestLine,
    bonusApplied,
  };
}

export function settleBingoHouseLoss(params: {
  seed: string;
  roundId: number;
  playerKey: string;
}): {
  ok: boolean;
  alreadySettled?: boolean;
  error?: string;
  stakeBirr: number;
  houseTargetBall: number;
} {
  const nowMs = Date.now();
  const state = getLiveBingoState(params.seed, nowMs);
  const lockedEntry = bingoLockedByRound.get(params.roundId)?.get(params.playerKey);
  if (!lockedEntry) {
    return {
      ok: false,
      error: 'No locked Bingo entry found.',
      stakeBirr: 0,
      houseTargetBall: state.houseTargetBall,
    };
  }
  if (lockedEntry.settled) {
    return {
      ok: true,
      alreadySettled: true,
      stakeBirr: lockedEntry.totalStakeBirr,
      houseTargetBall: state.houseTargetBall,
    };
  }

  const houseTargetBall = getBingoHouseTargetBall(
    params.seed,
    params.roundId,
    lockedEntry.playerWinPercent
  );
  const isFinished =
    params.roundId < state.roundId ||
    (params.roundId === state.roundId &&
      state.phase !== 'lobby' &&
      state.calledNumbers.length >= houseTargetBall);

  if (!isFinished) {
    return {
      ok: false,
      error: 'House AI has not completed Bingo yet.',
      stakeBirr: lockedEntry.totalStakeBirr,
      houseTargetBall,
    };
  }

  lockedEntry.settled = true;
  return {
    ok: true,
    alreadySettled: false,
    stakeBirr: lockedEntry.totalStakeBirr,
    houseTargetBall,
  };
}
