// src/shared/utils/trackedStats.ts
//
// One definition of "tracked" for per-match player stats:
//   undefined / null  -> not tracked in that match
//   any finite number -> tracked (0 is a legitimate tracked value)

import { isTrackedStat } from './statValues';

/** Re-exported so stat consumers can import it alongside the summaries. */
export { isTrackedStat } from './statValues';

export type TrackedStatKey = 'kills' | 'deaths' | 'assists' | 'minionKills' | 'goldEarned' | 'level';

/** Canonical display order for per-match stats. */
export const TRACKED_STAT_KEYS: readonly TrackedStatKey[] = [
  'kills',
  'deaths',
  'assists',
  'minionKills',
  'goldEarned',
  'level',
];

export type StatRecord = Partial<Record<TrackedStatKey, number | null>>;

export interface StatSummary {
  /** Sum over the games where the stat was tracked. */
  total: number;
  /** Number of games where the stat was tracked. */
  games: number;
  /** total / games, or 0 when the stat was never tracked. Unrounded. */
  average: number;
}

export interface PlayerStatSummary {
  kills: StatSummary;
  deaths: StatSummary;
  assists: StatSummary;
  minionKills: StatSummary;
  goldEarned: StatSummary;
  level: StatSummary;
  /** kills.total / deaths.total (kills.total when there are no deaths), rounded to 2 decimals. */
  kdRatio: number;
  /** Kills, deaths, assists or gold tracked in at least one game. */
  hasCombatStats: boolean;
  /** Any of the six stats tracked in at least one game. */
  hasAnyTrackedStats: boolean;
}

export function summarizeStat(records: readonly StatRecord[], key: TrackedStatKey): StatSummary {
  let total = 0;
  let games = 0;
  for (const record of records) {
    const value = record[key];
    if (isTrackedStat(value)) {
      total += value;
      games++;
    }
  }
  return { total, games, average: games > 0 ? total / games : 0 };
}

/** Per-stat totals, tracked-game counts and averages for one player's matches. */
export function summarizePlayerStats(records: readonly StatRecord[]): PlayerStatSummary {
  const kills = summarizeStat(records, 'kills');
  const deaths = summarizeStat(records, 'deaths');
  const assists = summarizeStat(records, 'assists');
  const minionKills = summarizeStat(records, 'minionKills');
  const goldEarned = summarizeStat(records, 'goldEarned');
  const level = summarizeStat(records, 'level');
  const kd = deaths.total === 0 ? kills.total : kills.total / deaths.total;
  return {
    kills,
    deaths,
    assists,
    minionKills,
    goldEarned,
    level,
    kdRatio: parseFloat(kd.toFixed(2)),
    hasCombatStats: kills.games + deaths.games + assists.games + goldEarned.games > 0,
    hasAnyTrackedStats: [kills, deaths, assists, minionKills, goldEarned, level].some(s => s.games > 0),
  };
}

/** "3 of 5 games" - how many of the player's games a stat was tracked in. */
export function formatTrackedGames(games: number, totalGames: number): string {
  return `${games} of ${totalGames} game${totalGames === 1 ? '' : 's'}`;
}
