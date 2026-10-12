// src/shared/utils/ratingReplay.ts
//
// Date-ordered TrueSkill (OpenSkill) replay. This is the single source of truth for
// "current rating": the Player Stats list, the player detail header and the Rating
// Journey all derive their numbers from these functions.
import { rating as createRating, rate, ordinal } from 'openskill';
import { filterMatches, MatchFilterOptions } from './matchFilters';
import { GameLength } from '../../types';

// Must match the values used by DatabaseService.recordMatch / recalculatePlayerStats.
export const TRUESKILL_BETA = 25 / 6;
export const TRUESKILL_TAU = 25 / 300;
/** Display rating of a brand-new player (ordinal 0). */
export const DEFAULT_DISPLAY_RATING = 1200;

type OpenSkillRating = ReturnType<typeof createRating>;

export interface ReplayMatch {
  id: string;
  date: Date;
  winningTeam: string;
  gameLength: GameLength;
  titanPlayers: number;
  atlanteanPlayers: number;
}

export interface ReplayMatchPlayer {
  matchId: string;
  playerId: string;
  team: string;
}

export interface ReplayPlayer {
  id: string;
  totalGames: number;
}

export interface RatingSnapshot {
  date: string;
  matchNumber: number;
  ratings: { [playerId: string]: number };
  participants: string[];
  /** Id of the match this snapshot follows (absent on the initial snapshot). */
  matchId?: string;
}

export interface ReplayResult {
  /** Display rating per player after the last replayed match. */
  displayRatings: { [playerId: string]: number };
  /** Only filled when includeSnapshots is set: [initial, after match 1, after match 2, ...]. */
  snapshots: RatingSnapshot[];
}

export function toDisplayRating(value: OpenSkillRating): number {
  return Math.round((ordinal(value) + 25) * 40 + 200);
}

/** Stable sort by match date, oldest first. */
export function sortMatchesByDate<T extends { date: Date | string }>(matches: readonly T[]): T[] {
  return [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Replays matches in date order. Every id in playerIds starts at the default rating;
 * players that only appear in match rows are added on first sight. Matches with an empty
 * team are skipped but still consume a match number (same as the existing replays).
 */
export function replayRatings(
  matches: readonly ReplayMatch[],
  matchPlayers: readonly ReplayMatchPlayer[],
  playerIds: readonly string[],
  options: { includeSnapshots?: boolean } = {}
): ReplayResult {
  const sorted = sortMatchesByDate(matches);
  const playersByMatch = new Map<string, ReplayMatchPlayer[]>();
  for (const mp of matchPlayers) {
    const list = playersByMatch.get(mp.matchId);
    if (list) {
      list.push(mp);
    } else {
      playersByMatch.set(mp.matchId, [mp]);
    }
  }

  const ratings: { [playerId: string]: OpenSkillRating } = {};
  for (const id of playerIds) {
    ratings[id] = createRating();
  }

  const displayAll = (): { [playerId: string]: number } => {
    const result: { [playerId: string]: number } = {};
    for (const id of Object.keys(ratings)) {
      result[id] = toDisplayRating(ratings[id]);
    }
    return result;
  };

  const snapshots: RatingSnapshot[] = [];
  if (options.includeSnapshots) {
    snapshots.push({
      date: (sorted.length > 0 ? new Date(sorted[0].date) : new Date()).toString(),
      matchNumber: 0,
      ratings: displayAll(),
      participants: [],
    });
  }

  sorted.forEach((match, index) => {
    const titans: string[] = [];
    const atlanteans: string[] = [];
    for (const mp of playersByMatch.get(match.id) ?? []) {
      if (!ratings[mp.playerId]) {
        ratings[mp.playerId] = createRating();
      }
      if (mp.team === 'titans') {
        titans.push(mp.playerId);
      } else {
        atlanteans.push(mp.playerId);
      }
    }
    if (titans.length === 0 || atlanteans.length === 0) return;

    const result = rate([titans.map(id => ratings[id]), atlanteans.map(id => ratings[id])], {
      rank: match.winningTeam === 'titans' ? [1, 2] : [2, 1],
      beta: TRUESKILL_BETA,
      tau: TRUESKILL_TAU,
    });
    titans.forEach((id, i) => {
      ratings[id] = result[0][i];
    });
    atlanteans.forEach((id, i) => {
      ratings[id] = result[1][i];
    });

    if (options.includeSnapshots) {
      snapshots.push({
        date: new Date(match.date).toString(),
        matchNumber: index + 1,
        ratings: displayAll(),
        participants: [...titans, ...atlanteans],
        matchId: match.id,
      });
    }
  });

  return { displayRatings: displayAll(), snapshots };
}

/** Competition ranking by rating, highest first: equal ratings share a rank (1, 1, 3). */
export function rankByRating(entries: ReadonlyArray<{ id: string; rating: number }>): { [id: string]: number } {
  const sorted = [...entries].sort((a, b) => b.rating - a.rating);
  const ranks: { [id: string]: number } = {};
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1];
    ranks[entry.id] = previous && previous.rating === entry.rating ? ranks[previous.id] : index + 1;
  });
  return ranks;
}

export interface RatingQueryOptions extends MatchFilterOptions {
  /** "Recalculate skill for period": replay only the filtered matches from default ratings. */
  recalculate?: boolean;
}

/** True when any of date range, game length or player count narrows the match set. */
export function hasActiveMatchFilters(options: MatchFilterOptions): boolean {
  return (
    Boolean(options.startDate || options.endDate) ||
    (options.gameLengthFilter !== undefined && options.gameLengthFilter !== 'all') ||
    options.playerCountFilter != null
  );
}

/** Stable cache key for a RatingQueryOptions value. */
export function ratingQueryKey(options: RatingQueryOptions): string {
  return [
    options.startDate ? options.startDate.getTime() : '',
    options.endDate ? options.endDate.getTime() : '',
    options.gameLengthFilter ?? 'all',
    options.playerCountFilter ?? '',
    options.recalculate ? 1 : 0,
  ].join('|');
}

export interface PlayerRatingTable {
  /** Display rating per player id. */
  ratings: { [playerId: string]: number };
  /**
   * Rank per player id among ranked players: with filters active, known players with at
   * least one match in the filtered set; otherwise known players with totalGames > 0.
   * (Same membership rule as the Player Stats list.)
   */
  ranks: { [playerId: string]: number };
  /** True when ratings come from replaying only the filtered matches. */
  isRecalculated: boolean;
}

export function computePlayerRatingTable(
  players: readonly ReplayPlayer[],
  matches: readonly ReplayMatch[],
  matchPlayers: readonly ReplayMatchPlayer[],
  options: RatingQueryOptions = {}
): PlayerRatingTable {
  const filtersActive = hasActiveMatchFilters(options);
  const isRecalculated = Boolean(options.recalculate) && filtersActive;
  const filteredMatches = filtersActive ? filterMatches([...matches], options) : [...matches];
  const playerIds = players.map(p => p.id);
  const { displayRatings } = replayRatings(isRecalculated ? filteredMatches : matches, matchPlayers, playerIds);

  let rankedIds: string[];
  if (filtersActive) {
    const knownIds = new Set(playerIds);
    const filteredIds = new Set(filteredMatches.map(m => m.id));
    const played = new Set<string>();
    for (const mp of matchPlayers) {
      if (filteredIds.has(mp.matchId) && knownIds.has(mp.playerId)) played.add(mp.playerId);
    }
    rankedIds = Array.from(played);
  } else {
    rankedIds = players.filter(p => p.totalGames > 0).map(p => p.id);
  }

  const ranks = rankByRating(
    rankedIds.map(id => ({ id, rating: displayRatings[id] ?? DEFAULT_DISPLAY_RATING }))
  );
  return { ratings: displayRatings, ranks, isRecalculated };
}

/**
 * True when a new match is not strictly later than every existing match. Recording it with
 * an incremental rating update would then disagree with the date-ordered replay, so the
 * caller must run a full recalculation.
 */
export function isOutOfOrderMatch(
  newMatchDate: Date | string,
  existingMatches: ReadonlyArray<{ date: Date | string }>
): boolean {
  const newTime = new Date(newMatchDate).getTime();
  return existingMatches.some(m => new Date(m.date).getTime() >= newTime);
}
