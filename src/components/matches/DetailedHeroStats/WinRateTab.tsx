import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  ReferenceLine, Tooltip, CartesianGrid,
} from 'recharts';

interface MatchDataPoint {
  date: Date;
  won: boolean;
}

interface WinRateTabProps {
  heroName: string;
  matches: MatchDataPoint[];
}

interface ChartDataPoint {
  game: number;
  date: string;
  winRate: number;
}

const WinRateTab: React.FC<WinRateTabProps> = ({ heroName, matches }) => {
  const chartData = useMemo(() => {
    if (matches.length === 0) return [];

    // Sort matches by date ascending
    const sortedMatches = [...matches].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Compute cumulative win rate
    const data: ChartDataPoint[] = [];
    let wins = 0;

    for (let i = 0; i < sortedMatches.length; i++) {
      if (sortedMatches[i].won) {
        wins++;
      }
      const winRate = (wins / (i + 1)) * 100;
      data.push({
        game: i + 1,
        date: sortedMatches[i].date.toLocaleDateString(),
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal place
      });
    }

    return data;
  }, [matches]);

  const summaryStats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        currentWinRate: 0,
        totalGames: 0,
        recentTrend: '—' as const,
      };
    }

    const currentWinRate = chartData[chartData.length - 1].winRate;
    const totalGames = chartData.length;

    // Calculate recent trend based on last 5 games
    let recentTrend: '↑' | '↓' | '—' = '—';
    if (chartData.length >= 5) {
      const last5StartRate = chartData[chartData.length - 6].winRate;
      const last5EndRate = chartData[chartData.length - 1].winRate;
      if (last5EndRate > last5StartRate) {
        recentTrend = '↑';
      } else if (last5EndRate < last5StartRate) {
        recentTrend = '↓';
      }
    } else if (chartData.length > 1) {
      const firstRate = chartData[0].winRate;
      const lastRate = chartData[chartData.length - 1].winRate;
      if (lastRate > firstRate) {
        recentTrend = '↑';
      } else if (lastRate < firstRate) {
        recentTrend = '↓';
      }
    }

    return {
      currentWinRate,
      totalGames,
      recentTrend,
    };
  }, [chartData]);

  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-700 rounded-lg">
        <p className="text-gray-300">No match data available for {heroName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Current Win Rate Card */}
        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Current Win Rate</p>
          <p className="text-3xl font-bold text-blue-400">
            {summaryStats.currentWinRate.toFixed(1)}%
          </p>
        </div>

        {/* Total Games Card */}
        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Total Games</p>
          <p className="text-3xl font-bold text-white">
            {summaryStats.totalGames}
          </p>
        </div>

        {/* Recent Trend Card */}
        <div className="bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Recent Trend</p>
          <p className={`text-3xl font-bold ${
            summaryStats.recentTrend === '↑' ? 'text-green-400' :
            summaryStats.recentTrend === '↓' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {summaryStats.recentTrend}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-4">Win Rate Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="game"
              label={{ value: 'Game #', position: 'insideBottomRight', offset: -5 }}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: '%', angle: -90, position: 'insideLeft' }}
              stroke="#9ca3af"
              tickFormatter={(value) => `${value}%`}
            />
            <ReferenceLine y={50} strokeDasharray="3 3" stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
              }}
              formatter={(value: number) => `${value.toFixed(1)}%`}
              labelFormatter={(label) => `Game ${label}`}
            />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={chartData.length <= 30}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WinRateTab;
