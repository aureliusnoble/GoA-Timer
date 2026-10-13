// src/__tests__/shared/roundStats.test.ts
import { describe, it, expect } from 'vitest';
import { buildRoundLog, sanitizeRoundStats, withSanitizedRoundStats } from '../../shared/utils/roundStats';

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

  it('drops an entry with a valid round but no valid stat', () => {
    expect(sanitizeRoundStats([{ round: 1, kills: -1 }])).toBeUndefined();
    expect(sanitizeRoundStats([{ round: 1 }, { round: 2, deaths: 1 }])).toEqual([{ round: 2, deaths: 1 }]);
  });

  it('does not let an empty duplicate of a round shadow a later valid one', () => {
    expect(sanitizeRoundStats([{ round: 2, kills: 'x' }, { round: 2, kills: 1 }])).toEqual([{ round: 2, kills: 1 }]);
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

describe('buildRoundLog', () => {
  const base = { heroName: 'Hero', roundStats: undefined };

  it('returns null when no player has a round log', () => {
    expect(buildRoundLog([{ ...base, id: 'a', playerName: 'A', team: 'titans' }])).toBeNull();
  });

  it('builds sorted rounds, used columns only, titans first, gaps as undefined', () => {
    const log = buildRoundLog([
      { ...base, id: 'b', playerName: 'B', team: 'atlanteans', roundStats: [{ round: 2, minionKills: 3 }] },
      { ...base, id: 'a', playerName: 'A', team: 'titans', roundStats: [{ round: 1, kills: 1 }, { round: 2, kills: 0 }] },
    ]);
    expect(log?.columns).toEqual(['kills', 'minionKills']);
    expect(log?.rounds.map(r => r.round)).toEqual([1, 2]);
    expect(log?.rounds[0].rows.map(r => r.playerName)).toEqual(['A', 'B']);
    expect(log?.rounds[0].rows[1].entry).toBeUndefined();
    expect(log?.rounds[1].rows[1].entry).toEqual({ round: 2, minionKills: 3 });
  });

  it('orders columns like the rest of Match History (minions before gold)', () => {
    const log = buildRoundLog([
      { ...base, id: 'a', playerName: 'A', team: 'titans', roundStats: [{ round: 1, level: 2, goldEarned: 1, minionKills: 4, deaths: 0 }] },
    ]);
    expect(log?.columns).toEqual(['deaths', 'minionKills', 'goldEarned', 'level']);
  });

  it('never yields an empty round: entries without a stat value are ignored', () => {
    const log = buildRoundLog([
      // Not sanitized (e.g. read straight from IndexedDB): an empty round 2 and an empty duplicate of round 3.
      { ...base, id: 'a', playerName: 'A', team: 'titans', roundStats: [{ round: 1, kills: 1 }, { round: 2 }, { round: 3 }, { round: 3, kills: 2 }] },
      { ...base, id: 'b', playerName: 'B', team: 'atlanteans', roundStats: [{ round: 4, kills: null as unknown as number }] },
    ]);
    expect(log?.rounds.map(r => r.round)).toEqual([1, 3]);
    expect(log?.rounds[1].rows[0].entry).toEqual({ round: 3, kills: 2 });
  });

  it('returns null when no entry holds a stat value', () => {
    expect(buildRoundLog([{ ...base, id: 'a', playerName: 'A', team: 'titans', roundStats: [{ round: 1 }] }])).toBeNull();
  });
});
