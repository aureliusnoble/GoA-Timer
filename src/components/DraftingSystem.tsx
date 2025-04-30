// src/components/DraftingSystem.tsx
import React, { useState, useRef } from 'react';
import { Hero, Player, Team, DraftMode, DraftingState } from '../types';
import { X, Check, ChevronRight, User } from 'lucide-react';

interface DraftingSystemProps {
  players: Player[];
  availableHeroes: Hero[];
  draftingState: DraftingState;
  onHeroSelect: (hero: Hero, playerId: number) => void;
  onHeroBan: (hero: Hero) => void;
  onFinishDrafting: () => void;
  onCancelDrafting: () => void;
}

const DraftingSystem: React.FC<DraftingSystemProps> = ({
  players,
  availableHeroes,
  draftingState,
  onHeroSelect,
  onHeroBan,
  onFinishDrafting,
  onCancelDrafting
}) => {
  const [hoveredHero, setHoveredHero] = useState<Hero | null>(null);
  
  // Refs for scrollable containers
  const titansDraftRef = useRef<HTMLDivElement>(null);
  const atlanteansDraftRef = useRef<HTMLDivElement>(null);
  
  // Get current team players
  const currentTeamPlayers = players.filter(player => 
    player.team === draftingState.currentTeam
  );
  
  // Get players who haven't selected a hero yet in the current team
  const pendingPlayers = currentTeamPlayers.filter(player => 
    !draftingState.selectedHeroes.some(selection => selection.playerId === player.id)
  );
  
  // Get team name
  const getTeamName = (team: Team) => {
    return team === Team.Titans ? 'Titans' : 'Atlanteans';
  };
  
  // Get current phase label for Pick and Ban
  const getCurrentPickBanLabel = () => {
    if (draftingState.mode !== DraftMode.PickAndBan || draftingState.currentStep >= draftingState.pickBanSequence.length) {
      return 'Complete';
    }
    
    const step = draftingState.pickBanSequence[draftingState.currentStep];
    const teamLabel = step.team === 'A' ? getTeamName(draftingState.currentTeam) : getTeamName(draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans);
    const actionLabel = step.action === 'ban' ? 'Ban' : 'Pick';
    
    return `${teamLabel} ${actionLabel} - Round ${step.round}`;
  };
  
  // Render hero card with appropriate actions
  const renderHeroCard = (hero: Hero, context: 'available' | 'assigned' | 'selected' | 'banned') => {
    const isAvailable = context === 'available';
    const isAssigned = context === 'assigned';
    const isSelected = context === 'selected';
    const isBanned = context === 'banned';
    
    return (
      <div 
        key={hero.id}
        className={`relative p-3 rounded-lg transition-all ${
          isAvailable ? 'bg-gray-800 hover:bg-gray-700' : 
          isAssigned ? 'bg-amber-900/30 hover:bg-amber-800/40' :
          isSelected ? 'bg-green-900/30' :
          'bg-red-900/30 opacity-50'
        }`}
        onMouseEnter={() => setHoveredHero(hero)}
        onMouseLeave={() => setHoveredHero(null)}
      >
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto overflow-hidden">
            <img 
              src={hero.icon} 
              alt={hero.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/64?text=Hero';
              }}
            />
          </div>
          <div className="mt-1 font-medium">{hero.name}</div>
        </div>
        
        {/* Complexity stars */}
        <div className="flex justify-center mb-1">
          {[...Array(hero.complexity)].map((_, i) => (
            <span key={i} className="text-yellow-400">★</span>
          ))}
          {[...Array(4 - hero.complexity)].map((_, i) => (
            <span key={i + hero.complexity} className="text-gray-600">★</span>
          ))}
        </div>
        
        {/* Roles */}
        <div className="text-xs text-center text-gray-300 mb-2">
          {hero.roles.join(', ')}
        </div>
        
        {/* Actions for Pick and Ban mode */}
        {isAvailable && draftingState.mode === DraftMode.PickAndBan && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {draftingState.pickBanSequence[draftingState.currentStep]?.action === 'ban' && (
              <button
                className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs flex items-center justify-center"
                onClick={() => onHeroBan(hero)}
              >
                <X size={12} className="mr-1" /> Ban
              </button>
            )}
            {draftingState.pickBanSequence[draftingState.currentStep]?.action === 'pick' && pendingPlayers.length > 0 && (
              <button
                className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs flex items-center justify-center"
                onClick={() => onHeroSelect(hero, pendingPlayers[0].id)}
              >
                <Check size={12} className="mr-1" /> Pick
              </button>
            )}
          </div>
        )}
        
        {/* Actions for Random Draft mode */}
        {isAvailable && draftingState.mode === DraftMode.Random && (
          <div className="mt-2">
            {pendingPlayers.length > 0 && (
              <button
                className="w-full px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs flex items-center justify-center"
                onClick={() => onHeroSelect(hero, pendingPlayers[0].id)}
              >
                <Check size={12} className="mr-1" /> Pick
              </button>
            )}
          </div>
        )}
        
        {/* Actions for Single Draft mode */}
        {isAssigned && (
          <div className="mt-2">
            <button
              className="w-full px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs flex items-center justify-center"
              onClick={() => {
                const playerId = draftingState.assignedHeroes.find(assigned => 
                  assigned.heroOptions.some(h => h.id === hero.id)
                )?.playerId;
                
                if (playerId) {
                  onHeroSelect(hero, playerId);
                }
              }}
            >
              <Check size={12} className="mr-1" /> Select
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // Render based on drafting mode
  const renderDraftingUI = () => {
    switch (draftingState.mode) {
      case DraftMode.Single:
        return (
          <div>
            <h3 className="text-xl font-bold mb-4">Single Draft</h3>
            
            <div className="mb-6">
              <div className={`p-3 rounded-lg ${
                draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50' : 'bg-red-900/50'
              }`}>
                <h4 className="text-lg font-semibold mb-2">
                  {getTeamName(draftingState.currentTeam)}'s Turn
                </h4>
                
                {pendingPlayers.length > 0 ? (
                  <div className="text-md mb-3">
                    Any {getTeamName(draftingState.currentTeam)} player can select a hero from their options
                  </div>
                ) : (
                  <div className="text-md mb-3">
                    All {getTeamName(draftingState.currentTeam)} players have selected heroes
                  </div>
                )}
              </div>
            </div>
            
            {/* Titans Section - Now with scrollable container */}
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
                              className={`relative p-3 rounded-lg ${
                                draftingState.currentTeam === Team.Titans && !hasSelected 
                                  ? 'bg-blue-900/30 hover:bg-blue-800/40 cursor-pointer' 
                                  : 'bg-gray-800'
                              }`}
                              onClick={() => {
                                if (draftingState.currentTeam === Team.Titans && !hasSelected) {
                                  onHeroSelect(hero, player.id);
                                }
                              }}
                              onMouseEnter={() => setHoveredHero(hero)}
                              onMouseLeave={() => setHoveredHero(null)}
                            >
                              <div className="text-center mb-2">
                                <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto overflow-hidden">
                                  <img 
                                    src={hero.icon} 
                                    alt={hero.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'https://via.placeholder.com/64?text=Hero';
                                    }}
                                  />
                                </div>
                                <div className="mt-1 font-medium">{hero.name}</div>
                              </div>
                              
                              {/* Complexity stars */}
                              <div className="flex justify-center mb-1">
                                {[...Array(hero.complexity)].map((_, i) => (
                                  <span key={i} className="text-yellow-400">★</span>
                                ))}
                                {[...Array(4 - hero.complexity)].map((_, i) => (
                                  <span key={i + hero.complexity} className="text-gray-600">★</span>
                                ))}
                              </div>
                              
                              {/* Roles */}
                              <div className="text-xs text-center text-gray-300 mb-2">
                                {hero.roles.join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            
            {/* Atlanteans Section - Now with scrollable container */}
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
                              className={`relative p-3 rounded-lg ${
                                draftingState.currentTeam === Team.Atlanteans && !hasSelected 
                                  ? 'bg-red-900/30 hover:bg-red-800/40 cursor-pointer' 
                                  : 'bg-gray-800'
                              }`}
                              onClick={() => {
                                if (draftingState.currentTeam === Team.Atlanteans && !hasSelected) {
                                  onHeroSelect(hero, player.id);
                                }
                              }}
                              onMouseEnter={() => setHoveredHero(hero)}
                              onMouseLeave={() => setHoveredHero(null)}
                            >
                              <div className="text-center mb-2">
                                <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto overflow-hidden">
                                  <img 
                                    src={hero.icon} 
                                    alt={hero.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'https://via.placeholder.com/64?text=Hero';
                                    }}
                                  />
                                </div>
                                <div className="mt-1 font-medium">{hero.name}</div>
                              </div>
                              
                              {/* Complexity stars */}
                              <div className="flex justify-center mb-1">
                                {[...Array(hero.complexity)].map((_, i) => (
                                  <span key={i} className="text-yellow-400">★</span>
                                ))}
                                {[...Array(4 - hero.complexity)].map((_, i) => (
                                  <span key={i + hero.complexity} className="text-gray-600">★</span>
                                ))}
                              </div>
                              
                              {/* Roles */}
                              <div className="text-xs text-center text-gray-300 mb-2">
                                {hero.roles.join(', ')}
                              </div>
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
        
      case DraftMode.Random:
        return (
          <div>
            <h3 className="text-xl font-bold mb-4">Random Draft</h3>
            
            <div className="mb-6">
              <div className={`p-3 rounded-lg ${
                draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50' : 'bg-red-900/50'
              }`}>
                <h4 className="text-lg font-semibold mb-2">
                  {getTeamName(draftingState.currentTeam)}'s Turn
                </h4>
                
                {pendingPlayers.length > 0 ? (
                  <div className="text-md mb-3">
                    {pendingPlayers.map(player => player.name).join(', ')} need to select a hero
                  </div>
                ) : (
                  <div className="text-md mb-3">
                    All {getTeamName(draftingState.currentTeam)} players have selected heroes
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {draftingState.availableHeroes.map(hero => renderHeroCard(hero, 'available'))}
            </div>
          </div>
        );
        
      case DraftMode.PickAndBan:
        return (
          <div>
            <h3 className="text-xl font-bold mb-4">Pick and Ban</h3>
            
            <div className="mb-6">
              <div className={`p-3 rounded-lg ${
                draftingState.currentTeam === Team.Titans ? 'bg-blue-900/50' : 'bg-red-900/50'
              }`}>
                <h4 className="text-lg font-semibold mb-2">
                  {getCurrentPickBanLabel()}
                </h4>
                
                {draftingState.currentStep < draftingState.pickBanSequence.length && (
                  <div className="text-md mb-3">
                    {draftingState.pickBanSequence[draftingState.currentStep].action === 'ban' 
                      ? 'Select a hero to ban' 
                      : pendingPlayers.length > 0 
                        ? `${pendingPlayers.map(player => player.name).join(', ')} need to pick a hero`
                        : 'All players on this team have selected heroes'
                    }
                  </div>
                )}
              </div>
            </div>
            
            {/* Banned heroes section */}
            {draftingState.bannedHeroes.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-3">Banned Heroes</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {draftingState.bannedHeroes.map(hero => renderHeroCard(hero, 'banned'))}
                </div>
              </div>
            )}
            
            {/* Available heroes for picking/banning */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {draftingState.availableHeroes.map(hero => {
                // Ensure we only show pick or ban buttons based on current action
                const currentAction = draftingState.pickBanSequence[draftingState.currentStep]?.action;
                return renderHeroCard(hero, 'available');
              })}
            </div>
          </div>
        );
        
      default:
        return <div>Invalid drafting mode</div>;
    }
  };
  
  // Hero tooltip when hovering
  const renderHeroTooltip = () => {
    if (!hoveredHero) return null;
    
    return (
      <div className="fixed bottom-4 left-4 bg-gray-900/90 p-4 rounded-lg shadow-lg max-w-md z-50">
        <div className="flex items-start">
          <div className="w-16 h-16 bg-gray-300 rounded-full overflow-hidden mr-3 flex-shrink-0">
            <img 
              src={hoveredHero.icon} 
              alt={hoveredHero.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/64?text=Hero';
              }}
            />
          </div>
          <div>
            <h3 className="text-lg font-bold">{hoveredHero.name}</h3>
            <div className="text-sm text-gray-300 mb-1">{hoveredHero.roles.join(' • ')}</div>
            <div className="flex mb-2">
              {[...Array(hoveredHero.complexity)].map((_, i) => (
                <span key={i} className="text-yellow-400">★</span>
              ))}
              {[...Array(4 - hoveredHero.complexity)].map((_, i) => (
                <span key={i + hoveredHero.complexity} className="text-gray-600">★</span>
              ))}
            </div>
            <p className="text-sm">{hoveredHero.description}</p>
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
            {draftingState.mode === DraftMode.Single ? 'Single Draft' : 
             draftingState.mode === DraftMode.Random ? 'Random Draft' : 
             'Pick and Ban Draft'}
          </h2>
          
          <div className="flex gap-3">
            <button 
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center"
              onClick={onCancelDrafting}
            >
              <X size={16} className="mr-2" /> Cancel
            </button>
            
            {draftingState.isComplete && (
              <button 
                className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg flex items-center"
                onClick={onFinishDrafting}
              >
                <ChevronRight size={16} className="mr-2" /> Start Game
              </button>
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
      <style jsx>{`
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