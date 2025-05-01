// src/components/common/AudioInitializer.tsx
import React, { useEffect } from 'react';
import { Howler } from 'howler';

const AudioInitializer: React.FC = () => {
  useEffect(() => {
    // Function to initialize the audio context silently
    const initializeAudio = () => {
      // Attempt to unlock the audio context
      if (Howler.ctx && Howler.ctx.state !== 'running') {
        Howler.ctx.resume().then(() => {
          console.log("AudioContext resumed successfully on user interaction");
        }).catch((err: any) => {
          console.error("Failed to resume AudioContext:", err);
        });
      }
      
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

  // This component no longer renders anything visible
  return null;
};

export default AudioInitializer;