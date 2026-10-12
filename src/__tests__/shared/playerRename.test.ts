// src/__tests__/shared/playerRename.test.ts
import { describe, it, expect } from 'vitest';
import {
  applyRenamePlan,
  describeRenameError,
  planPlayerRename,
  renamePlayerInPlayerList,
  RenamePlan,
} from '../../shared/utils/playerRename';
import type { DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { Team } from '../../types';

function player(id: string, overrides: Partial<DBPlayer> = {}): DBPlayer {
  return {
    id,
    name: id,
    totalGames: 0,
    wins: 0,
    losses: 0,
    elo: 1200,
    lastPlayed: new Date('2026-09-01T00:00:00Z'),
    dateCreated: new Date('2026-03-01T00:00:00Z'),
    deviceId: 'device-a',
    level: 1,
    ...overrides,
  };
}

function row(id: string, playerId: string, matchId: string, overrides: Partial<DBMatchPlayer> = {}): DBMatchPlayer {
  return {
    id,
    matchId,
    playerId,
    team: Team.Titans,
    heroId: 1,
    heroName: 'Brogan',
    heroRoles: [],
    kills: 2,
    ...overrides,
  };
}

const jhon = player('Jhon', { totalGames: 2, level: 5, dateCreated: new Date('2026-02-01T00:00:00Z') });
const john = player('John', { totalGames: 1, level: 3, dateCreated: new Date('2026-04-01T00:00:00Z') });
const jhonRows = [row('mp-1', 'Jhon', 'm-1'), row('mp-2', 'Jhon', 'm-2', { team: Team.Atlanteans })];

describe('planPlayerRename: validation', () => {
  it('rejects an empty or whitespace name', () => {
    const result = planPlayerRename({ oldId: 'Jhon', newName: '   ', players: [jhon], matchPlayers: jhonRows });
    expect(result).toEqual({ ok: false, error: { code: 'EMPTY_NAME' } });
  });

  it('rejects the unchanged name after trimming', () => {
    const result = planPlayerRename({ oldId: 'Jhon', newName: ' Jhon ', players: [jhon], matchPlayers: jhonRows });
    expect(result).toEqual({ ok: false, error: { code: 'SAME_NAME' } });
  });

  it('rejects an unknown player', () => {
    const result = planPlayerRename({ oldId: 'Ghost', newName: 'John', players: [jhon], matchPlayers: [] });
    expect(result).toEqual({ ok: false, error: { code: 'PLAYER_NOT_FOUND', playerId: 'Ghost' } });
  });

  it('rejects a name held by a record with a different id', () => {
    const odd = player('legacy-id', { name: 'John' });
    const result = planPlayerRename({ oldId: 'Jhon', newName: 'John', players: [jhon, odd], matchPlayers: jhonRows });
    expect(result).toEqual({ ok: false, error: { code: 'NAME_HELD_BY_OTHER_RECORD', name: 'John' } });
  });
});

describe('planPlayerRename: rename', () => {
  it('re-keys the player and every one of their match rows', () => {
    const result = planPlayerRename({ oldId: 'Jhon', newName: '  John ', players: [jhon], matchPlayers: jhonRows });
    if (!result.ok) throw new Error(`unexpected error ${result.error.code}`);

    expect(result.plan.kind).toBe('rename');
    expect(result.plan.oldId).toBe('Jhon');
    expect(result.plan.newId).toBe('John');
    expect(result.plan.player).toEqual({ ...jhon, id: 'John', name: 'John' });
    expect(result.plan.matchPlayers).toEqual([
      { ...jhonRows[0], playerId: 'John' },
      { ...jhonRows[1], playerId: 'John' },
    ]);
    expect(result.plan.matchIds).toEqual(['m-1', 'm-2']);
  });

  it('keeps every stat on the re-keyed rows (no match data lost)', () => {
    const rows = [row('mp-1', 'Jhon', 'm-1', { kills: 0, deaths: 4, goldEarned: 12, level: 6 })];
    const result = planPlayerRename({ oldId: 'Jhon', newName: 'John', players: [jhon], matchPlayers: rows });
    if (!result.ok) throw new Error('expected ok');
    expect(result.plan.matchPlayers[0]).toEqual({ ...rows[0], playerId: 'John' });
  });

  it('allows a case-only change', () => {
    const lower = player('jon');
    const result = planPlayerRename({ oldId: 'jon', newName: 'Jon', players: [lower], matchPlayers: [] });
    expect(result.ok && result.plan.kind).toBe('rename');
  });

  it('ignores rows of unrelated players and does not mutate the input', () => {
    const others = [row('mp-9', 'Alice', 'm-1')];
    const input = { oldId: 'Jhon', newName: 'John', players: [jhon], matchPlayers: [...jhonRows, ...others] };
    const result = planPlayerRename(input);
    if (!result.ok) throw new Error('expected ok');
    expect(result.plan.matchPlayers.map(mp => mp.id)).toEqual(['mp-1', 'mp-2']);
    expect(jhonRows[0].playerId).toBe('Jhon');
  });
});

describe('planPlayerRename: merge', () => {
  it('merges into an existing player when the name is taken', () => {
    const johnRows = [row('mp-3', 'John', 'm-3')];
    const result = planPlayerRename({
      oldId: 'Jhon', newName: 'John', players: [jhon, john], matchPlayers: [...jhonRows, ...johnRows],
    });
    if (!result.ok) throw new Error('expected ok');

    expect(result.plan.kind).toBe('merge');
    expect(result.plan.player.id).toBe('John');
    expect(result.plan.player.level).toBe(5);
    expect(result.plan.player.dateCreated).toEqual(new Date('2026-02-01T00:00:00Z'));
    expect(result.plan.matchPlayers.map(mp => mp.playerId)).toEqual(['John', 'John']);
  });

  it('refuses a merge when both players are in the same match', () => {
    const johnRows = [row('mp-3', 'John', 'm-2', { team: Team.Titans })];
    const result = planPlayerRename({
      oldId: 'Jhon', newName: 'John', players: [jhon, john], matchPlayers: [...jhonRows, ...johnRows],
    });
    expect(result).toEqual({ ok: false, error: { code: 'PLAYERS_SHARE_MATCHES', matchIds: ['m-2'] } });
  });

  it('refuses when orphan rows already use the new name in the same match', () => {
    const orphan = [row('mp-7', 'John', 'm-1')];
    const result = planPlayerRename({ oldId: 'Jhon', newName: 'John', players: [jhon], matchPlayers: [...jhonRows, ...orphan] });
    expect(result.ok).toBe(false);
  });
});

describe('applyRenamePlan', () => {
  it('deletes the old record before writing the new one, then writes every row', () => {
    const ops: string[] = [];
    const store = (name: string) => ({
      put: (value: unknown) => { ops.push(`${name}.put:${(value as { id: string }).id}`); },
      delete: (key: string) => { ops.push(`${name}.delete:${key}`); },
    });
    const plan: RenamePlan = {
      kind: 'rename', oldId: 'Jhon', newId: 'John',
      player: { ...jhon, id: 'John', name: 'John' },
      matchPlayers: jhonRows.map(mp => ({ ...mp, playerId: 'John' })),
      matchIds: ['m-1', 'm-2'],
    };

    applyRenamePlan(plan, { players: store('players'), matchPlayers: store('matchPlayers') });

    expect(ops).toEqual([
      'players.delete:Jhon',
      'players.put:John',
      'matchPlayers.put:mp-1',
      'matchPlayers.put:mp-2',
    ]);
  });
});

describe('renamePlayerInPlayerList', () => {
  it('renames exact name matches and returns a new array', () => {
    const list = [{ id: 1, name: 'Jhon' }, { id: 2, name: 'Alice' }];
    expect(renamePlayerInPlayerList(list, 'Jhon', 'John')).toEqual([{ id: 1, name: 'John' }, { id: 2, name: 'Alice' }]);
    expect(list[0].name).toBe('Jhon');
  });

  it('returns null when nobody has the old name', () => {
    expect(renamePlayerInPlayerList([{ name: 'Alice' }], 'Jhon', 'John')).toBeNull();
  });
});

describe('describeRenameError', () => {
  it('explains a refused merge', () => {
    expect(describeRenameError({ code: 'PLAYERS_SHARE_MATCHES', matchIds: ['a', 'b'] }))
      .toBe("Can't merge: both players are in 2 of the same matches.");
  });
});
