// src/components/matches/HeroStats.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Info, Filter, ChevronDown, ChevronUp, Shield, Printer } from 'lucide-react';
import { Hero } from '../../types';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';
import HeroInfoDisplay from '../common/HeroInfoDisplay';
import { heroes as allHeroes } from '../../data/heroes';

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
  const [heroStats, setHeroStats] = useState<HeroStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('games');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterExpansion, setFilterExpansion] = useState<string | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  
  // For hero tooltip display
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [showHeroInfo, setShowHeroInfo] = useState<boolean>(false);
  const [heroCardPosition, setHeroCardPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>(undefined);

  // Load hero stats on component mount
  useEffect(() => {
    const loadHeroStats = async () => {
      setLoading(true);
      try {
        // Get hero statistics from database
        const stats = await dbService.getHeroStats();
        setHeroStats(stats);
      } catch (error) {
        console.error('Error loading hero stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadHeroStats();
  }, []);

  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  // Handle print function
  const handlePrint = () => {
    playSound('buttonClick');
    window.print();
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

  // Extract all available roles from heroes
  const allRoles = React.useMemo(() => {
    const roleSet = new Set<string>();
    heroStats.forEach(hero => {
      hero.roles.forEach(role => roleSet.add(role));
    });
    return Array.from(roleSet).sort();
  }, [heroStats]);

  // Extract all available expansions from heroes
  const allExpansions = React.useMemo(() => {
    const expansionSet = new Set<string>();
    heroStats.forEach(hero => {
      expansionSet.add(hero.expansion);
    });
    return Array.from(expansionSet).sort();
  }, [heroStats]);

  // Filter and sort heroes
  const filteredHeroes = heroStats
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

  // Add Print-Specific CSS
  useEffect(() => {
    // Create a style element for print styles
    const style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'print';
    // CSS to maintain dark theme for printing
    style.innerHTML = `
      @media print {
        @page {
          size: auto;
          margin: 0mm;
          scale: 0.5;
        }
        
        /* Fix for background colors and gradient */
        html, body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          background-color: #1f2937 !important;
        }
        
        /* Force the app container to extend */
        #root {
          position: relative;
          min-height: 100vh;
        }
        
        /* Create a pseudo-element with the gradient background that extends full height */
        #root::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: -1;
          min-height: 100vh;
          background: #1f2937 !important; /* Match your app's gradient or background */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* Make component backgrounds preserve their color */
        .bg-gray-700, .bg-gray-800, .bg-gray-900, 
        .bg-blue-900, .bg-red-900, .bg-gray-700\\/50, 
        .bg-blue-900\\/30, .bg-green-900\\/30 {
          background-color: inherit !important;
          box-shadow: inset 0 0 0 1000px rgba(55, 65, 81, 0.8) !important; /* gray-700 with opacity */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        /* Target specific background colors to ensure they print correctly */
        .bg-gray-800 {
          box-shadow: inset 0 0 0 1000px rgba(31, 41, 55, 0.9) !important; /* gray-800 with opacity */
        }
        
        .bg-gray-900 {
          box-shadow: inset 0 0 0 1000px rgba(17, 24, 39, 0.9) !important; /* gray-900 with opacity */
        }
        
        /* Background for progress bars */
        .bg-red-600 {
          box-shadow: inset 0 0 0 1000px rgba(220, 38, 38, 0.9) !important;
        }
        
        .bg-green-500 {
          box-shadow: inset 0 0 0 1000px rgba(34, 197, 94, 0.9) !important;
        }
        
        .print-only { display: block !important; }
        .no-print { display: none !important; }
        
        /* Hide feedback component */
        .fixed.bottom-0.left-0.z-50,
        .fixed.bottom-2.left-2 {
          display: none !important;
        }
        
        /* Prevent page breaks inside cards */
        .bg-gray-700.rounded-lg.overflow-hidden.shadow-md {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `;
    
    // Add the style to the head
    document.head.appendChild(style);
    
    // Clean up function to remove the style when component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white no-print"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Menu</span>
        </button>
        <h2 className="text-2xl font-bold">Hero Statistics</h2>
        
        {/* Print Button */}
        <EnhancedTooltip text="Share hero statistics as PDF" position="left" className="no-print">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            <Printer size={18} className="mr-2" />
            <span>Share Stats</span>
          </button>
        </EnhancedTooltip>
      </div>
      
      {/* Page Title for Print Only */}
      <div className="hidden print-only text-center mb-6">
        <h1 className="text-3xl font-bold">Guards of Atlantis II - Hero Statistics</h1>
        <p className="text-gray-400 mt-2">Printed on {new Date().toLocaleDateString()}</p>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6 no-print">
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
              {(filterExpansion !== 'all' || filterRole !== 'all') && (
                <span className="ml-2 bg-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(filterExpansion !== 'all' ? 1 : 0) + (filterRole !== 'all' ? 1 : 0)}
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
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Filter Summary for Print */}
          {(filterExpansion !== 'all' || filterRole !== 'all' || searchTerm !== '') && (
            <div className="hidden print-only mb-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Filtered View:</h3>
              <ul className="text-sm space-y-1">
                {filterExpansion !== 'all' && <li>Expansion: {filterExpansion}</li>}
                {filterRole !== 'all' && <li>Role: {filterRole}</li>}
                {searchTerm !== '' && <li>Search Term: "{searchTerm}"</li>}
              </ul>
            </div>
          )}
          
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
                      className="px-5 py-4 bg-gray-800 flex items-center cursor-pointer no-print-hover"
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
                            <EnhancedTooltip text="Percentage of games won with this hero" position="right" className="no-print">
                              <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                            </EnhancedTooltip>
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
                          <EnhancedTooltip text="Heroes that have the highest win rate when played together with this hero" position="right" maxWidth="max-w-md" className="no-print">
                            <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                          </EnhancedTooltip>
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
                          <EnhancedTooltip text="Heroes that this hero has the highest win rate against" position="right" maxWidth="max-w-md" className="no-print">
                            <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                          </EnhancedTooltip>
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
                          <EnhancedTooltip text="Heroes that this hero has the lowest win rate against" position="right" maxWidth="max-w-md" className="no-print">
                            <Info size={14} className="ml-1 text-gray-500 cursor-help" />
                          </EnhancedTooltip>
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
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg no-print"
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
        <p className="mb-2">
          These statistics show hero performance based on your match history. Win rates and synergies are calculated from 
          your recorded matches, so they reflect your group's playstyle and may differ from general statistics.
        </p>
        <p className="no-print">
          Hover over or tap a hero to see their complete information. Click on column headers to sort by different criteria.
        </p>
      </div>
      
      {/* Print Footer */}
      <div className="hidden print-only mt-8 text-center text-sm text-gray-400">
        <p>Generated by Guards of Atlantis II Timer App on {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default HeroStats;