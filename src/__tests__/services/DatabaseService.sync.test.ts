// src/__tests__/services/DatabaseService.sync.test.ts
// jsdom has no IndexedDB, so these tests stub the DatabaseService methods that
// touch storage and check the sync-related behaviour around them.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DBMatch, DBMatchPlayer, DBPlayer, ExportData } from '../../services/DatabaseService';
import { GameLength, Team } from '../../types';

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

const cloud = vi.hoisted(() => ({
  triggerAutoUpload: vi.fn(),
  deleteMatchFromCloud: vi.fn(async () => ({ success: true })),
}));
vi.mock('../../services/supabase/CloudSyncService', () => ({ CloudSyncService: cloud }));

import dbService from '../../services/DatabaseService';

/** Pretend the IndexedDB connection is open; every storage method used is stubbed. */
function connectFakeDb(): void {
  (dbService as unknown as { db: unknown }).db = {};
}

const alice: DBPlayer = {
  id: 'Alice', name: 'Alice', totalGames: 1, wins: 1, losses: 0, elo: 1200,
  lastPlayed: new Date('2026-09-01T00:00:00Z'), dateCreated: new Date('2026-01-01T00:00:00Z'),
};

const match: DBMatch = {
  id: 'match-1',
  date: new Date('2026-09-01T18:30:00Z'),
  winningTeam: Team.Titans,
  gameLength: GameLength.Quick,
  doubleLanes: false,
  titanPlayers: 1,
  atlanteanPlayers: 1,
  deviceId: 'device-a',
};

const aliceRow: DBMatchPlayer = {
  id: 'mp-1', matchId: 'match-1', playerId: 'Alice', team: Team.Titans,
  heroId: 1, heroName: 'Brogan', heroRoles: [], kills: 3, deviceId: 'device-a',
};
const bobRow: DBMatchPlayer = {
  id: 'mp-2', matchId: 'match-1', playerId: 'Bob', team: Team.Atlanteans,
  heroId: 2, heroName: 'Tigerclaw', heroRoles: [], deviceId: 'device-a',
};

function exportData(partial: Partial<ExportData>): ExportData {
  return { players: [], matches: [], matchPlayers: [], exportDate: new Date(), version: 4, ...partial };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  (dbService as unknown as { db: unknown }).db = null;
});

describe('mergeData on a match that already exists locally', () => {
  function stubStorage(localMatch: DBMatch, localRows: DBMatchPlayer[]) {
    connectFakeDb();
    vi.spyOn(dbService, 'getAllPlayers').mockResolvedValue([alice]);
    vi.spyOn(dbService, 'getAllMatches').mockResolvedValue([localMatch]);
    vi.spyOn(dbService, 'getMatchPlayers').mockResolvedValue(localRows);
    vi.spyOn(dbService, 'savePlayer').mockResolvedValue();
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
    return {
      saveMatch: vi.spyOn(dbService, 'saveMatch').mockResolvedValue('match-1'),
      saveMatchPlayer: vi.spyOn(dbService, 'saveMatchPlayer').mockResolvedValue('mp-1'),
    };
  }

  it('fills the missing victory type and stats without overwriting local values', async () => {
    const { saveMatch, saveMatchPlayer } = stubStorage(match, [aliceRow, bobRow]);

    const ok = await dbService.mergeData(exportData({
      players: [alice],
      matches: [{ ...match, victoryType: 'wave', doubleLanes: true }],
      matchPlayers: [{ ...aliceRow, kills: 9, deaths: 2 }, { ...bobRow }],
    }));

    expect(ok).toBe(true);
    expect(saveMatch).toHaveBeenCalledTimes(1);
    expect(saveMatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1', victoryType: 'wave', doubleLanes: false }));
    expect(saveMatchPlayer).toHaveBeenCalledTimes(1);
    expect(saveMatchPlayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'mp-1', kills: 3, deaths: 2 }));
  });

  it('writes nothing when the local copy already has every field', async () => {
    const { saveMatch, saveMatchPlayer } = stubStorage({ ...match, victoryType: 'throne' }, [aliceRow, bobRow]);

    await dbService.mergeData(exportData({
      matches: [{ ...match, victoryType: 'wave' }],
      matchPlayers: [{ ...aliceRow, kills: 9 }],
    }));

    expect(saveMatch).not.toHaveBeenCalled();
    expect(saveMatchPlayer).not.toHaveBeenCalled();
  });

  it('does not refill a field cleared on a locally edited match, nor fill its match players', async () => {
    const editedMatch: DBMatch = { ...match, locallyEditedAt: new Date('2026-10-01T12:00:00Z') };
    const clearedAliceRow: DBMatchPlayer = { ...aliceRow, kills: undefined };
    const { saveMatch, saveMatchPlayer } = stubStorage(editedMatch, [clearedAliceRow, bobRow]);

    await dbService.mergeData(exportData({
      matches: [{ ...match, victoryType: 'wave' }],
      matchPlayers: [{ ...aliceRow, kills: 3, deaths: 2 }, { ...bobRow, kills: 1 }],
    }));

    expect(saveMatch).not.toHaveBeenCalled();
    expect(saveMatchPlayer).not.toHaveBeenCalled();
  });

  it('does not add an unknown match player to an existing match', async () => {
    const { saveMatchPlayer } = stubStorage(match, [aliceRow, bobRow]);

    await dbService.mergeData(exportData({
      matches: [match],
      matchPlayers: [{ ...bobRow, id: 'mp-unknown', playerId: 'Carol', kills: 1 }],
    }));

    expect(saveMatchPlayer).not.toHaveBeenCalled();
  });
});

describe('local edit marker', () => {
  function stubEdit() {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    connectFakeDb();
    vi.spyOn(dbService, 'getMatch').mockResolvedValue(match);
    vi.spyOn(dbService, 'getMatchPlayers').mockResolvedValue([aliceRow, bobRow]);
    vi.spyOn(dbService, 'updateMatchPlayers').mockResolvedValue();
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
    return vi.spyOn(dbService, 'updateMatch').mockResolvedValue();
  }

  it('editMatch marks the match as locally edited along with match-level changes', async () => {
    const updateMatch = stubEdit();

    await dbService.editMatch('match-1', { victoryType: 'throne' }, []);

    expect(updateMatch).toHaveBeenCalledWith('match-1', { victoryType: 'throne', locallyEditedAt: expect.any(Date) });
  });

  it('editMatch marks the match as locally edited when only match players change', async () => {
    const updateMatch = stubEdit();

    await dbService.editMatch('match-1', {}, [{ id: 'mp-1', updates: { kills: undefined } }]);

    expect(updateMatch).toHaveBeenCalledWith('match-1', { locallyEditedAt: expect.any(Date) });
  });
});

describe('cloud upload after local changes', () => {
  it('editMatch triggers an auto-upload after saving', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    connectFakeDb();
    vi.spyOn(dbService, 'getMatch').mockResolvedValue(match);
    vi.spyOn(dbService, 'getMatchPlayers').mockResolvedValue([aliceRow, bobRow]);
    vi.spyOn(dbService, 'updateMatch').mockResolvedValue();
    vi.spyOn(dbService, 'updateMatchPlayers').mockResolvedValue();
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();

    await dbService.editMatch('match-1', { victoryType: 'throne' }, []);

    expect(cloud.triggerAutoUpload).toHaveBeenCalledTimes(1);
  });

  it('editMatch does not upload when validation fails', async () => {
    connectFakeDb();
    vi.spyOn(dbService, 'getMatch').mockResolvedValue(match);
    vi.spyOn(dbService, 'getMatchPlayers').mockResolvedValue([aliceRow, bobRow]);
    const updateMatch = vi.spyOn(dbService, 'updateMatch').mockResolvedValue();

    await expect(
      dbService.editMatch('match-1', {}, [{ id: 'mp-1', updates: { kills: -1 } }])
    ).rejects.toThrow(/Validation failed/);

    expect(updateMatch).not.toHaveBeenCalled();
    expect(cloud.triggerAutoUpload).not.toHaveBeenCalled();
  });

  it('deleteMatch records the cloud deletion and triggers an auto-upload', async () => {
    connectFakeDb();
    vi.spyOn(dbService, 'getMatch').mockResolvedValue(match);
    vi.spyOn(dbService, 'getMatchPlayers').mockResolvedValue([aliceRow, bobRow]);
    vi.spyOn(
      dbService as unknown as { deleteMatchAndPlayers: (id: string, rows: DBMatchPlayer[]) => Promise<void> },
      'deleteMatchAndPlayers'
    ).mockResolvedValue();
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();

    await dbService.deleteMatch('match-1');

    expect(cloud.deleteMatchFromCloud).toHaveBeenCalledWith('match-1');
    expect(cloud.triggerAutoUpload).toHaveBeenCalledTimes(1);
  });
});
