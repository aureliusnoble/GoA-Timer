// src/__tests__/components/DetailedPlayerStats.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetailedPlayerStats from '../../components/matches/DetailedPlayerStats';
import { NO_HERO_ID } from '../../shared/utils/heroIds';

// ── Test harness ────────────────────────────────────────────────────────────
// `mocks.state` is reset before each test; tests mutate it to shape the data the
// mocked useDataSource returns. Child sections are replaced by stubs that expose
// their props as JSON in a data-props attribute.
const mocks = vi.hoisted(() => {
  const player = {
    id: 'Alice',
    name: 'Alice',
    totalGames: 4,
    wins: 3,
    losses: 1,
    elo: 1200,
    mu: 25,
    sigma: 8.333,
    ordinal: 0,
    lastPlayed: new Date(2026, 0, 4),
    dateCreated: new Date(2025, 0, 1),
  };
  const state = {
    matchesPlayed: [] as Array<Record<string, unknown>>,
    playerStatsFilters: null as null | Record<string, unknown>,
    ratingTable: {
      ratings: { Alice: 1300, Bob: 1250 } as Record<string, number>,
      ranks: { Alice: 1, Bob: 2 } as Record<string, number>,
      isRecalculated: false,
    },
  };
  const dataSource = {
    isViewModeLoading: false,
    getPlayer: async () => player,
    getPlayerStats: async () => ({ matchesPlayed: state.matchesPlayed }),
    getAllMatches: async () => [],
    getAllPlayers: async () => [player],
    getCurrentTrueSkillRatings: async () => state.ratingTable.ratings,
    getPlayerRatingTable: vi.fn(async (_options?: unknown) => state.ratingTable),
  };
  return { player, state, dataSource };
});

vi.mock('../../hooks/useDataSource', () => ({ useDataSource: () => mocks.dataSource }));
vi.mock('../../context/StatsFilterContext', () => ({
  useStatsFilter: () => ({ playerStatsFilters: mocks.state.playerStatsFilters, setPlayerStatsFilters: () => {} }),
}));
vi.mock('../../context/SoundContext', () => ({ useSound: () => ({ playSound: () => {} }) }));

function stub(testId: string) {
  return async () => {
    const React = await import('react');
    return {
      default: (props: Record<string, unknown>) =>
        React.createElement('div', { 'data-testid': testId, 'data-props': JSON.stringify(props) }),
    };
  };
}
vi.mock('../../components/matches/DetailedPlayerStats/SkillProgression', stub('skill-progression'));
vi.mock('../../components/matches/DetailedPlayerStats/RelationshipStats', stub('relationship-stats'));
vi.mock('../../components/matches/DetailedPlayerStats/HeroPerformance', stub('hero-performance'));
vi.mock('../../components/matches/DetailedPlayerStats/MatchHistory', stub('match-history'));

async function propsOf(testId: string): Promise<Record<string, any>> {
  return JSON.parse((await screen.findByTestId(testId)).getAttribute('data-props') || '{}');
}

function matchRow(matchId: string, heroId: number, heroName: string, extra: Record<string, unknown> = {}) {
  return { matchId, heroId, heroName, heroRoles: ['Support'], team: 'titans', won: true, date: new Date(2026, 0, 1), ...extra };
}

beforeEach(() => {
  localStorage.clear();
  mocks.state.matchesPlayed = [];
  mocks.state.playerStatsFilters = null;
  mocks.state.ratingTable = {
    ratings: { Alice: 1300, Bob: 1250 },
    ranks: { Alice: 1, Bob: 2 },
    isRecalculated: false,
  };
});

describe('DetailedPlayerStats heroes', () => {
  it('counts Arien (hero id 0) and skips matches without a hero', async () => {
    mocks.state.matchesPlayed = [
      matchRow('m1', 0, 'Arien'),
      matchRow('m2', 0, 'Arien'),
      matchRow('m3', 1, 'Brogan'),
      matchRow('m4', NO_HERO_ID, 'Unknown Hero', { heroRoles: [] }),
    ];
    render(<DetailedPlayerStats playerId="Alice" onBack={() => {}} />);

    const heroProps = await propsOf('hero-performance');
    expect(heroProps.favoriteHeroes).toEqual([
      { heroId: 0, heroName: 'Arien', count: 2 },
      { heroId: 1, heroName: 'Brogan', count: 1 },
    ]);
    expect(screen.getByText('Heroes Played').previousElementSibling?.textContent).toBe('2');
  });
});

describe('DetailedPlayerStats combat averages', () => {
  it('averages each stat over the games where it was tracked (null = untracked, 0 = tracked)', async () => {
    mocks.state.matchesPlayed = [
      matchRow('m1', 0, 'Arien', { kills: 3, deaths: 0, goldEarned: 10 }),
      matchRow('m2', 1, 'Brogan', { kills: 0, deaths: 2, goldEarned: null }),
      matchRow('m3', 2, 'Tigerclaw', { kills: null, deaths: null }),
    ];
    render(<DetailedPlayerStats playerId="Alice" onBack={() => {}} />);

    expect(await screen.findByText('1.5 (2 games)')).toBeTruthy(); // kills: 3 / 2 tracked games
    expect(screen.getByText('per game · 1 of 3 games')).toBeTruthy(); // gold tracked once
  });
});

describe('DetailedPlayerStats rating header', () => {
  it('shows the rating and rank from the date-ordered rating table', async () => {
    mocks.state.ratingTable = { ratings: { Alice: 1234, Bob: 1300 }, ranks: { Bob: 1, Alice: 2 }, isRecalculated: false };
    render(<DetailedPlayerStats playerId="Alice" onBack={() => {}} />);

    expect(await screen.findByText('1234')).toBeTruthy();
    expect(screen.getByText('Rank #2')).toBeTruthy();
    expect(screen.queryByText('Recalculated for the selected filters')).toBeNull();
  });

  it('passes the active filters to the rating table and labels a recalculated rating', async () => {
    mocks.state.playerStatsFilters = {
      recencyMonths: 3,
      minGamesRelationship: 3,
      recalculateTrueSkill: true,
      dateRange: {},
      gameLengthFilter: 'long',
      playerCountFilter: 6,
    };
    mocks.state.ratingTable = { ratings: { Alice: 1111 }, ranks: { Alice: 1 }, isRecalculated: true };
    render(<DetailedPlayerStats playerId="Alice" onBack={() => {}} />);

    expect(await screen.findByText('1111')).toBeTruthy();
    expect(screen.getByText('Recalculated for the selected filters')).toBeTruthy();
    const options = mocks.dataSource.getPlayerRatingTable.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(options).toMatchObject({ gameLengthFilter: 'long', playerCountFilter: 6, recalculate: true });
    expect(options.startDate).toBeInstanceOf(Date);
  });

  it('shows "Unranked" when the player has no rank in the filtered set', async () => {
    mocks.state.ratingTable = { ratings: { Alice: 1200 }, ranks: {}, isRecalculated: false };
    render(<DetailedPlayerStats playerId="Alice" onBack={() => {}} />);
    expect(await screen.findByText('Unranked')).toBeTruthy();
  });
});
