// src/components/matches/PlayerStats.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Award, TrendingUp, Users, Swords, Skull, Info } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';

interface PlayerStatsProps {
  onBack: () => void;
}

interface PlayerWithStats extends DBPlayer {
  favoriteHeroes: { heroId: number; heroName: string; count: number }[];
  favoriteRoles: { role: string; count: number }[];
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kdRatio: number; // Changed from kda to kdRatio
  averageGold: number;
  averageMinionKills: number;
  hasCombatStats: boolean; // New field to track if player has any combat stats
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>('elo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Load player data on component mount
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      try {
        // Get all players from the database
        const allPlayers = await dbService.getAllPlayers();
        
        // Get detailed stats for each player
        const playersWithStats = await Promise.all(
          allPlayers.map(async (player) => {
            const stats = await dbService.getPlayerStats(player.id);
            const matchesPlayed = stats.matchesPlayed;
            
            // Calculate additional stats
            const kills = matchesPlayed.reduce((sum, match) => sum + (match.kills || 0), 0);
            const deaths = matchesPlayed.reduce((sum, match) => sum + (match.deaths || 0), 0);
            const assists = matchesPlayed.reduce((sum, match) => sum + (match.assists || 0), 0);
            const gold = matchesPlayed.reduce((sum, match) => sum + (match.goldEarned || 0), 0);
            const minionKills = matchesPlayed.reduce((sum, match) => sum + (match.minionKills || 0), 0);
            
            // Calculate KD ratio: Kills / Deaths, or just Kills if Deaths is 0
            // Changed to remove assists from calculation
            const kdRatio = deaths === 0 ? kills : kills / deaths;
            
            // Calculate win rate percentage
            const winRate = player.totalGames > 0 ? (player.wins / player.totalGames) * 100 : 0;
            
            // Determine if player has any combat stats logged
            const hasCombatStats = kills > 0 || deaths > 0 || assists > 0 || gold > 0;
            
            return {
              ...player,
              favoriteHeroes: stats.favoriteHeroes,
              favoriteRoles: stats.favoriteRoles,
              winRate,
              kills,
              deaths,
              assists,
              kdRatio: parseFloat(kdRatio.toFixed(2)),
              averageGold: player.totalGames > 0 ? Math.round(gold / player.totalGames) : 0,
              averageMinionKills: player.totalGames > 0 ? Math.round(minionKills / player.totalGames) : 0,
              hasCombatStats
            };
          })
        );
        
        // Filter out players with no match data (totalGames === 0)
        const playersWithMatches = playersWithStats.filter(player => player.totalGames > 0);
        
        setPlayers(playersWithMatches);
      } catch (error) {
        console.error('Error loading player stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPlayers();
  }, []);
  
  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  // Filter players based on search term
  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort players based on selected criteria
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    // Handle different sort fields
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'elo':
        comparison = a.elo - b.elo;
        break;
      case 'games':
        comparison = a.totalGames - b.totalGames;
        break;
      case 'winRate':
        comparison = a.winRate - b.winRate;
        break;
      case 'kdRatio': // Changed from kda to kdRatio
        comparison = a.kdRatio - b.kdRatio;
        break;
      default:
        comparison = 0;
    }
    
    // Apply sort order
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // Handle sort button click
  const handleSort = (field: string) => {
    playSound('buttonClick');
    
    // If clicking the same field, toggle sort order
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field and default to descending
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  // Helper function to show ELO tier
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
        <h2 className="text-2xl font-bold">Player Statistics</h2>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search players..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          {/* Sort Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSort('elo')}
              className={`px-3 py-1 rounded ${
                sortBy === 'elo' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              ELO {sortBy === 'elo' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('games')}
              className={`px-3 py-1 rounded ${
                sortBy === 'games' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Games {sortBy === 'games' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('winRate')}
              className={`px-3 py-1 rounded ${
                sortBy === 'winRate' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Win Rate {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('kdRatio')}
              className={`px-3 py-1 rounded ${
                sortBy === 'kdRatio' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              KD Ratio {sortBy === 'kdRatio' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-1 rounded ${
                sortBy === 'name' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Player Cards Grid */}
          {sortedPlayers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedPlayers.map((player) => {
                const eloTier = getELOTier(player.elo);
                
                return (
                  <div key={player.id} className="bg-gray-700 rounded-lg overflow-hidden shadow-md">
                    {/* Player Header */}
                    <div className="px-5 py-4 bg-gray-800 flex justify-between items-center">
                      <h3 className="text-xl font-bold truncate">{player.name}</h3>
                      <div className="flex items-center">
                        <EnhancedTooltip text={`ELO Rating: ${player.elo}`}>
                          <div className={`flex items-center ${eloTier.color}`}>
                            <Award size={18} className="mr-1" />
                            <span>{eloTier.tier}</span>
                          </div>
                        </EnhancedTooltip>
                      </div>
                    </div>
                    
                    {/* Player Stats */}
                    <div className="p-4">
                      {/* Win/Loss Stats */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm text-gray-400">Win Rate</div>
                          <div className="font-medium">{player.winRate.toFixed(1)}%</div>
                        </div>
                        <div className="h-2 bg-red-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${player.winRate}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                          <span>Wins: {player.wins}</span>
                          <span>Losses: {player.losses}</span>
                          <span>Total: {player.totalGames}</span>
                        </div>
                      </div>
                      
                      {/* Combat Stats - Only show if player has combat stats */}
                      {player.hasCombatStats && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-blue-400 text-sm mb-1">
                              <Swords size={14} className="mr-1" />
                              <span>K/D/A</span>
                            </div>
                            <div className="font-medium text-center">
                              {player.kills}/{player.deaths}/{player.assists}
                            </div>
                          </div>
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-yellow-400 text-sm mb-1">
                              <TrendingUp size={14} className="mr-1" />
                              <span>KD Ratio</span>
                            </div>
                            <div className="font-medium text-center">{player.kdRatio}</div>
                          </div>
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-green-400 text-sm mb-1">
                              <Users size={14} className="mr-1" />
                              <span>Avg Gold</span>
                            </div>
                            <div className="font-medium text-center">{player.averageGold}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Favorite Heroes */}
                      <div className="mb-4">
                        <div className="text-sm text-gray-400 mb-2">Favorite Heroes</div>
                        {player.favoriteHeroes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {player.favoriteHeroes.map((hero) => (
                              <div 
                                key={hero.heroId} 
                                className="bg-gray-800 px-3 py-1 rounded-full text-sm"
                              >
                                {hero.heroName} ({hero.count})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No heroes played</div>
                        )}
                      </div>
                      
                      {/* Favorite Roles */}
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Favorite Roles</div>
                        {player.favoriteRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {player.favoriteRoles.map((role) => (
                              <div 
                                key={role.role} 
                                className="bg-gray-800 px-3 py-1 rounded-full text-sm"
                              >
                                {role.role} ({role.count})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No roles data</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users size={48} className="text-gray-500 mb-4" />
              <p className="text-xl text-gray-400">
                {searchTerm ? 'No players found matching your search' : 'No player data available'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* ELO Information */}
      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
        <h4 className="font-medium mb-2 flex items-center">
          <Info size={16} className="mr-2 text-blue-400" />
          About ELO Ratings
        </h4>
        <p>
          ELO ratings are calculated based on match results and opponent skill. Players start at 1200 ELO.
          Higher ratings indicate stronger players. Ratings are used for team balancing in Match Maker. These
          ratings are calculated relative to your player group.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <div className="text-purple-400">Grandmaster: 2000+</div>
          <div className="text-indigo-400">Master: 1800-1999</div>
          <div className="text-blue-400">Diamond: 1600-1799</div>
          <div className="text-teal-400">Platinum: 1400-1599</div>
          <div className="text-yellow-400">Gold: 1200-1399</div>
          <div className="text-gray-400">Silver: 1000-1199</div>
          <div className="text-orange-400">Bronze: &lt;1000</div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStats;