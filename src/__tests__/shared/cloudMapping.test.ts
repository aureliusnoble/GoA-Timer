// src/__tests__/shared/cloudMapping.test.ts
import { describe, it, expect } from 'vitest';
import {
  cloudMatchPlayerRowToLocal,
  cloudMatchRowToLocal,
  cloudPlayerRowToLocal,
  localMatchPlayerToCloudRow,
  localMatchToCloudRow,
  localPlayerToCloudRow,
  toOptionalNumber,
  toVictoryType,
  CloudUploadContext,
} from '../../shared/utils/cloudMapping';
import type { DBMatch, DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { GameLength, Team } from '../../types';

const ctx: CloudUploadContext = {
  ownerId: 'owner-1',
  deviceId: 'device-current',
  syncedAt: '2026-10-12T10:00:00.000Z',
};

const baseMatchRow = {
  id: 'match-1',
  date: '2026-09-01T18:30:00.000Z',
  winning_team: 'titans',
  game_length: 'quick',
  double_lanes: false,
  titan_players: 2,
  atlantean_players: 2,
  device_id: 'device-a',
};

const baseMatchPlayerRow = {
  id: 'mp-1',
  match_id: 'match-1',
  player_id: 'Alice',
  team: 'atlanteans',
  hero_id: 0,
  hero_name: 'Arien',
  hero_roles: ['Tactician'],
  device_id: 'device-a',
};

describe('toOptionalNumber', () => {
  it('keeps finite numbers including zero', () => {
    expect(toOptionalNumber(0)).toBe(0);
    expect(toOptionalNumber(7)).toBe(7);
  });
  it('parses numeric strings (Postgres DECIMAL)', () => {
    expect(toOptionalNumber('25.5')).toBe(25.5);
  });
  it('turns null, undefined, NaN and junk into undefined', () => {
    expect(toOptionalNumber(null)).toBeUndefined();
    expect(toOptionalNumber(undefined)).toBeUndefined();
    expect(toOptionalNumber(Number.NaN)).toBeUndefined();
    expect(toOptionalNumber('')).toBeUndefined();
    expect(toOptionalNumber('abc')).toBeUndefined();
  });
});

describe('toVictoryType', () => {
  it('accepts the three victory types in any case', () => {
    expect(toVictoryType('throne')).toBe('throne');
    expect(toVictoryType('WAVE')).toBe('wave');
    expect(toVictoryType('Kills')).toBe('kills');
  });
  it('rejects null and unknown values', () => {
    expect(toVictoryType(null)).toBeUndefined();
    expect(toVictoryType('surrender')).toBeUndefined();
  });
});

describe('cloudMatchRowToLocal', () => {
  it('maps victory_type to victoryType', () => {
    const match = cloudMatchRowToLocal({ ...baseMatchRow, victory_type: 'wave' });
    expect(match.victoryType).toBe('wave');
  });

  it('normalises a null victory_type and device_id to undefined', () => {
    const match = cloudMatchRowToLocal({ ...baseMatchRow, victory_type: null, device_id: null });
    expect(match.victoryType).toBeUndefined();
    expect(match.deviceId).toBeUndefined();
  });

  it('lowercases team and game length and parses the date', () => {
    const match = cloudMatchRowToLocal({ ...baseMatchRow, winning_team: 'ATLANTEANS', game_length: 'Long' });
    expect(match.winningTeam).toBe(Team.Atlanteans);
    expect(match.gameLength).toBe(GameLength.Long);
    expect(match.date.toISOString()).toBe('2026-09-01T18:30:00.000Z');
  });

  it('never sets the local edit marker', () => {
    expect('locallyEditedAt' in cloudMatchRowToLocal({ ...baseMatchRow, victory_type: 'wave' })).toBe(false);
  });
});

describe('cloudMatchPlayerRowToLocal', () => {
  it('turns null stats into undefined (not tracked)', () => {
    const mp = cloudMatchPlayerRowToLocal({
      ...baseMatchPlayerRow,
      kills: null, deaths: null, assists: null, gold_earned: null, minion_kills: null, level: null,
    });
    expect(mp.kills).toBeUndefined();
    expect(mp.deaths).toBeUndefined();
    expect(mp.assists).toBeUndefined();
    expect(mp.goldEarned).toBeUndefined();
    expect(mp.minionKills).toBeUndefined();
    expect(mp.level).toBeUndefined();
  });

  it('keeps tracked zeros and hero id 0', () => {
    const mp = cloudMatchPlayerRowToLocal({ ...baseMatchPlayerRow, kills: 0, gold_earned: 0, level: 1 });
    expect(mp.kills).toBe(0);
    expect(mp.goldEarned).toBe(0);
    expect(mp.level).toBe(1);
    expect(mp.heroId).toBe(0);
  });

  it('defaults missing hero roles to an empty array', () => {
    expect(cloudMatchPlayerRowToLocal({ ...baseMatchPlayerRow, hero_roles: null }).heroRoles).toEqual([]);
  });

  it('maps round_stats and treats null as no log', () => {
    const row = { ...baseMatchPlayerRow, round_stats: [{ round: 1, kills: 2 }] };
    expect(cloudMatchPlayerRowToLocal(row).roundStats).toEqual([{ round: 1, kills: 2 }]);
    expect(cloudMatchPlayerRowToLocal({ ...row, round_stats: null }).roundStats).toBeUndefined();
    expect(cloudMatchPlayerRowToLocal(baseMatchPlayerRow).roundStats).toBeUndefined();
  });

  it('validates round_stats, dropping malformed entries instead of throwing', () => {
    const mp = cloudMatchPlayerRowToLocal({
      ...baseMatchPlayerRow,
      round_stats: [{ round: 2, deaths: 1, kills: -3 }, { round: 0, kills: 1 }, 'junk', { round: 1, goldEarned: 0 }],
    });
    expect(mp.roundStats).toEqual([{ round: 1, goldEarned: 0 }, { round: 2, deaths: 1 }]);
    expect(cloudMatchPlayerRowToLocal({ ...baseMatchPlayerRow, round_stats: { round: 1, kills: 1 } }).roundStats).toBeUndefined();
    expect(cloudMatchPlayerRowToLocal({ ...baseMatchPlayerRow, round_stats: [] }).roundStats).toBeUndefined();
  });
});

describe('cloudPlayerRowToLocal', () => {
  it('uses local_id as id and normalises nulls', () => {
    const player = cloudPlayerRowToLocal({
      local_id: 'Alice', name: 'Alice', total_games: 3, wins: 2, losses: 1, elo: 1300,
      mu: '26.1', sigma: null, ordinal: null, last_played: null,
      date_created: '2026-01-01T00:00:00.000Z', device_id: null, level: null,
    });
    expect(player.id).toBe('Alice');
    expect(player.mu).toBe(26.1);
    expect(player.sigma).toBeUndefined();
    expect(player.ordinal).toBeUndefined();
    expect(player.deviceId).toBeUndefined();
    expect(player.level).toBeUndefined();
    expect(Number.isNaN(player.lastPlayed.getTime())).toBe(false);
  });

  it('falls back to the name when local_id is missing', () => {
    expect(cloudPlayerRowToLocal({ name: 'Bob' }).id).toBe('Bob');
  });
});

describe('localMatchToCloudRow', () => {
  const match: DBMatch = {
    id: 'match-1',
    date: new Date('2026-09-01T18:30:00.000Z'),
    winningTeam: Team.Titans,
    gameLength: GameLength.Quick,
    doubleLanes: false,
    titanPlayers: 2,
    atlanteanPlayers: 2,
    deviceId: 'device-a',
  };

  it('omits victory_type when the local match has none, so the cloud value is kept', () => {
    const row = localMatchToCloudRow(match, ctx);
    expect('victory_type' in row).toBe(false);
  });

  it('sends victory_type when the local match has one', () => {
    expect(localMatchToCloudRow({ ...match, victoryType: 'kills' }, ctx).victory_type).toBe('kills');
  });

  it('never sends the local edit marker', () => {
    const row = localMatchToCloudRow({ ...match, locallyEditedAt: new Date('2026-10-01T12:00:00.000Z') }, ctx);
    expect(Object.keys(row).sort()).toEqual([
      'atlantean_players', 'date', 'device_id', 'double_lanes', 'game_length', 'id',
      'owner_id', 'sync_source', 'synced_at', 'titan_players', 'winning_team',
    ]);
  });

  it('fills owner, sync metadata and falls back to the current device id', () => {
    const row = localMatchToCloudRow({ ...match, deviceId: undefined }, ctx);
    expect(row).toMatchObject({
      id: 'match-1', owner_id: 'owner-1', winning_team: 'titans', game_length: 'quick',
      double_lanes: false, device_id: 'device-current', sync_source: 'local', synced_at: ctx.syncedAt,
    });
  });
});

describe('localMatchPlayerToCloudRow', () => {
  const mp: DBMatchPlayer = {
    id: 'mp-1', matchId: 'match-1', playerId: 'Alice', team: Team.Atlanteans,
    heroId: 0, heroName: 'Arien', heroRoles: ['Tactician'], kills: 0, deviceId: 'device-a',
  };

  it('keeps tracked zeros and omits untracked stats', () => {
    const row = localMatchPlayerToCloudRow(mp, ctx);
    expect(row.kills).toBe(0);
    expect(row.hero_id).toBe(0);
    expect('deaths' in row).toBe(false);
    expect('gold_earned' in row).toBe(false);
    expect('level' in row).toBe(false);
  });

  it('omits stats stored as null by older versions', () => {
    const legacy = { ...mp, deaths: null } as unknown as DBMatchPlayer;
    expect('deaths' in localMatchPlayerToCloudRow(legacy, ctx)).toBe(false);
  });

  it('sends the round log as round_stats', () => {
    const roundStats = [{ round: 1, kills: 0, deaths: 1 }, { round: 2, kills: 2, level: 3 }];
    expect(localMatchPlayerToCloudRow({ ...mp, roundStats }, ctx).round_stats).toEqual(roundStats);
  });

  it('omits round_stats when there is no log, so the cloud copy is never wiped', () => {
    expect('round_stats' in localMatchPlayerToCloudRow(mp, ctx)).toBe(false);
    const legacy = { ...mp, roundStats: null } as unknown as DBMatchPlayer;
    expect('round_stats' in localMatchPlayerToCloudRow(legacy, ctx)).toBe(false);
  });
});

describe('localPlayerToCloudRow', () => {
  it('maps the player and omits missing rating fields', () => {
    const player: DBPlayer = {
      id: 'Alice', name: 'Alice', totalGames: 1, wins: 1, losses: 0, elo: 1250,
      lastPlayed: new Date('2026-09-01T00:00:00.000Z'), dateCreated: new Date('2026-01-01T00:00:00.000Z'),
    };
    const row = localPlayerToCloudRow(player, ctx);
    expect(row).toMatchObject({ owner_id: 'owner-1', local_id: 'Alice', name: 'Alice', total_games: 1, device_id: 'device-current' });
    expect('mu' in row).toBe(false);
    expect('level' in row).toBe(false);
  });
});
