// src/components/matches/DetailedPlayerStats.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, User, TrendingUp, Loader } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import DetailedStats from './DetailedPlayerStats/DetailedStats';
import SkillProgression from './DetailedPlayerStats/SkillProgression';
import RelationshipStats from './DetailedPlayerStats/RelationshipStats';
import HeroPerformance from './DetailedPlayerStats/HeroPerformance';
import MatchHistory from './DetailedPlayerStats/MatchHistory';

interface DetailedPlayerStatsProps {
  playerId: string;
  onBack: () => void;
}

interface PlayerDetails {
  player: DBPlayer | null;
  stats: any;
  matches: any[];
  currentRating: number;
  rank: number;
  // Enhanced combat statistics
  combatStats: {
    kills: number;
    deaths: number;
    assists: number;
    kdRatio: number;
    averageKills: number;
    averageDeaths: number;
    averageAssists: number;
    gamesWithCombatData: number;
    gamesWithGoldData: number;
    gamesWithMinionData: number;
    averageGold: number;
    averageMinionKills: number;
    averageLevel: number;
    hasCombatStats: boolean;
  };
}

const DetailedPlayerStats: React.FC<DetailedPlayerStatsProps> = ({ 
  playerId, 
  onBack 
}) => {
  const { playSound } = useSound();
  const [playerDetails, setPlayerDetails] = useState<PlayerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load player data
  useEffect(() => {
    const loadPlayerDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Parallel data fetching for performance
        const [
          player,
          playerStats,
          currentRatings,
          allPlayers
        ] = await Promise.all([
          dbService.getPlayer(playerId),
          dbService.getPlayerStats(playerId),
          dbService.getCurrentTrueSkillRatings(),
          dbService.getAllPlayers()
        ]);

        if (!player) {
          throw new Error('Player not found');
        }

        // Calculate rank among all players
        const playersWithRatings = allPlayers
          .map(p => ({ ...p, rating: currentRatings[p.id] || 0 }))
          .filter(p => p.totalGames > 0)
          .sort((a, b) => b.rating - a.rating);
        
        const rank = playersWithRatings.findIndex(p => p.id === playerId) + 1;

        // Calculate enhanced combat statistics
        const matches = playerStats.matchesPlayed;
        const kills = matches.reduce((sum: number, match: any) => sum + (match.kills ?? 0), 0);
        const deaths = matches.reduce((sum: number, match: any) => sum + (match.deaths ?? 0), 0);
        const assists = matches.reduce((sum: number, match: any) => sum + (match.assists ?? 0), 0);
        const totalGold = matches.reduce((sum: number, match: any) => sum + (match.goldEarned ?? 0), 0);
        const totalMinionKills = matches.reduce((sum: number, match: any) => sum + (match.minionKills ?? 0), 0);
        const totalLevels = matches.reduce((sum: number, match: any) => sum + (match.level ?? 0), 0);
        
        // Calculate accurate averages using proper denominators
        const gamesWithCombatData = matches.filter(match => 
          match.kills !== undefined || match.deaths !== undefined || match.assists !== undefined
        ).length;
        const gamesWithGoldData = matches.filter(match => match.goldEarned !== undefined).length;
        const gamesWithMinionData = matches.filter(match => match.minionKills !== undefined).length;
        const gamesWithLevelData = matches.filter(match => match.level !== undefined).length;
        
        const kdRatio = deaths === 0 ? kills : kills / deaths;
        const averageKills = gamesWithCombatData > 0 ? kills / gamesWithCombatData : 0;
        const averageDeaths = gamesWithCombatData > 0 ? deaths / gamesWithCombatData : 0;
        const averageAssists = gamesWithCombatData > 0 ? assists / gamesWithCombatData : 0;
        const averageGold = gamesWithGoldData > 0 ? Math.round(totalGold / gamesWithGoldData) : 0;
        const averageMinionKills = gamesWithMinionData > 0 ? totalMinionKills / gamesWithMinionData : 0;
        const averageLevel = gamesWithLevelData > 0 ? totalLevels / gamesWithLevelData : 0;
        const hasCombatStats = kills > 0 || deaths > 0 || assists > 0 || totalGold > 0;

        setPlayerDetails({
          player,
          stats: playerStats,
          matches: playerStats.matchesPlayed,
          currentRating: currentRatings[playerId] || 0,
          rank,
          combatStats: {
            kills,
            deaths,
            assists,
            kdRatio: parseFloat(kdRatio.toFixed(2)),
            averageKills,
            averageDeaths,
            averageAssists,
            gamesWithCombatData,
            gamesWithGoldData,
            gamesWithMinionData,
            averageGold,
            averageMinionKills,
            averageLevel,
            hasCombatStats
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load player details');
      } finally {
        setLoading(false);
      }
    };

    if (playerId) {
      loadPlayerDetails();
    }
  }, [playerId]);

  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-300 hover:text-white mr-4"
          >
            <ChevronLeft size={20} className="mr-1" />
            <span>Back to Player Stats</span>
          </button>
          <h2 className="text-2xl font-bold">Player Details</h2>
        </div>
        
        <div className="flex justify-center items-center h-64">
          <div className="flex items-center">
            <Loader size={24} className="animate-spin text-blue-500 mr-3" />
            <span className="text-gray-300">Loading player details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playerDetails) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-300 hover:text-white mr-4"
          >
            <ChevronLeft size={20} className="mr-1" />
            <span>Back to Player Stats</span>
          </button>
          <h2 className="text-2xl font-bold">Player Details</h2>
        </div>
        
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <User size={48} className="text-red-500 mb-4" />
          <p className="text-xl text-red-400 mb-2">Error Loading Player</p>
          <p className="text-gray-400">{error || 'Player not found'}</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { player, stats, currentRating, rank, combatStats } = playerDetails;

  // Additional null check for TypeScript
  if (!player) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-300 hover:text-white mr-4"
          >
            <ChevronLeft size={20} className="mr-1" />
            <span>Back to Player Stats</span>
          </button>
          <h2 className="text-2xl font-bold">Player Details</h2>
        </div>
        
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <User size={48} className="text-red-500 mb-4" />
          <p className="text-xl text-red-400 mb-2">Player Not Found</p>
          <p className="text-gray-400">Unable to load player data</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header with back button */}
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white mr-4"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Player Stats</span>
        </button>
        <h2 className="text-2xl font-bold">Detailed Player Statistics</h2>
      </div>
      
      {/* Player Header */}
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Player Avatar Placeholder */}
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-300">
                {player.name.charAt(0).toUpperCase()}
              </span>
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-white">{player.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-blue-400">
                <TrendingUp size={20} />
                <span className="text-lg font-semibold">
                  Rank #{rank}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{currentRating}</div>
            <div className="text-sm text-gray-400">TrueSkill Rating</div>
            <div className="text-xs text-gray-500 mt-1">
              {player.totalGames} games • Last played {new Date(player.lastPlayed).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Basic Stats Preview */}
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Quick Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{player.wins}</div>
            <div className="text-sm text-gray-400">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{player.losses}</div>
            <div className="text-sm text-gray-400">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {player.totalGames > 0 ? ((player.wins / player.totalGames) * 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-sm text-gray-400">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.allHeroesPlayed.length}</div>
            <div className="text-sm text-gray-400">Heroes Played</div>
          </div>
        </div>
      </div>

      {/* Detailed Combat Statistics */}
      <DetailedStats
        kills={combatStats.kills}
        deaths={combatStats.deaths}
        assists={combatStats.assists}
        kdRatio={combatStats.kdRatio}
        averageKills={combatStats.averageKills}
        averageDeaths={combatStats.averageDeaths}
        averageAssists={combatStats.averageAssists}
        gamesWithCombatData={combatStats.gamesWithCombatData}
        gamesWithGoldData={combatStats.gamesWithGoldData}
        gamesWithMinionData={combatStats.gamesWithMinionData}
        averageGold={combatStats.averageGold}
        averageMinionKills={combatStats.averageMinionKills}
        averageLevel={combatStats.averageLevel}
        totalGames={player.totalGames}
        hasCombatStats={combatStats.hasCombatStats}
      />

      {/* TrueSkill Progression Chart */}
      <SkillProgression
        playerId={player.id}
        playerName={player.name}
      />

      {/* Relationship Statistics (Nemesis/BFF) */}
      <RelationshipStats
        playerId={player.id}
        playerName={player.name}
      />

      {/* Hero Performance Analytics */}
      <HeroPerformance
        favoriteHeroes={stats.favoriteHeroes}
        allHeroesPlayed={stats.allHeroesPlayed}
        favoriteRoles={stats.favoriteRoles}
        allRolesPlayed={stats.allRolesPlayed}
        totalGames={player.totalGames}
        matches={playerDetails.matches}
      />

      {/* Match History Table */}
      <MatchHistory
        playerId={player.id}
        playerName={player.name}
      />
    </div>
  );
};

export default DetailedPlayerStats;