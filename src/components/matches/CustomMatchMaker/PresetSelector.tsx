// src/components/matches/CustomMatchMaker/PresetSelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Save, Trash2, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { MatchMakerPreset } from './types';

interface PresetSelectorProps {
  presets: MatchMakerPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (preset: MatchMakerPreset | null) => void;
  onSaveClick: () => void;
  onDeletePreset: (presetId: string) => void;
  onRenamePreset: (presetId: string, newName: string) => void;
  hasUnsavedChanges: boolean;
  existingNames: string[];
}

const PresetSelector: React.FC<PresetSelectorProps> = ({
  presets,
  selectedPresetId,
  onSelectPreset,
  onSaveClick,
  onDeletePreset,
  onRenamePreset,
  hasUnsavedChanges,
  existingNames,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selectedPreset = presets.find(p => p.id === selectedPresetId);
  const canModify = selectedPreset && !selectedPreset.isBuiltIn;

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    if (selectedPreset && canModify) {
      setRenameValue(selectedPreset.name);
      setRenameError(null);
      setIsRenaming(true);
      setShowConfirmDelete(false);
    }
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
    setRenameError(null);
  };

  const confirmRename = () => {
    const trimmedName = renameValue.trim();

    if (!trimmedName) {
      setRenameError('Name cannot be empty');
      return;
    }

    // Check for duplicate (excluding current preset's name)
    const isDuplicate = existingNames.some(
      name => name.toLowerCase() === trimmedName.toLowerCase() &&
              name.toLowerCase() !== selectedPreset?.name.toLowerCase()
    );

    if (isDuplicate) {
      setRenameError('A preset with this name already exists');
      return;
    }

    if (selectedPresetId) {
      onRenamePreset(selectedPresetId, trimmedName);
      setIsRenaming(false);
      setRenameValue('');
      setRenameError(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  const handleDelete = () => {
    if (selectedPresetId && canModify) {
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

        {canModify && !isRenaming && !showConfirmDelete && (
          <button
            onClick={startRename}
            className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg text-white transition-colors flex items-center gap-2"
            title="Rename selected preset"
          >
            <Pencil size={16} />
            <span className="hidden sm:inline">Rename</span>
          </button>
        )}

        {canModify && !isRenaming && !showConfirmDelete && (
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

      {/* Rename input row */}
      {isRenaming && (
        <div className="w-full flex flex-col gap-1">
          <div className="flex gap-2">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                setRenameError(null);
              }}
              onKeyDown={handleRenameKeyDown}
              className={`flex-1 px-3 py-2 bg-gray-700 border rounded-lg text-white focus:outline-none ${
                renameError ? 'border-red-500' : 'border-gray-600 focus:border-cyan-500'
              }`}
              placeholder="Enter new name"
            />
            <button
              onClick={confirmRename}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
              title="Confirm rename"
            >
              <Check size={16} />
            </button>
            <button
              onClick={cancelRename}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Cancel rename"
            >
              <X size={16} />
            </button>
          </div>
          {renameError && (
            <p className="text-sm text-red-400">{renameError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PresetSelector;
