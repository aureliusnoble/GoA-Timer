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
  roles: string[]; // Array of primary hero roles
  additionalRoles?: string[]; // NEW: Secondary/additional roles
  expansion: string; // Which expansion set the hero belongs to
  description: string;
  
  // NEW: Base stat values (1-8 scale)
  attack?: number;
  initiative?: number;
  defence?: number;
  movement?: number;
  
  // NEW: Maximum upgraded stat values (1-8 scale)
  attack_upgraded?: number;
  initiative_upgraded?: number;
  defence_upgraded?: number;
  movement_upgraded?: number;
}

// New interface for player statistics - Updated to include level
export interface PlayerStats {
  totalGoldEarned: number;
  totalKills: number;
  totalAssists: number;
  totalDeaths: number;
  totalMinionKills: number;
  level?: number; // New field to track player level
}

export interface Player {
  id: number;
  team: Team;
  hero: Hero | null;
  lane?: Lane; // Assigned lane for 8-10 player games
  name: string; // New field for player name
  stats?: PlayerStats; // NEW: Optional player statistics tracking
}

// Updated to include 'victory' phase
export type GamePhase = 'setup' | 'strategy' | 'move' | 'turn-end' | 'victory';

export interface LaneState {
  currentWave: number;
  totalWaves: number;
}

// Updated interface to ensure proper type checking for multiple lanes
export interface GameState {
  round: number;
  turn: number;
  gameLength: GameLength;
  waves: {
    [Lane.Single]?: LaneState;
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
  
  // Optional field for storing the victor team
  victorTeam?: Team;
}

// Updated enum for draft modes with All Pick
export enum DraftMode {
  None = 'none',
  AllPick = 'allpick', // New mode added
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