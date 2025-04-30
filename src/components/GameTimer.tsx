// src/components/GameTimer.tsx
import React from 'react';
import { GameState, Player, Team, Lane } from '../types';
import { Clock, Plus, Check, RotateCcw } from 'lucide-react';

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
  onFlipCoin: () => void;
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
  onFlipCoin
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
        </div>
        
        {/* Game State */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="flex justify-between mb-2">
            <div>
              <span className="text-sm text-gray-400">Round</span>
              <div className="text-2xl font-bold">{gameState.round}</div>
            </div>
            <div>
              <span className="text-sm text-gray-400">Turn</span>
              <div className="text-2xl font-bold">{gameState.turn}/4</div>
            </div>
            
            {/* We'll remove the wave counter from here for multiple lanes */}
            {!gameState.hasMultipleLanes && (
              <div className="relative group">
                <span className="text-sm text-gray-400">Wave</span>
                <div className="flex items-center justify-center">
                  <div className="text-2xl font-bold">
                    {gameState.waves[Lane.Single]?.currentWave || 1}/{gameState.waves[Lane.Single]?.totalWaves || 3}
                  </div>
                  {/* Plus button to increment wave */}
                  <button 
                    className="ml-1 bg-amber-600 hover:bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center text-xs"
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
          <div className="mt-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-gray-700 text-sm">
              {gameState.currentPhase === 'strategy' && 'Strategy Phase'}
              {gameState.currentPhase === 'move' && 'Move Phase'}
              {gameState.currentPhase === 'turn-end' && 'Turn Complete'}
            </span>
          </div>
          
          {/* Wave Counters - Multiple Lanes - Now in its own section below the main game state */}
          {gameState.hasMultipleLanes && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-lg font-bold mb-2">Wave Counters</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative bg-gray-700/50 p-2 rounded">
                  <span className="text-sm text-gray-300">Top Lane</span>
                  <div className="flex items-center justify-center mt-1">
                    <div className="text-xl font-bold">
                      {gameState.waves[Lane.Top]?.currentWave || 1}/{gameState.waves[Lane.Top]?.totalWaves || 7}
                    </div>
                    {/* Plus button to increment top lane wave */}
                    <button 
                      className="ml-1 bg-amber-600 hover:bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      onClick={() => onIncrementWave(Lane.Top)}
                      disabled={
                        !gameState.waves[Lane.Top] || 
                        gameState.waves[Lane.Top].currentWave >= gameState.waves[Lane.Top].totalWaves
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="relative bg-gray-700/50 p-2 rounded">
                  <span className="text-sm text-gray-300">Bottom Lane</span>
                  <div className="flex items-center justify-center mt-1">
                    <div className="text-xl font-bold">
                      {gameState.waves[Lane.Bottom]?.currentWave || 1}/{gameState.waves[Lane.Bottom]?.totalWaves || 7}
                    </div>
                    {/* Plus button to increment bottom lane wave */}
                    <button 
                      className="ml-1 bg-amber-600 hover:bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      onClick={() => onIncrementWave(Lane.Bottom)}
                      disabled={
                        !gameState.waves[Lane.Bottom] || 
                        gameState.waves[Lane.Bottom].currentWave >= gameState.waves[Lane.Bottom].totalWaves
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3">
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
        </div>
      </div>
      
      {/* Timer Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        {gameState.currentPhase === 'strategy' ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Strategy Phase - Turn {gameState.turn}</h2>
            <div className="text-6xl font-bold mb-6">{formatTime(strategyTimeRemaining)}</div>
            <div className="flex justify-center gap-4">
              {strategyTimerActive ? (
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
              )}
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
            <h2 className="text-2xl font-bold mb-4">Move Phase</h2>
            
            {activePlayer && activePlayer.hero ? (
              <div className="mb-4">
                <div 
                  className={`inline-block py-2 px-4 rounded-lg text-white font-medium ${
                    activePlayer.team === Team.Titans ? 'bg-blue-700' : 'bg-red-700'
                  }`}
                >
                  {activePlayer.team === Team.Titans ? 'Titans' : 'Atlanteans'}
                </div>
                <div className="flex items-center justify-center mt-2">
                  <div className="w-12 h-12 bg-gray-300 rounded-full overflow-hidden mr-3">
                    <img 
                      src={activePlayer.hero.icon} 
                      alt={activePlayer.hero.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/48?text=Hero';
                      }}
                    />
                  </div>
                  <div className="text-xl font-bold">{activePlayer.hero.name}</div>
                </div>
              </div>
            ) : (
              <div className="mb-4 text-amber-300">No active player</div>
            )}
            
            <div className="text-6xl font-bold mb-6">{formatTime(moveTimeRemaining)}</div>
            
            <div className="flex justify-center gap-4">
              {moveTimerActive ? (
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
              )}
              <button 
                className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium flex items-center"
                onClick={onCompletePlayerTurn}
              >
                <Check size={18} className="mr-2" />
                Complete Turn
              </button>
            </div>
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
      
      {/* Player Selection Grid - FIXED: Shows all players with no lane tags */}
      {gameState.currentPhase !== 'turn-end' && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">
            {gameState.currentPhase === 'strategy' 
              ? 'Players (waiting for strategy phase to end)' 
              : 'Select Player'}
          </h3>
          
          {/* Display all players in a single grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
        className={`p-3 rounded-lg transition-all relative ${
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
            <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden mr-2">
              <img 
                src={player.hero.icon} 
                alt={player.hero.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/40?text=Hero';
                }}
              />
            </div>
          )}
          <div>
            <div className="font-medium">{player.hero?.name || 'Unknown Hero'}</div>
            <div className="text-xs text-gray-300">
              Player {player.id}
              {/* Removed lane tag display */}
            </div>
          </div>
        </div>
        
        {/* Status indicators */}
        {hasCompleted && (
          <div className="absolute top-1 right-1 bg-green-600 rounded-full p-0.5" title="Completed">
            <Check size={14} />
          </div>
        )}
        
        {isActive && (
          <div className="absolute top-1 right-1 bg-yellow-500 rounded-full p-0.5 animate-pulse" title="Active">
            <Clock size={14} />
          </div>
        )}
      </div>
    );
  }
};

export default GameTimer;