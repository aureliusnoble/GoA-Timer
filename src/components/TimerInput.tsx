import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Info } from 'lucide-react';
import EnhancedTooltip from './common/EnhancedTooltip';
import { useSound } from '../context/SoundContext';

interface TimerInputProps {
  value: number; // Value in seconds
  onChange: (value: number) => void;
  tooltip: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  disabled?: boolean; // New prop for disabling the timer input
}

const TimerInput: React.FC<TimerInputProps> = ({
  value,
  onChange,
  tooltip,
  minValue = 10,
  maxValue = 600,
  step = 10,
  disabled = false // Default to enabled
}) => {
  const [inputValue, setInputValue] = useState<string>(formatTime(value));
  const { playSound } = useSound();

  // Format seconds to MM:SS
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Parse MM:SS to seconds
  function parseTime(timeString: string): number {
    // Handle empty string
    if (!timeString.trim()) return value;

    // Try to parse MM:SS format
    const parts = timeString.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return Math.min(maxValue, Math.max(minValue, minutes * 60 + seconds));
      }
    }
    
    // Try to parse as seconds
    const totalSeconds = parseInt(timeString, 10);
    if (!isNaN(totalSeconds)) {
      return Math.min(maxValue, Math.max(minValue, totalSeconds));
    }
    
    // Return original value if parsing fails
    return value;
  }

  // Increment or decrement value
  const adjustValue = (delta: number) => {
    if (disabled) return; // Don't adjust if disabled
    playSound('buttonClick');
    const newValue = Math.min(maxValue, Math.max(minValue, value + delta));
    onChange(newValue);
  };

  // Update internal input when external value changes
  useEffect(() => {
    setInputValue(formatTime(value));
  }, [value]);

  // Handle direct input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return; // Don't update if disabled
    setInputValue(e.target.value);
  };

  // Apply changes when input loses focus
  const handleBlur = () => {
    if (disabled) return; // Don't update if disabled
    playSound('buttonClick');
    const newValue = parseTime(inputValue);
    onChange(newValue);
    setInputValue(formatTime(newValue));
  };

  // Apply changes on Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return; // Don't update if disabled
    if (e.key === 'Enter') {
      playSound('buttonClick');
      const newValue = parseTime(inputValue);
      onChange(newValue);
      setInputValue(formatTime(newValue));
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative">
      <div className="flex">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-20 bg-gray-700 text-center text-xl font-mono py-2 px-3 rounded-l-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? 'cursor-not-allowed opacity-60' : ''
          }`}
          aria-label="Timer duration"
          disabled={disabled}
        />
        <div className="flex flex-col border-y border-r border-gray-600 rounded-r-md">
          <button
            className={`bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-tr-md border-b border-gray-600 ${
              disabled ? 'cursor-not-allowed opacity-60' : ''
            }`}
            onClick={() => adjustValue(step)}
            aria-label="Increase time"
            disabled={disabled}
          >
            <ChevronUp size={16} />
          </button>
          <button
            className={`bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-br-md ${
              disabled ? 'cursor-not-allowed opacity-60' : ''
            }`}
            onClick={() => adjustValue(-step)}
            aria-label="Decrease time"
            disabled={disabled}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        
        {/* Replace custom tooltip with EnhancedTooltip */}
        <EnhancedTooltip 
          text={tooltip}
          position="right"
          maxWidth="max-w-xs"
        >
          <div className="ml-2 cursor-help">
            <Info size={18} className="text-gray-400 hover:text-gray-200" />
          </div>
        </EnhancedTooltip>
      </div>
    </div>
  );
};

export default TimerInput;