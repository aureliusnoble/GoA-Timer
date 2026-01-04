// src/components/matches/CustomMatchMaker/PresetSelector.tsx
import React, { useState } from 'react';
import { Save, Trash2, ChevronDown } from 'lucide-react';
import { MatchMakerPreset } from './types';

interface PresetSelectorProps {
  presets: MatchMakerPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (preset: MatchMakerPreset | null) => void;
  onSaveClick: () => void;
  onDeletePreset: (presetId: string) => void;
  hasUnsavedChanges: boolean;
}

const PresetSelector: React.FC<PresetSelectorProps> = ({
  presets,
  selectedPresetId,
  onSelectPreset,
  onSaveClick,
  onDeletePreset,
  hasUnsavedChanges,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const selectedPreset = presets.find(p => p.id === selectedPresetId);
  const canDelete = selectedPreset && !selectedPreset.isBuiltIn;

  const handleDelete = () => {
    if (selectedPresetId && canDelete) {
      onDeletePreset(selectedPresetId);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {/* Preset dropdown */}
      <div className="flex-1 relative">
        <select
          value={selectedPresetId || 'custom'}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              onSelectPreset(null);
            } else {
              const preset = presets.find(p => p.id === e.target.value);
              if (preset) onSelectPreset(preset);
            }
          }}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-cyan-500 pr-10"
        >
          <option value="custom">
            {hasUnsavedChanges ? '* Custom (unsaved)' : 'Custom'}
          </option>
          {presets.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.name}{preset.isBuiltIn ? ' (built-in)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSaveClick}
          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors flex items-center gap-2"
          title="Save as new preset"
        >
          <Save size={16} />
          <span className="hidden sm:inline">Save As...</span>
        </button>

        {canDelete && !showConfirmDelete && (
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white transition-colors flex items-center gap-2"
            title="Delete selected preset"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        {showConfirmDelete && (
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PresetSelector;
