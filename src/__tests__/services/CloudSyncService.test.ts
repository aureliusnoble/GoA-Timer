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
});
