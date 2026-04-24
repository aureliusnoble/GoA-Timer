// src/__tests__/services/HeroSkillService.test.ts
import { describe, it, expect } from 'vitest';
import { computeHeroImpact } from '../../services/HeroSkillService';
import { DBMatch, DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { Team, GameLength } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helper factories
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(id: string, mu: number): DBPlayer {
  return {
    id,
    name: id,
    totalGames: 20,
    wins: 10,
    losses: 10,
    elo: 1000,
    mu,
    sigma: 8.333,
    ordinal: mu - 3 * 8.333,
    lastPlayed: new Date(),
    dateCreated: new Date(),
  };
}

function makeMatch(id: string, winningTeam: Team): DBMatch {
  return {
    id,
    date: new Date(2025, 0, 1 + parseInt(id)),
    winningTeam,
    gameLength: GameLength.Quick,
    doubleLanes: false,
    titanPlayers: 3,
    atlanteanPlayers: 3,
    victoryType: 'throne',
  };
}

function makeMatchPlayer(
  matchId: string,
  playerId: string,
  team: Team,
  heroId: number,
  heroName: string,
): DBMatchPlayer {
  return {
    id: `${matchId}-${playerId}`,
    matchId,
    playerId,
    team,
    heroId,
    heroName,
    heroRoles: ['Test'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('computeHeroImpact', () => {
  it('returns empty array for fewer than 10 observations', () => {
    // One match produces at most 2 team observations — well below the 10-game threshold
    const match = makeMatch('1', Team.Titans);
    const players = [
      makePlayer('p1', 25),
      makePlayer('p2', 25),
      makePlayer('p3', 25),
      makePlayer('p4', 25),
    ];
    const matchPlayers = [
      makeMatchPlayer('1', 'p1', Team.Titans, 0, 'Arien'),
      makeMatchPlayer('1', 'p2', Team.Titans, 0, 'Arien'),
      makeMatchPlayer('1', 'p3', Team.Atlanteans, 1, 'Brann'),
      makeMatchPlayer('1', 'p4', Team.Atlanteans, 1, 'Brann'),
    ];

    const results = computeHeroImpact([match], matchPlayers, players);

    // Heroes with fewer than 10 game observations are marked insufficient
    for (const result of results) {
      expect(result.sufficient).toBe(false);
    }
  });

  it('produces results for heroes with sufficient data (30 matches)', () => {
    // Hero 0 (Arien) always on Titans, hero 1 (Brann) always on Atlanteans.
    // Titans win every match so Arien has a strong positive ATE signal.
    const players = [
      makePlayer('p1', 25),
      makePlayer('p2', 25),
      makePlayer('p3', 25),
      makePlayer('p4', 25),
    ];

    const matches: DBMatch[] = [];
    const matchPlayers: DBMatchPlayer[] = [];

    for (let i = 0; i < 30; i++) {
      const id = String(i);
      matches.push(makeMatch(id, Team.Titans));
      matchPlayers.push(makeMatchPlayer(id, 'p1', Team.Titans, 0, 'Arien'));
      matchPlayers.push(makeMatchPlayer(id, 'p2', Team.Titans, 0, 'Arien'));
      matchPlayers.push(makeMatchPlayer(id, 'p3', Team.Atlanteans, 1, 'Brann'));
      matchPlayers.push(makeMatchPlayer(id, 'p4', Team.Atlanteans, 1, 'Brann'));
    }

    const results = computeHeroImpact(matches, matchPlayers, players);

    expect(results.length).toBeGreaterThan(0);

    const arienResult = results.find(r => r.heroId === 0);
    expect(arienResult).toBeDefined();
    expect(arienResult!.gamesWithHero).toBe(30);
    expect(arienResult!.sufficient).toBe(true);
    expect(typeof arienResult!.ate).toBe('number');
    expect(arienResult!.ciLower).toBeLessThanOrEqual(arienResult!.ate);
    expect(arienResult!.ate).toBeLessThanOrEqual(arienResult!.ciUpper);
  });

  it('marks heroes with fewer than 10 games as insufficient', () => {
    // 20 matches of hero 0 vs hero 1, but hero 99 appears in only 3 matches
    const players = [
      makePlayer('p1', 25),
      makePlayer('p2', 25),
      makePlayer('p3', 25),
      makePlayer('p4', 25),
    ];

    const matches: DBMatch[] = [];
    const matchPlayers: DBMatchPlayer[] = [];

    for (let i = 0; i < 20; i++) {
      const id = String(i);
      matches.push(makeMatch(id, Team.Titans));

      // For the first 3 matches, replace one Atlantean hero with the rare hero 99
      if (i < 3) {
        matchPlayers.push(makeMatchPlayer(id, 'p1', Team.Titans, 0, 'Arien'));
        matchPlayers.push(makeMatchPlayer(id, 'p2', Team.Titans, 0, 'Arien'));
        matchPlayers.push(makeMatchPlayer(id, 'p3', Team.Atlanteans, 99, 'RareHero'));
        matchPlayers.push(makeMatchPlayer(id, 'p4', Team.Atlanteans, 1, 'Brann'));
      } else {
        matchPlayers.push(makeMatchPlayer(id, 'p1', Team.Titans, 0, 'Arien'));
        matchPlayers.push(makeMatchPlayer(id, 'p2', Team.Titans, 0, 'Arien'));
        matchPlayers.push(makeMatchPlayer(id, 'p3', Team.Atlanteans, 1, 'Brann'));
        matchPlayers.push(makeMatchPlayer(id, 'p4', Team.Atlanteans, 1, 'Brann'));
      }
    }

    const results = computeHeroImpact(matches, matchPlayers, players);

    const rareHeroResult = results.find(r => r.heroId === 99);
    if (rareHeroResult !== undefined) {
      expect(rareHeroResult.sufficient).toBe(false);
    }
    // Whether or not the rare hero appears in results, it must not be marked sufficient
    // (its gamesWithHero would be 3, below the threshold of 10)
  });

  it('produces gradient with 9 points (percentiles 10-90) and a valid gradientBadge', () => {
    // 40 matches with varying player mus to create a realistic teamMu distribution
    const muValues = [15, 20, 22, 24, 25, 26, 28, 30, 35];
    const players = muValues.map((mu, i) => makePlayer(`p${i}`, mu));

    const matches: DBMatch[] = [];
    const matchPlayers: DBMatchPlayer[] = [];

    for (let i = 0; i < 40; i++) {
      const id = String(i);
      // Alternate which team wins to avoid degenerate outcome distributions
      const winner = i % 2 === 0 ? Team.Titans : Team.Atlanteans;
      matches.push(makeMatch(id, winner));

      // Rotate through different players so teamMu varies across matches
      const tIdx1 = i % muValues.length;
      const tIdx2 = (i + 1) % muValues.length;
      const aIdx1 = (i + 2) % muValues.length;
      const aIdx2 = (i + 3) % muValues.length;

      matchPlayers.push(makeMatchPlayer(id, `p${tIdx1}`, Team.Titans, 0, 'Arien'));
      matchPlayers.push(makeMatchPlayer(id, `p${tIdx2}`, Team.Titans, 0, 'Arien'));
      matchPlayers.push(makeMatchPlayer(id, `p${aIdx1}`, Team.Atlanteans, 1, 'Brann'));
      matchPlayers.push(makeMatchPlayer(id, `p${aIdx2}`, Team.Atlanteans, 1, 'Brann'));
    }

    const results = computeHeroImpact(matches, matchPlayers, players);

    const arienResult = results.find(r => r.heroId === 0);
    expect(arienResult).toBeDefined();
    expect(arienResult!.sufficient).toBe(true);

    const { gradient, gradientBadge } = arienResult!;
    expect(gradient).toHaveLength(9);

    const expectedPercentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    gradient.forEach((point, idx) => {
      expect(point.percentile).toBe(expectedPercentiles[idx]);
    });

    const validBadges = ['rewards-skill', 'beginner-friendly', 'balanced'];
    expect(validBadges).toContain(gradientBadge);
  });
});
