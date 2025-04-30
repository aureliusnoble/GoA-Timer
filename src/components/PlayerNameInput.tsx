// src/components/PlayerNameInput.tsx
import React from 'react';
import { Player, Team } from '../types';
import { AlertCircle, X } from 'lucide-react';

interface PlayerNameInputProps {
  player: Player;
  onNameChange: (name: string) => void;
  onRemove: () => void; // New prop for removing players
  isDuplicate?: boolean;
}

const PlayerNameInput: React.FC<PlayerNameInputProps> = ({ 
  player, 
  onNameChange,
  onRemove, // New prop
  isDuplicate = false 
}) => {
  return (
    <div 
      className={`p-3 rounded-lg ${
        player.team === Team.Titans 
          ? 'bg-blue-900/30 border border-blue-800' 
          : 'bg-red-900/30 border border-red-800'
      } ${isDuplicate ? 'border-2 border-yellow-500' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${
            player.team === Team.Titans ? 'bg-blue-500' : 'bg-red-500'
          }`}></div>
          <span className="text-sm font-medium">
            Player {player.id} - {player.team === Team.Titans ? 'Titans' : 'Atlanteans'}
          </span>
        </div>
        
        {/* Remove player button */}
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
          aria-label="Remove player"
          title="Remove player"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="relative">
        <input
          type="text"
          value={player.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter player name"
          className={`w-full bg-gray-700 text-white px-3 py-2 rounded 
                     border ${isDuplicate ? 'border-yellow-500 focus:border-yellow-400' : 'border-gray-600 focus:border-blue-500'} 
                     focus:outline-none focus:ring-1 ${isDuplicate ? 'focus:ring-yellow-500' : 'focus:ring-blue-500'}`}
        />
        {isDuplicate && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-500">
            <AlertCircle size={16} />
          </div>
        )}
      </div>
      {isDuplicate && (
        <div className="text-yellow-500 text-xs mt-1">
          Duplicate name found
        </div>
      )}
    </div>
  );
};

export default PlayerNameInput;