// src/__tests__/services/DatabaseService.roundStats.test.ts
// The optional round-by-round log on a match player: saved by recordMatch,
// validated on import/merge. jsdom has no IndexedDB, so storage methods are stubbed.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { DBMatch, DBMatchPlayer, ExportData } from '../../services/DatabaseService';
import { GameLength, Team } from '../../types';
import { ROUND_STAT_FIELDS } from '../../shared/utils/roundStats';

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

vi.mock('../../services/supabase/CloudSyncService', () => ({
  CloudSyncService: { triggerAutoUpload: vi.fn() },
}));

import dbService from '../../services/DatabaseService';

/** Pretend the IndexedDB connection is open; every storage method used is stubbed. */
function connectFakeDb(): void {
  (dbService as unknown as { db: unknown }).db = {};
}

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

const annRow: DBMatchPlayer = {
  id: 'mp-1', matchId: 'match-1', playerId: 'Ann', team: Team.Titans,
  heroId: 1, heroName: 'Brogan', heroRoles: [], kills: 3, deviceId: 'device-a',
};
const catRow: DBMatchPlayer = {
  id: 'mp-2', matchId: 'match-1', playerId: 'Cat', team: Team.Atlanteans,
  heroId: 2, heroName: 'Tigerclaw', heroRoles: [], deviceId: 'device-a',
};

// What an import file may hold: anything, not just valid entries.
const messyLog = [{ round: 2, kills: 1 }, { round: 0, kills: 4 }, { round: 1, kills: -1, assists: 2, name: 'Ann' }];
const cleanLog = [{ round: 1, assists: 2 }, { round: 2, kills: 1 }];

function exportData(partial: Partial<ExportData>): ExportData {
  return { players: [], matches: [], matchPlayers: [], exportDate: new Date(), version: 4, ...partial };
}

function withLog(row: DBMatchPlayer, roundStats: unknown): DBMatchPlayer {
  return { ...row, roundStats } as unknown as DBMatchPlayer;
}

function savedRows(spy: { mock: { calls: unknown[][] } }): DBMatchPlayer[] {
  return spy.mock.calls.map(call => call[0] as DBMatchPlayer);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  (dbService as unknown as { db: unknown }).db = null;
});

describe('recordMatch stores the round log', () => {
  it('saves roundStats (counts only) when given and omits the key otherwise', async () => {
    connectFakeDb();
    vi.spyOn(dbService, 'getAllPlayers').mockResolvedValue([]);
    vi.spyOn(dbService, 'getAllMatches').mockResolvedValue([]);
    vi.spyOn(dbService, 'getPlayer').mockResolvedValue(null);
    vi.spyOn(dbService, 'savePlayer').mockResolvedValue();
    vi.spyOn(dbService, 'saveMatch').mockResolvedValue('match-1');
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
    const saveMatchPlayer = vi.spyOn(dbService, 'saveMatchPlayer').mockResolvedValue('mp');

    await dbService.recordMatch(
      { date: new Date('2026-10-01T18:00:00Z'), winningTeam: Team.Titans, gameLength: GameLength.Quick, doubleLanes: false, victoryType: 'throne' },
      [
        { id: 'Ann', team: Team.Titans, heroId: 1, heroName: 'Brogan', heroRoles: [], kills: 1, roundStats: [{ round: 1, kills: 0 }, { round: 2, kills: 1, level: 2 }] },
        { id: 'Cat', team: Team.Atlanteans, heroId: 2, heroName: 'Tigerclaw', heroRoles: [], roundStats: [] },
        { id: 'Dan', team: Team.Atlanteans, heroId: 3, heroName: 'Arien', heroRoles: [] },
      ]
    );

    const rows = savedRows(saveMatchPlayer);
    const ann = rows.find(row => row.playerId === 'Ann')!;
    expect(ann.roundStats).toEqual([{ round: 1, kills: 0 }, { round: 2, kills: 1, level: 2 }]);
    const allowedKeys: string[] = ['round', ...ROUND_STAT_FIELDS];
    for (const entry of ann.roundStats!) {
      expect(Object.keys(entry).filter(key => !allowedKeys.includes(key))).toEqual([]);
    }
    expect('roundStats' in rows.find(row => row.playerId === 'Cat')!).toBe(false);
    expect('roundStats' in rows.find(row => row.playerId === 'Dan')!).toBe(false);
  });
});

describe('importing round logs', () => {
  it('replace import keeps valid entries and drops a log with none', async () => {
    connectFakeDb();
    vi.spyOn(dbService, 'clearAllData').mockResolvedValue(true);
    vi.spyOn(dbService, 'saveMatch').mockResolvedValue('match-1');
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
    const saveMatchPlayer = vi.spyOn(dbService, 'saveMatchPlayer').mockResolvedValue('mp');

    const ok = await dbService.importData(exportData({
      matches: [match],
      matchPlayers: [withLog(annRow, messyLog), withLog(catRow, 'garbage')],
    }), 'replace');

    expect(ok).toBe(true);
    const [ann, cat] = savedRows(saveMatchPlayer);
    expect(ann).toEqual({ ...annRow, roundStats: cleanLog });
    expect(cat).toEqual(catRow);
    expect('roundStats' in cat).toBe(false);
  });

  it('merge import of a new match validates the log', async () => {
    connectFakeDb();
    vi.spyOn(dbService, 'getAllPlayers').mockResolvedValue([]);
    vi.spyOn(dbService, 'getAllMatches').mockResolvedValue([]);
    vi.spyOn(dbService, 'getAllMatchPlayers').mockResolvedValue([]);
    vi.spyOn(dbService, 'savePlayer').mockResolvedValue();
    vi.spyOn(dbService, 'saveMatch').mockResolvedValue('match-1');
    vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
    const saveMatchPlayer = vi.spyOn(dbService, 'saveMatchPlayer').mockResolvedValue('mp');

    await dbService.mergeData(exportData({
      matches: [match],
      matchPlayers: [withLog(annRow, messyLog), withLog(catRow, [{ round: 'one' }])],
    }));

    const [ann, cat] = savedRows(saveMatchPlayer);
    expect(ann).toEqual({ ...annRow, roundStats: cleanLog });
    expect(cat).toEqual(catRow);
  });

  describe('merge import of a match that already exists locally', () => {
    function stubExisting(localRows: DBMatchPlayer[]) {
      connectFakeDb();
      vi.spyOn(dbService, 'getAllPlayers').mockResolvedValue([]);
      vi.spyOn(dbService, 'getAllMatches').mockResolvedValue([match]);
      vi.spyOn(dbService, 'getAllMatchPlayers').mockResolvedValue(localRows);
      vi.spyOn(dbService, 'saveMatch').mockResolvedValue('match-1');
      vi.spyOn(dbService, 'recalculatePlayerStats').mockResolvedValue();
      return vi.spyOn(dbService, 'saveMatchPlayer').mockResolvedValue('mp');
    }

    it('fills a missing log with the validated imported one', async () => {
      const saveMatchPlayer = stubExisting([annRow, catRow]);

      await dbService.mergeData(exportData({
        matches: [match],
        matchPlayers: [withLog(annRow, messyLog), { ...catRow }],
      }));

      expect(savedRows(saveMatchPlayer)).toEqual([{ ...annRow, roundStats: cleanLog }]);
    });

    it('fills nothing from an invalid imported log', async () => {
      const saveMatchPlayer = stubExisting([annRow, catRow]);

      await dbService.mergeData(exportData({
        matches: [match],
        matchPlayers: [withLog(annRow, 'garbage'), withLog(catRow, [null])],
      }));

      expect(saveMatchPlayer).not.toHaveBeenCalled();
    });

    it('never overwrites a local log', async () => {
      const localLog = [{ round: 1, kills: 3 }];
      const saveMatchPlayer = stubExisting([{ ...annRow, roundStats: localLog }, catRow]);

      await dbService.mergeData(exportData({
        matches: [match],
        matchPlayers: [withLog(annRow, [{ round: 1, kills: 9 }])],
      }));

      expect(saveMatchPlayer).not.toHaveBeenCalled();
    });
  });
});
