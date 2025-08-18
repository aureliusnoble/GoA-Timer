// src/components/matches/DetailedPlayerStats/DetailedStats.tsx
import React from 'react';
import { Swords, TrendingUp, Coins, Target, Users } from 'lucide-react';

interface DetailedStatsProps {
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
  totalGames: number;
  hasCombatStats: boolean;
}

const DetailedStats: React.FC<DetailedStatsProps> = ({
  kills,
  deaths,
  assists,
  kdRatio,
  averageKills,
  averageDeaths,
  averageAssists,
  gamesWithCombatData,
  gamesWithGoldData,
  gamesWithMinionData,
  averageGold,
  averageMinionKills,
  averageLevel,
  totalGames,
  hasCombatStats
}) => {
  // All calculations now done in parent component with proper denominators
  if (!hasCombatStats) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Swords size={20} className="mr-2 text-blue-400" />
          Detailed Combat Statistics
        </h3>
        <div className="text-center py-8">
          <Swords size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">No Combat Data Available</p>
          <p className="text-sm text-gray-500">
            This player hasn't recorded any matches with detailed combat statistics yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <Swords size={20} className="mr-2 text-blue-400" />
        Detailed Combat Statistics
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total K/D/A */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total K/D/A</span>
            <Swords size={16} className="text-red-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {kills}/{deaths}/{assists}
          </div>
          <div className="text-xs text-gray-500">
            {totalGames} games played
          </div>
        </div>

        {/* K/D Ratio */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">K/D Ratio</span>
            <Target size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {kdRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            {deaths === 0 ? 'Perfect' : 'kill/death ratio'}
          </div>
        </div>

        {/* Average Level */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Level</span>
            <TrendingUp size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {averageLevel.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            end of game
          </div>
        </div>

        {/* Average Gold */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Gold</span>
            <Coins size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {averageGold.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            per game
          </div>
        </div>

        {/* Average Minion Kills */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Minions</span>
            <Users size={16} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            {averageMinionKills.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            per game
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Kill Participation</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {(averageKills + averageAssists).toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            (K+A) per game ({gamesWithCombatData} games)
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Combat Performance */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-300">Combat Performance</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Kills per Game</span>
              <span className="font-medium">
                {averageKills.toFixed(1)} ({gamesWithCombatData} games)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Deaths per Game</span>
              <span className="font-medium">
                {averageDeaths.toFixed(1)} ({gamesWithCombatData} games)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Assists per Game</span>
              <span className="font-medium">
                {averageAssists.toFixed(1)} ({gamesWithCombatData} games)
              </span>
            </div>
          </div>
        </div>

        {/* Economic Performance */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-300">Economic Performance</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Gold Earned</span>
              <span className="font-medium">
                {gamesWithGoldData > 0 ? (averageGold * gamesWithGoldData).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Farming Efficiency</span>
              <span className="font-medium">
                {gamesWithMinionData > 0 ? `${averageMinionKills.toFixed(1)} minions/game (${gamesWithMinionData} games)` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedStats;