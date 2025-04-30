// src/components/PlayerNameInput.tsx
import React from 'react';
import { Player, Team } from '../types';

interface PlayerNameInputProps {
  player: Player;
  onNameChange: (name: string) => void;
}

const PlayerNameInput: React.FC<PlayerNameInputProps> = ({ 
  player, 
  onNameChange 
}) => {
  return (
    <div 
      className={`p-3 rounded-lg ${
        player.team === Team.Titans 
          ? 'bg-blue-900/30 border border-blue-800' 
          : 'bg-red-900/30 border border-red-800'
      }`}
    >
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          player.team === Team.Titans ? 'bg-blue-500' : 'bg-red-500'
        }`}></div>
        <span className="text-sm font-medium">
          Player {player.id} - {player.team === Team.Titans ? 'Titans' : 'Atlanteans'}
        </span>
      </div>
      
      <input
        type="text"
        value={player.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Enter player name"
        className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
};

export default PlayerNameInput;