// src/__tests__/components/RoundLogTable.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoundLogTable from '../../components/matches/RoundLogTable';

describe('RoundLogTable', () => {
  it('renders nothing for matches without a round log', () => {
    const { container } = render(
      <RoundLogTable players={[{ id: 'a', playerName: 'Ann', heroName: 'Arien', team: 'titans' }]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('is collapsed by default and shows each round when opened', () => {
    render(
      <RoundLogTable
        players={[
          { id: 'a', playerName: 'Ann', heroName: 'Arien', team: 'titans', roundStats: [{ round: 1, minionKills: 2 }, { round: 2, minionKills: 0 }] },
          { id: 'b', playerName: 'Cat', heroName: 'Tigerclaw', team: 'atlanteans', roundStats: [{ round: 2, minionKills: 5 }] },
        ]}
      />
    );
    expect(screen.queryByText('Round 1')).toBeNull();
    fireEvent.click(screen.getByText('Round-by-round log'));
    expect(screen.getByText('Round 1')).toBeTruthy();
    expect(screen.getByText('Round 2')).toBeTruthy();
    expect(screen.getByText('Min')).toBeTruthy();
    expect(screen.queryByText('K')).toBeNull();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getAllByText('–')).toHaveLength(1);
  });

  it('renders nothing when the log holds no stat values', () => {
    const { container } = render(
      <RoundLogTable players={[{ id: 'a', playerName: 'Ann', heroName: 'Arien', team: 'titans', roundStats: [{ round: 1 }] }]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('collapses again on a second click without bubbling to the match row', () => {
    let rowClicks = 0;
    render(
      <div onClick={() => rowClicks++}>
        <RoundLogTable players={[{ id: 'a', playerName: 'Ann', heroName: 'Arien', team: 'titans', roundStats: [{ round: 1, kills: 1 }] }]} />
      </div>
    );
    const toggle = screen.getByText('Round-by-round log');
    fireEvent.click(toggle);
    expect(screen.getByText('Round 1')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByText('Round 1')).toBeNull();
    expect(rowClicks).toBe(0);
  });
});
