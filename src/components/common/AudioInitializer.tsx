// src/components/common/AudioInitializer.tsx
import React, { useEffect, useState } from 'react';
import { Howler } from 'howler';

const AudioInitializer: React.FC = () => {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    // Function to initialize the audio context
    const initializeAudio = () => {
      // Attempt to unlock the audio context
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume();
      }
      
      // Mark audio as ready
      setIsAudioReady(true);
      setShowOverlay(false);
      
      // Remove the event listeners once audio is initialized
      document.removeEventListener('click', initializeAudio);
      document.removeEventListener('keydown', initializeAudio);
      document.removeEventListener('touchstart', initializeAudio);
    };

    // Add event listeners for user interactions
    document.addEventListener('click', initializeAudio);
    document.addEventListener('keydown', initializeAudio);
    document.addEventListener('touchstart', initializeAudio);

    // Cleanup event listeners when the component unmounts
    return () => {
      document.removeEventListener('click', initializeAudio);
      document.removeEventListener('keydown', initializeAudio);
      document.removeEventListener('touchstart', initializeAudio);
    };
  }, []);

  if (!showOverlay) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[9999]"
      onClick={() => {
        // This ensures the first click on the overlay itself will
        // also trigger audio initialization
        if (Howler.ctx && Howler.ctx.state !== 'running') {
          Howler.ctx.resume();
        }
        setIsAudioReady(true);
        setShowOverlay(false);
      }}
    >
      <div className="bg-blue-900/80 p-8 rounded-lg max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4">Enable Audio</h2>
        <p className="mb-6">
          Click anywhere or press any key to enable audio for this application.
          <br /><br />
          Modern browsers require user interaction before allowing audio to play.
        </p>
        <button 
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-lg"
          onClick={() => {
            if (Howler.ctx && Howler.ctx.state !== 'running') {
              Howler.ctx.resume();
            }
            setIsAudioReady(true);
            setShowOverlay(false);
          }}
        >
          Enable Audio
        </button>
      </div>
    </div>
  );
};

export default AudioInitializer;