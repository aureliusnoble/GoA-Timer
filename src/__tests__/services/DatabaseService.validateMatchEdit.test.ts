// src/__tests__/services/DatabaseService.validateMatchEdit.test.ts
import { describe, it, expect, vi } from 'vitest';
import dbService, { DBMatch, DBMatchPlayer } from '../../services/DatabaseService';
import { Team, GameLength } from '../../types';
import { NO_HERO_ID } from '../../shared/utils/heroIds';

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

const match: DBMatch = {
  id: 'm1',
  date: new Date(),
  winningTeam: Team.Titans,
  gameLength: GameLength.Quick,
  doubleLanes: false,
  titanPlayers: 2,
  atlanteanPlayers: 2,
};

function mp(playerId: string, team: Team, heroId: number): DBMatchPlayer {
  return { id: `m1-${playerId}`, matchId: 'm1', playerId, team, heroId, heroName: `Hero ${heroId}`, heroRoles: [] };
}

describe('validateMatchEdit hero duplicates', () => {
  it('allows several players without a hero (NO_HERO_ID)', () => {
    const result = dbService.validateMatchEdit(match, [
      mp('a', Team.Titans, NO_HERO_ID),
      mp('b', Team.Titans, 0),
      mp('c', Team.Atlanteans, NO_HERO_ID),
      mp('d', Team.Atlanteans, 1),
    ]);
    expect(result.errors.filter(e => e.field === 'hero')).toEqual([]);
  });

  it('still rejects the same real hero (including Arien, id 0) on two players', () => {
    const result = dbService.validateMatchEdit(match, [
      mp('a', Team.Titans, 0),
      mp('b', Team.Titans, 2),
      mp('c', Team.Atlanteans, 0),
      mp('d', Team.Atlanteans, 1),
    ]);
    expect(result.errors.filter(e => e.field === 'hero')).toHaveLength(1);
  });
});
