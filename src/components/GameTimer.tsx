// src/components/GameTimer.tsx
import React, { useEffect, useState } from 'react';
import { GameState, Player, Team, Lane } from '../types';
import { 
  Clock, 
  Plus, 
  Minus, 
  Check, 
  RotateCcw, 
  Award, 
  Infinity, 
  Swords, 
  Skull, 
  Users, 
  Bot, 
  Coins,
  Star
} from 'lucide-react';
import EnhancedTooltip from './common/EnhancedTooltip';
import { useSound } from '../context/SoundContext';
import EndOfRoundAssistant, { PlayerRoundStats } from './EndOfRoundAssistant';

interface GameTimerProps {
  gameState: GameState;
  players: Player[];
  strategyTimeRemaining: number;
  moveTimeRemaining: number;
  strategyTimerActive: boolean;
  moveTimerActive: boolean;
  onStartStrategyTimer: () => void;
  onPauseStrategyTimer: () => void;
  onEndStrategyPhase: () => void;
  onStartMoveTimer: () => void;
  onPauseMoveTimer: () => void;
  onSelectPlayer: (playerIndex: number) => void;
  onCompletePlayerTurn: () => void;
  onStartNextTurn: () => void;
  onAdjustTeamLife: (team: Team, delta: number) => void;
  onIncrementWave: (lane: Lane) => void;
  onDecrementWave: (lane: Lane) => void;
  onAdjustRound: (delta: number) => void;
  onAdjustTurn: (delta: number) => void;
  onDeclareVictory: (team: Team) => void;
  onFlipCoin: () => void;
  // New props
  strategyTimerEnabled: boolean;
  moveTimerEnabled: boolean;
  onSavePlayerStats?: (playerStats: { [playerId: number]: PlayerRoundStats }) => void;
}

const GameTimer: React.FC<GameTimerProps> = ({
  gameState,
  players,
  strategyTimeRemaining,
  moveTimeRemaining,
  strategyTimerActive,
  moveTimerActive,
  onStartStrategyTimer,
  onPauseStrategyTimer,
  onEndStrategyPhase,
  onStartMoveTimer,
  onPauseMoveTimer,
  onSelectPlayer,
  onCompletePlayerTurn,
  onStartNextTurn,
  onAdjustTeamLife,
  onIncrementWave,
  onDecrementWave,
  onAdjustRound,
  onAdjustTurn,
  onDeclareVictory,
  onFlipCoin,
  // New props
  strategyTimerEnabled,
  moveTimerEnabled,
  onSavePlayerStats
}) => {
  const { playSound } = useSound();
  
  // New state for end of round assistant
  const [showEndOfRoundAssistant, setShowEndOfRoundAssistant] = useState<boolean>(false);
  
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const activePlayer = gameState.activeHeroIndex >= 0 
    ? players[gameState.activeHeroIndex] 
    : null;
  
  // Play warning sounds for low time
  useEffect(() => {
    if (strategyTimerActive && strategyTimerEnabled) {
      // Play warning at 10 seconds
      if (strategyTimeRemaining === 10) {
        playSound('timerWarning');
      }
      
      // Play tick sound every second if time is > 0
      if (strategyTimeRemaining > 0) {
        playSound('timerTick');
      }
    }
  }, [strategyTimeRemaining, strategyTimerActive, strategyTimerEnabled, playSound]);
  
  useEffect(() => {
    if (moveTimerActive && moveTimerEnabled) {
      // Play warning at 10 seconds
      if (moveTimeRemaining === 10) {
        playSound('timerWarning');
      }
      
      // Play tick sound every second if time is > 0
      if (moveTimeRemaining > 0) {
        playSound('timerTick');
      }
    }
  }, [moveTimeRemaining, moveTimerActive, moveTimerEnabled, playSound]);

  // Button click handlers with sound
  const handleButtonClick = () => {
    playSound('buttonClick');
  };
  
  const handleStartStrategyTimer = () => {
    playSound('buttonClick');
    onStartStrategyTimer();
  };
  
  const handlePauseStrategyTimer = () => {
    playSound('buttonClick');
    onPauseStrategyTimer();
  };
  
  const handleEndStrategyPhase = () => {
    playSound('phaseChange');
    onEndStrategyPhase();
  };
  
  const handleStartMoveTimer = () => {
    playSound('buttonClick');
    onStartMoveTimer();
  };
  
  const handlePauseMoveTimer = () => {
    playSound('buttonClick');
    onPauseMoveTimer();
  };
  
  const handleCompletePlayerTurn = () => {
    playSound('turnComplete');
    onCompletePlayerTurn();
  };
  
  // Modified to show end of round assistant when all players have moved
  const handleStartNextTurn = () => {
    // Show the end of round assistant if this is the end of turn 4
    if (gameState.turn === 4) {
      setShowEndOfRoundAssistant(true);
    } else {
      // Otherwise just start the next turn as usual
      playSound('turnStart');
      onStartNextTurn();
    }
  };
  
  // Handler for completing the end of round process
  const handleEndOfRoundComplete = (stats?: { [playerId: number]: PlayerRoundStats }) => {
    // Save stats if provided
    if (stats && onSavePlayerStats) {
      onSavePlayerStats(stats);
    }
    
    // Hide the assistant
    setShowEndOfRoundAssistant(false);
    
    // Start the next turn
    playSound('turnStart');
    onStartNextTurn();
  };
  
  const handleDeclareVictory = (team: Team) => {
    playSound('victory');
    onDeclareVictory(team);
  };
  
  const handleFlipCoin = () => {
    playSound('coinFlip');
    onFlipCoin();
  };
  
  const handleAdjustTeamLife = (team: Team, delta: number) => {
    playSound('lifeChange');
    onAdjustTeamLife(team, delta);
  };

  return (
    <div className="game-timer">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Titans Life Counter */}
        <div className="bg-blue-900/50 rounded-lg p-4 text-center">
          <h3 className="text-xl font-bold mb-2">Titans Lives</h3>
          <div className="flex justify-center items-center gap-4">
            <button 
              className="bg-blue-700 hover:bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => handleAdjustTeamLife(Team.Titans, -1)}
            >
              -
            </button>
            <span className="text-4xl font-bold">{gameState.teamLives[Team.Titans]}</span>
            <button 
              className="bg-blue-700 hover:bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => handleAdjustTeamLife(Team.Titans, 1)}
            >
              +
            </button>
          </div>
          
          {/* New: Titans Victory Button */}
          <button
            className="mt-4 w-full bg-blue-700 hover:bg-blue-600 rounded-lg py-2 px-4 flex items-center justify-center"
            onClick={() => handleDeclareVictory(Team.Titans)}
          >
            <Award size={18} className="mr-2" />
            <span>Declare Titan Victory</span>
          </button>
        </div>
        
        {/* Game State */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="flex justify-between mb-4">
            {/* Round counter with +/- buttons */}
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-400 mb-1">Round</span>
              <div className="flex items-center">
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center mr-2"
                  onClick={() => {
                    handleButtonClick();
                    onAdjustRound(-1);
                  }}
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold">{gameState.round}</div>
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center ml-2"
                  onClick={() => {
                    handleButtonClick();
                    onAdjustRound(1);
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            
            {/* Turn counter with +/- buttons */}
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-400 mb-1">Turn</span>
              <div className="flex items-center">
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center mr-2"
                  onClick={() => {
                    handleButtonClick();
                    onAdjustTurn(-1);
                  }}
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold">{gameState.turn}/4</div>
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center ml-2"
                  onClick={() => {
                    handleButtonClick();
                    onAdjustTurn(1);
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            
            {/* We'll keep the wave counter here for single lane */}
            {!gameState.hasMultipleLanes && (
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 mb-1">Wave</span>
                <div className="flex items-center">
                  <button 
                    className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center mr-2"
                    onClick={() => {
                      handleButtonClick();
                      onDecrementWave(Lane.Single);
                    }}
                    disabled={
                      !gameState.waves[Lane.Single] || 
                      gameState.waves[Lane.Single].currentWave <= 1
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <div className="text-2xl font-bold">
                    {gameState.waves[Lane.Single]?.currentWave || 1}/{gameState.waves[Lane.Single]?.totalWaves || 3}
                  </div>
                  <button 
                    className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center ml-2"
                    onClick={() => {
                      handleButtonClick();
                      onIncrementWave(Lane.Single);
                    }}
                    disabled={
                      !gameState.waves[Lane.Single] || 
                      gameState.waves[Lane.Single].currentWave >= gameState.waves[Lane.Single].totalWaves
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Phase indicator */}
          <div className="mt-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-gray-700 text-sm">
              {gameState.currentPhase === 'strategy' && 'Strategy Phase'}
              {gameState.currentPhase === 'move' && 'Action Phase'}
              {gameState.currentPhase === 'turn-end' && 'Turn Complete'}
            </span>
          </div>
          
          {/* Wave Counters - Multiple Lanes - Now with minus buttons */}
          {gameState.hasMultipleLanes && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-lg font-bold mb-2">Wave Counters</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative bg-gray-700/50 p-2 rounded">
                  <span className="text-sm text-gray-300">Top Lane</span>
                  <div className="flex items-center justify-center mt-1">
                    <button 
                      className="bg-gray-600 hover:bg-gray-500 rounded-full w-6 h-6 flex items-center justify-center mr-2"
                      onClick={() => {
                        handleButtonClick();
                        onDecrementWave(Lane.Top);
                      }}
                      disabled={
                        !gameState.waves[Lane.Top] || 
                        gameState.waves[Lane.Top].currentWave <= 1
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <div className="text-xl font-bold">
                      {gameState.waves[Lane.Top]?.currentWave || 1}/{gameState.waves[Lane.Top]?.totalWaves || 7}
                    </div>
                    <button 
                      className="bg-gray-600 hover:bg-gray-500 rounded-full w-6 h-6 flex items-center justify-center ml-2"
                      onClick={() => {
                        handleButtonClick();
                        onIncrementWave(Lane.Top);
                      }}
                      disabled={
                        !gameState.waves[Lane.Top] || 
                        gameState.waves[Lane.Top].currentWave >= gameState.waves[Lane.Top].totalWaves
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="relative bg-gray-700/50 p-2 rounded">
                  <span className="text-sm text-gray-300">Bottom Lane</span>
                  <div className="flex items-center justify-center mt-1">
                    <button 
                      className="bg-gray-600 hover:bg-gray-500 rounded-full w-6 h-6 flex items-center justify-center mr-2"
                      onClick={() => {
                        handleButtonClick();
                        onDecrementWave(Lane.Bottom);
                      }}
                      disabled={
                        !gameState.waves[Lane.Bottom] || 
                        gameState.waves[Lane.Bottom].currentWave <= 1
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <div className="text-xl font-bold">
                      {gameState.waves[Lane.Bottom]?.currentWave || 1}/{gameState.waves[Lane.Bottom]?.totalWaves || 7}
                    </div>
                    <button 
                      className="bg-gray-600 hover:bg-gray-500 rounded-full w-6 h-6 flex items-center justify-center ml-2"
                      onClick={() => {
                        handleButtonClick();
                        onIncrementWave(Lane.Bottom);
                      }}
                      disabled={
                        !gameState.waves[Lane.Bottom] || 
                        gameState.waves[Lane.Bottom].currentWave >= gameState.waves[Lane.Bottom].totalWaves
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3">
            {/* Added tooltip to tiebreaker button */}
            <EnhancedTooltip text="Click to flip the tie-breaker coin">
              <button
                className={`flex items-center justify-center px-4 py-2 rounded-lg text-white ${
                  gameState.coinSide === Team.Titans 
                    ? 'bg-blue-700 hover:bg-blue-600' 
                    : 'bg-orange-600 hover:bg-orange-500'
                }`}
                onClick={handleFlipCoin}
              >
                <span className="mr-2">Tiebreaker:</span>
                <span className="font-bold">
                  {gameState.coinSide === Team.Titans ? 'Titans' : 'Atlanteans'}
                </span>
              </button>
            </EnhancedTooltip>
          </div>
        </div>
        
        {/* Atlanteans Life Counter */}
        <div className="bg-red-900/50 rounded-lg p-4 text-center">
          <h3 className="text-xl font-bold mb-2">Atlanteans Lives</h3>
          <div className="flex justify-center items-center gap-4">
            <button 
              className="bg-red-700 hover:bg-red-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => handleAdjustTeamLife(Team.Atlanteans, -1)}
            >
              -
            </button>
            <span className="text-4xl font-bold">{gameState.teamLives[Team.Atlanteans]}</span>
            <button 
              className="bg-red-700 hover:bg-red-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => handleAdjustTeamLife(Team.Atlanteans, 1)}
            >
              +
            </button>
          </div>
          
          {/* New: Atlanteans Victory Button */}
          <button
            className="mt-4 w-full bg-red-700 hover:bg-red-600 rounded-lg py-2 px-4 flex items-center justify-center"
            onClick={() => handleDeclareVictory(Team.Atlanteans)}
          >
            <Award size={18} className="mr-2" />
            <span>Declare Atlantean Victory</span>
          </button>
        </div>
      </div>
      
      {/* Timer Section - Updated to handle disabled timers */}
      <div className="bg-gray-800 rounded-lg p-6">
        {gameState.currentPhase === 'strategy' ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Strategy Phase - Turn {gameState.turn}</h2>
            
            {/* Timer display - show infinity symbol if timer is disabled */}
            <div className={`text-6xl font-bold mb-6 flex justify-center items-center ${
              strategyTimerEnabled && strategyTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : ''
            }`}>
              {strategyTimerEnabled ? (
                formatTime(strategyTimeRemaining)
              ) : (
                <Infinity size={64} className="text-gray-300" />
              )}
            </div>
            
            <div className="flex justify-center gap-4">
              {/* Only show pause/resume buttons if timer is enabled */}
              {strategyTimerEnabled && (
                strategyTimerActive ? (
                  <button 
                    className="bg-amber-600 hover:bg-amber-500 px-6 py-3 rounded-lg text-white font-medium"
                    onClick={handlePauseStrategyTimer}
                  >
                    Pause
                  </button>
                ) : (
                  <button 
                    className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-white font-medium"
                    onClick={handleStartStrategyTimer}
                  >
                    Resume
                  </button>
                )
              )}
              
              {/* Always show End Strategy Phase button */}
              <button 
                className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium"
                onClick={handleEndStrategyPhase}
              >
                End Strategy Phase
              </button>
            </div>
          </div>
        ) : gameState.currentPhase === 'move' ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Action Phase</h2>
            
            {activePlayer && activePlayer.hero ? (
              <>
                <div className="mb-4">
                  <div 
                    className={`inline-block py-2 px-4 rounded-lg text-white font-medium ${
                      activePlayer.team === Team.Titans ? 'bg-blue-700' : 'bg-red-700'
                    }`}
                  >
                    {activePlayer.team === Team.Titans ? 'Titans' : 'Atlanteans'}
                  </div>
                  <div className="flex items-center justify-center mt-2">
                    <div className="w-16 h-16 bg-gray-300 rounded-full overflow-hidden mr-3">
                      <img 
                        src={activePlayer.hero.icon} 
                        alt={activePlayer.hero.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/64?text=Hero';
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center text-2xl font-bold">
                        {activePlayer.hero.name}
                        <span className="ml-2 text-sm bg-yellow-500/70 text-white px-1.5 py-0.5 rounded-full">
                          <Star size={14} className="inline mr-0.5" />
                          {activePlayer.hero.complexity}
                        </span>
                      </div>
                      <div className="text-lg text-gray-300">{activePlayer.name}</div>
                    </div>
                  </div>
                  
                  {/* Only show timer when a player is selected */}
                  <div className={`text-6xl font-bold my-6 flex justify-center items-center ${
                    moveTimerEnabled && moveTimeRemaining <= 10 ? 'text-red-500 animate-pulse' : ''
                  }`}>
                    {moveTimerEnabled ? (
                      formatTime(moveTimeRemaining)
                    ) : (
                      <Infinity size={64} className="text-gray-300" />
                    )}
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    {/* Only show pause/resume buttons if timer is enabled */}
                    {moveTimerEnabled && (
                      moveTimerActive ? (
                        <button 
                          className="bg-amber-600 hover:bg-amber-500 px-6 py-3 rounded-lg text-white font-medium"
                          onClick={handlePauseMoveTimer}
                        >
                          Pause
                        </button>
                      ) : (
                        <button 
                          className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-white font-medium"
                          onClick={handleStartMoveTimer}
                        >
                          Resume
                        </button>
                      )
                    )}
                    
                    {/* Always show Complete Turn button */}
                    <button 
                      className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium flex items-center"
                      onClick={handleCompletePlayerTurn}
                    >
                      <Check size={18} className="mr-2" />
                      Complete Turn
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-xl text-amber-300">
                Select a player to start their action timer
              </div>
            )}
          </div>
        ) : (
          // Turn-end phase
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Turn {gameState.turn} Complete</h2>
            <p className="text-lg mb-6">All players have completed their actions</p>
            <button 
              className="bg-green-600 hover:bg-green-500 px-8 py-4 rounded-lg text-white font-medium text-xl flex items-center mx-auto"
              onClick={handleStartNextTurn}
            >
              <RotateCcw size={20} className="mr-2" />
              {gameState.turn === 4 ? "End Round" : "Start Next Turn"}
            </button>
          </div>
        )}
      </div>
      
      {/* Player Selection Grid - Improved layout with larger cards */}
      {gameState.currentPhase !== 'turn-end' && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">
            {gameState.currentPhase === 'strategy' 
              ? 'Players (waiting for strategy phase to end)' 
              : 'Select Player'}
          </h3>
          
          {/* Display all players in a grid with larger tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player, index) => (
              player.hero && renderPlayerCard(player, index)
            ))}
          </div>
        </div>
      )}
      
      {/* End of Round Assistant */}
      <EndOfRoundAssistant 
        players={players}
        onComplete={handleEndOfRoundComplete}
        isVisible={showEndOfRoundAssistant}
      />
    </div>
  );
  
  // Helper function to render player cards with status
  function renderPlayerCard(player: Player, index: number) {
    const isActive = gameState.activeHeroIndex === index;
    const hasCompleted = gameState.completedTurns.includes(index);
    const isSelectable = gameState.currentPhase === 'move' && !hasCompleted && !isActive;
    
    // Get player level (complexity is 1-4, representing player level)
    const playerLevel = player.hero?.complexity || 1;
    
    return (
      <div
        key={player.id}
        className={`p-5 rounded-lg transition-all relative shadow-md ${
          // Different styles based on player status
          isActive
            ? player.team === Team.Titans
              ? 'bg-blue-700 ring-4 ring-white'
              : 'bg-red-700 ring-4 ring-white'
            : hasCompleted
            ? 'bg-gray-700/90 opacity-60' // Greyed out for completed players
            : player.team === Team.Titans
            ? 'bg-blue-900/70 hover:bg-blue-800'
            : 'bg-red-900/70 hover:bg-red-800'
        } ${isSelectable ? 'cursor-pointer transform hover:scale-[1.02] hover:shadow-lg' : ''}`}
        onClick={() => {
          if (isSelectable) {
            // Play selection sound when selecting a player
            playSound('heroSelect');
            onSelectPlayer(index);
          }
        }}
      >
        <div className="flex items-start">
          {player.hero && (
            <div className="w-24 h-24 bg-gray-300 rounded-full overflow-hidden mr-4 flex-shrink-0 border-2 border-gray-600">
              <img 
                src={player.hero.icon} 
                alt={player.hero.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/96?text=Hero';
                }}
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div className="text-xl font-bold mb-1 flex items-center">
                {player.hero?.name || 'Unknown Hero'}
                <span className="ml-2 text-sm bg-yellow-500/80 text-white px-2 py-0.5 rounded-full">
                  <Star size={14} className="inline mr-0.5" />
                  {playerLevel}
                </span>
              </div>
              
              {/* Status indicators - moved to top right corner of card content */}
              {hasCompleted && (
                <div className="bg-green-600 rounded-full p-1.5 ml-2" title="Completed">
                  <Check size={20} />
                </div>
              )}
              
              {isActive && (
                <div className="bg-yellow-500 rounded-full p-1.5 ml-2 animate-pulse" title="Active">
                  <Clock size={20} />
                </div>
              )}
            </div>
            
            <div className="text-lg font-medium text-gray-100 mb-2">{player.name || `Player ${player.id}`}</div>
            
            {player.lane && (
              <div className="text-base text-gray-300 mb-2">
                {player.lane === Lane.Top ? 'Top Lane' : 'Bottom Lane'}
              </div>
            )}
            
            {/* Show player stats if available with icons - larger text */}
            {player.stats && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-base bg-black/20 p-2 rounded">
                <span className="flex items-center" title="Kills">
                  <Swords size={18} className="mr-2 text-blue-400" /> <span className="font-bold">{player.stats.totalKills}</span>
                </span>
                <span className="flex items-center" title="Deaths">
                  <Skull size={18} className="mr-2 text-red-400" /> <span className="font-bold">{player.stats.totalDeaths}</span>
                </span>
                <span className="flex items-center" title="Assists">
                  <Users size={18} className="mr-2 text-green-400" /> <span className="font-bold">{player.stats.totalAssists}</span>
                </span>
                <span className="flex items-center" title="Minion Kills">
                  <Bot size={18} className="mr-2 text-yellow-400" /> <span className="font-bold">{player.stats.totalMinionKills}</span>
                </span>
                <span className="flex items-center col-span-2 mt-1 justify-center bg-amber-900/30 py-1 px-2 rounded" title="Total Gold Earned">
                  <Coins size={18} className="mr-2 text-amber-400" /> <span className="font-bold">{player.stats.totalGoldEarned}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default GameTimer;