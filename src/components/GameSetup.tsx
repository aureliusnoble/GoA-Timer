// src/components/GameSetup.tsx
import React, { useEffect, useState } from 'react';
import { Player, Team, GameLength } from '../types';
import { getAllExpansions } from '../data/heroes';
import TimerInput from './TimerInput';
import PlayerNameInput from './PlayerNameInput';

interface GameSetupProps {
  strategyTime: number;
  moveTime: number;
  gameLength: GameLength;
  onStrategyTimeChange: (time: number) => void;
  onMoveTimeChange: (time: number) => void;
  onGameLengthChange: (length: GameLength) => void;
  players: Player[];
  onAddPlayer: (team: Team) => void;
  onStartGame: () => void;
  onDraftHeroes: () => void;
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
  onPlayerNameChange: (playerId: number, name: string) => void;
  duplicateNames: string[]; // Added this prop to show duplicate name warnings
}

const GameSetup: React.FC<GameSetupProps> = ({
  strategyTime,
  moveTime,
  gameLength,
  onStrategyTimeChange,
  onMoveTimeChange,
  onGameLengthChange,
  players,
  onAddPlayer,
  onStartGame,
  onDraftHeroes,
  selectedExpansions,
  onToggleExpansion,
  onPlayerNameChange,
  duplicateNames
}) => {
  const [expandedSection, setExpandedSection] = useState<{[key: string]: boolean}>({
    'timers': true,
    'game-length': true,
    'players': true,
    'names': true,
    'expansions': false
  });
  const expansions = getAllExpansions();
  
  // Set default values when component mounts if they're not already set
  useEffect(() => {
    if (strategyTime !== 90) {
      onStrategyTimeChange(90);
    }
    if (moveTime !== 30) {
      onMoveTimeChange(30);
    }
  }, []);

  // Calculate player count by team
  const titanCount = players.filter(p => p.team === Team.Titans).length;
  const atlanteanCount = players.filter(p => p.team === Team.Atlanteans).length;
  const totalPlayers = titanCount + atlanteanCount;
  
  // Count players with heroes assigned and names
  const playersWithHeroes = players.filter(p => p.hero).length;
  const playersWithNames = players.filter(p => p.name.trim() !== '').length;
  const allPlayersHaveHeroes = playersWithHeroes === totalPlayers && totalPlayers > 0;
  const allPlayersHaveNames = playersWithNames === totalPlayers && totalPlayers > 0;
  
  // Check if player names are unique
  const hasUniquenames = duplicateNames.length === 0;

  // Check if quick game is available (6 or fewer players)
  const isQuickGameAvailable = totalPlayers <= 6;
  
  // Check if we can add more players (max 10 players total)
  const canAddMorePlayers = totalPlayers < 10;
  
  // Check if teams have at least 2 players each
  const teamsHaveMinPlayers = titanCount >= 2 && atlanteanCount >= 2;
  
  // Requirements for starting game and drafting
  const canStartGame = titanCount > 0 && titanCount === atlanteanCount && allPlayersHaveHeroes && teamsHaveMinPlayers && allPlayersHaveNames && hasUniquenames;
  const canDraft = titanCount > 0 && titanCount === atlanteanCount && teamsHaveMinPlayers && allPlayersHaveNames && hasUniquenames;

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Game Setup</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Timer Settings Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center" 
              onClick={() => setExpandedSection({...expandedSection, 'timers': !expandedSection['timers']})}>
            <span className="mr-2">{expandedSection['timers'] ? '▼' : '▶'}</span>
            Timer Settings
          </h3>
          
          {expandedSection['timers'] && (
            <>
              <div className="mb-6">
                <label className="block mb-3">Strategy Timer</label>
                <TimerInput 
                  value={strategyTime} 
                  onChange={onStrategyTimeChange}
                  tooltip="This is the amount of time teams will have to publicly discuss what cards to play"
                  minValue={30}
                  maxValue={300}
                  step={10}
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-3">Move Timer</label>
                <TimerInput 
                  value={moveTime} 
                  onChange={onMoveTimeChange}
                  tooltip="This is the time each player will have to resolve their cards once revealed"
                  minValue={10}
                  maxValue={120}
                  step={10}
                />
              </div>
            </>
          )}
        </div>
        
        {/* Game Length Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => setExpandedSection({...expandedSection, 'game-length': !expandedSection['game-length']})}>
            <span className="mr-2">{expandedSection['game-length'] ? '▼' : '▶'}</span>
            Game Length
          </h3>
          
          {expandedSection['game-length'] && (
            <>
              <div className="flex flex-col gap-3 mb-4">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="gameLength"
                    value={GameLength.Quick}
                    checked={gameLength === GameLength.Quick}
                    onChange={() => onGameLengthChange(GameLength.Quick)}
                    disabled={!isQuickGameAvailable}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className={`ml-2 ${!isQuickGameAvailable ? 'text-gray-500' : ''}`}>
                    Quick
                    {!isQuickGameAvailable && <span className="ml-2 text-red-400 text-sm">(Max 6 players)</span>}
                  </span>
                </label>
                
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="gameLength"
                    value={GameLength.Long}
                    checked={gameLength === GameLength.Long}
                    onChange={() => onGameLengthChange(GameLength.Long)}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2">Long</span>
                </label>
              </div>
              
              {/* Game configuration info */}
              <div className="mt-4 bg-gray-700 p-3 rounded-md text-sm">
                <h4 className="font-semibold mb-1">Current Configuration:</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>
                    {gameLength === GameLength.Quick 
                      ? `3 total waves`
                      : totalPlayers <= 6 
                        ? `5 total waves` 
                        : `7 waves per lane (2 lanes)`
                    }
                  </li>
                  <li>
                    {`${calculateTeamLives(gameLength, totalPlayers)} lives per team`}
                  </li>
                  {totalPlayers >= 8 && (
                    <li className="text-amber-300">
                      Using two separate lanes
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
        
        {/* Players Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => setExpandedSection({...expandedSection, 'players': !expandedSection['players']})}>
            <span className="mr-2">{expandedSection['players'] ? '▼' : '▶'}</span>
            Players
          </h3>
          
          {expandedSection['players'] && (
            <>
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span>Titans: {titanCount} players</span>
                  <button
                    className={`px-3 py-1 rounded text-sm ${
                      canAddMorePlayers 
                        ? 'bg-blue-700 hover:bg-blue-600' 
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                    onClick={() => canAddMorePlayers && onAddPlayer(Team.Titans)}
                    disabled={!canAddMorePlayers}
                  >
                    Add Player
                  </button>
                </div>
                
                <div className="flex justify-between">
                  <span>Atlanteans: {atlanteanCount} players</span>
                  <button
                    className={`px-3 py-1 rounded text-sm ${
                      canAddMorePlayers 
                        ? 'bg-red-700 hover:bg-red-600' 
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                    onClick={() => canAddMorePlayers && onAddPlayer(Team.Atlanteans)}
                    disabled={!canAddMorePlayers}
                  >
                    Add Player
                  </button>
                </div>
              </div>
              
              {/* Validation warnings */}
              {!canAddMorePlayers && (
                <div className="text-amber-400 text-sm mt-2">
                  Maximum 10 players allowed
                </div>
              )}
              
              {titanCount !== atlanteanCount && (
                <div className="text-amber-400 text-sm mt-2">
                  Both teams must have equal number of players
                </div>
              )}
              
              {totalPlayers > 0 && !teamsHaveMinPlayers && (
                <div className="text-amber-400 text-sm mt-2">
                  Each team must have at least 2 players
                </div>
              )}
              
              {totalPlayers > 0 && !allPlayersHaveNames && (
                <div className="text-amber-400 text-sm mt-2">
                  All players must enter their names
                </div>
              )}
              
              {/* Display duplicate names warning */}
              {duplicateNames.length > 0 && (
                <div className="text-red-400 text-sm mt-2">
                  Duplicate names found: {duplicateNames.join(', ')}
                </div>
              )}
              
              {titanCount > 0 && titanCount === atlanteanCount && allPlayersHaveNames && teamsHaveMinPlayers && duplicateNames.length === 0 && (
                <div className="text-emerald-400 text-sm mt-2">
                  Teams are balanced with {titanCount} players each
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Expansions Section */}
      <div className="mb-8">
        <h3 className="text-xl mb-3 cursor-pointer flex items-center"
            onClick={() => setExpandedSection({...expandedSection, 'expansions': !expandedSection['expansions']})}>
          <span className="mr-2">{expandedSection['expansions'] ? '▼' : '▶'}</span>
          Expansions
        </h3>
        
        {expandedSection['expansions'] && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {expansions.map(expansion => (
              <label key={expansion} className="flex items-center bg-gray-700 p-3 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedExpansions.includes(expansion)}
                  onChange={() => onToggleExpansion(expansion)}
                  className="mr-2 h-5 w-5"
                />
                <span>{expansion}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      
      {/* Player Names Section */}
      {players.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => setExpandedSection({...expandedSection, 'names': !expandedSection['names']})}>
            <span className="mr-2">{expandedSection['names'] ? '▼' : '▶'}</span>
            Player Names
          </h3>
          
          {expandedSection['names'] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player) => {
                // Check if this player's name is a duplicate
                const isDuplicate = player.name.trim() !== '' && duplicateNames.includes(player.name.trim());
                
                return (
                  <PlayerNameInput
                    key={player.id}
                    player={player}
                    onNameChange={(name) => onPlayerNameChange(player.id, name)}
                    isDuplicate={isDuplicate}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          className={`px-6 py-2 rounded-lg font-medium text-white flex-grow ${
            canStartGame
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-gray-600 cursor-not-allowed'
          }`}
          onClick={onStartGame}
          disabled={!canStartGame}
        >
          Start Game
        </button>
        
        <button
          className={`px-6 py-2 rounded-lg font-medium text-white flex-grow ${
            canDraft
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'bg-gray-600 cursor-not-allowed'
          }`}
          onClick={onDraftHeroes}
          disabled={!canDraft}
        >
          Draft Heroes
        </button>
      </div>
    </div>
  );
};

// Helper function to calculate team lives based on game length and player count
const calculateTeamLives = (gameLength: GameLength, playerCount: number): number => {
  if (gameLength === GameLength.Quick) {
    return playerCount <= 4 ? 4 : 5;
  } else { // Long game
    if (playerCount <= 4) return 6;
    if (playerCount <= 6) return 8;
    if (playerCount <= 8) return 6;
    return 7; // 10 players
  }
};

export default GameSetup;