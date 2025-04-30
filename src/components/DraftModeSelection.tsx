// src/components/DraftModeSelection.tsx
import React from 'react';
import { DraftMode, Player } from '../types';

interface DraftModeSelectionProps {
  onSelectMode: (mode: DraftMode) => void;
  onCancel: () => void;
  playerCount: number;
}

const DraftModeSelection: React.FC<DraftModeSelectionProps> = ({
  onSelectMode,
  onCancel,
  playerCount
}) => {
  // Descriptions for each draft mode
  const modeDescriptions = {
    [DraftMode.Single]: 
      'Randomly deal 3 heroes to each player. Teams alternate selections starting with the team shown on the tiebreaker coin.',
    [DraftMode.Random]: 
      `Randomly select ${playerCount + 2} heroes. Teams alternate picks starting with the team shown on the tiebreaker coin.`,
    [DraftMode.PickAndBan]:
      'Full drafting experience with pick and ban phases. The draft sequence varies based on the number of players.'
  };

  // Calculate pick/ban sequence based on player count
  const getPickBanInfo = () => {
    return "Best for competitive play";

  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Select Draft Mode</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Single Draft Option */}
        <div 
          className="bg-gray-700 hover:bg-gray-600 p-5 rounded-lg cursor-pointer transition-colors"
          onClick={() => onSelectMode(DraftMode.Single)}
        >
          <h3 className="text-xl font-semibold mb-3">Single Draft</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.Single]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            Best for diversifying heroes pool
          </div>
        </div>
        
        {/* Random Draft Option */}
        <div 
          className="bg-gray-700 hover:bg-gray-600 p-5 rounded-lg cursor-pointer transition-colors"
          onClick={() => onSelectMode(DraftMode.Random)}
        >
          <h3 className="text-xl font-semibold mb-3">Random Draft</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.Random]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            Good for balanced selection
          </div>
        </div>
        
        {/* Pick and Ban Option */}
        <div 
          className="bg-gray-700 hover:bg-gray-600 p-5 rounded-lg cursor-pointer transition-colors"
          onClick={() => onSelectMode(DraftMode.PickAndBan)}
        >
          <h3 className="text-xl font-semibold mb-3">Pick and Ban</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.PickAndBan]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            {getPickBanInfo()}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button 
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DraftModeSelection;