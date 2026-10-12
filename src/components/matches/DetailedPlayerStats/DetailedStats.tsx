// src/components/matches/DetailedPlayerStats/DetailedStats.tsx
import React from 'react';
import { Swords, TrendingUp, Coins, Target, Users } from 'lucide-react';
import { PlayerStatSummary, StatSummary, formatTrackedGames } from '../../../shared/utils/trackedStats';

interface DetailedStatsProps {
  /** Per-stat totals, tracked-game counts and averages (see summarizePlayerStats). */
  summary: PlayerStatSummary;
  /** Number of matches in the current view (the denominator shown next to tracked counts). */
  totalGames: number;
}

const DetailedStats: React.FC<DetailedStatsProps> = ({ summary, totalGames }) => {
  const { kills, deaths, assists, minionKills, goldEarned, level, kdRatio } = summary;

  if (!summary.hasAnyTrackedStats) {
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

  const kdaGames = Math.max(kills.games, deaths.games, assists.games);
  const tracked = (games: number) => formatTrackedGames(games, totalGames);
  // A stat that was never tracked shows N/A rather than a misleading 0
  const totalOrNA = (stat: StatSummary) => (stat.games > 0 ? stat.total : 'N/A');
  const perGame = (stat: StatSummary) =>
    stat.games > 0 ? `${stat.average.toFixed(1)} (${stat.games} games)` : 'N/A';
  const isPerfectKd = deaths.games > 0 && deaths.total === 0 && kills.total > 0;
  // K+A per game needs both stats; count only the games both could come from
  const killParticipationGames = Math.min(kills.games, assists.games);

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
            {kdaGames > 0 ? `${totalOrNA(kills)}/${totalOrNA(deaths)}/${totalOrNA(assists)}` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            tracked in {tracked(kdaGames)}
          </div>
        </div>

        {/* K/D Ratio */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">K/D Ratio</span>
            <Target size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {kdRatio !== null ? kdRatio.toFixed(2) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            {isPerfectKd ? 'Perfect' : 'kill/death ratio'}
          </div>
        </div>

        {/* Average Level */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Level</span>
            <TrendingUp size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {level.games > 0 ? level.average.toFixed(1) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            end of game · {tracked(level.games)}
          </div>
        </div>

        {/* Average Gold */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Gold</span>
            <Coins size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {goldEarned.games > 0 ? Math.round(goldEarned.average).toLocaleString() : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            per game · {tracked(goldEarned.games)}
          </div>
        </div>

        {/* Average Minion Kills */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Avg Minions</span>
            <Users size={16} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            {minionKills.games > 0 ? minionKills.average.toFixed(1) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            per game · {tracked(minionKills.games)}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Kill Participation</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {killParticipationGames > 0 ? (kills.average + assists.average).toFixed(1) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            (K+A) per game · {tracked(killParticipationGames)}
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
                {perGame(kills)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Deaths per Game</span>
              <span className="font-medium">
                {perGame(deaths)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Assists per Game</span>
              <span className="font-medium">
                {perGame(assists)}
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
                {goldEarned.games > 0 ? goldEarned.total.toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Farming Efficiency</span>
              <span className="font-medium">
                {minionKills.games > 0 ? `${minionKills.average.toFixed(1)} minions/game (${minionKills.games} games)` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailedStats;
