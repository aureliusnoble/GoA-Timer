// src/components/common/SoundToggle.tsx
import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '../../context/SoundContext';

const SoundToggle: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSoundEnabled, toggleSound, playSound } = useSound();

  const handleToggle = () => {
    toggleSound();
    playSound('toggleSwitch');
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 transition-all duration-300">
      {isExpanded ? (
        // Expanded view with label
        <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-full text-center text-base text-white py-2 px-4 flex items-center shadow-lg">
          <span className="mr-3">Sound {isSoundEnabled ? 'On' : 'Off'}</span>
          <button
            onClick={handleToggle}
            className={`p-2 rounded-full ${isSoundEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'} transition-colors`}
            aria-label={isSoundEnabled ? 'Disable sound' : 'Enable sound'}
          >
            {isSoundEnabled ? <Volume2 size={20} className="text-white" /> : <VolumeX size={20} className="text-white" />}
          </button>
          <button
            onClick={() => {
              setIsExpanded(false);
              playSound('buttonClick');
            }}
            className="ml-3 p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Collapse sound toggle"
          >
            <VolumeX size={16} className="text-white" />
          </button>
        </div>
      ) : (
        // Collapsed view - just an icon button
        <button
          onClick={() => {
            setIsExpanded(true);
            playSound('buttonClick');
          }}
          className={`p-2 rounded-full shadow-lg ${isSoundEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'}`}
          aria-label="Sound settings"
        >
          {isSoundEnabled ? <Volume2 size={20} className="text-white" /> : <VolumeX size={20} className="text-white" />}
        </button>
      )}
    </div>
  );
};

export default SoundToggle;