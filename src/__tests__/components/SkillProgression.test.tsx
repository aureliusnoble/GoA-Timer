// src/__tests__/components/SkillProgression.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkillProgression from '../../components/matches/DetailedPlayerStats/SkillProgression';
import type { RatingJourney } from '../../shared/utils/ratingReplay';

const mocks = vi.hoisted(() => {
  const state = { journey: null as unknown };
  const dataSource = {
    isViewModeLoading: false,
    getPlayerRatingJourney: vi.fn(async (_options?: unknown) => state.journey),
  };
  return { state, dataSource };
});

vi.mock('../../hooks/useDataSource', () => ({ useDataSource: () => mocks.dataSource }));

function snap(matchNumber: number, ratings: Record<string, number>, participants: string[]) {
  return { date: new Date(2026, 0, matchNumber).toString(), matchNumber, ratings, participants, matchId: `m${matchNumber}` };
}

// Alice played matches 8 and 10; the window starts after match 7.
const periodJourney: RatingJourney = {
  baseline: { date: new Date(2026, 0, 7).toString(), matchNumber: 7, ratings: { Alice: 1340, Bob: 1180 }, participants: [] },
  snapshots: [
    snap(8, { Alice: 1370, Bob: 1150 }, ['Alice', 'Bob']),
    snap(10, { Alice: 1350, Bob: 1170 }, ['Alice', 'Bob']),
  ],
  finalRatings: { Alice: 1350, Bob: 1170 },
  isRecalculated: false,
};

beforeEach(() => {
  mocks.state.journey = periodJourney;
  mocks.dataSource.getPlayerRatingJourney.mockClear();
});

describe('SkillProgression filters and starting rating', () => {
  it('passes date, game-length and player-count filters to the journey', async () => {
    const startDate = new Date(2026, 0, 7, 12);
    render(
      <SkillProgression
        playerId="Alice"
        playerName="Alice"
        dateRange={{ startDate, endDate: new Date(2026, 1, 1) }}
        recalculateTrueSkill={false}
        gameLengthFilter="quick"
        playerCountFilter={4}
      />
    );
    await screen.findByText('Rating Journey');
    expect(mocks.dataSource.getPlayerRatingJourney).toHaveBeenCalledWith({
      startDate,
      endDate: new Date(2026, 1, 1),
      gameLengthFilter: 'quick',
      playerCountFilter: 4,
      recalculate: false,
    });
  });

  it('shows the real rating at the period start instead of 1200', async () => {
    render(<SkillProgression playerId="Alice" playerName="Alice" dateRange={{ startDate: new Date(2026, 0, 7, 12) }} />);
    const label = await screen.findByText('Rating at period start');
    expect(label.nextElementSibling?.textContent).toBe('1340');
    expect(screen.getByText('Current Rating').nextElementSibling?.textContent).toBe('1350');
    expect(screen.getByText('Total change').previousElementSibling?.textContent).toContain('+10');
  });

  it('labels the end rating when matches are filtered without recalculation', async () => {
    render(<SkillProgression playerId="Alice" playerName="Alice" gameLengthFilter="long" />);
    expect(await screen.findByText('Rating after last shown match')).toBeTruthy();
  });

  it('labels a recalculated journey', async () => {
    mocks.state.journey = { ...periodJourney, isRecalculated: true, baseline: { ...periodJourney.baseline, matchNumber: 0, ratings: { Alice: 1200, Bob: 1200 } } };
    render(<SkillProgression playerId="Alice" playerName="Alice" gameLengthFilter="long" recalculateTrueSkill />);
    expect(await screen.findByText('Current Rating (recalculated)')).toBeTruthy();
    expect(screen.getByText('Starting Rating').nextElementSibling?.textContent).toBe('1200');
  });
});
