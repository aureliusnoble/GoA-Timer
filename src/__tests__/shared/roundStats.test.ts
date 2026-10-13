// src/__tests__/shared/roundStats.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeRoundStats, withSanitizedRoundStats } from '../../shared/utils/roundStats';

describe('sanitizeRoundStats', () => {
  it('passes a valid log through unchanged', () => {
    const log = [{ round: 1, kills: 0, minionKills: 2 }, { round: 2, level: 3 }];
    expect(sanitizeRoundStats(log)).toEqual(log);
  });

  it('treats null / undefined / non-arrays as no log (Supabase NULL)', () => {
    expect(sanitizeRoundStats(null)).toBeUndefined();
    expect(sanitizeRoundStats(undefined)).toBeUndefined();
    expect(sanitizeRoundStats({ round: 1 })).toBeUndefined();
    expect(sanitizeRoundStats([])).toBeUndefined();
  });

  it('parses a JSON string', () => {
    expect(sanitizeRoundStats('[{"round":1,"kills":2}]')).toEqual([{ round: 1, kills: 2 }]);
    expect(sanitizeRoundStats('nope')).toBeUndefined();
  });

  it('drops invalid entries and fields, de-duplicates and sorts rounds', () => {
    expect(sanitizeRoundStats([
      { round: 3, kills: 1 },
      { round: 0, kills: 1 },
      { round: 'two' },
      null,
      { round: 1, kills: -1, deaths: 'x', assists: 2, extra: 5 },
      { round: 3, kills: 9 },
    ])).toEqual([{ round: 1, assists: 2 }, { round: 3, kills: 1 }]);
  });
});

describe('withSanitizedRoundStats', () => {
  it('keeps valid logs and removes the key when nothing is valid', () => {
    expect(withSanitizedRoundStats({ id: 'a', roundStats: [{ round: 1, kills: 1 }] }))
      .toEqual({ id: 'a', roundStats: [{ round: 1, kills: 1 }] });
    const cleaned = withSanitizedRoundStats({ id: 'b', roundStats: 'garbage' });
    expect(cleaned).toEqual({ id: 'b' });
    expect('roundStats' in cleaned).toBe(false);
  });

  it('leaves match players without a log untouched', () => {
    expect(withSanitizedRoundStats({ id: 'c', kills: 2 })).toEqual({ id: 'c', kills: 2 });
  });
});
