// src/components/matches/HeroSelector.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Hero } from '../../types';
import { heroes } from '../../data/heroes';

interface HeroSelectorProps {
  selectedHeroId?: number;
  onHeroChange: (heroId: number, hero: Hero) => void;
  disabled?: boolean;
  className?: string;
}

const HeroSelector: React.FC<HeroSelectorProps> = ({
  selectedHeroId,
  onHeroChange,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedHero = heroes.find(hero => hero.id === selectedHeroId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter and group heroes
  const filteredHeroes = heroes.filter(hero =>
    hero.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hero.roles.some(role => role.toLowerCase().includes(searchTerm.toLowerCase())) ||
    hero.additionalRoles?.some(role => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group heroes by primary role
  const roleGroups = new Map<string, Hero[]>();
  
  filteredHeroes.forEach(hero => {
    const primaryRole = hero.roles[0] || 'Unknown';
    if (!roleGroups.has(primaryRole)) {
      roleGroups.set(primaryRole, []);
    }
    roleGroups.get(primaryRole)!.push(hero);
  });

  // Sort role groups
  const sortedRoles = Array.from(roleGroups.entries()).sort(([a], [b]) => {
    const roleOrder = ['Durable', 'Tactician', 'Pusher', 'Disabler', 'Farming'];
    const aIndex = roleOrder.indexOf(a);
    const bIndex = roleOrder.indexOf(b);
    
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const handleHeroSelect = (hero: Hero) => {
    onHeroChange(hero.id, hero);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setSearchTerm('');
    }
  };

  const renderComplexityStars = (complexity: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${i < complexity ? 'text-yellow-400' : 'text-gray-600'}`}
      >
        ⭐
      </span>
    ));
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'
        }`}
      >
        <div className="flex items-center">
          {selectedHero ? (
            <>
              <div className="w-8 h-8 bg-gray-800 rounded mr-3 flex items-center justify-center text-xs">
                🛡️
              </div>
              <div>
                <div className="font-medium">{selectedHero.name}</div>
                <div className="text-xs text-gray-400">
                  {selectedHero.roles.join(', ')}
                </div>
              </div>
            </>
          ) : (
            <span className="text-gray-400">Select a hero...</span>
          )}
        </div>
        <ChevronDown
          size={20}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search heroes..."
                className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Hero List */}
          <div className="max-h-80 overflow-y-auto">
            {sortedRoles.length > 0 ? (
              sortedRoles.map(([role, roleHeroes]) => (
                <div key={role}>
                  {/* Role Header */}
                  <div className="px-3 py-2 bg-gray-700/50 border-b border-gray-700 text-sm font-medium text-gray-300">
                    {role.toUpperCase()}
                  </div>
                  
                  {/* Heroes in Role */}
                  {roleHeroes
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(hero => (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => handleHeroSelect(hero)}
                        className={`w-full px-3 py-3 text-left hover:bg-gray-700 flex items-center justify-between border-b border-gray-800 last:border-b-0 ${
                          selectedHeroId === hero.id ? 'bg-blue-900/30 ring-1 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-gray-800 rounded mr-3 flex items-center justify-center">
                            🛡️
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{hero.name}</div>
                            <div className="text-xs text-gray-400">
                              {hero.roles.concat(hero.additionalRoles || []).join(', ')}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {hero.expansion}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center ml-2">
                          {renderComplexityStars(hero.complexity)}
                        </div>
                      </button>
                    ))}
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-gray-400">
                No heroes found matching "{searchTerm}"
              </div>
            )}
          </div>

          {/* Current Selection Info */}
          {selectedHero && (
            <div className="p-3 bg-gray-700/30 border-t border-gray-700">
              <div className="text-sm">
                <span className="text-gray-400">Current Selection: </span>
                <span className="font-medium">{selectedHero.name}</span>
                <span className="text-gray-400"> - {selectedHero.roles.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HeroSelector;