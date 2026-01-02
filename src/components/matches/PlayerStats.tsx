// src/components/matches/PlayerStats.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Search, TrendingUp, Users, Swords, Info, Trophy, Medal, Hexagon, X, HelpCircle, User, Filter, ChevronDown, ChevronUp, Calendar, Network } from 'lucide-react';
import { DBPlayer } from '../../services/DatabaseService';
import dbService, { getDisplayRating } from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import EnhancedTooltip from '../common/EnhancedTooltip';
import PlayerRelationshipGraph from './PlayerRelationshipGraph';
import { useDataSource } from '../../hooks/useDataSource';
import { useStatsFilter } from '../../context/StatsFilterContext';


interface PlayerStatsProps {
  onBack: () => void;
  onViewSkillOverTime: () => void;
  onViewPlayerDetails: (playerId: string) => void;
}

interface PlayerWithStats extends DBPlayer {
  favoriteHeroes: { heroId: number; heroName: string; count: number }[];
  favoriteRoles: { role: string; count: number }[];
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kdRatio: number;
  averageGold: number;
  averageMinionKills: number;
  hasCombatStats: boolean;
  rank: number;
  displayRating: number;
}

// Modal component for skill rating explanation
const SkillExplainerModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'simple' | 'technical'>('simple');
  const { playSound } = useSound();

  if (!isOpen) return null;

  const handleClose = () => {
    playSound('buttonClick');
    onClose();
  };

  const handleTabChange = (tab: 'simple' | 'technical') => {
    playSound('buttonClick');
    setActiveTab(tab);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center">
            <HelpCircle size={24} className="mr-2 text-blue-400" />
            Understanding Skill Ratings
          </h3>
          <button
            onClick={handleClose}
            className="p-1 bg-gray-600 hover:bg-gray-500 rounded-full"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => handleTabChange('simple')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'simple'
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Simple Explanation
          </button>
          <button
            onClick={() => handleTabChange('technical')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'technical'
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Technical Details
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'simple' ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">What is a Skill Rating?</h4>
                <p className="text-gray-300 mb-4">
                  Your skill rating is a number that represents how good you are at the game compared to other players. 
                  It goes up when you win and down when you lose, but there's more to it than that!
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Why Start Low?</h4>
                <p className="text-gray-300 mb-4">
                  New players start with a lower visible rating even if they win their first few games. This is because 
                  the system needs to be confident about your skill level. Think of it like this:
                </p>
                <div className="bg-gray-700 p-4 rounded-lg mb-4">
                  <p className="text-sm mb-2">
                    <strong className="text-yellow-400">After 1 game:</strong> "This player might be good, but it could be luck"
                  </p>
                  <p className="text-sm mb-2">
                    <strong className="text-yellow-400">After 10 games:</strong> "Now I'm getting a clearer picture"
                  </p>
                  <p className="text-sm">
                    <strong className="text-yellow-400">After 20+ games:</strong> "I'm confident about this player's skill level"
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">How Rankings Work</h4>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Beat stronger teams = bigger rating increase</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Lose to weaker teams = bigger rating decrease</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Play more games = more accurate rating</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Consistent performance = higher rating</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Pro tip:</strong> Don't worry if your rating seems low at first. Play more games and the 
                  system will quickly figure out your true skill level. It typically takes about 20 games for ratings 
                  to stabilize.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">TrueSkill Rating System</h4>
                <p className="text-gray-300 mb-4">
                  Guards of Atlantis uses the TrueSkill algorithm, a Bayesian skill rating system developed by Microsoft 
                  Research. Unlike traditional Elo systems, TrueSkill models both skill and uncertainty.
                </p>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Mathematical Model</h4>
                <p className="text-gray-300 mb-4">
                  Each player's skill is modeled as a normal distribution:
                </p>
                <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm mb-4">
                  <p className="text-green-400 mb-2">skill ~ N(μ, σ²)</p>
                  <p className="text-gray-400">where:</p>
                  <p className="text-gray-300 ml-4">μ (mu) = mean skill estimate</p>
                  <p className="text-gray-300 ml-4">σ (sigma) = standard deviation (uncertainty)</p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Conservative Skill Estimate</h4>
                <p className="text-gray-300 mb-4">
                  The displayed rating uses the conservative skill estimate (ordinal):
                </p>
                <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm mb-4">
                  <p className="text-green-400">ordinal = μ - 3σ</p>
                </div>
                <p className="text-gray-300 mb-4">
                  This represents the skill level we're 99.7% confident the player exceeds (3-sigma confidence interval). 
                  The display rating is then scaled to a familiar range:
                </p>
                <div className="bg-gray-900 p-4 rounded-lg font-mono text-sm mb-4">
                  <p className="text-green-400">displayRating = (ordinal + 25) × 40 + 200</p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Update Dynamics</h4>
                <p className="text-gray-300 mb-4">
                  After each match, the system updates beliefs using Bayes' theorem:
                </p>
                <ul className="space-y-2 text-gray-300 ml-4">
                  <li>• Prior: Current skill distribution</li>
                  <li>• Likelihood: Match outcome probability</li>
                  <li>• Posterior: Updated skill distribution</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Key Parameters</h4>
                <div className="bg-gray-700 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong className="text-yellow-400">β (beta) = 25/6:</strong> Performance variance parameter
                  </p>
                  <p className="text-sm">
                    <strong className="text-yellow-400">τ (tau) = 25/300:</strong> Dynamics factor (skill change rate)
                  </p>
                  <p className="text-sm">
                    <strong className="text-yellow-400">Initial values:</strong> μ₀ = 25, σ₀ = 25/3
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3 text-blue-400">Advantages over Elo</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    <span>Handles uncertainty explicitly (new vs experienced players)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    <span>Better team balance predictions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    <span>Faster convergence to true skill</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">•</span>
                    <span>Natural handling of returning players</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-400">
                  <strong>Reference:</strong> Herbrich, R., Minka, T., & Graepel, T. (2007). 
                  TrueSkill™: A Bayesian skill rating system. In Advances in Neural Information Processing Systems 19.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Component to display player rank with distinctive styling
const RankDisplay: React.FC<{ rank: number; skill: number }> = ({ rank, skill }) => {
  let icon;
  let rankClass;
  
  if (rank === 1) {
    icon = <Trophy size={18} className="mr-2 text-yellow-300" />;
    rankClass = "text-yellow-300 font-bold";
  } else if (rank === 2) {
    icon = <Medal size={18} className="mr-2 text-gray-300" />;
    rankClass = "text-gray-300 font-bold";
  } else if (rank === 3) {
    icon = <Medal size={18} className="mr-2 text-amber-600" />;
    rankClass = "text-amber-600 font-bold";
  } else {
    icon = <Hexagon size={18} className="mr-2 text-blue-400" />;
    rankClass = "text-blue-400 font-medium";
  }
  
  return (
    <div className="flex items-center">
      {icon}
      <span className={rankClass}>
        #{rank} <span className="ml-1 text-sm text-gray-400">({skill})</span>
      </span>
    </div>
  );
};

const PlayerStats: React.FC<PlayerStatsProps> = ({ onBack, onViewSkillOverTime, onViewPlayerDetails }) => {
  const { playSound } = useSound();
  const { isViewMode, isViewModeLoading, getAllPlayers, getAllMatchPlayers, getFilteredPlayerStats } = useDataSource();
  const { setPlayerStatsFilters } = useStatsFilter();
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<string>('skill');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSkillExplainer, setShowSkillExplainer] = useState<boolean>(false);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);
  const [minGamesRelationship, setMinGamesRelationship] = useState<number>(() => {
    const saved = localStorage.getItem('playerStats_minGames');
    return saved ? parseInt(saved, 10) : 3;
  });
  const [recencyMonths, setRecencyMonths] = useState<number | null>(() => {
    const saved = localStorage.getItem('playerStats_recencyMonths');
    return saved ? parseInt(saved, 10) : null; // null = All Time
  });
  const [recalculateTrueSkill, setRecalculateTrueSkill] = useState<boolean>(() => {
    return localStorage.getItem('playerStats_recalculateTrueSkill') === 'true';
  });
  const [showRelationshipGraph, setShowRelationshipGraph] = useState<boolean>(false);

  // Persist minGamesRelationship to localStorage
  useEffect(() => {
    localStorage.setItem('playerStats_minGames', minGamesRelationship.toString());
  }, [minGamesRelationship]);

  // Persist recencyMonths to localStorage
  useEffect(() => {
    if (recencyMonths === null) {
      localStorage.removeItem('playerStats_recencyMonths');
    } else {
      localStorage.setItem('playerStats_recencyMonths', recencyMonths.toString());
    }
  }, [recencyMonths]);

  // Persist recalculateTrueSkill to localStorage
  useEffect(() => {
    localStorage.setItem('playerStats_recalculateTrueSkill', recalculateTrueSkill.toString());
  }, [recalculateTrueSkill]);

  // Calculate date range based on recencyMonths
  const dateRange = useMemo(() => {
    if (recencyMonths === null) {
      return { startDate: undefined, endDate: undefined };
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - recencyMonths);
    return { startDate, endDate };
  }, [recencyMonths]);

  // Sync filters to context for child components (SkillOverTime)
  useEffect(() => {
    setPlayerStatsFilters({
      recencyMonths,
      minGamesRelationship,
      recalculateTrueSkill,
      dateRange
    });
  }, [recencyMonths, minGamesRelationship, recalculateTrueSkill, dateRange, setPlayerStatsFilters]);

  // Load player data on component mount and when filters change
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      try {
        let playersWithStats: PlayerWithStats[];

        if (dateRange.startDate && dateRange.endDate) {
          // Use filtered player stats when date range is active (view mode aware)
          const filteredResult = await getFilteredPlayerStats(
            dateRange.startDate,
            dateRange.endDate,
            recalculateTrueSkill
          );

          playersWithStats = filteredResult.players.map(stats => ({
            id: stats.id,
            name: stats.name,
            totalGames: stats.gamesPlayed,
            wins: stats.wins,
            losses: stats.losses,
            mu: 0, // Not used in display
            sigma: 0, // Not used in display
            elo: 0, // Not used in display
            lastPlayed: stats.lastPlayed || new Date(),
            dateCreated: new Date(), // Not used in filtered display
            favoriteHeroes: stats.favoriteHeroes,
            favoriteRoles: stats.favoriteRoles,
            winRate: stats.winRate,
            kills: stats.kills,
            deaths: stats.deaths,
            assists: stats.assists,
            kdRatio: stats.kdRatio,
            averageGold: stats.averageGold,
            averageMinionKills: stats.averageMinionKills,
            hasCombatStats: stats.hasCombatStats,
            displayRating: stats.displayRating,
            rank: 0
          }));
        } else {
          // Use original logic for all-time stats
          // In view mode, use shared data via hook; otherwise use dbService
          const allPlayers = await getAllPlayers();
          const allMatchPlayers = await getAllMatchPlayers();

          // Get fresh TrueSkill ratings for consistency with SkillOverTime
          // (not available in view mode, so use stored values)
          const currentRatings = isViewMode ? {} : await dbService.getCurrentTrueSkillRatings();

          playersWithStats = await Promise.all(
            allPlayers.map(async (player) => {
              // In view mode, calculate stats from shared match players data
              const playerMatches = allMatchPlayers.filter(mp => mp.playerId === player.id || mp.playerId === player.name);

              // Calculate hero and role stats from match players
              const heroCount: Record<number, { heroId: number; heroName: string; count: number }> = {};
              const roleCount: Record<string, number> = {};

              let kills = 0, deaths = 0, assists = 0, gold = 0, minionKills = 0;

              playerMatches.forEach(mp => {
                kills += mp.kills || 0;
                deaths += mp.deaths || 0;
                assists += mp.assists || 0;
                gold += mp.goldEarned || 0;
                minionKills += mp.minionKills || 0;

                // Track hero usage
                if (!heroCount[mp.heroId]) {
                  heroCount[mp.heroId] = { heroId: mp.heroId, heroName: mp.heroName, count: 0 };
                }
                heroCount[mp.heroId].count++;

                // Track role usage
                (mp.heroRoles || []).forEach(role => {
                  roleCount[role] = (roleCount[role] || 0) + 1;
                });
              });

              const favoriteHeroes = Object.values(heroCount)
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

              const favoriteRoles = Object.entries(roleCount)
                .map(([role, count]) => ({ role, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

              const kdRatio = deaths === 0 ? kills : kills / deaths;
              const winRate = player.totalGames > 0 ? (player.wins / player.totalGames) * 100 : 0;
              const hasCombatStats = kills > 0 || deaths > 0 || assists > 0 || gold > 0;

              // Use fresh TrueSkill rating calculation (consistent with SkillOverTime)
              const displayRating = currentRatings[player.id] || getDisplayRating(player);

              return {
                ...player,
                favoriteHeroes,
                favoriteRoles,
                winRate,
                kills,
                deaths,
                assists,
                kdRatio: parseFloat(kdRatio.toFixed(2)),
                averageGold: player.totalGames > 0 ? Math.round(gold / player.totalGames) : 0,
                averageMinionKills: player.totalGames > 0 ? Math.round(minionKills / player.totalGames) : 0,
                hasCombatStats,
                displayRating,
                rank: 0
              };
            })
          );
        }

        const playersWithMatches = playersWithStats.filter(player => player.totalGames > 0);

        const sortedByRating = [...playersWithMatches].sort((a, b) => b.displayRating - a.displayRating);

        let currentRank = 1;
        let currentRating = sortedByRating.length > 0 ? sortedByRating[0].displayRating : 0;
        let tieCount = 0;

        const playersWithRanks = sortedByRating.map((player, index) => {
          if (player.displayRating !== currentRating) {
            currentRank = index + 1;
            currentRating = player.displayRating;
            tieCount = 0;
          } else {
            tieCount++;
          }

          return {
            ...player,
            rank: currentRank
          };
        });

        setPlayers(playersWithRanks);
      } catch (error) {
        console.error('Error loading player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    // Don't load data while view mode is still being determined
    if (isViewModeLoading) return;
    loadPlayers();
  }, [isViewModeLoading, dateRange.startDate, dateRange.endDate, recalculateTrueSkill, isViewMode, getAllPlayers, getAllMatchPlayers, getFilteredPlayerStats]);
  
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  const handleShowSkillExplainer = () => {
    playSound('buttonClick');
    setShowSkillExplainer(true);
  };
  
  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'skill':
        comparison = a.displayRating - b.displayRating;
        break;
      case 'games':
        comparison = a.totalGames - b.totalGames;
        break;
      case 'winRate':
        comparison = a.winRate - b.winRate;
        break;
      case 'kdRatio':
        comparison = a.kdRatio - b.kdRatio;
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  const handleSort = (field: string) => {
    playSound('buttonClick');
    
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  // Add Screenshot-Specific CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.type = 'text/css';
    
    style.innerHTML = `
      .taking-screenshot {
        background-color: #1F2937 !important;
        padding: 2rem !important;
        width: 1400px !important;
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
      
      .taking-screenshot .no-screenshot {
        display: none !important;
      }
      
      .taking-screenshot .grid {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 2rem !important;
      }
      
      .taking-screenshot .bg-gray-700 {
        padding: 1.5rem !important;
      }
      
      .taking-screenshot h3.text-xl.font-bold {
        white-space: normal !important;
        max-width: 100% !important;
        overflow: visible !important; 
        padding-left: 0.5rem !important;
        padding-right: 0.5rem !important;
      }
      
      .taking-screenshot .px-5.py-4.bg-gray-800 {
        padding: 1.25rem !important;
        display: flex !important;
        justify-content: space-between !important;
        flex-wrap: wrap !important;
      }
      
      .taking-screenshot .text-sm,
      .taking-screenshot .text-xs {
        overflow: visible !important;
        white-space: normal !important;
      }
      
      .taking-screenshot .flex-wrap {
        margin-bottom: 0.5rem !important;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Show relationship graph if toggled
  if (showRelationshipGraph) {
    return (
      <PlayerRelationshipGraph
        onBack={() => setShowRelationshipGraph(false)}
        inheritedDateRange={dateRange.startDate ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined}
        recalculateTrueSkill={recalculateTrueSkill}
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
        <h2 className="text-2xl font-bold text-center sm:text-left">Player Statistics</h2>
        
        {/* Mobile-optimized button group */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <EnhancedTooltip text="View skill rating progression over time" position="left">
            <button
              onClick={() => {
                playSound('buttonClick');
                onViewSkillOverTime();
              }}
              className="flex items-center justify-center px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg w-full sm:w-auto"
            >
              <TrendingUp size={18} className="mr-2" />
              <span className="whitespace-nowrap">View Over Time</span>
            </button>
          </EnhancedTooltip>

          <EnhancedTooltip text="View player relationship network graph" position="left">
            <button
              onClick={() => {
                playSound('buttonClick');
                setShowRelationshipGraph(true);
              }}
              className="flex items-center justify-center px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg w-full sm:w-auto"
            >
              <Network size={18} className="mr-2" />
              <span className="whitespace-nowrap">Relationships</span>
            </button>
          </EnhancedTooltip>

        </div>
      </div>
      
      <div className="bg-gray-700 rounded-lg p-4 mb-6 no-screenshot">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search players..."
              className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSort('skill')}
              className={`px-3 py-1 rounded text-sm ${
                sortBy === 'skill' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Skill {sortBy === 'skill' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('games')}
              className={`px-3 py-1 rounded text-sm ${
                sortBy === 'games' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Games {sortBy === 'games' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('winRate')}
              className={`px-3 py-1 rounded text-sm ${
                sortBy === 'winRate' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              Win% {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('kdRatio')}
              className={`px-3 py-1 rounded text-sm ${
                sortBy === 'kdRatio' 
                  ? 'bg-blue-600 hover:bg-blue-500' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              KD {sortBy === 'kdRatio' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-1 rounded text-sm ${
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
              onClick={() => {
                playSound('buttonClick');
                setShowFilterMenu(!showFilterMenu);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg flex items-center"
            >
              <Filter size={18} className="mr-2" />
              <span>Filters</span>
              {(minGamesRelationship !== 3 || recencyMonths !== null) && (
                <span className="ml-2 bg-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {(minGamesRelationship !== 3 ? 1 : 0) + (recencyMonths !== null ? 1 : 0)}
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
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Time Period</label>
                  <div className="space-y-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="playerTimePeriod"
                        checked={recencyMonths === null}
                        onChange={() => setRecencyMonths(null)}
                        className="mr-2 accent-blue-500"
                      />
                      <span className="text-sm">All Time</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="playerTimePeriod"
                        checked={recencyMonths !== null}
                        onChange={() => setRecencyMonths(recencyMonths || 6)}
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
                        disabled={recencyMonths === null}
                        className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm ml-2">months</span>
                    </label>
                  </div>
                </div>

                {/* TrueSkill Recalculation Checkbox - only visible when period is selected */}
                {recencyMonths !== null && (
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recalculateTrueSkill}
                        onChange={(e) => setRecalculateTrueSkill(e.target.checked)}
                        className="mr-2 mt-0.5 accent-blue-500"
                      />
                      <div>
                        <span className="text-sm">Recalculate skill for period only</span>
                        <p className="text-xs text-gray-500 mt-1">
                          When checked, skill ratings are calculated using only matches in the selected period.
                          Otherwise, current cumulative ratings are shown.
                        </p>
                      </div>
                    </label>
                  </div>
                )}

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
                    For BFF/Nemesis calculations in player details
                  </p>
                </div>

                {/* Reset Filters Button */}
                <button
                  onClick={() => {
                    playSound('buttonClick');
                    setMinGamesRelationship(3);
                    setRecencyMonths(null);
                    setRecalculateTrueSkill(false);
                    setShowFilterMenu(false);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {searchTerm !== '' && (
        <div className="mb-4 p-4 bg-gray-700 rounded-lg screenshot-info">
          <h3 className="font-semibold mb-2">Search Results:</h3>
          <p className="text-sm">Showing players matching: "{searchTerm}"</p>
        </div>
      )}

      {/* Date Range Banner - shown when recency filter is active */}
      {recencyMonths !== null && dateRange.startDate && dateRange.endDate && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center flex-wrap gap-2">
          <Calendar size={18} className="text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-200">
            Showing stats from{' '}
            <span className="font-medium">{dateRange.startDate.toLocaleDateString()}</span>
            {' '}to{' '}
            <span className="font-medium">{dateRange.endDate.toLocaleDateString()}</span>
            {' '}({recencyMonths} month{recencyMonths !== 1 ? 's' : ''})
          </span>
          {recalculateTrueSkill && (
            <span className="text-xs bg-purple-600/50 text-purple-200 px-2 py-0.5 rounded">
              Skill recalculated for period
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div>
          {sortedPlayers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedPlayers.map((player) => {
                return (
                  <div key={player.id} className="bg-gray-700 rounded-lg overflow-hidden shadow-md relative">
                    <div className="px-5 py-4 bg-gray-800 flex justify-between items-center relative">
                      <h3 className={`text-xl font-bold truncate ${player.rank <= 3 ? 'ml-10' : ''}`}>
                        {player.name}
                      </h3>
                      <div className="flex items-center">
                        <div>
                          <RankDisplay rank={player.rank} skill={player.displayRating} />
                        </div>
                      </div>
                    </div>
                    
                    {player.rank <= 3 && (
                      <div className={`absolute top-0 left-0 w-0 h-0 z-10
                        border-t-[50px] border-r-[50px] 
                        ${player.rank === 1 
                          ? 'border-t-yellow-500 border-r-transparent' 
                          : player.rank === 2 
                            ? 'border-t-gray-400 border-r-transparent' 
                            : 'border-t-amber-600 border-r-transparent'}`}>
                        <span className="absolute top-[-45px] left-[5px] font-bold text-black">
                          {player.rank}
                        </span>
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm text-gray-400">Win Rate</div>
                          <div className="font-medium">{player.winRate.toFixed(1)}%</div>
                        </div>
                        <div className="h-2 bg-red-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500" 
                            style={{ width: `${player.winRate}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                          <span>Wins: {player.wins}</span>
                          <span>Losses: {player.losses}</span>
                          <span>Total: {player.totalGames}</span>
                        </div>
                      </div>
                      
                      {player.hasCombatStats && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-blue-400 text-sm mb-1">
                              <Swords size={14} className="mr-1" />
                              <span>K/D/A</span>
                            </div>
                            <div className="font-medium text-center">
                              {player.kills}/{player.deaths}/{player.assists}
                            </div>
                          </div>
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-yellow-400 text-sm mb-1">
                              <TrendingUp size={14} className="mr-1" />
                              <span>KD Ratio</span>
                            </div>
                            <div className="font-medium text-center">{player.kdRatio}</div>
                          </div>
                          <div className="bg-gray-800 p-2 rounded">
                            <div className="flex items-center text-green-400 text-sm mb-1">
                              <Users size={14} className="mr-1" />
                              <span>Avg Gold</span>
                            </div>
                            <div className="font-medium text-center">{player.averageGold}</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <div className="text-sm text-gray-400 mb-2">Favorite Heroes</div>
                        {player.favoriteHeroes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {player.favoriteHeroes.map((hero) => (
                              <div 
                                key={hero.heroId} 
                                className="bg-gray-800 px-3 py-1 rounded-full text-sm"
                              >
                                {hero.heroName} ({hero.count})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No heroes played</div>
                        )}
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Favorite Roles</div>
                        {player.favoriteRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {player.favoriteRoles.map((role) => (
                              <div 
                                key={role.role} 
                                className="bg-gray-800 px-3 py-1 rounded-full text-sm"
                              >
                                {role.role} ({role.count})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No roles data</div>
                        )}
                      </div>
                      
                      {/* View Details Button */}
                      <button
                        onClick={() => {
                          playSound('buttonClick');
                          onViewPlayerDetails(player.id);
                        }}
                        className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 
                                   rounded-lg flex items-center justify-center transition-colors"
                      >
                        <User size={18} className="mr-2" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users size={48} className="text-gray-500 mb-4" />
              <p className="text-xl text-gray-400">
                {searchTerm ? 'No players found matching your search' : 'No player data available'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg no-screenshot"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg text-sm text-gray-300">
        <h4 className="font-medium mb-2 flex items-center justify-between">
          <span className="flex items-center">
            <Info size={16} className="mr-2 text-blue-400" />
            About Player Rankings
          </span>
          <button
            onClick={handleShowSkillExplainer}
            className="text-blue-400 hover:text-blue-300 flex items-center no-screenshot"
          >
            <HelpCircle size={16} className="mr-1" />
            <span>Learn More</span>
          </button>
        </h4>
        <p>
          Players are ranked based on their skill rating, which reflects their performance against other players using the TrueSkill rating system. 
          It takes roughly 20 matches for ratings to stabilise. Rankings are calculated based on match wins and losses, 
          with players winning more points if their team beat higher ranked teams, and losing more points if they lose to lower ranked teams. 
        </p>
      </div>
      
      {/* Skill Explainer Modal */}
      <SkillExplainerModal 
        isOpen={showSkillExplainer} 
        onClose={() => setShowSkillExplainer(false)} 
      />
    </div>
  );
};

export default PlayerStats;