// src/components/matches/DetailedPlayerStats/MatchHistory.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, Shield, Swords, Star, Hexagon, ChevronLeft, ChevronRight } from 'lucide-react';
import dbService, { DBMatch, DBMatchPlayer } from '../../../services/DatabaseService';
import { getRoleTooltip } from '../../../shared/utils/roleDescriptions';
import EnhancedTooltip from '../../common/EnhancedTooltip';

interface MatchHistoryProps {
  playerId: string;
  playerName: string;
}

interface MatchRecord {
  match: DBMatch;
  playerData: DBMatchPlayer;
  teammates: DBMatchPlayer[];
  opponents: DBMatchPlayer[];
  won: boolean;
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ playerId }) => {
  const [loading, setLoading] = useState(true);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const matchesPerPage = 10;

  // Read recencyMonths from localStorage (controlled by PlayerStats filter)
  const recencyMonths = (() => {
    const saved = localStorage.getItem('playerStats_recencyMonths');
    return saved ? parseInt(saved, 10) : null; // null = All Time
  })();

  // Calculate date range based on recencyMonths
  const dateRange = useMemo(() => {
    if (recencyMonths === null) {
      return { startDate: null, endDate: null };
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - recencyMonths);
    return { startDate, endDate };
  }, [recencyMonths]);

  // Load match history data
  useEffect(() => {
    const loadMatchHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get player's match history
        const playerStats = await dbService.getPlayerStats(playerId);
        let playerMatches = playerStats.matchesPlayed;

        // Filter by date range if recency filter is active
        if (dateRange.startDate && dateRange.endDate) {
          // Need to get match dates to filter
          const allMatches = await dbService.getAllMatches();
          const validMatchIds = new Set(
            allMatches
              .filter(match => {
                const matchDate = new Date(match.date);
                return matchDate >= dateRange.startDate! && matchDate <= dateRange.endDate!;
              })
              .map(m => m.id)
          );
          playerMatches = playerMatches.filter(mp => validMatchIds.has(mp.matchId));
        }

        // Build detailed match records
        const matchRecords: MatchRecord[] = [];
        
        for (const playerMatch of playerMatches) {
          try {
            // Get full match data and all participants
            const [fullMatch, allPlayers] = await Promise.all([
              dbService.getMatch(playerMatch.matchId),
              dbService.getMatchPlayers(playerMatch.matchId)
            ]);
            
            if (fullMatch && allPlayers.length > 0) {
              const targetPlayer = allPlayers.find(p => p.playerId === playerId);
              if (!targetPlayer) continue;
              
              const teammates = allPlayers.filter(p => 
                p.playerId !== playerId && p.team === targetPlayer.team
              );
              const opponents = allPlayers.filter(p => 
                p.team !== targetPlayer.team
              );
              
              const won = targetPlayer.team === fullMatch.winningTeam;
              
              matchRecords.push({
                match: fullMatch,
                playerData: targetPlayer,
                teammates,
                opponents,
                won
              });
            }
          } catch (matchError) {
            console.warn(`Failed to load match ${playerMatch.matchId}:`, matchError);
          }
        }
        
        // Sort by date (most recent first)
        matchRecords.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
        
        setMatchHistory(matchRecords);
      } catch (err) {
        console.error('Error loading match history:', err);
        setError('Failed to load match history');
      } finally {
        setLoading(false);
      }
    };

    loadMatchHistory();
  }, [playerId, dateRange.startDate, dateRange.endDate]);

  // Get role icon with tooltip
  const getRoleIcon = (role: string | undefined) => {
    if (!role) {
      return (
        <EnhancedTooltip text="Unknown role" position="top" maxWidth="max-w-sm">
          <Hexagon size={16} className="text-gray-400" />
        </EnhancedTooltip>
      );
    }
    
    const tooltip = getRoleTooltip(role);
    let iconComponent;
    
    switch (role.toLowerCase()) {
      case 'guardian':
      case 'durable':
        iconComponent = <Shield size={16} className="text-blue-400" />;
        break;
      case 'slayer':
      case 'tactician':
        iconComponent = <Swords size={16} className="text-red-400" />;
        break;
      case 'support':
        iconComponent = <Users size={16} className="text-green-400" />;
        break;
      case 'sorcerer':
        iconComponent = <Star size={16} className="text-purple-400" />;
        break;
      default:
        iconComponent = <Hexagon size={16} className="text-gray-400" />;
        break;
    }
    
    return (
      <EnhancedTooltip text={tooltip} position="top" maxWidth="max-w-sm">
        {iconComponent}
      </EnhancedTooltip>
    );
  };


  // Pagination logic
  const totalPages = Math.ceil(matchHistory.length / matchesPerPage);
  const startIndex = (currentPage - 1) * matchesPerPage;
  const endIndex = startIndex + matchesPerPage;
  const currentMatches = matchHistory.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || matchHistory.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Calendar size={20} className="mr-2 text-blue-400" />
          Match History
        </h3>
        <div className="text-center py-8">
          <Calendar size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">
            {error ? 'Error Loading History' : 'No Match History Available'}
          </p>
          <p className="text-sm text-gray-500">
            {error || 'This player hasn\'t recorded any matches yet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h3 className="text-xl font-bold flex items-center">
          <Calendar size={20} className="mr-2 text-blue-400" />
          Match History
        </h3>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-400 px-3">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Date Range Indicator */}
      {recencyMonths !== null && dateRange.startDate && dateRange.endDate && (
        <div className="mb-4 p-2 bg-blue-900/30 border border-blue-700/50 rounded text-sm flex items-center">
          <Calendar size={14} className="mr-2 text-blue-400" />
          <span className="text-blue-200">
            Showing matches from last {recencyMonths} month{recencyMonths !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Mobile-first responsive table */}
      <div className="space-y-4">
        {currentMatches.map((record) => (
          <div key={record.match.id} className="bg-gray-800 rounded-lg p-4">
            {/* Mobile Layout */}
            <div className="block lg:hidden">
              {/* Match Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    record.won ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`font-semibold ${
                    record.won ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {record.won ? 'Victory' : 'Defeat'}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-400">
                  <div>{new Date(record.match.date).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Player Performance */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {getRoleIcon(record.playerData.heroRoles?.[0])}
                    <span className="ml-2 font-medium text-white">
                      {record.playerData.heroName || 'Unknown Hero'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Team {record.playerData.team}
                  </div>
                </div>
                
                {/* Stats if available */}
                {(record.playerData.kills !== undefined || record.playerData.deaths !== undefined || record.playerData.assists !== undefined) && (
                  <div className="text-sm text-gray-300">
                    KDA: {record.playerData.kills ?? 0}/{record.playerData.deaths ?? 0}/{record.playerData.assists ?? 0}
                    {record.playerData.level && ` • Level ${record.playerData.level}`}
                    {record.playerData.goldEarned && ` • ${record.playerData.goldEarned.toLocaleString()} gold`}
                  </div>
                )}
              </div>

              {/* Teams Summary */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium text-green-400 mb-1">Teammates</div>
                  <div className="space-y-1">
                    {record.teammates.map((teammate, i) => (
                      <div key={i} className="flex items-center">
                        {getRoleIcon(teammate.heroRoles?.[0])}
                        <div className="ml-1 text-gray-300 truncate">
                          <div className="font-medium">{teammate.playerId}</div>
                          {teammate.heroName && (
                            <div className="text-xs text-gray-500">{teammate.heroName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-red-400 mb-1">Opponents</div>
                  <div className="space-y-1">
                    {record.opponents.map((opponent, i) => (
                      <div key={i} className="flex items-center">
                        {getRoleIcon(opponent.heroRoles?.[0])}
                        <div className="ml-1 text-gray-300 truncate">
                          <div className="font-medium">{opponent.playerId}</div>
                          {opponent.heroName && (
                            <div className="text-xs text-gray-500">{opponent.heroName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Result */}
                <div className="col-span-1">
                  <div className={`w-4 h-4 rounded-full ${
                    record.won ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                </div>

                {/* Date */}
                <div className="col-span-2 text-sm text-gray-400">
                  <div>{new Date(record.match.date).toLocaleDateString()}</div>
                </div>

                {/* Player Hero & Performance */}
                <div className="col-span-3">
                  <div className="flex items-center mb-1">
                    {getRoleIcon(record.playerData.heroRoles?.[0])}
                    <span className="ml-2 font-medium text-white">
                      {record.playerData.heroName || 'Unknown Hero'}
                    </span>
                  </div>
                  {(record.playerData.kills !== undefined || record.playerData.deaths !== undefined || record.playerData.assists !== undefined) && (
                    <div className="text-sm text-gray-400">
                      {record.playerData.kills ?? 0}/{record.playerData.deaths ?? 0}/{record.playerData.assists ?? 0}
                      {record.playerData.level && ` • Lv.${record.playerData.level}`}
                    </div>
                  )}
                </div>

                {/* Teammates */}
                <div className="col-span-3">
                  <div className="text-xs text-green-400 mb-1">Teammates</div>
                  <div className="space-y-1">
                    {record.teammates.map((teammate, i) => (
                      <div key={i} className="flex items-center text-xs">
                        {getRoleIcon(teammate.heroRoles?.[0])}
                        <div className="ml-1 text-gray-300 truncate">
                          <div>{teammate.playerId}</div>
                          {teammate.heroName && (
                            <div className="text-xs text-gray-500">{teammate.heroName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opponents */}
                <div className="col-span-3">
                  <div className="text-xs text-red-400 mb-1">Opponents</div>
                  <div className="space-y-1">
                    {record.opponents.map((opponent, i) => (
                      <div key={i} className="flex items-center text-xs">
                        {getRoleIcon(opponent.heroRoles?.[0])}
                        <div className="ml-1 text-gray-300 truncate">
                          <div>{opponent.playerId}</div>
                          {opponent.heroName && (
                            <div className="text-xs text-gray-500">{opponent.heroName}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          
          {/* Page numbers */}
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (pageNum <= totalPages) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              return null;
            })}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      )}

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-gray-600">
        <div className="text-center text-sm text-gray-400">
          Showing {startIndex + 1}-{Math.min(endIndex, matchHistory.length)} of {matchHistory.length} matches
          <span className="mx-2">•</span>
          {matchHistory.filter(r => r.won).length} wins, {matchHistory.filter(r => !r.won).length} losses
          <span className="mx-2">•</span>
          {matchHistory.length > 0 ? ((matchHistory.filter(r => r.won).length / matchHistory.length) * 100).toFixed(1) : '0.0'}% win rate
        </div>
      </div>
    </div>
  );
};

export default MatchHistory;