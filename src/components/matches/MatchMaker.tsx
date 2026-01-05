// src/components/matches/MatchMaker.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Shuffle, Award, Info, Plus, ArrowRight, ArrowLeft, RefreshCw, Play, Trophy, Clock, ChevronUp, ChevronDown, Sparkles, Clock3, TrendingUp, Sliders } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import { CustomMatchMakerModal, MatchMakerWeights, ScoredConfiguration } from './CustomMatchMaker';

export type MatchesView = 'menu' | 'player-stats' | 'match-history' | 'match-maker';

interface MatchMakerProps {
  onBack: () => void;
  // NEW: Add prop for using teams in setup
  onUseTeams?: (titanPlayers: string[], atlanteanPlayers: string[]) => void;
}

// Interface for win probability with confidence interval
interface WinProbabilityResult {
  team1Probability: number;
  team1Lower: number;
  team1Upper: number;
  team2Probability: number;
  team2Lower: number;
  team2Upper: number;
}

// Component for visualizing win probability with confidence intervals
const WinProbabilityVisualization: React.FC<{
  probability: WinProbabilityResult;
  team1Name: string;
  team2Name: string;
}> = ({ probability, team1Name, team2Name }) => {
  return (
    <div className="space-y-6 bg-gray-800 p-8 rounded-lg text-white">
      {/* Percentage guideline bar */}
      <div>
        <div className="flex justify-between items-center mb-2 text-sm">
          <span className="text-gray-400">Win Probability Scale</span>
        </div>
        <div className="relative h-8 bg-gray-700 rounded-lg">
          {/* Percentage markers */}
          <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
            <span className="text-xs text-gray-400">0%</span>
            <span className="text-xs text-gray-400">20%</span>
            <span className="text-xs text-gray-400">40%</span>
            <span className="text-xs text-gray-400">60%</span>
            <span className="text-xs text-gray-400">80%</span>
            <span className="text-xs text-gray-400">100%</span>
          </div>
          {/* Vertical guidelines */}
          {[20, 40, 60, 80].map((perc) => (
            <div
              key={perc}
              className="absolute top-0 bottom-0 border-l border-gray-600/50"
              style={{ left: `${perc}%` }}
            />
          ))}
        </div>
      </div>

      {/* Team 1 (Titans) Visualization */}
      <div className="mt-16">
        <div className="flex items-center mb-3">
          <span className="text-blue-400 font-medium relative -top-4">{team1Name}</span>
        </div>
        <div className="relative h-8 bg-gray-700 rounded-lg overflow-hidden">

          {/* 95% Confidence Interval Band */}
          <div
            className="absolute top-0 bottom-0 bg-blue-500/30"
            style={{
              left: `${probability.team1Lower}%`,
              width: `${probability.team1Upper - probability.team1Lower}%`
            }}
          />

          {/* Point estimate diamond */}
          <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left: `${probability.team1Probability}%` }}>
            <div className="relative">
              {/* Centered probability label with CI range */}
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-bold text-white whitespace-nowrap">
                {probability.team1Probability}% ({probability.team1Lower}-{probability.team1Upper}%)
              </span>
              {/* Diamond */}
              <div className="w-4 h-4 bg-blue-500 transform rotate-45 -translate-x-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* Team 2 (Atlanteans) Visualization */}
      <div className="mt-16">
        <div className="flex items-center mb-3">
          <span className="text-red-400 font-medium relative -top-4">{team2Name}</span>
        </div>
        <div className="relative h-8 bg-gray-700 rounded-lg overflow-hidden">

          {/* 95% Confidence Interval Band */}
          <div
            className="absolute top-0 bottom-0 bg-red-500/30"
            style={{
              left: `${probability.team2Lower}%`,
              width: `${probability.team2Upper - probability.team2Lower}%`
            }}
          />

          {/* Point estimate diamond */}
          <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left: `${probability.team2Probability}%` }}>
            <div className="relative">
              {/* Centered probability label with CI range */}
              <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-bold text-white whitespace-nowrap">
                {probability.team2Probability}% ({probability.team2Lower}-{probability.team2Upper}%)
              </span>
              {/* Diamond */}
              <div className="w-4 h-4 bg-red-500 transform rotate-45 -translate-x-1/2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const MatchMaker: React.FC<MatchMakerProps> = ({ onBack, onUseTeams }) => {
  const { playSound } = useSound();
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<DBPlayer[]>([]);
  const [team1, setTeam1] = useState<DBPlayer[]>([]);
  const [team2, setTeam2] = useState<DBPlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBalancing, setIsBalancing] = useState<boolean>(false);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [winProbability, setWinProbability] = useState<WinProbabilityResult | null>(null);
  // New state for collapsible win probability section
  const [showWinProbability, setShowWinProbability] = useState<boolean>(false);

  // Track which balancing mode was used for display purposes
  const [lastBalanceMode, setLastBalanceMode] = useState<'ranking' | 'experience' | 'novel' | 'reunion' | 'winRate' | 'random' | null>(null);

  // Store familiarity stats when using Novel mode
  const [novelStats, setNovelStats] = useState<{
    team1Familiarity: number;
    team2Familiarity: number;
    avgFamiliarity: number;
  } | null>(null);

  // Store recency stats when using Reunion mode
  const [reunionStats, setReunionStats] = useState<{
    team1Recency: number;
    team2Recency: number;
    avgDaysSinceTeamed: number;
  } | null>(null);

  // Custom match maker state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStats, setCustomStats] = useState<{
    weights: MatchMakerWeights;
    score: number;
  } | null>(null);

  // Store win rate stats when using Win Rate mode
  const [winRateStats, setWinRateStats] = useState<{
    team1AvgWinRate: number;
    team2AvgWinRate: number;
    difference: number;
  } | null>(null);

  // Load player data on component mount
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      try {
        // Get all players from the database
        const players = await dbService.getAllPlayers();
        
        // Filter out players with no match history
        const playersWithMatches = players.filter(player => player.totalGames > 0);
        
        // Sort by name
        playersWithMatches.sort((a, b) => a.name.localeCompare(b.name));
        
        setAllPlayers(playersWithMatches);
      } catch (error) {
        console.error('Error loading players:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPlayers();
  }, []);
  
  // Calculate win probability when teams change
  useEffect(() => {
    const calculateProbability = async () => {
      if (team1.length > 0 && team2.length > 0) {
        try {
          // Get player IDs for both teams
          const team1Ids = team1.map(p => p.id);
          const team2Ids = team2.map(p => p.id);
          
          // Calculate win probability with confidence intervals using the database service
          const result = await dbService.calculateWinProbabilityWithCI(team1Ids, team2Ids);
          
          setWinProbability(result);
        } catch (error) {
          console.error('Error calculating win probability:', error);
          setWinProbability(null);
        }
      } else {
        setWinProbability(null);
      }
    };
    
    calculateProbability();
  }, [team1, team2]);
  
  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  // Handle player selection
  const togglePlayerSelection = (player: DBPlayer) => {
    playSound('buttonClick');
    
    // If already selected, remove player
    if (selectedPlayers.some(p => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
      
      // If in manual mode, also remove from teams
      if (manualMode) {
        setTeam1(team1.filter(p => p.id !== player.id));
        setTeam2(team2.filter(p => p.id !== player.id));
      }
    } else {
      // Add player to selected list
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };
  
  // Helper: Find optimal team assignment that minimizes average difference
  // Uses exhaustive search - O(C(n, n/2)) which is fast for typical game sizes (4-12 players)
  const findOptimalTeams = (
    players: DBPlayer[],
    getValue: (p: DBPlayer) => number
  ): { team1: DBPlayer[], team2: DBPlayer[] } => {
    const n = players.length;
    if (n < 2) return { team1: [...players], team2: [] };

    // Sort players deterministically (for consistent tie-breaking)
    const sorted = [...players].sort((a, b) => {
      const diff = getValue(b) - getValue(a);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    const team1Size = Math.ceil(n / 2);
    const team2Size = n - team1Size;

    // Generate all combinations of indices for team1
    const generateCombinations = (k: number): number[][] => {
      const result: number[][] = [];
      const combine = (start: number, current: number[]) => {
        if (current.length === k) {
          result.push([...current]);
          return;
        }
        for (let i = start; i <= n - (k - current.length); i++) {
          current.push(i);
          combine(i + 1, current);
          current.pop();
        }
      };
      combine(0, []);
      return result;
    };

    const allCombinations = generateCombinations(team1Size);
    let bestTeam1Indices: number[] = [];
    let bestDiff = Infinity;

    for (const team1Indices of allCombinations) {
      // Calculate team sums
      let team1Sum = 0;
      let team2Sum = 0;
      const team1Set = new Set(team1Indices);

      for (let i = 0; i < n; i++) {
        const value = getValue(sorted[i]);
        if (team1Set.has(i)) {
          team1Sum += value;
        } else {
          team2Sum += value;
        }
      }

      // Calculate average difference
      const team1Avg = team1Sum / team1Size;
      const team2Avg = team2Sum / team2Size;
      const diff = Math.abs(team1Avg - team2Avg);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestTeam1Indices = team1Indices;
      }
      // Tie-breaker: first combination found (lexicographic order) wins
    }

    const team1Set = new Set(bestTeam1Indices);
    const team1 = bestTeam1Indices.map(i => sorted[i]);
    const team2 = sorted.filter((_, i) => !team1Set.has(i));

    return { team1, team2 };
  };

  // Build familiarity matrix - counts games each pair of players have been teammates
  const buildFamiliarityMatrix = async (
    playerIds: string[]
  ): Promise<Map<string, Map<string, number>>> => {
    const matrix = new Map<string, Map<string, number>>();
    const playerIdSet = new Set(playerIds);

    // Initialize matrix with zeros
    for (const p1 of playerIds) {
      matrix.set(p1, new Map());
      for (const p2 of playerIds) {
        if (p1 !== p2) {
          matrix.get(p1)!.set(p2, 0);
        }
      }
    }

    // Get all matches and count teammate occurrences
    const allMatches = await dbService.getAllMatches();

    for (const match of allMatches) {
      const matchPlayers = await dbService.getMatchPlayers(match.id);

      // Group players by team, only including selected players
      const titanPlayers = matchPlayers
        .filter(p => p.team === 'titans' && playerIdSet.has(p.playerId))
        .map(p => p.playerId);
      const atlanteanPlayers = matchPlayers
        .filter(p => p.team === 'atlanteans' && playerIdSet.has(p.playerId))
        .map(p => p.playerId);

      // Count pairs for Titans team
      for (let i = 0; i < titanPlayers.length; i++) {
        for (let j = i + 1; j < titanPlayers.length; j++) {
          const p1 = titanPlayers[i];
          const p2 = titanPlayers[j];
          matrix.get(p1)!.set(p2, (matrix.get(p1)?.get(p2) ?? 0) + 1);
          matrix.get(p2)!.set(p1, (matrix.get(p2)?.get(p1) ?? 0) + 1);
        }
      }

      // Count pairs for Atlanteans team
      for (let i = 0; i < atlanteanPlayers.length; i++) {
        for (let j = i + 1; j < atlanteanPlayers.length; j++) {
          const p1 = atlanteanPlayers[i];
          const p2 = atlanteanPlayers[j];
          matrix.get(p1)!.set(p2, (matrix.get(p1)?.get(p2) ?? 0) + 1);
          matrix.get(p2)!.set(p1, (matrix.get(p2)?.get(p1) ?? 0) + 1);
        }
      }
    }

    return matrix;
  };

  // Calculate total familiarity score for a team (sum of games together for all pairs)
  const calculateTeamFamiliarity = (
    team: DBPlayer[],
    matrix: Map<string, Map<string, number>>
  ): number => {
    let total = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        total += matrix.get(team[i].id)?.get(team[j].id) ?? 0;
      }
    }
    return total;
  };

  // Find optimal team split that minimizes total familiarity (novel teams)
  const findNovelTeams = (
    players: DBPlayer[],
    matrix: Map<string, Map<string, number>>
  ): {
    team1: DBPlayer[];
    team2: DBPlayer[];
    team1Familiarity: number;
    team2Familiarity: number;
    avgFamiliarity: number;
  } => {
    const n = players.length;
    if (n < 2) {
      return {
        team1: [...players],
        team2: [],
        team1Familiarity: 0,
        team2Familiarity: 0,
        avgFamiliarity: 0
      };
    }

    // Sort players deterministically for consistent results
    const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));

    const team1Size = Math.ceil(n / 2);

    // Generate all combinations of indices for team1 (reuse pattern from findOptimalTeams)
    const generateCombinations = (k: number): number[][] => {
      const result: number[][] = [];
      const combine = (start: number, current: number[]) => {
        if (current.length === k) {
          result.push([...current]);
          return;
        }
        for (let i = start; i <= n - (k - current.length); i++) {
          current.push(i);
          combine(i + 1, current);
          current.pop();
        }
      };
      combine(0, []);
      return result;
    };

    const allCombinations = generateCombinations(team1Size);
    let bestTeam1Indices: number[] = [];
    let bestTotalFamiliarity = Infinity;

    for (const team1Indices of allCombinations) {
      const team1Set = new Set(team1Indices);
      const team1 = team1Indices.map(i => sorted[i]);
      const team2 = sorted.filter((_, i) => !team1Set.has(i));

      const familiarity1 = calculateTeamFamiliarity(team1, matrix);
      const familiarity2 = calculateTeamFamiliarity(team2, matrix);
      const totalFamiliarity = familiarity1 + familiarity2;

      if (totalFamiliarity < bestTotalFamiliarity) {
        bestTotalFamiliarity = totalFamiliarity;
        bestTeam1Indices = team1Indices;
      }
      // Tie-breaker: first lexicographic combination wins (deterministic)
    }

    const team1Set = new Set(bestTeam1Indices);
    const team1 = bestTeam1Indices.map(i => sorted[i]);
    const team2 = sorted.filter((_, i) => !team1Set.has(i));
    const team1Fam = calculateTeamFamiliarity(team1, matrix);
    const team2Fam = calculateTeamFamiliarity(team2, matrix);

    // Calculate number of pairs: C(n,2) = n*(n-1)/2
    const team1Pairs = (team1.length * (team1.length - 1)) / 2;
    const team2Pairs = (team2.length * (team2.length - 1)) / 2;
    const totalPairs = team1Pairs + team2Pairs;
    const avgFam = totalPairs > 0 ? (team1Fam + team2Fam) / totalPairs : 0;

    return {
      team1,
      team2,
      team1Familiarity: team1Fam,
      team2Familiarity: team2Fam,
      avgFamiliarity: avgFam
    };
  };

  // Balance teams by novelty - finds teams where players have played together the least
  const balanceTeamsByNovelty = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      const playerIds = selectedPlayers.map(p => p.id);
      const matrix = await buildFamiliarityMatrix(playerIds);
      const result = findNovelTeams(selectedPlayers, matrix);

      setTeam1(result.team1);
      setTeam2(result.team2);
      setLastBalanceMode('novel');
      setNovelStats({
        team1Familiarity: result.team1Familiarity,
        team2Familiarity: result.team2Familiarity,
        avgFamiliarity: result.avgFamiliarity
      });
      setReunionStats(null);
      setCustomStats(null);
      setWinRateStats(null);

      // Keep win probability collapsed by default
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams by novelty:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Constant for "never played together" - 10 years in days
  const NEVER_TEAMED_DAYS = 3650;

  // Build recency matrix - tracks when each pair of players last played together as teammates
  const buildRecencyMatrix = async (
    playerIds: string[]
  ): Promise<Map<string, Map<string, Date | null>>> => {
    const matrix = new Map<string, Map<string, Date | null>>();
    const playerIdSet = new Set(playerIds);

    // Initialize matrix with null (never played together)
    for (const p1 of playerIds) {
      matrix.set(p1, new Map());
      for (const p2 of playerIds) {
        if (p1 !== p2) {
          matrix.get(p1)!.set(p2, null);
        }
      }
    }

    // Get all matches sorted by date descending (most recent first)
    const allMatches = await dbService.getAllMatches();
    allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const match of allMatches) {
      const matchPlayers = await dbService.getMatchPlayers(match.id);
      const matchDate = new Date(match.date);

      // Group players by team, only including selected players
      const titanPlayers = matchPlayers
        .filter(p => p.team === 'titans' && playerIdSet.has(p.playerId))
        .map(p => p.playerId);
      const atlanteanPlayers = matchPlayers
        .filter(p => p.team === 'atlanteans' && playerIdSet.has(p.playerId))
        .map(p => p.playerId);

      // Record date for Titans team pairs (only keep most recent, which is first encountered)
      for (let i = 0; i < titanPlayers.length; i++) {
        for (let j = i + 1; j < titanPlayers.length; j++) {
          const p1 = titanPlayers[i];
          const p2 = titanPlayers[j];
          // Only set if not already set (keep most recent)
          if (matrix.get(p1)?.get(p2) === null) {
            matrix.get(p1)!.set(p2, matchDate);
            matrix.get(p2)!.set(p1, matchDate);
          }
        }
      }

      // Record date for Atlanteans team pairs
      for (let i = 0; i < atlanteanPlayers.length; i++) {
        for (let j = i + 1; j < atlanteanPlayers.length; j++) {
          const p1 = atlanteanPlayers[i];
          const p2 = atlanteanPlayers[j];
          if (matrix.get(p1)?.get(p2) === null) {
            matrix.get(p1)!.set(p2, matchDate);
            matrix.get(p2)!.set(p1, matchDate);
          }
        }
      }
    }

    return matrix;
  };

  // Calculate total recency score for a team (sum of days since last teamed for all pairs)
  const calculateTeamRecency = (
    team: DBPlayer[],
    matrix: Map<string, Map<string, Date | null>>,
    now: Date
  ): number => {
    let total = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const lastTeamed = matrix.get(team[i].id)?.get(team[j].id);
        if (lastTeamed === null || lastTeamed === undefined) {
          // Never played together or not in matrix - treat as maximum
          total += NEVER_TEAMED_DAYS;
        } else {
          // Calculate days difference
          const diffMs = now.getTime() - lastTeamed.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          total += diffDays;
        }
      }
    }
    return total;
  };

  // Find optimal team split that maximizes total recency (reunion teams)
  const findReunionTeams = (
    players: DBPlayer[],
    matrix: Map<string, Map<string, Date | null>>,
    now: Date
  ): {
    team1: DBPlayer[];
    team2: DBPlayer[];
    team1Recency: number;
    team2Recency: number;
    avgDaysSinceTeamed: number;
  } => {
    const n = players.length;
    if (n < 2) {
      return {
        team1: [...players],
        team2: [],
        team1Recency: 0,
        team2Recency: 0,
        avgDaysSinceTeamed: 0
      };
    }

    // Sort players deterministically for consistent results
    const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));

    const team1Size = Math.ceil(n / 2);

    // Generate all combinations of indices for team1 (reuse pattern)
    const generateCombinations = (k: number): number[][] => {
      const result: number[][] = [];
      const combine = (start: number, current: number[]) => {
        if (current.length === k) {
          result.push([...current]);
          return;
        }
        for (let i = start; i <= n - (k - current.length); i++) {
          current.push(i);
          combine(i + 1, current);
          current.pop();
        }
      };
      combine(0, []);
      return result;
    };

    const allCombinations = generateCombinations(team1Size);
    let bestTeam1Indices: number[] = [];
    let bestTotalRecency = -Infinity; // We want to MAXIMIZE

    for (const team1Indices of allCombinations) {
      const team1Set = new Set(team1Indices);
      const team1 = team1Indices.map(i => sorted[i]);
      const team2 = sorted.filter((_, i) => !team1Set.has(i));

      const recency1 = calculateTeamRecency(team1, matrix, now);
      const recency2 = calculateTeamRecency(team2, matrix, now);
      const totalRecency = recency1 + recency2;

      if (totalRecency > bestTotalRecency) {
        bestTotalRecency = totalRecency;
        bestTeam1Indices = team1Indices;
      }
      // Tie-breaker: first lexicographic combination wins (deterministic)
    }

    const team1Set = new Set(bestTeam1Indices);
    const team1 = bestTeam1Indices.map(i => sorted[i]);
    const team2 = sorted.filter((_, i) => !team1Set.has(i));
    const team1Rec = calculateTeamRecency(team1, matrix, now);
    const team2Rec = calculateTeamRecency(team2, matrix, now);

    // Calculate number of pairs: C(n,2) = n*(n-1)/2
    const team1Pairs = (team1.length * (team1.length - 1)) / 2;
    const team2Pairs = (team2.length * (team2.length - 1)) / 2;
    const totalPairs = team1Pairs + team2Pairs;
    const avgDays = totalPairs > 0 ? (team1Rec + team2Rec) / totalPairs : 0;

    return {
      team1,
      team2,
      team1Recency: team1Rec,
      team2Recency: team2Rec,
      avgDaysSinceTeamed: avgDays
    };
  };

  // Balance teams by reunion - finds teams where players haven't played together recently
  const balanceTeamsByReunion = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      const playerIds = selectedPlayers.map(p => p.id);
      const matrix = await buildRecencyMatrix(playerIds);
      const now = new Date();
      const result = findReunionTeams(selectedPlayers, matrix, now);

      setTeam1(result.team1);
      setTeam2(result.team2);
      setLastBalanceMode('reunion');
      setReunionStats({
        team1Recency: result.team1Recency,
        team2Recency: result.team2Recency,
        avgDaysSinceTeamed: result.avgDaysSinceTeamed
      });
      setNovelStats(null);
      setCustomStats(null);
      setWinRateStats(null);

      // Keep win probability collapsed by default
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams by reunion:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Balance teams by win rate - optimal assignment minimizing average win rate difference
  const balanceTeamsByWinRate = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      const { team1, team2 } = findOptimalTeams(
        selectedPlayers,
        (p) => p.totalGames > 0 ? p.wins / p.totalGames : 0.5
      );

      const team1Avg = team1.reduce((sum, p) =>
        sum + (p.totalGames > 0 ? p.wins / p.totalGames : 0.5), 0) / team1.length;
      const team2Avg = team2.reduce((sum, p) =>
        sum + (p.totalGames > 0 ? p.wins / p.totalGames : 0.5), 0) / team2.length;

      setTeam1(team1);
      setTeam2(team2);
      setLastBalanceMode('winRate');
      setNovelStats(null);
      setReunionStats(null);
      setCustomStats(null);
      setWinRateStats({
        team1AvgWinRate: team1Avg,
        team2AvgWinRate: team2Avg,
        difference: Math.abs(team1Avg - team2Avg),
      });
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams by win rate:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Helper to format days since teamed for display
  const formatDaysSinceTeamed = (days: number): string => {
    if (days >= NEVER_TEAMED_DAYS) {
      return "Never teamed!";
    } else if (days >= 365) {
      return `${(days / 365).toFixed(1)} years`;
    } else if (days >= 30) {
      return `${(days / 30).toFixed(1)} months`;
    } else {
      return `${Math.round(days)} days`;
    }
  };

  // Balance teams by skill rating - optimal assignment minimizing average skill difference
  const balanceTeams = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      const { team1, team2 } = findOptimalTeams(
        selectedPlayers,
        (p) => dbService.getDisplayRating(p)
      );

      setTeam1(team1);
      setTeam2(team2);
      setLastBalanceMode('ranking');
      setNovelStats(null);
      setReunionStats(null);
      setCustomStats(null);
      setWinRateStats(null);

      // Keep win probability collapsed by default
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Balance teams by experience - optimal assignment minimizing average games difference
  const balanceTeamsByExperience = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      const { team1, team2 } = findOptimalTeams(
        selectedPlayers,
        (p) => p.totalGames
      );

      setTeam1(team1);
      setTeam2(team2);
      setLastBalanceMode('experience');
      setNovelStats(null);
      setReunionStats(null);
      setCustomStats(null);
      setWinRateStats(null);

      // Keep win probability collapsed by default
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams by experience:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Random teams without ELO consideration
  const randomizeTeams = () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }
    
    playSound('phaseChange');
    
    // Shuffle players - ensure different shuffle each time
    const shuffled = [...selectedPlayers];
    
    // Fisher-Yates shuffle for true randomness
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Split into two teams
    const halfway = Math.ceil(shuffled.length / 2);
    setTeam1(shuffled.slice(0, halfway));
    setTeam2(shuffled.slice(halfway));
    setLastBalanceMode('random');
    setNovelStats(null);
    setReunionStats(null);
    setCustomStats(null);
    setWinRateStats(null);

    // Keep win probability collapsed by default
    setShowWinProbability(false);
  };

  // Calculate all configuration scores for custom match maker
  const calculateAllConfigurationScores = async (
    players: DBPlayer[],
    familiarityMatrix: Map<string, Map<string, number>>,
    recencyMatrix: Map<string, Map<string, Date | null>>
  ): Promise<ScoredConfiguration[]> => {
    const n = players.length;
    if (n < 4) return [];

    const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
    const team1Size = Math.ceil(n / 2);
    const now = new Date();

    // Generate all combinations
    const generateCombinations = (k: number): number[][] => {
      const result: number[][] = [];
      const combine = (start: number, current: number[]) => {
        if (current.length === k) {
          result.push([...current]);
          return;
        }
        for (let i = start; i <= n - (k - current.length); i++) {
          current.push(i);
          combine(i + 1, current);
          current.pop();
        }
      };
      combine(0, []);
      return result;
    };

    const allCombinations = generateCombinations(team1Size);
    const configurations: ScoredConfiguration[] = [];

    // Calculate raw scores for each configuration
    for (const team1Indices of allCombinations) {
      const team1Set = new Set(team1Indices);
      const team2Indices = sorted.map((_, i) => i).filter(i => !team1Set.has(i));

      const team1 = team1Indices.map(i => sorted[i]);
      const team2 = team2Indices.map(i => sorted[i]);

      // Ranking: skill difference (minimize)
      const team1AvgSkill = team1.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team1.length;
      const team2AvgSkill = team2.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team2.length;
      const rankingRaw = Math.abs(team1AvgSkill - team2AvgSkill);

      // Experience: games difference (minimize)
      const team1AvgGames = team1.reduce((sum, p) => sum + p.totalGames, 0) / team1.length;
      const team2AvgGames = team2.reduce((sum, p) => sum + p.totalGames, 0) / team2.length;
      const experienceRaw = Math.abs(team1AvgGames - team2AvgGames);

      // Novel: familiarity (minimize)
      let novelRaw = 0;
      for (let i = 0; i < team1.length; i++) {
        for (let j = i + 1; j < team1.length; j++) {
          novelRaw += familiarityMatrix.get(team1[i].id)?.get(team1[j].id) ?? 0;
        }
      }
      for (let i = 0; i < team2.length; i++) {
        for (let j = i + 1; j < team2.length; j++) {
          novelRaw += familiarityMatrix.get(team2[i].id)?.get(team2[j].id) ?? 0;
        }
      }

      // Reunion: recency in days (maximize)
      let reunionRaw = 0;
      for (let i = 0; i < team1.length; i++) {
        for (let j = i + 1; j < team1.length; j++) {
          const lastTeamed = recencyMatrix.get(team1[i].id)?.get(team1[j].id);
          if (lastTeamed === null || lastTeamed === undefined) {
            reunionRaw += NEVER_TEAMED_DAYS;
          } else {
            reunionRaw += Math.floor((now.getTime() - lastTeamed.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      }
      for (let i = 0; i < team2.length; i++) {
        for (let j = i + 1; j < team2.length; j++) {
          const lastTeamed = recencyMatrix.get(team2[i].id)?.get(team2[j].id);
          if (lastTeamed === null || lastTeamed === undefined) {
            reunionRaw += NEVER_TEAMED_DAYS;
          } else {
            reunionRaw += Math.floor((now.getTime() - lastTeamed.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      }

      // Win Rate: win rate difference (minimize)
      const team1AvgWinRate = team1.reduce((sum, p) =>
        sum + (p.totalGames > 0 ? p.wins / p.totalGames : 0.5), 0) / team1.length;
      const team2AvgWinRate = team2.reduce((sum, p) =>
        sum + (p.totalGames > 0 ? p.wins / p.totalGames : 0.5), 0) / team2.length;
      const winRateRaw = Math.abs(team1AvgWinRate - team2AvgWinRate);

      configurations.push({
        team1Indices,
        team2Indices,
        rawScores: {
          ranking: rankingRaw,
          experience: experienceRaw,
          novel: novelRaw,
          reunion: reunionRaw,
          winRate: winRateRaw,
        },
        normalizedScores: {
          ranking: 0,
          experience: 0,
          novel: 0,
          reunion: 0,
          winRate: 0,
          random: Math.random(),
        },
      });
    }

    // Normalize scores
    const rankingMin = Math.min(...configurations.map(c => c.rawScores.ranking));
    const rankingMax = Math.max(...configurations.map(c => c.rawScores.ranking));
    const experienceMin = Math.min(...configurations.map(c => c.rawScores.experience));
    const experienceMax = Math.max(...configurations.map(c => c.rawScores.experience));
    const novelMin = Math.min(...configurations.map(c => c.rawScores.novel));
    const novelMax = Math.max(...configurations.map(c => c.rawScores.novel));
    const reunionMin = Math.min(...configurations.map(c => c.rawScores.reunion));
    const reunionMax = Math.max(...configurations.map(c => c.rawScores.reunion));
    const winRateMin = Math.min(...configurations.map(c => c.rawScores.winRate));
    const winRateMax = Math.max(...configurations.map(c => c.rawScores.winRate));

    for (const config of configurations) {
      // For minimize metrics: (max - value) / (max - min) so lower raw = higher normalized
      config.normalizedScores.ranking = rankingMax === rankingMin
        ? 1
        : (rankingMax - config.rawScores.ranking) / (rankingMax - rankingMin);

      config.normalizedScores.experience = experienceMax === experienceMin
        ? 1
        : (experienceMax - config.rawScores.experience) / (experienceMax - experienceMin);

      config.normalizedScores.novel = novelMax === novelMin
        ? 1
        : (novelMax - config.rawScores.novel) / (novelMax - novelMin);

      // Win rate is also a minimize metric (minimize difference)
      config.normalizedScores.winRate = winRateMax === winRateMin
        ? 1
        : (winRateMax - config.rawScores.winRate) / (winRateMax - winRateMin);

      // For maximize metrics: (value - min) / (max - min) so higher raw = higher normalized
      config.normalizedScores.reunion = reunionMax === reunionMin
        ? 1
        : (config.rawScores.reunion - reunionMin) / (reunionMax - reunionMin);
    }

    // Normalize random values so min=0 and max=1
    const randomMin = Math.min(...configurations.map(c => c.normalizedScores.random));
    const randomMax = Math.max(...configurations.map(c => c.normalizedScores.random));

    for (const config of configurations) {
      config.normalizedScores.random = randomMax === randomMin
        ? 1
        : (config.normalizedScores.random - randomMin) / (randomMax - randomMin);
    }

    return configurations;
  };

  // Balance teams by custom weighted algorithm
  const balanceTeamsByCustom = async (weights: MatchMakerWeights) => {
    if (selectedPlayers.length < 4) {
      return;
    }

    setIsBalancing(true);
    playSound('phaseChange');

    try {
      // Build matrices if not already cached
      const playerIds = selectedPlayers.map(p => p.id);
      const familiarityMatrix = await buildFamiliarityMatrix(playerIds);
      const recencyMatrix = await buildRecencyMatrix(playerIds);

      // Calculate all configuration scores
      const configs = await calculateAllConfigurationScores(
        selectedPlayers,
        familiarityMatrix,
        recencyMatrix
      );

      if (configs.length === 0) {
        console.error('No configurations generated');
        return;
      }

      // Normalize weights
      const totalWeight = weights.ranking + weights.experience + weights.novel + weights.reunion + weights.winRate + weights.random;
      const normalizedWeights = totalWeight > 0 ? {
        ranking: weights.ranking / totalWeight,
        experience: weights.experience / totalWeight,
        novel: weights.novel / totalWeight,
        reunion: weights.reunion / totalWeight,
        winRate: weights.winRate / totalWeight,
        random: weights.random / totalWeight,
      } : {
        ranking: 1/6,
        experience: 1/6,
        novel: 1/6,
        reunion: 1/6,
        winRate: 1/6,
        random: 1/6,
      };

      // Find best configuration
      let bestConfig = configs[0];
      let bestScore = -Infinity;

      for (const config of configs) {
        const score =
          normalizedWeights.ranking * config.normalizedScores.ranking +
          normalizedWeights.experience * config.normalizedScores.experience +
          normalizedWeights.novel * config.normalizedScores.novel +
          normalizedWeights.reunion * config.normalizedScores.reunion +
          normalizedWeights.winRate * config.normalizedScores.winRate +
          normalizedWeights.random * config.normalizedScores.random;

        if (score > bestScore) {
          bestScore = score;
          bestConfig = config;
        }
      }

      // Apply the best configuration
      const sorted = [...selectedPlayers].sort((a, b) => a.id.localeCompare(b.id));
      setTeam1(bestConfig.team1Indices.map(i => sorted[i]));
      setTeam2(bestConfig.team2Indices.map(i => sorted[i]));
      setLastBalanceMode(null); // Custom mode doesn't use the standard modes
      setNovelStats(null);
      setReunionStats(null);
      setWinRateStats(null);
      setCustomStats({
        weights,
        score: bestScore,
      });
      setShowCustomModal(false);
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams by custom:', error);
    } finally {
      setIsBalancing(false);
    }
  };

  // Reset teams
  const resetTeams = () => {
    playSound('buttonClick');
    setTeam1([]);
    setTeam2([]);
    setShowWinProbability(false);
    setLastBalanceMode(null);
    setNovelStats(null);
    setReunionStats(null);
    setCustomStats(null);
    setWinRateStats(null);
  };

  // Reset selection
  const resetSelection = () => {
    playSound('buttonClick');
    setSelectedPlayers([]);
    setTeam1([]);
    setTeam2([]);
    setShowWinProbability(false);
    setLastBalanceMode(null);
    setNovelStats(null);
    setReunionStats(null);
    setCustomStats(null);
    setWinRateStats(null);
  };

  // Toggle manual team assignment mode
  const toggleManualMode = () => {
    playSound('toggleSwitch');

    // If turning off manual mode, reset teams
    if (manualMode) {
      setTeam1([]);
      setTeam2([]);
      setShowWinProbability(false);
      setLastBalanceMode(null);
      setNovelStats(null);
      setReunionStats(null);
      setCustomStats(null);
      setWinRateStats(null);
    }

    setManualMode(!manualMode);
  };
  
  // Toggle win probability display
  const toggleWinProbability = () => {
    playSound('buttonClick');
    setShowWinProbability(!showWinProbability);
  };
  
  // Manual team assignment
  const assignPlayerToTeam = (player: DBPlayer, team: 1 | 2) => {
    if (!manualMode) return;
    
    playSound('buttonClick');
    
    // Remove from other team if present
    if (team === 1) {
      setTeam2(team2.filter(p => p.id !== player.id));
      
      // If not already in team1, add to team1
      if (!team1.some(p => p.id === player.id)) {
        setTeam1([...team1, player]);
      }
    } else {
      setTeam1(team1.filter(p => p.id !== player.id));
      
      // If not already in team2, add to team2
      if (!team2.some(p => p.id === player.id)) {
        setTeam2([...team2, player]);
      }
    }
    
    // Keep win probability collapsed by default when teams change
    if ((team1.length > 0 || team === 1) && (team2.length > 0 || team === 2)) {
      setShowWinProbability(false);
    }
  };
  
  // Function to handle using the teams in game setup
  const handleUseTeams = () => {
    if (onUseTeams && team1.length > 0 && team2.length > 0) {
      playSound('phaseChange');
      
      // Extract player names from both teams
      const titanPlayerNames = team1.map(p => p.id); // Using ID which is the name
      const atlanteanPlayerNames = team2.map(p => p.id);
      
      // Call the parent component handler
      onUseTeams(titanPlayerNames, atlanteanPlayerNames);
    }
  };
  
  // Balance option card component for the new card-based UI
  const BalanceOptionCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    onClick: () => void;
    disabled: boolean;
    isActive?: boolean;
  }> = ({ title, description, icon, colorClass, onClick, disabled, isActive }) => (
    <button
      onClick={() => {
        if (!disabled) {
          playSound('buttonClick');
          onClick();
        }
      }}
      disabled={disabled}
      className={`p-4 rounded-lg border-2 text-left transition-all w-full ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-gray-600 bg-gray-700/30'
          : isActive
            ? `border-${colorClass}-500 bg-${colorClass}-900/40 ring-2 ring-${colorClass}-500`
            : `border-gray-600 hover:border-${colorClass}-500 hover:bg-${colorClass}-900/20 bg-gray-700/50`
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`text-${colorClass}-400 flex-shrink-0 mt-0.5`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-white">{title}</h4>
          <p className="text-sm text-gray-300 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );

  // Balance options configuration
  const balanceOptions = [
    {
      id: 'ranking',
      title: 'Ranking',
      description: 'Minimize skill difference between teams',
      icon: <Trophy size={22} />,
      colorClass: 'blue',
      onClick: balanceTeams,
      disabledInManual: true,
    },
    {
      id: 'experience',
      title: 'Experience',
      description: 'Balance by total games played',
      icon: <Clock size={22} />,
      colorClass: 'green',
      onClick: balanceTeamsByExperience,
      disabledInManual: true,
    },
    {
      id: 'novel',
      title: 'Novel',
      description: 'Pair players who rarely team up together',
      icon: <Sparkles size={22} />,
      colorClass: 'amber',
      onClick: balanceTeamsByNovelty,
      disabledInManual: true,
    },
    {
      id: 'reunion',
      title: 'Reunion',
      description: "Pair players who haven't teamed recently",
      icon: <Clock3 size={22} />,
      colorClass: 'indigo',
      onClick: balanceTeamsByReunion,
      disabledInManual: true,
    },
    {
      id: 'winRate',
      title: 'Win Rate',
      description: 'Balance teams by average player win rates',
      icon: <TrendingUp size={22} />,
      colorClass: 'rose',
      onClick: balanceTeamsByWinRate,
      disabledInManual: true,
    },
    {
      id: 'random',
      title: 'Random',
      description: 'Completely random team assignment',
      icon: <Shuffle size={22} />,
      colorClass: 'purple',
      onClick: randomizeTeams,
      disabledInManual: true,
    },
    {
      id: 'custom',
      title: 'Custom',
      description: 'Blend multiple factors with your own weights',
      icon: <Sliders size={22} />,
      colorClass: 'cyan',
      onClick: () => setShowCustomModal(true),
      disabledInManual: true,
    },
    {
      id: 'manual',
      title: 'Manual',
      description: 'Assign players to teams yourself',
      icon: <Users size={22} />,
      colorClass: 'gray',
      onClick: toggleManualMode,
      disabledInManual: false,
    },
  ];
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Menu</span>
        </button>
        <h2 className="text-2xl font-bold">Match Maker</h2>
      </div>
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Info Box */}
          <div className="bg-gray-700/50 p-4 rounded-lg mb-6">
            <div className="flex items-start">
              <Info size={20} className="mr-3 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">How Match Maker Works</h3>
                <p className="text-sm text-gray-300">
                  Select players to include, then balance teams based on player skill or experience (games played).
                </p>
              </div>
            </div>
          </div>
          
          {/* Player Selection Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Select Players ({selectedPlayers.length} selected)
              </h3>
              
              {selectedPlayers.length > 0 && (
                <button
                  onClick={resetSelection}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Reset Selection
                </button>
              )}
            </div>
            
            {allPlayers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {allPlayers.map((player) => {
                  const isSelected = selectedPlayers.some(p => p.id === player.id);
                  
                  return (
                    <div
                      key={player.id}
                      className={`relative p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-900/50 ring-2 ring-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      onClick={() => togglePlayerSelection(player)}
                    >
                      <div className="flex flex-col items-center">
                        <div className="font-medium mb-1 truncate w-full text-center">{player.name}</div>
                        <div className={`text-sm mb-1`}>
                          ({dbService.getDisplayRating(player)})
                        </div>
                        <div className="text-xs text-gray-400">
                          W: {player.wins} L: {player.losses}
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1">
                          <Plus size={14} className="transform rotate-45" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Users size={32} className="text-gray-500 mb-2" />
                <p className="text-gray-400">No players available</p>
              </div>
            )}
          </div>
          
          {/* Team Generation Controls - Card-based Layout */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <Award size={20} className="mr-2 text-blue-400" />
              <h3 className="text-lg font-semibold">Balance Teams</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
              {balanceOptions.map(option => (
                <BalanceOptionCard
                  key={option.id}
                  title={option.title}
                  description={option.description}
                  icon={option.icon}
                  colorClass={option.colorClass}
                  onClick={option.onClick}
                  disabled={selectedPlayers.length < 4 || isBalancing || (option.disabledInManual && manualMode)}
                  isActive={option.id === 'manual' && manualMode}
                />
              ))}
            </div>

            {/* Reset Teams Button - Only shown when teams exist */}
            {(team1.length > 0 || team2.length > 0) && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={resetTeams}
                  className="px-4 py-3 bg-red-700 hover:bg-red-600 rounded-lg flex items-center justify-center"
                >
                  <RefreshCw size={18} className="mr-2" />
                  <span>Reset Teams</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Teams Display */}
          {(team1.length > 0 || team2.length > 0) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team 1 - Titans */}
                <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                    Titans Team
                    {team1.length > 0 && (
                      <span className="ml-3 text-sm font-normal">
                        {lastBalanceMode === 'novel' && novelStats ? (
                          <>Avg Familiarity: {novelStats.avgFamiliarity.toFixed(1)}</>
                        ) : lastBalanceMode === 'reunion' && reunionStats ? (
                          <>Avg Days Apart: {formatDaysSinceTeamed(reunionStats.avgDaysSinceTeamed)}</>
                        ) : lastBalanceMode === 'winRate' && winRateStats ? (
                          <>Avg Win Rate: {(winRateStats.team1AvgWinRate * 100).toFixed(1)}%</>
                        ) : (
                          <>Avg Skill: {Math.round(team1.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team1.length)}</>
                        )}
                      </span>
                    )}
                  </h3>
                  
                  <div className="space-y-2">
                    {team1.map((player) => (
                      <div 
                        key={player.id} 
                        className="bg-blue-900/50 rounded-lg p-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-300">
                            ({dbService.getDisplayRating(player)})
                          </div>
                        </div>
                        
                        {manualMode && (
                          <button
                            onClick={() => assignPlayerToTeam(player, 2)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-red-400 hover:text-red-300"
                            aria-label="Move to Atlanteans"
                            title="Move to Atlanteans"
                          >
                            <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Team 2 - Atlanteans */}
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-3 flex items-center">
                    <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                    Atlanteans Team
                    {team2.length > 0 && (
                      <span className="ml-3 text-sm font-normal">
                        {lastBalanceMode === 'novel' && novelStats ? (
                          <>Avg Familiarity: {novelStats.avgFamiliarity.toFixed(1)}</>
                        ) : lastBalanceMode === 'reunion' && reunionStats ? (
                          <>Avg Days Apart: {formatDaysSinceTeamed(reunionStats.avgDaysSinceTeamed)}</>
                        ) : lastBalanceMode === 'winRate' && winRateStats ? (
                          <>Avg Win Rate: {(winRateStats.team2AvgWinRate * 100).toFixed(1)}%</>
                        ) : (
                          <>Avg Skill: {Math.round(team2.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team2.length)}</>
                        )}
                      </span>
                    )}
                  </h3>
                  
                  <div className="space-y-2">
                    {team2.map((player) => (
                      <div 
                        key={player.id} 
                        className="bg-red-900/50 rounded-lg p-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-300">
                            ({dbService.getDisplayRating(player)})
                          </div>
                        </div>
                        
                        {manualMode && (
                          <button
                            onClick={() => assignPlayerToTeam(player, 1)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300"
                            aria-label="Move to Titans"
                            title="Move to Titans"
                          >
                            <ArrowLeft size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Novelty Summary Banner */}
              {lastBalanceMode === 'novel' && novelStats && team1.length > 0 && team2.length > 0 && (
                <div className="mt-4 p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
                  <div className="flex items-center">
                    <Sparkles size={18} className="mr-2 text-amber-400" />
                    <span className="text-amber-200">
                      Novel Match: Avg {novelStats.avgFamiliarity.toFixed(1)} games together per pair
                      {novelStats.avgFamiliarity === 0 && " (Perfect novelty - no repeat teammates!)"}
                    </span>
                  </div>
                </div>
              )}

              {/* Reunion Summary Banner */}
              {lastBalanceMode === 'reunion' && reunionStats && team1.length > 0 && team2.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-900/30 border border-indigo-700 rounded-lg">
                  <div className="flex items-center">
                    <Clock3 size={18} className="mr-2 text-indigo-400" />
                    <span className="text-indigo-200">
                      Reunion Match: Avg {formatDaysSinceTeamed(reunionStats.avgDaysSinceTeamed)} since teammates last played together
                      {reunionStats.avgDaysSinceTeamed >= NEVER_TEAMED_DAYS && " (All new teammate pairings!)"}
                    </span>
                  </div>
                </div>
              )}

              {/* Win Rate Summary Banner */}
              {lastBalanceMode === 'winRate' && winRateStats && team1.length > 0 && team2.length > 0 && (
                <div className="mt-4 p-4 bg-rose-900/30 border border-rose-700 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp size={18} className="mr-2 text-rose-400" />
                    <span className="text-rose-200">
                      Win Rate Match: Titans {(winRateStats.team1AvgWinRate * 100).toFixed(1)}% vs Atlanteans {(winRateStats.team2AvgWinRate * 100).toFixed(1)}%
                      {winRateStats.difference < 0.01 && " (Perfect balance!)"}
                    </span>
                  </div>
                </div>
              )}

              {/* Custom Match Summary Banner */}
              {customStats && team1.length > 0 && team2.length > 0 && (
                <div className="mt-4 p-4 bg-cyan-900/30 border border-cyan-700 rounded-lg">
                  <div className="flex items-center">
                    <Sliders size={18} className="mr-2 text-cyan-400" />
                    <span className="text-cyan-200">
                      Custom Match: Weighted score {(customStats.score * 100).toFixed(1)}%
                      {' '}(
                      {customStats.weights.ranking > 0 && `Skill ${customStats.weights.ranking}%`}
                      {customStats.weights.experience > 0 && `${customStats.weights.ranking > 0 ? ', ' : ''}Exp ${customStats.weights.experience}%`}
                      {customStats.weights.novel > 0 && `${(customStats.weights.ranking > 0 || customStats.weights.experience > 0) ? ', ' : ''}Novel ${customStats.weights.novel}%`}
                      {customStats.weights.reunion > 0 && `${(customStats.weights.ranking > 0 || customStats.weights.experience > 0 || customStats.weights.novel > 0) ? ', ' : ''}Reunion ${customStats.weights.reunion}%`}
                      {customStats.weights.winRate > 0 && `${(customStats.weights.ranking > 0 || customStats.weights.experience > 0 || customStats.weights.novel > 0 || customStats.weights.reunion > 0) ? ', ' : ''}WinRate ${customStats.weights.winRate}%`}
                      {customStats.weights.random > 0 && `${(customStats.weights.ranking > 0 || customStats.weights.experience > 0 || customStats.weights.novel > 0 || customStats.weights.reunion > 0 || customStats.weights.winRate > 0) ? ', ' : ''}Random ${customStats.weights.random}%`}
                      )
                    </span>
                  </div>
                </div>
              )}

              {/* Use These Teams Button */}
              {team1.length > 0 && team2.length > 0 && onUseTeams && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleUseTeams}
                    className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-lg flex items-center text-xl"
                  >
                    <Play size={24} className="mr-3" />
                    Use These Teams in Game Setup
                  </button>
                </div>
              )}
            </>
          )}
          
          {/* Unassigned Players (Manual Mode) */}
          {manualMode && selectedPlayers.length > 0 && (
            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-3">Unassigned Players</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedPlayers.filter(p => 
                  !team1.some(t1 => t1.id === p.id) && 
                  !team2.some(t2 => t2.id === p.id)
                ).map((player) => (
                  <div 
                    key={player.id} 
                    className="bg-gray-800 rounded-lg p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-gray-300">
                        ({dbService.getDisplayRating(player)})
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => assignPlayerToTeam(player, 1)}
                        className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded-md text-xs"
                      >
                        Titans
                      </button>
                      <button
                        onClick={() => assignPlayerToTeam(player, 2)}
                        className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded-md text-xs"
                      >
                        Atlanteans
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Enhanced Win Probability Display */}
          {winProbability !== null && team1.length > 0 && team2.length > 0 && (
            <div className="mt-8 bg-gray-700 rounded-lg overflow-hidden">
              {/* Collapsible Header */}
              <div 
                className="p-4 bg-gray-700 cursor-pointer flex justify-between items-center"
                onClick={toggleWinProbability}
              >
                <h3 className="font-semibold flex items-center">
                  <Award size={16} className="mr-2 text-yellow-400" />
                  Predicted Win Probability
                </h3>
                {showWinProbability ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
              
              {/* Collapsible Content */}
              {showWinProbability && (
                <div className="p-6 pb-4 border-t border-gray-600">
                  <WinProbabilityVisualization 
                    probability={winProbability}
                    team1Name="Titans"
                    team2Name="Atlanteans"
                  />
                  
                  <div className="mt-4 text-sm text-gray-300">
                    <p className="mb-2">
                      Prediction based on TrueSkill ratings. The diamond shows the point estimate, and the shaded region shows the 95% confidence interval.
                    </p>
                    <p>
                      <strong>Wider bands</strong> indicate less certainty (teams with newer players). <strong>Narrow bands</strong> indicate high confidence in the prediction.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Manual Mode Instructions */}
          {manualMode && (
            <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
              <p className="flex items-start">
                <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>
                  Manual Mode allows you to assign players to teams directly.
                  Use the arrow buttons to move players between teams or the team buttons for unassigned players.
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Custom Match Maker Modal */}
      <CustomMatchMakerModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onGenerate={balanceTeamsByCustom}
        disabled={selectedPlayers.length < 4}
        isGenerating={isBalancing}
      />
    </div>
  );
};

export default MatchMaker;