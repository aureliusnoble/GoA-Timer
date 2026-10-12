// src/__tests__/shared/utils/ratingReplay.test.ts
import { describe, it, expect } from 'vitest';
import { rating, rate } from 'openskill';
import {
  replayRatings,
  rankByRating,
  computePlayerRatingTable,
  hasActiveMatchFilters,
  ratingQueryKey,
  toDisplayRating,
  sortMatchesByDate,
  TRUESKILL_BETA,
  TRUESKILL_TAU,
  DEFAULT_DISPLAY_RATING,
  ReplayMatch,
  ReplayMatchPlayer,
  isOutOfOrderMatch,
} from '../../../shared/utils/ratingReplay';
import { GameLength } from '../../../types';

function match(id: string, date: Date, winningTeam: 'titans' | 'atlanteans', gameLength = GameLength.Quick): ReplayMatch {
  return { id, date, winningTeam, gameLength, titanPlayers: 1, atlanteanPlayers: 1 };
}

function duel(matchId: string, titan: string, atlantean: string): ReplayMatchPlayer[] {
  return [
    { matchId, playerId: titan, team: 'titans' },
    { matchId, playerId: atlantean, team: 'atlanteans' },
  ];
}

const players = [
  { id: 'Alice', totalGames: 3 },
  { id: 'Bob', totalGames: 3 },
  { id: 'Cara', totalGames: 0 },
];

// Three duels. Recorded (array) order is NOT date order.
const m1 = match('m1', new Date(2026, 0, 10, 20, 0), 'titans');     // Alice beats Bob
const m2 = match('m2', new Date(2026, 0, 5, 20, 0), 'atlanteans');  // Bob beats Alice (earliest)
const m3 = match('m3', new Date(2026, 1, 1, 20, 0), 'titans', GameLength.Long); // Alice beats Bob
const matches = [m1, m2, m3];
const matchPlayers = [...duel('m1', 'Alice', 'Bob'), ...duel('m2', 'Alice', 'Bob'), ...duel('m3', 'Alice', 'Bob')];

function manualReplay(order: Array<'titans' | 'atlanteans'>) {
  let alice = rating();
  let bob = rating();
  for (const winner of order) {
    const [[a], [b]] = rate([[alice], [bob]], {
      rank: winner === 'titans' ? [1, 2] : [2, 1],
      beta: TRUESKILL_BETA,
      tau: TRUESKILL_TAU,
    });
    alice = a;
    bob = b;
  }
  return { Alice: toDisplayRating(alice), Bob: toDisplayRating(bob) };
}

describe('sortMatchesByDate', () => {
  it('orders oldest first without mutating the input', () => {
    const sorted = sortMatchesByDate(matches);
    expect(sorted.map(m => m.id)).toEqual(['m2', 'm1', 'm3']);
    expect(matches.map(m => m.id)).toEqual(['m1', 'm2', 'm3']);
  });
});

describe('replayRatings', () => {
  it('replays in date order, not array order', () => {
    const { displayRatings } = replayRatings(matches, matchPlayers, players.map(p => p.id));
    const expected = manualReplay(['atlanteans', 'titans', 'titans']);
    expect(displayRatings.Alice).toBe(expected.Alice);
    expect(displayRatings.Bob).toBe(expected.Bob);
    expect(displayRatings.Cara).toBe(DEFAULT_DISPLAY_RATING);
  });

  it('records snapshots with match numbers, participants and match ids', () => {
    const { snapshots } = replayRatings(matches, matchPlayers, ['Alice', 'Bob'], { includeSnapshots: true });
    expect(snapshots.map(s => s.matchNumber)).toEqual([0, 1, 2, 3]);
    expect(snapshots.map(s => s.matchId)).toEqual([undefined, 'm2', 'm1', 'm3']);
    expect(snapshots[0].ratings).toEqual({ Alice: 1200, Bob: 1200 });
    expect(snapshots[1].participants).toEqual(['Alice', 'Bob']);
    expect(snapshots[3].ratings).toEqual(replayRatings(matches, matchPlayers, ['Alice', 'Bob']).displayRatings);
  });

  it('adds players that only appear in match rows and skips matches with an empty team', () => {
    const lonely = match('m4', new Date(2026, 2, 1), 'titans');
    const { displayRatings, snapshots } = replayRatings(
      [m2, lonely],
      [...duel('m2', 'Dan', 'Eve'), { matchId: 'm4', playerId: 'Dan', team: 'titans' }],
      [],
      { includeSnapshots: true }
    );
    expect(Object.keys(displayRatings).sort()).toEqual(['Dan', 'Eve']);
    expect(snapshots.map(s => s.matchId)).toEqual([undefined, 'm2']);
  });
});

describe('rankByRating', () => {
  it('gives equal ratings the same rank and skips the following ranks', () => {
    expect(
      rankByRating([
        { id: 'a', rating: 1300 },
        { id: 'b', rating: 1250 },
        { id: 'c', rating: 1300 },
        { id: 'd', rating: 1100 },
      ])
    ).toEqual({ a: 1, c: 1, b: 3, d: 4 });
  });
});

describe('hasActiveMatchFilters / ratingQueryKey', () => {
  it('detects date, game length and player count filters', () => {
    expect(hasActiveMatchFilters({})).toBe(false);
    expect(hasActiveMatchFilters({ gameLengthFilter: 'all', playerCountFilter: null })).toBe(false);
    expect(hasActiveMatchFilters({ startDate: new Date() })).toBe(true);
    expect(hasActiveMatchFilters({ gameLengthFilter: 'long' })).toBe(true);
    expect(hasActiveMatchFilters({ playerCountFilter: 4 })).toBe(true);
  });

  it('builds equal keys for equal options and different keys otherwise', () => {
    const start = new Date(2026, 0, 1);
    expect(ratingQueryKey({ startDate: start, recalculate: true })).toBe(
      ratingQueryKey({ startDate: new Date(start.getTime()), recalculate: true })
    );
    expect(ratingQueryKey({ startDate: start })).not.toBe(ratingQueryKey({ startDate: start, recalculate: true }));
  });
});

describe('computePlayerRatingTable', () => {
  it('uses the all-time date-ordered replay when not recalculating', () => {
    const table = computePlayerRatingTable(players, matches, matchPlayers, {});
    expect(table.ratings).toEqual(replayRatings(matches, matchPlayers, ['Alice', 'Bob', 'Cara']).displayRatings);
    expect(table.isRecalculated).toBe(false);
    // Cara has no games, so she is not ranked.
    expect(table.ranks).toEqual({ Alice: 1, Bob: 2 });
  });

  it('keeps all-time ratings under a filter without recalculation but ranks only players in the filtered set', () => {
    const table = computePlayerRatingTable(
      [...players, { id: 'Zed', totalGames: 1 }],
      [...matches, match('m9', new Date(2025, 0, 1), 'titans')],
      [...matchPlayers, ...duel('m9', 'Zed', 'Bob')],
      { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31) }
    );
    expect(table.isRecalculated).toBe(false);
    expect(Object.keys(table.ranks).sort()).toEqual(['Alice', 'Bob']);
  });

  it('replays only the filtered matches when recalculating', () => {
    const table = computePlayerRatingTable(players, matches, matchPlayers, {
      gameLengthFilter: 'quick',
      recalculate: true,
    });
    expect(table.isRecalculated).toBe(true);
    expect(table.ratings.Alice).toBe(manualReplay(['atlanteans', 'titans']).Alice);
  });

  it('treats recalculate without any filter as the all-time replay', () => {
    const table = computePlayerRatingTable(players, matches, matchPlayers, { recalculate: true });
    expect(table.isRecalculated).toBe(false);
    expect(table.ratings.Alice).toBe(manualReplay(['atlanteans', 'titans', 'titans']).Alice);
  });

  it('does not let match rows of unknown players shift the ranks', () => {
    const table = computePlayerRatingTable(
      players,
      [...matches, match('m5', new Date(2026, 1, 2), 'titans')],
      [...matchPlayers, ...duel('m5', 'Ghost', 'Bob')],
      { gameLengthFilter: 'quick' }
    );
    expect(table.ranks.Ghost).toBeUndefined();
    expect(Object.values(table.ranks).sort()).toEqual([1, 2]);
  });
});

describe('isOutOfOrderMatch', () => {
  const existing = [{ date: new Date(2026, 0, 5) }, { date: new Date(2026, 0, 10, 20, 0) }];

  it('is false when the new match is later than every existing match', () => {
    expect(isOutOfOrderMatch(new Date(2026, 0, 10, 21, 0), existing)).toBe(false);
    expect(isOutOfOrderMatch(new Date(2026, 0, 1), [])).toBe(false);
  });

  it('is true when the new match is dated before the latest existing match', () => {
    expect(isOutOfOrderMatch(new Date(2026, 0, 7), existing)).toBe(true);
  });

  it('is true for an exact tie, because the replay order of equal dates is not the recording order', () => {
    expect(isOutOfOrderMatch(new Date(2026, 0, 10, 20, 0), existing)).toBe(true);
  });

  it('accepts ISO strings for stored dates', () => {
    expect(isOutOfOrderMatch(new Date(2026, 0, 7), [{ date: new Date(2026, 0, 8).toISOString() }])).toBe(true);
  });
});
