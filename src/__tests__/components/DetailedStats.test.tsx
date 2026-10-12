// src/__tests__/components/DetailedStats.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetailedStats from '../../components/matches/DetailedPlayerStats/DetailedStats';
import { summarizePlayerStats } from '../../shared/utils/trackedStats';

describe('DetailedStats', () => {
  it('shows per-stat averages with their tracked-game counts', () => {
    const summary = summarizePlayerStats([
      { kills: 4, deaths: 1, assists: 2, goldEarned: 12, minionKills: 5, level: 6 },
      { kills: 0, deaths: 1, assists: 0, goldEarned: 8 },
      {},
    ]);
    render(<DetailedStats summary={summary} totalGames={3} />);

    expect(screen.getByText('4/2/2')).toBeTruthy();
    expect(screen.getByText('tracked in 2 of 3 games')).toBeTruthy();
    // Gold: (12 + 8) / 2 tracked games = 10, not 20 / 3
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('per game · 2 of 3 games')).toBeTruthy();
    // Minions and level were tracked in one game only
    expect(screen.getByText('5.0')).toBeTruthy();
    expect(screen.getByText('per game · 1 of 3 games')).toBeTruthy();
    expect(screen.getByText('6.0')).toBeTruthy();
    expect(screen.getByText('end of game · 1 of 3 games')).toBeTruthy();
    expect(screen.getByText('2.0 (2 games)')).toBeTruthy(); // kills per game
  });

  it('shows the section for tracked all-zero stats instead of "No Combat Data"', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ kills: 0, deaths: 0, assists: 0 }])} totalGames={1} />);
    expect(screen.queryByText('No Combat Data Available')).toBeNull();
    expect(screen.getByText('0/0/0')).toBeTruthy();
  });

  it('shows N/A for stats that were never tracked', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ kills: 1, deaths: 0, assists: 0 }])} totalGames={1} />);
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(3); // level, gold, minions
  });

  it('shows the empty state when nothing was tracked', () => {
    render(<DetailedStats summary={summarizePlayerStats([{}, {}])} totalGames={2} />);
    expect(screen.getByText('No Combat Data Available')).toBeTruthy();
  });
});
