// src/components/HeroSelection.tsx
import React from 'react';
import { Hero, Player, Team } from '../types';

interface HeroSelectionProps {
  heroes: Hero[];
  selectedHeroes: Hero[];
  players: Player[];
  onHeroSelect: (hero: Hero, playerIndex: number) => void;
}

const HeroSelection: React.FC<HeroSelectionProps> = ({ 
  heroes, 
  selectedHeroes, 
  players, 
  onHeroSelect 
}) => {
  // Filter out already selected heroes
  const availableHeroes = heroes.filter(
    hero => !selectedHeroes.some(selected => selected.id === hero.id)
  );

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Select Heroes</h2>
      
      {players.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-xl mb-2">Player Hero Assignments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player, index) => (
              <div 
                key={player.id} 
                className={`p-4 rounded-lg border-2 ${
                  player.team === Team.Titans ? 'border-blue-400 bg-blue-900/50' : 'border-red-400 bg-red-900/50'
                }`}
              >
                <h4 className="font-semibold mb-2">
                  Player {player.id} - {player.team === Team.Titans ? 'Titans' : 'Atlanteans'}
                </h4>
                {player.hero ? (
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden mr-3">
                      <img 
                        src={player.hero.icon} 
                        alt={player.hero.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/48?text=Hero';
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-medium">{player.hero.name}</div>
                      <button 
                        className="text-sm text-gray-300 underline"
                        onClick={() => onHeroSelect(player.hero!, index)}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-amber-300 mb-2">Select a hero below</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-amber-300 mb-4">Add players to begin selecting heroes</p>
      )}
      
      <h3 className="text-xl mb-2">Available Heroes</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {availableHeroes.map(hero => (
          <div 
            key={hero.id} 
            className="bg-gray-800 rounded-lg p-3 transition-all hover:bg-gray-700 cursor-pointer"
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
              <div className="mt-2 font-medium">{hero.name}</div>
            </div>
            
            {players.length > 0 && (
              <div className="grid grid-cols-2 gap-1 mt-2">
                {players.filter(p => !p.hero).map((player, index) => {
                  const playerIndex = players.findIndex(p => p.id === player.id);
                  return (
                    <button
                      key={player.id}
                      className={`text-xs px-2 py-1 rounded ${
                        player.team === Team.Titans ? 'bg-blue-700 hover:bg-blue-600' : 'bg-red-700 hover:bg-red-600'
                      }`}
                      onClick={() => onHeroSelect(hero, playerIndex)}
                    >
                      P{player.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroSelection;