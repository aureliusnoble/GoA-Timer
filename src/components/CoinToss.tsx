// src/components/CoinToss.tsx
import React, { useState, useEffect } from 'react';
import { Team } from '../types';

interface CoinTossProps {
  result: Team;
  onComplete: () => void;
}

const CoinToss: React.FC<CoinTossProps> = ({ result, onComplete }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [showButton, setShowButton] = useState(false);
  
  useEffect(() => {
    // Start the coin flip animation
    setIsFlipping(true);
    
    // After animation completes, show the continue button
    const timer = setTimeout(() => {
      setShowButton(true);
    }, 3000); // Match this to the animation duration in CSS
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex flex-col items-center justify-center z-50">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-8 text-white">Randomizing Tiebreaker</h2>
        
        <div className="coin-flip-container">
          <div className={`coin ${isFlipping ? 'flipping' : ''}`}>
            <div className="coin-face heads">
              <div className="coin-emblem">Titans</div>
              <div className="coin-shine"></div>
            </div>
            <div className="coin-face tails">
              <div className="coin-emblem">Atlanteans</div>
              <div className="coin-shine"></div>
            </div>
          </div>
        </div>
        
        <div className="text-2xl font-bold mt-8 text-white">
          {result === Team.Titans ? 'Titans go first!' : 'Atlanteans go first!'}
        </div>
        
        <button 
          className={`continue-button ${showButton ? 'visible' : ''}`}
          onClick={onComplete}
        >
          Continue to Draft
        </button>
      </div>
    </div>
  );
};

export default CoinToss;