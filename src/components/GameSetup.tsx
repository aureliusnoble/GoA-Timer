import React, { useEffect, useState } from 'react';
import { Player, Team, GameLength } from '../types';
import { getAllExpansions } from '../data/heroes';
import TimerInput from './TimerInput';
import PlayerNameInput from './PlayerNameInput';
import { Info, Clock, Infinity, BarChart } from 'lucide-react';
import EnhancedTooltip from './common/EnhancedTooltip';
import { useSound } from '../context/SoundContext';
import dbService from '../services/DatabaseService';

interface GameSetupProps {
  strategyTime: number;
  moveTime: number;
  gameLength: GameLength;
  onStrategyTimeChange: (time: number) => void;
  onMoveTimeChange: (time: number) => void;
  onGameLengthChange: (length: GameLength) => void;
  players: Player[];
  onAddPlayer: (team: Team) => void;
  onRemovePlayer: (playerId: number) => void;
  onDraftHeroes: () => void;
  selectedExpansions: string[];
  onToggleExpansion: (expansion: string) => void;
  onPlayerNameChange: (playerId: number, name: string) => void;
  duplicateNames: string[];
  canStartDrafting: boolean;
  heroCount: number;
  maxComplexity: number;
  onMaxComplexityChange: (complexity: number) => void;
  // Timer enabling props
  strategyTimerEnabled: boolean;
  moveTimerEnabled: boolean;
  onStrategyTimerEnabledChange: (enabled: boolean) => void;
  onMoveTimerEnabledChange: (enabled: boolean) => void;
  // NEW: Double lane option for 6 players
  useDoubleLaneFor6Players: boolean;
  onUseDoubleLaneFor6PlayersChange: (useDouble: boolean) => void;
  // NEW: View matches button handler
  onViewMatches: () => void;
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
  onRemovePlayer,
  onDraftHeroes,
  selectedExpansions,
  onToggleExpansion,
  onPlayerNameChange,
  duplicateNames,
  canStartDrafting,
  heroCount,
  maxComplexity,
  onMaxComplexityChange,
  // Timer props
  strategyTimerEnabled,
  moveTimerEnabled,
  onStrategyTimerEnabledChange,
  onMoveTimerEnabledChange,
  // Double lane props
  useDoubleLaneFor6Players,
  onUseDoubleLaneFor6PlayersChange,
  // Match statistics props
  onViewMatches
}) => {
  const { playSound } = useSound();
  const [hasMatchData, setHasMatchData] = useState<boolean>(false);

  const [expandedSection, setExpandedSection] = useState<{[key: string]: boolean}>({
    'timers': true,
    'game-length': true,
    'complexity': true,
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
    
    // Check if we have match data to enable View Matches button
    const checkMatchData = async () => {
      const hasData = await dbService.hasMatchData();
      setHasMatchData(hasData);
    };
    
    checkMatchData();
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
  
  // Check if each team can add more players (max 5 per team)
  const canAddMoreTitans = titanCount < 5;
  const canAddMoreAtlanteans = atlanteanCount < 5;
  
  // Check if teams have at least 2 players each
  const teamsHaveMinPlayers = titanCount >= 2 && atlanteanCount >= 2;
  
  // UPDATED: Allow teams with at most 1 player difference
  const isTeamsBalanced = titanCount > 0 && 
                         atlanteanCount > 0 && 
                         Math.abs(titanCount - atlanteanCount) <= 1 && 
                         teamsHaveMinPlayers;
  
  // NEW: Show double lane option only for 6 players in long game
  const showDoubleLaneOption = totalPlayers === 6 && gameLength === GameLength.Long;
  
  // Requirements for drafting
  const canDraft = isTeamsBalanced && allPlayersHaveNames && hasUniqueNames && canStartDrafting;

  // Function handlers with sound
  const handleToggleSection = (section: string) => {
    playSound('buttonClick');
    setExpandedSection({...expandedSection, [section]: !expandedSection[section]});
  };

  const handleAddPlayer = (team: Team) => {
    if (canAddMorePlayers && (team === Team.Titans ? canAddMoreTitans : canAddMoreAtlanteans)) {
      playSound('buttonClick');
      onAddPlayer(team);
    }
  };

  const handleTimerToggle = (isStrategy: boolean) => {
    playSound('toggleSwitch');
    if (isStrategy) {
      onStrategyTimerEnabledChange(!strategyTimerEnabled);
    } else {
      onMoveTimerEnabledChange(!moveTimerEnabled);
    }
  };

  const handleGameLengthChange = (length: GameLength) => {
    if (length === GameLength.Quick && !isQuickGameAvailable) {
      return;
    }
    playSound('buttonClick');
    onGameLengthChange(length);
  };

  const handleToggleExpansion = (expansion: string) => {
    playSound('toggleSwitch');
    onToggleExpansion(expansion);
  };

  const handleComplexityChange = (complexity: number) => {
    playSound('buttonClick');
    onMaxComplexityChange(complexity);
  };

  const handleDoubleLaneToggle = () => {
    playSound('toggleSwitch');
    onUseDoubleLaneFor6PlayersChange(!useDoubleLaneFor6Players);
  };

  const handleDraftHeroes = () => {
    if (canDraft) {
      playSound('buttonClick');
      onDraftHeroes();
    }
  };
  
  // NEW: Handle View Matches button click
  const handleViewMatches = () => {
    playSound('buttonClick');
    onViewMatches();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Game Setup</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {/* Timer Settings Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center" 
              onClick={() => handleToggleSection('timers')}>
            <span className="mr-2">{expandedSection['timers'] ? '▼' : '▶'}</span>
            Timer Settings
          </h3>
          
          {expandedSection['timers'] && (
            <>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="flex-grow">Strategy Timer</label>
                  <div className="flex items-center">
                    <EnhancedTooltip 
                      text={strategyTimerEnabled ? "Disable timer (unlimited time)" : "Enable timer (timed phase)"}
                      position="top"
                    >
                      <div 
                        className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                          strategyTimerEnabled ? 'bg-green-600 justify-end' : 'bg-gray-600 justify-start'
                        }`}
                        onClick={() => handleTimerToggle(true)}
                      >
                        <div className="bg-white w-4 h-4 rounded-full"></div>
                      </div>
                    </EnhancedTooltip>
                    <div className="ml-2">
                      {strategyTimerEnabled ? <Clock size={16} /> : <Infinity size={16} />}
                    </div>
                  </div>
                </div>
                
                <div className={strategyTimerEnabled ? '' : 'opacity-50'}>
                  <TimerInput 
                    value={strategyTime} 
                    onChange={onStrategyTimeChange}
                    tooltip="This is the amount of time teams will have to publicly discuss what cards to play"
                    minValue={30}
                    maxValue={300}
                    step={10}
                    disabled={!strategyTimerEnabled}
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="flex-grow">Action Timer</label>
                  <div className="flex items-center">
                    <EnhancedTooltip 
                      text={moveTimerEnabled ? "Disable timer (unlimited time)" : "Enable timer (timed phase)"}
                      position="top"
                    >
                      <div 
                        className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${
                          moveTimerEnabled ? 'bg-green-600 justify-end' : 'bg-gray-600 justify-start'
                        }`}
                        onClick={() => handleTimerToggle(false)}
                      >
                        <div className="bg-white w-4 h-4 rounded-full"></div>
                      </div>
                    </EnhancedTooltip>
                    <div className="ml-2">
                      {moveTimerEnabled ? <Clock size={16} /> : <Infinity size={16} />}
                    </div>
                  </div>
                </div>
                
                <div className={moveTimerEnabled ? '' : 'opacity-50'}>
                  <TimerInput 
                    value={moveTime} 
                    onChange={onMoveTimeChange}
                    tooltip="This is the time each player will have to resolve their cards once revealed"
                    minValue={10}
                    maxValue={120}
                    step={10}
                    disabled={!moveTimerEnabled}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Game Length Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => handleToggleSection('game-length')}>
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
                    onChange={() => handleGameLengthChange(GameLength.Quick)}
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
                    onChange={() => handleGameLengthChange(GameLength.Long)}
                    className="form-radio h-5 w-5 text-blue-600"
                  />
                  <span className="ml-2">Long</span>
                </label>
              </div>
              
              {/* NEW: Double Lane Option for 6 Players */}
              {showDoubleLaneOption && (
                <div className="mt-4 mb-4 bg-blue-900/30 p-3 rounded">
                  <label className="flex items-center cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={useDoubleLaneFor6Players}
                      onChange={handleDoubleLaneToggle}
                      className="form-checkbox h-5 w-5 text-blue-600 mr-2"
                    />
                    <span className="font-medium">Use Double Lane Map</span>
                  </label>
                  <p className="text-sm text-gray-300 mt-1">
                    Enable this option to use two lanes (top and bottom) for 6 player games
                  </p>
                </div>
              )}
              
              {/* Game configuration info - UPDATED with new values */}
<div className="mt-4 bg-gray-700 p-3 rounded-md text-sm">
  <h4 className="font-semibold mb-1">Current Configuration:</h4>
  <ul className="list-disc list-inside space-y-1 text-gray-300">
    <li>
      {gameLength === GameLength.Quick 
        ? `3 waves, single lane`
        : totalPlayers <= 5
          ? `5 waves, single lane`
          : (totalPlayers === 6 && !useDoubleLaneFor6Players) 
            ? `5 waves, single lane`
            : `7 waves per lane, two lanes`
      }
    </li>
    <li>
      {gameLength === GameLength.Quick
        ? totalPlayers <= 5 
          ? "4 lives per team" 
          : "5 lives per team"
        : totalPlayers === 6 && !useDoubleLaneFor6Players
          ? "8 lives per team" // Special case: 6 players long game single lane
          : totalPlayers <= 8 
            ? "6 lives per team" // 3-5 players or 6-8 players with double lane
            : "7 lives per team" // 9-10 players
      }
    </li>
    {(totalPlayers >= 7 || (totalPlayers === 6 && useDoubleLaneFor6Players && gameLength === GameLength.Long)) && (
      <li className="text-amber-300">
        Using two separate lanes (top and bottom)
      </li>
    )}
  </ul>
</div>
            </>
          )}
        </div>
        
        {/* Max Complexity Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => handleToggleSection('complexity')}>
            <span className="mr-2">{expandedSection['complexity'] ? '▼' : '▶'}</span>
            Max Complexity
          </h3>
          
          {expandedSection['complexity'] && (
            <>
              <div className="flex flex-col gap-3 mb-4">
                {[1, 2, 3, 4].map(level => (
                  <label key={level} className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="complexity"
                      value={level}
                      checked={maxComplexity === level}
                      onChange={() => handleComplexityChange(level)}
                      className="form-radio h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2">
                      {level} {level === 1 ? '(Simplest)' : level === 4 ? '(Most Complex)' : ''}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* Players Column */}
        <div>
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => handleToggleSection('players')}>
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
                      canAddMorePlayers && canAddMoreTitans
                        ? 'bg-blue-700 hover:bg-blue-600' 
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                    onClick={() => handleAddPlayer(Team.Titans)}
                    disabled={!canAddMorePlayers || !canAddMoreTitans}
                  >
                    Add Player
                  </button>
                </div>
                
                <div className="flex justify-between">
                  <span>Atlanteans: {atlanteanCount} players</span>
                  <button
                    className={`px-3 py-1 rounded text-sm ${
                      canAddMorePlayers && canAddMoreAtlanteans
                        ? 'bg-red-700 hover:bg-red-600' 
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                    onClick={() => handleAddPlayer(Team.Atlanteans)}
                    disabled={!canAddMorePlayers || !canAddMoreAtlanteans}
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
              
              {!canAddMoreTitans && titanCount >= 5 && (
                <div className="text-amber-400 text-sm mt-2">
                  Maximum 5 Titans players allowed
                </div>
              )}
              
              {!canAddMoreAtlanteans && atlanteanCount >= 5 && (
                <div className="text-amber-400 text-sm mt-2">
                  Maximum 5 Atlanteans players allowed
                </div>
              )}
              
              {/* UPDATED: Changed team balance warning to handle both completely unbalanced teams
                  and teams with a 1-player difference */}
              {titanCount !== atlanteanCount && (
                <div className={`text-amber-400 text-sm mt-2 ${Math.abs(titanCount - atlanteanCount) > 1 ? "text-red-400" : ""}`}>
                  {Math.abs(titanCount - atlanteanCount) > 1 
                    ? "Teams must have equal player counts or differ by only 1 player" 
                    : "Teams are uneven. The team with more players will need to use handicap cards."}
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
                  Not enough heroes ({heroCount}) for {totalPlayers} players. Select more expansions or increase complexity.
                </div>
              )}
              
              {/* Success messages - both for even and uneven but valid team configurations */}
              {titanCount > 0 && titanCount === atlanteanCount && allPlayersHaveNames && teamsHaveMinPlayers && duplicateNames.length === 0 && (
                <div className="text-emerald-400 text-sm mt-2">
                  Teams are balanced with {titanCount} players each
                </div>
              )}
              
              {/* NEW: Success message for valid uneven teams */}
              {titanCount > 0 && atlanteanCount > 0 && titanCount !== atlanteanCount && 
               Math.abs(titanCount - atlanteanCount) === 1 &&
               allPlayersHaveNames && teamsHaveMinPlayers && duplicateNames.length === 0 && (
                <div className="text-emerald-400 text-sm mt-2">
                  Teams are valid: {titanCount} Titans vs {atlanteanCount} Atlanteans
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Expansions Section */}
      <div className="mb-8">
        <h3 className="text-xl mb-3 cursor-pointer flex items-center"
            onClick={() => handleToggleSection('expansions')}>
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
                    onChange={() => handleToggleExpansion(expansion)}
                    className="mr-2 h-5 w-5"
                  />
                  <span>{expansion}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Player Names Section */}
      {players.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl mb-3 cursor-pointer flex items-center"
              onClick={() => handleToggleSection('names')}>
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
                    onRemove={() => {
                      playSound('buttonClick');
                      onRemovePlayer(player.id);
                    }}
                    isDuplicate={isDuplicate}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
      
{/* Action Buttons - UPDATED to include View Matches */}
<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
  {/* View Matches Button */}
  <div className="relative">
    <EnhancedTooltip 
      text={hasMatchData 
        ? "View match statistics and player records"
        : "No match data available yet. Play a game first!"}
      position="top"
    >
      <button
        className={`px-6 py-3 rounded-lg font-medium text-white ${
          hasMatchData
            ? 'bg-green-600 hover:bg-green-500'
            : 'bg-gray-600 cursor-not-allowed'
        }`}
        onClick={handleViewMatches}
        disabled={!hasMatchData}
      >
        <div className="flex items-center">
          <BarChart size={20} className="mr-2" />
          View Matches
        </div>
      </button>
    </EnhancedTooltip>
  </div>

  {/* Draft Heroes Button */}
  <div className="relative">
    <EnhancedTooltip 
      text="Click to select heroes for each player and start the game."
      position="top"
    >
      <button
        className={`px-6 py-3 rounded-lg font-medium text-white ${
          canDraft
            ? 'bg-blue-600 hover:bg-blue-500'
            : 'bg-gray-600 cursor-not-allowed'
        }`}
        onClick={handleDraftHeroes}
        disabled={!canDraft}
      >
        Draft Heroes
      </button>
    </EnhancedTooltip>
  </div>
</div>

  {/* Hero count info - Repositioned */}
  <div className="text-sm text-center w-full mt-4">
    <div className="flex flex-wrap justify-center gap-4">
      <span className="text-blue-300">Available heroes: {heroCount}</span>
      {totalPlayers > 0 && (
        <span className="text-yellow-300">
          {canStartDrafting 
            ? "✓ Enough heroes for drafting" 
            : "✗ Not enough heroes for drafting"}
        </span>
      )}
    </div>
  </div>
      
     <p className="mt-4 text-xs text-gray-300 text-center mb-2">
        Disclaimer: This is not an official product and has not been approved by Wolff Designa. All game content is the sole property of Wolff Designa.
      </p>
    </div>
  );
};

export default GameSetup;