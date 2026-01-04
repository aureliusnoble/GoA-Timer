// src/components/matches/CustomMatchMaker/types.ts

export interface MatchMakerWeights {
  ranking: number;     // 0-100
  experience: number;  // 0-100
  novel: number;       // 0-100
  reunion: number;     // 0-100
  winRate: number;     // 0-100
  random: number;      // 0-100
}

export interface MatchMakerPreset {
  id: string;
  name: string;
  weights: MatchMakerWeights;
  createdAt: Date;
  isBuiltIn?: boolean;  // True for default presets that can't be deleted
}

export interface ConfigurationScores {
  ranking: number;      // 0-1 normalized (1 = best balance)
  experience: number;   // 0-1 normalized (1 = best balance)
  novel: number;        // 0-1 normalized (1 = least familiar)
  reunion: number;      // 0-1 normalized (1 = longest apart)
  winRate: number;      // 0-1 normalized (1 = best balance)
  random: number;       // 0-1 random
}

export interface ScoredConfiguration {
  team1Indices: number[];  // Indices into sorted player array
  team2Indices: number[];  // Remaining indices
  rawScores: {
    ranking: number;       // Raw skill difference
    experience: number;    // Raw games difference
    novel: number;         // Raw familiarity total
    reunion: number;       // Raw recency total
    winRate: number;       // Raw win rate difference
  };
  normalizedScores: ConfigurationScores;
}

export interface ScoredConfigurations {
  playerIds: string[];               // Player IDs in sorted order
  configurations: ScoredConfiguration[];
  calculatedAt: Date;
}

// Weight factor configuration for UI
export interface WeightFactor {
  id: keyof MatchMakerWeights;
  label: string;
  description: string;
  icon: string;  // Lucide icon name
  colorClass: string;
}

export const WEIGHT_FACTORS: WeightFactor[] = [
  {
    id: 'ranking',
    label: 'Skill Balance',
    description: 'Minimize skill difference between teams',
    icon: 'Trophy',
    colorClass: 'blue',
  },
  {
    id: 'experience',
    label: 'Experience',
    description: 'Balance by total games played',
    icon: 'Clock',
    colorClass: 'green',
  },
  {
    id: 'novel',
    label: 'Novel Pairings',
    description: 'Pair players who rarely team up',
    icon: 'Sparkles',
    colorClass: 'amber',
  },
  {
    id: 'reunion',
    label: 'Reunion',
    description: "Pair players who haven't teamed recently",
    icon: 'Clock3',
    colorClass: 'indigo',
  },
  {
    id: 'winRate',
    label: 'Win Rate',
    description: 'Balance by player win rates',
    icon: 'TrendingUp',
    colorClass: 'rose',
  },
  {
    id: 'random',
    label: 'Randomness',
    description: 'Add unpredictability to team selection',
    icon: 'Shuffle',
    colorClass: 'purple',
  },
];

export const DEFAULT_PRESETS: Omit<MatchMakerPreset, 'createdAt'>[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    weights: { ranking: 20, experience: 20, novel: 20, reunion: 20, winRate: 20, random: 0 },
    isBuiltIn: true,
  },
  {
    id: 'competitive',
    name: 'Competitive',
    weights: { ranking: 40, experience: 15, novel: 10, reunion: 10, winRate: 15, random: 10 },
    isBuiltIn: true,
  },
  {
    id: 'social',
    name: 'Social',
    weights: { ranking: 10, experience: 10, novel: 35, reunion: 35, winRate: 10, random: 0 },
    isBuiltIn: true,
  },
];

export const DEFAULT_WEIGHTS: MatchMakerWeights = {
  ranking: 17,
  experience: 17,
  novel: 17,
  reunion: 17,
  winRate: 16,
  random: 16,
};
