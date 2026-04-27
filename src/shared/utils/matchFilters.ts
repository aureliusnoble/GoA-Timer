import { GameLength } from '../../types';

export interface MatchFilterOptions {
  startDate?: Date;
  endDate?: Date;
  gameLengthFilter?: 'all' | 'quick' | 'long';
  playerCountFilter?: number | null;
}

interface FilterableMatch {
  date: Date;
  gameLength: GameLength;
  titanPlayers: number;
  atlanteanPlayers: number;
}

export function filterMatches<T extends FilterableMatch>(matches: T[], options: MatchFilterOptions): T[] {
  return matches.filter(match => {
    if (options.startDate || options.endDate) {
      const matchDate = new Date(match.date);
      if (options.startDate && matchDate < options.startDate) return false;
      if (options.endDate && matchDate > options.endDate) return false;
    }
    if (options.gameLengthFilter && options.gameLengthFilter !== 'all') {
      if (match.gameLength !== options.gameLengthFilter) return false;
    }
    if (options.playerCountFilter != null) {
      const totalPlayers = match.titanPlayers + match.atlanteanPlayers;
      if (totalPlayers !== options.playerCountFilter) return false;
    }
    return true;
  });
}
