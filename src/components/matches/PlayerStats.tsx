// src/components/matches/PlayerStats.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, TrendingUp, Users, Swords, Info, Trophy, Medal, Hexagon } from 'lucide-react';
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
  rank: number; // New field for player ranking
}

// Component to display player rank with distinctive styling
const RankDisplay: React.FC<{ rank: number; elo: number }> = ({ rank, elo }) => {
  // Determine icon and styling based on rank
  let icon;
  let rankClass;
  
  if (rank === 1) {
    // Gold trophy for 1st place
    icon = <Trophy size={18} className="mr-2 text-yellow-300" />;
    rankClass = "text-yellow-300 font-bold";
  } else if (rank === 2) {
    // Silver medal for 2nd place
    icon = <Medal size={18} className="mr-2 text-gray-300" />;
    rankClass = "text-gray-300 font-bold";
  } else if (rank === 3) {
    // Bronze medal for 3rd place
    icon = <Medal size={18} className="mr-2 text-amber-600" />;
    rankClass = "text-amber-600 font-bold";
  } else {
    // Everyone else (4+) gets a blue hexagon icon
    icon = <Hexagon size={18} className="mr-2 text-blue-400" />;
    rankClass = "text-blue-400 font-medium";
  }
  
  return (
    <div className="flex items-center">
      {icon}
      <span className={rankClass}>
        #{rank} <span className="ml-1 text-sm text-gray-400">({elo})</span>
      </span>
    </div>
  );
};

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
              hasCombatStats,
              rank: 0 // Initial placeholder, will be assigned below
            };
          })
        );
        
        // Filter out players with no match data (totalGames === 0)
        const playersWithMatches = playersWithStats.filter(player => player.totalGames > 0);
        
        // Sort players by ELO to assign ranks
        const sortedByElo = [...playersWithMatches].sort((a, b) => b.elo - a.elo);
        
        // Assign ranks based on ELO (handling ties)
        let currentRank = 1;
        let currentElo = sortedByElo.length > 0 ? sortedByElo[0].elo : 0;
        let tieCount = 0;
        
        const playersWithRanks = sortedByElo.map((player, index) => {
          // If this player has a different ELO from the previous one
          if (player.elo !== currentElo) {
            // The new rank is the current position plus 1 (accounting for tied players)
            currentRank = index + 1;
            currentElo = player.elo;
            tieCount = 0;
          } else {
            // For tied players, they get the same rank
            tieCount++;
          }
          
          return {
            ...player,
            rank: currentRank
          };
        });
        
        setPlayers(playersWithRanks);
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
      case 'rank': // New sorting option by rank
        comparison = a.rank - b.rank;
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
              onClick={() => handleSort('rank')}
              className={`px-3 py-1 rounded ${
                sortBy === 'rank' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Rank {sortBy === 'rank' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
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
                return (
                  <div key={player.id} className="bg-gray-700 rounded-lg overflow-hidden shadow-md relative">
                    {/* Player Header - Adjusted for triangle badge */}
                    <div className="px-5 py-4 bg-gray-800 flex justify-between items-center relative">
                      <h3 className={`text-xl font-bold truncate ${player.rank <= 3 ? 'ml-10' : ''}`}>
                        {player.name}
                      </h3>
                      <div className="flex items-center">
                        <EnhancedTooltip text={`Rank #${player.rank} - ELO: ${player.elo}`}>
                          <div>
                            <RankDisplay rank={player.rank} elo={player.elo} />
                          </div>
                        </EnhancedTooltip>
                      </div>
                    </div>
                    
                    {/* Top 3 Indicator */}
                    {player.rank <= 3 && (
                      <div className={`absolute top-0 left-0 w-0 h-0 z-10
                        border-t-[50px] border-r-[50px] 
                        ${player.rank === 1 
                          ? 'border-t-yellow-500 border-r-transparent' 
                          : player.rank === 2 
                            ? 'border-t-gray-400 border-r-transparent' 
                            : 'border-t-amber-600 border-r-transparent'}`}>
                        <span className="absolute top-[-45px] left-[5px] font-bold text-black">
                          {player.rank}
                        </span>
                      </div>
                    )}
                    
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
      
      {/* Ranking Information */}
      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
        <h4 className="font-medium mb-2 flex items-center">
          <Info size={16} className="mr-2 text-blue-400" />
          About Player Rankings
        </h4>
        <p>
          Players are ranked based on their Elo rating, which reflects their performance against other players and teams. 
          It takes roughly 20 matches for each players rating to start to stabilise. Rankings are calculated based on match wins and losses, 
          with players winning more points if they beat higher ranked players, and losing more points if they lose to lower ranked players. 
          This implementation combines both the expected team performance and individual contribution metrics.
        </p>
        
      </div>
    </div>
  );
};

export default PlayerStats;