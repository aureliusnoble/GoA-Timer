// src/__tests__/services/matchEditValidation.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { DBMatch, DBMatchPlayer } from '../../services/DatabaseService';
import { GameLength, Team } from '../../types';

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

import dbService from '../../services/DatabaseService';

const match: DBMatch = {
  id: 'match-1',
  date: new Date(),
  winningTeam: Team.Titans,
  gameLength: GameLength.Quick,
  doubleLanes: false,
  titanPlayers: 1,
  atlanteanPlayers: 1,
};

function player(overrides: Partial<DBMatchPlayer>): DBMatchPlayer {
  return {
    id: 'mp-1',
    matchId: 'match-1',
    playerId: 'Alice',
    team: Team.Titans,
    heroId: 1,
    heroName: 'Brogan',
    heroRoles: [],
    ...overrides,
  };
}

const opponent = player({ id: 'mp-2', playerId: 'Bob', team: Team.Atlanteans, heroId: 2, heroName: 'Tigerclaw' });

/** Simulates values that arrived as SQL NULL from the cloud before normalisation existed. */
function withNulls(base: DBMatchPlayer, fields: (keyof DBMatchPlayer)[]): DBMatchPlayer {
  const copy: Record<string, unknown> = { ...base };
  fields.forEach(field => { copy[field] = null; });
  return copy as unknown as DBMatchPlayer;
}

describe('validateMatchEdit', () => {
  it('accepts a null level and null stats (not tracked)', () => {
    const alice = withNulls(player({}), ['level', 'kills', 'deaths', 'assists', 'goldEarned', 'minionKills']);
    const result = dbService.validateMatchEdit(match, [alice, opponent]);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('accepts levels 1 and 8', () => {
    const result = dbService.validateMatchEdit(match, [player({ level: 1 }), { ...opponent, level: 8 }]);
    expect(result.isValid).toBe(true);
  });

  it('rejects level 9 and names the player', () => {
    const result = dbService.validateMatchEdit(match, [player({ level: 9 }), opponent]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      field: 'level',
      playerId: 'Alice',
      message: 'Level for Alice must be between 1 and 8',
    }));
  });

  it('still rejects negative stats', () => {
    const result = dbService.validateMatchEdit(match, [player({ kills: -1 }), opponent]);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'kills', playerId: 'Alice' }));
  });
});
