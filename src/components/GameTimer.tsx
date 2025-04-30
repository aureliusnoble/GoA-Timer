// src/components/GameTimer.tsx
import React from 'react';
import { GameState, Player, Team } from '../types';

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
  onNextPlayer: () => void;
  onAdjustTeamLife: (team: Team, delta: number) => void;
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
  onNextPlayer,
  onAdjustTeamLife,
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
              <div className="text-2xl font-bold">{gameState.turn}</div>
            </div>
            <div>
              <span className="text-sm text-gray-400">Wave</span>
              <div className="text-2xl font-bold">{gameState.waveCounter}</div>
            </div>
          </div>
          
          <div className="mt-3">
            <button 
              className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg text-white"
              onClick={onFlipCoin}
            >
              Flip Coin: <span className="font-bold capitalize">{gameState.coinSide}</span>
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
            <h2 className="text-2xl font-bold mb-4">Strategy Phase</h2>
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
        ) : (
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
                className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg text-white font-medium"
                onClick={onNextPlayer}
              >
                Next Player
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Player Selection for Move Phase */}
      {gameState.currentPhase === 'move' && (
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-3">Quick Select Player</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {players.map((player, index) => (
              player.hero && (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    gameState.activeHeroIndex === index
                      ? player.team === Team.Titans
                        ? 'bg-blue-700'
                        : 'bg-red-700'
                      : player.team === Team.Titans
                      ? 'bg-blue-900/50 hover:bg-blue-800'
                      : 'bg-red-900/50 hover:bg-red-800'
                  }`}
                  onClick={() => {
                    // Set this player as active and reset timer
                    if (gameState.activeHeroIndex !== index) {
                      // This would need to update the game state and reset the timer
                      // For this mockup, we'll just show that it's selectable
                    }
                  }}
                >
                  <div className="flex items-center">
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
                    <div>
                      <div className="font-medium">{player.hero.name}</div>
                      <div className="text-xs text-gray-300">Player {player.id}</div>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameTimer;