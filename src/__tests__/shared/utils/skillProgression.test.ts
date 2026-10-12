// src/__tests__/shared/utils/skillProgression.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildProgressionSeries,
  loess,
  percentile,
} from '../../../shared/utils/skillProgression';
import { RatingJourney, RatingSnapshot } from '../../../shared/utils/ratingReplay';

function snap(matchNumber: number, ratings: Record<string, number>, participants: string[]): RatingSnapshot {
  return { date: new Date(2026, 0, matchNumber + 1).toString(), matchNumber, ratings, participants, matchId: `m${matchNumber}` };
}

const freshJourney: RatingJourney = {
  baseline: { date: new Date(2026, 0, 1).toString(), matchNumber: 0, ratings: { Alice: 1200, Bob: 1200, Cara: 1200 }, participants: [] },
  snapshots: [
    snap(1, { Alice: 1260, Bob: 1150, Cara: 1200 }, ['Alice', 'Bob']),
    snap(2, { Alice: 1260, Bob: 1180, Cara: 1170 }, ['Bob', 'Cara']),
    snap(3, { Alice: 1230, Bob: 1180, Cara: 1210 }, ['Alice', 'Cara']),
  ],
  finalRatings: { Alice: 1230, Bob: 1180, Cara: 1210 },
  isRecalculated: false,
};

describe('loess / percentile', () => {
  it('leaves a constant series unchanged and interpolates percentiles', () => {
    expect(loess([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([], 50)).toBe(0);
  });
});

describe('buildProgressionSeries', () => {
  it('starts at the default rating and keeps only the player’s matches', () => {
    const series = buildProgressionSeries(freshJourney, 'Alice')!;
    expect(series.startsAtPeriodStart).toBe(false);
    expect(series.startMedian).toBe(1200);
    expect(series.points.map(p => [p.matchNumber, p.playerRating])).toEqual([
      [0, 1200],
      [1, 1260],
      [3, 1230],
    ]);
    // A fresh start takes the player's first match date.
    expect(series.points[0].date).toBe(freshJourney.snapshots[0].date);
  });

  it('starts from the baseline rating when the journey begins at a period start', () => {
    const journey: RatingJourney = {
      ...freshJourney,
      baseline: { date: new Date(2025, 11, 30).toString(), matchNumber: 7, ratings: { Alice: 1340, Bob: 1100, Cara: 1250 }, participants: [] },
    };
    const series = buildProgressionSeries(journey, 'Alice')!;
    expect(series.startsAtPeriodStart).toBe(true);
    expect(series.points[0]).toMatchObject({ matchNumber: 7, playerRating: 1340, date: journey.baseline.date });
    expect(series.startMedian).toBe(1250);
  });

  it('returns null when the player has no shown matches', () => {
    expect(buildProgressionSeries(freshJourney, 'Zed')).toBeNull();
  });
});
