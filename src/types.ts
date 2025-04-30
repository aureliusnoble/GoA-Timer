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

export type GamePhase = 'setup' | 'strategy' | 'move' | 'turn-end';

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
  coinSide: Team; // Changed from 'heads' | 'tails' to Team
  hasMultipleLanes: boolean;
  
  // New fields to track player turns
  completedTurns: number[]; // Array of player indices who have completed their turn
  allPlayersMoved: boolean; // Flag to indicate when all players have completed their moves
}