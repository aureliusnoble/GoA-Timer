// src/components/common/SoundToggle.tsx
import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '../../context/SoundContext';

const SoundToggle: React.FC = () => {
  const { isSoundEnabled, toggleSound, playSound } = useSound();

  const handleToggle = () => {
    toggleSound();
    playSound('toggleSwitch');
  };

  return (
    <button
      onClick={handleToggle}
      className={`fixed bottom-2 right-2 z-50 p-2 rounded-full shadow-lg transition-colors ${
        isSoundEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
      }`}
      aria-label={isSoundEnabled ? 'Mute sound' : 'Unmute sound'}
      title={isSoundEnabled ? 'Mute sound' : 'Unmute sound'}
    >
      {isSoundEnabled ? (
        <Volume2 size={20} className="text-white" />
      ) : (
        <VolumeX size={20} className="text-white" />
      )}
    </button>
  );
};

export default SoundToggle;