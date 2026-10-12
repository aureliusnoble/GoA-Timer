// src/shared/utils/statValues.ts
import { HERO_LEVEL_MAX, HERO_LEVEL_MIN } from '../constants/game';

/**
 * A stat is "tracked" only when it holds a finite number. `undefined` and
 * `null` mean "not tracked"; 0 is a tracked value.
 */
export function isTrackedStat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True for whole numbers from HERO_LEVEL_MIN to HERO_LEVEL_MAX. */
export function isValidHeroLevel(level: unknown): level is number {
  return isTrackedStat(level)
    && Number.isInteger(level)
    && level >= HERO_LEVEL_MIN
    && level <= HERO_LEVEL_MAX;
}

/** Clamp a level into the hero level range. */
export function clampHeroLevel(level: number): number {
  return Math.max(HERO_LEVEL_MIN, Math.min(HERO_LEVEL_MAX, level));
}
