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
  saveRoundDraft,
  getFinalRoundStatus,
  toMatchRoundStats,
  applyStatChanges,
  invertStatChanges,
  buildKillChanges,
  STAT_KEYS,
  GameStatLog,
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

describe('saveRoundDraft / getFinalRoundStatus', () => {
  it('a draft is not a review, and keeps an existing review flag', () => {
    let log = saveRoundDraft(createEmptyStatLog(), 3, { 1: { kills: 1 } });
    expect(isRoundReviewed(log, 3)).toBe(false);
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 1 });
    log = commitRound(log, 3, { 1: { kills: 2 } });
    log = saveRoundDraft(log, 3, { 1: { kills: 4 } });
    expect(isRoundReviewed(log, 3)).toBe(true);
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 4 });
  });

  it('a draft that leaves out a category keeps that category\'s value', () => {
    let log = saveRoundDraft(createEmptyStatLog(), 3, { 1: { kills: 2, deaths: 1 } });
    log = saveRoundDraft(log, 3, { 1: { deaths: 0 } }); // kills unticked
    expect(getRoundEntry(log, 3)?.players[1]).toEqual({ kills: 2, deaths: 0 });
  });

  it('a draft for one player keeps the other players\' values', () => {
    let log = commitRound(createEmptyStatLog(), 3, { 1: { kills: 1 }, 2: { assists: 2 } });
    log = saveRoundDraft(log, 3, { 1: { kills: 3 } });
    expect(getRoundEntry(log, 3)?.players).toEqual({ 1: { kills: 3 }, 2: { assists: 2 } });
    expect(isRoundReviewed(log, 3)).toBe(true);
  });

  it('final round is the current round when play happened in it', () => {
    const log = commitRound(createEmptyStatLog(), 2, { 1: { kills: 1 } });
    expect(getFinalRoundStatus(log, { round: 3, turn: 2, currentPhase: 'move' })).toEqual({ round: 3, reviewed: false });
  });

  it('final round is the previous, reviewed round when victory comes before round N+1 starts', () => {
    const log = commitRound(createEmptyStatLog(), 2, { 1: { kills: 1 } });
    expect(getFinalRoundStatus(log, { round: 3, turn: 1, currentPhase: 'strategy' })).toEqual({ round: 2, reviewed: true });
  });

  it('does not step back when the previous round was not reviewed', () => {
    expect(getFinalRoundStatus(createEmptyStatLog(), { round: 3, turn: 1, currentPhase: 'strategy' })).toEqual({ round: 3, reviewed: false });
  });
});

describe('toMatchRoundStats', () => {
  it('lists each round the player has values for, in order', () => {
    let log = commitRound(createEmptyStatLog(), 2, { 1: { kills: 0, level: 2 } });
    log = commitRound(log, 1, { 1: { kills: 1 }, 2: { kills: 0 } });
    log = commitRound(log, 3, { 2: { kills: 1 } });
    expect(toMatchRoundStats(log, 1)).toEqual([
      { round: 1, kills: 1 },
      { round: 2, kills: 0, level: 2 },
    ]);
  });

  it('is undefined when nothing was logged or the log is incomplete', () => {
    expect(toMatchRoundStats(createEmptyStatLog(), 1)).toBeUndefined();
    const legacy = commitRound(createLegacyStatLog([makePlayer(1, Team.Titans, { totalKills: 1 })]), 3, { 1: { kills: 1 } });
    expect(toMatchRoundStats(legacy, 1)).toBeUndefined();
  });

  it('skips rounds where the player has no values', () => {
    let log = commitRound(createEmptyStatLog(), 1, { 1: { kills: 1 }, 2: {} });
    log = commitRound(log, 2, { 1: {}, 2: {} });
    expect(toMatchRoundStats(log, 1)).toEqual([{ round: 1, kills: 1 }]);
  });

  it('is undefined for an untracked game whose rounds hold only empty values', () => {
    let log = commitRound(createEmptyStatLog(), 1, { 1: {}, 2: {} });
    log = saveRoundDraft(log, 2, { 1: {}, 2: {} });
    expect(toMatchRoundStats(log, 1)).toBeUndefined();
    expect(toMatchRoundStats(log, 2)).toBeUndefined();
  });

  it('stores counts only: no player names or ids in the persisted entries', () => {
    // A log carrying foreign keys (e.g. from a corrupted autosave) must not leak them.
    const log = {
      rounds: [{ round: 1, reviewed: true, players: { 1: { kills: 2, name: 'Ann', playerId: 1, id: 1 } } }],
    } as unknown as GameStatLog;
    const entries = toMatchRoundStats(log, 1) ?? [];
    expect(entries).toEqual([{ round: 1, kills: 2 }]);
    const allowedKeys: string[] = ['round', ...STAT_KEYS];
    for (const entry of entries) {
      expect(Object.keys(entry).filter(key => !allowedKeys.includes(key))).toEqual([]);
    }
  });
});

describe('live changes', () => {
  it('live tallies then a review of the same round are not double counted', () => {
    let log = applyStatChanges(createEmptyStatLog(), 1, [{ playerId: 1, stat: 'kills', delta: 1 }]);
    log = applyStatChanges(log, 1, [{ playerId: 1, stat: 'kills', delta: 1 }]);
    const review = buildReviewValues(log, 1, [{ id: 1 }]);
    expect(review[1].kills).toBe(2);
    log = commitRound(log, 1, filterValuesToCategories(review, { ...NO_CATEGORIES, kills: true }));
    expect(deriveTotals(log, 1)).toEqual({ totalKills: 2 });
  });

  it('undo with inverted changes restores the previous values, never below 0', () => {
    const changes = [{ playerId: 1, stat: 'deaths' as const, delta: 1 }];
    let log = applyStatChanges(createEmptyStatLog(), 1, changes);
    log = applyStatChanges(log, 1, invertStatChanges(changes));
    expect(getRoundEntry(log, 1)?.players[1]).toEqual({ deaths: 0 });
    log = applyStatChanges(log, 1, invertStatChanges(changes));
    expect(getRoundEntry(log, 1)?.players[1]).toEqual({ deaths: 0 });
  });

  it('live changes keep the round unreviewed', () => {
    const log = applyStatChanges(createEmptyStatLog(), 1, [{ playerId: 1, stat: 'goldEarned', delta: 1 }]);
    expect(isRoundReviewed(log, 1)).toBe(false);
  });

  it('buildKillChanges gives teammates assists only when assists are tracked', () => {
    const players = [
      makePlayer(1, Team.Titans), makePlayer(2, Team.Titans), makePlayer(3, Team.Atlanteans),
    ];
    expect(buildKillChanges(players, 1, { ...NO_CATEGORIES, kills: true })).toEqual([
      { playerId: 1, stat: 'kills', delta: 1 },
    ]);
    expect(buildKillChanges(players, 1, { ...NO_CATEGORIES, kills: true, assists: true })).toEqual([
      { playerId: 1, stat: 'kills', delta: 1 },
      { playerId: 2, stat: 'assists', delta: 1 },
    ]);
    expect(buildKillChanges(players, 99, { ...NO_CATEGORIES, kills: true })).toEqual([]);
  });
});
