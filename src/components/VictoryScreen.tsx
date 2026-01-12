// src/components/VictoryScreen.tsx
import React, { useEffect, useState } from 'react';
import { Team, GameLength, Player, VictoryType } from '../types';
import { Trophy, Home, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSound } from '../context/SoundContext';
import dbService from '../services/DatabaseService';
import EnhancedTooltip from './common/EnhancedTooltip';
import EndOfRoundAssistant, { PlayerRoundStats } from './EndOfRoundAssistant';
import VictoryTypeSelector from './common/VictoryTypeSelector';

interface VictoryScreenProps {
  winningTeam: Team;
  onReturnToSetup: () => void;
  players: Player[]; // Need players to save match data
  gameLength: GameLength;
  doubleLanes: boolean;
  // NEW: Function to update player stats with final round data
  onUpdatePlayerStats?: (playerStats: { [playerId: number]: PlayerRoundStats }) => void;
}

const VictoryScreen: React.FC<VictoryScreenProps> = ({ 
  winningTeam, 
  onReturnToSetup,
  players,
  gameLength,
  doubleLanes,
  onUpdatePlayerStats
}) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [isSavingMatchData, setSavingMatchData] = useState(false);
  const [matchDataSaved, setMatchDataSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // NEW: State for managing final round stats collection
  const [showStatsCollection, setShowStatsCollection] = useState<boolean>(false);
  const [finalRoundStatsRecorded, setFinalRoundStatsRecorded] = useState<boolean>(false);
  // State for victory type selection
  const [victoryType, setVictoryType] = useState<VictoryType | undefined>(undefined);
  const [victoryTypeError, setVictoryTypeError] = useState<string | null>(null);
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
  
  // Save match data to database
  const handleSaveMatchData = async () => {
    // Validate victory type selection
    if (!victoryType) {
      setVictoryTypeError('Please select how the match was won');
      playSound('buttonClick');
      return;
    }

    setSavingMatchData(true);
    setSaveError(null);
    setVictoryTypeError(null);

    try {
      playSound('buttonClick');

      // Prepare match data
      const matchData = {
        date: new Date(),
        winningTeam,
        gameLength,
        doubleLanes,
        victoryType
      };
      
      // Prepare player data
      const playerData = players.map(player => ({
        id: player.name, // Use name as player ID
        team: player.team,
        heroId: player.hero?.id || 0,
        heroName: player.hero?.name || 'Unknown Hero',
        heroRoles: player.hero?.roles || [],
        kills: player.stats?.totalKills,
        deaths: player.stats?.totalDeaths,
        assists: player.stats?.totalAssists,
        goldEarned: player.stats?.totalGoldEarned,
        minionKills: player.stats?.totalMinionKills,
        level: player.stats?.level
      }));
      
      // Save match data
      await dbService.recordMatch(matchData, playerData);
      
      // Update state
      setMatchDataSaved(true);
      playSound('phaseChange');
    } catch (error) {
      console.error('Error saving match data:', error);
      setSaveError('Failed to save match data. Please try again.');
    } finally {
      setSavingMatchData(false);
    }
  };

  // NEW: Handler for final round stats collection
  const handleFinalRoundStats = (stats?: { [playerId: number]: PlayerRoundStats }) => {
    playSound('buttonClick');
    
    // If stats provided and we have the update function, integrate them
    if (stats && onUpdatePlayerStats) {
      onUpdatePlayerStats(stats);
    }
    
    // Mark as recorded and hide the assistant
    setFinalRoundStatsRecorded(true);
    setShowStatsCollection(false);
    playSound('phaseChange');
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
        
        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 justify-center mt-4">
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
          
          {/* NEW: Record Final Round Stats button - only show if not recorded yet */}
          {!finalRoundStatsRecorded && animationComplete && (
            <EnhancedTooltip text="Record statistics for the final round before saving">
              <button
                onClick={() => {
                  playSound('buttonClick');
                  setShowStatsCollection(true);
                }}
                className={`px-6 py-3 rounded-lg text-white font-medium flex items-center mx-auto ${
                  winningTeam === Team.Titans 
                    ? 'bg-blue-700 hover:bg-blue-600' 
                    : 'bg-red-700 hover:bg-red-600'
                }`}
              >
                <Database size={20} className="mr-2" />
                Record Final Round Stats
              </button>
            </EnhancedTooltip>
          )}
          
          {/* Save Match Data button - always visible, but color changes when saved */}
          {animationComplete && (
            <EnhancedTooltip text={matchDataSaved ? "Match data saved successfully" : "Save match results to your statistics"}>
              <button
                onClick={handleSaveMatchData}
                disabled={isSavingMatchData || matchDataSaved}
                className={`px-6 py-3 rounded-lg text-white font-medium flex items-center mx-auto
                  ${matchDataSaved
                    ? 'bg-green-600 cursor-default'
                    : winningTeam === Team.Titans
                      ? 'bg-blue-700 hover:bg-blue-600'
                      : 'bg-red-700 hover:bg-red-600'
                  } ${isSavingMatchData ? 'opacity-70 cursor-wait' : 'opacity-100'}`}
              >
                {isSavingMatchData ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : matchDataSaved ? (
                  <>
                    <Database size={20} className="mr-2" />
                    Saved Successfully
                  </>
                ) : (
                  <>
                    <Database size={20} className="mr-2" />
                    Save Match Data
                  </>
                )}
              </button>
            </EnhancedTooltip>
          )}
        </div>

        {/* Victory Type Selection - Show before save button, hidden once saved */}
        {animationComplete && !matchDataSaved && (
          <div className="mt-6 p-4 bg-gray-800/80 rounded-lg max-w-md mx-auto">
            <VictoryTypeSelector
              value={victoryType}
              onChange={(type) => {
                setVictoryType(type);
                setVictoryTypeError(null);
                playSound('buttonClick');
              }}
              required={true}
            />
            {victoryTypeError && (
              <div className="mt-2 text-red-400 text-sm flex items-center justify-center">
                <AlertTriangle size={14} className="mr-1" />
                {victoryTypeError}
              </div>
            )}
          </div>
        )}
        
        {/* Match Data Saved Confirmation - shown below the buttons */}

        
        {/* NEW: Final Round Stats Recorded Confirmation */}
        {finalRoundStatsRecorded && animationComplete && (
          <div className="mt-4 px-5 py-3 bg-green-800/70 rounded-lg inline-block">
            <p className="flex items-center text-green-200">
              <CheckCircle size={16} className="mr-2" />
              Final round statistics recorded
            </p>
          </div>
        )}
        
        {/* Error Message */}
        {saveError && (
          <div className="mt-4 px-5 py-3 bg-red-800/70 rounded-lg inline-block">
            <p className="flex items-center text-red-200">
              <AlertTriangle size={16} className="mr-2" />
              {saveError}
            </p>
          </div>
        )}
      </div>
      
      {/* NEW: End of Round Assistant for final round stats collection */}
      <EndOfRoundAssistant 
        players={players}
        onComplete={handleFinalRoundStats}
        isVisible={showStatsCollection}
      />
      
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