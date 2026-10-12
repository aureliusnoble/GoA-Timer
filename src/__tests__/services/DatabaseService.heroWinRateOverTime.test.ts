import { describe, it, expect, vi, afterEach } from 'vitest';
import { dbService, DBMatch, DBMatchPlayer } from '../../services/DatabaseService';
import { Team, GameLength } from '../../types';
import { withTimeZone } from '../helpers/timeZone';

function makeMatch(id: string, date: Date): DBMatch {
  return {
    id,
    date,
    winningTeam: Team.Titans,
    gameLength: GameLength.Quick,
    doubleLanes: false,
    titanPlayers: 1,
    atlanteanPlayers: 1,
    victoryType: 'throne',
  };
}

function makeMatchPlayer(matchId: string, team: Team): DBMatchPlayer {
  return {
    id: `${matchId}-p`,
    matchId,
    playerId: `p-${matchId}`,
    team,
    heroId: 7,
    heroName: 'Brogan',
    heroRoles: ['Durable'],
  };
}

function stubData(matches: DBMatch[], matchPlayers: DBMatchPlayer[]) {
  vi.spyOn(dbService, 'getAllMatches').mockResolvedValue(matches);
  vi.spyOn(
    dbService as unknown as { getAllMatchPlayers: () => Promise<DBMatchPlayer[]> },
    'getAllMatchPlayers'
  ).mockResolvedValue(matchPlayers);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getHeroWinRateOverTime groups matches by local calendar day', () => {
  describe('in America/New_York', () => {
    withTimeZone('America/New_York');

    it('puts a morning and a late-evening match of Oct 12 on the same day', async () => {
      stubData(
        [makeMatch('a', new Date(2026, 9, 12, 10, 0)), makeMatch('b', new Date(2026, 9, 12, 22, 30))],
        [makeMatchPlayer('a', Team.Titans), makeMatchPlayer('b', Team.Atlanteans)]
      );
      const result = await dbService.getHeroWinRateOverTime(undefined, 1);
      expect(result.heroes).toHaveLength(1);
      expect(result.heroes[0].dataPoints).toEqual([
        { date: '2026-10-12', gamesPlayedTotal: 2, winsTotal: 1, winRate: 50, gamesPlayedOnDate: 2 },
      ]);
      expect(result.dateRange).toEqual({ firstMatch: '2026-10-12', lastMatch: '2026-10-12' });
    });
  });

  describe('in Pacific/Auckland', () => {
    withTimeZone('Pacific/Auckland');

    it('keeps an early-morning match on its own local day', async () => {
      stubData(
        [makeMatch('a', new Date(2026, 9, 11, 21, 0)), makeMatch('b', new Date(2026, 9, 12, 0, 30))],
        [makeMatchPlayer('a', Team.Titans), makeMatchPlayer('b', Team.Titans)]
      );
      const result = await dbService.getHeroWinRateOverTime(undefined, 1);
      expect(result.heroes[0].dataPoints.map((point) => point.date)).toEqual(['2026-10-11', '2026-10-12']);
    });
  });
});
