// src/components/GameSetup.tsx
import React from 'react';
import { Player, Team } from '../types';

interface GameSetupProps {
  strategyTime: number;
  moveTime: number;
  onStrategyTimeChange: (time: number) => void;
  onMoveTimeChange: (time: number) => void;
  players: Player[];
  onAddPlayer: (team: Team) => void;
  onStartGame: () => void;
}

const GameSetup: React.FC<GameSetupProps> = ({
  strategyTime,
  moveTime,
  onStrategyTimeChange,
  onMoveTimeChange,
  players,
  onAddPlayer,
  onStartGame
}) => {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Game Setup</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-xl mb-3">Timer Settings</h3>
          
          <div className="mb-4">
            <label className="block mb-2">Strategy Timer: {formatTime(strategyTime)}</label>
            <input
              type="range"
              min="30"
              max="300"
              step="30"
              value={strategyTime}
              onChange={(e) => onStrategyTimeChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>30s</span>
              <span>1m</span>
              <span>2m</span>
              <span>3m</span>
              <span>4m</span>
              <span>5m</span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block mb-2">Move Timer: {formatTime(moveTime)}</label>
            <input
              type="range"
              min="10"
              max="120"
              step="10"
              value={moveTime}
              onChange={(e) => onMoveTimeChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>10s</span>
              <span>30s</span>
              <span>1m</span>
              <span>1m30s</span>
              <span>2m</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-xl mb-3">Players</h3>
          
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Titans: {players.filter(p => p.team === Team.Titans).length} players</span>
              <button
                className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded text-sm"
                onClick={() => onAddPlayer(Team.Titans)}
              >
                Add Player
              </button>
            </div>
            
            <div className="flex justify-between">
              <span>Atlanteans: {players.filter(p => p.team === Team.Atlanteans).length} players</span>
              <button
                className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
                onClick={() => onAddPlayer(Team.Atlanteans)}
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <button
        className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg font-medium text-white w-full"
        onClick={onStartGame}
        disabled={players.length === 0}
      >
        Start Game
      </button>
    </div>
  );
};

export default GameSetup;