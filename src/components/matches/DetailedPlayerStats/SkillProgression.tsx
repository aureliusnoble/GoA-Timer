// src/components/matches/DetailedPlayerStats/SkillProgression.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Info, ArrowUp, ArrowDown } from 'lucide-react';
import dbService from '../../../services/DatabaseService';

interface SkillProgressionProps {
  playerId: string;
  playerName: string;
}

interface ChartDataPoint {
  matchNumber: number;
  playerRating: number;
  groupMean: number;
  date: string;
}

const SkillProgression: React.FC<SkillProgressionProps> = ({ playerId, playerName }) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // Load historical data
  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        const historicalRatings = await dbService.getHistoricalRatings();
        
        // Process data for individual player and group mean
        const processedData: ChartDataPoint[] = [];
        
        for (const snapshot of historicalRatings) {
          // Only include snapshots where this player participated
          if (snapshot.ratings[playerId]) {
            const allRatings = Object.values(snapshot.ratings);
            const groupMean = allRatings.length > 0 
              ? allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length 
              : 0;
            
            processedData.push({
              matchNumber: snapshot.matchNumber,
              playerRating: snapshot.ratings[playerId],
              groupMean: Math.round(groupMean),
              date: snapshot.date
            });
          }
        }

        setChartData(processedData);
      } catch (error) {
        console.error('Error loading skill progression:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [playerId]);

  // Calculate progression statistics
  const progressionStats = useMemo(() => {
    if (chartData.length === 0) return null;

    const firstRating = chartData[0]?.playerRating || 0;
    const lastRating = chartData[chartData.length - 1]?.playerRating || 0;
    const firstGroupMean = chartData[0]?.groupMean || 0;
    const lastGroupMean = chartData[chartData.length - 1]?.groupMean || 0;
    
    const playerChange = lastRating - firstRating;
    const groupChange = lastGroupMean - firstGroupMean;
    const relativeToGroup = playerChange - groupChange;
    
    // Calculate current position relative to group
    const currentDifference = lastRating - lastGroupMean;
    const isAboveAverage = currentDifference > 0;

    // Calculate volatility (standard deviation of rating changes)
    const ratingChanges = chartData.slice(1).map((point, index) => 
      point.playerRating - chartData[index].playerRating
    );
    const avgChange = ratingChanges.reduce((sum, change) => sum + change, 0) / ratingChanges.length;
    const volatility = Math.sqrt(
      ratingChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / ratingChanges.length
    );

    return {
      startRating: firstRating,
      endRating: lastRating,
      playerChange,
      groupChange,
      relativeToGroup,
      isAboveAverage,
      currentDifference: Math.abs(currentDifference),
      volatility: Math.round(volatility),
      totalMatches: chartData.length,
      trend: playerChange >= 0 ? 'up' : 'down'
    };
  }, [chartData]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-700">
          <p className="font-semibold mb-2">Match #{label}</p>
          <p className="text-blue-400">
            {playerName}: <span className="font-medium">{data.playerRating}</span>
          </p>
          <p className="text-gray-400">
            Group Average: <span className="font-medium">{data.groupMean}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(data.date).toLocaleDateString()}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-600 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <TrendingUp size={20} className="mr-2 text-blue-400" />
          Skill Progression Over Time
        </h3>
        <div className="text-center py-8">
          <TrendingUp size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">No Progression Data Available</p>
          <p className="text-sm text-gray-500">
            Not enough match history to show skill progression.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-6 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h3 className="text-xl font-bold flex items-center">
          <TrendingUp size={20} className="mr-2 text-blue-400" />
          Skill Progression vs Group Average
        </h3>
        
        {progressionStats && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-lg font-semibold flex items-center ${
                progressionStats.trend === 'up' ? 'text-green-400' : 'text-red-400'
              }`}>
                {progressionStats.trend === 'up' ? (
                  <ArrowUp size={16} className="mr-1" />
                ) : (
                  <ArrowDown size={16} className="mr-1" />
                )}
                {progressionStats.playerChange >= 0 ? '+' : ''}{progressionStats.playerChange}
              </div>
              <div className="text-sm text-gray-400">
                Total change
              </div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold flex items-center ${
                progressionStats.isAboveAverage ? 'text-green-400' : 'text-orange-400'
              }`}>
                {progressionStats.isAboveAverage ? (
                  <ArrowUp size={16} className="mr-1" />
                ) : (
                  <ArrowDown size={16} className="mr-1" />
                )}
                {progressionStats.currentDifference}
              </div>
              <div className="text-sm text-gray-400">
                vs group
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart 
            data={chartData} 
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="matchNumber" 
              stroke="#9CA3AF"
              label={{ 
                value: 'Match Number', 
                position: 'insideBottom', 
                offset: -5,
                style: { textAnchor: 'middle' }
              }}
            />
            <YAxis 
              stroke="#9CA3AF"
              label={{ 
                value: 'Skill Rating', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip 
              content={<CustomTooltip />}
              wrapperStyle={{ zIndex: 100 }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="playerRating"
              stroke="#3B82F6"
              strokeWidth={3}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              name={playerName}
            />
            <Line
              type="monotone"
              dataKey="groupMean"
              stroke="#6B7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Group Average"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Statistics Summary */}
      {progressionStats && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-300">Performance vs Group</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Position</span>
                <span className={`font-medium ${progressionStats.isAboveAverage ? 'text-green-400' : 'text-orange-400'}`}>
                  {progressionStats.isAboveAverage ? 'Above' : 'Below'} Average
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Difference</span>
                <span className="font-medium">{progressionStats.currentDifference} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Relative Gain</span>
                <span className={`font-medium ${progressionStats.relativeToGroup >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {progressionStats.relativeToGroup >= 0 ? '+' : ''}{progressionStats.relativeToGroup}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-300">Rating Journey</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Starting Rating</span>
                <span className="font-medium">{progressionStats.startRating}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Current Rating</span>
                <span className="font-medium">{progressionStats.endRating}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Total Matches</span>
                <span className="font-medium">{progressionStats.totalMatches}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-300">Consistency</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Volatility</span>
                <span className="font-medium">{progressionStats.volatility} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Trend</span>
                <span className={`font-medium ${progressionStats.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                  {progressionStats.trend === 'up' ? 'Improving' : 'Declining'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Stability</span>
                <span className="font-medium">
                  {progressionStats.volatility < 20 ? 'High' : progressionStats.volatility < 50 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <div className="flex items-start">
          <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-300">
            <p className="mb-2">
              <strong>Your Rating (Blue Line):</strong> Shows how your skill has evolved over time through wins and losses.
            </p>
            <p className="mb-2">
              <strong>Group Average (Dashed Gray):</strong> The average rating of all active players at each point in time.
            </p>
            <p>
              Being consistently above the group line indicates strong performance relative to the overall player base. 
              Rating volatility shows how consistent your performance is - lower volatility means more predictable results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillProgression;