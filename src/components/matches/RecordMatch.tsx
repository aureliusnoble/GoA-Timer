// src/components/matches/RecordMatch.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Shield, Users, Check, HelpCircle, Plus, Save, ArrowDown, ArrowUp, Minus, Sword, Heart, HandHelping, Coins, Target, Star, Database, Trophy } from 'lucide-react';
import { Team, GameLength, Hero, VictoryType } from '../../types';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import { getAllExpansions, filterHeroesByExpansions } from '../../data/heroes';
import PlayerNameInput from '../PlayerNameInput';
import VictoryTypeSelector from '../common/VictoryTypeSelector';

interface RecordMatchProps {
  onBack: () => void;
}

// Define player statistics structure - all fields optional for selective tracking
interface PlayerStats {
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
  minionKills?: number;
  level?: number;
}

// Define which stat categories can be tracked
interface StatCategories {
  kills: boolean;
  deaths: boolean;
  assists: boolean;
  goldEarned: boolean;
  minionKills: boolean;
  level: boolean;
}

// Define the player entry structure for the form
interface PlayerEntry {
  id: string; // Player name as ID
  name: string; // Added to match PlayerNameInput component interface
  team: Team;
  heroId: number | null;
  heroName: string;
  heroRoles: string[];
  stats?: PlayerStats; // Optional detailed statistics
}

const RecordMatch: React.FC<RecordMatchProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Form state
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [matchTime, setMatchTime] = useState<string>(
    new Date().toTimeString().split(' ')[0].substring(0, 5)
  );
  const [gameLength, setGameLength] = useState<GameLength>(GameLength.Long);
  const [doubleLanes, setDoubleLanes] = useState<boolean>(false);
  const [winningTeam, setWinningTeam] = useState<Team>(Team.Titans);
  const [victoryType, setVictoryType] = useState<VictoryType | undefined>(undefined);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [showHeroSelector, setShowHeroSelector] = useState<boolean>(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(-1);
  
  // Hero filtering and sorting
  const [selectedExpansions, setSelectedExpansions] = useState<string[]>(getAllExpansions());
  const [heroSearchTerm, setHeroSearchTerm] = useState<string>('');
  const [maxComplexity, setMaxComplexity] = useState<number>(4);
  const [heroSortBy, setHeroSortBy] = useState<'name' | 'complexity'>('name');
  const [heroSortOrder, setHeroSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Validation state
  const [formErrors, setFormErrors] = useState<{
    date?: string;
    players?: string;
    teams?: string;
    heroes?: string;
    maxPlayers?: string;
    heroDuplicates?: string;
    teamBalance?: string;
    stats?: string;
    victoryType?: string;
  }>({});
  
  // Track duplicate player names and hero IDs
  const [duplicatePlayerNames, setDuplicatePlayerNames] = useState<string[]>([]);
  const [duplicateHeroIds, setDuplicateHeroIds] = useState<number[]>([]);
  
  // Detailed stats mode
  const [detailedMode, setDetailedMode] = useState<boolean>(false);
  const [playerStats, setPlayerStats] = useState<Map<number, PlayerStats>>(new Map());
  const [statsErrors, setStatsErrors] = useState<Map<number, string[]>>(new Map());
  
  // Stat category toggles - default all to false (N/A)
  const [enabledStats, setEnabledStats] = useState<StatCategories>({
    kills: false,
    deaths: false,
    assists: false,
    goldEarned: false,
    minionKills: false,
    level: false
  });
  
  // Load player names from database on component mount
  const [existingPlayerNames, setExistingPlayerNames] = useState<string[]>([]);
  
  useEffect(() => {
    const loadPlayerNames = async () => {
      try {
        const allPlayers = await dbService.getAllPlayers();
        const playerNames = allPlayers.map(player => player.name);
        setExistingPlayerNames(playerNames);
      } catch (error) {
        console.error('Error loading player names:', error);
      }
    };
    
    loadPlayerNames();
    
    // Run validation check when players change
    if (players.length > 0) {
      checkForDuplicates();
    }
  }, []);
  
  // Handle back navigation with sound
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  // Initialize default stats for a player based on enabled categories
  const initializePlayerStats = (): PlayerStats => {
    const stats: PlayerStats = {};
    
    // Only set values for enabled stat categories
    if (enabledStats.kills) stats.kills = 0;
    if (enabledStats.deaths) stats.deaths = 0;
    if (enabledStats.assists) stats.assists = 0;
    if (enabledStats.goldEarned) stats.goldEarned = 0;
    if (enabledStats.minionKills) stats.minionKills = 0;
    if (enabledStats.level) stats.level = 1;
    
    return stats;
  };
  
  // Toggle a stat category on/off
  const handleStatCategoryToggle = (category: keyof StatCategories) => {
    playSound('buttonClick');
    const newEnabledStats = { ...enabledStats, [category]: !enabledStats[category] };
    setEnabledStats(newEnabledStats);
    
    // Update all player stats when toggling categories
    if (detailedMode) {
      const updatedPlayerStats = new Map<number, PlayerStats>();
      
      players.forEach((_, index) => {
        const currentStats = playerStats.get(index) || {};
        const newStats: PlayerStats = {};
        
        // Preserve existing values for enabled stats, clear disabled ones
        if (newEnabledStats.kills) {
          newStats.kills = currentStats.kills ?? 0;
        }
        if (newEnabledStats.deaths) {
          newStats.deaths = currentStats.deaths ?? 0;
        }
        if (newEnabledStats.assists) {
          newStats.assists = currentStats.assists ?? 0;
        }
        if (newEnabledStats.goldEarned) {
          newStats.goldEarned = currentStats.goldEarned ?? 0;
        }
        if (newEnabledStats.minionKills) {
          newStats.minionKills = currentStats.minionKills ?? 0;
        }
        if (newEnabledStats.level) {
          newStats.level = currentStats.level ?? 1;
        }
        
        updatedPlayerStats.set(index, newStats);
      });
      
      setPlayerStats(updatedPlayerStats);
      
      // Clear any validation errors when toggling
      setStatsErrors(new Map());
    }
  };
  
  // Handle mode toggle between basic and detailed recording
  const handleModeToggle = () => {
    playSound('buttonClick');
    setDetailedMode(!detailedMode);
    
    // Initialize stats for all players when entering detailed mode
    if (!detailedMode) {
      const newPlayerStats = new Map<number, PlayerStats>();
      players.forEach((_, index) => {
        newPlayerStats.set(index, initializePlayerStats());
      });
      setPlayerStats(newPlayerStats);
    }
  };
  
  // Validate player statistics - only check enabled stats
  const validatePlayerStats = (_playerIndex: number, stats: PlayerStats): string[] => {
    const errors: string[] = [];
    
    // Only validate enabled stats
    if (enabledStats.kills && stats.kills !== undefined) {
      if (stats.kills < 0 || stats.kills > 50) {
        errors.push('Kills must be between 0 and 50');
      }
    }
    
    if (enabledStats.deaths && stats.deaths !== undefined) {
      if (stats.deaths < 0 || stats.deaths > 20) {
        errors.push('Deaths must be between 0 and 20');
      }
    }
    
    if (enabledStats.assists && stats.assists !== undefined) {
      if (stats.assists < 0 || stats.assists > 100) {
        errors.push('Assists must be between 0 and 100');
      }
    }
    
    if (enabledStats.goldEarned && stats.goldEarned !== undefined) {
      if (stats.goldEarned < 0 || stats.goldEarned > 10000) {
        errors.push('Gold earned must be between 0 and 10,000');
      }
    }
    
    if (enabledStats.minionKills && stats.minionKills !== undefined) {
      if (stats.minionKills < 0 || stats.minionKills > 200) {
        errors.push('Minion kills must be between 0 and 200');
      }
    }
    
    if (enabledStats.level && stats.level !== undefined) {
      if (stats.level < 1 || stats.level > 8) {
        errors.push('Level must be between 1 and 8');
      }
    }
    
    // Note: Zero values are legitimate for all stats - individual range validation above
    // ensures values are within appropriate bounds (e.g., kills 0-50, deaths 0-20, etc.)
    // No additional "activity" validation needed as players may legitimately have zeros
    
    return errors;
  };
  
  // Update player statistics with validation
  const handlePlayerStatsChange = (playerIndex: number, newStats: PlayerStats) => {
    const updatedStats = new Map(playerStats);
    updatedStats.set(playerIndex, newStats);
    setPlayerStats(updatedStats);
    
    // Validate the new stats
    const validationErrors = validatePlayerStats(playerIndex, newStats);
    const updatedErrors = new Map(statsErrors);
    
    if (validationErrors.length > 0) {
      updatedErrors.set(playerIndex, validationErrors);
    } else {
      updatedErrors.delete(playerIndex);
    }
    
    setStatsErrors(updatedErrors);
  };
  
  // Reset stats for a specific player
  const handleResetPlayerStats = (playerIndex: number) => {
    playSound('buttonClick');
    const updatedStats = new Map(playerStats);
    updatedStats.set(playerIndex, initializePlayerStats());
    setPlayerStats(updatedStats);
    
    // Clear any errors for this player
    const updatedErrors = new Map(statsErrors);
    updatedErrors.delete(playerIndex);
    setStatsErrors(updatedErrors);
  };
  
  // Reset all player stats
  const handleResetAllStats = () => {
    playSound('buttonClick');
    const newPlayerStats = new Map<number, PlayerStats>();
    players.forEach((_, index) => {
      newPlayerStats.set(index, initializePlayerStats());
    });
    setPlayerStats(newPlayerStats);
    setStatsErrors(new Map());
  };
  
  // Add a new player to the form
  const handleAddPlayer = (team: Team) => {
    // Don't add more than 10 players
    if (players.length >= 10) {
      setFormErrors({ 
        ...formErrors, 
        maxPlayers: 'Maximum 10 players allowed' 
      });
      return;
    }
    
    playSound('buttonClick');
    
    const newPlayer: PlayerEntry = {
      id: '', // Empty name initially
      name: '', // Empty name initially - for PlayerNameInput
      team,
      heroId: null,
      heroName: '',
      heroRoles: []
    };
    
    const newPlayerIndex = players.length;
    setPlayers([...players, newPlayer]);
    
    // Initialize stats for new player if in detailed mode
    if (detailedMode) {
      const updatedStats = new Map(playerStats);
      updatedStats.set(newPlayerIndex, initializePlayerStats());
      setPlayerStats(updatedStats);
    }
    
    setFormErrors({ 
      ...formErrors, 
      players: undefined,
      maxPlayers: undefined 
    });
  };
  
  // Remove a player from the form
  const handleRemovePlayer = (playerId: number) => {
    playSound('buttonClick');
    
    const updatedPlayers = [...players];
    updatedPlayers.splice(playerId, 1);
    setPlayers(updatedPlayers);
    
    // Clean up stats and errors for removed player and reindex remaining players
    if (detailedMode) {
      const newPlayerStats = new Map<number, PlayerStats>();
      const newStatsErrors = new Map<number, string[]>();
      
      updatedPlayers.forEach((_, newIndex) => {
        const oldIndex = newIndex >= playerId ? newIndex + 1 : newIndex;
        if (playerStats.has(oldIndex)) {
          newPlayerStats.set(newIndex, playerStats.get(oldIndex)!);
        }
        if (statsErrors.has(oldIndex)) {
          newStatsErrors.set(newIndex, statsErrors.get(oldIndex)!);
        }
      });
      
      setPlayerStats(newPlayerStats);
      setStatsErrors(newStatsErrors);
    }
    
    // Re-check for duplicates after removing a player
    checkForDuplicates(updatedPlayers);
  };
  
  // Update player name and check for duplicates
  const handlePlayerNameChange = (index: number, name: string) => {
    const updatedPlayers = [...players];
    // Update both id and name fields to keep them in sync
    updatedPlayers[index].id = name;
    updatedPlayers[index].name = name;
    setPlayers(updatedPlayers);
    
    // Check for duplicate names
    checkForDuplicates(updatedPlayers);
  };
  
  // Check for duplicate player names and heroes
  const checkForDuplicates = (currentPlayers: PlayerEntry[] = players) => {
    // Check for duplicate player names
    const playerNames = currentPlayers.map(p => p.id.trim()).filter(n => n !== '');
    const nameMap: Record<string, number> = {};
    const duplicateNames: string[] = [];
    
    playerNames.forEach(name => {
      nameMap[name] = (nameMap[name] || 0) + 1;
      if (nameMap[name] > 1 && !duplicateNames.includes(name)) {
        duplicateNames.push(name);
      }
    });
    
    setDuplicatePlayerNames(duplicateNames);
    
    // Check for duplicate heroes
    const heroIds = currentPlayers.map(p => p.heroId).filter((id): id is number => id !== null);
    const heroMap: Record<number, number> = {};
    const duplicateHeroes: number[] = [];
    
    heroIds.forEach(id => {
      heroMap[id] = (heroMap[id] || 0) + 1;
      if (heroMap[id] > 1 && !duplicateHeroes.includes(id)) {
        duplicateHeroes.push(id);
      }
    });
    
    setDuplicateHeroIds(duplicateHeroes);
  };
  
  // Open hero selector for a specific player
  const handleOpenHeroSelector = (index: number) => {
    playSound('buttonClick');
    setCurrentPlayerIndex(index);
    setShowHeroSelector(true);
  };
  
  // Select a hero for a player
  const handleSelectHero = (hero: Hero) => {
    playSound('heroSelect');
    
    if (currentPlayerIndex === -1) return;
    
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].heroId = hero.id;
    updatedPlayers[currentPlayerIndex].heroName = hero.name;
    updatedPlayers[currentPlayerIndex].heroRoles = hero.roles;
    
    setPlayers(updatedPlayers);
    
    // Check for duplicate heroes
    checkForDuplicates(updatedPlayers);
    
    setShowHeroSelector(false);
    setFormErrors({ ...formErrors, heroes: undefined, heroDuplicates: undefined });
  };
  
  // Toggle expansion selection for hero filtering
  const handleToggleExpansion = (expansion: string) => {
    playSound('buttonClick');
    
    if (selectedExpansions.includes(expansion)) {
      setSelectedExpansions(selectedExpansions.filter(exp => exp !== expansion));
    } else {
      setSelectedExpansions([...selectedExpansions, expansion]);
    }
  };
  
  // Handle hero sorting
  const handleSortHeroes = (sortBy: 'name' | 'complexity') => {
    playSound('buttonClick');
    
    // If already sorting by this field, toggle the order
    if (heroSortBy === sortBy) {
      setHeroSortOrder(heroSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If sorting by a new field, set it and default to ascending
      setHeroSortBy(sortBy);
      setHeroSortOrder('asc');
    }
  };
  
  // Validate the form before submission
  const validateForm = (): boolean => {
    const errors: {
      date?: string;
      players?: string;
      teams?: string;
      heroes?: string;
      maxPlayers?: string;
      heroDuplicates?: string;
      teamBalance?: string;
      stats?: string;
      victoryType?: string;
    } = {};

    // Check if victory type is selected
    if (!victoryType) {
      errors.victoryType = 'Please select how the match was won';
    }
    
    // Check if date is valid
    if (!matchDate) {
      errors.date = 'Match date is required';
    }
    
    // Check if we have at least 4 players (2 per team)
    if (players.length < 4) {
      errors.players = 'At least 4 players are required (2 per team)';
    }
    
    // Check if we have at most 10 players
    if (players.length > 10) {
      errors.maxPlayers = 'Maximum 10 players allowed';
    }
    
    // Check if all players have names
    if (players.some(player => !player.id.trim())) {
      errors.players = 'All players must have names';
    }
    
    // Check for duplicate player names
    const playerNames = players.map(p => p.id.trim());
    const uniqueNames = new Set(playerNames);
    if (uniqueNames.size !== playerNames.length) {
      // Find the duplicate names
      const duplicates = playerNames.filter((name, index) => 
        name && playerNames.indexOf(name) !== index
      );
      errors.players = `Duplicate player names found: ${[...new Set(duplicates)].join(', ')}`;
    }
    
    // Check if teams are balanced (at least 2 players per team)
    const titanPlayers = players.filter(p => p.team === Team.Titans);
    const atlanteanPlayers = players.filter(p => p.team === Team.Atlanteans);
    
    if (titanPlayers.length < 2 || atlanteanPlayers.length < 2) {
      errors.teams = 'Each team must have at least 2 players';
    }
    
    // Check if teams are balanced (equal or differ by at most 1)
    if (Math.abs(titanPlayers.length - atlanteanPlayers.length) > 1) {
      errors.teamBalance = 'Teams must be balanced (equal count or differ by at most 1 player)';
    }
    
    // Check if all players have selected heroes
    if (players.some(player => player.heroId === null)) {
      errors.heroes = 'All players must select a hero';
    }
    
    // Check for duplicate hero selections
    const heroIds = players.map(p => p.heroId).filter(id => id !== null);
    const uniqueHeroIds = new Set(heroIds);
    if (uniqueHeroIds.size !== heroIds.length) {
      // Find the duplicate heroes
      const duplicateHeroIds = heroIds.filter((id, index) => 
        id !== null && heroIds.indexOf(id) !== index
      );
      const duplicateHeroNames = players
        .filter(p => p.heroId !== null && duplicateHeroIds.includes(p.heroId as number))
        .map(p => p.heroName)
        .filter((name, i, arr) => arr.indexOf(name) === i);
      
      errors.heroDuplicates = `Duplicate heroes selected: ${duplicateHeroNames.join(', ')}`;
    }
    
    // Validate detailed stats if in detailed mode
    if (detailedMode) {
      let hasStatsErrors = false;
      const newStatsErrors = new Map<number, string[]>();
      
      players.forEach((_, index) => {
        const stats = playerStats.get(index);
        if (stats) {
          const validationErrors = validatePlayerStats(index, stats);
          if (validationErrors.length > 0) {
            newStatsErrors.set(index, validationErrors);
            hasStatsErrors = true;
          }
        }
      });
      
      if (hasStatsErrors) {
        errors.stats = 'Please fix player statistics errors before submitting';
        setStatsErrors(newStatsErrors);
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      playSound('buttonClick');
      return;
    }
    
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    
    try {
      // Create match data object
      const matchData = {
        date: new Date(`${matchDate}T${matchTime || '00:00'}`),
        winningTeam,
        gameLength,
        doubleLanes,
        victoryType
      };
      
      // Create player data array
      const playerData = players.map((player, index) => {
        const baseData = {
          id: player.id,
          team: player.team,
          heroId: player.heroId!,
          heroName: player.heroName,
          heroRoles: player.heroRoles,
        };
        
        if (detailedMode && playerStats.has(index)) {
          // Use detailed statistics if available, only for enabled stats
          const stats = playerStats.get(index)!;
          return {
            ...baseData,
            // Only include enabled stats, others remain undefined (null in DB)
            kills: enabledStats.kills ? stats.kills : undefined,
            deaths: enabledStats.deaths ? stats.deaths : undefined,
            assists: enabledStats.assists ? stats.assists : undefined,
            goldEarned: enabledStats.goldEarned ? stats.goldEarned : undefined,
            minionKills: enabledStats.minionKills ? stats.minionKills : undefined,
            level: enabledStats.level ? stats.level : undefined
          };
        }
        
        // Default values for basic mode (all stats N/A)
        return {
          ...baseData,
          kills: undefined,
          deaths: undefined,
          assists: undefined,
          goldEarned: undefined,
          minionKills: undefined,
          level: undefined
        };
      });
      
      // Record the match to the database - THIS WAS MISSING!
      await dbService.recordMatch(matchData, playerData);
      
      playSound('phaseChange');
      
      // Show success message
      setSuccessMessage(`Match successfully recorded!`);

      // Reset form for a new entry
      setPlayers([]);
      setMatchDate(new Date().toISOString().split('T')[0]);
      setMatchTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
      setVictoryType(undefined);
      
    } catch (error) {
      console.error('Error recording match:', error);
      setErrorMessage('Failed to record match. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get filtered heroes based on selected expansions, complexity, search term, and sort them
  const getFilteredHeroes = (): Hero[] => {
    let heroes = filterHeroesByExpansions(selectedExpansions).filter(
      hero => hero.complexity <= maxComplexity
    );
    
    // Apply search filter if provided
    if (heroSearchTerm) {
      const searchLower = heroSearchTerm.toLowerCase();
      heroes = heroes.filter(hero => 
        hero.name.toLowerCase().includes(searchLower) ||
        hero.roles.some(role => role.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort heroes based on current sort criteria
    heroes.sort((a, b) => {
      let comparison = 0;
      
      if (heroSortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else { // complexity
        comparison = a.complexity - b.complexity;
      }
      
      // Reverse for descending order
      return heroSortOrder === 'asc' ? comparison : -comparison;
    });
    
    return heroes;
  };
  

  
  const filteredHeroes = getFilteredHeroes();
  
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Menu</span>
        </button>
        <h2 className="text-2xl font-bold">Record Match</h2>
      </div>
      
      {/* Information Banner */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <HelpCircle size={20} className="text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-300 mb-1">Manual Match Recording</h3>
            <p className="text-sm">
              Use this form to record matches played outside the timer app.
              Note that matches played using the drafting system and timer are automatically recorded.
            </p>
          </div>
        </div>
      </div>
      
      {/* Form */}
      <div className="space-y-6">
        {/* Match Details Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calendar size={18} className="mr-2 text-blue-400" />
            Match Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Date Picker */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Match Date</label>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.date && (
                <div className="text-red-400 text-sm mt-1">{formErrors.date}</div>
              )}
            </div>
            
            {/* Time Picker */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Match Time (optional)</label>
              <input
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Game Type */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Game Type</label>
              <div className="flex gap-4">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="gameLength"
                    value={GameLength.Quick}
                    checked={gameLength === GameLength.Quick}
                    onChange={() => setGameLength(GameLength.Quick)}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2">Quick</span>
                </label>
                
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="gameLength"
                    value={GameLength.Long}
                    checked={gameLength === GameLength.Long}
                    onChange={() => setGameLength(GameLength.Long)}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2">Long</span>
                </label>
              </div>
            </div>
            
            {/* Double Lanes */}
            <div>
              <label className="block text-sm text-gray-300 mb-1">Lane Configuration</label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={doubleLanes}
                  onChange={() => setDoubleLanes(!doubleLanes)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                <span className="ml-2">Double Lanes (2 Lanes)</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Teams Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Users size={18} className="mr-2 text-blue-400" />
            Teams and Players
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Add Titan Button */}
            <button
              onClick={() => handleAddPlayer(Team.Titans)}
              className={`flex-1 flex items-center justify-center ${
                players.length >= 10 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-blue-700 hover:bg-blue-600'
              } px-4 py-2 rounded-lg`}
              disabled={players.length >= 10}
            >
              <Plus size={18} className="mr-2" />
              <span>Add Titan Player</span>
            </button>
            
            {/* Add Atlantean Button */}
            <button
              onClick={() => handleAddPlayer(Team.Atlanteans)}
              className={`flex-1 flex items-center justify-center ${
                players.length >= 10 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-red-700 hover:bg-red-600'
              } px-4 py-2 rounded-lg`}
              disabled={players.length >= 10}
            >
              <Plus size={18} className="mr-2" />
              <span>Add Atlantean Player</span>
            </button>
          </div>
          
          {/* Player List */}
          {players.length > 0 ? (
            <div className="space-y-2">
              {players.map((player, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${
                    player.team === Team.Titans ? 'bg-blue-900/30' : 'bg-red-900/30'
                  } flex flex-col sm:flex-row items-start sm:items-center gap-2`}
                >
                  {/* Player Name Input - using the component */}
                  <div className="w-full sm:w-1/3">
                    <PlayerNameInput
                      player={{
                        id: index, // Pass index as id for component
                        team: player.team,
                        hero: null,
                        name: player.name
                      }}
                      onNameChange={(name) => handlePlayerNameChange(index, name)}
                      onRemove={() => handleRemovePlayer(index)}
                      isDuplicate={duplicatePlayerNames.includes(player.name.trim()) && player.name.trim() !== ''}
                      suggestedNames={existingPlayerNames}
                    />
                  </div>
                  
                  {/* Hero Selection */}
                  <div className="flex-1 flex items-center">
                    <button
                      onClick={() => handleOpenHeroSelector(index)}
                      className={`flex-1 px-3 py-2 ${
                        player.heroId !== null 
                          ? duplicateHeroIds.includes(player.heroId as number)
                            ? 'bg-amber-900/30 border border-amber-500'
                            : 'bg-gray-700' 
                          : 'bg-gray-800 border border-dashed border-gray-600'
                      } rounded-lg hover:bg-gray-600 transition-colors`}
                    >
                      {player.heroId !== null ? (
                        <div className="flex items-center">
                          <Shield size={16} className="mr-2" />
                          <span>{player.heroName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Select Hero</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-4 border border-dashed border-gray-600 rounded-lg text-gray-400">
              Add players to both teams using the buttons above
            </div>
          )}
          
          {/* Error Messages */}
          {formErrors.players && (
            <div className="text-red-400 text-sm mt-2">{formErrors.players}</div>
          )}
          {formErrors.teams && (
            <div className="text-red-400 text-sm mt-2">{formErrors.teams}</div>
          )}
          {formErrors.teamBalance && (
            <div className="text-red-400 text-sm mt-2">{formErrors.teamBalance}</div>
          )}
          {formErrors.heroes && (
            <div className="text-red-400 text-sm mt-2">{formErrors.heroes}</div>
          )}
          {formErrors.heroDuplicates && (
            <div className="text-red-400 text-sm mt-2">{formErrors.heroDuplicates}</div>
          )}
          {formErrors.maxPlayers && (
            <div className="text-red-400 text-sm mt-2">{formErrors.maxPlayers}</div>
          )}
          {formErrors.stats && (
            <div className="text-red-400 text-sm mt-2">{formErrors.stats}</div>
          )}
          
          {/* Team Counts with Validation Indicators */}
          {players.length > 0 && (
            <div className="mt-3 flex justify-between text-sm">
              <div>
                Titans: {players.filter(p => p.team === Team.Titans).length} players
                {players.filter(p => p.team === Team.Titans).length < 2 && (
                  <span className="ml-2 text-amber-400">Minimum 2 required</span>
                )}
              </div>
              <div>
                Atlanteans: {players.filter(p => p.team === Team.Atlanteans).length} players
                {players.filter(p => p.team === Team.Atlanteans).length < 2 && (
                  <span className="ml-2 text-amber-400">Minimum 2 required</span>
                )}
              </div>
            </div>
          )}
          
          {/* Team Balance Warning */}
          {players.length > 0 && 
           Math.abs(players.filter(p => p.team === Team.Titans).length - 
                   players.filter(p => p.team === Team.Atlanteans).length) > 1 && (
            <div className="mt-1 text-amber-400 text-sm text-center">
              Teams are unbalanced! Teams should have equal player counts or differ by at most 1.
            </div>
          )}
          
          {/* Max Players Warning */}
          {players.length > 10 && (
            <div className="mt-1 text-red-400 text-sm text-center">
              Too many players! Maximum 10 players allowed.
            </div>
          )}
        </div>
        
        {/* Recording Mode Toggle */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Database size={18} className="mr-2 text-green-400" />
            Recording Mode
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleModeToggle}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                !detailedMode
                  ? 'border-blue-500 bg-blue-900/50'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="text-left">
                <div className="font-medium text-lg mb-1">Basic Recording</div>
                <div className="text-sm text-gray-300">
                  Record match results with player names, heroes, and winner only
                </div>
              </div>
            </button>
            
            <button
              onClick={handleModeToggle}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                detailedMode
                  ? 'border-green-500 bg-green-900/50'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="text-left">
                <div className="font-medium text-lg mb-1">Detailed Recording</div>
                <div className="text-sm text-gray-300">
                  Record complete player statistics: kills, deaths, assists, gold, level
                </div>
              </div>
            </button>
          </div>
          
          {detailedMode && (
            <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-200 flex items-center">
                <HelpCircle size={16} className="mr-2" />
                Detailed mode allows you to record comprehensive player statistics for more accurate match analysis.
              </p>
            </div>
          )}
        </div>
        
        {/* Player Statistics Section - only show in detailed mode */}
        {detailedMode && (
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Users size={18} className="mr-2 text-green-400" />
              Player Statistics
            </h3>
            
            {/* Stat Category Selection */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-600">
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                <Check size={16} className="mr-2" />
                Select Statistics to Track
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.kills}
                    onChange={() => handleStatCategoryToggle('kills')}
                    className="form-checkbox h-4 w-4 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm flex items-center">
                    <Sword size={14} className="mr-1" />
                    Kills
                  </span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.deaths}
                    onChange={() => handleStatCategoryToggle('deaths')}
                    className="form-checkbox h-4 w-4 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm flex items-center">
                    <Heart size={14} className="mr-1" />
                    Deaths
                  </span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.assists}
                    onChange={() => handleStatCategoryToggle('assists')}
                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm flex items-center">
                    <HandHelping size={14} className="mr-1" />
                    Assists
                  </span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.goldEarned}
                    onChange={() => handleStatCategoryToggle('goldEarned')}
                    className="form-checkbox h-4 w-4 text-yellow-600 bg-gray-800 border-gray-600 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm flex items-center">
                    <Coins size={14} className="mr-1" />
                    Gold
                  </span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.minionKills}
                    onChange={() => handleStatCategoryToggle('minionKills')}
                    className="form-checkbox h-4 w-4 text-green-600 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm flex items-center">
                    <Target size={14} className="mr-1" />
                    Minions
                  </span>
                </label>
                
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700/50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={enabledStats.level}
                    onChange={() => handleStatCategoryToggle('level')}
                    className="form-checkbox h-4 w-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm flex items-center">
                    <Star size={14} className="mr-1" />
                    Level
                  </span>
                </label>
              </div>
              
              {/* Helper text */}
              <p className="text-xs text-gray-400 mt-3">
                💡 Only checked statistics will be tracked.
              </p>
            </div>
            
            <TeamStatsContainer
              players={players}
              playerStats={playerStats}
              statsErrors={statsErrors}
              enabledStats={enabledStats}
              onStatsChange={handlePlayerStatsChange}
              onResetPlayerStats={handleResetPlayerStats}
              onResetAllStats={handleResetAllStats}
            />
          </div>
        )}
        
        {/* Winner Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Trophy size={18} className="mr-2 text-yellow-400" />
            Match Winner
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Titans Win Button */}
            <button
              onClick={() => setWinningTeam(Team.Titans)}
              className={`p-4 rounded-lg border-2 ${
                winningTeam === Team.Titans 
                  ? 'border-blue-500 bg-blue-900/50' 
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              } flex items-center`}
            >
              {winningTeam === Team.Titans && (
                <Check size={18} className="mr-2 text-blue-400" />
              )}
              <span className="text-lg font-medium">Titans Victory</span>
            </button>
            
            {/* Atlanteans Win Button */}
            <button
              onClick={() => setWinningTeam(Team.Atlanteans)}
              className={`p-4 rounded-lg border-2 ${
                winningTeam === Team.Atlanteans
                  ? 'border-red-500 bg-red-900/50'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              } flex items-center`}
            >
              {winningTeam === Team.Atlanteans && (
                <Check size={18} className="mr-2 text-red-400" />
              )}
              <span className="text-lg font-medium">Atlanteans Victory</span>
            </button>
          </div>
        </div>

        {/* Victory Type Section */}
        <div className="bg-gray-700 rounded-lg p-4">
          <VictoryTypeSelector
            value={victoryType}
            onChange={(type) => {
              playSound('buttonClick');
              setVictoryType(type);
              setFormErrors({ ...formErrors, victoryType: undefined });
            }}
            required={true}
          />
          {formErrors.victoryType && (
            <div className="text-red-400 text-sm mt-2">{formErrors.victoryType}</div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg flex items-center text-xl ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                <span>Recording...</span>
              </>
            ) : (
              <>
                <Save size={20} className="mr-3" />
                <span>Record Match</span>
              </>
            )}
          </button>
        </div>
        
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mt-4 p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-300 text-center">
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-center">
            {errorMessage}
          </div>
        )}
      </div>
      
      {/* Hero Selector Modal */}
      {showHeroSelector && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold">Select Hero</h3>
              <button
                onClick={() => setShowHeroSelector(false)}
                className="p-1 bg-gray-600 hover:bg-gray-500 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={heroSearchTerm}
                    onChange={(e) => setHeroSearchTerm(e.target.value)}
                    placeholder="Search heroes or roles..."
                    className="w-full px-4 py-2 pl-10 bg-gray-700 border border-gray-600 rounded-lg"
                  />
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                
                {/* Complexity Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm whitespace-nowrap">Max Complexity:</span>
                  <select
                    value={maxComplexity}
                    onChange={(e) => setMaxComplexity(Number(e.target.value))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              </div>
              
              {/* Expansion Filters */}
              <div className="mt-3 flex flex-wrap gap-2">
                {getAllExpansions().map(expansion => (
                  <button
                    key={expansion}
                    onClick={() => handleToggleExpansion(expansion)}
                    className={`px-3 py-1 text-sm rounded ${
                      selectedExpansions.includes(expansion)
                        ? 'bg-blue-700 hover:bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {expansion}
                  </button>
                ))}
              </div>
              
              {/* Sorting Controls */}
              <div className="mt-3 border-t border-gray-600 pt-3 flex items-center">
                <span className="text-sm mr-2">Sort by:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSortHeroes('name')}
                    className={`px-3 py-1 text-sm rounded flex items-center ${
                      heroSortBy === 'name'
                        ? 'bg-blue-700 hover:bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <span>Name</span>
                    {heroSortBy === 'name' && (
                      heroSortOrder === 'asc' ? (
                        <ArrowUp size={14} className="ml-1" />
                      ) : (
                        <ArrowDown size={14} className="ml-1" />
                      )
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleSortHeroes('complexity')}
                    className={`px-3 py-1 text-sm rounded flex items-center ${
                      heroSortBy === 'complexity'
                        ? 'bg-blue-700 hover:bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <span>Complexity</span>
                    {heroSortBy === 'complexity' && (
                      heroSortOrder === 'asc' ? (
                        <ArrowUp size={14} className="ml-1" />
                      ) : (
                        <ArrowDown size={14} className="ml-1" />
                      )
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Heroes Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredHeroes.map(hero => (
                  <div
                    key={hero.id}
                    onClick={() => handleSelectHero(hero)}
                    className="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 cursor-pointer transition-colors flex flex-col items-center"
                  >
                    <div className="w-16 h-16 bg-gray-800 rounded-full overflow-hidden mb-2">
  <img
  src={hero.icon}
  alt={hero.name}
  className="w-full h-full object-cover"
  onError={(e) => {
    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=Hero';
  }}
/>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{hero.name}</div>
                      <div className="text-xs text-gray-400">{hero.roles.join(' • ')}</div>
                      <div className="text-xs">
                        {[...Array(hero.complexity)].map((_, i) => (
                          <span key={i} className="text-yellow-500">★</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredHeroes.length === 0 && (
                  <div className="col-span-full text-center p-8 text-gray-400">
                    No heroes match your search criteria. Try adjusting your filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Missing components for the code to work
const Search: React.FC<{ size: number, className?: string }> = ({ size, className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.3-4.3"></path>
  </svg>
);

const X: React.FC<{ size: number }> = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"></path>
    <path d="m6 6 12 12"></path>
  </svg>
);

// TeamStatsContainer Component - Container for team-based stats organization
interface TeamStatsContainerProps {
  players: PlayerEntry[];
  playerStats: Map<number, PlayerStats>;
  statsErrors: Map<number, string[]>;
  enabledStats: StatCategories;
  onStatsChange: (playerIndex: number, stats: PlayerStats) => void;
  onResetPlayerStats?: (playerIndex: number) => void;
  onResetAllStats?: () => void;
}

const TeamStatsContainer: React.FC<TeamStatsContainerProps> = ({
  players,
  playerStats,
  statsErrors,
  enabledStats,
  onStatsChange,
  onResetPlayerStats,
  onResetAllStats
}) => {
  const titanPlayers = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.team === Team.Titans);
    
  const atlanteanPlayers = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.team === Team.Atlanteans);
  
  return (
    <div className="space-y-6">
      {/* Reset All Button - show only if there are players */}
      {players.length > 0 && onResetAllStats && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onResetAllStats}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center text-sm transition-colors"
          >
            <Minus size={16} className="mr-2" />
            Reset All Stats
          </button>
        </div>
      )}
      {/* Titans Team */}
      {titanPlayers.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium flex items-center text-blue-300">
            <Shield size={18} className="mr-2" />
            Titans ({titanPlayers.length} players)
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {titanPlayers.map(({ player, index }) => (
              <PlayerStatsCard
                key={index}
                player={player}
                playerIndex={index}
                stats={playerStats.get(index)}
                errors={statsErrors.get(index)}
                enabledStats={enabledStats}
                onStatsChange={(stats) => onStatsChange(index, stats)}
                onResetStats={onResetPlayerStats}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Atlanteans Team */}
      {atlanteanPlayers.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium flex items-center text-red-300">
            <Shield size={18} className="mr-2" />
            Atlanteans ({atlanteanPlayers.length} players)
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {atlanteanPlayers.map(({ player, index }) => (
              <PlayerStatsCard
                key={index}
                player={player}
                playerIndex={index}
                stats={playerStats.get(index)}
                errors={statsErrors.get(index)}
                enabledStats={enabledStats}
                onStatsChange={(stats) => onStatsChange(index, stats)}
                onResetStats={onResetPlayerStats}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {players.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <Users size={48} className="mx-auto mb-3 opacity-50" />
          <p>Add players to both teams to enter statistics</p>
        </div>
      )}
    </div>
  );
};

// PlayerStatsCard Component - Individual player statistics entry card
interface PlayerStatsCardProps {
  player: PlayerEntry;
  playerIndex: number;
  onStatsChange: (stats: PlayerStats) => void;
  stats?: PlayerStats;
  errors?: string[];
  enabledStats: StatCategories;
  onResetStats?: (playerIndex: number) => void;
}

const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({ 
  player, 
  playerIndex, 
  onStatsChange, 
  stats,
  errors = [],
  enabledStats,
  onResetStats 
}) => {
  const currentStats = stats || {};
  
  const handleStatChange = (statKey: keyof PlayerStats, value: number) => {
    const newStats = { ...currentStats, [statKey]: value };
    onStatsChange(newStats);
  };
  
  // Check if any stats are enabled
  const hasEnabledStats = Object.values(enabledStats).some(Boolean);
  
  // Count how many stats are enabled for grid columns
  const enabledStatsCount = Object.values(enabledStats).filter(Boolean).length;
  
  const teamColorClass = player.team === Team.Titans ? 'border-blue-500' : 'border-red-500';
  const teamBgClass = player.team === Team.Titans ? 'bg-blue-900/20' : 'bg-red-900/20';
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border-2 ${teamColorClass} ${teamBgClass}`}>
      {/* Player Header */}
      <div className="flex items-center mb-4 pb-3 border-b border-gray-600">
        <div className="flex-1">
          <div className="font-medium text-lg">{player.name || 'Unnamed Player'}</div>
          <div className="text-sm text-gray-300 flex items-center">
            <Shield size={14} className="mr-1" />
            {player.heroName || 'No Hero Selected'}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onResetStats && (
            <button
              type="button"
              onClick={() => onResetStats(playerIndex)}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs flex items-center transition-colors"
              title="Reset this player's stats"
            >
              <Minus size={12} className="mr-1" />
              Reset
            </button>
          )}
          
          {errors.length > 0 && (
            <div className="text-red-400 text-sm" title={errors.join(', ')}>
              <HelpCircle size={16} />
            </div>
          )}
        </div>
      </div>
      
      {/* Statistics Grid - Dynamic layout based on enabled stats */}
      {hasEnabledStats ? (
        <div className={`grid gap-4 ${enabledStatsCount <= 3 ? `grid-cols-${enabledStatsCount}` : 'grid-cols-3'}`}>
          {enabledStats.kills && (
            <StatInputControl
              label="Kills"
              value={currentStats.kills ?? 0}
              onChange={(value) => handleStatChange('kills', value)}
              min={0}
              max={50}
              enabled={true}
              icon={<Sword size={14} />}
            />
          )}
          
          {enabledStats.deaths && (
            <StatInputControl
              label="Deaths"
              value={currentStats.deaths ?? 0}
              onChange={(value) => handleStatChange('deaths', value)}
              min={0}
              max={20}
              enabled={true}
              icon={<Heart size={14} />}
            />
          )}
          
          {enabledStats.assists && (
            <StatInputControl
              label="Assists"
              value={currentStats.assists ?? 0}
              onChange={(value) => handleStatChange('assists', value)}
              min={0}
              max={100}
              enabled={true}
              icon={<HandHelping size={14} />}
            />
          )}
          
          {enabledStats.goldEarned && (
            <StatInputControl
              label="Gold"
              value={currentStats.goldEarned ?? 0}
              onChange={(value) => handleStatChange('goldEarned', value)}
              min={0}
              max={10000}
              enabled={true}
              icon={<Coins size={14} />}
            />
          )}
          
          {enabledStats.minionKills && (
            <StatInputControl
              label="Minions"
              value={currentStats.minionKills ?? 0}
              onChange={(value) => handleStatChange('minionKills', value)}
              min={0}
              max={200}
              enabled={true}
              icon={<Target size={14} />}
            />
          )}
          
          {enabledStats.level && (
            <StatInputControl
              label="Level"
              value={currentStats.level ?? 1}
              onChange={(value) => handleStatChange('level', value)}
              min={1}
              max={8}
              enabled={true}
              icon={<Star size={14} />}
            />
          )}
        </div>
      ) : (
        <div className="text-center p-6 border border-dashed border-gray-600 rounded-lg text-gray-400">
          <p className="text-sm">No statistics selected for tracking</p>
          <p className="text-xs mt-1">Enable stat categories above to start recording</p>
        </div>
      )}
      
      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="text-red-400 text-xs flex items-center">
              <HelpCircle size={12} className="mr-1" />
              {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// StatInputControl Component - Individual stat entry control based on EndOfRoundAssistant patterns
interface StatInputControlProps {
  label: string;
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  icon?: React.ReactNode;
  enabled?: boolean; // Whether this stat category is enabled for tracking
}

const StatInputControl: React.FC<StatInputControlProps> = ({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 999, 
  disabled = false,
  icon,
  enabled = true
}) => {
  const actualValue = value ?? 0;
  
  const handleIncrement = () => {
    if (actualValue < max) {
      onChange(actualValue + 1);
    }
  };
  
  const handleDecrement = () => {
    if (actualValue > min) {
      onChange(actualValue - 1);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };
  
  // If stat category is not enabled, show N/A state
  if (!enabled) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="flex items-center text-sm text-gray-500">
          {icon && <span className="mr-1 opacity-50">{icon}</span>}
          <span>{label}</span>
        </div>
        
        <div className="flex items-center justify-center w-16 h-8 bg-gray-800 border border-gray-600 rounded-lg text-gray-500 text-sm">
          N/A
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="flex items-center text-sm text-gray-300">
        {icon && <span className="mr-1">{icon}</span>}
        <span>{label}</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || actualValue <= min}
          className="w-8 h-8 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Minus size={14} />
        </button>
        
        <input
          type="number"
          value={actualValue}
          onChange={handleInputChange}
          disabled={disabled}
          min={min}
          max={max}
          className="w-16 h-8 text-center bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        />
        
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || actualValue >= max}
          className="w-8 h-8 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

export default RecordMatch;