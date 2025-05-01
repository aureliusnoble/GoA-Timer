// src/components/DraftModeSelection.tsx
import React from 'react';
import { DraftMode, Team } from '../types';
import { AlertCircle } from 'lucide-react';

interface DraftModeSelectionProps {
  onSelectMode: (mode: DraftMode) => void;
  onCancel: () => void;
  playerCount: number;
  availableDraftModes: {
    [key in DraftMode]?: boolean;
  };
  heroCount: number;
  // NEW: Add handicapTeam prop to indicate which team has more players
  handicapTeam: Team | null;
}

const DraftModeSelection: React.FC<DraftModeSelectionProps> = ({
  onSelectMode,
  onCancel,
  playerCount,
  availableDraftModes,
  heroCount,
  handicapTeam
}) => {
  // Descriptions for each draft mode
  const modeDescriptions = {
    [DraftMode.AllPick]: 
      'Teams take turns selecting any available hero for their players.',
    [DraftMode.Single]: 
      'Randomly deal 3 unique heroes to each player. Teams alternate selections.',
    [DraftMode.Random]: 
      `Randomly select ${playerCount + 2} heroes from the pool. Teams alternate picks from this pool.`,
    [DraftMode.PickAndBan]:
      'Full drafting experience with pick and ban phases. The draft sequence varies based on the number of players.'
  };

  // Hero requirements for each mode
  const modeRequirements = {
    [DraftMode.AllPick]: playerCount,
    [DraftMode.Single]: playerCount * 3,
    [DraftMode.Random]: playerCount + 2,
    [DraftMode.PickAndBan]: playerCount * 2
  };

  // Additional details or tips for each mode
  const modeDetails = {
    [DraftMode.AllPick]: "Default draft",
    [DraftMode.Single]: "Forces players to try new heroes",
    [DraftMode.Random]: "Good for balanced hero selection",
    [DraftMode.PickAndBan]: "Best for competitive play"
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Select Draft Mode</h2>
      
      {/* NEW: Add handicap warning when teams are uneven */}
      {handicapTeam && (
        <div className="bg-amber-900/30 border border-amber-600 p-4 rounded-lg mb-6">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-amber-400">Warning: Uneven Teams</h4>
              <p className="text-sm text-gray-300">
                All players on the {handicapTeam === Team.Titans ? 'Titans' : 'Atlanteans'} team 
                must replace one of their basic cards with a handicap card.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* All Pick Draft Option (NEW) */}
        <div 
          className={`relative ${
            availableDraftModes[DraftMode.AllPick] 
              ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' 
              : 'bg-gray-800 opacity-50 cursor-not-allowed'
          } p-5 rounded-lg transition-colors`}
          onClick={() => availableDraftModes[DraftMode.AllPick] && onSelectMode(DraftMode.AllPick)}
        >
          <h3 className="text-xl font-semibold mb-3">All Pick</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.AllPick]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            {modeDetails[DraftMode.AllPick]}
          </div>
          
          {!availableDraftModes[DraftMode.AllPick] && (
            <div className="absolute top-2 right-2 text-yellow-400 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              <span className="text-xs">Requires {modeRequirements[DraftMode.AllPick]} heroes</span>
            </div>
          )}
        </div>
        
        {/* Single Draft Option */}
        <div 
          className={`relative ${
            availableDraftModes[DraftMode.Single] 
              ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' 
              : 'bg-gray-800 opacity-50 cursor-not-allowed'
          } p-5 rounded-lg transition-colors`}
          onClick={() => availableDraftModes[DraftMode.Single] && onSelectMode(DraftMode.Single)}
        >
          <h3 className="text-xl font-semibold mb-3">Single Draft</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.Single]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            {modeDetails[DraftMode.Single]}
          </div>
          
          {!availableDraftModes[DraftMode.Single] && (
            <div className="absolute top-2 right-2 text-yellow-400 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              <span className="text-xs">Requires {modeRequirements[DraftMode.Single]} heroes</span>
            </div>
          )}
        </div>
        
        {/* Random Draft Option */}
        <div 
          className={`relative ${
            availableDraftModes[DraftMode.Random] 
              ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' 
              : 'bg-gray-800 opacity-50 cursor-not-allowed'
          } p-5 rounded-lg transition-colors`}
          onClick={() => availableDraftModes[DraftMode.Random] && onSelectMode(DraftMode.Random)}
        >
          <h3 className="text-xl font-semibold mb-3">Random Draft</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.Random]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            {modeDetails[DraftMode.Random]}
          </div>
          
          {!availableDraftModes[DraftMode.Random] && (
            <div className="absolute top-2 right-2 text-yellow-400 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              <span className="text-xs">Requires {modeRequirements[DraftMode.Random]} heroes</span>
            </div>
          )}
        </div>
        
        {/* Pick and Ban Option */}
        <div 
          className={`relative ${
            availableDraftModes[DraftMode.PickAndBan] 
              ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' 
              : 'bg-gray-800 opacity-50 cursor-not-allowed'
          } p-5 rounded-lg transition-colors`}
          onClick={() => availableDraftModes[DraftMode.PickAndBan] && onSelectMode(DraftMode.PickAndBan)}
        >
          <h3 className="text-xl font-semibold mb-3">Pick and Ban</h3>
          <p className="text-gray-300 mb-4">{modeDescriptions[DraftMode.PickAndBan]}</p>
          <div className="bg-blue-900/30 p-2 rounded text-sm">
            {modeDetails[DraftMode.PickAndBan]}
          </div>
          
          {!availableDraftModes[DraftMode.PickAndBan] && (
            <div className="absolute top-2 right-2 text-yellow-400 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              <span className="text-xs">Requires {modeRequirements[DraftMode.PickAndBan]} heroes</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          Available heroes: {heroCount}
        </div>
        
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