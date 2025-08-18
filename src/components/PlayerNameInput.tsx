import React, { useState, useEffect, useRef, useId } from 'react';
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSelecting, setIsSelecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionListId = useId();
  
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
      // Reset highlighted index when suggestions change
      setHighlightedIndex(-1);
    } else {
      setFilteredSuggestions([]);
      setHighlightedIndex(-1);
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
  
  // Handle blur event - fixed to prevent race condition with selection
  const handleBlur = () => {
    // Don't interfere if user is actively selecting
    if (isSelecting) return;
    
    // Allow time for mouse clicks on suggestions
    setTimeout(() => {
      if (!isSelecting) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        
        // Only trim/update if not from selection
        const trimmedValue = inputValue.trim();
        if (trimmedValue !== inputValue) {
          setInputValue(trimmedValue);
          onNameChange(trimmedValue);
        }
      }
    }, 150);
  };
  
  // Handle focus event
  const handleFocus = () => {
    if (inputValue && suggestedNames.length > 0) {
      setShowSuggestions(true);
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
        
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSelectSuggestion(filteredSuggestions[highlightedIndex], 'keyboard');
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
        
      case 'Tab':
        // Allow natural tab behavior, close suggestions
        if (showSuggestions) {
          setShowSuggestions(false);
          setHighlightedIndex(-1);
        }
        break;
    }
  };

  // Handle selection of a suggested name - enhanced to prevent blur override
  const handleSelectSuggestion = (name: string, _method: 'mouse' | 'keyboard' = 'mouse') => {
    setIsSelecting(true);
    setInputValue(name);
    onNameChange(name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    playSound('buttonClick');
    
    // Clear selection flag after React updates
    setTimeout(() => {
      setIsSelecting(false);
    }, 0);
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
          onKeyDown={handleKeyDown}
          // Accessibility attributes
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? suggestionListId : undefined}
          aria-activedescendant={
            highlightedIndex >= 0 
              ? `${suggestionListId}-option-${highlightedIndex}` 
              : undefined
          }
          autoComplete="off"
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
        <ul
          id={suggestionListId}
          role="listbox"
          aria-label="Player name suggestions"
          className="absolute z-10 w-full mt-1 bg-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              id={`${suggestionListId}-option-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onClick={() => handleSelectSuggestion(suggestion, 'mouse')}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-4 py-2 cursor-pointer text-sm min-h-[44px] flex items-center ${
                index === highlightedIndex
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-600'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerNameInput;