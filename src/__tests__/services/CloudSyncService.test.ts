// src/__tests__/services/CloudSyncService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeSupabase } from '../helpers/fakeSupabase';
import type { ExportData } from '../../services/DatabaseService';
import { GameLength, Team } from '../../types';

const db = vi.hoisted(() => ({
  exportData: vi.fn(),
  mergeData: vi.fn(),
  getMatch: vi.fn(),
  deleteMatchAndPlayersOnly: vi.fn(),
  recalculatePlayerStats: vi.fn(),
}));

vi.mock('../../services/supabase/SupabaseClient', async () => {
  const { fakeSupabase: fake } = await import('../helpers/fakeSupabase');
  return { supabase: fake.client, isSupabaseConfigured: () => true };
});
vi.mock('../../services/DatabaseService', () => ({ default: db, dbService: db }));

import { CloudSyncService } from '../../services/supabase/CloudSyncService';

function localData(): ExportData {
  return {
    players: [],
    matches: [{
      id: 'match-1',
      date: new Date('2026-09-01T18:30:00.000Z'),
      winningTeam: Team.Titans,
      gameLength: GameLength.Quick,
      doubleLanes: false,
      titanPlayers: 1,
      atlanteanPlayers: 1,
      deviceId: 'device-a',
      // victoryType deliberately missing
    }],
    matchPlayers: [],
    exportDate: new Date(),
    version: 4,
  };
}

describe('CloudSyncService.uploadLocalData', () => {
  beforeEach(() => {
    fakeSupabase.reset();
    vi.clearAllMocks();
    db.exportData.mockResolvedValue(localData());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not send victory_type for a match that has none locally', async () => {
    await CloudSyncService.uploadLocalData();

    const upserts = fakeSupabase.callsTo('cloud_matches', 'upsert');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].payload).not.toHaveProperty('victory_type');
  });

  it('logs a failed match upload and reports it instead of ignoring it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeSupabase.respondWith(call =>
      call.table === 'cloud_matches' && call.op === 'upsert'
        ? { error: { message: 'column "victory_type" does not exist' } }
        : { data: [], error: null }
    );

    const result = await CloudSyncService.uploadLocalData();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/1 record failed/);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to upload match match-1'),
      'column "victory_type" does not exist'
    );
    expect(CloudSyncService.getStatus().error).toMatch(/1 record failed/);
  });

  it('upserts each player, match and match player as a single row object', async () => {
    db.exportData.mockResolvedValue({
      ...localData(),
      players: [{ id: 'Alice', name: 'Alice', totalGames: 1, wins: 1, losses: 0, elo: 1200, lastPlayed: new Date(), dateCreated: new Date() }],
      matchPlayers: [{ id: 'mp-1', matchId: 'match-1', playerId: 'Alice', team: Team.Titans, heroId: 1, heroName: 'Arien', heroRoles: [] }],
    });

    await CloudSyncService.uploadLocalData();

    const upserts = ['cloud_players', 'cloud_matches', 'cloud_match_players'].flatMap(t => fakeSupabase.callsTo(t, 'upsert'));
    expect(upserts).toHaveLength(3);
    for (const { table, payload } of upserts) {
      expect(Array.isArray(payload), table).toBe(false);
      expect(payload, table).toMatchObject({ owner_id: 'owner-1' });
    }
  });

  it('sends round_stats only for match players that have a round log, one row per upsert', async () => {
    const roundStats = [{ round: 1, kills: 1 }, { round: 2, kills: 0, deaths: 2 }];
    db.exportData.mockResolvedValue({
      ...localData(),
      matchPlayers: [
        { id: 'mp-1', matchId: 'match-1', playerId: 'Alice', team: Team.Titans, heroId: 1, heroName: 'Arien', heroRoles: [], kills: 1, deaths: 2, roundStats },
        { id: 'mp-2', matchId: 'match-1', playerId: 'Bob', team: Team.Atlanteans, heroId: 2, heroName: 'Brogan', heroRoles: [], kills: 2 },
      ],
    });

    await CloudSyncService.uploadLocalData();

    const upserts = fakeSupabase.callsTo('cloud_match_players', 'upsert');
    expect(upserts.map(call => Array.isArray(call.payload))).toEqual([false, false]);
    expect(upserts[0].payload).toMatchObject({ id: 'mp-1', round_stats: roundStats });
    expect(upserts[1].payload).toMatchObject({ id: 'mp-2' });
    expect(upserts[1].payload).not.toHaveProperty('round_stats');
  });

  describe('when the cloud has no round_stats column yet', () => {
    const roundStats = [{ round: 1, kills: 1 }];
    const missingColumn = {
      code: 'PGRST204',
      message: "Could not find the 'round_stats' column of 'cloud_match_players' in the schema cache",
    };
    const rejectRoundStats = () => fakeSupabase.respondWith(call =>
      call.table === 'cloud_match_players' && call.op === 'upsert' && 'round_stats' in (call.payload as object)
        ? { error: missingColumn }
        : { data: [], error: null }
    );

    beforeEach(() => {
      db.exportData.mockResolvedValue({
        ...localData(),
        matchPlayers: [
          { id: 'mp-1', matchId: 'match-1', playerId: 'Alice', team: Team.Titans, heroId: 1, heroName: 'Arien', heroRoles: [], kills: 1, roundStats },
          { id: 'mp-2', matchId: 'match-1', playerId: 'Bob', team: Team.Atlanteans, heroId: 2, heroName: 'Brogan', heroRoles: [], kills: 0, roundStats },
          { id: 'mp-3', matchId: 'match-1', playerId: 'Cara', team: Team.Atlanteans, heroId: 3, heroName: 'Cutter', heroRoles: [] },
        ],
      });
    });

    it('retries the rejected row without round_stats and leaves it out for the rest of the run', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      rejectRoundStats();

      const result = await CloudSyncService.uploadLocalData();

      const upserts = fakeSupabase.callsTo('cloud_match_players', 'upsert');
      expect(upserts.map(call => (call.payload as { id: string }).id)).toEqual(['mp-1', 'mp-1', 'mp-2', 'mp-3']);
      expect(upserts.map(call => Array.isArray(call.payload))).toEqual([false, false, false, false]);
      expect(upserts.map(call => 'round_stats' in (call.payload as object))).toEqual([true, false, false, false]);
      expect(upserts[1].payload).toMatchObject({ id: 'mp-1', kills: 1, owner_id: 'owner-1' });
      expect(result).toMatchObject({ success: true, recordsAdded: 4, error: undefined });
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledTimes(1);
      expect(consoleWarn.mock.calls[0][0]).toMatch(/round logs/i);
    });

    it('tries round_stats again on the next upload', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      rejectRoundStats();
      await CloudSyncService.uploadLocalData();

      fakeSupabase.reset();
      await CloudSyncService.uploadLocalData();

      const upserts = fakeSupabase.callsTo('cloud_match_players', 'upsert');
      expect(upserts.map(call => 'round_stats' in (call.payload as object))).toEqual([true, true, false]);
    });

    it('does not retry other errors and counts the row as failed', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      fakeSupabase.respondWith(call =>
        call.table === 'cloud_match_players' && call.op === 'upsert' && (call.payload as { id: string }).id === 'mp-1'
          ? { error: { code: '23503', message: 'violates foreign key constraint' } }
          : { data: [], error: null }
      );

      const result = await CloudSyncService.uploadLocalData();

      const upserts = fakeSupabase.callsTo('cloud_match_players', 'upsert');
      expect(upserts.map(call => (call.payload as { id: string }).id)).toEqual(['mp-1', 'mp-2', 'mp-3']);
      expect(upserts.map(call => 'round_stats' in (call.payload as object))).toEqual([true, true, false]);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/1 record failed/);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload match player mp-1 (match match-1)'),
        'violates foreign key constraint'
      );
      expect(consoleWarn).not.toHaveBeenCalled();
    });
  });
});

describe('CloudSyncService.downloadOwnCloudData', () => {
  beforeEach(() => {
    fakeSupabase.reset();
    vi.clearAllMocks();
    db.mergeData.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads round_stats as roundStats and treats null as no log', async () => {
    const matchRow = {
      id: 'match-1', owner_id: 'owner-1', date: '2026-09-01T18:30:00.000Z', winning_team: 'titans',
      game_length: 'quick', double_lanes: false, titan_players: 1, atlantean_players: 1, device_id: 'device-other',
    };
    const playerRow = (id: string, round_stats: unknown) => ({
      id, owner_id: 'owner-1', match_id: 'match-1', player_id: id, team: 'titans', hero_id: 1,
      hero_name: 'Arien', hero_roles: [], kills: 1, device_id: 'device-other', round_stats,
    });
    fakeSupabase.respondWith(call => {
      if (call.op !== 'select') return { data: [], error: null };
      if (call.table === 'cloud_matches') return { data: [matchRow], error: null };
      if (call.table === 'cloud_match_players') {
        return { data: [playerRow('mp-1', [{ round: 1, kills: 1 }]), playerRow('mp-2', null)], error: null };
      }
      return { data: [], error: null };
    });

    const result = await CloudSyncService.downloadOwnCloudData();

    expect(result.success).toBe(true);
    const [imported] = db.mergeData.mock.calls[0] as [ExportData];
    expect(imported.matchPlayers.map(mp => mp.roundStats)).toEqual([[{ round: 1, kills: 1 }], undefined]);
  });
});

describe('CloudSyncService player renames', () => {
  const PENDING_KEY = 'cloudSync_pendingPlayerRenames';
  const AUTH_KEY = 'goa-timer-auth';
  const storeSession = (userId: string) =>
    localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: 'token', user: { id: userId } }));

  beforeEach(() => {
    fakeSupabase.reset();
    vi.clearAllMocks();
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(AUTH_KEY);
    vi.spyOn(CloudSyncService, 'triggerAutoUpload').mockImplementation(() => {});
    db.exportData.mockResolvedValue({ players: [], matches: [], matchPlayers: [], exportDate: new Date(), version: 4 });
    db.mergeData.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(AUTH_KEY);
  });

  it('re-keys cloud match players, deletes the old cloud player and empties the queue', async () => {
    const applied = await CloudSyncService.queuePlayerRename('Jhon', 'John');

    expect(applied).toBe(true);
    const [rekey] = fakeSupabase.callsTo('cloud_match_players', 'update');
    expect(rekey.payload).toEqual({ player_id: 'John' });
    expect(rekey.filters).toEqual([
      { method: 'eq', column: 'owner_id', value: 'owner-1' },
      { method: 'eq', column: 'player_id', value: 'Jhon' },
    ]);
    const [removal] = fakeSupabase.callsTo('cloud_players', 'delete');
    expect(removal.filters).toEqual([
      { method: 'eq', column: 'owner_id', value: 'owner-1' },
      { method: 'eq', column: 'local_id', value: 'Jhon' },
    ]);
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([]);
    expect(CloudSyncService.triggerAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('keeps the rename queued when the cloud update fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeSupabase.respondWith(call =>
      call.table === 'cloud_match_players' && call.op === 'update'
        ? { error: { message: 'network down' } }
        : { data: [], error: null }
    );

    const applied = await CloudSyncService.queuePlayerRename('Jhon', 'John');

    expect(applied).toBe(false);
    expect(fakeSupabase.callsTo('cloud_players', 'delete')).toHaveLength(0);
    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John' }]);
  });

  it('keeps the rename queued while signed out', async () => {
    fakeSupabase.setUser(null);

    await CloudSyncService.queuePlayerRename('Jhon', 'John');

    expect(fakeSupabase.callsTo('cloud_match_players')).toHaveLength(0);
    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John' }]);
    expect(CloudSyncService.getPendingPlayerRenames()[0]).not.toHaveProperty('ownerId');
  });

  it('queues the rename before any network call, so it is kept if the page closes straight away', async () => {
    storeSession('owner-1');

    const pending = CloudSyncService.queuePlayerRename('Jhon', 'John');

    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John', ownerId: 'owner-1' }]);
    await pending;
  });

  it('enqueues a rename synchronously without any network call', () => {
    storeSession('owner-1');
    const getUser = vi.spyOn(fakeSupabase.client.auth, 'getUser');

    const stored = CloudSyncService.enqueuePlayerRename('Jhon', 'John');

    expect(stored).toBe(true);
    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John', ownerId: 'owner-1' }]);
    expect(fakeSupabase.calls).toHaveLength(0);
    expect(getUser).not.toHaveBeenCalled();
    expect(CloudSyncService.triggerAutoUpload).not.toHaveBeenCalled();
  });

  it('reports a rename it could not store in the queue', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });

    expect(CloudSyncService.enqueuePlayerRename('Jhon', 'John')).toBe(false);
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([]);
  });

  it('applies an already queued rename to the cloud and then schedules an upload', async () => {
    CloudSyncService.enqueuePlayerRename('Jhon', 'John');

    const applied = await CloudSyncService.flushQueuedPlayerRenames();

    expect(applied).toBe(true);
    expect(fakeSupabase.callsTo('cloud_match_players', 'update').map(call => call.payload)).toEqual([{ player_id: 'John' }]);
    expect(fakeSupabase.callsTo('cloud_players', 'delete')).toHaveLength(1);
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([]);
    expect(CloudSyncService.triggerAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('stamps the owner from the stored session without asking the auth server', async () => {
    storeSession('owner-1');
    vi.spyOn(fakeSupabase.client.auth, 'getUser').mockResolvedValue({ data: { user: null } });

    await CloudSyncService.queuePlayerRename('Jhon', 'John');

    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John', ownerId: 'owner-1' }]);
  });

  it('queues the rename without an owner when the stored session is missing or unreadable', async () => {
    fakeSupabase.setUser(null);

    for (const stored of [null, 'not json', JSON.stringify({ user: { id: 5 } }), JSON.stringify({ user: { id: '' } })]) {
      localStorage.removeItem(PENDING_KEY);
      if (stored === null) localStorage.removeItem(AUTH_KEY);
      else localStorage.setItem(AUTH_KEY, stored);

      await CloudSyncService.queuePlayerRename('Jhon', 'John');

      const queue = CloudSyncService.getPendingPlayerRenames();
      expect(queue, String(stored)).toMatchObject([{ oldId: 'Jhon', newId: 'John' }]);
      expect(queue[0], String(stored)).not.toHaveProperty('ownerId');
    }
  });

  it("leaves another account's rename queued and still downloads", async () => {
    const theirs = { oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z', ownerId: 'owner-2' };
    localStorage.setItem(PENDING_KEY, JSON.stringify([theirs]));

    const result = await CloudSyncService.downloadOwnCloudData();

    expect(result.success).toBe(true);
    expect(fakeSupabase.callsTo('cloud_match_players', 'update')).toHaveLength(0);
    expect(fakeSupabase.callsTo('cloud_players', 'delete')).toHaveLength(0);
    expect(db.mergeData).toHaveBeenCalledTimes(1);
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([theirs]);
  });

  it('applies renames queued while signed out or by this account, in order, to the account that syncs', async () => {
    const unowned = { oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z' };
    const theirs = { oldId: 'Ann', newId: 'Anne', queuedAt: '2026-10-12T10:01:00.000Z', ownerId: 'owner-2' };
    const mine = { oldId: 'Bob', newId: 'Rob', queuedAt: '2026-10-12T10:02:00.000Z', ownerId: 'owner-1' };
    localStorage.setItem(PENDING_KEY, JSON.stringify([unowned, theirs, mine]));

    await CloudSyncService.uploadLocalData();

    const rekeys = fakeSupabase.callsTo('cloud_match_players', 'update');
    expect(rekeys.map(call => call.payload)).toEqual([{ player_id: 'John' }, { player_id: 'Rob' }]);
    for (const call of rekeys) {
      expect(call.filters[0]).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    }
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([theirs]);
  });

  it('applies queued renames before uploading', async () => {
    localStorage.setItem(PENDING_KEY, JSON.stringify([{ oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z' }]));

    await CloudSyncService.uploadLocalData();

    const tables = fakeSupabase.calls.map(call => `${call.table}:${call.op}`);
    expect(tables.indexOf('cloud_match_players:update')).toBeGreaterThanOrEqual(0);
    expect(tables.indexOf('cloud_match_players:update')).toBeLessThan(tables.indexOf('profiles:update'));
    expect(CloudSyncService.getPendingPlayerRenames()).toEqual([]);
  });

  it('stops instead of re-applying a rename it cannot remove from the queue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(PENDING_KEY, JSON.stringify([{ oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z' }]));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable'); });

    const result = await CloudSyncService.downloadOwnCloudData();

    expect(result.success).toBe(false);
    expect(fakeSupabase.callsTo('cloud_match_players', 'update')).toHaveLength(1);
    expect(CloudSyncService.getPendingPlayerRenames()).toMatchObject([{ oldId: 'Jhon', newId: 'John' }]);
  });

  it('refuses to download own data while a rename cannot be applied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(PENDING_KEY, JSON.stringify([{ oldId: 'Jhon', newId: 'John', queuedAt: '2026-10-12T10:00:00.000Z' }]));
    fakeSupabase.respondWith(call =>
      call.table === 'cloud_match_players' && call.op === 'update'
        ? { error: { message: 'network down' } }
        : { data: [], error: null }
    );

    const result = await CloudSyncService.downloadOwnCloudData();

    expect(result.success).toBe(false);
    expect(db.mergeData).not.toHaveBeenCalled();
    expect(fakeSupabase.callsTo('cloud_players', 'select')).toHaveLength(0);
  });
});
