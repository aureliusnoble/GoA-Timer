// src/components/PlayerNameInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Player, Team } from '../types';
import { AlertCircle, X, Tag } from 'lucide-react';

interface PlayerNameInputProps {
  player: Player;
  onNameChange: (name: string) => void;
  onRemove: () => void;
  isDuplicate?: boolean;
  suggestedNames?: string[]; // NEW: Add suggested names prop
}

const PlayerNameInput: React.FC<PlayerNameInputProps> = ({ 
  player, 
  onNameChange,
  onRemove,
  isDuplicate = false,
  suggestedNames = [] // Default to empty array
}) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // NEW: Handle click outside suggestions to hide them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // NEW: Handle suggestion selection
  const handleSelectSuggestion = (name: string) => {
    onNameChange(name);
    // IMPROVED: Immediately hide the suggestions dropdown after selection
    setIsFocused(false);
  };

  // NEW: Filter suggestions based on current input value
  const getFilteredSuggestions = () => {
    if (!player.name) {
      // If input is empty, return all suggestions
      return suggestedNames;
    }
    
    // Filter suggestions that include the current input (case-insensitive)
    return suggestedNames.filter(name => 
      name.toLowerCase().includes(player.name.toLowerCase())
    );
  };

  // IMPROVED: Only show suggestions if there are matching results
  const shouldShowSuggestions = () => {
    const filteredSuggestions = getFilteredSuggestions();
    return isFocused && suggestedNames.length > 0 && filteredSuggestions.length > 0;
  };

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
          ref={inputRef}
          type="text"
          value={player.name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
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
        
        {/* NEW: Suggestions dropdown - IMPROVED to only show when there are matches */}
        {shouldShowSuggestions() && (
          <div 
            ref={suggestionsRef}
            className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
          >
            <div className="py-1">
              {getFilteredSuggestions().map((name) => (
                <div
                  key={name}
                  className="px-3 py-2 hover:bg-blue-600/50 cursor-pointer flex items-center"
                  onClick={() => handleSelectSuggestion(name)}
                >
                  <Tag size={14} className="mr-2 text-gray-400" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {isDuplicate && (
        <div className="text-yellow-500 text-xs mt-1">
          Duplicate name found
        </div>
      )}
      
      {/* NEW: Small hint about suggestions - only show when there are suggestions and input is empty */}
      {suggestedNames.length > 0 && !isFocused && !player.name && (
        <div className="text-gray-400 text-xs mt-1">
          Click to see {suggestedNames.length} saved player names
        </div>
      )}
    </div>
  );
};

export default PlayerNameInput;