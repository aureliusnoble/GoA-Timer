// src/__tests__/hooks/useDataSource.viewMode.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataSource } from '../../hooks/useDataSource';
import dbService, { DBMatch, DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { computePlayerRatingTable } from '../../shared/utils/ratingReplay';
import { Team, GameLength } from '../../types';

// Shared (view-only) data: two duels between Alice and Bob. The stored ordinals are
// deliberately wrong (as after out-of-order recording) so the test can tell them apart
// from the replay.
const mocks = vi.hoisted(() => {
  const cloudPlayer = (name: string, ordinal: number) => ({
    id: `cloud-${name}`, owner_id: 'owner', local_id: name, name,
    total_games: 2, wins: 1, losses: 1, elo: 1200, mu: 25, sigma: 8.333, ordinal,
    last_played: '2026-01-10T20:00:00.000Z', date_created: '2025-01-01T00:00:00.000Z',
    device_id: null, level: null,
  });
  const cloudMatch = (id: string, date: string, winning_team: 'titans' | 'atlanteans', game_length: 'quick' | 'long') => ({
    id, owner_id: 'owner', date, winning_team, game_length, double_lanes: false,
    titan_players: 1, atlantean_players: 1, device_id: null, victory_type: null,
  });
  const cloudMatchPlayer = (match_id: string, player_id: string, team: 'titans' | 'atlanteans') => ({
    id: `${match_id}-${player_id}`, owner_id: 'owner', match_id, player_id, team,
    hero_id: team === 'titans' ? 0 : 1, hero_name: team === 'titans' ? 'Arien' : 'Brogan', hero_roles: [],
    kills: null, deaths: null, assists: null, gold_earned: null, minion_kills: null, level: null, device_id: null,
  });
  return {
    viewMode: {
      isViewMode: true,
      isLoading: false,
      sharedData: {
        ownerId: 'owner',
        displayName: 'Friend',
        isAnonymized: false,
        expiresAt: null,
        players: [cloudPlayer('Alice', 50), cloudPlayer('Bob', -50)],
        matches: [
          cloudMatch('m1', '2026-01-10T20:00:00.000Z', 'titans', 'long'),
          cloudMatch('m2', '2026-01-05T20:00:00.000Z', 'atlanteans', 'quick'),
        ],
        matchPlayers: [
          cloudMatchPlayer('m1', 'Alice', 'titans'), cloudMatchPlayer('m1', 'Bob', 'atlanteans'),
          cloudMatchPlayer('m2', 'Alice', 'titans'), cloudMatchPlayer('m2', 'Bob', 'atlanteans'),
        ],
      },
    },
  };
});

vi.mock('../../context/ViewModeContext', () => ({ useViewMode: () => mocks.viewMode }));
vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

const localPlayers = [{ id: 'Alice', totalGames: 2 }, { id: 'Bob', totalGames: 2 }];
const localMatches = [
  { id: 'm1', date: new Date('2026-01-10T20:00:00.000Z'), winningTeam: Team.Titans, gameLength: GameLength.Long, titanPlayers: 1, atlanteanPlayers: 1 },
  { id: 'm2', date: new Date('2026-01-05T20:00:00.000Z'), winningTeam: Team.Atlanteans, gameLength: GameLength.Quick, titanPlayers: 1, atlanteanPlayers: 1 },
];
const localMatchPlayers = ['m1', 'm2'].flatMap(matchId => [
  { matchId, playerId: 'Alice', team: 'titans' },
  { matchId, playerId: 'Bob', team: 'atlanteans' },
]);

describe('useDataSource in view-only mode', () => {
  it('replays the shared matches for current ratings instead of using the stored ordinal', async () => {
    const { result } = renderHook(() => useDataSource());
    const ratings = await result.current.getCurrentTrueSkillRatings();

    const expected = computePlayerRatingTable(localPlayers, localMatches, localMatchPlayers).ratings;
    expect(ratings).toEqual(expected);
    expect(ratings.Alice).not.toBe(Math.round((50 + 25) * 40 + 200)); // stored value
  });

  it('returns ranks and honours "recalculate for period" with filters', async () => {
    const { result } = renderHook(() => useDataSource());
    const allTime = await result.current.getPlayerRatingTable();
    expect(Object.keys(allTime.ranks).sort()).toEqual(['Alice', 'Bob']);

    const quickOnly = await result.current.getPlayerRatingTable({ gameLengthFilter: 'quick', recalculate: true });
    expect(quickOnly.isRecalculated).toBe(true);
    expect(quickOnly).toEqual(
      computePlayerRatingTable(localPlayers, localMatches, localMatchPlayers, { gameLengthFilter: 'quick', recalculate: true })
    );
  });

  it('uses the same ratings and ranks in getFilteredPlayerStats', async () => {
    const { result } = renderHook(() => useDataSource());
    const { players } = await result.current.getFilteredPlayerStats(undefined, undefined, false, 'quick', null);
    const table = await result.current.getPlayerRatingTable({ gameLengthFilter: 'quick' });
    for (const p of players) {
      expect(p.displayRating).toBe(table.ratings[p.id]);
      expect(p.rank).toBe(table.ranks[p.id]);
    }
  });
});

describe('rating replay on local (IndexedDB) data', () => {
  afterEach(() => {
    mocks.viewMode.isViewMode = true;
    vi.restoreAllMocks();
  });

  function dbPlayer(id: string): DBPlayer {
    return { id, name: id, totalGames: 2, wins: 1, losses: 1, elo: 1200, lastPlayed: new Date(), dateCreated: new Date() };
  }

  /** Serves the given rows from the database service; returns the mutable lists. */
  function stubDatabase() {
    const db = {
      players: localPlayers.map(p => dbPlayer(p.id)),
      matches: localMatches.map((m): DBMatch => ({ ...m, doubleLanes: false })),
      matchPlayers: localMatchPlayers.map((mp): DBMatchPlayer => ({
        ...mp, id: `${mp.matchId}-${mp.playerId}`, team: mp.team as Team, heroId: 1, heroName: 'Brogan', heroRoles: [],
      })),
    };
    vi.spyOn(dbService, 'getAllPlayers').mockImplementation(async () => db.players);
    vi.spyOn(dbService, 'getAllMatches').mockImplementation(async () => db.matches);
    vi.spyOn(dbService, 'getAllMatchPlayers').mockImplementation(async () => db.matchPlayers);
    return db;
  }

  it('replays the local database on every call, so newly recorded matches count', async () => {
    mocks.viewMode.isViewMode = false;
    const db = stubDatabase();
    const { result } = renderHook(() => useDataSource());

    const first = await result.current.getPlayerRatingTable();
    expect(first).toEqual(computePlayerRatingTable(db.players, db.matches, db.matchPlayers));

    db.matches.push({ ...db.matches[0], id: 'm3', date: new Date('2026-01-20T20:00:00.000Z') });
    db.matchPlayers.push(
      { ...db.matchPlayers[0], id: 'm3-Alice', matchId: 'm3' },
      { ...db.matchPlayers[1], id: 'm3-Bob', matchId: 'm3' }
    );
    const second = await result.current.getPlayerRatingTable();
    expect(second).toEqual(computePlayerRatingTable(db.players, db.matches, db.matchPlayers));
    expect(second.ratings.Alice).toBeGreaterThan(first.ratings.Alice);
  });

  it('dbService.getCurrentTrueSkillRatings returns the same date-ordered replay, including players only seen in match rows', async () => {
    const db = stubDatabase();
    db.matches.push({ ...db.matches[0], id: 'm3', date: new Date('2026-01-01T20:00:00.000Z') });
    db.matchPlayers.push(
      { ...db.matchPlayers[0], id: 'm3-Ghost', matchId: 'm3', playerId: 'Ghost' },
      { ...db.matchPlayers[1], id: 'm3-Bob', matchId: 'm3' }
    );

    const ratings = await dbService.getCurrentTrueSkillRatings();
    expect(ratings).toEqual(computePlayerRatingTable(db.players, db.matches, db.matchPlayers).ratings);
    expect(Object.keys(ratings).sort()).toEqual(['Alice', 'Bob', 'Ghost']);
  });
});

describe('getPlayerRatingJourney in view-only mode', () => {
  it('builds the journey from the shared data with the given filters', async () => {
    const { result } = renderHook(() => useDataSource());
    const journey = await result.current.getPlayerRatingJourney({ startDate: new Date('2026-01-08T00:00:00.000Z') });
    // m2 (5 Jan) is before the start date, so the baseline is the state after m2.
    expect(journey.baseline.matchNumber).toBe(1);
    expect(journey.snapshots.map(s => s.matchId)).toEqual(['m1']);
    const table = await result.current.getPlayerRatingTable({ startDate: new Date('2026-01-08T00:00:00.000Z') });
    expect(journey.finalRatings).toEqual(table.ratings);
  });
});
