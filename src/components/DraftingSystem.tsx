// src/components/DraftingSystem.tsx
import React, { useState, useRef } from 'react';
import { Hero, Player, Team, DraftMode, DraftingState } from '../types';
import { X, User, Play, RotateCcw, RefreshCw, ArrowLeft } from 'lucide-react';

interface DraftingSystemProps {
  players: Player[];
  availableHeroes: Hero[];
  draftingState: DraftingState;
  onHeroSelect: (hero: Hero, playerId: number) => void;
  onHeroBan: (hero: Hero) => void;
  onFinishDrafting: () => void;
  onCancelDrafting: () => void;
  // New props for navigation
  onUndoLastAction: () => void;
  onResetDraft: () => void;
  onBackToDraftSelection: () => void;
  canUndo: boolean; // Flag to determine if undo is available
}

// Custom tooltip component for consistency
interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300); // Small delay to prevent accidental triggering
  };
  
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onTouchStart={showTooltip}
      onTouchEnd={hideTooltip}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg whitespace-nowrap">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

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
  const [hoveredHero, setHoveredHero] = useState<Hero | null>(null);
  
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
      return 'Invalid Mode'; // Should not happen if this is only called in P&B
    }

    // Check if the draft is complete based on steps
    if (draftingState.currentStep >= draftingState.pickBanSequence.length) {
       // Also check if all players have selected heroes in case sequence finished early
       // (Though with correct sequence length, this should be the same condition)
       const allPlayersHaveSelectedHeroes = players.every(player =>
          draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
       );
       if (allPlayersHaveSelectedHeroes) {
          return 'Draft Complete';
       }
       // Should ideally not reach here if logic is correct, but as a fallback:
       return 'Drafting Paused/Error';
    }

    // Get the current step in the sequence
    const step = draftingState.pickBanSequence[draftingState.currentStep];

    // Get the team name from the current drafting state
    const teamLabel = getTeamName(draftingState.currentTeam);
    const actionLabel = step.action === 'ban' ? 'Ban' : 'Pick';

    return `${teamLabel} ${actionLabel} - Round ${step.round}`;
  };
  
  // Render hero card with appropriate actions
  const renderHeroCard = (hero: Hero, context: 'available' | 'assigned' | 'selected' | 'banned') => {
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
    
    return (
      <div 
        key={hero.id}
        className={`relative p-4 rounded-lg transition-all ${
          isGrayedOut ? 'opacity-40 pointer-events-none' :
          isAvailable ? 'bg-gray-800 hover:bg-gray-700' : 
          isAssigned ? 'bg-amber-900/30 hover:bg-amber-800/40' :
          isSelected ? 'bg-green-900/30' :
          'bg-red-900/30 opacity-50'
        }`}
        onMouseEnter={() => setHoveredHero(hero)}
        onMouseLeave={() => setHoveredHero(null)}
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
          <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
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
            <span key={i} className="text-yellow-400 text-lg">★</span>
          ))}
          {[...Array(4 - hero.complexity)].map((_, i) => (
            <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
          ))}
        </div>
        
        {/* Roles */}
        <div className="text-sm text-center text-gray-300 mb-3">
          {hero.roles.join(', ')}
        </div>
        
        {/* Actions for Pick and Ban mode */}
        {isAvailable && draftingState.mode === DraftMode.PickAndBan && (
          <div className="mt-3 grid grid-cols-1 gap-2">
            {draftingState.pickBanSequence[draftingState.currentStep]?.action === 'ban' && (
              <button
                className="w-full px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm flex items-center justify-center"
                onClick={() => onHeroBan(hero)}
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
                    onClick={() => onHeroSelect(hero, player.id)}
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
          <div className="mt-3">
            {pendingPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {pendingPlayers.map(player => (
                  <button
                    key={player.id}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
                    onClick={() => onHeroSelect(hero, player.id)}
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
          <div className="mt-3">
            {pendingPlayers.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {pendingPlayers.map(player => (
                  <button
                    key={player.id}
                    className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
                    onClick={() => onHeroSelect(hero, player.id)}
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
          <div className="mt-3">
            <button
              className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm flex items-center justify-center"
              onClick={() => {
                const playerId = draftingState.assignedHeroes.find(assigned => 
                  assigned.heroOptions.some(h => h.id === hero.id)
                )?.playerId;
                
                if (playerId) {
                  onHeroSelect(hero, playerId);
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
                {getTeamName(draftingState.currentTeam)}'s Turn
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {draftingState.availableHeroes.map(hero => 
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
                {getTeamName(draftingState.currentTeam)}'s Turn
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {assignment.heroOptions.map(hero => (
                        <div
                          key={hero.id}
                          className={`relative p-4 rounded-lg ${
                            allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                            draftingState.currentTeam === Team.Titans && !hasSelected 
                              ? 'bg-blue-900/30 hover:bg-blue-800/40 cursor-pointer' 
                              : 'bg-gray-800'
                          }`}
                          onClick={() => {
                            if (draftingState.currentTeam === Team.Titans && !hasSelected && !allPlayersHaveSelectedHeroes) {
                              onHeroSelect(hero, player.id);
                            }
                          }}
                          onMouseEnter={() => setHoveredHero(hero)}
                          onMouseLeave={() => setHoveredHero(null)}
                        >
                          <div className="text-center mb-3">
                            <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
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
                              <span key={i} className="text-yellow-400 text-lg">★</span>
                            ))}
                            {[...Array(4 - hero.complexity)].map((_, i) => (
                              <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
                            ))}
                          </div>
                          
                          {/* Roles */}
                          <div className="text-sm text-center text-gray-300 mb-2">
                            {hero.roles.join(', ')}
                          </div>
                          
                          {/* Select button when it's this team's turn */}
                          {draftingState.currentTeam === Team.Titans && !hasSelected && !allPlayersHaveSelectedHeroes && (
                            <button
                              className="w-full mt-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm"
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {assignment.heroOptions.map(hero => (
                        <div
                          key={hero.id}
                          className={`relative p-4 rounded-lg ${
                            allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                            draftingState.currentTeam === Team.Atlanteans && !hasSelected 
                              ? 'bg-red-900/30 hover:bg-red-800/40 cursor-pointer' 
                              : 'bg-gray-800'
                          }`}
                          onClick={() => {
                            if (draftingState.currentTeam === Team.Atlanteans && !hasSelected && !allPlayersHaveSelectedHeroes) {
                              onHeroSelect(hero, player.id);
                            }
                          }}
                          onMouseEnter={() => setHoveredHero(hero)}
                          onMouseLeave={() => setHoveredHero(null)}
                        >
                          <div className="text-center mb-3">
                            <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
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
                              <span key={i} className="text-yellow-400 text-lg">★</span>
                            ))}
                            {[...Array(4 - hero.complexity)].map((_, i) => (
                              <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
                            ))}
                          </div>
                          
                          {/* Roles */}
                          <div className="text-sm text-center text-gray-300 mb-2">
                            {hero.roles.join(', ')}
                          </div>
                          
                          {/* Select button when it's this team's turn */}
                          {draftingState.currentTeam === Team.Atlanteans && !hasSelected && !allPlayersHaveSelectedHeroes && (
                            <button
                              className="w-full mt-2 px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
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
                {getTeamName(draftingState.currentTeam)}'s Turn
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
          {draftingState.availableHeroes.map(hero => (
            <div 
              key={hero.id} 
              className={`relative p-4 rounded-lg transition-all ${
                allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                draftingState.currentTeam === Team.Titans 
                  ? 'bg-blue-900/30 hover:bg-blue-800/40' 
                  : 'bg-red-900/30 hover:bg-red-800/40'
              }`}
              onMouseEnter={() => setHoveredHero(hero)}
              onMouseLeave={() => setHoveredHero(null)}
            >
              <div className="text-center mb-3">
                <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
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
                  <span key={i} className="text-yellow-400 text-lg">★</span>
                ))}
                {[...Array(4 - hero.complexity)].map((_, i) => (
                  <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
                ))}
              </div>
              
              {/* Roles */}
              <div className="text-sm text-center text-gray-300 mb-3">
                {hero.roles.join(', ')}
              </div>
              
              {pendingCurrentTeamPlayers.length > 0 && !allPlayersHaveSelectedHeroes && (
                <div className="grid grid-cols-1 gap-1 mt-2">
                  {pendingCurrentTeamPlayers.map(player => (
                    <button
                      key={player.id}
                      className="w-full px-3 py-2 rounded text-sm bg-green-600 hover:bg-green-500 flex items-center justify-center"
                      onClick={() => onHeroSelect(hero, player.id)}
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
        {draftingState.bannedHeroes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-lg font-medium mb-3">Banned Heroes</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {draftingState.bannedHeroes.map(hero => (
                <div 
                  key={hero.id} 
                  className="relative p-3 rounded-lg bg-gray-800 opacity-50"
                >
                  {/* Improved X overlay for banned heroes */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div className="absolute w-3/4 h-0.5 bg-red-500 transform rotate-45"></div>
                      <div className="absolute w-3/4 h-0.5 bg-red-500 transform -rotate-45"></div>
                    </div>
                  </div>
                  
                  <div className="text-center mb-2">
                    <div className="w-20 h-20 bg-gray-300 rounded-full mx-auto overflow-hidden">
                      <img 
                        src={hero.icon} 
                        alt={hero.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/80?text=Hero';
                        }}
                      />
                    </div>
                    <div className="mt-2 font-medium">{hero.name}</div>
                  </div>
                  
                  <div className="text-xs text-center text-gray-400">
                    {hero.roles.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Available heroes grid with team-colored cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {draftingState.availableHeroes.map(hero => (
            <div 
              key={hero.id} 
              className={`relative p-4 rounded-lg transition-all ${
                allPlayersHaveSelectedHeroes ? 'opacity-40 pointer-events-none' :
                draftingState.currentTeam === Team.Titans
                  ? 'bg-blue-900/30 hover:bg-blue-800/40'
                  : 'bg-red-900/30 hover:bg-red-800/40'
              } cursor-pointer`}
              onMouseEnter={() => setHoveredHero(hero)}
              onMouseLeave={() => setHoveredHero(null)}
            >
              <div className="text-center mb-3">
                <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto overflow-hidden">
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
                  <span key={i} className="text-yellow-400 text-lg">★</span>
                ))}
                {[...Array(4 - hero.complexity)].map((_, i) => (
                  <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
                ))}
              </div>
              
              {/* Roles */}
              <div className="text-sm text-center text-gray-300 mb-3">
                {hero.roles.join(', ')}
              </div>
              
              {/* Action buttons */}
              {!allPlayersHaveSelectedHeroes && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {isBanningPhase && (
                    <button
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm flex items-center justify-center"
                      onClick={() => onHeroBan(hero)}
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
                          onClick={() => onHeroSelect(hero, player.id)}
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
  
  // Hero tooltip when hovering - 3x bigger
  const renderHeroTooltip = () => {
    if (!hoveredHero || allPlayersHaveSelectedHeroes) return null;
    
    return (
      <div className="fixed bottom-8 left-8 bg-gray-900/95 p-8 rounded-lg shadow-lg max-w-2xl z-50">
        <div className="flex items-start">
          <div className="w-32 h-32 bg-gray-300 rounded-full overflow-hidden mr-6 flex-shrink-0">
            <img 
              src={hoveredHero.icon} 
              alt={hoveredHero.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/192?text=Hero';
              }}
            />
          </div>
          <div>
            <h3 className="text-3xl font-bold mb-2">{hoveredHero.name}</h3>
            <div className="text-xl text-gray-300 mb-3">{hoveredHero.roles.join(' • ')}</div>
            <div className="flex mb-4">
              {[...Array(hoveredHero.complexity)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-2xl">★</span>
              ))}
              {[...Array(4 - hoveredHero.complexity)].map((_, i) => (
                <span key={i + hoveredHero.complexity} className="text-gray-600 text-2xl">★</span>
              ))}
            </div>
            <p className="text-lg leading-relaxed">{hoveredHero.description || "This hero's abilities and playstyle are shrouded in mystery."}</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Selected heroes overview
  const renderSelectedHeroes = () => {
    if (draftingState.selectedHeroes.length === 0) return null;
    
    return (
      <div className="mt-8 bg-gray-800 p-4 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Selected Heroes</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Titans section */}
          <div className="bg-blue-900/30 p-3 rounded-lg">
            <h4 className="text-lg font-medium mb-3">Titans</h4>
            <div className="space-y-2">
              {players
                .filter(player => player.team === Team.Titans)
                .map(player => {
                  const selection = draftingState.selectedHeroes.find(s => s.playerId === player.id);
                  return (
                    <div key={player.id} className="flex items-center">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">
                        {selection ? (
                          <img 
                            src={selection.hero.icon} 
                            alt={selection.hero.name} 
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://via.placeholder.com/32?text=H';
                            }}
                          />
                        ) : (
                          <span className="text-xs">?</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs text-gray-300">
                          {selection ? selection.hero.name : 'Not selected'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          
          {/* Atlanteans section */}
          <div className="bg-red-900/30 p-3 rounded-lg">
            <h4 className="text-lg font-medium mb-3">Atlanteans</h4>
            <div className="space-y-2">
              {players
                .filter(player => player.team === Team.Atlanteans)
                .map(player => {
                  const selection = draftingState.selectedHeroes.find(s => s.playerId === player.id);
                  return (
                    <div key={player.id} className="flex items-center">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-2">
                        {selection ? (
                          <img 
                            src={selection.hero.icon} 
                            alt={selection.hero.name} 
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://via.placeholder.com/32?text=H';
                            }}
                          />
                        ) : (
                          <span className="text-xs">?</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs text-gray-300">
                          {selection ? selection.hero.name : 'Not selected'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="drafting-system">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {draftingState.mode === DraftMode.AllPick ? 'All Pick' :
             draftingState.mode === DraftMode.Single ? 'Single Draft' : 
             draftingState.mode === DraftMode.Random ? 'Random Draft' : 
             'Pick and Ban Draft'}
          </h2>
          
          <div className="flex gap-3">
            {/* Undo button */}
            <Tooltip text="Undo the last hero selection">
              <button 
                className={`px-4 py-2 ${canUndo ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 opacity-50 cursor-not-allowed'} rounded-lg flex items-center`}
                onClick={onUndoLastAction}
                disabled={!canUndo}
              >
                <RotateCcw size={16} className="mr-2" /> Undo
              </button>
            </Tooltip>
            
            {/* Reset button */}
            <Tooltip text="Reset all selections and restart with the same draft mode">
              <button 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={onResetDraft}
              >
                <RefreshCw size={16} className="mr-2" /> Reset
              </button>
            </Tooltip>
            
            {/* Back button */}
            <Tooltip text="Go back to draft mode selection without rerolling tiebreaker">
              <button 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={onBackToDraftSelection}
              >
                <ArrowLeft size={16} className="mr-2" /> Back
              </button>
            </Tooltip>
            
            {/* Cancel button */}
            <Tooltip text="Return to game setup screen">
              <button 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
                onClick={onCancelDrafting}
              >
                <X size={16} className="mr-2" /> Cancel
              </button>
            </Tooltip>
            
            {(draftingState.isComplete || allPlayersHaveSelectedHeroes) && (
              <Tooltip text="Finish drafting and start the game">
                <button 
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg flex items-center"
                  onClick={onFinishDrafting}
                >
                  <Play size={16} className="mr-2" /> Start Game
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      
      {/* Main drafting UI */}
      <div className="bg-gray-800 rounded-lg p-6">
        {renderDraftingUI()}
      </div>
      
      {/* Selected heroes overview */}
      {renderSelectedHeroes()}
      
      {/* Hero tooltip */}
      {renderHeroTooltip()}

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
      `}</style>
    </div>
  );
};

export default DraftingSystem;