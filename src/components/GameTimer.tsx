// src/components/GameTimer.tsx
import React from 'react';
import { GameState, Player, Team, Lane } from '../types';
import { Clock, Plus, Minus, Check, RotateCcw, Award, Infinity } from 'lucide-react';
import EnhancedTooltip from './common/EnhancedTooltip';

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
  // New props for timer toggling
  strategyTimerEnabled: boolean;
  moveTimerEnabled: boolean;
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
  moveTimerEnabled
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const activePlayer = gameState.activeHeroIndex >= 0 
    ? players[gameState.activeHeroIndex] 
    : null;

  return (
    <div className="game-timer">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Titans Life Counter */}
        <div className="bg-blue-900/50 rounded-lg p-4 text-center">
          <h3 className="text-xl font-bold mb-2">Titans Lives</h3>
          <div className="flex justify-center items-center gap-4">
            <button 
              className="bg-blue-700 hover:bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => onAdjustTeamLife(Team.Titans, -1)}
            >
              -
            </button>
            <span className="text-4xl font-bold">{gameState.teamLives[Team.Titans]}</span>
            <button 
              className="bg-blue-700 hover:bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => onAdjustTeamLife(Team.Titans, 1)}
            >
              +
            </button>
          </div>
          
          {/* New: Titans Victory Button */}
          <button
            className="mt-4 w-full bg-blue-700 hover:bg-blue-600 rounded-lg py-2 px-4 flex items-center justify-center"
            onClick={() => onDeclareVictory(Team.Titans)}
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
                  onClick={() => onAdjustRound(-1)}
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold">{gameState.round}</div>
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center ml-2"
                  onClick={() => onAdjustRound(1)}
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
                  onClick={() => onAdjustTurn(-1)}
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-bold">{gameState.turn}/4</div>
                <button 
                  className="bg-gray-700 hover:bg-gray-600 rounded-full w-7 h-7 flex items-center justify-center ml-2"
                  onClick={() => onAdjustTurn(1)}
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
                    onClick={() => onDecrementWave(Lane.Single)}
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
                    onClick={() => onIncrementWave(Lane.Single)}
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
                      onClick={() => onDecrementWave(Lane.Top)}
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
                      onClick={() => onIncrementWave(Lane.Top)}
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
                      onClick={() => onDecrementWave(Lane.Bottom)}
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
                      onClick={() => onIncrementWave(Lane.Bottom)}
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
                onClick={onFlipCoin}
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
              onClick={() => onAdjustTeamLife(Team.Atlanteans, -1)}
            >
              -
            </button>
            <span className="text-4xl font-bold">{gameState.teamLives[Team.Atlanteans]}</span>
            <button 
              className="bg-red-700 hover:bg-red-600 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
              onClick={() => onAdjustTeamLife(Team.Atlanteans, 1)}
            >
              +
            </button>
          </div>
          
          {/* New: Atlanteans Victory Button */}
          <button
            className="mt-4 w-full bg-red-700 hover:bg-red-600 rounded-lg py-2 px-4 flex items-center justify-center"
            onClick={() => onDeclareVictory(Team.Atlanteans)}
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
            <div className="text-6xl font-bold mb-6 flex justify-center items-center">
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
                    onClick={onPauseStrategyTimer}
                  >
                    Pause
                  </button>
                ) : (
                  <button 
                    className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-white font-medium"
                    onClick={onStartStrategyTimer}
                  >
                    Resume
                  </button>
                )
              )}
              
              {/* Always show End Strategy Phase button */}
              <button 
                className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium"
                onClick={onEndStrategyPhase}
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
                      <div className="text-2xl font-bold">{activePlayer.hero.name}</div>
                      <div className="text-lg text-gray-300">{activePlayer.name}</div>
                    </div>
                  </div>
                  
                  {/* Only show timer when a player is selected */}
                  <div className="text-6xl font-bold my-6 flex justify-center items-center">
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
                          onClick={onPauseMoveTimer}
                        >
                          Pause
                        </button>
                      ) : (
                        <button 
                          className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg text-white font-medium"
                          onClick={onStartMoveTimer}
                        >
                          Resume
                        </button>
                      )
                    )}
                    
                    {/* Always show Complete Turn button */}
                    <button 
                      className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium flex items-center"
                      onClick={onCompletePlayerTurn}
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
              onClick={onStartNextTurn}
            >
              <RotateCcw size={20} className="mr-2" />
              Start Next Turn
            </button>
          </div>
        )}
      </div>
      
      {/* Player Selection Grid - No changes needed here */}
      {gameState.currentPhase !== 'turn-end' && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">
            {gameState.currentPhase === 'strategy' 
              ? 'Players (waiting for strategy phase to end)' 
              : 'Select Player'}
          </h3>
          
          {/* Display all players in a grid with larger tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {players.map((player, index) => (
              player.hero && renderPlayerCard(player, index)
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  // Helper function to render player cards with status
  function renderPlayerCard(player: Player, index: number) {
    const isActive = gameState.activeHeroIndex === index;
    const hasCompleted = gameState.completedTurns.includes(index);
    const isSelectable = gameState.currentPhase === 'move' && !hasCompleted && !isActive;
    
    return (
      <div
        key={player.id}
        className={`p-4 rounded-lg transition-all relative ${
          // Different styles based on player status
          isActive
            ? player.team === Team.Titans
              ? 'bg-blue-700 ring-4 ring-white'
              : 'bg-red-700 ring-4 ring-white'
            : hasCompleted
            ? 'bg-gray-700 opacity-60' // Greyed out for completed players
            : player.team === Team.Titans
            ? 'bg-blue-900/50 hover:bg-blue-800'
            : 'bg-red-900/50 hover:bg-red-800'
        } ${isSelectable ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (isSelectable) {
            onSelectPlayer(index);
          }
        }}
      >
        <div className="flex items-center">
          {player.hero && (
            <div className="w-16 h-16 bg-gray-300 rounded-full overflow-hidden mr-3 flex-shrink-0">
              <img 
                src={player.hero.icon} 
                alt={player.hero.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/64?text=Hero';
                }}
              />
            </div>
          )}
          <div>
            <div className="text-lg font-bold mb-1">{player.hero?.name || 'Unknown Hero'}</div>
            <div className="text-base text-gray-300">{player.name || `Player ${player.id}`}</div>
            {player.lane && (
              <div className="text-xs text-gray-400 mt-1">
                {player.lane === Lane.Top ? 'Top Lane' : 'Bottom Lane'}
              </div>
            )}
          </div>
        </div>
        
        {/* Status indicators */}
        {hasCompleted && (
          <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1" title="Completed">
            <Check size={18} />
          </div>
        )}
        
        {isActive && (
          <div className="absolute top-2 right-2 bg-yellow-500 rounded-full p-1 animate-pulse" title="Active">
            <Clock size={18} />
          </div>
        )}
      </div>
    );
  }
};

export default GameTimer;