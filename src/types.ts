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

// Updated Hero interface with new properties
export interface Hero {
  id: number;
  name: string;
  icon: string; // URL or path to icon image
  complexity: number; // 1-4 rating
  roles: string[]; // Array of hero roles
  expansion: string; // Which expansion set the hero belongs to
  description: string;
}

export interface Player {
  id: number;
  team: Team;
  hero: Hero | null;
  lane?: Lane; // Assigned lane for 8-10 player games
  name: string; // New field for player name
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
  coinSide: Team;
  hasMultipleLanes: boolean;
  
  // Fields to track player turns
  completedTurns: number[]; // Array of player indices who have completed their turn
  allPlayersMoved: boolean; // Flag to indicate when all players have completed their moves
}

// New enum for draft modes
export enum DraftMode {
  None = 'none',
  Single = 'single',
  Random = 'random',
  PickAndBan = 'pickandban'
}

// New interface for pick and ban sequence
export interface PickBanStep {
  team: 'A' | 'B';
  action: 'pick' | 'ban';
  round: number;
}

// New interface for drafting state
export interface DraftingState {
  mode: DraftMode;
  currentTeam: Team;
  availableHeroes: Hero[];
  assignedHeroes: {
    playerId: number;
    heroOptions: Hero[];
  }[];
  selectedHeroes: {
    playerId: number;
    hero: Hero;
  }[];
  bannedHeroes: Hero[];
  currentStep: number;
  pickBanSequence: PickBanStep[]; // For Pick and Ban drafting
  isComplete: boolean;
}