// src/components/VictoryScreen.tsx
import React, { useEffect, useState } from 'react';
import { Team } from '../types';
import { Trophy, Home } from 'lucide-react';
import { useSound } from '../context/SoundContext';

interface VictoryScreenProps {
  winningTeam: Team;
  onReturnToSetup: () => void;
}

const VictoryScreen: React.FC<VictoryScreenProps> = ({ 
  winningTeam, 
  onReturnToSetup 
}) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const { playSound } = useSound();
  
  useEffect(() => {
    // Play victory sound when component mounts
    playSound('victory');
    
    // Start animation sequence
    const timer = setTimeout(() => {
      setAnimationComplete(true);
      // Play a subtle sound when the button appears
      playSound('buttonClick');
    }, 3000); // 3 seconds of animation
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleReturnClick = () => {
    playSound('buttonClick');
    onReturnToSetup();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
      {/* Background color based on winning team */}
      <div 
        className={`absolute inset-0 ${
          winningTeam === Team.Titans 
            ? 'bg-blue-900 bg-opacity-95' 
            : 'bg-red-900 bg-opacity-95'
        }`}
      ></div>
      
      <div className="relative z-10 text-center">
        {/* Victory trophy animation */}
        <div className="mb-8 transform scale-100 animate-bounce">
          <Trophy size={120} className={`${
            winningTeam === Team.Titans ? 'text-blue-300' : 'text-red-300'
          }`} />
        </div>
        
        <h1 className="text-6xl font-bold mb-4 animate-in fade-in">
          {winningTeam === Team.Titans ? 'Titan' : 'Atlantean'} Victory!
        </h1>
        
        <p className="text-2xl mb-12 opacity-75">
          The {winningTeam === Team.Titans ? 'Titan' : 'Atlantean'}s have emerged victorious!
        </p>
        
        {/* Animated stars */}
        <div className="victory-stars">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i}
              className={`absolute star-${i} text-${winningTeam === Team.Titans ? 'blue' : 'red'}-200`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.5,
                animation: `twinkle ${Math.random() * 2 + 1}s infinite alternate`
              }}
            >★</div>
          ))}
        </div>
        
        {/* Return to setup button */}
        <button
          onClick={handleReturnClick}
          className={`px-6 py-3 rounded-lg text-white font-medium flex items-center mx-auto ${
            animationComplete ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-500 ${
            winningTeam === Team.Titans 
              ? 'bg-blue-600 hover:bg-blue-500' 
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          <Home size={20} className="mr-2" />
          Return to Setup
        </button>
      </div>
      
      {/* Add CSS animation */}
      <style>{`
        @keyframes twinkle {
          0% { transform: scale(0.5); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0.9; }
        }
        
        .animate-in {
          animation: fadeIn 1s ease-out forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .victory-stars div {
          position: absolute;
          font-size: 1.5rem;
        }
      `}</style>
    </div>
  );
};

export default VictoryScreen;