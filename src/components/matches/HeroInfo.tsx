// src/components/matches/HeroInfo.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Filter, ChevronDown, ChevronUp, Shield, Camera } from 'lucide-react';
import { Hero } from '../../types';
import { heroes as allHeroes, getAllExpansions } from '../../data/heroes';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';
import html2canvas from 'html2canvas';
import { useDevice } from '../../hooks/useDevice';
import HeroRoleExplanation from '../HeroRoleExplanation';

interface HeroInfoProps {
  onBack: () => void;
}

const HeroInfo: React.FC<HeroInfoProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const { isMobile } = useDevice();
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterExpansion, setFilterExpansion] = useState<string | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string | 'all'>('all');
  const [filterComplexity, setFilterComplexity] = useState<number | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [takingScreenshot, setTakingScreenshot] = useState<boolean>(false);
  
  // Reference for screenshot functionality
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  // Add screenshot styling
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
      
      /* Adjust card spacing and layout for screenshots */
      .taking-screenshot .grid {
        grid-template-columns: repeat(2, 1fr) !important; /* Force 2 columns for readability */
        gap: 2rem !important; /* Increase gap between cards */
      }
      
      .taking-screenshot .bg-gray-700 {
        padding: 1.5rem !important; /* More padding inside cards */
      }
      
      /* Fix stat bar display */
      .taking-screenshot .transform.skew-x-12 {
        height: 20px !important;
        width: 20px !important; 
      }
      
      /* Make text more readable */
      .taking-screenshot .text-sm {
        font-size: 14px !important;
        line-height: 1.5 !important;
      }
      
      .taking-screenshot .leading-relaxed {
        line-height: 1.7 !important;
      }
      
      /* Fix hero header display */
      .taking-screenshot .px-5.py-4.bg-gray-800 {
        padding: 1.25rem !important;
      }
      
      /* Enhance hero images */
      .taking-screenshot .rounded-full.overflow-hidden {
        border: 2px solid #4B5563 !important;
      }
      
      /* Make role explanations visible in screenshots */
      .taking-screenshot .bg-gray-700.rounded-lg.mb-4.overflow-hidden {
        margin-bottom: 2rem !important;
      }
      
      /* Make sure role explanation grid looks good */
      .taking-screenshot .grid.grid-cols-1.md\\:grid-cols-2.gap-4 {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 1rem !important;
      }
      
      /* Ensure role text is properly visible */
      .taking-screenshot .text-xs.text-gray-400 {
        font-size: 0.85rem !important;
        margin-top: 0.25rem !important;
        color: #9CA3AF !important;
      }
    `;
    
    // Add the style to the head
    document.head.appendChild(style);
    
    // Clean up function to remove the style when component unmounts
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Load hero data on component mount
  useEffect(() => {
    setLoading(true);
    try {
      // Get all heroes data
      setHeroes(allHeroes);
    } catch (error) {
      console.error('Error loading heroes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  // Handle taking a screenshot of the content
  const handleTakeScreenshot = async () => {
    if (!contentRef.current) return;
    
    playSound('buttonClick');
    setTakingScreenshot(true);
    
    try {
      // Temporarily add a screenshot class to the parent element for styling during screenshot
      contentRef.current.classList.add('taking-screenshot');
      
      // Create title section for the screenshot
      const titleElement = document.createElement('div');
      titleElement.className = 'screenshot-title text-center mb-6';
      titleElement.innerHTML = `
        <h1 class="text-3xl font-bold">Guards of Atlantis II - Hero Reference Guide</h1>
        <p class="text-gray-400 mt-2">Generated on ${new Date().toLocaleDateString()}</p>
      `;
      
      // Insert title at the top of the content
      contentRef.current.insertBefore(titleElement, contentRef.current.firstChild);
      
      // Create footer for the screenshot
      const footerElement = document.createElement('div');
      footerElement.className = 'screenshot-footer text-center mt-8 text-sm text-gray-400';
      footerElement.innerHTML = `
        <p>Generated by Guards of Atlantis II Timer App</p>
      `;
      
      // Append footer to the content
      contentRef.current.appendChild(footerElement);
      
      // Hide elements that shouldn't be in the screenshot
      const noScreenshotElements = contentRef.current.querySelectorAll('.no-screenshot');
      noScreenshotElements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      
      // Take the screenshot
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#1F2937', // Match the background color (bg-gray-800)
        windowWidth: 1400, // Updated width to match CSS
        scrollX: 0,
        scrollY: 0,
        scale: window.devicePixelRatio || 1, // Use device pixel ratio for sharper images
        logging: false, // Disable logging to console
        allowTaint: true, // Allow cross-origin images
        useCORS: true, // Try to load images with CORS
        onclone: (clonedDoc) => {
          // Additional modifications to the cloned document before screenshot
          const clonedContent = clonedDoc.querySelector('#screenshotContent');
          if (clonedContent) {
            clonedContent.scrollTop = 0; // Ensure we're at the top of the content
          }
        }
      });
      
      // Convert canvas to data URL and trigger download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `guards-of-atlantis-hero-guide-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      
      // Clean up: remove title, footer, and classes added for screenshot
      contentRef.current.removeChild(titleElement);
      contentRef.current.removeChild(footerElement);
      contentRef.current.classList.remove('taking-screenshot');
      
      // Restore elements that were hidden
      noScreenshotElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
    } catch (error) {
      console.error('Error creating screenshot:', error);
    } finally {
      setTakingScreenshot(false);
    }
  };

  // Handle sort button click
  const handleSort = (field: string) => {
    playSound('buttonClick');
    
    // If clicking the same field, toggle sort order
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field and default to appropriate order
      setSortBy(field);
      // For most fields, descending makes more sense as default (except name)
      setSortOrder(field === 'name' ? 'asc' : 'desc');
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
    setFilterComplexity('all');
    setShowFilterMenu(false);
  };

  // Extract all available roles from heroes
  const allRoles = React.useMemo(() => {
    const roleSet = new Set<string>();
    heroes.forEach(hero => {
      hero.roles.forEach(role => roleSet.add(role));
      // Also include additional roles if available
      if (hero.additionalRoles) {
        hero.additionalRoles.forEach(role => roleSet.add(role));
      }
    });
    return Array.from(roleSet).sort();
  }, [heroes]);

  // Extract all available expansions from heroes
  const allExpansions = React.useMemo(() => {
    return getAllExpansions();
  }, []);

  // Filter and sort heroes
  const filteredHeroes = heroes
    .filter(hero => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        
        // Search in name
        if (hero.name.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in roles
        if (hero.roles.some(role => role.toLowerCase().includes(searchLower))) {
          return true;
        }
        
        // Search in additional roles if available
        if (hero.additionalRoles && 
            hero.additionalRoles.some(role => role.toLowerCase().includes(searchLower))) {
          return true;
        }
        
        // Search in description if available
        if (hero.description && hero.description.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        return false;
      }
      
      // Apply expansion filter
      if (filterExpansion !== 'all' && hero.expansion !== filterExpansion) {
        return false;
      }
      
      // Apply role filter
      if (filterRole !== 'all') {
        const hasRole = hero.roles.includes(filterRole);
        const hasAdditionalRole = hero.additionalRoles ? 
                                 hero.additionalRoles.includes(filterRole) : 
                                 false;
        if (!hasRole && !hasAdditionalRole) {
          return false;
        }
      }
      
      // Apply complexity filter
      if (filterComplexity !== 'all' && hero.complexity !== filterComplexity) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by selected criteria
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'complexity':
          comparison = a.complexity - b.complexity;
          break;
        case 'attack':
          comparison = (a.attack || 0) - (b.attack || 0);
          break;
        case 'defence':
          comparison = (a.defence || 0) - (b.defence || 0);
          break;
        case 'initiative':
          comparison = (a.initiative || 0) - (b.initiative || 0);
          break;
        case 'movement':
          comparison = (a.movement || 0) - (b.movement || 0);
          break;
        case 'expansion':
          comparison = (a.expansion || '').localeCompare(b.expansion || '');
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort order
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Function to render a stat bar with slanted boxes (reused from HeroInfoDisplay)
  const renderStatBar = (label: string, value: number = 0, maxValue: number = 0) => {
    return (
      <div className="mb-2">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="flex">
          {/* Render 8 slanted boxes for the stat bar */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i} 
              className={`h-5 w-5 transform skew-x-12 mr-0.5 flex-shrink-0 ${
                i < value 
                  ? 'bg-blue-600' // Blue for base stats
                  : i < maxValue 
                    ? 'bg-blue-200' // Light blue for upgrade potential
                    : 'bg-gray-700' // Gray for empty slots
              }`}
            ></div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={contentRef} id="screenshotContent" className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6 no-screenshot">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Menu</span>
        </button>
        <h2 className="text-2xl font-bold">Hero Information</h2>
        
        {/* Screenshot Button */}
        <EnhancedTooltip text="Take a screenshot of all hero information" position="left">
          <button
            onClick={handleTakeScreenshot}
            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            disabled={takingScreenshot}
          >
            <Camera size={18} className="mr-2" />
            <span>{takingScreenshot ? 'Capturing...' : 'Share Guide'}</span>
          </button>
        </EnhancedTooltip>
      </div>
      
      {/* Search and Filter Bar */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6 no-screenshot">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Search Input */}
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search heroes, roles, or descriptions..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          {/* Sort Buttons */}
          <div className="flex flex-wrap gap-2">
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
              onClick={() => handleSort('attack')}
              className={`px-3 py-1 rounded ${
                sortBy === 'attack' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Attack {sortBy === 'attack' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            
            <button
              onClick={() => handleSort('initiative')}
              className={`px-3 py-1 rounded ${
                sortBy === 'initiative' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Initiative {sortBy === 'initiative' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => handleSort('defence')}
              className={`px-3 py-1 rounded ${
                sortBy === 'defence' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Defence {sortBy === 'defence' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>

            <button
              onClick={() => handleSort('movement')}
              className={`px-3 py-1 rounded ${
                sortBy === 'movement' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Movement {sortBy === 'movement' && (sortOrder === 'asc' ? '↑' : '↓')}
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
              {(filterExpansion !== 'all' || filterRole !== 'all' || filterComplexity !== 'all') && (
                <span className="ml-2 bg-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(filterExpansion !== 'all' ? 1 : 0) + 
                   (filterRole !== 'all' ? 1 : 0) + 
                   (filterComplexity !== 'all' ? 1 : 0)}
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
                
                {/* Complexity Filter */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Complexity</label>
                  <select
                    value={filterComplexity}
                    onChange={(e) => setFilterComplexity(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="all">All Complexity</option>
                    <option value="1">★ (Beginner)</option>
                    <option value="2">★★ (Intermediate)</option>
                    <option value="3">★★★ (Advanced)</option>
                    <option value="4">★★★★ (Expert)</option>
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
      
      {/* Filter Summary for Screenshot */}
      {(filterExpansion !== 'all' || filterRole !== 'all' || filterComplexity !== 'all' || searchTerm !== '') && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg screenshot-info">
          <h3 className="font-semibold mb-2">Filtered View:</h3>
          <ul className="text-sm space-y-1">
            {filterExpansion !== 'all' && <li>Expansion: {filterExpansion}</li>}
            {filterRole !== 'all' && <li>Role: {filterRole}</li>}
            {filterComplexity !== 'all' && <li>Complexity: {filterComplexity === 1 ? '★' : 
                                                          filterComplexity === 2 ? '★★' : 
                                                          filterComplexity === 3 ? '★★★' : '★★★★'}</li>}
            {searchTerm !== '' && <li>Search Term: "{searchTerm}"</li>}
          </ul>
        </div>
      )}
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {/* Role Explanation Component */}
          <div className="mb-6">
            <HeroRoleExplanation />
          </div>
          
          {/* Hero Cards Grid */}
          {filteredHeroes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredHeroes.map((hero) => {
                // Add data transforms for safety
                const heroName = hero.name || 'Unknown Hero';
                const heroRoles = hero.roles || [];
                const heroAdditionalRoles = hero.additionalRoles || [];
                const heroExpansion = hero.expansion || 'Unknown';
                const heroComplexity = hero.complexity || 1;
                const heroDescription = hero.description || "This hero's abilities and playstyle are shrouded in mystery.";
                
                return (
                  <div key={hero.id} className="bg-gray-700 rounded-lg overflow-hidden shadow-md">
                    {/* Hero Header */}
                    <div className="px-5 py-4 bg-gray-800 flex items-center">
                      <div className="w-16 h-16 bg-gray-900 rounded-full overflow-hidden mr-4 flex-shrink-0">
                        <img 
                          src={hero.icon} 
                          alt={heroName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Hero';
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold">{heroName}</h3>
                        <div className="text-sm text-gray-300">{heroRoles.join(' • ')}</div>
                        
                        {/* Additional roles as smaller grey text below primary roles */}
                        {heroAdditionalRoles.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">{heroAdditionalRoles.join(' • ')}</div>
                        )}
                        
                        {/* Expansion and complexity on a separate line below */}
                        <div className="text-xs mt-2 flex items-center">
                          <span className="text-blue-400">Expansion: {heroExpansion}</span>
                          <span className="mx-2">•</span>
                          <span className="text-blue-400">Complexity: </span>
                          <span className="text-yellow-400 ml-1">{
                            [...Array(heroComplexity)].map((_, i) => "★").join("")
                          }</span>
                          <span className="text-gray-600">{
                            [...Array(4 - heroComplexity)].map((_, i) => "★").join("")
                          }</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hero Stats */}
                    <div className="p-4">
                      {/* Stat Bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {renderStatBar('Attack', hero.attack || 0, hero.attack_upgraded || hero.attack || 0)}
                        {renderStatBar('Initiative', hero.initiative || 0, hero.initiative_upgraded || hero.initiative || 0)}
                        {renderStatBar('Defence', hero.defence || 0, hero.defence_upgraded || hero.defence || 0)}
                        {renderStatBar('Movement', hero.movement || 0, hero.movement_upgraded || hero.movement || 0)}
                      </div>
                      
                      {/* Hero Description */}
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Description</div>
                        <p className="text-sm leading-relaxed">
                          {heroDescription}
                        </p>
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
                {searchTerm || filterExpansion !== 'all' || filterRole !== 'all' || filterComplexity !== 'all'
                  ? 'No heroes found matching your filters'
                  : 'No hero data available'}
              </p>
              {(searchTerm || filterExpansion !== 'all' || filterRole !== 'all' || filterComplexity !== 'all') && (
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
      
      {/* Information Section */}
      {/* Hero Information */}
      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
        <h4 className="font-bold mb-2">How to Read the Stats</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="mb-2"><strong>Attack:</strong> Higher values mean the hero deals more damage and has stronger offensive abilities.</p>
            <p className="mb-2"><strong>Initiative:</strong> Determines when a hero acts in combat. Higher values let heroes move earlier.</p>
          </div>
          <div>
            <p className="mb-2"><strong>Defence:</strong> Higher values give the hero better survivability and ability to withstand attacks.</p>
            <p className="mb-2"><strong>Movement:</strong> Determines how far a hero can travel each turn. Higher values give more mobility.</p>
          </div>
        </div>
        <p className="mt-2"><strong>Upgrade Potential:</strong> Light blue segments show stats that can be improved through upgrades.</p>
      </div>
    </div>
  );
};

export default HeroInfo;