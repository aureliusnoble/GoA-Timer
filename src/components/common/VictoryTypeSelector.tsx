// src/components/common/VictoryTypeSelector.tsx
import React from 'react';
import { Crown, Flag, Skull } from 'lucide-react';
import { VictoryType } from '../../types';

export type VictoryTypeValue = VictoryType | undefined;

interface VictoryTypeSelectorProps {
  value: VictoryTypeValue;
  onChange: (type: VictoryTypeValue) => void;
  disabled?: boolean;
  required?: boolean;
  showNotRecorded?: boolean; // For editing legacy matches
  className?: string;
}

const VICTORY_OPTIONS = [
  {
    value: 'throne' as const,
    label: 'Throne',
    icon: Crown,
    bgSelected: 'bg-yellow-900/50',
    borderSelected: 'border-yellow-500',
    textSelected: 'text-yellow-400',
    description: 'Wave pushed into enemy Throne'
  },
  {
    value: 'wave' as const,
    label: 'Wave',
    icon: Flag,
    bgSelected: 'bg-blue-900/50',
    borderSelected: 'border-blue-500',
    textSelected: 'text-blue-400',
    description: 'Team won the final wave'
  },
  {
    value: 'kills' as const,
    label: 'Kills',
    icon: Skull,
    bgSelected: 'bg-red-900/50',
    borderSelected: 'border-red-500',
    textSelected: 'text-red-400',
    description: 'Opponent ran out of lives'
  }
];

const VictoryTypeSelector: React.FC<VictoryTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  showNotRecorded = false,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-300">
        Victory Type {required && <span className="text-red-400">*</span>}
      </label>
      <div className="grid grid-cols-3 gap-2">
        {VICTORY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center ${
                isSelected
                  ? `${option.borderSelected} ${option.bgSelected}`
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-500'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title={option.description}
            >
              <Icon
                size={24}
                className={isSelected ? option.textSelected : 'text-gray-400'}
              />
              <span className={`text-sm mt-1 ${isSelected ? 'font-medium text-white' : 'text-gray-300'}`}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {showNotRecorded && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          disabled={disabled}
          className={`w-full mt-2 px-3 py-2 rounded-lg border text-sm transition-all ${
            value === undefined
              ? 'border-gray-500 bg-gray-700 text-white'
              : 'border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:border-gray-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          Not Recorded (Legacy)
        </button>
      )}
    </div>
  );
};

// Helper function to get victory type display info for use in other components
export const getVictoryTypeDisplay = (victoryType?: VictoryType) => {
  const option = VICTORY_OPTIONS.find(o => o.value === victoryType);
  if (!option) return null;
  return {
    icon: option.icon,
    label: option.label,
    color: option.textSelected,
    description: option.description
  };
};

export default VictoryTypeSelector;
