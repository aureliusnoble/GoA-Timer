// src/components/matches/CustomMatchMaker/WeightAllocator.tsx
import React from 'react';
import { Trophy, Clock, Sparkles, Clock3, TrendingUp, Shuffle, Minus, Plus } from 'lucide-react';
import { WeightFactor } from './types';

interface WeightAllocatorProps {
  factor: WeightFactor;
  value: number;
  remaining: number;  // How many points are still available to allocate
  onChange: (newValue: number) => void;
  disabled?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  Trophy: <Trophy size={18} />,
  Clock: <Clock size={18} />,
  Sparkles: <Sparkles size={18} />,
  Clock3: <Clock3 size={18} />,
  TrendingUp: <TrendingUp size={18} />,
  Shuffle: <Shuffle size={18} />,
};

const WeightAllocator: React.FC<WeightAllocatorProps> = ({
  factor,
  value,
  remaining,
  onChange,
  disabled = false,
}) => {
  const handleChange = (delta: number) => {
    const newValue = value + delta;

    // Validate constraints
    if (newValue < 0) return;
    if (delta > 0 && delta > remaining) return;

    onChange(newValue);
  };

  // Calculate which buttons should be disabled
  const canDecrease = (amount: number) => value >= amount && !disabled;
  const canIncrease = (amount: number) => remaining >= amount && !disabled;

  // Color classes based on factor
  const colorClasses: Record<string, { bg: string; text: string; bar: string }> = {
    blue: { bg: 'bg-blue-900/30', text: 'text-blue-400', bar: 'bg-blue-500' },
    green: { bg: 'bg-green-900/30', text: 'text-green-400', bar: 'bg-green-500' },
    amber: { bg: 'bg-amber-900/30', text: 'text-amber-400', bar: 'bg-amber-500' },
    indigo: { bg: 'bg-indigo-900/30', text: 'text-indigo-400', bar: 'bg-indigo-500' },
    rose: { bg: 'bg-rose-900/30', text: 'text-rose-400', bar: 'bg-rose-500' },
    purple: { bg: 'bg-purple-900/30', text: 'text-purple-400', bar: 'bg-purple-500' },
  };

  const colors = colorClasses[factor.colorClass] || colorClasses.blue;

  return (
    <div className={`p-3 rounded-lg ${colors.bg} ${disabled ? 'opacity-50' : ''}`}>
      {/* Header with icon and label */}
      <div className="flex items-center gap-2 mb-2">
        <span className={colors.text}>{iconMap[factor.icon]}</span>
        <span className="font-medium text-white">{factor.label}</span>
      </div>

      {/* Progress bar and value */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-150`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-white font-bold w-12 text-right">{value}%</span>
      </div>

      {/* Adjustment buttons */}
      <div className="flex items-center justify-center gap-1">
        {/* Decrease buttons */}
        <button
          onClick={() => handleChange(-10)}
          disabled={!canDecrease(10)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canDecrease(10)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Decrease by 10"
        >
          <span className="flex items-center gap-0.5">
            <Minus size={10} />10
          </span>
        </button>
        <button
          onClick={() => handleChange(-5)}
          disabled={!canDecrease(5)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canDecrease(5)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Decrease by 5"
        >
          <span className="flex items-center gap-0.5">
            <Minus size={10} />5
          </span>
        </button>
        <button
          onClick={() => handleChange(-1)}
          disabled={!canDecrease(1)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canDecrease(1)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Decrease by 1"
        >
          <span className="flex items-center gap-0.5">
            <Minus size={10} />1
          </span>
        </button>

        <div className="w-2" /> {/* Spacer */}

        {/* Increase buttons */}
        <button
          onClick={() => handleChange(1)}
          disabled={!canIncrease(1)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canIncrease(1)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Increase by 1"
        >
          <span className="flex items-center gap-0.5">
            <Plus size={10} />1
          </span>
        </button>
        <button
          onClick={() => handleChange(5)}
          disabled={!canIncrease(5)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canIncrease(5)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Increase by 5"
        >
          <span className="flex items-center gap-0.5">
            <Plus size={10} />5
          </span>
        </button>
        <button
          onClick={() => handleChange(10)}
          disabled={!canIncrease(10)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            canIncrease(10)
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
          title="Increase by 10"
        >
          <span className="flex items-center gap-0.5">
            <Plus size={10} />10
          </span>
        </button>
      </div>
    </div>
  );
};

export default WeightAllocator;
