// src/shared/utils/timerDurations.ts
//
// Strategy/action timer durations (whole seconds): validation for values coming back from a
// saved game or localStorage, and remembering the last-used durations between games.

export interface TimerDurations {
  strategyTime: number;
  moveTime: number;
}

export const TIMER_DURATION_MIN_SECONDS = 10;
export const TIMER_DURATION_MAX_SECONDS = 600;
export const DEFAULT_TIMER_DURATIONS: Readonly<TimerDurations> = Object.freeze({
  strategyTime: 90,
  moveTime: 30,
});
export const TIMER_DURATIONS_STORAGE_KEY = 'goa-timer-durations';

/**
 * A usable duration: a finite number rounded to whole seconds (the countdown ticks by 1 and stops at
 * exactly 0) and clamped to 10-600. Anything else (undefined, null, NaN, strings, ...) gives `fallback`.
 */
export function sanitizeTimerDuration(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(TIMER_DURATION_MAX_SECONDS, Math.max(TIMER_DURATION_MIN_SECONDS, Math.round(value)));
}

/**
 * Durations to use from saved data (a resumed game or the remembered pair). Each field that is
 * missing or invalid - e.g. saves made before durations were stored - keeps the `current` value.
 */
export function resolveTimerDurations(saved: unknown, current: TimerDurations): TimerDurations {
  const source = (typeof saved === 'object' && saved !== null ? saved : {}) as Partial<Record<keyof TimerDurations, unknown>>;
  return {
    strategyTime: sanitizeTimerDuration(source.strategyTime, current.strategyTime),
    moveTime: sanitizeTimerDuration(source.moveTime, current.moveTime),
  };
}

/** Parse the raw localStorage value; defaults (90s / 30s) when absent or corrupt. */
export function parseStoredTimerDurations(raw: string | null): TimerDurations {
  if (!raw) return { ...DEFAULT_TIMER_DURATIONS };
  try {
    return resolveTimerDurations(JSON.parse(raw), DEFAULT_TIMER_DURATIONS);
  } catch {
    return { ...DEFAULT_TIMER_DURATIONS };
  }
}

/** Last-used durations from storage (default: window.localStorage). Never throws. */
export function loadTimerDurations(storage?: Pick<Storage, 'getItem'>): TimerDurations {
  try {
    const target = storage ?? window.localStorage;
    return parseStoredTimerDurations(target.getItem(TIMER_DURATIONS_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_TIMER_DURATIONS };
  }
}

/** Remember durations in storage (default: window.localStorage). Never throws (private mode, quota). */
export function saveTimerDurations(durations: TimerDurations, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(
      TIMER_DURATIONS_STORAGE_KEY,
      JSON.stringify({ strategyTime: durations.strategyTime, moveTime: durations.moveTime })
    );
  } catch {
    // Storage unavailable: durations simply aren't remembered.
  }
}
