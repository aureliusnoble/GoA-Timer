// src/__tests__/shared/gameStatLog.test.ts
import { describe, it, expect } from 'vitest';
import {
  createEmptyStatLog,
  commitRound,
  deriveTotals,
  applyTotalsToPlayers,
  buildReviewValues,
  filterValuesToCategories,
  createLegacyStatLog,
  restoreStatLog,
  getRoundEntry,
  isRoundReviewed,
  StatCategories,
} from '../../shared/utils/gameStatLog';
import { Player, Team } from '../../types';

const NO_CATEGORIES: StatCategories = {
  kills: false, deaths: false, assists: false, goldEarned: false, minionKills: false, level: false,
};

function makePlayer(id: number, team: Team, stats?: Player['stats']): Player {
  return { id, team, hero: null, name: `P${id}`, stats };
}

describe('commitRound / deriveTotals', () => {
  it('keeps tracked zeros as 0 (not undefined)', () => {
    const log = commitRound(createEmptyStatLog(), 1, { 1: { kills: 0, deaths: 0 } });
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 0, totalDeaths: 0 });
  });

  it('returns undefined for a player with nothing tracked', () => {
    const log = commitRound(createEmptyStatLog(), 1, { 1: { kills: 2 } });
    expect(deriveTotals(log, 2)).toBeUndefined();
  });

  it('sums counts across rounds and keeps the latest level', () => {
    let log = commitRound(createEmptyStatLog(), 1, { 1: { kills: 1, goldEarned: 3, level: 2 } });
    log = commitRound(log, 2, { 1: { kills: 2, goldEarned: 4, level: 3 } });
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 3, totalGoldEarned: 7, level: 3 });
  });

  it('replaces (not adds to) a round that is committed again', () => {
    let log = commitRound(createEmptyStatLog(), 1, { 1: { kills: 2 } });
    log = commitRound(log, 1, { 1: { kills: 1 } });
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 1 });
    expect(log.rounds).toHaveLength(1);
    expect(isRoundReviewed(log, 1)).toBe(true);
  });

  it('keeps rounds sorted whatever order they are committed in', () => {
    let log = commitRound(createEmptyStatLog(), 2, { 1: { level: 4 } });
    log = commitRound(log, 1, { 1: { level: 2 } });
    expect(log.rounds.map(r => r.round)).toEqual([1, 2]);
    expect(deriveTotals(log, 1)?.level).toBe(4);
  });

  it('drops non-numeric and negative junk', () => {
    const log = commitRound(createEmptyStatLog(), 1, {
      1: { kills: Number.NaN, deaths: -2, assists: 1 },
    });
    expect(getRoundEntry(log, 1)?.players[1]).toEqual({ deaths: 0, assists: 1 });
  });
});

describe('applyTotalsToPlayers', () => {
  it('overwrites stale stats with derived totals', () => {
    const players = [makePlayer(1, Team.Titans, { level: 5 }), makePlayer(2, Team.Atlanteans)];
    const log = commitRound(createEmptyStatLog(), 1, { 2: { minionKills: 0 } });
    const result = applyTotalsToPlayers(players, log);
    expect(result[0].stats).toBeUndefined();
    expect(result[1].stats).toEqual({ totalMinionKills: 0 });
  });
});

describe('buildReviewValues', () => {
  it('pre-fills from the round entry, zero elsewhere, level from the previous round', () => {
    let log = commitRound(createEmptyStatLog(), 1, { 1: { level: 3 } });
    log = commitRound(log, 2, { 1: { kills: 2 } });
    const values = buildReviewValues(log, 2, [{ id: 1 }, { id: 2 }]);
    expect(values[1]).toEqual({ kills: 2, deaths: 0, assists: 0, goldEarned: 0, minionKills: 0, level: 3 });
    expect(values[2]).toEqual({ kills: 0, deaths: 0, assists: 0, goldEarned: 0, minionKills: 0, level: 1 });
  });
});

describe('filterValuesToCategories', () => {
  it('keeps only enabled categories and fills them with numbers', () => {
    const categories = { ...NO_CATEGORIES, kills: true, level: true };
    const result = filterValuesToCategories({ 1: { kills: 2, deaths: 1 }, 2: {} }, categories);
    expect(result).toEqual({ 1: { kills: 2, level: 1 }, 2: { kills: 0, level: 1 } });
  });
});

describe('legacy saves', () => {
  it('turns pre-round-log totals into a baseline that totals build on', () => {
    const players = [makePlayer(1, Team.Titans, { totalKills: 2, level: 3 }), makePlayer(2, Team.Atlanteans)];
    let log = createLegacyStatLog(players);
    expect(log.baseline).toEqual({ 1: { totalKills: 2, level: 3 } });
    log = commitRound(log, 4, { 1: { kills: 1 }, 2: { kills: 0 } });
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 3, level: 3 });
    expect(deriveTotals(log, 2)).toEqual({ totalKills: 0 });
  });

  it('restoreStatLog falls back to the legacy baseline when the save has no log', () => {
    const players = [makePlayer(1, Team.Titans, { totalDeaths: 1 })];
    expect(restoreStatLog(undefined, players)).toEqual({ rounds: [], baseline: { 1: { totalDeaths: 1 } } });
    expect(restoreStatLog(null, [makePlayer(1, Team.Titans)])).toEqual({ rounds: [] });
  });

  it('restoreStatLog keeps a saved log and cleans it', () => {
    const raw = { rounds: [{ round: 2, reviewed: true, players: { 1: { kills: 1 } } }, { round: 'x' }, { round: 1, players: {} }] };
    const log = restoreStatLog(raw, []);
    expect(log.rounds.map(r => r.round)).toEqual([1, 2]);
    expect(log.rounds[0].reviewed).toBe(false);
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 1 });
  });
});
