// src/__tests__/hooks/calculateHeroStats.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateHeroStats } from '../../hooks/useDataSource';
import { DBMatch, DBMatchPlayer } from '../../services/DatabaseService';
import { Team, GameLength } from '../../types';
import { NO_HERO_ID } from '../../shared/utils/heroIds';

vi.mock('../../services/supabase/SupabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
}));

const match: DBMatch = {
  id: 'm1',
  date: new Date(2026, 0, 1),
  winningTeam: Team.Titans,
  gameLength: GameLength.Quick,
  doubleLanes: false,
  titanPlayers: 2,
  atlanteanPlayers: 2,
};

function mp(playerId: string, team: Team, heroId: number, heroName: string): DBMatchPlayer {
  return { id: `m1-${playerId}`, matchId: 'm1', playerId, team, heroId, heroName, heroRoles: [] };
}

describe('calculateHeroStats', () => {
  it('includes Arien (id 0) and leaves out players without a hero', () => {
    const stats = calculateHeroStats(
      [
        mp('a', Team.Titans, 0, 'Arien'),
        mp('b', Team.Titans, NO_HERO_ID, 'Unknown Hero'),
        mp('c', Team.Atlanteans, 1, 'Brogan'),
        mp('d', Team.Atlanteans, NO_HERO_ID, 'Unknown Hero'),
      ],
      [match]
    );

    expect(stats.map(s => s.heroId).sort()).toEqual([0, 1]);
    const arien = stats.find(s => s.heroId === 0)!;
    expect(arien.wins).toBe(1);
    expect(arien.bestAgainst.map(r => r.heroId)).toEqual([1]);
  });
});
