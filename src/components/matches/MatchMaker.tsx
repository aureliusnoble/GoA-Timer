// src/components/matches/MatchMaker.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Shuffle, Award, Info, Plus, ArrowRight, ArrowLeft, RefreshCw, Play, Trophy, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';

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
        <div className="relative h-8 bg-gray-700 rounded-lg">
          {/* Confidence interval bar */}
          <div
            className="absolute h-6 top-1 bg-blue-600/25 rounded-full"
            style={{
              left: `${probability.team1Lower}%`,
              width: `${probability.team1Upper - probability.team1Lower}%`
            }}
          />
          {/* CI Labels */}
          <span
            className="absolute -top-7 text-xs text-blue-400 whitespace-nowrap"
            style={{
              left: `${probability.team1Lower}%`,
              transform: probability.team1Lower < 5 ? 'translateX(0)' : 'translateX(-50%)'
            }}
          >
            {probability.team1Lower}%
          </span>
          <span
            className="absolute -top-7 text-xs text-blue-400 whitespace-nowrap"
            style={{
              left: `${probability.team1Upper}%`,
              transform: probability.team1Upper > 95 ? 'translateX(-100%)' : 'translateX(-50%)'
            }}
          >
            {probability.team1Upper}%
          </span>
          {/* Point estimate diamond */}
          <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${probability.team1Probability}%` }}>
            <div className="relative">
              {/* Centered probability label */}
              <span className="absolute -top-8 left-1/2 transform -translate-x-5 text-sm font-bold text-white whitespace-nowrap">
                {probability.team1Probability}%
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
        <div className="relative h-8 bg-gray-700 rounded-lg">
          {/* Confidence interval bar */}
          <div
            className="absolute h-6 top-1 bg-red-600/25 rounded-full"
            style={{
              left: `${probability.team2Lower}%`,
              width: `${probability.team2Upper - probability.team2Lower}%`
            }}
          />
          {/* CI Labels */}
          <span
            className="absolute -top-7 text-xs text-red-400 whitespace-nowrap"
            style={{
              left: `${probability.team2Lower}%`,
              transform: probability.team2Lower < 5 ? 'translateX(0)' : 'translateX(-50%)'
            }}
          >
            {probability.team2Lower}%
          </span>
          <span
            className="absolute -top-7 text-xs text-red-400 whitespace-nowrap"
            style={{
              left: `${probability.team2Upper}%`,
              transform: probability.team2Upper > 95 ? 'translateX(-100%)' : 'translateX(-50%)'
            }}
          >
            {probability.team2Upper}%
          </span>
          {/* Point estimate diamond */}
          <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${probability.team2Probability}%` }}>
            <div className="relative">
              {/* Centered probability label */}
              <span className="absolute -top-8 left-1/2 transform -translate-x-5 text-sm font-bold text-white whitespace-nowrap">
                {probability.team2Probability}%
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
  
  // Enhanced balance teams by ELO with randomization for multiple valid solutions
  const balanceTeams = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }
    
    setIsBalancing(true);
    playSound('phaseChange');
    
    try {
      // Get balanced teams from the database service
      const playerIds = selectedPlayers.map(p => p.id);
      
      // Add randomization by shuffling players with similar ratings
      const shuffledPlayers = [...selectedPlayers];
      
      // Group players by similar skill levels (within 100 rating points)
      const ratingGroups: DBPlayer[][] = [];
      const sortedByRating = [...shuffledPlayers].sort((a, b) => 
        dbService.getDisplayRating(b) - dbService.getDisplayRating(a)
      );
      
      sortedByRating.forEach(player => {
        const rating = dbService.getDisplayRating(player);
        let added = false;
        
        for (const group of ratingGroups) {
          const groupRating = dbService.getDisplayRating(group[0]);
          if (Math.abs(rating - groupRating) <= 100) {
            group.push(player);
            added = true;
            break;
          }
        }
        
        if (!added) {
          ratingGroups.push([player]);
        }
      });
      
      // Shuffle within each rating group
      ratingGroups.forEach(group => {
        for (let i = group.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [group[i], group[j]] = [group[j], group[i]];
        }
      });
      
      // Flatten back to player list
      const randomizedPlayers = ratingGroups.flat();
      
      // Use greedy algorithm with randomized order
      const team1Players: DBPlayer[] = [];
      const team2Players: DBPlayer[] = [];
      
      randomizedPlayers.forEach(player => {
        const team1Skill = team1Players.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0);
        const team2Skill = team2Players.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0);
        
        if (team1Skill <= team2Skill) {
          team1Players.push(player);
        } else {
          team2Players.push(player);
        }
      });
      
      setTeam1(team1Players);
      setTeam2(team2Players);
      
      // Keep win probability collapsed by default
      setShowWinProbability(false);
    } catch (error) {
      console.error('Error balancing teams:', error);
    } finally {
      setIsBalancing(false);
    }
  };
  
  // Enhanced balance teams by experience with randomization
  const balanceTeamsByExperience = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }
    
    setIsBalancing(true);
    playSound('phaseChange');
    
    try {
      // Add randomization by shuffling players with similar experience
      const shuffledPlayers = [...selectedPlayers];
      
      // Group players by similar experience levels
      const experienceGroups: DBPlayer[][] = [];
      const sortedByGames = [...shuffledPlayers].sort((a, b) => b.totalGames - a.totalGames);
      
      sortedByGames.forEach(player => {
        const games = player.totalGames;
        let added = false;
        
        for (const group of experienceGroups) {
          const groupGames = group[0].totalGames;
          // Group players within 5 games of each other
          if (Math.abs(games - groupGames) <= 5) {
            group.push(player);
            added = true;
            break;
          }
        }
        
        if (!added) {
          experienceGroups.push([player]);
        }
      });
      
      // Shuffle within each experience group
      experienceGroups.forEach(group => {
        for (let i = group.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [group[i], group[j]] = [group[j], group[i]];
        }
      });
      
      // Flatten back to player list
      const randomizedPlayers = experienceGroups.flat();
      
      // Use greedy algorithm with randomized order
      const team1Players: DBPlayer[] = [];
      const team2Players: DBPlayer[] = [];
      
      randomizedPlayers.forEach(player => {
        const team1Games = team1Players.reduce((sum, p) => sum + p.totalGames, 0);
        const team2Games = team2Players.reduce((sum, p) => sum + p.totalGames, 0);
        
        if (team1Games <= team2Games) {
          team1Players.push(player);
        } else {
          team2Players.push(player);
        }
      });
      
      setTeam1(team1Players);
      setTeam2(team2Players);
      
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
    
    // Keep win probability collapsed by default
    setShowWinProbability(false);
  };
  
  // Reset teams
  const resetTeams = () => {
    playSound('buttonClick');
    setTeam1([]);
    setTeam2([]);
    setShowWinProbability(false);
  };
  
  // Reset selection
  const resetSelection = () => {
    playSound('buttonClick');
    setSelectedPlayers([]);
    setTeam1([]);
    setTeam2([]);
    setShowWinProbability(false);
  };
  
  // Toggle manual team assignment mode
  const toggleManualMode = () => {
    playSound('toggleSwitch');
    
    // If turning off manual mode, reset teams
    if (manualMode) {
      setTeam1([]);
      setTeam2([]);
      setShowWinProbability(false);
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
  
  // Tooltip text definitions for buttons
  const tooltips = {
    ranking: "Balance teams based on player ELO ratings to create fair matches. Higher ELO players will be evenly distributed to make teams equally skilled. Click multiple times for different configurations.",
    experience: "Balance teams based on player experience (total games played), ensuring both teams have a mix of experienced and newer players. Click multiple times for different configurations.",
    random: "Create random teams without consideration for player skill or experience. Each click generates a completely new random configuration.",
    manual: "Enable manual team assignment mode to create teams by hand. You can move players between teams freely to create custom matchups.",
    reset: "Reset both teams and start over. Player selection will be maintained but no players will be assigned to teams."
  };
  
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
          
          {/* Team Generation Controls - SIMPLIFIED LAYOUT */}
          <div className="mb-8">
            {/* Balance Teams Box */}
            <div className="mb-4">
              <div className="bg-gray-700/30 p-4 rounded-lg mx-auto max-w-2xl">
                {/* Balance Teams Header */}
                <div className="flex items-center justify-center bg-gray-700/80 p-2 rounded-t-lg mb-3">
                  <Award size={18} className="mr-2 text-blue-400" />
                  <span className="font-medium">Balance Teams</span>
                </div>
                
                {/* Balance Team Buttons - Vertical on mobile, horizontal on larger screens */}
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  {/* Balance by Ranking Button */}
                  <div className="hidden sm:block">
                    <EnhancedTooltip text={tooltips.ranking} maxWidth="max-w-md">
                      <button
                        onClick={balanceTeams}
                        disabled={selectedPlayers.length < 4 || isBalancing || manualMode}
                        className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                          selectedPlayers.length < 4 || isBalancing || manualMode 
                            ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                            : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                      >
                        {isBalancing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Trophy size={18} className="mr-2" />
                        )}
                        <span>On Ranking</span>
                      </button>
                    </EnhancedTooltip>
                  </div>
                  
                  {/* Mobile version without tooltip */}
                  <div className="sm:hidden">
                    <button
                      onClick={balanceTeams}
                      disabled={selectedPlayers.length < 4 || isBalancing || manualMode}
                      className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                        selectedPlayers.length < 4 || isBalancing || manualMode 
                          ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                          : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {isBalancing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Trophy size={18} className="mr-2" />
                      )}
                      <span>On Ranking</span>
                    </button>
                  </div>
                  
                  {/* Balance by Experience Button */}
                  <div className="hidden sm:block">
                    <EnhancedTooltip text={tooltips.experience} maxWidth="max-w-md">
                      <button
                        onClick={balanceTeamsByExperience}
                        disabled={selectedPlayers.length < 4 || isBalancing || manualMode}
                        className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                          selectedPlayers.length < 4 || isBalancing || manualMode 
                            ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                            : 'bg-green-600 hover:bg-green-500'
                        }`}
                      >
                        {isBalancing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Clock size={18} className="mr-2" />
                        )}
                        <span>On Experience</span>
                      </button>
                    </EnhancedTooltip>
                  </div>
                  
                  {/* Mobile version without tooltip */}
                  <div className="sm:hidden">
                    <button
                      onClick={balanceTeamsByExperience}
                      disabled={selectedPlayers.length < 4 || isBalancing || manualMode}
                      className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                        selectedPlayers.length < 4 || isBalancing || manualMode 
                          ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                          : 'bg-green-600 hover:bg-green-500'
                      }`}
                    >
                      {isBalancing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Clock size={18} className="mr-2" />
                      )}
                      <span>On Experience</span>
                    </button>
                  </div>
                  
                  {/* Random Teams Button */}
                  <div className="hidden sm:block">
                    <EnhancedTooltip text={tooltips.random} maxWidth="max-w-md">
                      <button
                        onClick={randomizeTeams}
                        disabled={selectedPlayers.length < 4 || manualMode}
                        className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                          selectedPlayers.length < 4 || manualMode 
                            ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                            : 'bg-purple-600 hover:bg-purple-500'
                        }`}
                      >
                        <Shuffle size={18} className="mr-2" />
                        <span>Random</span>
                      </button>
                    </EnhancedTooltip>
                  </div>
                  
                  {/* Mobile version without tooltip */}
                  <div className="sm:hidden">
                    <button
                      onClick={randomizeTeams}
                      disabled={selectedPlayers.length < 4 || manualMode}
                      className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                        selectedPlayers.length < 4 || manualMode 
                          ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                          : 'bg-purple-600 hover:bg-purple-500'
                      }`}
                    >
                      <Shuffle size={18} className="mr-2" />
                      <span>Random</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Manual Mode and Reset Teams Buttons - Centered below Balance Teams */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              {/* Manual Mode Button - Desktop with tooltip */}
              <div className="hidden sm:block">
                <EnhancedTooltip text={tooltips.manual} maxWidth="max-w-md">
                  <button
                    onClick={toggleManualMode}
                    disabled={selectedPlayers.length < 4}
                    className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                      selectedPlayers.length < 4 
                        ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                        : manualMode 
                          ? 'bg-blue-600 hover:bg-blue-500' 
                          : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <Users size={18} className="mr-2" />
                    <span>Manual Mode</span>
                  </button>
                </EnhancedTooltip>
              </div>
              
              {/* Manual Mode Button - Mobile without tooltip */}
              <div className="sm:hidden">
                <button
                  onClick={toggleManualMode}
                  disabled={selectedPlayers.length < 4}
                  className={`px-4 py-3 w-full rounded-lg flex items-center justify-center ${
                    selectedPlayers.length < 4 
                      ? 'opacity-50 cursor-not-allowed bg-gray-600' 
                      : manualMode 
                        ? 'bg-blue-600 hover:bg-blue-500' 
                        : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Users size={18} className="mr-2" />
                  <span>Manual Mode</span>
                </button>
              </div>
              
              {/* Reset Teams Button - Only shown when teams exist */}
              {(team1.length > 0 || team2.length > 0) && (
                <>
                  {/* Desktop with tooltip */}
                  <div className="hidden sm:block">
                    <EnhancedTooltip text={tooltips.reset} maxWidth="max-w-md">
                      <button
                        onClick={resetTeams}
                        className="px-4 py-3 w-full bg-red-700 hover:bg-red-600 rounded-lg flex items-center justify-center"
                      >
                        <RefreshCw size={18} className="mr-2" />
                        <span>Reset Teams</span>
                      </button>
                    </EnhancedTooltip>
                  </div>
                  
                  {/* Mobile without tooltip */}
                  <div className="sm:hidden">
                    <button
                      onClick={resetTeams}
                      className="px-4 py-3 w-full bg-red-700 hover:bg-red-600 rounded-lg flex items-center justify-center"
                    >
                      <RefreshCw size={18} className="mr-2" />
                      <span>Reset Teams</span>
                    </button>
                  </div>
                </>
              )}
            </div>
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
                        Avg Skill: {Math.round(team1.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team1.length)}
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
                          <>
                            {/* Desktop with tooltip */}
                            <div className="hidden sm:block">
                              <EnhancedTooltip text="Move to Atlanteans team">
                                <button
                                  onClick={() => assignPlayerToTeam(player, 2)}
                                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-red-400 hover:text-red-300"
                                  aria-label="Move to Atlanteans"
                                >
                                  <ArrowRight size={16} />
                                </button>
                              </EnhancedTooltip>
                            </div>
                            
                            {/* Mobile without tooltip */}
                            <div className="sm:hidden">
                              <button
                                onClick={() => assignPlayerToTeam(player, 2)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-red-400 hover:text-red-300"
                                aria-label="Move to Atlanteans"
                              >
                                <ArrowRight size={16} />
                              </button>
                            </div>
                          </>
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
                        Avg Skill: {Math.round(team2.reduce((sum, p) => sum + dbService.getDisplayRating(p), 0) / team2.length)}
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
                          <>
                            {/* Desktop with tooltip */}
                            <div className="hidden sm:block">
                              <EnhancedTooltip text="Move to Titans team">
                                <button
                                  onClick={() => assignPlayerToTeam(player, 1)}
                                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300"
                                  aria-label="Move to Titans"
                                >
                                  <ArrowLeft size={16} />
                                </button>
                              </EnhancedTooltip>
                            </div>
                            
                            {/* Mobile without tooltip */}
                            <div className="sm:hidden">
                              <button
                                onClick={() => assignPlayerToTeam(player, 1)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300"
                                aria-label="Move to Titans"
                              >
                                <ArrowLeft size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
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
                      Prediction based on TrueSkill ratings. The scale shows win probability from 0% to 100%.
                    </p>
                    <p className="text-xs text-gray-400">
                      The rounded bars show 95% confidence intervals - wider bars indicate greater uncertainty.
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
    </div>
  );
};

export default MatchMaker;