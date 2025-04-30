// src/types.ts

export enum Team {
  Titans = 'titans',
  Atlanteans = 'atlanteans'
}

export enum GameLength {
  Quick = 'quick',
  Long = 'long'
}

export enum Lane {
  Top = 'top',
  Bottom = 'bottom',
  Single = 'single' // For games with only one lane
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
  lane?: Lane; // Assigned lane for 8-10 player games
}

export type GamePhase = 'setup' | 'strategy' | 'move';

export interface LaneState {
  currentWave: number;
  totalWaves: number;
}

export interface GameState {
  round: number;
  turn: number;
  gameLength: GameLength;
  waves: {
    [Lane.Single]: LaneState;
    [Lane.Top]?: LaneState;
    [Lane.Bottom]?: LaneState;
  };
  teamLives: {
    [Team.Titans]: number;
    [Team.Atlanteans]: number;
  };
  currentPhase: GamePhase;
  activeHeroIndex: number;
  coinSide: 'Titans' | 'Atlanteans';
  hasMultipleLanes: boolean;
}