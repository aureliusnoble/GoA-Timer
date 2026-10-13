// src/shared/utils/roundStats.ts
// The optional per-round log stored on a saved match player (roundStats):
// validation at every boundary (JSON import, cloud download) and the
// round-by-round table shown in Match History.
import { Team, type RoundStatEntry } from '../../types';
import { TRACKED_STAT_KEYS, isTrackedStat } from './trackedStats';

export const ROUND_STAT_FIELDS = ['kills', 'deaths', 'assists', 'goldEarned', 'minionKills', 'level'] as const;
export type RoundStatField = (typeof ROUND_STAT_FIELDS)[number];

/**
 * Accepts anything (parsed JSON, a JSON string, null from Supabase) and returns
 * a clean, round-sorted RoundStatEntry[] - or undefined when there is no usable
 * entry. Invalid entries/fields are dropped, never thrown on; an entry is kept
 * only when it holds at least one valid stat (the first such entry per round wins).
 */
export function sanitizeRoundStats(raw: unknown): RoundStatEntry[] | undefined {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;

  const byRound = new Map<number, RoundStatEntry>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const round = source.round;
    if (typeof round !== 'number' || !Number.isInteger(round) || round < 1 || byRound.has(round)) continue;
    const entry: RoundStatEntry = { round };
    let hasStat = false;
    for (const field of ROUND_STAT_FIELDS) {
      const fieldValue = source[field];
      if (typeof fieldValue === 'number' && Number.isFinite(fieldValue) && fieldValue >= 0) {
        entry[field] = fieldValue;
        hasStat = true;
      }
    }
    if (hasStat) byRound.set(round, entry);
  }
  const entries = [...byRound.values()].sort((a, b) => a.round - b.round);
  return entries.length > 0 ? entries : undefined;
}

/** Copy of a match player with roundStats validated; the key is removed when there is nothing valid. */
export function withSanitizedRoundStats<T extends object>(matchPlayer: T): T {
  const { roundStats, ...rest } = matchPlayer as T & { roundStats?: unknown };
  const clean = sanitizeRoundStats(roundStats);
  return (clean ? { ...rest, roundStats: clean } : rest) as T;
}

export interface RoundLogPlayer {
  id: string;
  playerName: string;
  heroName: string;
  team: string;
  roundStats?: RoundStatEntry[];
}

export interface RoundLogRow {
  matchPlayerId: string;
  playerName: string;
  heroName: string;
  team: string;
  entry?: RoundStatEntry;
}

export interface RoundLog {
  /** Stat columns that have at least one value in this match, in Match History's display order. */
  columns: RoundStatField[];
  rounds: { round: number; rows: RoundLogRow[] }[];
}

function hasStatValue(entry: RoundStatEntry): boolean {
  return ROUND_STAT_FIELDS.some(field => isTrackedStat(entry[field]));
}

/**
 * Build the round-by-round table; null when no player has a round log.
 * Entries without any stat value are ignored, so every round shown has at least
 * one value. A player with nothing in a round gets a row with no entry (a gap).
 */
export function buildRoundLog(players: ReadonlyArray<RoundLogPlayer>): RoundLog | null {
  const logged = players.map(player => ({
    player,
    entries: (player.roundStats ?? []).filter(hasStatValue),
  }));

  const roundNumbers = new Set<number>();
  const usedFields = new Set<RoundStatField>();
  for (const { entries } of logged) {
    for (const entry of entries) {
      roundNumbers.add(entry.round);
      for (const field of ROUND_STAT_FIELDS) {
        if (isTrackedStat(entry[field])) usedFields.add(field);
      }
    }
  }
  if (roundNumbers.size === 0) return null;

  const teamOrder = (team: string) => (team === Team.Titans ? 0 : 1);
  const ordered = [...logged].sort((a, b) => teamOrder(a.player.team) - teamOrder(b.player.team));

  return {
    columns: TRACKED_STAT_KEYS.filter(field => usedFields.has(field)),
    rounds: [...roundNumbers]
      .sort((a, b) => a - b)
      .map(round => ({
        round,
        rows: ordered.map(({ player, entries }) => ({
          matchPlayerId: player.id,
          playerName: player.playerName,
          heroName: player.heroName,
          team: player.team,
          entry: entries.find(entry => entry.round === round),
        })),
      })),
  };
}
