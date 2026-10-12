// src/__tests__/shared/utils/skillProgression.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildProgressionSeries,
  loess,
  percentile,
  describeProgressionPoint,
  findNearestPointIndex,
  pickAxisTicks,
  ProgressionPoint,
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

describe('describeProgressionPoint', () => {
  const points: ProgressionPoint[] = buildProgressionSeries(freshJourney, 'Alice')!.points;

  it('describes the start without a change', () => {
    expect(describeProgressionPoint(points, 0)).toMatchObject({ isStart: true, gameNumber: 0, rating: 1200, change: null });
  });

  it('reports the change versus the previous point and the smoothed median', () => {
    expect(describeProgressionPoint(points, 2)).toEqual({
      isStart: false,
      matchNumber: 3,
      gameNumber: 2,
      date: points[2].date,
      rating: 1230,
      change: -30,
      groupMedian: points[2].p50,
    });
  });

  it('returns null for an index outside the series', () => {
    expect(describeProgressionPoint(points, 5)).toBeNull();
    expect(describeProgressionPoint(points, -1)).toBeNull();
  });
});

describe('findNearestPointIndex', () => {
  it('finds the closest value, preferring the first on a tie', () => {
    expect(findNearestPointIndex([0, 4, 10], 6.5)).toBe(1);
    expect(findNearestPointIndex([0, 4, 10], 7)).toBe(1);
    expect(findNearestPointIndex([0, 4, 10], 99)).toBe(2);
    expect(findNearestPointIndex([], 3)).toBe(-1);
  });
});

describe('pickAxisTicks', () => {
  it('keeps every value when there are few enough', () => {
    expect(pickAxisTicks([3, 1, 2], 6)).toEqual([1, 2, 3]);
  });

  it('thins long series to at most maxTicks, keeping first and last', () => {
    const values = Array.from({ length: 40 }, (_, i) => i * 3);
    const ticks = pickAxisTicks(values, 6);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(117);
  });
});
