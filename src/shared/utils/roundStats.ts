// src/shared/utils/roundStats.ts
// The optional per-round log stored on a saved match player (roundStats):
// validation at every boundary (JSON import, cloud download).
import type { RoundStatEntry } from '../../types';

export const ROUND_STAT_FIELDS = ['kills', 'deaths', 'assists', 'goldEarned', 'minionKills', 'level'] as const;
export type RoundStatField = (typeof ROUND_STAT_FIELDS)[number];

/**
 * Accepts anything (parsed JSON, a JSON string, null from Supabase) and returns
 * a clean, round-sorted RoundStatEntry[] - or undefined when there is no usable
 * entry. Invalid entries/fields are dropped, never thrown on.
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
    for (const field of ROUND_STAT_FIELDS) {
      const fieldValue = source[field];
      if (typeof fieldValue === 'number' && Number.isFinite(fieldValue) && fieldValue >= 0) {
        entry[field] = fieldValue;
      }
    }
    byRound.set(round, entry);
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
