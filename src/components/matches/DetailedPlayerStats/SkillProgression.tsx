// src/components/matches/DetailedPlayerStats/SkillProgression.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  VictoryChart, VictoryLine, VictoryScatter, VictoryAxis, VictoryArea
} from 'victory';
import { TrendingUp, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { useDataSource } from '../../../hooks/useDataSource';
import EnhancedTooltip from '../../common/EnhancedTooltip';

interface SkillProgressionProps {
  playerId: string;
  playerName: string;
}

interface ChartDataPoint {
  matchNumber: number;      // Global match number
  date: string;
  playerRating: number;
  p10: number;              // 10th percentile (smoothed)
  p25: number;              // 25th percentile (smoothed)
  p50: number;              // Median (smoothed)
  p75: number;              // 75th percentile (smoothed)
  p90: number;              // 90th percentile (smoothed)
  mean: number;             // Group mean (smoothed)
}

// LOESS (Locally Weighted Scatterplot Smoothing) implementation
function loess(data: number[], bandwidth: number = 0.4): number[] {
  const n = data.length;
  if (n === 0) return [];
  if (n === 1) return [...data];

  const result: number[] = [];
  const h = Math.max(Math.floor(n * bandwidth), 2);

  for (let i = 0; i < n; i++) {
    let sumWeights = 0;
    let sumWeightedY = 0;

    for (let j = 0; j < n; j++) {
      const distance = Math.abs(i - j) / h;
      if (distance < 1) {
        // Tricube weight function: (1 - |d|^3)^3
        const weight = Math.pow(1 - Math.pow(distance, 3), 3);
        sumWeights += weight;
        sumWeightedY += weight * data[j];
      }
    }

    result.push(sumWeights > 0 ? sumWeightedY / sumWeights : data[i]);
  }

  return result;
}

// Calculate percentile from sorted array
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];

  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] * (1 - fraction) + sortedArr[upper] * fraction;
}

// Helper functions for metric categorization
const getPositionCategory = (playerRating: number, allRatings: number[]) => {
  if (allRatings.length === 0) {
    return { category: 'Average', color: 'text-blue-400', description: 'similar to', percentile: 50 };
  }

  const sortedRatings = [...allRatings].sort((a, b) => a - b);
  const playerIndex = sortedRatings.findIndex(rating => rating >= playerRating);
  const pct = playerIndex === -1 ? 100 : Math.round((playerIndex / sortedRatings.length) * 100);

  if (pct >= 95) return { category: 'Top 5%', color: 'text-green-500', description: 'in top 5% of', percentile: pct };
  if (pct >= 80) return { category: 'Top 20%', color: 'text-green-400', description: 'in top 20% of', percentile: pct };
  if (pct >= 60) return { category: 'Above Average', color: 'text-blue-400', description: 'above average of', percentile: pct };
  if (pct >= 40) return { category: 'Average', color: 'text-gray-400', description: 'average among', percentile: pct };
  if (pct >= 20) return { category: 'Below Average', color: 'text-orange-400', description: 'below average of', percentile: pct };
  return { category: 'Bottom 20%', color: 'text-red-400', description: 'in bottom 20% of', percentile: pct };
};

const getTrendCategory = (recentSlope: number) => {
  if (recentSlope > 150) return { category: 'Rapidly Improving', color: 'text-green-500' };
  if (recentSlope > 40) return { category: 'Improving', color: 'text-green-400' };
  if (recentSlope > -40) return { category: 'Stable', color: 'text-blue-400' };
  if (recentSlope > -150) return { category: 'Declining', color: 'text-orange-400' };
  return { category: 'Rapidly Declining', color: 'text-red-400' };
};

const getVolatilityDescription = (volatility: number) => {
  if (volatility < 10) return { level: 'Very Low', description: 'Extremely consistent performance' };
  if (volatility < 20) return { level: 'Low', description: 'Predictable results' };
  if (volatility < 35) return { level: 'Medium', description: 'Typical variation' };
  if (volatility < 60) return { level: 'High', description: 'Noticeable swings' };
  return { level: 'Very High', description: 'Highly unpredictable' };
};

const SkillProgression: React.FC<SkillProgressionProps> = ({ playerId, playerName }) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [allCurrentRatings, setAllCurrentRatings] = useState<number[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Use view-mode-aware data source
  const { isViewModeLoading, getHistoricalRatings, getCurrentTrueSkillRatings } = useDataSource();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load historical data
  useEffect(() => {
    const loadChartData = async () => {
      // Wait for view mode data to load
      if (isViewModeLoading) return;

      try {
        setLoading(true);
        const [historicalRatings, currentRatings] = await Promise.all([
          getHistoricalRatings(),
          getCurrentTrueSkillRatings()
        ]);

        setAllCurrentRatings(Object.values(currentRatings));

        // Step 1: Collect raw data for matches where player participated
        const rawData: { matchNumber: number; date: string; playerRating: number; allRatings: number[] }[] = [];

        for (const snapshot of historicalRatings) {
          // Only include matches where this player participated
          if (snapshot.participants.includes(playerId) && snapshot.matchNumber > 0) {
            const allRatings = Object.values(snapshot.ratings).sort((a, b) => a - b);
            rawData.push({
              matchNumber: snapshot.matchNumber,
              date: snapshot.date,
              playerRating: snapshot.ratings[playerId],
              allRatings
            });
          }
        }

        if (rawData.length === 0) {
          setChartData([]);
          setLoading(false);
          return;
        }

        // Add match 0 (starting point at 1200) at the beginning
        // Use the first match's date for the starting point
        const firstMatchDate = rawData[0].date;
        const startingAllRatings = rawData[0].allRatings.map(() => 1200); // Everyone starts at 1200
        rawData.unshift({
          matchNumber: 0,
          date: firstMatchDate,
          playerRating: 1200,
          allRatings: startingAllRatings
        });

        // Step 2: Calculate raw percentiles and mean for each data point
        const rawP10 = rawData.map(d => percentile(d.allRatings, 10));
        const rawP25 = rawData.map(d => percentile(d.allRatings, 25));
        const rawP50 = rawData.map(d => percentile(d.allRatings, 50));
        const rawP75 = rawData.map(d => percentile(d.allRatings, 75));
        const rawP90 = rawData.map(d => percentile(d.allRatings, 90));
        const rawMean = rawData.map(d =>
          d.allRatings.reduce((sum, r) => sum + r, 0) / d.allRatings.length
        );

        // Step 3: Apply LOESS smoothing to percentile series and mean
        const smoothP10 = loess(rawP10);
        const smoothP25 = loess(rawP25);
        const smoothP50 = loess(rawP50);
        const smoothP75 = loess(rawP75);
        const smoothP90 = loess(rawP90);
        const smoothMean = loess(rawMean);

        // Step 4: Build final chart data
        const processedData: ChartDataPoint[] = rawData.map((d, i) => ({
          matchNumber: d.matchNumber,
          date: d.date,
          playerRating: d.playerRating,
          p10: Math.round(smoothP10[i]),
          p25: Math.round(smoothP25[i]),
          p50: Math.round(smoothP50[i]),
          p75: Math.round(smoothP75[i]),
          p90: Math.round(smoothP90[i]),
          mean: Math.round(smoothMean[i])
        }));

        setChartData(processedData);
      } catch (error) {
        console.error('Error loading skill progression:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!isViewModeLoading) {
      loadChartData();
    }
  }, [playerId, isViewModeLoading, getHistoricalRatings, getCurrentTrueSkillRatings]);

  // Calculate progression statistics
  const progressionStats = useMemo(() => {
    if (chartData.length === 0) return null;

    const startingRating = 1200; // Everyone starts at 1200
    const lastRating = chartData[chartData.length - 1]?.playerRating || 0;
    const lastMedian = chartData[chartData.length - 1]?.p50 || 0;

    // Calculate change from 1200 starting point
    const playerChange = lastRating - startingRating;
    const groupChange = lastMedian - startingRating;
    const relativeToGroup = playerChange - groupChange;

    const currentDifference = lastRating - lastMedian;
    const isAboveAverage = currentDifference > 0;

    // Calculate volatility (standard deviation of rating changes)
    const ratingChanges = chartData.slice(1).map((point, index) =>
      point.playerRating - chartData[index].playerRating
    );
    const avgChange = ratingChanges.length > 0
      ? ratingChanges.reduce((sum, change) => sum + change, 0) / ratingChanges.length
      : 0;
    const volatility = ratingChanges.length > 0
      ? Math.sqrt(ratingChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / ratingChanges.length)
      : 0;

    // Calculate recent trend (last 5 games slope)
    let recentSlope = 0;
    if (chartData.length >= 2) {
      const recentGames = chartData.slice(-Math.min(5, chartData.length));
      if (recentGames.length >= 2) {
        const firstRecent = recentGames[0];
        const lastRecent = recentGames[recentGames.length - 1];
        recentSlope = (lastRecent.playerRating - firstRecent.playerRating) / (recentGames.length - 1);
      }
    }

    const positionCategory = getPositionCategory(lastRating, allCurrentRatings);
    const trendCategory = getTrendCategory(recentSlope);
    const volatilityInfo = getVolatilityDescription(Math.round(volatility));

    return {
      startRating: startingRating,
      endRating: lastRating,
      playerChange,
      groupChange,
      relativeToGroup,
      isAboveAverage,
      currentDifference: Math.abs(currentDifference),
      volatility: Math.round(volatility),
      totalMatches: chartData.length - 1, // Subtract 1 to exclude match 0 (starting point)
      trend: playerChange >= 0 ? 'up' : 'down',
      positionCategory,
      trendCategory,
      volatilityInfo,
      recentSlope,
      lastMedian
    };
  }, [chartData, allCurrentRatings]);

  // Calculate chart domains
  const yDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [1000, 1400];

    const allValues = chartData.flatMap(d => [d.playerRating, d.p10, d.p90, 1200]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    return [Math.floor(min / 50) * 50 - 50, Math.ceil(max / 50) * 50 + 50];
  }, [chartData]);

  const xDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 10];
    const matchNumbers = chartData.map(d => d.matchNumber);
    return [Math.min(...matchNumbers) - 0.5, Math.max(...matchNumbers) + 0.5];
  }, [chartData]);

  if (loading || isViewModeLoading) {
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
          Skill Progression vs Group
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
                vs median
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: isMobile ? 400 : 550 }}>
        <VictoryChart
          width={isMobile ? 400 : 1000}
          height={isMobile ? 380 : 530}
          domain={{ x: xDomain, y: yDomain }}
          padding={{ top: 30, bottom: 60, left: 70, right: 30 }}
        >
          {/* X Axis - Match Numbers */}
          <VictoryAxis
            label="Match Number"
            tickValues={chartData.map(d => d.matchNumber)}
            tickFormat={(t) => Math.round(t)}
            style={{
              axis: { stroke: '#6B7280' },
              axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 16, padding: 40 },
              tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 10 : 14 },
              grid: { stroke: '#374151', strokeDasharray: '3,3' }
            }}
          />

          {/* Y Axis - Skill Rating */}
          <VictoryAxis
            dependentAxis
            label="Skill Rating"
            style={{
              axis: { stroke: '#6B7280' },
              axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 16, padding: 50 },
              tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 10 : 14 },
              grid: { stroke: '#374151', strokeDasharray: '3,3' }
            }}
          />

          {/* Percentile Bands - Bottom 10% (p10 to p25) */}
          <VictoryArea
            data={chartData}
            x="matchNumber"
            y="p25"
            y0="p10"
            interpolation="monotoneX"
            style={{
              data: { fill: '#EF4444', fillOpacity: 0.15, stroke: 'none' }
            }}
          />

          {/* Percentile Bands - Bottom 25% (p25 to p50) */}
          <VictoryArea
            data={chartData}
            x="matchNumber"
            y="p50"
            y0="p25"
            interpolation="monotoneX"
            style={{
              data: { fill: '#EF4444', fillOpacity: 0.25, stroke: 'none' }
            }}
          />

          {/* Percentile Bands - Top 25% (p50 to p75) */}
          <VictoryArea
            data={chartData}
            x="matchNumber"
            y="p75"
            y0="p50"
            interpolation="monotoneX"
            style={{
              data: { fill: '#EF4444', fillOpacity: 0.25, stroke: 'none' }
            }}
          />

          {/* Percentile Bands - Top 10% (p75 to p90) */}
          <VictoryArea
            data={chartData}
            x="matchNumber"
            y="p90"
            y0="p75"
            interpolation="monotoneX"
            style={{
              data: { fill: '#EF4444', fillOpacity: 0.15, stroke: 'none' }
            }}
          />

          {/* Starting Rating Line (1200) */}
          <VictoryLine
            data={[
              { x: xDomain[0], y: 1200 },
              { x: xDomain[1], y: 1200 }
            ]}
            style={{
              data: { stroke: '#6B7280', strokeWidth: 2, strokeDasharray: '10 5' }
            }}
          />

          {/* Group Mean Line (dashed red) */}
          <VictoryLine
            data={chartData}
            x="matchNumber"
            y="mean"
            interpolation="monotoneX"
            style={{
              data: { stroke: '#EF4444', strokeWidth: 2.5, strokeDasharray: '8 4' }
            }}
          />

          {/* Median Line (Group Center - solid red) */}
          <VictoryLine
            data={chartData}
            x="matchNumber"
            y="p50"
            interpolation="monotoneX"
            style={{
              data: { stroke: '#EF4444', strokeWidth: 2.5 }
            }}
          />

          {/* Player's Rating Line (simple linear) */}
          <VictoryLine
            data={chartData}
            x="matchNumber"
            y="playerRating"
            interpolation="linear"
            style={{
              data: { stroke: '#3B82F6', strokeWidth: 4 }
            }}
          />

          {/* Player's Rating Dots */}
          <VictoryScatter
            data={chartData}
            x="matchNumber"
            y="playerRating"
            size={7}
            style={{
              data: { fill: '#3B82F6' }
            }}
          />
        </VictoryChart>
      </div>

      {/* Custom Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-300">{playerName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-red-500" />
          <span className="text-sm text-gray-300">Group Median</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#EF4444" strokeWidth="2" strokeDasharray="6 3" />
          </svg>
          <span className="text-sm text-gray-300">Group Mean</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.25)' }} />
          <span className="text-sm text-gray-300">25th-75th %ile</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }} />
          <span className="text-sm text-gray-300">10th-90th %ile</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="8 4" />
          </svg>
          <span className="text-sm text-gray-300">Starting (1200)</span>
        </div>
      </div>

      {/* Statistics Summary */}
      {progressionStats && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-300">Performance vs Group</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`Shows where you rank compared to all players.

${progressionStats.positionCategory.category}: You are ${progressionStats.positionCategory.description} all players.

Your rating: ${progressionStats.endRating} points
Percentile rank: ${progressionStats.positionCategory.percentile}th percentile`}
                  position="right"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Position</span>
                </EnhancedTooltip>
                <span className={`font-medium ${progressionStats.positionCategory.color}`}>
                  {progressionStats.positionCategory.category}
                </span>
              </div>
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`Gap between your rating and group median.

${Math.abs(progressionStats.currentDifference)} points ${progressionStats.isAboveAverage ? 'above' : 'below'} median.

Larger gaps = more distinctive skill level.`}
                  position="right"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Difference</span>
                </EnhancedTooltip>
                <span className="font-medium">{progressionStats.currentDifference} pts</span>
              </div>
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`Your improvement vs everyone else's.

You: ${progressionStats.playerChange >= 0 ? '+' : ''}${progressionStats.playerChange} points since start
Group: ${progressionStats.groupChange >= 0 ? '+' : ''}${progressionStats.groupChange} points median change

Positive = improved faster than median
Negative = improved slower than median`}
                  position="right"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Relative Gain</span>
                </EnhancedTooltip>
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
                <span className="text-sm text-gray-400">Matches Played</span>
                <span className="font-medium">{progressionStats.totalMatches}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-300">Consistency</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`How much your rating varies between games.

${progressionStats.volatilityInfo.level} volatility (${progressionStats.volatility} points)

${progressionStats.volatilityInfo.description} - consistent players are easier to balance teams with.`}
                  position="left"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Volatility</span>
                </EnhancedTooltip>
                <span className="font-medium">{progressionStats.volatilityInfo.level}</span>
              </div>
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`Recent performance trajectory (last 5 games).

${progressionStats.trendCategory.category}: ${progressionStats.recentSlope >= 0 ? '+' : ''}${progressionStats.recentSlope.toFixed(1)} pts/game

Recent trends show current form better than overall stats.`}
                  position="left"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Trend</span>
                </EnhancedTooltip>
                <span className={`font-medium ${progressionStats.trendCategory.color}`}>
                  {progressionStats.trendCategory.category}
                </span>
              </div>
              <div className="flex justify-between">
                <EnhancedTooltip
                  text={`How predictable your performance is.

Based on your volatility (${progressionStats.volatility} pts).

High stability = consistent results
Low stability = unpredictable swings`}
                  position="left"
                  maxWidth="max-w-sm"
                >
                  <span className="text-sm text-gray-400 cursor-help">Stability</span>
                </EnhancedTooltip>
                <span className="font-medium">
                  {progressionStats.volatility < 10 ? 'Very High' :
                   progressionStats.volatility < 20 ? 'High' :
                   progressionStats.volatility < 35 ? 'Medium' :
                   progressionStats.volatility < 60 ? 'Low' : 'Very Low'}
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
              <strong>Your Rating (Blue Line):</strong> Shows your skill rating at each match you played.
            </p>
            <p className="mb-2">
              <strong>Group Median (Solid Red):</strong> The smoothed median (50th percentile) of all player ratings.
            </p>
            <p className="mb-2">
              <strong>Group Mean (Dashed Red):</strong> The smoothed average rating of all players.
            </p>
            <p className="mb-2">
              <strong>Shaded Bands:</strong> Show the distribution of player ratings. Darker = 25th-75th percentile (middle 50%). Lighter = 10th-90th percentile.
            </p>
            <p className="mb-2">
              <strong>Starting Line (Dashed Grey at 1200):</strong> The default skill rating all players begin with.
            </p>
            <p>
              Being above the median means you're better than half the group. The higher in the shaded region, the better your relative performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillProgression;
