// src/shared/utils/matchStatDisplay.ts
import { StatRecord, TrackedStatKey, TRACKED_STAT_KEYS, isTrackedStat } from './trackedStats';

/** Stat keys tracked for at least one player in a match, in canonical display order. */
export function getTrackedStatKeys(records: readonly StatRecord[]): TrackedStatKey[] {
  return TRACKED_STAT_KEYS.filter(key => records.some(record => isTrackedStat(record[key])));
}

/** A stat value for display: the number (0 included) or an en dash when not tracked. */
export function formatStatValue(value: number | null | undefined): string {
  return isTrackedStat(value) ? String(value) : '–';
}

/**
 * One-line summary of a player's recorded stats in a match, for example
 * "KDA 2/0/– • 14 minions • 1,200 gold • Level 6". Returns null when nothing was tracked.
 */
export function formatMatchStatLine(record: StatRecord): string | null {
  const parts: string[] = [];
  if (isTrackedStat(record.kills) || isTrackedStat(record.deaths) || isTrackedStat(record.assists)) {
    parts.push(
      `KDA ${formatStatValue(record.kills)}/${formatStatValue(record.deaths)}/${formatStatValue(record.assists)}`
    );
  }
  if (isTrackedStat(record.minionKills)) parts.push(`${record.minionKills} minions`);
  if (isTrackedStat(record.goldEarned)) parts.push(`${record.goldEarned.toLocaleString()} gold`);
  if (isTrackedStat(record.level)) parts.push(`Level ${record.level}`);
  return parts.length > 0 ? parts.join(' • ') : null;
}
