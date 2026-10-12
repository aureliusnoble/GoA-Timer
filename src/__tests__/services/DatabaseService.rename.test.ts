// src/__tests__/services/DatabaseService.rename.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { Team } from '../../types';
import { createFakeRenameDb } from '../helpers/fakeRenameDb';

const cloud = vi.hoisted(() => ({
  triggerAutoUpload: vi.fn(),
  deleteMatchFromCloud: vi.fn(async () => ({ success: true })),
  queuePlayerRename: vi.fn(async () => true),
}));
vi.mock('../../services/supabase/CloudSyncService', () => ({ CloudSyncService: cloud }));

import dbService from '../../services/DatabaseService';

function player(id: string, overrides: Partial<DBPlayer> = {}): DBPlayer {
  return {
    id, name: id, totalGames: 1, wins: 1, losses: 0, elo: 1200,
    lastPlayed: new Date('2026-09-01T00:00:00Z'), dateCreated: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

function row(id: string, playerId: string, matchId: string, team: Team = Team.Titans): DBMatchPlayer {
  return { id, matchId, playerId, team, heroId: 1, heroName: 'Brogan', heroRoles: [], kills: 2, deaths: 1 };
}

const seed = {
  players: [player('Jhon'), player('John'), player('Alice')],
  matchPlayers: [
    row('mp-1', 'Jhon', 'm-1'),
    row('mp-2', 'Alice', 'm-1', Team.Atlanteans),
    row('mp-3', 'Jhon', 'm-2'),
    row('mp-4', 'John', 'm-3'),
  ],
};

function useFakeDb(options: { failPutOf?: string } = {}) {
  const fake = createFakeRenameDb(seed, options);
  (dbService as unknown as { db: unknown }).db = fake.db;
  const recalc = vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
  return { fake, recalc };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  (dbService as unknown as { db: unknown }).db = null;
});

describe('DatabaseService.renamePlayer', () => {
  it('renames the player and all their match rows in one go', async () => {
    const { fake, recalc } = useFakeDb();

    const result = await dbService.renamePlayer('Alice', ' Alicia ', 'rename');

    expect(result.ok).toBe(true);
    const after = fake.snapshot();
    expect(after.players.map(p => p.id).sort()).toEqual(['Alicia', 'Jhon', 'John']);
    expect(after.players.find(p => p.id === 'Alicia')?.name).toBe('Alicia');
    expect(after.matchPlayers.find(mp => mp.id === 'mp-2')).toMatchObject({ playerId: 'Alicia', kills: 2, deaths: 1 });
    expect(after.matchPlayers).toHaveLength(4);
    expect(recalc).toHaveBeenCalledTimes(1);
    expect(cloud.queuePlayerRename).toHaveBeenCalledWith('Alice', 'Alicia');
  });

  it('merges into an existing player', async () => {
    const { fake } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'John', 'merge');

    expect(result.ok && result.plan.kind).toBe('merge');
    const after = fake.snapshot();
    expect(after.players.map(p => p.id).sort()).toEqual(['Alice', 'John']);
    expect(after.matchPlayers.filter(mp => mp.playerId === 'John').map(mp => mp.id).sort()).toEqual(['mp-1', 'mp-3', 'mp-4']);
    expect(cloud.queuePlayerRename).toHaveBeenCalledWith('Jhon', 'John');
  });

  it('writes nothing when the confirmed kind no longer matches', async () => {
    const { fake, recalc } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'John', 'rename');

    expect(result).toEqual({ ok: false, error: { code: 'KIND_CHANGED', expected: 'rename', actual: 'merge' } });
    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
    expect(recalc).not.toHaveBeenCalled();
    expect(cloud.queuePlayerRename).not.toHaveBeenCalled();
  });

  it('writes nothing when both players are in the same match', async () => {
    const { fake } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'Alice', 'merge');

    expect(result).toEqual({ ok: false, error: { code: 'PLAYERS_SHARE_MATCHES', matchIds: ['m-1'] } });
    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
  });

  it('rolls back everything when a write fails part-way', async () => {
    const { fake, recalc } = useFakeDb({ failPutOf: 'mp-3' });

    await expect(dbService.renamePlayer('Jhon', 'Jon', 'rename')).rejects.toThrow('put failed for mp-3');

    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
    expect(recalc).not.toHaveBeenCalled();
    expect(cloud.queuePlayerRename).not.toHaveBeenCalled();
  });
});

describe('DatabaseService.previewPlayerRename', () => {
  it('plans from the stored players and match rows without writing', async () => {
    vi.spyOn(dbService, 'getAllPlayers').mockResolvedValue(seed.players);
    vi.spyOn(dbService, 'getPlayerMatches').mockImplementation(async (id: string) =>
      seed.matchPlayers.filter(mp => mp.playerId === id)
    );

    const result = await dbService.previewPlayerRename('Jhon', 'John');

    expect(result.ok && result.plan.kind).toBe('merge');
    expect(result.ok && result.plan.matchIds).toEqual(['m-1', 'm-2']);
  });
});
