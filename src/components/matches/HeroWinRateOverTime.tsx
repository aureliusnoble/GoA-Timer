// src/components/matches/HeroWinRateOverTime.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, TrendingUp, Info, Filter, ChevronDown, ChevronUp, Calendar, Globe, Users, Loader2 } from 'lucide-react';
import { VictoryChart, VictoryLine, VictoryScatter, VictoryAxis } from 'victory';
import dbService from '../../services/DatabaseService';
import { GlobalStatsService } from '../../services/supabase/GlobalStatsService';
import { isSupabaseConfigured } from '../../services/supabase/SupabaseClient';
import { useSound } from '../../context/SoundContext';

interface HeroWinRateOverTimeProps {
  onBack: () => void;
  initialStatsMode?: 'local' | 'global';
  inheritedMinGames?: number;
  inheritedDateRange?: { startDate?: Date; endDate?: Date };
}

interface HeroTimeSeries {
  heroId: number;
  heroName: string;
  icon: string;
  totalGames: number;
  currentWinRate: number;
  dataPoints: Array<{
    date: string;
    gamesPlayedTotal: number;
    winsTotal: number;
    winRate: number;
    gamesPlayedOnDate: number;
  }>;
}

interface HeroWinRateData {
  heroes: HeroTimeSeries[];
  dateRange: { firstMatch: string; lastMatch: string } | null;
}

const HeroWinRateOverTime: React.FC<HeroWinRateOverTimeProps> = ({
  onBack,
  initialStatsMode = 'local',
  inheritedMinGames,
  inheritedDateRange
}) => {
  const { playSound } = useSound();
  const [loading, setLoading] = useState(true);
  const [heroData, setHeroData] = useState<HeroWinRateData | null>(null);
  const [selectedHeroes, setSelectedHeroes] = useState<Set<number>>(new Set());
  const [colorMap, setColorMap] = useState<Record<number, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredHero, setHoveredHero] = useState<number | null>(null);

  // Stats mode toggle
  const [statsMode, setStatsMode] = useState<'local' | 'global'>(initialStatsMode);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const cloudAvailable = isSupabaseConfigured();

  // Inherited filter state
  const [usingInheritedFilters, setUsingInheritedFilters] = useState<boolean>(
    !!(inheritedMinGames || inheritedDateRange)
  );

  // Min games filter - initialize from inherited or localStorage
  const [minGames, setMinGames] = useState<number>(() => {
    if (inheritedMinGames !== undefined) return inheritedMinGames;
    const saved = localStorage.getItem('heroWinRateOverTime_minGames');
    return saved ? parseInt(saved, 10) : 3;
  });

  // Date range filter - initialize from inherited or localStorage
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() => {
    if (inheritedDateRange?.startDate && inheritedDateRange?.endDate) {
      return {
        start: inheritedDateRange.startDate.toISOString().split('T')[0],
        end: inheritedDateRange.endDate.toISOString().split('T')[0]
      };
    }
    return {
      start: localStorage.getItem('heroWinRateOverTime_startDate'),
      end: localStorage.getItem('heroWinRateOverTime_endDate')
    };
  });

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist minGames
  useEffect(() => {
    localStorage.setItem('heroWinRateOverTime_minGames', minGames.toString());
  }, [minGames]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (statsMode === 'local') {
        setLoading(true);
        try {
          const startDate = dateRange.start ? new Date(dateRange.start) : undefined;
          const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : undefined;

          const data = await dbService.getHeroWinRateOverTime(undefined, minGames, startDate, endDate);
          setHeroData(data);

          // Auto-select top 5 heroes if none selected
          if (selectedHeroes.size === 0 && data.heroes.length > 0) {
            const topHeroes = data.heroes.slice(0, 5).map(h => h.heroId);
            setSelectedHeroes(new Set(topHeroes));
          }

          // Generate colors
          const colors = generateColors(data.heroes.length);
          const newColorMap: Record<number, string> = {};
          data.heroes.forEach((hero, idx) => {
            newColorMap[hero.heroId] = colors[idx];
          });
          setColorMap(newColorMap);
        } catch (error) {
          console.error('Error loading hero win rate data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // Global mode
        setGlobalLoading(true);
        setGlobalError(null);
        try {
          const startDate = dateRange.start ? new Date(dateRange.start) : null;
          const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;

          const result = await GlobalStatsService.getGlobalHeroStatsOverTime(
            undefined,
            minGames,
            startDate,
            endDate
          );

          if (result.success && result.data) {
            setHeroData(result.data);

            // Auto-select top 5 heroes if none selected
            if (selectedHeroes.size === 0 && result.data.heroes.length > 0) {
              const topHeroes = result.data.heroes.slice(0, 5).map(h => h.heroId);
              setSelectedHeroes(new Set(topHeroes));
            }

            // Generate colors
            const colors = generateColors(result.data.heroes.length);
            const newColorMap: Record<number, string> = {};
            result.data.heroes.forEach((hero, idx) => {
              newColorMap[hero.heroId] = colors[idx];
            });
            setColorMap(newColorMap);
          } else {
            setGlobalError(result.error || 'Failed to load global data');
          }
        } catch (error) {
          console.error('Error loading global hero win rate data:', error);
          setGlobalError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
          setGlobalLoading(false);
          setLoading(false);
        }
      }
    };

    loadData();
  }, [statsMode, minGames, dateRange.start, dateRange.end]);

  const handleBack = useCallback(() => {
    playSound('buttonClick');
    onBack();
  }, [playSound, onBack]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    playSound('buttonClick');
    const newValue = value || null;
    setDateRange(prev => ({ ...prev, [field]: newValue }));
    if (newValue) {
      localStorage.setItem(`heroWinRateOverTime_${field}Date`, newValue);
    } else {
      localStorage.removeItem(`heroWinRateOverTime_${field}Date`);
    }
  }, [playSound]);

  const clearDateRange = useCallback(() => {
    playSound('buttonClick');
    setDateRange({ start: null, end: null });
    localStorage.removeItem('heroWinRateOverTime_startDate');
    localStorage.removeItem('heroWinRateOverTime_endDate');
  }, [playSound]);

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

  const toggleHero = useCallback((heroId: number) => {
    playSound('buttonClick');
    setSelectedHeroes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(heroId)) {
        newSet.delete(heroId);
      } else {
        newSet.add(heroId);
      }
      return newSet;
    });
  }, [playSound]);

  const selectAllHeroes = useCallback(() => {
    playSound('buttonClick');
    if (heroData) {
      setSelectedHeroes(new Set(heroData.heroes.map(h => h.heroId)));
    }
  }, [playSound, heroData]);

  const clearSelection = useCallback(() => {
    playSound('buttonClick');
    setSelectedHeroes(new Set());
  }, [playSound]);

  const toggleFilters = () => {
    playSound('buttonClick');
    setShowFilters(!showFilters);
  };

  const clearInheritedFilters = useCallback(() => {
    playSound('buttonClick');
    setUsingInheritedFilters(false);
    // Reset to default values
    setMinGames(3);
    setDateRange({ start: null, end: null });
    localStorage.removeItem('heroWinRateOverTime_startDate');
    localStorage.removeItem('heroWinRateOverTime_endDate');
  }, [playSound]);

  // Get chart data for a hero - converts data points to x/y format
  const getHeroChartData = useCallback((heroId: number) => {
    const hero = heroData?.heroes.find(h => h.heroId === heroId);
    if (!hero || hero.dataPoints.length === 0) {
      return { lineData: [], scatterData: [] };
    }

    // Convert dates to numeric timestamps for x-axis
    const lineData = hero.dataPoints.map(dp => ({
      x: new Date(dp.date).getTime(),
      y: dp.winRate
    }));

    // Scatter points at each data point (for the dots)
    const scatterData = hero.dataPoints.map(dp => ({
      x: new Date(dp.date).getTime(),
      y: dp.winRate,
      gamesOnDate: dp.gamesPlayedOnDate
    }));

    return { lineData, scatterData };
  }, [heroData]);

  // Calculate Y domain (win rate 0-100 with some padding)
  const yDomain = useMemo((): [number, number] => {
    if (!heroData) return [0, 100];

    let minRate = 100;
    let maxRate = 0;

    heroData.heroes
      .filter(h => selectedHeroes.has(h.heroId))
      .forEach(hero => {
        hero.dataPoints.forEach(dp => {
          minRate = Math.min(minRate, dp.winRate);
          maxRate = Math.max(maxRate, dp.winRate);
        });
      });

    if (minRate === 100 && maxRate === 0) return [0, 100];

    // Add padding
    const padding = 10;
    return [
      Math.max(0, Math.floor(minRate / 10) * 10 - padding),
      Math.min(100, Math.ceil(maxRate / 10) * 10 + padding)
    ];
  }, [heroData, selectedHeroes]);

  // Calculate X domain (date range)
  const xDomain = useMemo((): [number, number] => {
    if (!heroData) return [Date.now() - 86400000 * 30, Date.now()];

    const allDates: number[] = [];
    heroData.heroes
      .filter(h => selectedHeroes.has(h.heroId))
      .forEach(hero => {
        hero.dataPoints.forEach(dp => {
          allDates.push(new Date(dp.date).getTime());
        });
      });

    if (allDates.length === 0) return [Date.now() - 86400000 * 30, Date.now()];

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);

    // Add 1 day padding on each side
    const dayMs = 86400000;
    return [minDate - dayMs, maxDate + dayMs];
  }, [heroData, selectedHeroes]);

  const isLoading = loading || globalLoading;

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

        <h2 className="text-xl sm:text-2xl font-bold">Hero Win Rate Over Time</h2>
      </div>

      {/* Stats Mode Toggle */}
      {cloudAvailable && (
        <div className="mb-4 no-screenshot">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                playSound('buttonClick');
                setStatsMode('local');
              }}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                statsMode === 'local'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Users size={18} className="mr-2" />
              Play Group
            </button>
            <button
              onClick={() => {
                playSound('buttonClick');
                setStatsMode('global');
              }}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                statsMode === 'global'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Globe size={18} className="mr-2" />
              Global
            </button>
          </div>
        </div>
      )}

      {/* Global Stats Banner */}
      {statsMode === 'global' && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg no-screenshot">
          <div className="flex items-center">
            <Globe size={18} className="mr-2 text-green-400 flex-shrink-0" />
            <span className="text-sm text-green-200">
              Viewing global statistics from all players
            </span>
          </div>
        </div>
      )}

      {/* Global Error */}
      {statsMode === 'global' && globalError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg no-screenshot">
          <p className="text-sm text-red-200">{globalError}</p>
        </div>
      )}

      {/* Inherited Filters Banner */}
      {usingInheritedFilters && (inheritedMinGames || inheritedDateRange) && (
        <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg flex items-center justify-between flex-wrap gap-2 no-screenshot">
          <div className="flex items-center">
            <Filter size={18} className="mr-2 text-purple-400" />
            <span className="text-sm text-purple-200">
              Using filters from Hero Stats
              {inheritedMinGames && `: Min ${inheritedMinGames} games`}
              {inheritedDateRange?.startDate && inheritedDateRange?.endDate &&
                `, ${inheritedDateRange.startDate.toLocaleDateString()} - ${inheritedDateRange.endDate.toLocaleDateString()}`
              }
            </span>
          </div>
          <button
            onClick={clearInheritedFilters}
            className="text-sm text-purple-400 hover:text-purple-300 underline"
          >
            Reset to Defaults
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="animate-spin text-blue-400 mb-2" />
            <span className="text-gray-400">Loading hero data...</span>
          </div>
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
                <span>Hero Selection ({selectedHeroes.size} selected)</span>
              </div>
              {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* Filters Section */}
          <div className={`${isMobile && !showFilters ? 'hidden' : ''} mb-6 space-y-4 no-screenshot`}>
            {/* Date Range Filter */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Calendar size={18} className="mr-2 text-blue-400" />
                <span className="font-medium">Date Range</span>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">From:</span>
                  <input
                    type="date"
                    value={dateRange.start || ''}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">To:</span>
                  <input
                    type="date"
                    value={dateRange.end || ''}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm"
                  />
                </div>
                {(dateRange.start || dateRange.end) && (
                  <button
                    onClick={clearDateRange}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Min Games Filter */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Minimum Games</span>
                  <p className="text-xs text-gray-400 mt-1">Heroes must have at least this many games to appear</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      playSound('buttonClick');
                      setMinGames(prev => Math.max(1, prev - 1));
                    }}
                    disabled={minGames <= 1}
                    className="w-10 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xl font-bold"
                  >
                    −
                  </button>
                  <div className="w-12 h-10 flex items-center justify-center bg-gray-800 border border-gray-600 rounded-lg font-medium">
                    {minGames}
                  </div>
                  <button
                    onClick={() => {
                      playSound('buttonClick');
                      setMinGames(prev => Math.min(50, prev + 1));
                    }}
                    disabled={minGames >= 50}
                    className="w-10 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Hero Selection */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Hero Selection</span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllHeroes}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                {heroData?.heroes.map(hero => (
                  <button
                    key={hero.heroId}
                    onClick={() => toggleHero(hero.heroId)}
                    className={`p-2 rounded-lg text-left transition-all ${
                      selectedHeroes.has(hero.heroId)
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={hero.icon}
                        alt={hero.heroName}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32?text=H';
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{hero.heroName}</div>
                        <div className="text-xs opacity-70">{hero.totalGames}g • {hero.currentWinRate.toFixed(0)}%</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          {selectedHeroes.size > 0 && heroData && heroData.heroes.some(h => selectedHeroes.has(h.heroId)) ? (
            <div className="bg-gray-700 rounded-lg p-2 sm:p-4">
              <div style={{ width: '100%', height: isMobile ? 400 : 500 }}>
                <VictoryChart
                  width={isMobile ? 380 : 1000}
                  height={isMobile ? 380 : 480}
                  domain={{ x: xDomain, y: yDomain }}
                  padding={{ top: 40, bottom: 60, left: 60, right: 30 }}
                  scale={{ x: 'time' }}
                >
                  {/* X Axis (Date) */}
                  <VictoryAxis
                    label="Date"
                    tickFormat={(t) => {
                      const date = new Date(t);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    style={{
                      axis: { stroke: '#6B7280' },
                      axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 14, padding: 40 },
                      tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 9 : 11, angle: -45, textAnchor: 'end' },
                      grid: { stroke: '#374151', strokeDasharray: '3,3' }
                    }}
                  />

                  {/* Y Axis (Win Rate %) */}
                  <VictoryAxis
                    dependentAxis
                    label="Win Rate %"
                    tickFormat={(t) => `${t}%`}
                    style={{
                      axis: { stroke: '#6B7280' },
                      axisLabel: { fill: '#9CA3AF', fontSize: isMobile ? 12 : 14, padding: 45 },
                      tickLabels: { fill: '#9CA3AF', fontSize: isMobile ? 10 : 12 },
                      grid: { stroke: '#374151', strokeDasharray: '3,3' }
                    }}
                  />

                  {/* 50% reference line */}
                  <VictoryLine
                    data={[{ x: xDomain[0], y: 50 }, { x: xDomain[1], y: 50 }]}
                    style={{
                      data: { stroke: '#6B7280', strokeWidth: 1, strokeDasharray: '5,5' }
                    }}
                  />

                  {/* Render lines for each selected hero */}
                  {heroData.heroes
                    .filter(h => selectedHeroes.has(h.heroId))
                    .map(hero => {
                      const { lineData } = getHeroChartData(hero.heroId);
                      const color = colorMap[hero.heroId];
                      const isHovered = hoveredHero === hero.heroId;
                      const isDimmed = hoveredHero !== null && !isHovered;

                      return (
                        <VictoryLine
                          key={`line-${hero.heroId}`}
                          data={lineData}
                          style={{
                            data: {
                              stroke: color,
                              strokeWidth: isHovered ? 4 : 2,
                              strokeOpacity: isDimmed ? 0.2 : 1,
                              cursor: 'pointer'
                            }
                          }}
                          events={[{
                            target: 'data',
                            eventHandlers: {
                              onMouseEnter: () => {
                                setHoveredHero(hero.heroId);
                                return [];
                              },
                              onMouseLeave: () => {
                                setHoveredHero(null);
                                return [];
                              }
                            }
                          }]}
                        />
                      );
                    })}

                  {/* Render scatter dots for each selected hero */}
                  {heroData.heroes
                    .filter(h => selectedHeroes.has(h.heroId))
                    .map(hero => {
                      const { scatterData } = getHeroChartData(hero.heroId);
                      const color = colorMap[hero.heroId];
                      const isHovered = hoveredHero === hero.heroId;
                      const isDimmed = hoveredHero !== null && !isHovered;

                      return (
                        <VictoryScatter
                          key={`scatter-${hero.heroId}`}
                          data={scatterData}
                          size={isHovered ? 6 : 4}
                          symbol="circle"
                          style={{
                            data: {
                              fill: color,
                              fillOpacity: isDimmed ? 0.2 : 1,
                              cursor: 'pointer'
                            }
                          }}
                          events={[{
                            target: 'data',
                            eventHandlers: {
                              onMouseEnter: () => {
                                setHoveredHero(hero.heroId);
                                return [];
                              },
                              onMouseLeave: () => {
                                setHoveredHero(null);
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
              <div className="flex flex-wrap gap-3 mt-4 justify-center p-3 bg-gray-800 rounded-lg">
                {heroData.heroes
                  .filter(h => selectedHeroes.has(h.heroId))
                  .map(hero => (
                    <div
                      key={hero.heroId}
                      className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-700"
                      onMouseEnter={() => setHoveredHero(hero.heroId)}
                      onMouseLeave={() => setHoveredHero(null)}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colorMap[hero.heroId] }}
                      />
                      <img
                        src={hero.icon}
                        alt={hero.heroName}
                        className="w-5 h-5 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className={`text-sm ${hoveredHero === hero.heroId ? 'text-white font-bold' : 'text-gray-300'}`}>
                        {hero.heroName}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-8 text-center">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">
                {heroData?.heroes.length === 0
                  ? `No heroes found with at least ${minGames} games`
                  : 'Select heroes to view their win rate progression'}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-start">
              <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="mb-2">
                  <strong>Lines:</strong> Show cumulative win rate from first match to last match for each hero.
                  The line connects data points at each date where matches occurred.
                </p>
                <p className="mb-2">
                  <strong>Dots:</strong> Mark dates where the hero was played. Multiple games on the same day are combined.
                </p>
                <p className="mb-2">
                  <strong>Legend:</strong> Hover over a hero name to highlight their line.
                </p>
                <p>
                  <strong>50% Line:</strong> Dashed line shows the 50% win rate baseline.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeroWinRateOverTime;
