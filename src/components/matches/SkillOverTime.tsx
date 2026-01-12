// src/components/matches/SkillOverTime.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, TrendingUp, Users, Info, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import {
  VictoryChart, VictoryLine, VictoryScatter, VictoryAxis
} from 'victory';
import { useSound } from '../../context/SoundContext';
import { useDataSource } from '../../hooks/useDataSource';
import { useStatsFilter } from '../../context/StatsFilterContext';

interface SkillOverTimeProps {
  onBack: () => void;
}

interface ChartDataPoint {
  matchNumber: number;
  date: string;
  [key: string]: number | string | boolean;
}

interface PlayerRatingHistory {
  playerId: string;
  playerName: string;
  currentRating: number;
  actualMatchCount: number;
}

interface LineSegment {
  data: { x: number; y: number }[];
  style: 'solid' | 'dotted';
}

interface PlayerChartData {
  segments: LineSegment[];
  participationPoints: { x: number; y: number; date: string }[];
}

const SkillOverTime: React.FC<SkillOverTimeProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const { isViewModeLoading, getAllPlayers, getHistoricalRatings, getHistoricalRatingsForPeriod, getCurrentTrueSkillRatings } = useDataSource();
  const { playerStatsFilters } = useStatsFilter();
  const [loading, setLoading] = useState(true);
  const [playerHistory, setPlayerHistory] = useState<PlayerRatingHistory[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [colorMap, setColorMap] = useState<{ [key: string]: string }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

  // Min games filter for this graph specifically (not from relationship filter)
  const [minGames, setMinGames] = useState<number>(() => {
    const saved = localStorage.getItem('skillOverTime_minGames');
    return saved ? parseInt(saved, 10) : 3;
  });

  // Derived date range from inherited filters only (no local date picker)
  const dateRange = useMemo(() => {
    if (playerStatsFilters?.dateRange?.startDate && playerStatsFilters?.dateRange?.endDate) {
      return {
        start: playerStatsFilters.dateRange.startDate.toISOString().split('T')[0],
        end: playerStatsFilters.dateRange.endDate.toISOString().split('T')[0]
      };
    }
    return { start: null, end: null };
  }, [playerStatsFilters?.dateRange]);

  // Check if using inherited filters
  const usingInheritedFilters = !!(playerStatsFilters?.dateRange?.startDate && playerStatsFilters?.dateRange?.endDate);

  // Get recalculateTrueSkill from context
  const recalculateTrueSkill = playerStatsFilters?.recalculateTrueSkill ?? false;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load data on mount (view mode aware)
  useEffect(() => {
    // Wait for view mode loading to complete
    if (isViewModeLoading) return;

    const loadRatingHistory = async () => {
      setLoading(true);
      try {
        // Use recalculated TrueSkill if enabled in PlayerStats context
        const startDate = dateRange.start ? new Date(dateRange.start) : undefined;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : undefined;

        let history;
        if (recalculateTrueSkill && (startDate || endDate)) {
          // Use recalculated ratings for the filtered period
          history = await getHistoricalRatingsForPeriod(startDate, endDate, true);
        } else if (startDate || endDate) {
          // Just filter by date without recalculating
          history = await getHistoricalRatingsForPeriod(startDate, endDate, false);
        } else {
          // No date filter - use regular historical ratings
          history = await getHistoricalRatings();
        }

        const currentRatings = await getCurrentTrueSkillRatings();
        const players = await getAllPlayers();
        const nameMap = new Map(players.map(p => [p.id, p.name]));

        // Get all unique player IDs
        const allPlayerIds = new Set<string>();
        history.forEach(snapshot => {
          Object.keys(snapshot.ratings).forEach(playerId => {
            allPlayerIds.add(playerId);
          });
        });

        // Build chart data - one entry per match
        const chartDataPoints: ChartDataPoint[] = history.map(snapshot => {
          const point: ChartDataPoint = {
            matchNumber: snapshot.matchNumber,
            date: snapshot.date
          };

          // Add each player's rating and participation status
          allPlayerIds.forEach(playerId => {
            const playerName = nameMap.get(playerId) || playerId;
            if (snapshot.ratings[playerId] !== undefined) {
              point[playerName] = snapshot.ratings[playerId];
              point[playerName + '_participated'] = snapshot.participants.includes(playerId);
            }
          });

          return point;
        });

        setChartData(chartDataPoints);

        // Build player history for selection UI
        const playerHistoryArray: PlayerRatingHistory[] = [];
        allPlayerIds.forEach(playerId => {
          const playerName = nameMap.get(playerId) || playerId;
          const actualMatchCount = history.filter(s => s.participants.includes(playerId)).length;

          if (actualMatchCount > 0) {
            playerHistoryArray.push({
              playerId,
              playerName,
              currentRating: currentRatings[playerId] || 1200,
              actualMatchCount
            });
          }
        });

        playerHistoryArray.sort((a, b) => b.currentRating - a.currentRating);
        setPlayerHistory(playerHistoryArray);

        // Select top 5 players by default
        const topPlayers = playerHistoryArray
          .filter(p => p.actualMatchCount >= 5)
          .slice(0, 5)
          .map(p => p.playerId);
        setSelectedPlayers(new Set(topPlayers));

        // Generate colors
        const colors = generateColors(playerHistoryArray.length);
        const newColorMap: { [key: string]: string } = {};
        playerHistoryArray.forEach((player, index) => {
          newColorMap[player.playerName] = colors[index];
        });
        setColorMap(newColorMap);

      } catch (error) {
        console.error('Error loading rating history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRatingHistory();
  }, [isViewModeLoading, getHistoricalRatings, getHistoricalRatingsForPeriod, getCurrentTrueSkillRatings, getAllPlayers, dateRange.start, dateRange.end, recalculateTrueSkill]);

  // Filter chart data by date range
  const filteredChartData = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return chartData;

    return chartData.filter(point => {
      const pointDate = new Date(point.date);
      if (dateRange.start && pointDate < new Date(dateRange.start)) return false;
      if (dateRange.end && pointDate > new Date(dateRange.end + 'T23:59:59')) return false;
      return true;
    });
  }, [chartData, dateRange]);

  // Generate segments and participation points for a player
  // Only shows data from their Nth participation onwards (where N = minGames)
  const getPlayerChartData = useCallback((playerName: string): PlayerChartData => {
    const data = filteredChartData;
    if (data.length < 2) return { segments: [], participationPoints: [] };

    // Track participation count and find the minGames-th participation
    let participationCount = 0;
    let startIdx = -1;  // Index where minGames-th participation occurs
    let lastIdx = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][playerName + '_participated']) {
        participationCount++;
        if (participationCount === minGames && startIdx === -1) {
          startIdx = i;  // Start rendering from Nth game
        }
        lastIdx = i;
      }
    }

    // If player hasn't reached minGames participations, don't render
    if (startIdx === -1) return { segments: [], participationPoints: [] };

    // Generate segments - starting from the minGames-th participation
    const segments: LineSegment[] = [];
    for (let i = startIdx; i < lastIdx; i++) {
      const current = data[i];
      const next = data[i + 1];
      const nextParticipated = next[playerName + '_participated'];

      segments.push({
        data: [
          { x: current.matchNumber, y: current[playerName] as number },
          { x: next.matchNumber, y: next[playerName] as number }
        ],
        style: nextParticipated ? 'solid' : 'dotted'
      });
    }

    // Generate participation points - only from minGames-th participation onwards
    let count = 0;
    const participationPoints = data
      .filter(d => {
        if (d[playerName + '_participated']) {
          count++;
          return count >= minGames;
        }
        return false;
      })
      .map(d => ({
        x: d.matchNumber,
        y: d[playerName] as number,
        date: d.date
      }));

    return { segments, participationPoints };
  }, [filteredChartData, minGames]);

  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  const togglePlayer = (playerId: string) => {
    playSound('buttonClick');
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const selectAllPlayers = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set(eligiblePlayers.map(p => p.playerId)));
  };

  const clearSelection = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set());
  };

  // Min games handlers
  const incrementMinGames = useCallback(() => {
    playSound('buttonClick');
    const newValue = minGames + 1;
    setMinGames(newValue);
    localStorage.setItem('skillOverTime_minGames', newValue.toString());
  }, [playSound, minGames]);

  const decrementMinGames = useCallback(() => {
    playSound('buttonClick');
    if (minGames > 1) {
      const newValue = minGames - 1;
      setMinGames(newValue);
      localStorage.setItem('skillOverTime_minGames', newValue.toString());
    }
  }, [playSound, minGames]);

  const generateColors = (count: number): string[] => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
      '#06B6D4', '#A855F7', '#F43F5E', '#0EA5E9', '#22C55E'
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  };

  const toggleFilters = () => {
    playSound('buttonClick');
    setShowFilters(!showFilters);
  };

  // Calculate domain for Y axis
  const yDomain = useMemo((): [number, number] => {
    let minRating = Infinity;
    let maxRating = -Infinity;

    playerHistory
      .filter(p => selectedPlayers.has(p.playerId))
      .forEach(player => {
        filteredChartData.forEach(point => {
          const rating = point[player.playerName] as number;
          if (rating !== undefined) {
            minRating = Math.min(minRating, rating);
            maxRating = Math.max(maxRating, rating);
          }
        });
      });

    if (minRating === Infinity) return [1000, 1400];
    return [Math.floor(minRating / 50) * 50 - 50, Math.ceil(maxRating / 50) * 50 + 50];
  }, [filteredChartData, playerHistory, selectedPlayers]);

  // Calculate domain for X axis
  const xDomain = useMemo((): [number, number] => {
    if (filteredChartData.length === 0) return [0, 10];
    const matchNumbers = filteredChartData.map(d => d.matchNumber);
    return [Math.min(...matchNumbers), Math.max(...matchNumbers)];
  }, [filteredChartData]);

  // Filter players by minimum games
  const eligiblePlayers = useMemo(() => {
    return playerHistory.filter(p => p.actualMatchCount >= minGames);
  }, [playerHistory, minGames]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 no-screenshot">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back</span>
        </button>

        <h2 className="text-xl sm:text-2xl font-bold">Skill Rating Over Time</h2>
      </div>

      {/* Inherited Filters Banner */}
      {usingInheritedFilters && (
        <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg flex items-center flex-wrap gap-2">
          <Filter size={18} className="mr-2 text-purple-400" />
          <span className="text-sm text-purple-200">
            Using filters from Player Stats
            {playerStatsFilters?.recencyMonths && `: Last ${playerStatsFilters.recencyMonths} months`}
            {recalculateTrueSkill && ' (TrueSkill recalculated)'}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Mobile Filter Toggle */}
          <div className="mb-4 sm:hidden no-screenshot">
            <button
              onClick={toggleFilters}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center">
                <Filter size={18} className="mr-2" />
                <span>Player Selection ({selectedPlayers.size} selected)</span>
              </div>
              {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* Min Games Filter */}
          <div className={`mb-4 no-screenshot ${!showFilters && isMobile ? 'hidden' : ''}`}>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center">
                  <Filter size={18} className="mr-2 text-blue-400" />
                  <span className="font-semibold">Minimum Games to Show Player</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={decrementMinGames}
                    disabled={minGames <= 1}
                    className="w-8 h-8 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="text-lg font-semibold w-8 text-center">{minGames}</span>
                  <button
                    onClick={incrementMinGames}
                    className="w-8 h-8 rounded-lg bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-lg font-bold"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-400 ml-2">games</span>
                </div>
              </div>
            </div>
          </div>

          {/* Player Selection */}
          <div className={`mb-6 no-screenshot ${!showFilters && isMobile ? 'hidden' : ''}`}>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h3 className="font-semibold flex items-center">
                  <Users size={18} className="mr-2" />
                  Select Players to Compare
                </h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={selectAllPlayers}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm flex-1 sm:flex-none"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm flex-1 sm:flex-none"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {eligiblePlayers.map(player => (
                  <button
                    key={player.playerId}
                    onClick={() => togglePlayer(player.playerId)}
                    className={`p-2 sm:p-3 rounded-lg text-left transition-all ${
                      selectedPlayers.has(player.playerId)
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="font-medium truncate">{player.playerName}</div>
                    <div className="text-xs sm:text-sm opacity-80">
                      Rating: {player.currentRating}
                    </div>
                    <div className="text-xs opacity-60">
                      {player.actualMatchCount} matches played
                    </div>
                  </button>
                ))}
              </div>
              {eligiblePlayers.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  No players with {minGames}+ games. Try lowering the minimum.
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          {selectedPlayers.size > 0 ? (
            <div className="bg-gray-700 rounded-lg p-2 sm:p-4">
              <div style={{ width: '100%', height: isMobile ? 400 : 600 }}>
                <VictoryChart
                  width={isMobile ? 380 : 1000}
                  height={isMobile ? 380 : 580}
                  domain={{ x: xDomain, y: yDomain }}
                  padding={{ top: 60, bottom: 60, left: 70, right: 30 }}
                >
                  {/* Date Axis (top) */}
                  <VictoryAxis
                    orientation="top"
                    tickValues={filteredChartData.filter(d => d.matchNumber > 0).map(d => d.matchNumber)}
                    tickFormat={(t) => {
                      const match = filteredChartData.find(d => d.matchNumber === t);
                      if (!match) return '';
                      const date = new Date(match.date);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                    }}
                    style={{
                      axis: { stroke: '#6B7280' },
                      tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 8 : 10, angle: -45, textAnchor: 'start' },
                      grid: { stroke: 'transparent' }
                    }}
                  />

                  {/* Match Number Axis (bottom) */}
                  <VictoryAxis
                    label="Match Number"
                    tickFormat={(t) => Math.round(t)}
                    style={{
                      axis: { stroke: '#6B7280' },
                      axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 14, padding: 40 },
                      tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 },
                      grid: { stroke: '#374151', strokeDasharray: '3,3' }
                    }}
                  />

                  {/* Y Axis */}
                  <VictoryAxis
                    dependentAxis
                    label="Skill Rating"
                    style={{
                      axis: { stroke: '#6B7280' },
                      axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 14, padding: 50 },
                      tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 },
                      grid: { stroke: '#374151', strokeDasharray: '3,3' }
                    }}
                  />

                  {/* Render line segments for each selected player */}
                  {playerHistory
                    .filter(p => selectedPlayers.has(p.playerId))
                    .flatMap(player => {
                      const { segments } = getPlayerChartData(player.playerName);
                      const color = colorMap[player.playerName];
                      const isHovered = hoveredPlayer === player.playerId;
                      const isDimmed = hoveredPlayer !== null && !isHovered;

                      return segments.map((segment, idx) => (
                        <VictoryLine
                          key={`${player.playerId}-seg-${idx}`}
                          data={segment.data}
                          style={{
                            data: {
                              stroke: color,
                              strokeWidth: isHovered ? 5 : 3,
                              strokeOpacity: isDimmed ? 0.3 : 1,
                              strokeDasharray: segment.style === 'dotted' ? '8 4' : undefined,
                              cursor: 'pointer'
                            }
                          }}
                          events={[{
                            target: 'data',
                            eventHandlers: {
                              onMouseEnter: () => {
                                setHoveredPlayer(player.playerId);
                                return [];
                              },
                              onMouseLeave: () => {
                                setHoveredPlayer(null);
                                return [];
                              }
                            }
                          }]}
                        />
                      ));
                    })}

                  {/* Render dot markers at participation points for each selected player */}
                  {playerHistory
                    .filter(p => selectedPlayers.has(p.playerId))
                    .map(player => {
                      const { participationPoints } = getPlayerChartData(player.playerName);
                      const color = colorMap[player.playerName];
                      const isHovered = hoveredPlayer === player.playerId;
                      const isDimmed = hoveredPlayer !== null && !isHovered;

                      return (
                        <VictoryScatter
                          key={`${player.playerId}-scatter`}
                          data={participationPoints}
                          size={isHovered ? 8 : 5}
                          symbol="circle"
                          style={{
                            data: {
                              fill: color,
                              fillOpacity: isDimmed ? 0.3 : 1,
                              cursor: 'pointer'
                            }
                          }}
                          events={[{
                            target: 'data',
                            eventHandlers: {
                              onMouseEnter: () => {
                                setHoveredPlayer(player.playerId);
                                return [];
                              },
                              onMouseLeave: () => {
                                setHoveredPlayer(null);
                                return [];
                              }
                            }
                          }]}
                        />
                      );
                    })}
                </VictoryChart>
              </div>

              {/* Custom Legend */}
              <div className="flex flex-wrap gap-4 mt-4 justify-center p-3 bg-gray-800 rounded-lg">
                {playerHistory
                  .filter(p => selectedPlayers.has(p.playerId))
                  .map(player => (
                    <div
                      key={player.playerId}
                      className="flex items-center gap-2 cursor-pointer"
                      onMouseEnter={() => setHoveredPlayer(player.playerId)}
                      onMouseLeave={() => setHoveredPlayer(null)}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colorMap[player.playerName] }}
                      />
                      <span className={`text-sm ${hoveredPlayer === player.playerId ? 'text-white font-bold' : 'text-gray-300'}`}>
                        {player.playerName}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-8 text-center">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">Select players to view their rating progression</p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-start">
              <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="mb-2">
                  <strong>Line Types:</strong> Solid lines lead to matches where the player participated.
                  Dotted lines show periods of inactivity (rating carried forward).
                </p>
                <p className="mb-2">
                  <strong>Dot Markers:</strong> Each dot marks a match where the player actually participated.
                </p>
                <p className="mb-2">
                  <strong>Legend Hover:</strong> Hover over a player name in the legend to highlight their line.
                </p>
                <p>
                  Ratings use the TrueSkill system where new players start around 1200 and converge to their true skill level after ~20 matches.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SkillOverTime;
