// src/components/EndOfRoundAssistant.tsx
import React, { useState, useEffect } from 'react';
import { Player, Team } from '../types';
import { 
  CheckCircle, 
  X, 
  Skull, 
  Swords, 
  Users, 
  Bot, 
  Coins, 
  CirclePlus, 
  CircleMinus,
  ChevronRight,
  ChevronLeft,
  Star,
  CheckSquare
} from 'lucide-react';
import { useSound } from '../context/SoundContext';

interface EndOfRoundAssistantProps {
  players: Player[];
  onComplete: (stats?: { [playerId: number]: PlayerRoundStats }) => void;
  isVisible: boolean;
}

// Stats collected for a single round
export interface PlayerRoundStats {
  goldCollected: number;
  kills: number;
  assists: number;
  deaths: number;
  minionKills: number;
}

// Enum for stat tracking tabs
enum StatTrackingTab {
  Kills,
  Deaths,
  Minions,
  Gold
}

const EndOfRoundAssistant: React.FC<EndOfRoundAssistantProps> = ({
  players,
  onComplete,
  isVisible
}) => {
  const { playSound } = useSound();
  
  // State for tracking if logging is enabled
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(false);
  
  // State for player stats this round
  const [playerStats, setPlayerStats] = useState<{[playerId: number]: PlayerRoundStats}>({});
  
  // State for active tab
  const [activeTab, setActiveTab] = useState<StatTrackingTab>(StatTrackingTab.Kills);
  
  // Checklist state
  const [checklistItems, setChecklistItems] = useState<{[key: string]: boolean}>({
    minionBattle: false,
    pushLane: false,
    removeTokens: false,
    retrieveCards: false,
    levelUp: false,
    pityCoins: false
  });

  // Initialize stats for all players
  useEffect(() => {
    if (isVisible) {
      const initialStats: {[playerId: number]: PlayerRoundStats} = {};
      players.forEach(player => {
        initialStats[player.id] = {
          goldCollected: 0,
          kills: 0,
          assists: 0,
          deaths: 0,
          minionKills: 0
        };
      });
      setPlayerStats(initialStats);
      
      // Reset checklist
      setChecklistItems({
        minionBattle: false,
        pushLane: false,
        removeTokens: false,
        retrieveCards: false,
        levelUp: false,
        pityCoins: false
      });
      
      // Reset tab to kills
      setActiveTab(StatTrackingTab.Kills);
      
      // Play sound when showing
      playSound('phaseChange');
    }
  }, [players, isVisible, playSound]);

  // Handle stat changes with increment/decrement
  const adjustStat = (playerId: number, statName: keyof PlayerRoundStats, delta: number) => {
    playSound('buttonClick');
    setPlayerStats(prev => {
      const currentValue = prev[playerId]?.[statName] || 0;
      const newValue = Math.max(0, currentValue + delta);
      
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [statName]: newValue
        }
      };
    });
  };

  // Handle toggling checklist items
  const toggleChecklistItem = (key: string) => {
    playSound('buttonClick');
    setChecklistItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // NEW: Handle checking all checklist items at once
  const checkAllItems = () => {
    playSound('phaseChange');
    setChecklistItems({
      minionBattle: true,
      pushLane: true,
      removeTokens: true,
      retrieveCards: true,
      levelUp: true,
      pityCoins: true
    });
  };

  // Handle completion
  const handleComplete = () => {
    playSound('phaseChange');
    
    // Pass the stats back to parent component if logging is enabled
    if (loggingEnabled) {
      onComplete(playerStats);
    } else {
      onComplete();
    }
  };
  
  // Auto-calculate assists for team kills
  const handleTeamKill = (killerPlayerId: number) => {
    playSound('buttonClick');
    
    // Increment killer's kill count
    adjustStat(killerPlayerId, 'kills', 1);
    
    // Find killer's team
    const killer = players.find(p => p.id === killerPlayerId);
    if (!killer) return;
    
    // Give assists to all other team members
    players.forEach(player => {
      if (player.id !== killerPlayerId && player.team === killer.team) {
        adjustStat(player.id, 'assists', 1);
      }
    });
  };
  
  // Change tab for stat tracking
  const changeTab = (tab: StatTrackingTab) => {
    playSound('buttonClick');
    setActiveTab(tab);
  };

  if (!isVisible) return null;

  // Check if all checklist items are completed
  const allItemsChecked = Object.values(checklistItems).every(value => value);
  
  // Group players by team
  const titanPlayers = players.filter(p => p.team === Team.Titans);
  const atlanteanPlayers = players.filter(p => p.team === Team.Atlanteans);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">End of Round Assistant</h2>
          <button
            onClick={() => onComplete()}
            className="p-1 bg-gray-700 hover:bg-gray-600 rounded-full"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Checklist of actions */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-semibold">End of Round Checklist</h3>
            
            {/* NEW: Check All button */}
            <button
              onClick={checkAllItems}
              className="px-4 py-1 bg-green-600 hover:bg-green-500 rounded-lg flex items-center text-sm"
            >
              <CheckSquare size={16} className="mr-2" />
              Check All Items
            </button>
          </div>
          
          <div className="bg-gray-700/50 p-4 rounded-lg space-y-3">
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.minionBattle ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('minionBattle')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.minionBattle ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.minionBattle ? <CheckCircle size={16} /> : <span>1</span>}
              </div>
              <div>
                <p className="font-medium">Minion Battle</p>
                <p className="text-sm text-gray-300">Count minions in Battle Zone. Team with fewer minions removes the difference.</p>
              </div>
            </div>
            
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.pushLane ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('pushLane')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.pushLane ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.pushLane ? <CheckCircle size={16} /> : <span>2</span>}
              </div>
              <div>
                <p className="font-medium">Push the Lane <span className="text-gray-400 font-normal">(if applicable)</span></p>
                <p className="text-sm text-gray-300">Flip Wave counter, move Battle Zone, respawn minions.</p>
              </div>
            </div>
            
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.removeTokens ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('removeTokens')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.removeTokens ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.removeTokens ? <CheckCircle size={16} /> : <span>3</span>}
              </div>
              <div>
                <p className="font-medium">Remove Tokens, Return Markers</p>
                <p className="text-sm text-gray-300">Clear the board of all tokens and return markers.</p>
              </div>
            </div>
            
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.retrieveCards ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('retrieveCards')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.retrieveCards ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.retrieveCards ? <CheckCircle size={16} /> : <span>4</span>}
              </div>
              <div>
                <p className="font-medium">Retrieve Cards</p>
                <p className="text-sm text-gray-300">Take back all resolved and discarded cards into hand.</p>
              </div>
            </div>
            
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.levelUp ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('levelUp')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.levelUp ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.levelUp ? <CheckCircle size={16} /> : <span>5</span>}
              </div>
              <div>
                <p className="font-medium">Level Up</p>
                <p className="text-sm text-gray-300">If you have enough coins, purchase level up(s). This is mandatory!</p>
              </div>
            </div>
            
            <div 
              className={`flex items-start p-3 rounded cursor-pointer ${
                checklistItems.pityCoins ? 'bg-blue-900/30' : 'hover:bg-gray-600/50'
              }`}
              onClick={() => toggleChecklistItem('pityCoins')}
            >
              <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center mr-3 ${
                checklistItems.pityCoins ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {checklistItems.pityCoins ? <CheckCircle size={16} /> : <span>6</span>}
              </div>
              <div>
                <p className="font-medium">Collect Pity Coin</p>
                <p className="text-sm text-gray-300">Players who did NOT level up collect 1 coin.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Optional Logging */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <input 
              type="checkbox" 
              id="enableLogging" 
              checked={loggingEnabled} 
              onChange={e => {
                playSound('toggleSwitch');
                setLoggingEnabled(e.target.checked);
              }}
              className="mr-3 h-5 w-5"
            />
            <label htmlFor="enableLogging" className="text-xl font-medium">Log Player Stats (Optional)</label>
          </div>
          
          {loggingEnabled && (
            <div className="space-y-4">
              <p className="text-gray-300 italic">Enter stats for this round only. You only need to enter the stats you are interested in tracking.</p>
              
              {/* Tabs for different stat types */}
              <div className="flex border-b border-gray-700">
                <button 
                  className={`px-4 py-2 flex items-center ${activeTab === StatTrackingTab.Kills ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => changeTab(StatTrackingTab.Kills)}
                >
                  <Swords size={16} className="mr-2" /> Kills
                </button>
                <button 
                  className={`px-4 py-2 flex items-center ${activeTab === StatTrackingTab.Deaths ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => changeTab(StatTrackingTab.Deaths)}
                >
                  <Skull size={16} className="mr-2" /> Deaths
                </button>
                <button 
                  className={`px-4 py-2 flex items-center ${activeTab === StatTrackingTab.Minions ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => changeTab(StatTrackingTab.Minions)}
                >
                  <Bot size={16} className="mr-2" /> Minions
                </button>
                <button 
                  className={`px-4 py-2 flex items-center ${activeTab === StatTrackingTab.Gold ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => changeTab(StatTrackingTab.Gold)}
                >
                  <Coins size={16} className="mr-2" /> Gold
                </button>
              </div>
              
              {/* Tab content */}
              <div className="mt-4">
                {/* Kills Tab */}
                {activeTab === StatTrackingTab.Kills && (
                  <div>
                    <div className="mb-4 text-sm text-gray-300">
                      <p>When a player gets a kill, their teammates automatically receive an assist. Click on the player who got the kill.</p>
                    </div>
                    
                    {/* Team-based layout for kills */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Titans */}
                      <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                          Titans
                        </h4>
                        <div className="space-y-2">
                          {titanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-blue-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex space-x-2">
                                    <span className="flex items-center" title="Kills"><Swords size={12} className="mr-1" />{playerStats[player.id]?.kills || 0}</span>
                                    <span className="flex items-center" title="Assists"><Users size={12} className="mr-1" />{playerStats[player.id]?.assists || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded text-sm"
                                  onClick={() => handleTeamKill(player.id)}
                                >
                                  Got Kill
                                </button>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'kills', -1)}
                                  disabled={!playerStats[player.id]?.kills}
                                >
                                  <CircleMinus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Atlanteans */}
                      <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                          Atlanteans
                        </h4>
                        <div className="space-y-2">
                          {atlanteanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-red-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex space-x-2">
                                    <span className="flex items-center" title="Kills"><Swords size={12} className="mr-1" />{playerStats[player.id]?.kills || 0}</span>
                                    <span className="flex items-center" title="Assists"><Users size={12} className="mr-1" />{playerStats[player.id]?.assists || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
                                  onClick={() => handleTeamKill(player.id)}
                                >
                                  Got Kill
                                </button>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'kills', -1)}
                                  disabled={!playerStats[player.id]?.kills}
                                >
                                  <CircleMinus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Deaths Tab */}
                {activeTab === StatTrackingTab.Deaths && (
                  <div>
                    <div className="mb-4 text-sm text-gray-300">
                      <p>Record player deaths.</p>
                    </div>
                    
                    {/* Team-based layout for deaths */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Titans */}
                      <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                          Titans
                        </h4>
                        <div className="space-y-2">
                          {titanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-blue-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Deaths"><Skull size={12} className="mr-1" />{playerStats[player.id]?.deaths || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'deaths', -1)}
                                  disabled={!playerStats[player.id]?.deaths}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.deaths || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'deaths', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Atlanteans */}
                      <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                          Atlanteans
                        </h4>
                        <div className="space-y-2">
                          {atlanteanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-red-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Deaths"><Skull size={12} className="mr-1" />{playerStats[player.id]?.deaths || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'deaths', -1)}
                                  disabled={!playerStats[player.id]?.deaths}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.deaths || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'deaths', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Minion Kills Tab */}
                {activeTab === StatTrackingTab.Minions && (
                  <div>
                    <div className="mb-4 text-sm text-gray-300">
                      <p>Record minion kills.</p>
                    </div>
                    
                    {/* Team-based layout for minion kills */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Titans */}
                      <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                          Titans
                        </h4>
                        <div className="space-y-2">
                          {titanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-blue-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Minion Kills"><Bot size={12} className="mr-1" />{playerStats[player.id]?.minionKills || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'minionKills', -1)}
                                  disabled={!playerStats[player.id]?.minionKills}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.minionKills || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'minionKills', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Atlanteans */}
                      <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                          Atlanteans
                        </h4>
                        <div className="space-y-2">
                          {atlanteanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-red-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Minion Kills"><Bot size={12} className="mr-1" />{playerStats[player.id]?.minionKills || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'minionKills', -1)}
                                  disabled={!playerStats[player.id]?.minionKills}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.minionKills || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'minionKills', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Gold Tab */}
                {activeTab === StatTrackingTab.Gold && (
                  <div>
                    <div className="mb-4 text-sm text-gray-300">
                      <p>Record gold collected this round (before spending on level-ups and including pity coins).</p>
                    </div>
                    
                    {/* Team-based layout for gold collection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Titans */}
                      <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-blue-500"></div>
                          Titans
                        </h4>
                        <div className="space-y-2">
                          {titanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-blue-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Gold Collected"><Coins size={12} className="mr-1" />{playerStats[player.id]?.goldCollected || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'goldCollected', -1)}
                                  disabled={!playerStats[player.id]?.goldCollected}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.goldCollected || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'goldCollected', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Atlanteans */}
                      <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg">
                        <h4 className="font-bold text-lg mb-3 flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2 bg-red-500"></div>
                          Atlanteans
                        </h4>
                        <div className="space-y-2">
                          {atlanteanPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center bg-red-900/40 p-2 rounded">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-300 rounded-full overflow-hidden mr-2">
                                  {player.hero && (
                                    <img 
                                      src={player.hero.icon}
                                      alt={player.hero.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'https://via.placeholder.com/48?text=Hero';
                                      }}
                                    />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center">{player.name} <Star size={14} className="ml-1 text-yellow-500" />{player.hero?.complexity || 1}</div>
                                  <div className="text-xs flex items-center">
                                    <span className="flex items-center" title="Gold Collected"><Coins size={12} className="mr-1" />{playerStats[player.id]?.goldCollected || 0}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'goldCollected', -1)}
                                  disabled={!playerStats[player.id]?.goldCollected}
                                >
                                  <CircleMinus size={16} />
                                </button>
                                <div className="w-8 text-center font-bold">
                                  {playerStats[player.id]?.goldCollected || 0}
                                </div>
                                <button 
                                  className="bg-gray-700 hover:bg-gray-600 p-1 rounded"
                                  onClick={() => adjustStat(player.id, 'goldCollected', 1)}
                                >
                                  <CirclePlus size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Navigation buttons for tabs */}
                <div className="flex justify-between mt-4">
                  <button 
                    className="flex items-center px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={() => {
                      const newTab = Math.max(0, activeTab - 1);
                      changeTab(newTab);
                    }}
                    disabled={activeTab === 0}
                  >
                    <ChevronLeft size={16} className="mr-1" /> Previous
                  </button>
                  <button 
                    className="flex items-center px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={() => {
                      const newTab = Math.min(StatTrackingTab.Gold, activeTab + 1);
                      changeTab(newTab);
                    }}
                    disabled={activeTab === StatTrackingTab.Gold}
                  >
                    Next <ChevronRight size={16} className="ml-1" />
                  </button>
                </div>
              </div>
              
              {/* Current totals summary */}
              <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
                <h4 className="font-semibold mb-2">All Stats This Round</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="flex items-center text-blue-300">
                      <Swords size={16} className="mr-2" /> Total Kills
                    </div>
                    <div className="text-xl">
                      {Object.values(playerStats).reduce((sum, stats) => sum + (stats.kills || 0), 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center text-red-300">
                      <Skull size={16} className="mr-2" /> Total Deaths
                    </div>
                    <div className="text-xl">
                      {Object.values(playerStats).reduce((sum, stats) => sum + (stats.deaths || 0), 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center text-green-300">
                      <Bot size={16} className="mr-2" /> Minion Kills
                    </div>
                    <div className="text-xl">
                      {Object.values(playerStats).reduce((sum, stats) => sum + (stats.minionKills || 0), 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center text-yellow-300">
                      <Coins size={16} className="mr-2" /> Gold Collected
                    </div>
                    <div className="text-xl">
                      {Object.values(playerStats).reduce((sum, stats) => sum + (stats.goldCollected || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center">
          <div className={`text-${allItemsChecked ? 'green' : 'yellow'}-400 font-medium`}>
            {allItemsChecked ? 'All steps completed!' : 'Please complete all steps'}
          </div>
          
          <button 
            onClick={handleComplete}
            className={`px-6 py-3 rounded-lg text-white font-medium ${
              allItemsChecked 
                ? 'bg-green-600 hover:bg-green-500' 
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {loggingEnabled ? "Save Stats & Continue" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndOfRoundAssistant;