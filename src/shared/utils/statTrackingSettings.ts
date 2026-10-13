// src/shared/utils/statTrackingSettings.ts
// Which in-game stats the user tracks. Remembered between games in localStorage.
import { COUNT_STAT_KEYS, STAT_KEYS, GameStatLog, StatCategories } from './gameStatLog';

export const STAT_TRACKING_STORAGE_KEY = 'goa-stat-tracking';

export interface StatTrackingSettings {
  /** The "Log Player Stats" switch. */
  enabled: boolean;
  categories: StatCategories;
}

export const DEFAULT_STAT_CATEGORIES: StatCategories = {
  kills: false,
  deaths: false,
  assists: false,
  goldEarned: false,
  minionKills: false,
  level: false,
};

export function defaultStatTrackingSettings(): StatTrackingSettings {
  return { enabled: false, categories: { ...DEFAULT_STAT_CATEGORIES } };
}

/** Parse the stored JSON; anything missing or malformed falls back to "off". */
export function parseStatTrackingSettings(raw: string | null): StatTrackingSettings {
  if (!raw) return defaultStatTrackingSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultStatTrackingSettings();
    const source = parsed as { enabled?: unknown; categories?: unknown };
    const storedCategories =
      source.categories && typeof source.categories === 'object'
        ? (source.categories as Record<string, unknown>)
        : {};
    const categories: StatCategories = { ...DEFAULT_STAT_CATEGORIES };
    for (const key of STAT_KEYS) categories[key] = storedCategories[key] === true;
    return { enabled: source.enabled === true, categories };
  } catch {
    return defaultStatTrackingSettings();
  }
}

export function serializeStatTrackingSettings(settings: StatTrackingSettings): string {
  return JSON.stringify({ enabled: settings.enabled, categories: settings.categories });
}

export function loadStatTrackingSettings(): StatTrackingSettings {
  try {
    return parseStatTrackingSettings(localStorage.getItem(STAT_TRACKING_STORAGE_KEY));
  } catch {
    return defaultStatTrackingSettings();
  }
}

export function saveStatTrackingSettings(settings: StatTrackingSettings): void {
  try {
    localStorage.setItem(STAT_TRACKING_STORAGE_KEY, serializeStatTrackingSettings(settings));
  } catch {
    // Storage unavailable (private mode, quota): the setting just isn't remembered.
  }
}

/**
 * Categories in use this game: the switched-on categories (when logging is on)
 * plus any category that already has values in the game's round log.
 */
export function getCategoriesInUse(log: GameStatLog, settings: StatTrackingSettings): StatCategories {
  const inUse: StatCategories = { ...DEFAULT_STAT_CATEGORIES };
  for (const key of STAT_KEYS) {
    if (settings.enabled && settings.categories[key]) inUse[key] = true;
  }
  for (const entry of log.rounds) {
    for (const values of Object.values(entry.players)) {
      for (const key of STAT_KEYS) {
        if (values[key] !== undefined) inUse[key] = true;
      }
    }
  }
  return inUse;
}

export function isStatTrackingInUse(log: GameStatLog, settings: StatTrackingSettings): boolean {
  return Object.values(getCategoriesInUse(log, settings)).some(Boolean);
}

/** Live quick-log is shown when logging is on and at least one count stat is tracked. */
export function isLiveTrackingOn(settings: StatTrackingSettings): boolean {
  return settings.enabled && COUNT_STAT_KEYS.some(key => settings.categories[key]);
}
