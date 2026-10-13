// src/shared/utils/gameStatLog.ts
// Pure model of the stats recorded during a live game. There is one entry per
// round; game totals are always derived from the rounds, never stored twice.
// The live quick-log and the end-of-round review both write to the SAME round
// entry, so nothing is double counted. No React, no storage in this module.
import type { Player, PlayerStats, RoundStatEntry } from '../../types';

export const COUNT_STAT_KEYS = ['kills', 'deaths', 'assists', 'goldEarned', 'minionKills'] as const;
export type CountStatKey = (typeof COUNT_STAT_KEYS)[number];
export type StatKey = CountStatKey | 'level';
export const STAT_KEYS: readonly StatKey[] = [...COUNT_STAT_KEYS, 'level'];

/** Which stat categories are switched on. */
export type StatCategories = Record<StatKey, boolean>;

/**
 * One player's values for one round. A missing key means "not tracked this
 * round"; 0 means "tracked, none". `level` is the level at the end of the
 * round (a snapshot), every other key is a count for that round.
 */
export type RoundStatValues = Partial<Record<StatKey, number>>;

/** Values for every player in one round, keyed by the in-game Player.id. */
export type RoundValues = Record<number, RoundStatValues>;

export interface RoundLogEntry {
  round: number;
  /** true once the end-of-round (or final-round) review for this round was saved. */
  reviewed: boolean;
  players: RoundValues;
}

export interface GameStatLog {
  /** Sorted by round, at most one entry per round. */
  rounds: RoundLogEntry[];
  /**
   * Totals carried over from an in-progress game saved by an app version that
   * had no round log. Added to the derived totals; while present the log is
   * incomplete, so no per-round log is attached to the saved match.
   */
  baseline?: Record<number, PlayerStats>;
}

type TotalKey = Exclude<keyof PlayerStats, 'level'>;

const TOTAL_KEY: Record<CountStatKey, TotalKey> = {
  kills: 'totalKills',
  deaths: 'totalDeaths',
  assists: 'totalAssists',
  goldEarned: 'totalGoldEarned',
  minionKills: 'totalMinionKills',
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function createEmptyStatLog(): GameStatLog {
  return { rounds: [] };
}

function cleanStatValues(values: RoundStatValues | undefined): RoundStatValues {
  const out: RoundStatValues = {};
  if (!values || typeof values !== 'object') return out;
  for (const key of STAT_KEYS) {
    const value = values[key];
    if (isFiniteNumber(value)) out[key] = Math.max(0, Math.round(value));
  }
  return out;
}

function cleanRoundValues(values: RoundValues | undefined): RoundValues {
  const out: RoundValues = {};
  if (!values || typeof values !== 'object') return out;
  for (const [id, playerValues] of Object.entries(values)) {
    const playerId = Number(id);
    if (!Number.isInteger(playerId)) continue;
    out[playerId] = cleanStatValues(playerValues);
  }
  return out;
}

function upsertRound(log: GameStatLog, entry: RoundLogEntry): GameStatLog {
  const rounds = log.rounds
    .filter(existing => existing.round !== entry.round)
    .concat(entry)
    .sort((a, b) => a.round - b.round);
  return { ...log, rounds };
}

export function getRoundEntry(log: GameStatLog, round: number): RoundLogEntry | undefined {
  return log.rounds.find(entry => entry.round === round);
}

export function isRoundReviewed(log: GameStatLog, round: number): boolean {
  return getRoundEntry(log, round)?.reviewed === true;
}

/**
 * Save the reviewed values for a round. REPLACES whatever the round held
 * (live tallies, an earlier draft) - the review was pre-filled with them.
 */
export function commitRound(log: GameStatLog, round: number, values: RoundValues): GameStatLog {
  return upsertRound(log, { round, reviewed: true, players: cleanRoundValues(values) });
}

/** Game totals for one player, derived from baseline + every round. undefined = nothing tracked. */
export function deriveTotals(log: GameStatLog, playerId: number): PlayerStats | undefined {
  const base = log.baseline?.[playerId];
  const totals: PlayerStats = {};
  for (const key of COUNT_STAT_KEYS) {
    const baseValue = base?.[TOTAL_KEY[key]];
    if (isFiniteNumber(baseValue)) totals[TOTAL_KEY[key]] = baseValue;
  }
  let level: number | undefined = isFiniteNumber(base?.level) ? base?.level : undefined;

  for (const entry of log.rounds) {
    const values = entry.players[playerId];
    if (!values) continue;
    for (const key of COUNT_STAT_KEYS) {
      const value = values[key];
      if (isFiniteNumber(value)) {
        const totalKey = TOTAL_KEY[key];
        totals[totalKey] = (totals[totalKey] ?? 0) + value;
      }
    }
    if (isFiniteNumber(values.level)) level = values.level;
  }
  if (level !== undefined) totals.level = level;

  return Object.keys(totals).length > 0 ? totals : undefined;
}

/** Players with `stats` replaced by the totals derived from the log. */
export function applyTotalsToPlayers(players: Player[], log: GameStatLog): Player[] {
  return players.map(player => ({ ...player, stats: deriveTotals(log, player.id) }));
}

function levelBefore(log: GameStatLog, round: number, playerId: number): number | undefined {
  let level = log.baseline?.[playerId]?.level;
  for (const entry of log.rounds) {
    if (entry.round >= round) break;
    const value = entry.players[playerId]?.level;
    if (isFiniteNumber(value)) level = value;
  }
  return level;
}

/**
 * Values to pre-fill the end-of-round / final-round review with: whatever is
 * already logged for the round (live tallies or a draft), 0 for every other
 * count, and the player's latest known level (default 1).
 */
export function buildReviewValues(
  log: GameStatLog,
  round: number,
  players: ReadonlyArray<Pick<Player, 'id'>>
): RoundValues {
  const entry = getRoundEntry(log, round);
  const out: RoundValues = {};
  for (const player of players) {
    const current = entry?.players[player.id] ?? {};
    const values: RoundStatValues = {};
    for (const key of COUNT_STAT_KEYS) values[key] = current[key] ?? 0;
    values.level = current.level ?? levelBefore(log, round, player.id) ?? 1;
    out[player.id] = values;
  }
  return out;
}

/**
 * Keep only the enabled categories. Enabled categories always get a number
 * (0 when nothing was entered) so tracked zeros are saved as 0, not undefined.
 */
export function filterValuesToCategories(values: RoundValues, categories: StatCategories): RoundValues {
  const out: RoundValues = {};
  for (const [id, playerValues] of Object.entries(values)) {
    const filtered: RoundStatValues = {};
    for (const key of STAT_KEYS) {
      if (!categories[key]) continue;
      filtered[key] = playerValues?.[key] ?? (key === 'level' ? 1 : 0);
    }
    out[Number(id)] = filtered;
  }
  return out;
}

/** Log for a game saved before the round log existed: its totals become a baseline. */
export function createLegacyStatLog(players: ReadonlyArray<Pick<Player, 'id' | 'stats'>>): GameStatLog {
  const baseline: Record<number, PlayerStats> = {};
  for (const player of players) {
    if (player.stats && Object.values(player.stats).some(isFiniteNumber)) {
      baseline[player.id] = { ...player.stats };
    }
  }
  return Object.keys(baseline).length > 0 ? { rounds: [], baseline } : createEmptyStatLog();
}

/** Rebuild a log read back from the autosave; falls back to a legacy baseline. */
export function restoreStatLog(
  raw: unknown,
  players: ReadonlyArray<Pick<Player, 'id' | 'stats'>>
): GameStatLog {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { rounds?: unknown }).rounds)) {
    return createLegacyStatLog(players);
  }
  const source = raw as { rounds: unknown[]; baseline?: unknown };
  const rounds: RoundLogEntry[] = [];
  for (const item of source.rounds) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Partial<RoundLogEntry>;
    if (!isFiniteNumber(entry.round) || rounds.some(r => r.round === entry.round)) continue;
    rounds.push({
      round: entry.round,
      reviewed: entry.reviewed === true,
      players: cleanRoundValues(entry.players),
    });
  }
  rounds.sort((a, b) => a.round - b.round);
  const log: GameStatLog = { rounds };
  if (source.baseline && typeof source.baseline === 'object') {
    log.baseline = { ...(source.baseline as Record<number, PlayerStats>) };
  }
  return log;
}

/**
 * Store values entered in a review that was closed (X) without saving, so they
 * are not lost. MERGES per player into what the round already holds: a
 * category or player the draft leaves out keeps its logged value. Keeps the
 * round's reviewed flag as it was.
 */
export function saveRoundDraft(log: GameStatLog, round: number, values: RoundValues): GameStatLog {
  const existing = getRoundEntry(log, round);
  const players: RoundValues = { ...existing?.players };
  for (const [id, draftValues] of Object.entries(cleanRoundValues(values))) {
    const playerId = Number(id);
    players[playerId] = { ...existing?.players[playerId], ...draftValues };
  }
  return upsertRound(log, {
    round,
    reviewed: existing?.reviewed ?? false,
    players,
  });
}

export interface FinalRoundStatus {
  round: number;
  reviewed: boolean;
}

/**
 * Which round the final-round review applies to. If victory is declared at the
 * very start of a round (turn 1, strategy phase, nothing logged yet) right
 * after the previous round was reviewed, the game really ended with that
 * reviewed round.
 */
export function getFinalRoundStatus(
  log: GameStatLog,
  state: { round: number; turn: number; currentPhase: string }
): FinalRoundStatus {
  const { round, turn, currentPhase } = state;
  const nothingPlayedYet = turn === 1 && currentPhase === 'strategy' && !getRoundEntry(log, round);
  if (nothingPlayedYet && round > 1 && isRoundReviewed(log, round - 1)) {
    return { round: round - 1, reviewed: true };
  }
  return { round, reviewed: isRoundReviewed(log, round) };
}

/**
 * The per-round log to store on the saved match for one player, or undefined
 * when there is nothing to store or the log is incomplete (legacy baseline).
 * Entries hold the round number and stat counts only - never player names or
 * ids (a player rename re-keys the match-player row, not its log).
 */
export function toMatchRoundStats(log: GameStatLog, playerId: number): RoundStatEntry[] | undefined {
  if (log.baseline) return undefined;
  const entries: RoundStatEntry[] = [];
  for (const roundEntry of log.rounds) {
    const values = roundEntry.players[playerId];
    if (!values) continue;
    const entry: RoundStatEntry = { round: roundEntry.round };
    let hasValue = false;
    for (const key of STAT_KEYS) {
      const value = values[key];
      if (isFiniteNumber(value)) {
        entry[key] = value;
        hasValue = true;
      }
    }
    if (hasValue) entries.push(entry);
  }
  return entries.length > 0 ? entries : undefined;
}

export interface StatChange {
  playerId: number;
  stat: CountStatKey;
  delta: number;
}

/** Apply live quick-log changes to a round (clamped at 0). Keeps the reviewed flag. */
export function applyStatChanges(log: GameStatLog, round: number, changes: ReadonlyArray<StatChange>): GameStatLog {
  if (changes.length === 0) return log;
  const existing = getRoundEntry(log, round);
  const players: RoundValues = { ...(existing?.players ?? {}) };
  for (const change of changes) {
    const previous = players[change.playerId] ?? {};
    players[change.playerId] = {
      ...previous,
      [change.stat]: Math.max(0, (previous[change.stat] ?? 0) + change.delta),
    };
  }
  return upsertRound(log, { round, reviewed: existing?.reviewed ?? false, players });
}

export function invertStatChanges(changes: ReadonlyArray<StatChange>): StatChange[] {
  return changes.map(change => ({ ...change, delta: -change.delta }));
}

/**
 * Changes for "this player defeated an enemy hero": +1 kill when kills are
 * tracked and, when assists are tracked, +1 assist for each teammate (the same
 * rule as "Got Kill" in the end-of-round review).
 */
export function buildKillChanges(
  players: ReadonlyArray<Pick<Player, 'id' | 'team'>>,
  killerId: number,
  categories: StatCategories
): StatChange[] {
  const changes: StatChange[] = [];
  const killer = players.find(player => player.id === killerId);
  if (!killer) return changes;
  if (categories.kills) changes.push({ playerId: killerId, stat: 'kills', delta: 1 });
  if (categories.assists) {
    for (const teammate of players) {
      if (teammate.team === killer.team && teammate.id !== killerId) {
        changes.push({ playerId: teammate.id, stat: 'assists', delta: 1 });
      }
    }
  }
  return changes;
}
