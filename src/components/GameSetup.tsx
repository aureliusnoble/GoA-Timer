// src/components/GameSetup.tsx
import React, { useEffect, useState } from 'react';
import { Player, Team, GameLength } from '../types';
import { getAllExpansions } from '../data/heroes';
import TimerInput from './TimerInput';
import PlayerNameInput from './PlayerNameInput';
import { Info } from 'lucide-react';

interface GameSetupProps {
  strategyTime: number;
  moveTime: number;
  gameLength: GameLength;
  onStrategyTimeChange: (time: number) => void;
  onMoveTimeChange: (time: number) => void;
  onGameLengthChange: (length: GameLength) => void;
  players: Player[];
  onAddPlayer: (team: Team) => void;
  onRemovePlayer: (playerId: number) => void; // New prop
  onDraftHeroes: () => void;
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
  onPlayerNameChange: (playerId: number, name: string) => void;
  duplicateNames: string[]; // Array of duplicate player names for validation
  canStartDrafting: boolean; // Flag indicating if drafting can begin based on heroes count
  heroCount: number; // Number of available heroes with current expansion selection
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
  onRemovePlayer, // New prop
  onDraftHeroes,
  selectedExpansions,
  onToggleExpansion,
  onPlayerNameChange,
  duplicateNames,
  canStartDrafting,
  heroCount
}) => {
  const [expandedSection, setExpandedSection] = useState<{[key: string]: boolean}>({
    'timers': true,
    'game-length': true,
    'players': true,
    'names': true,
    'expansions': false
  });
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
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
  
  // Count players with names
  const playersWithNames = players.filter(p => p.name.trim() !== '').length;
  const allPlayersHaveNames = playersWithNames === totalPlayers && totalPlayers > 0;
  
  // Check if player names are unique
  const hasUniqueNames = duplicateNames.length === 0;

  // Check if quick game is available (6 or fewer players)
  const isQuickGameAvailable = totalPlayers <= 6;
  
  // Check if we can add more players (max 10 players total)
  const canAddMorePlayers = totalPlayers < 10;
  
  // Check if teams have at least 2 players each
  const teamsHaveMinPlayers = titanCount >= 2 && atlanteanCount >= 2;
  
  // Requirements for drafting
  const isTeamsBalanced = titanCount > 0 && titanCount === atlanteanCount && teamsHaveMinPlayers;
  const canDraft = isTeamsBalanced && allPlayersHaveNames && hasUniqueNames && canStartDrafting;

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
                <label className="block mb-3">Action Timer</label>
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
              
              {/* Hero count warning */}
              {totalPlayers > 0 && !canStartDrafting && (
                <div className="text-red-400 text-sm mt-2">
                  Not enough heroes ({heroCount}) for {totalPlayers} players. Select more expansions.
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
          <>
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
            <div className="mt-3 text-sm">
              <span className="text-blue-300">Available heroes: {heroCount}</span>
              {totalPlayers > 0 && (
                <span className="ml-4 text-yellow-300">
                  {canStartDrafting 
                    ? "✓ Enough heroes for drafting" 
                    : "✗ Not enough heroes for drafting"}
                </span>
              )}
            </div>
          </>
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
                    onRemove={() => onRemovePlayer(player.id)}
                    isDuplicate={isDuplicate}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Action Button - Only Draft Heroes now */}
      <div className="flex items-center justify-center">
        <div className="relative">
          <button
            className={`px-8 py-3 rounded-lg font-medium text-white ${
              canDraft
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
            onClick={onDraftHeroes}
            disabled={!canDraft}
          >
            Draft Heroes
          </button>
          
          <div 
            className="ml-2 absolute top-1/2 right-0 transform translate-x-7 -translate-y-1/2 cursor-help"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <Info size={18} className="text-gray-400 hover:text-gray-200" />
            
            {tooltipVisible && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white p-2 rounded shadow-lg w-64 z-10">
                Click to select heroes for each player and start the game.
              </div>
            )}
          </div>
        </div>
   
      </div>
         <p className="mt-4 text-xs text-gray-300 text-center translate-y-5">
          Disclaimer: This is not an official product and has not been approved by Wolff Designa. All game content is the property of Wolff Designa.
        </p>
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