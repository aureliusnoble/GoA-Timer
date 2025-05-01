// src/components/matches/MatchHistory.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Calendar, Filter, ChevronDown, ChevronUp, Trash2, Shield, Award } from 'lucide-react';
import { DBMatch, DBMatchPlayer} from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { Team, GameLength } from '../../types';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';

interface MatchHistoryProps {
  onBack: () => void;
}

interface MatchWithDetails extends DBMatch {
  players: (DBMatchPlayer & { playerName: string })[];
  expanded: boolean;
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const [matches, setMatches] = useState<MatchWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<Team | 'all'>('all');
  const [filterGameLength, setFilterGameLength] = useState<GameLength | 'all'>('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('desc');
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [deletingMatch, setDeletingMatch] = useState<string | null>(null);
  
  // Load match data on component mount
  useEffect(() => {
    const loadMatches = async () => {
      setLoading(true);
      try {
        // Get all matches from the database
        const allMatches = await dbService.getAllMatches();
        
        // Sort by date (newest first by default)
        allMatches.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        
        // Get players for each match
        const matchesWithPlayers = await Promise.all(
          allMatches.map(async (match) => {
            const matchPlayers = await dbService.getMatchPlayers(match.id);
            
            // Get player names
            const playersWithNames = await Promise.all(
              matchPlayers.map(async (matchPlayer) => {
                const player = await dbService.getPlayer(matchPlayer.playerId);
                return {
                  ...matchPlayer,
                  playerName: player?.name || 'Unknown Player'
                };
              })
            );
            
            return {
              ...match,
              players: playersWithNames,
              expanded: false
            };
          })
        );
        
        setMatches(matchesWithPlayers);
      } catch (error) {
        console.error('Error loading match history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMatches();
  }, []);
  
  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  // Handle match expansion
  const toggleMatchExpand = (matchId: string) => {
    playSound('buttonClick');
    setMatches(matches.map(match => 
      match.id === matchId 
        ? { ...match, expanded: !match.expanded } 
        : match
    ));
  };
  
  // Handle match deletion
  const handleDeleteMatch = async (matchId: string) => {
    // First click - confirm deletion
    if (deletingMatch !== matchId) {
      playSound('buttonClick');
      setDeletingMatch(matchId);
      return;
    }
    
    // Second click - delete the match
    try {
      playSound('buttonClick');
      await dbService.deleteMatch(matchId);
      
      // Remove match from state
      setMatches(matches.filter(match => match.id !== matchId));
      setDeletingMatch(null);
    } catch (error) {
      console.error('Error deleting match:', error);
    }
  };
  
  // Toggle date sort
  const toggleDateSort = () => {
    playSound('buttonClick');
    setDateSort(dateSort === 'asc' ? 'desc' : 'asc');
  };
  
  // Toggle filter menu
  const toggleFilterMenu = () => {
    playSound('buttonClick');
    setShowFilterMenu(!showFilterMenu);
  };
  
  // Reset filters
  const resetFilters = () => {
    playSound('buttonClick');
    setSearchTerm('');
    setFilterTeam('all');
    setFilterGameLength('all');
    setShowFilterMenu(false);
  };
  
  // Format date to readable string
  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Filter and sort matches
  const filteredMatches = matches
    .filter(match => {
      // Apply team filter
      if (filterTeam !== 'all' && match.winningTeam !== filterTeam) {
        return false;
      }
      
      // Apply game length filter
      if (filterGameLength !== 'all' && match.gameLength !== filterGameLength) {
        return false;
      }
      
      // Apply search filter (match player names)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return match.players.some(player => 
          player.playerName.toLowerCase().includes(searchLower) ||
          player.heroName.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateSort === 'asc' ? dateA - dateB : dateB - dateA;
    });
  
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
        <h2 className="text-2xl font-bold">Match History</h2>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Search Input */}
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search players or heroes..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          {/* Date Sort Button */}
          <button
            onClick={toggleDateSort}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center"
          >
            <Calendar size={18} className="mr-2" />
            <span>Date {dateSort === 'asc' ? '(Oldest)' : '(Newest)'}</span>
          </button>
          
          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={toggleFilterMenu}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center"
            >
              <Filter size={18} className="mr-2" />
              <span>Filters</span>
              {(filterTeam !== 'all' || filterGameLength !== 'all') && (
                <span className="ml-2 bg-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(filterTeam !== 'all' ? 1 : 0) + (filterGameLength !== 'all' ? 1 : 0)}
                </span>
              )}
              {showFilterMenu ? (
                <ChevronUp size={16} className="ml-2" />
              ) : (
                <ChevronDown size={16} className="ml-2" />
              )}
            </button>
            
            {/* Filter Menu */}
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4 w-64">
                <h4 className="font-medium mb-3">Filter Options</h4>
                
                {/* Winner Filter */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Winning Team</label>
                  <select
                    value={filterTeam}
                    onChange={(e) => setFilterTeam(e.target.value as Team | 'all')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="all">All Teams</option>
                    <option value={Team.Titans}>Titans</option>
                    <option value={Team.Atlanteans}>Atlanteans</option>
                  </select>
                </div>
                
                {/* Game Length Filter */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Game Length</label>
                  <select
                    value={filterGameLength}
                    onChange={(e) => setFilterGameLength(e.target.value as GameLength | 'all')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="all">All Lengths</option>
                    <option value={GameLength.Quick}>Quick</option>
                    <option value={GameLength.Long}>Long</option>
                  </select>
                </div>
                
                {/* Reset Filters Button */}
                <button
                  onClick={resetFilters}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Reset Filters
                </button>
              </div>
            )}
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
          {/* Match List */}
          {filteredMatches.length > 0 ? (
            <div className="space-y-4">
              {filteredMatches.map((match) => (
                <div 
                  key={match.id} 
                  className="bg-gray-700 rounded-lg overflow-hidden shadow-md"
                >
                  {/* Match Header */}
                  <div 
                    className={`px-5 py-4 ${
                      match.winningTeam === Team.Titans ? 'bg-blue-900/50' : 'bg-red-900/50'
                    } flex justify-between items-center cursor-pointer`}
                    onClick={() => toggleMatchExpand(match.id)}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <Award size={18} className="mr-2" />
                        <span className="font-bold">
                          {match.winningTeam === Team.Titans ? 'Titans Victory' : 'Atlanteans Victory'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        {formatDate(match.date)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="bg-gray-800 px-2 py-1 rounded">
                          {match.gameLength === GameLength.Quick ? 'Quick' : 'Long'}
                        </span>
                        {match.doubleLanes && (
                          <span className="ml-2 bg-gray-800 px-2 py-1 rounded">
                            Double Lane
                          </span>
                        )}
                      </div>
                      <div>
                        {match.expanded ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Match Details (Expanded) */}
                  {match.expanded && (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Titans Team */}
                        <div className={`p-3 rounded-lg ${
                          match.winningTeam === Team.Titans ? 'bg-blue-900/30 ring-2 ring-blue-500' : 'bg-blue-900/20'
                        }`}>
                          <h4 className="font-bold mb-2 flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                            Titans Team
                            {match.winningTeam === Team.Titans && (
                              <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded-full">
                                Winner
                              </span>
                            )}
                          </h4>
                          <div className="space-y-2">
                            {match.players.filter(p => p.team === Team.Titans).map((player) => (
                              <div key={player.id} className="flex justify-between items-center bg-blue-900/30 p-2 rounded">
                                <div className="flex items-center">
                                  <div className="mr-2 bg-gray-800 p-1 rounded-full">
                                    <Shield size={16} />
                                  </div>
                                  <div>
                                    <div className="font-medium">{player.playerName}</div>
                                    <div className="text-xs text-gray-300">
                                      {player.heroName} • {player.heroRoles.join(', ')}
                                    </div>
                                  </div>
                                </div>
                                {/* Show stats if available */}
                                {(player.kills !== undefined || player.deaths !== undefined || player.assists !== undefined) && (
                                  <div className="text-xs bg-gray-800 px-2 py-1 rounded">
                                    {player.kills || 0}/{player.deaths || 0}/{player.assists || 0}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Atlanteans Team */}
                        <div className={`p-3 rounded-lg ${
                          match.winningTeam === Team.Atlanteans ? 'bg-red-900/30 ring-2 ring-red-500' : 'bg-red-900/20'
                        }`}>
                          <h4 className="font-bold mb-2 flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                            Atlanteans Team
                            {match.winningTeam === Team.Atlanteans && (
                              <span className="ml-2 text-xs bg-red-600 px-2 py-0.5 rounded-full">
                                Winner
                              </span>
                            )}
                          </h4>
                          <div className="space-y-2">
                            {match.players.filter(p => p.team === Team.Atlanteans).map((player) => (
                              <div key={player.id} className="flex justify-between items-center bg-red-900/30 p-2 rounded">
                                <div className="flex items-center">
                                  <div className="mr-2 bg-gray-800 p-1 rounded-full">
                                    <Shield size={16} />
                                  </div>
                                  <div>
                                    <div className="font-medium">{player.playerName}</div>
                                    <div className="text-xs text-gray-300">
                                      {player.heroName} • {player.heroRoles.join(', ')}
                                    </div>
                                  </div>
                                </div>
                                {/* Show stats if available */}
                                {(player.kills !== undefined || player.deaths !== undefined || player.assists !== undefined) && (
                                  <div className="text-xs bg-gray-800 px-2 py-1 rounded">
                                    {player.kills || 0}/{player.deaths || 0}/{player.assists || 0}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Delete Button */}
                      <div className="mt-4 flex justify-end">
                        <EnhancedTooltip text="Delete this match and its data">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(match.id);
                            }}
                            className={`px-3 py-1 rounded-lg flex items-center ${
                              deletingMatch === match.id 
                                ? 'bg-red-500 hover:bg-red-400'
                                : 'bg-red-700 hover:bg-red-600'
                            }`}
                          >
                            <Trash2 size={16} className="mr-2" />
                            <span>{deletingMatch === match.id ? 'Confirm Delete' : 'Delete Match'}</span>
                          </button>
                        </EnhancedTooltip>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Calendar size={48} className="text-gray-500 mb-4" />
              <p className="text-xl text-gray-400">
                {searchTerm || filterTeam !== 'all' || filterGameLength !== 'all'
                  ? 'No matches found matching your filters'
                  : 'No match history available'}
              </p>
              {(searchTerm || filterTeam !== 'all' || filterGameLength !== 'all') && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchHistory;