// src/__tests__/components/MatchPlayerStatLine.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MatchPlayerStatLine from '../../components/matches/MatchPlayerStatLine';
import { getTrackedStatKeys } from '../../shared/utils/matchStatDisplay';

describe('MatchPlayerStatLine', () => {
  it('shows minion kills and level, a tracked zero as 0 and a missing value as an en dash', () => {
    const players = [
      { kills: 0, deaths: 2, minionKills: 0, level: 4 },
      { kills: 1, deaths: undefined, minionKills: 7, level: 5 },
    ];
    const statKeys = getTrackedStatKeys(players);
    render(<MatchPlayerStatLine player={players[0]} statKeys={statKeys} />);

    expect(screen.getByLabelText('Kills: 0')).toBeTruthy();
    expect(screen.getByLabelText('Deaths: 2')).toBeTruthy();
    expect(screen.getByLabelText('Minion kills: 0')).toBeTruthy();
    expect(screen.getByLabelText('Level: 4')).toBeTruthy();
    expect(screen.queryByLabelText(/^Gold/)).toBeNull();
    expect(screen.queryByLabelText(/^Assists/)).toBeNull();
  });

  it('shows an en dash for a stat this player lacks but another player tracked', () => {
    render(<MatchPlayerStatLine player={{ kills: 1 }} statKeys={['kills', 'deaths']} />);
    expect(screen.getByLabelText('Deaths: –')).toBeTruthy();
  });

  it('renders nothing when no stat was tracked in the match', () => {
    const { container } = render(<MatchPlayerStatLine player={{}} statKeys={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
