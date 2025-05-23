// src/components/DraftingSystem.tsx with sound implementation
import React, { useState, useRef } from 'react';
import { Hero, Player, Team, DraftMode, DraftingState } from '../types';
import { X, User, Play, RotateCcw, RefreshCw, ArrowLeft } from 'lucide-react';
import HeroRoleExplanation from './HeroRoleExplanation';
import { useDevice } from '../hooks/useDevice';
import EnhancedTooltip from './common/EnhancedTooltip';
import HeroInfoDisplay from './common/HeroInfoDisplay';
import { useSound } from '../context/SoundContext';

interface DraftingSystemProps {
  players: Player[];
  availableHeroes: Hero[];
  draftingState: DraftingState;
  onHeroSelect: (hero: Hero, playerId: number) => void;
  onHeroBan: (hero: Hero) => void;
  onFinishDrafting: () => void;
  onCancelDrafting: () => void;
  onUndoLastAction: () => void;
  onResetDraft: () => void;
  onBackToDraftSelection: () => void;
  canUndo: boolean;
}

const DraftingSystem: React.FC<DraftingSystemProps> = ({
  players,
  draftingState,
  onHeroSelect,
  onHeroBan,
  onFinishDrafting,
  onCancelDrafting,
  onUndoLastAction,
  onResetDraft,
  onBackToDraftSelection,
  canUndo
}) => {
  const { isMobile } = useDevice();
  const { playSound } = useSound();
  const [hoveredHero, setHoveredHero] = useState<Hero | null>(null);
  const [heroInfoVisible, setHeroInfoVisible] = useState<boolean>(false);
  // State to track card position
  const [hoveredCardPosition, setHoveredCardPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>(undefined);
  
  // Refs for scrollable containers
  const titansDraftRef = useRef<HTMLDivElement>(null);
  const atlanteansDraftRef = useRef<HTMLDivElement>(null);
  
  // Get players who haven't selected a hero yet for the current team
  const pendingCurrentTeamPlayers = players.filter(player => 
    player.team === draftingState.currentTeam && 
    !draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
  );
  
  // Check if ALL players from BOTH teams have selected heroes
  const allPlayersHaveSelectedHeroes = players.every(player =>
    draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
  );
  
  // Get team name
  const getTeamName = (team: Team) => {
    return team === Team.Titans ? 'Titans' : 'Atlanteans';
  };
  
  // Get current phase label for Pick and Ban
  const getCurrentPickBanLabel = () => {
    if (draftingState.mode !== DraftMode.PickAndBan) {
      return 'Invalid Mode';
    }

    if (draftingState.currentStep >= draftingState.pickBanSequence.length) {
       const allPlayersHaveSelectedHeroes = players.every(player =>
          draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
       );
       if (allPlayersHaveSelectedHeroes) {
          return 'Draft Complete';
       }
       return 'Drafting Paused/Error';
    }

    const step = draftingState.pickBanSequence[draftingState.currentStep];
    const teamLabel = getTeamName(draftingState.currentTeam);
    const actionLabel = step.action === 'ban' ? 'Ban' : 'Pick';

    return `${teamLabel} ${actionLabel} - Round ${step.round}`;
  };
  
  // Helper function to sort heroes by complexity and then alphabetically
  const sortHeroes = (heroes: Hero[]): Hero[] => {
    return [...heroes].sort((a, b) => {
      if (a.complexity !== b.complexity) {
        return a.complexity - b.complexity;
      }
      return a.name.localeCompare(b.name);
    });
  };
  
  // Button click handlers with sound

  const handleHeroSelect = (hero: Hero, playerId: number) => {
    playSound('heroSelect');
    onHeroSelect(hero, playerId);
  };
  
  const handleHeroBan = (hero: Hero) => {
    playSound('heroBan');
    onHeroBan(hero);
  };
  
  const handleFinishDrafting = () => {
    playSound('phaseChange');
    onFinishDrafting();
  };
  
  const handleCancelDrafting = () => {
    playSound('buttonClick');
    onCancelDrafting();
  };
  
  const handleUndoLastAction = () => {
    if (canUndo) {
      playSound('buttonClick');
      onUndoLastAction();
    }
  };
  
  const handleResetDraft = () => {
    playSound('buttonClick');
    onResetDraft();
  };
  
  const handleBackToDraftSelection = () => {
    playSound('buttonClick');
    onBackToDraftSelection();
  };
  
  // Show hero info on mobile
  const handleHeroInfoClick = (hero: Hero) => {
    if (isMobile && !allPlayersHaveSelectedHeroes) {
      playSound('buttonClick');
      setHoveredHero(hero);
      setHeroInfoVisible(true);
    }
  };
  
  // Hide hero info on mobile
  const handleCloseHeroInfo = () => {
    playSound('buttonClick');
    setHeroInfoVisible(false);
  };
  
  // Desktop hover handlers - Updated to capture position
  const handleHeroMouseEnter = (hero: Hero, event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) {
      setHoveredHero(hero);
      
      // Capture the hero card's position
      const cardElement = event.currentTarget;
      const rect = cardElement.getBoundingClientRect();
      setHoveredCardPosition({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }
  };
  
  const handleHeroMouseLeave = () => {
    if (!isMobile) {
      setHoveredHero(null);
      setHoveredCardPosition(undefined);
    }
  };
  
  // Render standard hero card with appropriate actions
  const renderHeroCard = (hero: Hero, context: 'available' | 'assigned' | 'selected' | 'banned', playerId?: number) => {
    const isAvailable = context === 'available';
    const isAssigned = context === 'assigned';
    const isSelected = context === 'selected';
    const isBanned = context === 'banned';
    
    // Get pending players for the current team
    const pendingPlayers = players.filter(player => 
      player.team === draftingState.currentTeam && 
      !draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
    );
    
    // Determine if this card should be grayed out (all players have heroes)
    const isGrayedOut = allPlayersHaveSelectedHeroes && (isAvailable || isAssigned);
    
    // Get player name if this is a selected hero
    const playerName = playerId ? 
      players.find(p => p.id === playerId)?.name || `Player ${playerId}` : '';
    
    // Get player team if this is a selected hero
    const playerTeam = playerId ?
      players.find(p => p.id === playerId)?.team : undefined;
    
    // Common card styling for all hero types - now larger
    const cardClasses = `
      relative p-5 rounded-lg transition-all
      ${isGrayedOut ? 'opacity-40 pointer-events-none' : ''}
      ${isAvailable ? 'bg-gray-800 hover:bg-gray-700' : ''}
      ${isAssigned ? 'bg-amber-900/30 hover:bg-amber-800/40' : ''}
      ${isSelected ? (playerTeam === Team.Titans ? 'bg-blue-900/30' : 'bg-red-900/30') : ''}
      ${isBanned ? 'bg-red-900/30 opacity-70' : ''}
    `;
    
    return (
      <div 
        key={`${hero.id}-${context}-${playerId || 0}`}
        className={cardClasses}
        onClick={() => handleHeroInfoClick(hero)}
        onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
        onMouseLeave={handleHeroMouseLeave}
      >
        {/* For banned heroes, add a centered X overlay */}
        {isBanned && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute w-3/4 h-0.5 bg-red-500 transform rotate-45"></div>
              <div className="absolute w-3/4 h-0.5 bg-red-500 transform -rotate-45"></div>
            </div>
          </div>
        )}
        
        <div className="text-center mb-3">
          {/* Larger hero icon */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-300 rounded-full mx-auto overflow-hidden">
            <img 
              src={hero.icon} 
              alt={hero.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/112?text=Hero';
              }}
            />
          </div>
          {/* Larger hero name */}
          <div className="mt-3 font-medium text-xl">{hero.name}</div>
          
          {/* Player name for selected heroes */}
          {isSelected && playerName && (
            <div className="mt-1 text-sm text-gray-300">
              {playerName}
            </div>
          )}
        </div>
        
        {/* Complexity stars */}
        <div className="flex justify-center mb-2">
          {[...Array(hero.complexity)].map((_, i) => (
            <span key={i} className="text-yellow-400 text-lg sm:text-xl">★</span>
          ))}
          {[...Array(4 - hero.complexity)].map((_, i) => (
            <span key={i + hero.complexity} className="text-gray-600 text-lg sm:text-xl">★</span>
          ))}
        </div>
        
        {/* Roles */}
        <div className="text-sm sm:text-base text-center text-gray-300 mb-3">
          {hero.roles.join(', ')}
        </div>
        
        {/* Actions for Pick and Ban mode */}
        {isAvailable && draftingState.mode === DraftMode.PickAndBan && (
          <div className="mt-3 grid grid-cols-1 gap-2" onClick={(e) => e.stopPropagation()}>
            {draftingState.pickBanSequence[draftingState.currentStep]?.action === 'ban' && (
              <button
                className="w-full px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHeroBan(hero);
                }}
              >
                Ban Hero
              </button>
            )}
            
            {/* For pick action, show a button for each pending player */}
            {draftingState.pickBanSequence[draftingState.currentStep]?.action === 'pick' && pendingPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {pendingPlayers.map(player => (
                  <button
                    key={player.id}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHeroSelect(hero, player.id);
                    }}
                  >
                    <span className="mr-1">Pick for</span>
                    <span className="font-bold">{player.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Actions for All Pick mode */}
        {isAvailable && draftingState.mode === DraftMode.AllPick && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            {pendingPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {pendingPlayers.map(player => (
                  <button
                    key={player.id}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHeroSelect(hero, player.id);
                    }}
                  >
                    <span className="mr-1">Pick for</span>
                    <span className="font-bold">{player.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Actions for Random Draft mode */}
        {isAvailable && draftingState.mode === DraftMode.Random && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            {pendingPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {pendingPlayers.map(player => (
                  <button
                    key={player.id}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHeroSelect(hero, player.id);
                    }}
                  >
                    <span className="mr-1">Pick for</span>
                    <span className="font-bold">{player.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Actions for Single Draft mode */}
        {isAssigned && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <button
              className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                const playerId = draftingState.assignedHeroes.find(assigned => 
                  assigned.heroOptions.some(h => h.id === hero.id)
                )?.playerId;
                
                if (playerId) {
                  handleHeroSelect(hero, playerId);
                }
              }}
            >
              Select Hero
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // Render All Pick Draft UI
  const renderAllPickUI = () => {
    // Sort heroes by complexity and then alphabetically
    const sortedHeroes = sortHeroes(draftingState.availableHeroes);
    
    return (
      <div>
        <h3 className="text-xl font-bold mb-4">All Pick</h3>
        
        <div className="mb-6">
          {allPlayersHaveSelectedHeroes ? (
            <div className="p-3 rounded-lg bg-green-900/50 border-2 border-green-400">
              <h4 className="text-lg font-semibold mb-2">
                Start Game
              </h4>
              <div className="text-md mb-3">
                All players have selected heroes. Click Start Game.
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-lg ${
              draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50 border-2 border-blue-400' : 'bg-red-900/50 border-2 border-red-400'
            }`}>
              <h4 className="text-lg font-semibold mb-2">
                {getTeamName(draftingState.currentTeam)} Turn
              </h4>
              
              {pendingCurrentTeamPlayers.length > 0 ? (
                <div className="text-md mb-3">
                  Select any hero for: {pendingCurrentTeamPlayers.map(player => player.name).join(', ')}
                </div>
              ) : (
                <div className="text-md mb-3">
                  All {getTeamName(draftingState.currentTeam)} players have selected heroes
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Filter available heroes by search or ability */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedHeroes.map(hero => 
            renderHeroCard(hero, 'available')
          )}
        </div>
      </div>
    );
  };
  
  // Render Single Draft UI
  const renderSingleDraftUI = () => {
    return (
      <div>
        <h3 className="text-xl font-bold mb-4">Single Draft</h3>
        
        <div className="mb-6">
          {allPlayersHaveSelectedHeroes ? (
            <div className="p-3 rounded-lg bg-green-900/50 border-2 border-green-400">
              <h4 className="text-lg font-semibold mb-2">
                Start Game
              </h4>
              <div className="text-md mb-3">
                All players have selected heroes. Click Start Game.
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-lg ${
              draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50 border-2 border-blue-400' : 'bg-red-900/50 border-2 border-red-400'
            }`}>
              <h4 className="text-lg font-semibold mb-2">
                {getTeamName(draftingState.currentTeam)} Turn
              </h4>
              
              {pendingCurrentTeamPlayers.length > 0 ? (
                <div className="text-md mb-3">
                  Any {getTeamName(draftingState.currentTeam)} player can select a hero from their options
                </div>
              ) : (
                <div className="text-md mb-3">
                  All {getTeamName(draftingState.currentTeam)} players have selected heroes
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Titans Section */}
        <div className="mb-6">
          <h4 className="text-lg font-medium mb-3 bg-blue-900/50 p-2 rounded flex items-center">
            <div className="bg-blue-700 rounded-full p-1 mr-2">
              <User size={16} />
            </div>
            Titans Team
          </h4>
          
          <div 
            ref={titansDraftRef}
            className="max-h-96 overflow-y-auto pr-2 space-y-4 custom-scrollbar"
          >
            {draftingState.assignedHeroes
              .filter(assignment => {
                const player = players.find(p => p.id === assignment.playerId);
                return player && player.team === Team.Titans;
              })
              .map(assignment => {
                const player = players.find(p => p.id === assignment.playerId);
                if (!player) return null;
                
                // Check if player has already selected
                const hasSelected = draftingState.selectedHeroes.some(s => s.playerId === player.id);
                
                // Sort this player's hero options
                const sortedHeroOptions = sortHeroes(assignment.heroOptions);
                
                return (
                  <div key={player.id} className={`bg-gray-800 p-4 rounded-lg ${hasSelected ? 'opacity-60' : ''}`}>
                    <h5 className="text-lg font-medium mb-3 flex items-center">
                      {player.name}
                      {hasSelected && (
                        <span className="ml-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                          Selected
                        </span>
                      )}
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sortedHeroOptions.map(hero => (
                        <div
                          key={hero.id}
                          className={`relative p-4 rounded-lg ${
                            allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                            draftingState.currentTeam === Team.Titans && !hasSelected 
                              ? 'bg-blue-900/30 hover:bg-blue-800/40 cursor-pointer' 
                              : 'bg-gray-800'
                          }`}
                          onClick={(e) => {
                            if (draftingState.currentTeam === Team.Titans && !hasSelected && !allPlayersHaveSelectedHeroes) {
                              e.stopPropagation();
                              handleHeroSelect(hero, player.id);
                            } else {
                              handleHeroInfoClick(hero);
                            }
                          }}
                          onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
                          onMouseLeave={handleHeroMouseLeave}
                        >
                          <div className="text-center mb-3">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
                              <img 
                                src={hero.icon} 
                                alt={hero.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://via.placeholder.com/96?text=Hero';
                                }}
                              />
                            </div>
                            <div className="mt-2 font-medium text-lg">{hero.name}</div>
                          </div>
                          
                          {/* Complexity stars */}
                          <div className="flex justify-center mb-2">
                            {[...Array(hero.complexity)].map((_, i) => (
                              <span key={i} className="text-yellow-400 text-base sm:text-lg">★</span>
                            ))}
                            {[...Array(4 - hero.complexity)].map((_, i) => (
                              <span key={i + hero.complexity} className="text-gray-600 text-base sm:text-lg">★</span>
                            ))}
                          </div>
                          
                          {/* Roles */}
                          <div className="text-xs sm:text-sm text-center text-gray-300 mb-2">
                            {hero.roles.join(', ')}
                          </div>
                          
                          {/* Select button when it's this team's turn */}
                          {draftingState.currentTeam === Team.Titans && !hasSelected && !allPlayersHaveSelectedHeroes && (
                            <button
                              className="w-full mt-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHeroSelect(hero, player.id);
                              }}
                            >
                              Select This Hero
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        
        {/* Atlanteans Section */}
        <div>
          <h4 className="text-lg font-medium mb-3 bg-red-900/50 p-2 rounded flex items-center">
            <div className="bg-red-700 rounded-full p-1 mr-2">
              <User size={16} />
            </div>
            Atlanteans Team
          </h4>
          
          <div 
            ref={atlanteansDraftRef}
            className="max-h-96 overflow-y-auto pr-2 space-y-4 custom-scrollbar"
          >
            {draftingState.assignedHeroes
              .filter(assignment => {
                const player = players.find(p => p.id === assignment.playerId);
                return player && player.team === Team.Atlanteans;
              })
              .map(assignment => {
                const player = players.find(p => p.id === assignment.playerId);
                if (!player) return null;
                
                // Check if player has already selected
                const hasSelected = draftingState.selectedHeroes.some(s => s.playerId === player.id);
                
                // Sort this player's hero options
                const sortedHeroOptions = sortHeroes(assignment.heroOptions);
                
                return (
                  <div key={player.id} className={`bg-gray-800 p-4 rounded-lg ${hasSelected ? 'opacity-60' : ''}`}>
                    <h5 className="text-lg font-medium mb-3 flex items-center">
                      {player.name}
                      {hasSelected && (
                        <span className="ml-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                          Selected
                        </span>
                      )}
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {sortedHeroOptions.map(hero => (
                        <div
                          key={hero.id}
                          className={`relative p-4 rounded-lg ${
                            allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                            draftingState.currentTeam === Team.Atlanteans && !hasSelected 
                              ? 'bg-red-900/30 hover:bg-red-800/40 cursor-pointer' 
                              : 'bg-gray-800'
                          }`}
                          onClick={(e) => {
                            if (draftingState.currentTeam === Team.Atlanteans && !hasSelected && !allPlayersHaveSelectedHeroes) {
                              e.stopPropagation();
                              handleHeroSelect(hero, player.id);
                            } else {
                              handleHeroInfoClick(hero);
                            }
                          }}
                          onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
                          onMouseLeave={handleHeroMouseLeave}
                        >
                          <div className="text-center mb-3">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
                              <img 
                                src={hero.icon} 
                                alt={hero.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://via.placeholder.com/96?text=Hero';
                                }}
                              />
                            </div>
                            <div className="mt-2 font-medium text-lg">{hero.name}</div>
                          </div>
                          
                          {/* Complexity stars */}
                          <div className="flex justify-center mb-2">
                            {[...Array(hero.complexity)].map((_, i) => (
                              <span key={i} className="text-yellow-400 text-base sm:text-lg">★</span>
                            ))}
                            {[...Array(4 - hero.complexity)].map((_, i) => (
                              <span key={i + hero.complexity} className="text-gray-600 text-base sm:text-lg">★</span>
                            ))}
                          </div>
                          
                          {/* Roles */}
                          <div className="text-xs sm:text-sm text-center text-gray-300 mb-2">
                            {hero.roles.join(', ')}
                          </div>
                          
                          {/* Select button when it's this team's turn */}
                          {draftingState.currentTeam === Team.Atlanteans && !hasSelected && !allPlayersHaveSelectedHeroes && (
                            <button
                              className="w-full mt-2 px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHeroSelect(hero, player.id);
                              }}
                            >
                              Select This Hero
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };
  
  
  // Render Random Draft UI
  const renderRandomDraftUI = () => {
    // Sort heroes by complexity and then alphabetically
    const sortedHeroes = sortHeroes(draftingState.availableHeroes);
    
    return (
      <div>
        <h3 className="text-xl font-bold mb-4">Random Draft</h3>
        
        <div className="mb-6">
          {allPlayersHaveSelectedHeroes ? (
            <div className="p-3 rounded-lg bg-green-900/50 border-2 border-green-400">
              <h4 className="text-lg font-semibold mb-2">
                Start Game
              </h4>
              <div className="text-md mb-3">
                All players have selected heroes. Click Start Game.
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-lg ${
              draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50 border-2 border-blue-400' : 'bg-red-900/50 border-2 border-red-400'
            }`}>
              <h4 className="text-lg font-semibold mb-2">
                {getTeamName(draftingState.currentTeam)} Turn
              </h4>
              
              {pendingCurrentTeamPlayers.length > 0 ? (
                <div className="text-md mb-3">
                  {pendingCurrentTeamPlayers.map(player => player.name).join(', ')} need to select a hero
                </div>
              ) : (
                <div className="text-md mb-3">
                  All {getTeamName(draftingState.currentTeam)} players have selected heroes
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedHeroes.map(hero => (
            <div 
              key={hero.id} 
              className={`relative p-4 rounded-lg transition-all ${
                allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                draftingState.currentTeam === Team.Titans 
                  ? 'bg-blue-900/30 hover:bg-blue-800/40' 
                  : 'bg-red-900/30 hover:bg-red-800/40'
              }`}
              onClick={() => handleHeroInfoClick(hero)}
              onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
              onMouseLeave={handleHeroMouseLeave}
            >
              <div className="text-center mb-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
                  <img 
                    src={hero.icon} 
                    alt={hero.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/96?text=Hero';
                    }}
                  />
                </div>
                <div className="mt-2 font-medium text-lg">{hero.name}</div>
              </div>
              
              {/* Complexity stars */}
              <div className="flex justify-center mb-2">
                {[...Array(hero.complexity)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-base sm:text-lg">★</span>
                ))}
                {[...Array(4 - hero.complexity)].map((_, i) => (
                  <span key={i + hero.complexity} className="text-gray-600 text-base sm:text-lg">★</span>
                ))}
              </div>
              
              {/* Roles */}
              <div className="text-xs sm:text-sm text-center text-gray-300 mb-3">
                {hero.roles.join(', ')}
              </div>
              
              {pendingCurrentTeamPlayers.length > 0 && !allPlayersHaveSelectedHeroes && (
                <div className="grid grid-cols-1 gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                  {pendingCurrentTeamPlayers.map(player => (
                    <button
                      key={player.id}
                      className="w-full px-3 py-2 rounded text-sm bg-green-600 hover:bg-green-500 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHeroSelect(hero, player.id);
                      }}
                    >
                      <span className="mr-1">Pick for</span>
                      <span className="font-bold">{player.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render Pick and Ban UI
  const renderPickAndBanUI = () => {
    if (draftingState.mode !== DraftMode.PickAndBan) return null;
    
    // Sort heroes by complexity and then alphabetically
    const sortedHeroes = sortHeroes(draftingState.availableHeroes);
    const sortedBannedHeroes = sortHeroes(draftingState.bannedHeroes);
    
    // Determine which action we're doing in the current step
    const currentStep = draftingState.currentStep < draftingState.pickBanSequence.length 
      ? draftingState.pickBanSequence[draftingState.currentStep] 
      : null;
      
    if (!currentStep && !allPlayersHaveSelectedHeroes) return <div>Draft complete</div>;
    
    const isPickingPhase = currentStep?.action === 'pick';
    const isBanningPhase = currentStep?.action === 'ban';
    
    return (
      <div>
        <h3 className="text-xl font-bold mb-4">Pick and Ban</h3>
        
        <div className="mb-6">
          {allPlayersHaveSelectedHeroes ? (
            <div className="p-4 rounded-lg bg-green-900/50 border-2 border-green-400">
              <h4 className="text-xl font-semibold mb-2">
                Start Game
              </h4>
              <div className="text-md mb-3">
                All players have selected heroes. Click Start Game.
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-lg ${
              draftingState.currentTeam === Team.Titans 
                ? 'bg-blue-900/50 border-2 border-blue-400' 
                : 'bg-red-900/50 border-2 border-red-400'
            }`}>
              <h4 className="text-xl font-semibold mb-2">
                {getCurrentPickBanLabel()}
              </h4>
              
              <div className="text-md mb-3">
                {isBanningPhase && 'Select a hero to ban from the pool'}
                {isPickingPhase && pendingCurrentTeamPlayers.length > 0 && 
                  `${pendingCurrentTeamPlayers.map(player => player.name).join(', ')} need to pick a hero`
                }
                {isPickingPhase && pendingCurrentTeamPlayers.length === 0 && 
                  'All players on this team have selected heroes'
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Banned heroes section */}
        {sortedBannedHeroes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-medium mb-3 bg-red-900/30 p-2 rounded">Banned Heroes</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedBannedHeroes.map(hero => 
                renderHeroCard(hero, 'banned')
              )}
            </div>
          </div>
        )}
        
        {/* Available heroes grid with team-colored cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedHeroes.map(hero => (
            <div 
              key={hero.id} 
              className={`relative p-4 rounded-lg transition-all ${
                allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                draftingState.currentTeam === Team.Titans
                  ? 'bg-blue-900/30 hover:bg-blue-800/40'
                  : 'bg-red-900/30 hover:bg-red-800/40'
              } cursor-pointer`}
              onClick={() => handleHeroInfoClick(hero)}
              onMouseEnter={(e) => handleHeroMouseEnter(hero, e)}
              onMouseLeave={handleHeroMouseLeave}
            >
              <div className="text-center mb-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
                  <img 
                    src={hero.icon} 
                    alt={hero.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/96?text=Hero';
                    }}
                  />
                </div>
                <div className="mt-2 font-medium text-lg">{hero.name}</div>
              </div>
              
              {/* Complexity stars */}
              <div className="flex justify-center mb-2">
                {[...Array(hero.complexity)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-base sm:text-lg">★</span>
                ))}
                {[...Array(4 - hero.complexity)].map((_, i) => (
                  <span key={i + hero.complexity} className="text-gray-600 text-base sm:text-lg">★</span>
                ))}
              </div>
              
              {/* Roles */}
              <div className="text-xs sm:text-sm text-center text-gray-300 mb-3">
                {hero.roles.join(', ')}
              </div>
              
              {/* Action buttons */}
              {!allPlayersHaveSelectedHeroes && (
                <div className="mt-3 grid grid-cols-1 gap-2" onClick={(e) => e.stopPropagation()}>
                  {isBanningPhase && (
                    <button
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHeroBan(hero);
                      }}
                    >
                      Ban Hero
                    </button>
                  )}
                  
                  {isPickingPhase && pendingCurrentTeamPlayers.length > 0 && (
                    <div className="grid grid-cols-1 gap-1">
                      {pendingCurrentTeamPlayers.map(player => (
                        <button
                          key={player.id}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHeroSelect(hero, player.id);
                          }}
                        >
                          <span className="mr-1">Pick for</span>
                          <span className="font-bold">{player.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render based on drafting mode
  const renderDraftingUI = () => {
    switch (draftingState.mode) {
      case DraftMode.AllPick:
        return renderAllPickUI();
      case DraftMode.Single:
        return renderSingleDraftUI();
      case DraftMode.Random:
        return renderRandomDraftUI();
      case DraftMode.PickAndBan:
        return renderPickAndBanUI();
      default:
        return <div>Invalid drafting mode</div>;
    }
  };
  
  // Selected heroes overview - Updated with standardized card format
  const renderSelectedHeroes = () => {
    if (draftingState.selectedHeroes.length === 0) return null;
    
    // Group selected heroes by team
    const titanHeroes = draftingState.selectedHeroes.filter(selection => 
      players.find(p => p.id === selection.playerId)?.team === Team.Titans
    );
    
    const atlanteanHeroes = draftingState.selectedHeroes.filter(selection => 
      players.find(p => p.id === selection.playerId)?.team === Team.Atlanteans
    );
    
    return (
      <div className="mb-8 bg-gray-800 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Selected Heroes</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Titans section */}
          <div className="bg-blue-900/30 p-4 rounded-lg">
            <h4 className="text-lg font-medium mb-3 border-b border-blue-700 pb-2">Titans</h4>
            
            {titanHeroes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {titanHeroes.map(selection => 
                  renderHeroCard(selection.hero, 'selected', selection.playerId)
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic">No heroes selected yet</p>
            )}
          </div>
          
          {/* Atlanteans section */}
          <div className="bg-red-900/30 p-4 rounded-lg">
            <h4 className="text-lg font-medium mb-3 border-b border-red-700 pb-2">Atlanteans</h4>
            
            {atlanteanHeroes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {atlanteanHeroes.map(selection => 
                  renderHeroCard(selection.hero, 'selected', selection.playerId)
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic">No heroes selected yet</p>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="drafting-system">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <h2 className="text-2xl font-bold mb-3 sm:mb-0">
            {draftingState.mode === DraftMode.AllPick ? 'All Pick' :
             draftingState.mode === DraftMode.Single ? 'Single Draft' : 
             draftingState.mode === DraftMode.Random ? 'Random Draft' : 
             'Pick and Ban Draft'}
          </h2>
          
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Undo button */}
            <EnhancedTooltip text="Undo the last hero selection">
              <button 
                className={`px-3 py-2 ${canUndo ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 opacity-50 cursor-not-allowed'} rounded-lg flex items-center`}
                onClick={handleUndoLastAction}
                disabled={!canUndo}
              >
                <RotateCcw size={16} className="mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">Undo</span>
              </button>
            </EnhancedTooltip>
            
            {/* Reset button */}
            <EnhancedTooltip text="Reset all selections and restart with the same draft mode">
              <button 
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={handleResetDraft}
              >
                <RefreshCw size={16} className="mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">Reset</span>
              </button>
            </EnhancedTooltip>
            
            {/* Back button */}
            <EnhancedTooltip text="Go back to draft mode selection without rerolling tiebreaker">
              <button 
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={handleBackToDraftSelection}
              >
                <ArrowLeft size={16} className="mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">Back</span>
              </button>
            </EnhancedTooltip>
            
            {/* Cancel button */}
            <EnhancedTooltip text="Return to game setup screen">
              <button 
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={handleCancelDrafting}
              >
                <X size={16} className="mr-1 sm:mr-2" /> 
                <span className="hidden sm:inline">Cancel</span>
              </button>
            </EnhancedTooltip>
            
            {(draftingState.isComplete || allPlayersHaveSelectedHeroes) && (
              <EnhancedTooltip text="Finish drafting and start the game">
                <button 
                  className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded-lg flex items-center"
                  onClick={handleFinishDrafting}
                >
                  <Play size={16} className="mr-1 sm:mr-2" /> 
                  <span className="hidden sm:inline">Start Game</span>
                </button>
              </EnhancedTooltip>
            )}
          </div>
        </div>
      </div>
      
      {/* Hero Role Explanation */}
      <HeroRoleExplanation />

      {/* Selected heroes section - Now positioned ABOVE the drafting UI */}
      {draftingState.selectedHeroes.length > 0 && renderSelectedHeroes()}
      
      {/* Main drafting UI - Now positioned BELOW the selected heroes */}
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
        {renderDraftingUI()}
      </div>
      
      {/* Hero info display - will render as a modal on mobile, tooltip on desktop */}
      <HeroInfoDisplay 
        hero={hoveredHero} 
        onClose={handleCloseHeroInfo} 
        isVisible={(isMobile ? heroInfoVisible : !!hoveredHero) && !allPlayersHaveSelectedHeroes} 
        cardPosition={hoveredCardPosition}
      />

      {/* Add custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.5);
        }
        
        /* Add smooth height transitions */
        .transition-height {
          transition: max-height 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default DraftingSystem;