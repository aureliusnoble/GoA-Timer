// src/context/SoundContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Howl, Howler } from 'howler';

// Define types for our sound context
interface SoundContextType {
  isSoundEnabled: boolean;
  toggleSound: () => void;
  playSound: (soundName: SoundName) => void;
  unlockAudio: () => void;
  isAudioReady: boolean;
}

// Sound names that can be played in the app
export type SoundName = 
  | 'buttonClick'
  | 'timerWarning'
  | 'timerComplete'
  | 'timerTick'
  | 'heroSelect'
  | 'heroBan'
  | 'coinFlip'
  | 'victory'
  | 'phaseChange'
  | 'turnStart'
  | 'turnComplete'
  | 'lifeChange'
  | 'toggleSwitch';

// Create the context with default values
const SoundContext = createContext<SoundContextType>({
  isSoundEnabled: true,
  toggleSound: () => {},
  playSound: () => {},
  unlockAudio: () => {},
  isAudioReady: false
});

// Sound files mapping
const SOUND_FILES: Record<SoundName, string> = {
  buttonClick: '/sounds/ui/button-click.mp3',
  timerWarning: '/sounds/timer/timer-warning.mp3',
  timerComplete: '/sounds/timer/timer-complete.mp3',
  timerTick: '/sounds/timer/timer-tick.mp3',
  heroSelect: '/sounds/game/hero-select.mp3',
  heroBan: '/sounds/game/hero-ban.mp3',
  coinFlip: '/sounds/game/coin-flip.mp3',
  victory: '/sounds/victory/victory.mp3',
  phaseChange: '/sounds/game/phase-change.mp3',
  turnStart: '/sounds/game/turn-start.mp3',
  turnComplete: '/sounds/game/turn-complete.mp3',
  lifeChange: '/sounds/game/life-change.mp3',
  toggleSwitch: '/sounds/ui/toggle-switch.mp3',
};

// Cache for loaded sound files
const soundCache: Record<string, Howl> = {};

export const SoundProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Get initial sound preference from localStorage, default to enabled
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('atlantis-sound-enabled');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Track if audio context is unlocked
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);

  // Function to unlock audio context
  const unlockAudio = () => {
    console.log("Attempting to unlock audio context...");
    if (Howler.ctx && Howler.ctx.state !== 'running') {
      Howler.ctx.resume().then(() => {
        console.log("AudioContext resumed successfully!");
        setIsAudioReady(true);
        
        // Play a silent sound to ensure audio is fully initialized
        const silentSound = new Howl({
          src: [SOUND_FILES.buttonClick],
          volume: 0.01
        });
        silentSound.play();
      }).catch((err:any) => {
        console.error("Failed to resume AudioContext:", err);
      });
    } else {
      console.log("AudioContext already running or not available");
      setIsAudioReady(true);
    }
  };

  // Load sounds on mount
  useEffect(() => {
    // Preload essential sounds when audio is ready
    if (isAudioReady) {
      console.log("Audio is ready, preloading essential sounds");
      const essentialSounds: SoundName[] = ['buttonClick', 'timerComplete', 'heroSelect', 'timerTick'];
      
      essentialSounds.forEach(soundName => {
        if (!soundCache[soundName]) {
          console.log(`Preloading sound: ${soundName}`);
          soundCache[soundName] = new Howl({
            src: [SOUND_FILES[soundName]],
            preload: true,
            volume: soundName === 'timerTick' ? 0.2 : 0.5,
            onload: () => console.log(`Successfully loaded: ${soundName}`),
            onloaderror: (error: any) => console.error(`Error loading ${soundName}:`, error)
          });
        }
      });
    }
    
    // Cleanup function
    return () => {
      console.log("Cleaning up sound cache");
      Object.values(soundCache).forEach(sound => sound.unload());
    };
  }, [isAudioReady]);

  // Save sound preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('atlantis-sound-enabled', isSoundEnabled.toString());
  }, [isSoundEnabled]);

  // Function to toggle sound on/off
  const toggleSound = () => {
    setIsSoundEnabled(prev => !prev);
  };

  // Function to play a sound with debug logging
  const playSound = (soundName: SoundName) => {
    console.log(`Attempting to play sound: ${soundName}`);
    
    if (!isSoundEnabled) {
      console.log('Sound is disabled, not playing');
      return;
    }
    
    if (!isAudioReady) {
      console.log('Audio context not ready, trying to unlock...');
      unlockAudio();
      return;
    }

    // If the sound is already loaded, play it
    if (soundCache[soundName]) {
      console.log(`Playing cached sound: ${soundName}`);
      soundCache[soundName].play();
      return;
    }

    // If not loaded yet, load and play
    console.log(`Loading new sound: ${soundName} from ${SOUND_FILES[soundName]}`);
    try {
      const sound = new Howl({
        src: [SOUND_FILES[soundName]],
        volume: soundName === 'timerTick' ? 0.2 : 0.5,
        onload: () => console.log(`Successfully loaded: ${soundName}`),
        onloaderror: (error: any) => console.error(`Error loading ${soundName}:`, error),
        onplay: () => console.log(`Started playing: ${soundName}`),
        onplayerror: (error: any) => console.error(`Error playing ${soundName}:`, error)
      });
      
      soundCache[soundName] = sound;
      sound.play();
    } catch (error) {
      console.error(`Exception when trying to play ${soundName}:`, error);
    }
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound, playSound, unlockAudio, isAudioReady }}>
      {children}
    </SoundContext.Provider>
  );
};

// Custom hook to use sound context
export const useSound = () => useContext(SoundContext);