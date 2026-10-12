import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_TIMER_DURATIONS,
  TIMER_DURATIONS_STORAGE_KEY,
  sanitizeTimerDuration,
  resolveTimerDurations,
  parseStoredTimerDurations,
  loadTimerDurations,
  saveTimerDurations,
} from '../../../shared/utils/timerDurations';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const throwingStorage = {
  getItem: (): string | null => {
    throw new Error('storage blocked');
  },
  setItem: (): void => {
    throw new Error('quota exceeded');
  },
};

describe('sanitizeTimerDuration', () => {
  it('keeps whole-second values inside 10-600', () => {
    expect(sanitizeTimerDuration(10, 90)).toBe(10);
    expect(sanitizeTimerDuration(120, 90)).toBe(120);
    expect(sanitizeTimerDuration(600, 90)).toBe(600);
  });

  it('clamps out-of-range values to 10-600', () => {
    expect(sanitizeTimerDuration(5, 90)).toBe(10);
    expect(sanitizeTimerDuration(0, 90)).toBe(10);
    expect(sanitizeTimerDuration(-30, 90)).toBe(10);
    expect(sanitizeTimerDuration(601, 90)).toBe(600);
    expect(sanitizeTimerDuration(1e9, 90)).toBe(600);
  });

  it('rounds to whole seconds so the countdown reaches exactly 0', () => {
    expect(sanitizeTimerDuration(90.4, 30)).toBe(90);
    expect(sanitizeTimerDuration(90.6, 30)).toBe(91);
  });

  it('uses the fallback for anything that is not a finite number', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, '120', '', {}, [], true]) {
      expect(sanitizeTimerDuration(bad, 77)).toBe(77);
    }
  });
});

describe('resolveTimerDurations', () => {
  const current = { strategyTime: 150, moveTime: 45 };

  it('uses durations stored in a saved game', () => {
    expect(resolveTimerDurations({ strategyTime: 200, moveTime: 60 }, current)).toEqual({ strategyTime: 200, moveTime: 60 });
  });

  it('keeps the current durations for saves made before durations were stored', () => {
    const legacySave = { strategyTimeRemaining: 12, moveTimeRemaining: 5, strategyTimerActive: true };
    expect(resolveTimerDurations(legacySave, current)).toEqual(current);
  });

  it('keeps the current durations when there is no saved data at all', () => {
    expect(resolveTimerDurations(null, current)).toEqual(current);
    expect(resolveTimerDurations(undefined, current)).toEqual(current);
    expect(resolveTimerDurations(42, current)).toEqual(current);
  });

  it('validates each field independently', () => {
    expect(resolveTimerDurations({ strategyTime: 'x', moveTime: 1000 }, current)).toEqual({ strategyTime: 150, moveTime: 600 });
    expect(resolveTimerDurations({ strategyTime: NaN, moveTime: undefined }, current)).toEqual(current);
  });
});

describe('parseStoredTimerDurations', () => {
  it('returns the 90s / 30s defaults when nothing is stored', () => {
    expect(parseStoredTimerDurations(null)).toEqual({ strategyTime: 90, moveTime: 30 });
    expect(parseStoredTimerDurations('')).toEqual({ strategyTime: 90, moveTime: 30 });
  });

  it('returns the defaults for corrupt values', () => {
    for (const raw of ['not json', '{', 'null', '42', '"text"', '[]', '{"strategyTime":"fast"}']) {
      expect(parseStoredTimerDurations(raw)).toEqual({ strategyTime: 90, moveTime: 30 });
    }
  });

  it('parses and sanitizes a stored pair', () => {
    expect(parseStoredTimerDurations('{"strategyTime":120,"moveTime":40}')).toEqual({ strategyTime: 120, moveTime: 40 });
    expect(parseStoredTimerDurations('{"strategyTime":3,"moveTime":9999}')).toEqual({ strategyTime: 10, moveTime: 600 });
  });
});

describe('loadTimerDurations / saveTimerDurations', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('round-trips through a storage object', () => {
    const storage = memoryStorage();
    saveTimerDurations({ strategyTime: 120, moveTime: 40 }, storage);
    expect(storage.store.get(TIMER_DURATIONS_STORAGE_KEY)).toBe('{"strategyTime":120,"moveTime":40}');
    expect(loadTimerDurations(storage)).toEqual({ strategyTime: 120, moveTime: 40 });
  });

  it('uses window.localStorage by default', () => {
    saveTimerDurations({ strategyTime: 150, moveTime: 20 });
    expect(window.localStorage.getItem(TIMER_DURATIONS_STORAGE_KEY)).toBe('{"strategyTime":150,"moveTime":20}');
    expect(loadTimerDurations()).toEqual({ strategyTime: 150, moveTime: 20 });
  });

  it('falls back to the defaults and never throws when storage is unavailable', () => {
    expect(loadTimerDurations(throwingStorage)).toEqual({ ...DEFAULT_TIMER_DURATIONS });
    expect(() => saveTimerDurations({ strategyTime: 120, moveTime: 40 }, throwingStorage)).not.toThrow();
  });

  it('never hands out the shared defaults object', () => {
    const loaded = loadTimerDurations(memoryStorage());
    loaded.strategyTime = 300;
    expect(DEFAULT_TIMER_DURATIONS.strategyTime).toBe(90);
  });
});
