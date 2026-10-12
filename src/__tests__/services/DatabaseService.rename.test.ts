// src/__tests__/services/DatabaseService.rename.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { Team } from '../../types';
import { createFakeRenameDb } from '../helpers/fakeRenameDb';

const cloud = vi.hoisted(() => ({
  triggerAutoUpload: vi.fn(),
  deleteMatchFromCloud: vi.fn(async () => ({ success: true })),
  enqueuePlayerRename: vi.fn(() => true),
  flushQueuedPlayerRenames: vi.fn(async () => true),
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
    expect(cloud.enqueuePlayerRename).toHaveBeenCalledWith('Alice', 'Alicia');
    expect(cloud.flushQueuedPlayerRenames).toHaveBeenCalledTimes(1);
    const [enqueued] = cloud.enqueuePlayerRename.mock.invocationCallOrder;
    const [recalculated] = recalc.mock.invocationCallOrder;
    const [flushed] = cloud.flushQueuedPlayerRenames.mock.invocationCallOrder;
    expect(enqueued).toBeLessThan(recalculated);
    expect(recalculated).toBeLessThan(flushed);
  });

  it('queues the cloud rename as soon as the local rename commits and syncs it once stats are recalculated', async () => {
    const { recalc } = useFakeDb();
    let finishRecalc = () => {};
    recalc.mockImplementation(() => new Promise<void>(resolve => { finishRecalc = () => resolve(); }));

    const renaming = dbService.renamePlayer('Alice', 'Alicia', 'rename');
    await vi.waitFor(() => expect(recalc).toHaveBeenCalled());

    expect(cloud.enqueuePlayerRename).toHaveBeenCalledWith('Alice', 'Alicia');
    expect(cloud.flushQueuedPlayerRenames).not.toHaveBeenCalled();

    finishRecalc();
    await renaming;
    expect(cloud.flushQueuedPlayerRenames).toHaveBeenCalledTimes(1);
  });

  it('keeps the rename and still syncs it when recalculating stats fails', async () => {
    const { fake, recalc } = useFakeDb();
    recalc.mockRejectedValue(new Error('recalc failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await dbService.renamePlayer('Alice', 'Alicia', 'rename');

    expect(result.ok).toBe(true);
    expect(fake.snapshot().players.map(p => p.id).sort()).toEqual(['Alicia', 'Jhon', 'John']);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('recalculating stats failed'), expect.any(Error));
    expect(cloud.enqueuePlayerRename).toHaveBeenCalledWith('Alice', 'Alicia');
    expect(cloud.flushQueuedPlayerRenames).toHaveBeenCalledTimes(1);
  });

  it('merges into an existing player', async () => {
    const { fake } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'John', 'merge');

    expect(result.ok && result.plan.kind).toBe('merge');
    const after = fake.snapshot();
    expect(after.players.map(p => p.id).sort()).toEqual(['Alice', 'John']);
    expect(after.matchPlayers.filter(mp => mp.playerId === 'John').map(mp => mp.id).sort()).toEqual(['mp-1', 'mp-3', 'mp-4']);
    expect(cloud.enqueuePlayerRename).toHaveBeenCalledWith('Jhon', 'John');
    expect(cloud.flushQueuedPlayerRenames).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the confirmed kind no longer matches', async () => {
    const { fake, recalc } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'John', 'rename');

    expect(result).toEqual({ ok: false, error: { code: 'KIND_CHANGED', expected: 'rename', actual: 'merge' } });
    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
    expect(recalc).not.toHaveBeenCalled();
    expect(cloud.enqueuePlayerRename).not.toHaveBeenCalled();
    expect(cloud.flushQueuedPlayerRenames).not.toHaveBeenCalled();
  });

  it('writes nothing when both players are in the same match', async () => {
    const { fake } = useFakeDb();

    const result = await dbService.renamePlayer('Jhon', 'Alice', 'merge');

    expect(result).toEqual({ ok: false, error: { code: 'PLAYERS_SHARE_MATCHES', matchIds: ['m-1'] } });
    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
    expect(cloud.enqueuePlayerRename).not.toHaveBeenCalled();
    expect(cloud.flushQueuedPlayerRenames).not.toHaveBeenCalled();
  });

  it('rolls back everything when a write fails part-way', async () => {
    const { fake, recalc } = useFakeDb({ failPutOf: 'mp-3' });

    await expect(dbService.renamePlayer('Jhon', 'Jon', 'rename')).rejects.toThrow('put failed for mp-3');

    expect(fake.snapshot()).toEqual({ players: seed.players, matchPlayers: seed.matchPlayers });
    expect(recalc).not.toHaveBeenCalled();
    expect(cloud.enqueuePlayerRename).not.toHaveBeenCalled();
    expect(cloud.flushQueuedPlayerRenames).not.toHaveBeenCalled();
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
