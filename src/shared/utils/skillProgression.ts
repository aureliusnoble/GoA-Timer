// src/shared/utils/skillProgression.ts
//
// Pure data preparation for the Skill Progression ("Rating Journey") chart.
import { RatingJourney, DEFAULT_DISPLAY_RATING } from './ratingReplay';

export interface ProgressionPoint {
  /** Match number from the replay (x axis). */
  matchNumber: number;
  date: string;
  playerRating: number;
  p10: number; // 10th percentile (smoothed)
  p25: number; // 25th percentile (smoothed)
  p50: number; // Median (smoothed)
  p75: number; // 75th percentile (smoothed)
  p90: number; // 90th percentile (smoothed)
  mean: number; // Group mean (smoothed)
}

export interface ProgressionSeries {
  /** points[0] is the starting point; points[i] (i >= 1) follows the player's i-th shown match. */
  points: ProgressionPoint[];
  /** Raw (unsmoothed) group median at the starting point. */
  startMedian: number;
  /** True when the start is the real rating at a date-window start rather than the default rating. */
  startsAtPeriodStart: boolean;
}

// LOESS (Locally Weighted Scatterplot Smoothing) implementation
export function loess(data: number[], bandwidth: number = 0.4): number[] {
  const n = data.length;
  if (n === 0) return [];
  if (n === 1) return [...data];

  const result: number[] = [];
  const h = Math.max(Math.floor(n * bandwidth), 2);

  for (let i = 0; i < n; i++) {
    let sumWeights = 0;
    let sumWeightedY = 0;

    for (let j = 0; j < n; j++) {
      const distance = Math.abs(i - j) / h;
      if (distance < 1) {
        // Tricube weight function: (1 - |d|^3)^3
        const weight = Math.pow(1 - Math.pow(distance, 3), 3);
        sumWeights += weight;
        sumWeightedY += weight * data[j];
      }
    }

    result.push(sumWeights > 0 ? sumWeightedY / sumWeights : data[i]);
  }

  return result;
}

// Calculate percentile from sorted array
export function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] * (1 - fraction) + sortedArr[upper] * fraction;
}

/** Builds the chart series for one player, or null when the player has no shown matches. */
export function buildProgressionSeries(journey: RatingJourney, playerId: string): ProgressionSeries | null {
  const raw: { matchNumber: number; date: string; playerRating: number; allRatings: number[] }[] = [];

  for (const snapshot of journey.snapshots) {
    const playerRating = snapshot.ratings[playerId];
    if (!snapshot.participants.includes(playerId) || playerRating === undefined) continue;
    raw.push({
      matchNumber: snapshot.matchNumber,
      date: snapshot.date,
      playerRating,
      allRatings: Object.values(snapshot.ratings).sort((a, b) => a - b),
    });
  }

  if (raw.length === 0) return null;

  const startsAtPeriodStart = journey.baseline.matchNumber > 0;
  const baselineRatings = Object.values(journey.baseline.ratings).sort((a, b) => a - b);
  raw.unshift({
    matchNumber: journey.baseline.matchNumber,
    // A fresh start has no meaningful date of its own; use the player's first match date.
    date: startsAtPeriodStart ? journey.baseline.date : raw[0].date,
    playerRating: journey.baseline.ratings[playerId] ?? DEFAULT_DISPLAY_RATING,
    allRatings: baselineRatings.length > 0 ? baselineRatings : [DEFAULT_DISPLAY_RATING],
  });

  const smooth = (values: number[]) => loess(values).map(v => Math.round(v));
  const p10 = smooth(raw.map(d => percentile(d.allRatings, 10)));
  const p25 = smooth(raw.map(d => percentile(d.allRatings, 25)));
  const p50 = smooth(raw.map(d => percentile(d.allRatings, 50)));
  const p75 = smooth(raw.map(d => percentile(d.allRatings, 75)));
  const p90 = smooth(raw.map(d => percentile(d.allRatings, 90)));
  const mean = smooth(raw.map(d => d.allRatings.reduce((sum, r) => sum + r, 0) / d.allRatings.length));

  return {
    points: raw.map((d, i) => ({
      matchNumber: d.matchNumber,
      date: d.date,
      playerRating: d.playerRating,
      p10: p10[i],
      p25: p25[i],
      p50: p50[i],
      p75: p75[i],
      p90: p90[i],
      mean: mean[i],
    })),
    startMedian: percentile(raw[0].allRatings, 50),
    startsAtPeriodStart,
  };
}
