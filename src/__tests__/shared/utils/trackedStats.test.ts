// src/__tests__/shared/utils/trackedStats.test.ts
import { describe, it, expect } from 'vitest';
import {
  isTrackedStat,
  summarizeStat,
  summarizePlayerStats,
  formatTrackedGames,
} from '../../../shared/utils/trackedStats';

describe('isTrackedStat', () => {
  it('treats 0 and other finite numbers as tracked', () => {
    expect(isTrackedStat(0)).toBe(true);
    expect(isTrackedStat(7)).toBe(true);
  });

  it('treats undefined, null and NaN as not tracked', () => {
    expect(isTrackedStat(undefined)).toBe(false);
    expect(isTrackedStat(null)).toBe(false);
    expect(isTrackedStat(Number.NaN)).toBe(false);
  });
});

describe('summarizeStat', () => {
  it('uses only tracked games as the denominator and counts zeros as tracked', () => {
    const summary = summarizeStat(
      [{ goldEarned: 10 }, { goldEarned: 0 }, { goldEarned: undefined }, { goldEarned: null }, {}],
      'goldEarned'
    );
    expect(summary).toEqual({ total: 10, games: 2, average: 5 });
  });

  it('returns zeros when the stat was never tracked', () => {
    expect(summarizeStat([{}, { kills: null }], 'kills')).toEqual({ total: 0, games: 0, average: 0 });
  });
});

describe('summarizePlayerStats', () => {
  it('gives kills, deaths and assists their own denominators', () => {
    const summary = summarizePlayerStats([
      { kills: 4, deaths: 2, assists: undefined },
      { kills: 2, deaths: null, assists: 3 },
      { kills: undefined, deaths: 1, assists: 1 },
    ]);
    expect(summary.kills).toEqual({ total: 6, games: 2, average: 3 });
    expect(summary.deaths).toEqual({ total: 3, games: 2, average: 1.5 });
    expect(summary.assists).toEqual({ total: 4, games: 2, average: 2 });
    expect(summary.kdRatio).toBe(2);
    expect(summary.hasCombatStats).toBe(true);
    expect(summary.hasAnyTrackedStats).toBe(true);
  });

  it('averages minions, gold and level over their own tracked games', () => {
    const summary = summarizePlayerStats([
      { minionKills: 6, goldEarned: 12, level: 5 },
      { minionKills: 0, goldEarned: undefined, level: 7 },
      { minionKills: undefined, goldEarned: 8, level: null },
    ]);
    expect(summary.minionKills).toEqual({ total: 6, games: 2, average: 3 });
    expect(summary.goldEarned).toEqual({ total: 20, games: 2, average: 10 });
    expect(summary.level).toEqual({ total: 12, games: 2, average: 6 });
  });

  it('uses total kills as the K/D ratio when there are no deaths and rounds to 2 decimals', () => {
    expect(summarizePlayerStats([{ kills: 3, deaths: 0 }]).kdRatio).toBe(3);
    expect(summarizePlayerStats([{ kills: 1, deaths: 3 }]).kdRatio).toBe(0.33);
  });

  it('reports tracked all-zero stats as tracked combat data', () => {
    const summary = summarizePlayerStats([{ kills: 0, deaths: 0, assists: 0 }]);
    expect(summary.kills.games).toBe(1);
    expect(summary.hasCombatStats).toBe(true);
    expect(summary.hasAnyTrackedStats).toBe(true);
  });

  it('reports no tracked data when every stat is undefined or null', () => {
    const summary = summarizePlayerStats([{}, { kills: null, goldEarned: null }]);
    expect(summary.hasCombatStats).toBe(false);
    expect(summary.hasAnyTrackedStats).toBe(false);
    expect(summary.kdRatio).toBe(0);
  });

  it('counts level-only or minion-only data as tracked but not as combat data', () => {
    const summary = summarizePlayerStats([{ level: 4 }, { minionKills: 2 }]);
    expect(summary.hasCombatStats).toBe(false);
    expect(summary.hasAnyTrackedStats).toBe(true);
  });
});

describe('formatTrackedGames', () => {
  it('formats the tracked-game count against the total', () => {
    expect(formatTrackedGames(3, 5)).toBe('3 of 5 games');
    expect(formatTrackedGames(0, 1)).toBe('0 of 1 game');
  });
});
