// src/components/matches/CustomMatchMaker/CustomMatchMakerModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Sliders, RotateCcw, Eraser, Play } from 'lucide-react';
import WeightAllocator from './WeightAllocator';
import PresetSelector from './PresetSelector';
import SavePresetModal from './SavePresetModal';
import {
  MatchMakerWeights,
  MatchMakerPreset,
  WEIGHT_FACTORS,
  DEFAULT_WEIGHTS,
  DEFAULT_PRESETS,
} from './types';

interface CustomMatchMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (weights: MatchMakerWeights) => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

const STORAGE_KEY = 'matchmaker_presets';

const CustomMatchMakerModal: React.FC<CustomMatchMakerModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  disabled = false,
  isGenerating = false,
}) => {
  // Initialize presets with built-ins
  const [presets, setPresets] = useState<MatchMakerPreset[]>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    const userPresets: MatchMakerPreset[] = saved ? JSON.parse(saved) : [];

    // Merge with built-in presets (built-ins always included)
    const builtInPresets = DEFAULT_PRESETS.map(p => ({
      ...p,
      createdAt: new Date(),
    }));

    // Filter out any user presets that have same id as built-ins
    const filteredUserPresets = userPresets.filter(
      up => !builtInPresets.some(bp => bp.id === up.id)
    );

    return [...builtInPresets, ...filteredUserPresets];
  });

  const [weights, setWeights] = useState<MatchMakerWeights>(DEFAULT_WEIGHTS);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Save user presets to localStorage when they change
  useEffect(() => {
    const userPresets = presets.filter(p => !p.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
  }, [presets]);

  // Calculate totals
  const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
  const remaining = 100 - total;
  const isValid = total === 100;

  // Update a single weight
  const updateWeight = (key: keyof MatchMakerWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setSelectedPresetId(null); // Switch to custom mode
  };

  // Reset to equal weights
  const resetToEqual = () => {
    setWeights(DEFAULT_WEIGHTS);
    setHasUnsavedChanges(false);
    setSelectedPresetId(null);
  };

  // Clear all weights
  const clearAll = () => {
    setWeights({
      ranking: 0,
      experience: 0,
      novel: 0,
      reunion: 0,
      winRate: 0,
      random: 0,
    });
    setHasUnsavedChanges(true);
    setSelectedPresetId(null);
  };

  // Select a preset
  const handleSelectPreset = (preset: MatchMakerPreset | null) => {
    if (preset) {
      setWeights(preset.weights);
      setSelectedPresetId(preset.id);
      setHasUnsavedChanges(false);
    } else {
      setSelectedPresetId(null);
    }
  };

  // Save a new preset
  const handleSavePreset = (name: string) => {
    const newPreset: MatchMakerPreset = {
      id: `user-${Date.now()}`,
      name,
      weights: { ...weights },
      createdAt: new Date(),
      isBuiltIn: false,
    };
    setPresets(prev => [...prev, newPreset]);
    setSelectedPresetId(newPreset.id);
    setHasUnsavedChanges(false);
  };

  // Delete a preset
  const handleDeletePreset = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    if (selectedPresetId === presetId) {
      setSelectedPresetId(null);
    }
  };

  // Rename a preset
  const handleRenamePreset = (presetId: string, newName: string) => {
    setPresets(prev => prev.map(p =>
      p.id === presetId ? { ...p, name: newName } : p
    ));
  };

  // Handle generate
  const handleGenerate = () => {
    if (isValid && !disabled && !isGenerating) {
      onGenerate(weights);
    }
  };

  if (!isOpen) return null;

  // Get list of existing preset names for validation
  const existingNames = presets.map(p => p.name);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Custom Match Maker</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Total progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">Total Allocation</span>
              <span
                className={`font-bold ${
                  isValid ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                {total}/100
              </span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isValid ? 'bg-green-500' : total > 100 ? 'bg-red-500' : 'bg-gray-500'
                }`}
                style={{ width: `${Math.min(total, 100)}%` }}
              />
            </div>
            {!isValid && (
              <p className="text-sm text-gray-400 mt-1">
                {remaining > 0
                  ? `${remaining} point${remaining !== 1 ? 's' : ''} remaining`
                  : `${-remaining} point${-remaining !== 1 ? 's' : ''} over budget`}
              </p>
            )}
          </div>

          {/* Weight allocators */}
          <div className="space-y-3 mb-6">
            {WEIGHT_FACTORS.map(factor => (
              <WeightAllocator
                key={factor.id}
                factor={factor}
                value={weights[factor.id]}
                remaining={remaining}
                onChange={(value) => updateWeight(factor.id, value)}
                disabled={disabled || isGenerating}
              />
            ))}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={resetToEqual}
              disabled={disabled || isGenerating}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} />
              Reset (20 each)
            </button>
            <button
              onClick={clearAll}
              disabled={disabled || isGenerating}
              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors flex items-center justify-center gap-2"
            >
              <Eraser size={16} />
              Clear All
            </button>
          </div>

          {/* Preset selector */}
          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-2">Presets</label>
            <PresetSelector
              presets={presets}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              onSaveClick={() => setShowSaveModal(true)}
              onDeletePreset={handleDeletePreset}
              onRenamePreset={handleRenamePreset}
              hasUnsavedChanges={hasUnsavedChanges}
              existingNames={existingNames}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleGenerate}
            disabled={!isValid || disabled || isGenerating}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              isValid && !disabled && !isGenerating
                ? 'bg-cyan-600 hover:bg-cyan-500'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Generating...
              </>
            ) : (
              <>
                <Play size={20} />
                Generate Teams
              </>
            )}
          </button>
          {!isValid && (
            <p className="text-center text-sm text-gray-400 mt-2">
              Allocate exactly 100 points to generate teams
            </p>
          )}
        </div>
      </div>

      {/* Save preset modal */}
      <SavePresetModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePreset}
        existingNames={existingNames}
      />
    </div>
  );
};

export default CustomMatchMakerModal;
