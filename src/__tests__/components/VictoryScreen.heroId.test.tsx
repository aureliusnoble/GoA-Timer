// src/__tests__/components/VictoryScreen.heroId.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VictoryScreen from '../../components/VictoryScreen';
import { Team, GameLength, Player } from '../../types';
import { heroes } from '../../data/heroes';
import { NO_HERO_ID } from '../../shared/utils/heroIds';
import { createEmptyStatLog } from '../../shared/utils/gameStatLog';
import { defaultStatTrackingSettings } from '../../shared/utils/statTrackingSettings';

const mocks = vi.hoisted(() => ({ recordMatch: vi.fn() }));

vi.mock('../../services/DatabaseService', () => ({
  default: { recordMatch: mocks.recordMatch },
}));
vi.mock('../../context/SoundContext', () => ({
  useSound: () => ({ playSound: () => {} }),
}));

describe('VictoryScreen hero ids', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.recordMatch.mockReset();
    mocks.recordMatch.mockResolvedValue('match-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves Arien as hero 0 and a player without a hero as NO_HERO_ID', async () => {
    const arien = heroes.find(h => h.id === 0)!;
    const players: Player[] = [
      { id: 1, team: Team.Titans, hero: arien, name: 'Alice' },
      { id: 2, team: Team.Atlanteans, hero: null, name: 'Bob' },
    ];

    render(
      <VictoryScreen
        winningTeam={Team.Titans}
        onReturnToSetup={() => {}}
        players={players}
        gameLength={GameLength.Quick}
        doubleLanes={false}
        statLog={createEmptyStatLog()}
        finalRound={1}
        finalRoundReviewed={false}
        statTrackingActive={false}
        trackingSettings={defaultStatTrackingSettings()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000); // victory animation
    });
    fireEvent.click(screen.getByTitle('Wave pushed into enemy Throne'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save Match Data'));
    });

    expect(mocks.recordMatch).toHaveBeenCalledTimes(1);
    const playerData = mocks.recordMatch.mock.calls[0][1];
    expect(playerData[0]).toMatchObject({ id: 'Alice', heroId: 0, heroName: 'Arien' });
    expect(playerData[1]).toMatchObject({ id: 'Bob', heroId: NO_HERO_ID, heroName: 'Unknown Hero' });
  });
});
