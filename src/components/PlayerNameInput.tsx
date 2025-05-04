import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, AlertTriangle } from 'lucide-react';
import { Team } from '../types';
import { useSound } from '../context/SoundContext';

interface PlayerNameInputProps {
  player: {
    id: number;
    team: Team;
    hero: any | null;
    name: string;
  };
  onNameChange: (name: string) => void;
  onRemove?: () => void;
  isDuplicate?: boolean;
  suggestedNames?: string[];
  disableRemove?: boolean;
  autoFocus?: boolean;
}

const PlayerNameInput: React.FC<PlayerNameInputProps> = ({
  player,
  onNameChange,
  onRemove,
  isDuplicate = false,
  suggestedNames = [],
  disableRemove = false,
  autoFocus = false
}) => {
  const { playSound } = useSound();
  const [inputValue, setInputValue] = useState(player.name);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showInvalidWarning, setShowInvalidWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialize input with player name
  useEffect(() => {
    setInputValue(player.name);
  }, [player.name]);
  
  // Focus input when autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestedNames.filter(name => 
        name.toLowerCase().includes(inputValue.toLowerCase()) && 
        name.toLowerCase() !== inputValue.toLowerCase()
      );
      setFilteredSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
    } else {
      setFilteredSuggestions([]);
    }
  }, [inputValue, suggestedNames]);
  
  // Function to validate if the input contains only allowed characters (alphanumeric, spaces, periods, hyphens)
  const isValidInput = (input: string): boolean => {
    return /^[a-zA-Z0-9 .-]*$/.test(input);
  };
  
  // Handle input change with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only update if input contains allowed characters
    if (isValidInput(value)) {
      setInputValue(value);
      
      // Show suggestions if we have a value and suggestions
      setShowSuggestions(!!value && suggestedNames.length > 0);
    } else {
      // Show invalid character warning
      setShowInvalidWarning(true);
      playSound('buttonClick');
      
      // Clear existing timeout if there is one
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      
      // Set new timeout to hide warning after 3 seconds
      warningTimeoutRef.current = setTimeout(() => {
        setShowInvalidWarning(false);
        warningTimeoutRef.current = null;
      }, 3000);
    }
  };
  
  // Handle blur event
  const handleBlur = () => {
    // Allow a small delay to handle suggestion clicks
    setTimeout(() => {
      setShowSuggestions(false);
      
      // Trim whitespace and update parent component with the trimmed value
      const trimmedValue = inputValue.trim();
      setInputValue(trimmedValue);
      onNameChange(trimmedValue);
    }, 200);
  };
  
  // Handle focus event
  const handleFocus = () => {
    if (inputValue && suggestedNames.length > 0) {
      setShowSuggestions(true);
    }
  };
  
  // Handle selection of a suggested name
  const handleSelectSuggestion = (name: string) => {
    setInputValue(name);
    onNameChange(name);
    setShowSuggestions(false);
    playSound('buttonClick');
  };
  
  // Handle remove button click
  const handleRemove = () => {
    if (onRemove) {
      playSound('buttonClick');
      onRemove();
    }
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div className="relative w-full">
      <div className={`flex border ${
        isDuplicate 
          ? 'border-red-500 bg-red-900/20' 
          : showInvalidWarning
            ? 'border-amber-500 bg-amber-900/20'
            : 'border-gray-600 bg-gray-800'
        } rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Player name"
          className={`px-3 py-2 flex-grow bg-transparent outline-none text-sm ${
            player.team === Team.Titans 
              ? 'text-blue-300' 
              : 'text-red-300'
          }`}
        />
        
        {isDuplicate && (
          <div className="flex items-center pr-2">
            <AlertCircle size={16} className="text-red-500" />
          </div>
        )}
        
        {showInvalidWarning && (
          <div className="flex items-center pr-2">
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
        )}
        
        {onRemove && !disableRemove && (
          <button
            onClick={handleRemove}
            className="px-2 text-gray-400 hover:text-white focus:outline-none"
            aria-label="Remove player"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {/* Show duplicate warning below input */}
      {isDuplicate && (
        <div className="text-red-500 text-xs mt-1">
          Duplicate name
        </div>
      )}
      
      {/* Show invalid character warning */}
      {showInvalidWarning && (
        <div className="text-amber-500 text-xs mt-1">
          Only letters, numbers, spaces, periods, and hyphens are allowed
        </div>
      )}
      
      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="px-4 py-2 cursor-pointer hover:bg-gray-600 text-sm"
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerNameInput;