// src/components/common/ResumeGamePrompt.tsx
import React from 'react';
import { Play, X, Clock, User, Shield } from 'lucide-react';
import { GameState, Player, Team } from '../../types';
import { useSound } from '../../context/SoundContext';

interface ResumeGamePromptProps {
  gameState: GameState;
  players: Player[];
  onResume: () => void;
  onDiscard: () => void;
  savedTime: string; // Formatted time string showing when the game was saved
}

const ResumeGamePrompt: React.FC<ResumeGamePromptProps> = ({
  gameState,
  players,
  onResume,
  onDiscard,
  savedTime
}) => {
  const { playSound } = useSound();

  const handleResume = () => {
    playSound('buttonClick');
    onResume();
  };

  const handleDiscard = () => {
    playSound('buttonClick');
    onDiscard();
  };

  // Format gameState data to show summary
  const titanPlayers = players.filter(p => p.team === Team.Titans).length;
  const atlanteanPlayers = players.filter(p => p.team === Team.Atlanteans).length;

  // Get the phase display name
  const getPhaseDisplayName = (phase: string): string => {
    switch (phase) {
      case 'strategy': return 'Strategy Phase';
      case 'move': return 'Action Phase';
      case 'turn-end': return 'Turn Complete';
      default: return phase;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-lg border border-blue-500">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <Clock size={24} className="mr-2 text-blue-400" />
          Resume Previous Game?
        </h2>
        
        <p className="mb-4">
          You have an ongoing game session from <span className="font-medium text-blue-300">{savedTime}</span>.
          Would you like to resume where you left off?
        </p>
        
        <div className="bg-gray-700 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2 text-blue-200">Game Summary:</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-center">
              <Shield size={16} className="mr-2 text-yellow-400" />
              <span>Round {gameState.round}, Turn {gameState.turn}/4</span>
            </li>
            <li className="flex items-center">
              <User size={16} className="mr-2 text-green-400" />
              <span>{titanPlayers} Titans vs {atlanteanPlayers} Atlanteans</span>
            </li>
            <li className="flex justify-between">
              <span className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                Titans: {gameState.teamLives.titans} lives
              </span>
              <span className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                Atlanteans: {gameState.teamLives.atlanteans} lives
              </span>
            </li>
            <li>
              Current Phase: <span className="text-yellow-300">{getPhaseDisplayName(gameState.currentPhase)}</span>
            </li>
          </ul>
        </div>
        
        <div className="flex gap-4">
          <button
            className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-3 rounded-lg text-white font-medium flex items-center justify-center shadow-md"
            onClick={handleResume}
          >
            <Play size={18} className="mr-2" /> Resume Game
          </button>
          
          <button
            className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-3 rounded-lg text-white font-medium flex items-center justify-center shadow-md"
            onClick={handleDiscard}
          >
            <X size={18} className="mr-2" /> New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeGamePrompt;