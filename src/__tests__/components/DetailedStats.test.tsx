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
    // Kill participation: 2.0 kills + 1.0 assists per game, both tracked in 2 games
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getByText('(K+A) per game · 2 of 3 games')).toBeTruthy();
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

describe('DetailedStats for stats that were never tracked', () => {
  /** The value shown in the stat card whose label is `label`. */
  function cardValue(label: string): string | null | undefined {
    return screen.getByText(label).parentElement?.nextElementSibling?.textContent;
  }
  /** The value shown in the performance row whose label is `label`. */
  function rowValue(label: string): string | null | undefined {
    return screen.getByText(label).nextElementSibling?.textContent;
  }

  it('shows N/A instead of "Perfect" for K/D when deaths were never tracked', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ kills: 3 }])} totalGames={1} />);
    expect(cardValue('Total K/D/A')).toBe('3/N/A/N/A');
    expect(cardValue('K/D Ratio')).toBe('N/A');
    expect(screen.queryByText('Perfect')).toBeNull();
    expect(rowValue('Kills per Game')).toBe('3.0 (1 games)');
    expect(rowValue('Deaths per Game')).toBe('N/A');
    expect(rowValue('Assists per Game')).toBe('N/A');
    expect(cardValue('Kill Participation')).toBe('N/A');
  });

  it('shows N/A for K/D/A, K/D and per-game combat stats when only the level was tracked', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ level: 4 }, {}])} totalGames={2} />);
    expect(screen.queryByText('No Combat Data Available')).toBeNull();
    expect(cardValue('Avg Level')).toBe('4.0');
    expect(cardValue('Total K/D/A')).toBe('N/A');
    expect(cardValue('K/D Ratio')).toBe('N/A');
    expect(screen.queryByText('Perfect')).toBeNull();
    expect(rowValue('Kills per Game')).toBe('N/A');
    expect(rowValue('Deaths per Game')).toBe('N/A');
    expect(rowValue('Assists per Game')).toBe('N/A');
    expect(cardValue('Kill Participation')).toBe('N/A');
  });

  it('does not call a tracked 0 kills / 0 deaths record "Perfect"', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ kills: 0, deaths: 0, assists: 0 }])} totalGames={1} />);
    expect(cardValue('K/D Ratio')).toBe('0.00');
    expect(screen.queryByText('Perfect')).toBeNull();
    expect(screen.getByText('kill/death ratio')).toBeTruthy();
  });

  it('calls tracked kills with tracked zero deaths "Perfect"', () => {
    render(<DetailedStats summary={summarizePlayerStats([{ kills: 3, deaths: 0, assists: 1 }])} totalGames={1} />);
    expect(cardValue('K/D Ratio')).toBe('3.00');
    expect(screen.getByText('Perfect')).toBeTruthy();
  });
});
