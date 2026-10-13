// src/shared/utils/victoryTypeSuggestion.ts
// Best guess of how a game was won, from the live game state, to pre-select
// on the victory screen. Only suggests on positive evidence, and says which.
import { GameState, LaneState, Lane, Team } from '../../types';

/** A pre-selected victory type with the evidence it came from. */
export type VictoryTypeSuggestion =
  /** The losing team had no lives left. */
  | { type: 'kills'; reason: 'no-lives' }
  /** A lane's minion wave counter was on its final wave. */
  | { type: 'wave'; reason: 'final-wave' };

export function suggestVictoryType(
  state: Pick<GameState, 'teamLives' | 'waves'>,
  winningTeam: Team
): VictoryTypeSuggestion | undefined {
  const losingTeam = winningTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
  if (state.teamLives[losingTeam] <= 0) return { type: 'kills', reason: 'no-lives' };

  const lanes = [state.waves[Lane.Single], state.waves[Lane.Top], state.waves[Lane.Bottom]].filter(
    (lane): lane is LaneState => lane !== undefined
  );
  if (lanes.some(lane => lane.currentWave >= lane.totalWaves)) return { type: 'wave', reason: 'final-wave' };

  return undefined;
}
