// src/components/matches/HeroStats.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Search, Info, Filter, ChevronDown, ChevronUp, Shield, Calendar, Globe, Users, RefreshCw, Loader2, AlertCircle, TrendingUp, Network } from 'lucide-react';
import { Hero } from '../../types';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';
import HeroInfoDisplay from '../common/HeroInfoDisplay';
import { heroes as allHeroes } from '../../data/heroes';
import { GlobalStatsService, GlobalHeroStats } from '../../services/supabase/GlobalStatsService';
import { isSupabaseConfigured } from '../../services/supabase/SupabaseClient';
import HeroWinRateOverTime from './HeroWinRateOverTime';
import HeroRelationshipGraph from './HeroRelationshipGraph';
import { useDataSource } from '../../hooks/useDataSource';

// Hero statistics interface
interface HeroStats {
  heroId: number;
  heroName: string;
  icon: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  complexity: number;
  roles: string[];
  bestTeammates: { 
    heroId: number, 
    heroName: string, 
    icon: string, 
    winRate: number, 
    gamesPlayed: number 
  }[];
  bestAgainst: { 
    heroId: number, 
    heroName: string, 
    icon: string, 
    winRate: number, 
    gamesPlayed: number 
  }[];
  worstAgainst: { 
    heroId: number, 
    heroName: string, 
    icon: string, 
    winRate: number, 
    gamesPlayed: number 
  }[];
  expansion: string;
}

interface HeroStatsProps {
  onBack: () => void;
}

const HeroStats: React.FC<HeroStatsProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const { isViewMode, isViewModeLoading, getHeroStats } = useDataSource();
  const [heroStats, setHeroStats] = useState<HeroStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('games');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterExpansion, setFilterExpansion] = useState<string | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [minGamesRelationship, setMinGamesRelationship] = useState<number>(() => {
    const saved = localStorage.getItem('heroStats_minGames');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [recencyMonths, setRecencyMonths] = useState<number | null>(() => {
    const saved = localStorage.getItem('heroStats_recencyMonths');
    return saved ? parseInt(saved, 10) : null; // null = All Time
  });

  // Global stats mode state
  const [statsMode, setStatsMode] = useState<'local' | 'global'>('local');
  const [globalHeroStats, setGlobalHeroStats] = useState<GlobalHeroStats[]>([]);
  const [globalStatsLoading, setGlobalStatsLoading] = useState(false);
  const [globalStatsError, setGlobalStatsError] = useState<string | null>(null);
  const [globalCacheAge, setGlobalCacheAge] = useState<number | null>(null);

  // Win rate over time view state
  const [showWinRateOverTime, setShowWinRateOverTime] = useState(false);

  // Relationship graph view state
  const [showRelationshipGraph, setShowRelationshipGraph] = useState(false);

  // Check if cloud features are available
  const cloudAvailable = isSupabaseConfigured();

  // For hero tooltip display
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [showHeroInfo, setShowHeroInfo] = useState<boolean>(false);
  const [heroCardPosition, setHeroCardPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>(undefined);

  // Calculate date range based on recencyMonths (must be defined before useEffect that uses it)
  const dateRange = useMemo(() => {
    if (recencyMonths === null) {
      return { startDate: undefined, endDate: undefined };
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - recencyMonths);
    return { startDate, endDate };
  }, [recencyMonths]);

  // Function to load global stats
  const loadGlobalStats = useCallback(async (forceRefresh: boolean = false) => {
    setGlobalStatsLoading(true);
    setGlobalStatsError(null);
    try {
      const result = await GlobalStatsService.getGlobalHeroStats(
        1, // minGamesHero
        minGamesRelationship,
        forceRefresh
      );
      if (result.success && result.data) {
        setGlobalHeroStats(result.data);
        setGlobalCacheAge(GlobalStatsService.getCacheAge());
      } else {
        setGlobalStatsError(result.error || 'Failed to load global statistics');
      }
    } catch (error) {
      console.error('Error loading global stats:', error);
      setGlobalStatsError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setGlobalStatsLoading(false);
    }
  }, [minGamesRelationship]);

  // Load local hero stats on component mount and when filters change
  useEffect(() => {
    // Wait for view mode loading to complete
    if (isViewModeLoading) return;

    if (statsMode === 'local') {
      const loadHeroStats = async () => {
        setLoading(true);
        try {
          // Get hero statistics using the view-mode aware data source
          const stats = await getHeroStats(
            minGamesRelationship,
            dateRange.startDate,
            dateRange.endDate
          );
          setHeroStats(stats);
        } catch (error) {
          console.error('Error loading hero stats:', error);
        } finally {
          setLoading(false);
        }
      };
      loadHeroStats();
    }
  }, [statsMode, minGamesRelationship, dateRange.startDate, dateRange.endDate, isViewModeLoading, getHeroStats]);

  // Load global stats when switching to global mode (initial load)
  useEffect(() => {
    if (statsMode === 'global' && globalHeroStats.length === 0 && !globalStatsLoading) {
      loadGlobalStats();
    }
  }, [statsMode, globalHeroStats.length, globalStatsLoading, loadGlobalStats]);

  // Reload global stats when minGamesRelationship changes while in global mode
  // Use a ref to track the previous value and avoid reload on initial mount
  const prevMinGamesRef = useRef(minGamesRelationship);
  useEffect(() => {
    if (statsMode === 'global' && prevMinGamesRef.current !== minGamesRelationship) {
      // Clear cache since params changed, then reload
      GlobalStatsService.clearCache();
      loadGlobalStats(true);
    }
    prevMinGamesRef.current = minGamesRelationship;
  }, [statsMode, minGamesRelationship, loadGlobalStats]);

  // Update cache age periodically when in global mode
  useEffect(() => {
    if (statsMode === 'global') {
      const interval = setInterval(() => {
        setGlobalCacheAge(GlobalStatsService.getCacheAge());
      }, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [statsMode]);

  // Persist minGamesRelationship to localStorage
  useEffect(() => {
    localStorage.setItem('heroStats_minGames', minGamesRelationship.toString());
  }, [minGamesRelationship]);

  // Persist recencyMonths to localStorage
  useEffect(() => {
    if (recencyMonths === null) {
      localStorage.removeItem('heroStats_recencyMonths');
    } else {
      localStorage.setItem('heroStats_recencyMonths', recencyMonths.toString());
    }
  }, [recencyMonths]);

  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  // Handle sort button click
  const handleSort = (field: string) => {
    playSound('buttonClick');
    
    // If clicking the same field, toggle sort order
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field and default to descending
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Toggle filter menu
  const toggleFilterMenu = () => {
    playSound('buttonClick');
    setShowFilterMenu(!showFilterMenu);
  };

  // Reset filters
  const resetFilters = () => {
    playSound('buttonClick');
    setSearchTerm('');
    setFilterExpansion('all');
    setFilterRole('all');
    setMinGamesRelationship(1);
    setRecencyMonths(null);
    setShowFilterMenu(false);
  };

  // Show hero info tooltip
  const handleHeroMouseEnter = (hero: Hero, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setHeroCardPosition({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
    setSelectedHero(hero);
    setShowHeroInfo(true);
  };

  const handleHeroMouseLeave = () => {
    setShowHeroInfo(false);
  };

  const handleHeroClick = (hero: Hero, event: React.MouseEvent) => {
    // For mobile, toggle the hero info display
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setHeroCardPosition({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
    
    if (selectedHero?.id === hero.id && showHeroInfo) {
      setShowHeroInfo(false);
    } else {
      setSelectedHero(hero);
      setShowHeroInfo(true);
    }
  };

  // Get active hero stats based on current mode
  const activeHeroStats = useMemo(() => {
    return statsMode === 'local' ? heroStats : globalHeroStats;
  }, [statsMode, heroStats, globalHeroStats]);

  // Extract all available roles from heroes
  const allRoles = React.useMemo(() => {
    const roleSet = new Set<string>();
    activeHeroStats.forEach(hero => {
      hero.roles.forEach(role => roleSet.add(role));
    });
    return Array.from(roleSet).sort();
  }, [activeHeroStats]);

  // Extract all available expansions from heroes
  const allExpansions = React.useMemo(() => {
    const expansionSet = new Set<string>();
    activeHeroStats.forEach(hero => {
      expansionSet.add(hero.expansion);
    });
    return Array.from(expansionSet).sort();
  }, [activeHeroStats]);

  // Filter and sort heroes
  const filteredHeroes = activeHeroStats
    .filter(hero => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return hero.heroName.toLowerCase().includes(searchLower) ||
               hero.roles.some(role => role.toLowerCase().includes(searchLower));
      }
      
      // Apply expansion filter
      if (filterExpansion !== 'all' && hero.expansion !== filterExpansion) {
        return false;
      }
      
      // Apply role filter
      if (filterRole !== 'all' && !hero.roles.includes(filterRole)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by selected criteria
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.heroName.localeCompare(b.heroName);
          break;
        case 'games':
          comparison = a.totalGames - b.totalGames;
          break;
        case 'winRate':
          comparison = a.winRate - b.winRate;
          break;
        case 'complexity':
          comparison = a.complexity - b.complexity;
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort order
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Helper to get the full hero object from hero ID
  const getHeroById = (heroId: number): Hero | undefined => {
    return allHeroes.find(h => h.id === heroId);
  };

  // Helper to render hero icon with tooltip
  const renderHeroIcon = (heroData: { heroId: number, heroName: string, icon: string, winRate: number, gamesPlayed: number }) => {
    const hero = getHeroById(heroData.heroId);
    if (!hero) return null;
    
    return (
      <div 
        key={heroData.heroId}
        className="flex flex-col items-center p-1 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer relative"
        onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
        onMouseLeave={handleHeroMouseLeave}
        onClick={(e) => handleHeroClick(hero, e)}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden mb-1">
          <img 
            src={hero.icon} 
            alt={hero.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48?text=Hero';
            }}
          />
        </div>
        <div className="text-xs text-center truncate w-full">{heroData.heroName}</div>
        <div className="text-xs text-gray-400">{heroData.winRate.toFixed(0)}% ({heroData.gamesPlayed})</div>
      </div>
    );
  };

  // Add Screenshot-Specific CSS
  useEffect(() => {
    // Create a style element for screenshot styles
    const style = document.createElement('style');
    style.type = 'text/css';
    
    // CSS for screenshot styling
    style.innerHTML = `
      /* Styles applied during screenshot taking */
      .taking-screenshot {
        background-color: #1F2937 !important;
        padding: 2rem !important;
        width: 1400px !important; /* Increased width for more space */
        position: relative !important;
        overflow: visible !important;
      }
      
      .screenshot-title {
        color: white;
        margin-bottom: 2rem;
      }
      
      .screenshot-footer {
        color: #9CA3AF;
        margin-top: 2rem;
        border-top: 1px solid #4B5563;
        padding-top: 1rem;
      }
      
      /* Hide elements with no-screenshot class */
      .taking-screenshot .no-screenshot {
        display: none !important;
      }
      
      /* Make all hero cards look good in screenshot */
      .taking-screenshot .bg-gray-700 {
        background-color: rgba(55, 65, 81, 0.8) !important;
        padding: 1.5rem !important; /* More padding in cards */
      }
      
      .taking-screenshot .bg-gray-800 {
        background-color: rgba(31, 41, 55, 0.9) !important;
        padding: 1.25rem !important; /* More padding in card headers */
      }
      
      /* Adjust grid layout for screenshots */
      .taking-screenshot .grid {
        grid-template-columns: repeat(2, 1fr) !important; /* Force 2 columns for more space */
        gap: 2rem !important; /* Increase gap between cards */
      }
      
      /* Fix nested grids (like teammate grids) */
      .taking-screenshot .grid .grid {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 0.75rem !important;
      }
      
      /* Ensure text doesn't get cut off */
      .taking-screenshot .text-sm,
      .taking-screenshot .text-xs {
        overflow: visible !important;
        white-space: normal !important;
        line-height: 1.4 !important;
      }
      
      /* Fix for tooltip icons - ensure they're visible */
      .taking-screenshot .flex.items-center {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 0.5rem !important;
      }
      
      .taking-screenshot .flex.items-center svg {
        margin-left: 0.5rem !important;
        visibility: visible !important;
        display: inline-block !important;
      }
      
      /* Make sure section headers have proper spacing */
      .taking-screenshot h4.font-semibold {
        display: inline-block !important;
        margin-right: 0.5rem !important;
      }
      
      /* Make sure progress bars show up correctly */
      .taking-screenshot .bg-red-600 {
        background-color: rgba(220, 38, 38, 0.9) !important;
      }
      
      .taking-screenshot .bg-green-500 {
        background-color: rgba(34, 197, 94, 0.9) !important;
      }
      
      /* Space out section titles */
      .taking-screenshot h4 {
        margin-top: 1rem !important;
        margin-bottom: 0.75rem !important;
      }
    `;
    
    // Add the style to the head
    document.head.appendChild(style);
    
    // Clean up function to remove the style when component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Render the Win Rate Over Time view if selected
  if (showWinRateOverTime) {
    return (
      <HeroWinRateOverTime
        onBack={() => setShowWinRateOverTime(false)}
        initialStatsMode={statsMode}
        inheritedMinGames={minGamesRelationship}
        inheritedDateRange={dateRange.startDate ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined}
      />
    );
  }

  // Render the Relationship Graph view if selected
  if (showRelationshipGraph) {
    return (
      <HeroRelationshipGraph
        onBack={() => setShowRelationshipGraph(false)}
        initialStatsMode={statsMode}
        inheritedMinGames={minGamesRelationship}
      />
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 no-screenshot">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Menu</span>
        </button>
        <h2 className="text-2xl font-bold text-center sm:text-left">Hero Statistics</h2>

        {/* Mobile-optimized button group */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Win Rate Over Time Button */}
          <EnhancedTooltip text="View hero win rate progression over time" position="left">
            <button
              onClick={() => {
                playSound('buttonClick');
                setShowWinRateOverTime(true);
              }}
              className="flex items-center justify-center px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg w-full sm:w-auto"
            >
              <TrendingUp size={18} className="mr-2" />
              <span className="whitespace-nowrap">View Over Time</span>
            </button>
          </EnhancedTooltip>

          {/* Relationship Graph Button */}
          <EnhancedTooltip text="View hero relationships as a network graph" position="left">
            <button
              onClick={() => {
                playSound('buttonClick');
                setShowRelationshipGraph(true);
              }}
              className="flex items-center justify-center px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg w-full sm:w-auto"
            >
              <Network size={18} className="mr-2" />
              <span className="whitespace-nowrap">Relationships</span>
            </button>
          </EnhancedTooltip>

        </div>
      </div>

      {/* Stats Mode Toggle - Play Group vs Global */}
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
          <p className="text-center text-xs text-gray-500 mt-2">
            {statsMode === 'local'
              ? (isViewMode ? 'Showing statistics from the shared match history' : 'Showing statistics from your match history')
              : 'Showing aggregated statistics from all players'}
          </p>
        </div>
      )}

      {/* Global Stats Banner */}
      {statsMode === 'global' && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg no-screenshot">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Globe size={18} className="mr-2 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-200">
                Viewing global statistics from all players who have uploaded data via Cloud Sync
                {globalCacheAge !== null && (
                  <span className="ml-2 text-green-400/70">
                    (cached {globalCacheAge < 60 ? `${globalCacheAge}s` : `${Math.floor(globalCacheAge / 60)}m`} ago)
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={() => {
                playSound('buttonClick');
                GlobalStatsService.clearCache();
                loadGlobalStats(true);
              }}
              disabled={globalStatsLoading}
              className="flex items-center px-2 py-1 text-sm bg-green-700 hover:bg-green-600 rounded transition-colors disabled:opacity-50"
              title="Refresh global data"
            >
              {globalStatsLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span className="ml-1">Refresh</span>
            </button>
          </div>
          <p className="text-xs text-green-200/60 mt-2">
            Global stats update hourly. Time period filter is not available. Data is not saved locally.
          </p>
        </div>
      )}

      {/* Global Stats Error */}
      {statsMode === 'global' && globalStatsError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg no-screenshot">
          <div className="flex items-center">
            <AlertCircle size={18} className="mr-2 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-200">{globalStatsError}</span>
          </div>
          <button
            onClick={() => {
              playSound('buttonClick');
              loadGlobalStats(true);
            }}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Global Stats Loading */}
      {statsMode === 'global' && globalStatsLoading && globalHeroStats.length === 0 && (
        <div className="flex justify-center items-center h-32 no-screenshot">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="animate-spin text-green-400 mb-2" />
            <span className="text-gray-400">Loading global statistics...</span>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6 no-screenshot">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Search Input */}
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search heroes or roles..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          {/* Sort Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSort('games')}
              className={`px-3 py-1 rounded ${
                sortBy === 'games' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Games {sortBy === 'games' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('winRate')}
              className={`px-3 py-1 rounded ${
                sortBy === 'winRate' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Win Rate {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('complexity')}
              className={`px-3 py-1 rounded ${
                sortBy === 'complexity' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Complexity {sortBy === 'complexity' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-1 rounded ${
                sortBy === 'name' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          
          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={toggleFilterMenu}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center"
            >
              <Filter size={18} className="mr-2" />
              <span>Filters</span>
              {(filterExpansion !== 'all' || filterRole !== 'all' || minGamesRelationship !== 1 || recencyMonths !== null) && (
                <span className="ml-2 bg-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(filterExpansion !== 'all' ? 1 : 0) + (filterRole !== 'all' ? 1 : 0) + (minGamesRelationship !== 1 ? 1 : 0) + (recencyMonths !== null ? 1 : 0)}
                </span>
              )}
              {showFilterMenu ? (
                <ChevronUp size={16} className="ml-2" />
              ) : (
                <ChevronDown size={16} className="ml-2" />
              )}
            </button>
            
            {/* Filter Menu */}
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4 w-72">
                <h4 className="font-medium mb-3">Filter Options</h4>

                {/* Time Period Filter */}
                <div className={`mb-4 ${statsMode === 'global' ? 'opacity-50' : ''}`}>
                  <label className="block text-sm text-gray-400 mb-2">
                    Time Period
                    {statsMode === 'global' && (
                      <span className="ml-2 text-xs text-yellow-500">(not available for global stats)</span>
                    )}
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-center ${statsMode === 'global' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="timePeriod"
                        checked={recencyMonths === null}
                        onChange={() => setRecencyMonths(null)}
                        disabled={statsMode === 'global'}
                        className="mr-2 accent-blue-500"
                      />
                      <span className="text-sm">All Time</span>
                    </label>
                    <label className={`flex items-center ${statsMode === 'global' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="radio"
                        name="timePeriod"
                        checked={recencyMonths !== null}
                        onChange={() => setRecencyMonths(recencyMonths || 6)}
                        disabled={statsMode === 'global'}
                        className="mr-2 accent-blue-500"
                      />
                      <span className="text-sm mr-2">Last</span>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={recencyMonths || 6}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 1 && value <= 24) {
                            setRecencyMonths(value);
                          }
                        }}
                        disabled={recencyMonths === null || statsMode === 'global'}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm ml-2">months</span>
                    </label>
                  </div>
                </div>

                {/* Expansion Filter */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Expansion</label>
                  <select
                    value={filterExpansion}
                    onChange={(e) => setFilterExpansion(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="all">All Expansions</option>
                    {allExpansions.map(expansion => (
                      <option key={expansion} value={expansion}>{expansion}</option>
                    ))}
                  </select>
                </div>
                
                {/* Role Filter */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="all">All Roles</option>
                    {allRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* Min Games for Relationships */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Min games for relationships</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMinGamesRelationship(prev => Math.max(1, prev - 1))}
                      disabled={minGamesRelationship <= 1}
                      className="w-10 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xl font-bold"
                    >
                      −
                    </button>
                    <div className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-center font-medium">
                      {minGamesRelationship}
                    </div>
                    <button
                      onClick={() => setMinGamesRelationship(prev => Math.min(20, prev + 1))}
                      disabled={minGamesRelationship >= 20}
                      className="w-10 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-xl font-bold"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Only show teammate/opponent stats with at least this many shared games
                  </p>
                </div>

                {/* Reset Filters Button */}
                <button
                  onClick={resetFilters}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Filter Summary for Screenshot */}
      {(filterExpansion !== 'all' || filterRole !== 'all' || searchTerm !== '') && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg screenshot-info">
          <h3 className="font-semibold mb-2">Filtered View:</h3>
          <ul className="text-sm space-y-1">
            {filterExpansion !== 'all' && <li>Expansion: {filterExpansion}</li>}
            {filterRole !== 'all' && <li>Role: {filterRole}</li>}
            {searchTerm !== '' && <li>Search Term: "{searchTerm}"</li>}
          </ul>
        </div>
      )}

      {/* Date Range Banner - shown when recency filter is active (local mode only) */}
      {statsMode === 'local' && recencyMonths !== null && dateRange.startDate && dateRange.endDate && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center">
          <Calendar size={18} className="mr-2 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-200">
            Showing stats from{' '}
            <span className="font-medium">{dateRange.startDate.toLocaleDateString()}</span>
            {' '}to{' '}
            <span className="font-medium">{dateRange.endDate.toLocaleDateString()}</span>
            {' '}({recencyMonths} month{recencyMonths !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Loading State */}
      {(statsMode === 'local' ? loading : (globalStatsLoading && globalHeroStats.length === 0)) ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Hero Cards Grid */}
          {filteredHeroes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredHeroes.map((hero) => {
                // Find the complete hero data to get the correct icon path
                const fullHero = getHeroById(hero.heroId);
                const iconPath = fullHero?.icon || hero.icon || `heroes/${hero.heroName.toLowerCase().replace(/\s+/g, '')}.png`;
                
                return (
                  <div key={hero.heroId} className="bg-gray-700 rounded-lg overflow-hidden shadow-md">
                    {/* Hero Header */}
                    <div 
                      className="px-5 py-4 bg-gray-800 flex items-center cursor-pointer"
                      onMouseEnter={(e) => handleHeroMouseEnter(getHeroById(hero.heroId)!, e)}
                      onMouseLeave={handleHeroMouseLeave}
                      onClick={(e) => handleHeroClick(getHeroById(hero.heroId)!, e)}
                    >
                      <div className="w-16 h-16 bg-gray-900 rounded-full overflow-hidden mr-4 flex-shrink-0">
                        <img 
                          src={iconPath} 
                          alt={hero.heroName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Hero';
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{hero.heroName}</h3>
                        <div className="text-sm text-gray-300">{hero.roles.join(' • ')}</div>
                        <div className="text-xs text-blue-400 mt-1">
                          {hero.expansion} • Complexity: {hero.complexity}
                        </div>
                      </div>
                    </div>
                    
                    {/* Hero Stats */}
                    <div className="p-4">
                      {/* Win/Loss Stats */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm text-gray-400 flex items-center">
                            <span>Win Rate</span>
                            <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                          </div>
                          <div className="font-medium">{hero.winRate.toFixed(1)}%</div>
                        </div>
                        <div className="h-2 bg-red-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${hero.winRate}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                          <span>Wins: {hero.wins}</span>
                          <span>Losses: {hero.losses}</span>
                          <span>Total: {hero.totalGames}</span>
                        </div>
                      </div>
                      
                      {/* Best Teammates Section */}
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <h4 className="font-semibold text-sm">Best Teammates</h4>
                          <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                        </div>
                        
                        {hero.bestTeammates.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {hero.bestTeammates.map(teammate => 
                              renderHeroIcon(teammate)
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No data available</div>
                        )}
                      </div>
                      
                      {/* Best Against Section */}
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <h4 className="font-semibold text-sm">Best Against</h4>
                          <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                        </div>
                        
                        {hero.bestAgainst.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {hero.bestAgainst.map(opponent => 
                              renderHeroIcon(opponent)
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No data available</div>
                        )}
                      </div>
                      
                      {/* Worst Against Section */}
                      <div>
                        <div className="flex items-center mb-2">
                          <h4 className="font-semibold text-sm">Countered By</h4>
                          <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                        </div>
                        
                        {hero.worstAgainst.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {hero.worstAgainst.map(opponent => 
                              renderHeroIcon(opponent)
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No data available</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Shield size={48} className="text-gray-500 mb-4" />
              <p className="text-xl text-gray-400">
                {searchTerm || filterExpansion !== 'all' || filterRole !== 'all'
                  ? 'No heroes found matching your filters'
                  : 'No hero data available'}
              </p>
              {(searchTerm || filterExpansion !== 'all' || filterRole !== 'all') && (
                <button
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg no-screenshot"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Hero Information Tooltip */}
      {selectedHero && (
        <HeroInfoDisplay
          hero={selectedHero}
          isVisible={showHeroInfo}
          onClose={() => setShowHeroInfo(false)}
          cardPosition={heroCardPosition}
        />
      )}
      
      {/* Information Section */}
      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
        <h4 className="font-medium mb-2 flex items-center">
          <Info size={16} className="mr-2 text-blue-400" />
          About Hero Statistics
        </h4>
        {statsMode === 'local' ? (
          <p className="mb-2">
            These statistics show hero performance based on your match history. Win rates and synergies are calculated from
            your recorded matches, so they reflect your play group's style and may differ from global statistics.
          </p>
        ) : (
          <p className="mb-2">
            These are aggregated statistics from all players who have uploaded their matches to the cloud.
            Win rates and synergies reflect the global community's experience. This data is downloaded fresh each session
            and is not stored locally.
          </p>
        )}
      </div>
    </div>
  );
};

export default HeroStats;