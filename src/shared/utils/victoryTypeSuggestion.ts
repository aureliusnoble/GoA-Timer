// src/shared/utils/victoryTypeSuggestion.ts
// Best guess of how a game was won, from the live game state, to pre-select
// on the victory screen. Only suggests on positive evidence.
import { GameState, LaneState, Lane, Team, VictoryType } from '../../types';

export function suggestVictoryType(
  state: Pick<GameState, 'teamLives' | 'waves'>,
  winningTeam: Team
): VictoryType | undefined {
  const losingTeam = winningTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
  if (state.teamLives[losingTeam] <= 0) return 'kills';

  const lanes = [state.waves[Lane.Single], state.waves[Lane.Top], state.waves[Lane.Bottom]].filter(
    (lane): lane is LaneState => lane !== undefined
  );
  if (lanes.some(lane => lane.currentWave >= lane.totalWaves)) return 'wave';

  return undefined;
}
