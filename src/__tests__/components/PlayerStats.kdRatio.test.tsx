// src/__tests__/components/PlayerStats.kdRatio.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerStats from '../../components/matches/PlayerStats';

const mocks = vi.hoisted(() => {
  const ratings: Record<string, number> = { Ana: 1500, Ben: 1400, Cleo: 1300 };
  const player = (id: string) => ({
    id,
    name: id,
    totalGames: 1,
    wins: 1,
    losses: 0,
    elo: 1200,
    mu: 25,
    sigma: 8.333,
    ordinal: 0,
    lastPlayed: new Date(2026, 0, 1),
    dateCreated: new Date(2025, 0, 1),
  });
  const matchPlayer = (playerId: string, stats: Record<string, number>) => ({
    id: `m1-${playerId}`,
    matchId: 'm1',
    playerId,
    team: 'titans',
    heroId: 1,
    heroName: 'Brogan',
    heroRoles: ['Guardian'],
    ...stats,
  });
  const dataSource = {
    isViewMode: false,
    isViewModeLoading: false,
    getAllPlayers: async () => [player('Ana'), player('Ben'), player('Cleo')],
    getAllMatchPlayers: async () => [
      matchPlayer('Ana', { kills: 4 }), // deaths never tracked -> no K/D ratio
      matchPlayer('Ben', { kills: 2, deaths: 1 }), // K/D 2
      matchPlayer('Cleo', { kills: 1, deaths: 2 }), // K/D 0.5
    ],
    getAllMatches: async () => [],
    getFilteredPlayerStats: async () => ({ players: [], dateRange: null }),
  };
  const statsFilter = { setPlayerStatsFilters: () => {} };
  return { ratings, dataSource, statsFilter };
});

vi.mock('../../hooks/useDataSource', () => ({ useDataSource: () => mocks.dataSource }));
vi.mock('../../context/StatsFilterContext', () => ({ useStatsFilter: () => mocks.statsFilter }));
vi.mock('../../context/SoundContext', () => ({ useSound: () => ({ playSound: () => {} }) }));
vi.mock('../../services/DatabaseService', () => ({
  default: { getCurrentTrueSkillRatings: async () => ({}) },
  getDisplayRating: (player: { id: string }) => mocks.ratings[player.id],
}));
vi.mock('../../components/matches/PlayerRelationshipGraph', () => ({ default: () => null }));

const NAMES = ['Ana', 'Ben', 'Cleo'];

/** Player names in card order. */
function cardOrder(): string[] {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map(h => h.textContent ?? '')
    .filter(name => NAMES.includes(name));
}

/** KD Ratio values in card order. */
function kdValues(): Array<string | null | undefined> {
  return screen.getAllByText('KD Ratio').map(label => label.parentElement?.nextElementSibling?.textContent);
}

beforeEach(() => {
  localStorage.clear();
});

describe('PlayerStats K/D ratio when deaths were never tracked', () => {
  it('shows N/A and sorts the player as the lowest K/D', async () => {
    render(<PlayerStats onBack={() => {}} onViewSkillOverTime={() => {}} onViewPlayerDetails={() => {}} />);
    await screen.findByText('Ana');
    expect(cardOrder()).toEqual(['Ana', 'Ben', 'Cleo']); // default: by skill

    fireEvent.click(screen.getByRole('button', { name: /^KD/ }));
    expect(cardOrder()).toEqual(['Ben', 'Cleo', 'Ana']); // descending: untracked last
    expect(kdValues()).toEqual(['2', '0.5', 'N/A']);

    fireEvent.click(screen.getByRole('button', { name: /^KD/ }));
    expect(cardOrder()).toEqual(['Ana', 'Cleo', 'Ben']); // ascending: untracked is the lowest
  });
});
