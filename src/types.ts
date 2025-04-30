// src/types.ts

export enum Team {
  Titans = 'titans',
  Atlanteans = 'atlanteans'
}

export interface Hero {
  id: number;
  name: string;
  icon: string; // URL or path to icon image
  description?: string;
}

export interface Player {
  id: number;
  team: Team;
  hero: Hero | null;
}

export type GamePhase = 'setup' | 'strategy' | 'move';

export interface GameState {
  round: number;
  turn: number;
  waveCounter: number;
  teamLives: {
    [Team.Titans]: number;
    [Team.Atlanteans]: number;
  };
  currentPhase: GamePhase;
  activeHeroIndex: number;
  coinSide: 'heads' | 'tails';
}