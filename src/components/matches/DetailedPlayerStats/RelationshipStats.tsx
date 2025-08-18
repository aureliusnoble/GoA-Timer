// src/components/matches/DetailedPlayerStats/RelationshipStats.tsx
import React, { useState, useEffect } from 'react';
import { Users, Zap, Heart, Info } from 'lucide-react';
import dbService, { DBMatchPlayer } from '../../../services/DatabaseService';

interface RelationshipStatsProps {
  playerId: string;
  playerName: string;
}

interface RelationshipStat {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  winRate: number;
  isSignificant: boolean; // >= 3 games for meaningful data
}

interface RelationshipData {
  bestTeammates: RelationshipStat[]; // Can be multiple if tied
  nemeses: RelationshipStat[]; // Can be multiple if tied
}

const RelationshipStats: React.FC<RelationshipStatsProps> = ({ playerId }) => {
  const [loading, setLoading] = useState(true);
  const [relationshipData, setRelationshipData] = useState<RelationshipData | null>(null);

  // Calculate relationship statistics
  useEffect(() => {
    const calculateRelationships = async () => {
      try {
        setLoading(true);
        
        // Get player's match history and all matches
        const [playerStats, allMatches] = await Promise.all([
          dbService.getPlayerStats(playerId),
          dbService.getAllMatches()
        ]);

        const matches = playerStats.matchesPlayed;
        
        // Group matches by match ID to analyze team compositions
        const matchGroups = new Map<string, DBMatchPlayer[]>();
        
        // Get all players for each match this player participated in
        for (const match of matches) {
          if (!matchGroups.has(match.matchId)) {
            const allMatchPlayers = await dbService.getMatchPlayers(match.matchId);
            matchGroups.set(match.matchId, allMatchPlayers);
          }
        }

        const teammateStats = new Map<string, { wins: number; total: number; name: string }>();
        const opponentStats = new Map<string, { wins: number; total: number; name: string }>();

        // Analyze each match for teammates and opponents
        for (const [matchId, matchPlayers] of matchGroups) {
          const targetPlayer = matchPlayers.find(p => p.playerId === playerId);
          if (!targetPlayer) continue;

          const matchResult = allMatches.find(m => m.id === matchId);
          if (!matchResult) continue;

          const playerWon = targetPlayer.team === matchResult.winningTeam;
          
          matchPlayers.forEach(player => {
            if (player.playerId === playerId) return;
            
            if (player.team === targetPlayer.team) {
              // Teammate
              if (!teammateStats.has(player.playerId)) {
                teammateStats.set(player.playerId, { wins: 0, total: 0, name: player.playerId });
              }
              const stats = teammateStats.get(player.playerId)!;
              stats.total++;
              if (playerWon) stats.wins++;
            } else {
              // Opponent
              if (!opponentStats.has(player.playerId)) {
                opponentStats.set(player.playerId, { wins: 0, total: 0, name: player.playerId });
              }
              const stats = opponentStats.get(player.playerId)!;
              stats.total++;
              if (playerWon) stats.wins++;
            }
          });
        }

        // Convert to RelationshipStat arrays and sort
        const teammates: RelationshipStat[] = Array.from(teammateStats.entries())
          .map(([playerId, stats]) => ({
            playerId,
            playerName: stats.name,
            gamesPlayed: stats.total,
            winRate: (stats.wins / stats.total) * 100,
            isSignificant: stats.total >= 3
          }))
          .filter(stat => stat.isSignificant)
          .sort((a, b) => b.winRate - a.winRate);

        const opponents: RelationshipStat[] = Array.from(opponentStats.entries())
          .map(([playerId, stats]) => ({
            playerId,
            playerName: stats.name,
            gamesPlayed: stats.total,
            winRate: (stats.wins / stats.total) * 100,
            isSignificant: stats.total >= 3
          }))
          .filter(stat => stat.isSignificant)
          .sort((a, b) => a.winRate - b.winRate); // Lowest win rate = toughest opponent

        // Find tied relationships for best teammate and nemesis
        const getBestTeammates = (teammates: RelationshipStat[]) => {
          if (teammates.length === 0) return [];
          const highestWinRate = teammates[0].winRate;
          return teammates.filter(teammate => teammate.winRate === highestWinRate);
        };

        const getNemeses = (opponents: RelationshipStat[]) => {
          if (opponents.length === 0) return [];
          const lowestWinRate = opponents[0].winRate;
          return opponents.filter(opponent => opponent.winRate === lowestWinRate);
        };

        const bestTeammates = getBestTeammates(teammates);
        const nemeses = getNemeses(opponents);

        setRelationshipData({
          bestTeammates: bestTeammates, // All tied teammates with highest win rate
          nemeses: nemeses // All tied opponents with lowest win rate
        });
      } catch (error) {
        console.error('Error calculating relationship stats:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateRelationships();
  }, [playerId]);

  if (loading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-gray-600 rounded"></div>
            <div className="h-32 bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!relationshipData || (relationshipData.bestTeammates.length === 0 && relationshipData.nemeses.length === 0)) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Users size={20} className="mr-2 text-blue-400" />
          Player Relationships
        </h3>
        <div className="text-center py-8">
          <Users size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">Not Enough Data</p>
          <p className="text-sm text-gray-500">
            Need at least 3 games with the same players to calculate meaningful relationships.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <Users size={20} className="mr-2 text-blue-400" />
        Player Relationships
      </h3>

      {/* Featured Relationships */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Best Friend (BFF) */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Heart size={20} className="mr-2 text-green-400" />
              <h4 className="font-semibold text-green-400">Best Teammate (BFF)</h4>
            </div>
          </div>
          
          {relationshipData.bestTeammates.length > 0 ? (
            <div>
              {relationshipData.bestTeammates.map((teammate, index) => (
                <div key={teammate.playerId} className={index > 0 ? "mt-3 pt-3 border-t border-gray-600" : ""}>
                  <div className="text-lg font-bold text-white mb-1">
                    {teammate.playerName}
                    {relationshipData.bestTeammates.length > 1 && (
                      <span className="text-sm text-gray-400 ml-2">(tied)</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-green-400 mb-2">
                    {teammate.winRate.toFixed(1)}% Win Rate
                  </div>
                  <div className="text-sm text-gray-400">
                    {teammate.gamesPlayed} games together
                  </div>
                  <div className="mt-3 h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${teammate.winRate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">No significant teammate relationships yet</p>
            </div>
          )}
        </div>

        {/* Nemesis */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Zap size={20} className="mr-2 text-red-400" />
              <h4 className="font-semibold text-red-400">Nemesis</h4>
            </div>
          </div>
          
          {relationshipData.nemeses.length > 0 ? (
            <div>
              {relationshipData.nemeses.map((nemesis, index) => (
                <div key={nemesis.playerId} className={index > 0 ? "mt-3 pt-3 border-t border-gray-600" : ""}>
                  <div className="text-lg font-bold text-white mb-1">
                    {nemesis.playerName}
                    {relationshipData.nemeses.length > 1 && (
                      <span className="text-sm text-gray-400 ml-2">(tied)</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-red-400 mb-2">
                    {nemesis.winRate.toFixed(1)}% Win Rate
                  </div>
                  <div className="text-sm text-gray-400">
                    {nemesis.gamesPlayed} games against
                  </div>
                  <div className="mt-3 h-2 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${nemesis.winRate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400">No significant opponent relationships yet</p>
            </div>
          )}
        </div>
      </div>


      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <div className="flex items-start">
          <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300">
            <p className="mb-2">
              <strong>Best Teammate (BFF):</strong> The player you have the highest win rate with (minimum 3 games).
            </p>
            <p className="mb-2">
              <strong>Nemesis:</strong> The opponent you struggle against most (lowest win rate, minimum 3 games).
            </p>
            <p>
              These statistics help identify which players complement your playstyle best and which opponents 
              present the greatest challenge. Relationships require at least 3 games for statistical significance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelationshipStats;