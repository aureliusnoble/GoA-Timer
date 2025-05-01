// src/components/matches/MatchMaker.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Shuffle, Award, Info, Plus, ArrowRight, ArrowLeft, RefreshCw, Play } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { Team } from '../../types';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';

interface MatchMakerProps {
  onBack: () => void;
  // NEW: Add prop for using teams in setup
  onUseTeams?: (titanPlayers: string[], atlanteanPlayers: string[]) => void;
}

const MatchMaker: React.FC<MatchMakerProps> = ({ onBack, onUseTeams }) => {
  const { playSound } = useSound();
  const [allPlayers, setAllPlayers] = useState<DBPlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<DBPlayer[]>([]);
  const [team1, setTeam1] = useState<DBPlayer[]>([]);
  const [team2, setTeam2] = useState<DBPlayer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBalancing, setIsBalancing] = useState<boolean>(false);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const [winProbability, setWinProbability] = useState<number | null>(null);
  
  // Load player data on component mount
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      try {
        // Get all players from the database
        const players = await dbService.getAllPlayers();
        
        // Sort by name
        players.sort((a, b) => a.name.localeCompare(b.name));
        
        setAllPlayers(players);
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
    if (team1.length > 0 && team2.length > 0) {
      // Calculate average ELO for each team
      const team1Elo = team1.reduce((sum, player) => sum + player.elo, 0) / team1.length;
      const team2Elo = team2.reduce((sum, player) => sum + player.elo, 0) / team2.length;
      
      // Calculate win probability
      const probability = dbService.calculateWinProbability(team1Elo, team2Elo);
      setWinProbability(probability);
    } else {
      setWinProbability(null);
    }
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
  
  // Balance teams automatically
  const balanceTeams = async () => {
    if (selectedPlayers.length < 4) {
      return; // Not enough players
    }
    
    setIsBalancing(true);
    playSound('phaseChange');
    
    try {
      // Get balanced teams from the database service
      const playerIds = selectedPlayers.map(p => p.id);
      const { team1: team1Ids, team2: team2Ids } = await dbService.generateBalancedTeams(playerIds);
      
      // Map IDs back to player objects
      const team1Players = team1Ids.map(id => selectedPlayers.find(p => p.id === id)!);
      const team2Players = team2Ids.map(id => selectedPlayers.find(p => p.id === id)!);
      
      setTeam1(team1Players);
      setTeam2(team2Players);
    } catch (error) {
      console.error('Error balancing teams:', error);
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
    
    // Shuffle players
    const shuffled = [...selectedPlayers].sort(() => Math.random() - 0.5);
    
    // Split into two teams
    const halfway = Math.ceil(shuffled.length / 2);
    setTeam1(shuffled.slice(0, halfway));
    setTeam2(shuffled.slice(halfway));
  };
  
  // Reset teams
  const resetTeams = () => {
    playSound('buttonClick');
    setTeam1([]);
    setTeam2([]);
  };
  
  // Reset selection
  const resetSelection = () => {
    playSound('buttonClick');
    setSelectedPlayers([]);
    setTeam1([]);
    setTeam2([]);
  };
  
  // Toggle manual team assignment mode
  const toggleManualMode = () => {
    playSound('toggleSwitch');
    
    // If turning off manual mode, reset teams
    if (manualMode) {
      setTeam1([]);
      setTeam2([]);
    }
    
    setManualMode(!manualMode);
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
  };
  
  // NEW: Function to handle using the teams in game setup
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
  
  // Helper function to get ELO tier
  const getELOTier = (elo: number): { tier: string; color: string } => {
    if (elo >= 2000) return { tier: 'Grandmaster', color: 'text-purple-400' };
    if (elo >= 1800) return { tier: 'Master', color: 'text-indigo-400' };
    if (elo >= 1600) return { tier: 'Diamond', color: 'text-blue-400' };
    if (elo >= 1400) return { tier: 'Platinum', color: 'text-teal-400' };
    if (elo >= 1200) return { tier: 'Gold', color: 'text-yellow-400' };
    if (elo >= 1000) return { tier: 'Silver', color: 'text-gray-400' };
    return { tier: 'Bronze', color: 'text-orange-400' };
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
                  Select players to include, then click "Balance Teams" to generate balanced teams based on ELO ratings.
                  The system will attempt to create two teams with similar average skill levels for fair matches.
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
                  const eloTier = getELOTier(player.elo);
                  
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
                        <div className={`text-sm mb-1 ${eloTier.color}`}>
                          {eloTier.tier} ({player.elo})
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
          
          {/* Team Generation Controls */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <button
              onClick={balanceTeams}
              disabled={selectedPlayers.length < 4 || isBalancing || manualMode}
              className={`px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg flex items-center ${
                selectedPlayers.length < 4 || isBalancing || manualMode ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isBalancing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Balancing...</span>
                </>
              ) : (
                <>
                  <Award size={18} className="mr-2" />
                  <span>Balance Teams (ELO Based)</span>
                </>
              )}
            </button>
            
            <button
              onClick={randomizeTeams}
              disabled={selectedPlayers.length < 4 || manualMode}
              className={`px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center ${
                selectedPlayers.length < 4 || manualMode ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Shuffle size={18} className="mr-2" />
              <span>Random Teams</span>
            </button>
            
            <button
              onClick={toggleManualMode}
              disabled={selectedPlayers.length < 4}
              className={`px-6 py-3 rounded-lg flex items-center ${
                selectedPlayers.length < 4 ? 'opacity-50 cursor-not-allowed' : 
                manualMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              <Users size={18} className="mr-2" />
              <span>{manualMode ? 'Manual Mode (Enabled)' : 'Manual Mode'}</span>
            </button>
            
            {(team1.length > 0 || team2.length > 0) && (
              <button
                onClick={resetTeams}
                className="px-6 py-3 bg-red-700 hover:bg-red-600 rounded-lg flex items-center"
              >
                <RefreshCw size={18} className="mr-2" />
                <span>Reset Teams</span>
              </button>
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
                        Avg ELO: {Math.round(team1.reduce((sum, p) => sum + p.elo, 0) / team1.length)}
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
                            {getELOTier(player.elo).tier} ({player.elo})
                          </div>
                        </div>
                        
                        {/* UPDATED: Changed X to ArrowRight icon */}
                        {manualMode && (
                          <EnhancedTooltip text="Move to Atlanteans team">
                            <button
                              onClick={() => assignPlayerToTeam(player, 2)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-red-400 hover:text-red-300"
                              aria-label="Move to Atlanteans"
                            >
                              <ArrowRight size={16} />
                            </button>
                          </EnhancedTooltip>
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
                        Avg ELO: {Math.round(team2.reduce((sum, p) => sum + p.elo, 0) / team2.length)}
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
                            {getELOTier(player.elo).tier} ({player.elo})
                          </div>
                        </div>
                        
                        {/* UPDATED: Changed X to ArrowLeft icon */}
                        {manualMode && (
                          <EnhancedTooltip text="Move to Titans team">
                            <button
                              onClick={() => assignPlayerToTeam(player, 1)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-blue-400 hover:text-blue-300"
                              aria-label="Move to Titans"
                            >
                              <ArrowLeft size={16} />
                            </button>
                          </EnhancedTooltip>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* NEW: "Use These Teams" button */}
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
                        {getELOTier(player.elo).tier} ({player.elo})
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
          
          {/* Win Probability Display */}
          {winProbability !== null && team1.length > 0 && team2.length > 0 && (
            <div className="mt-8 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-3">Predicted Win Probability</h3>
              
              <div className="flex items-center mb-2">
                <div className="w-24 text-blue-400 font-medium">Titans</div>
                <div className="flex-grow h-5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600" 
                    style={{ width: `${winProbability}%` }}
                  ></div>
                </div>
                <div className="w-12 ml-3 font-medium">{winProbability}%</div>
              </div>
              
              <div className="flex items-center">
                <div className="w-24 text-red-400 font-medium">Atlanteans</div>
                <div className="flex-grow h-5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-600" 
                    style={{ width: `${100 - winProbability}%` }}
                  ></div>
                </div>
                <div className="w-12 ml-3 font-medium">{100 - winProbability}%</div>
              </div>
              
              <div className="mt-4 text-sm text-gray-300">
                Prediction based on team average ELO ratings. Closer to 50% means more balanced teams.
              </div>
            </div>
          )}
          
          {/* Manual Mode Instructions */}
          {manualMode && (
            <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
              <p className="flex items-center">
                <Info size={16} className="mr-2 text-blue-400" />
                Manual Mode allows you to assign players to teams directly. Use the arrow buttons to move players between teams.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchMaker;