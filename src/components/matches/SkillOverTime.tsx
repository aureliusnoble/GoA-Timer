// src/components/matches/SkillOverTime.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, TrendingUp, Users, Info, Camera, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import dbService from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import html2canvas from 'html2canvas';

interface SkillOverTimeProps {
  onBack: () => void;
}

interface RatingDataPoint {
  matchNumber: number;
  date: string;
  [key: string]: any; // Dynamic player names as keys
}

interface PlayerRatingHistory {
  playerId: string;
  playerName: string;
  data: { matchNumber: number; rating: number; date: string }[];
  currentRating: number;
  isActive: boolean;
}

// Mobile-friendly custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-700 max-w-xs">
        <p className="font-semibold mb-2">Match #{label}</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {payload
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span style={{ color: entry.color }} className="mr-2 truncate">
                  {entry.dataKey}:
                </span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }
  return null;
};

const SkillOverTime: React.FC<SkillOverTimeProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const [loading, setLoading] = useState(true);
  const [playerHistory, setPlayerHistory] = useState<PlayerRatingHistory[]>([]);
  const [chartData, setChartData] = useState<RatingDataPoint[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [colorMap, setColorMap] = useState<{ [key: string]: string }>({});
  const [takingScreenshot, setTakingScreenshot] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Load data on mount
  useEffect(() => {
    const loadRatingHistory = async () => {
      setLoading(true);
      try {
        const history = await dbService.getHistoricalRatings();
        // Get fresh current ratings for consistency with PlayerStats
        const currentRatings = await dbService.getCurrentTrueSkillRatings();
        
        // Process the data into player-centric format
        const playerMap = new Map<string, PlayerRatingHistory>();
        
        // Get all unique player IDs
        const allPlayerIds = new Set<string>();
        history.forEach(snapshot => {
          Object.keys(snapshot.ratings).forEach(playerId => {
            allPlayerIds.add(playerId);
          });
        });
        
        // Get player names
        const players = await dbService.getAllPlayers();
        const playerNameMap = new Map(players.map(p => [p.id, p.name]));
        
        // Build player history
        allPlayerIds.forEach(playerId => {
          const playerName = playerNameMap.get(playerId) || playerId;
          const data = history
            .filter(snapshot => snapshot.ratings[playerId] !== undefined)
            .map(snapshot => ({
              matchNumber: snapshot.matchNumber,
              rating: snapshot.ratings[playerId],
              date: snapshot.date
            }));
          
          if (data.length > 0) {
            // Use fresh current rating for consistency with PlayerStats
            const freshCurrentRating = currentRatings[playerId] || data[data.length - 1].rating;
            
            playerMap.set(playerId, {
              playerId,
              playerName,
              data,
              currentRating: freshCurrentRating,
              isActive: data.length >= 5 // Only show players with 5+ matches by default
            });
          }
        });
        
        // Convert to array and sort by current rating
        const playerHistoryArray = Array.from(playerMap.values())
          .sort((a, b) => b.currentRating - a.currentRating);
        
        setPlayerHistory(playerHistoryArray);
        
        // Select top 5 active players by default
        const topPlayers = playerHistoryArray
          .filter(p => p.isActive)
          .slice(0, 5)
          .map(p => p.playerId);
        setSelectedPlayers(new Set(topPlayers));
        
        // Generate colors
        const colors = generateColors(playerHistoryArray.length);
        const newColorMap: { [key: string]: string } = {};
        playerHistoryArray.forEach((player, index) => {
          newColorMap[player.playerName] = colors[index];
        });
        setColorMap(newColorMap);
        
      } catch (error) {
        console.error('Error loading rating history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadRatingHistory();
  }, []);
  
  // Update chart data when selected players change
  useEffect(() => {
    if (playerHistory.length === 0) return;
    
    // Get all match numbers
    const allMatchNumbers = new Set<number>();
    playerHistory
      .filter(p => selectedPlayers.has(p.playerId))
      .forEach(player => {
        player.data.forEach(d => allMatchNumbers.add(d.matchNumber));
      });
    
    // Create chart data points
    const dataPoints: RatingDataPoint[] = Array.from(allMatchNumbers)
      .sort((a, b) => a - b)
      .map(matchNumber => {
        const point: RatingDataPoint = { matchNumber, date: '' };
        
        playerHistory
          .filter(p => selectedPlayers.has(p.playerId))
          .forEach(player => {
            const matchData = player.data.find(d => d.matchNumber === matchNumber);
            if (matchData) {
              point[player.playerName] = matchData.rating;
              if (!point.date) point.date = matchData.date;
            }
          });
        
        return point;
      });
    
    setChartData(dataPoints);
  }, [selectedPlayers, playerHistory]);
  
  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };
  
  const togglePlayer = (playerId: string) => {
    playSound('buttonClick');
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };
  
  const selectAllPlayers = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set(playerHistory.map(p => p.playerId)));
  };
  
  const clearSelection = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set());
  };
  
  const generateColors = (count: number): string[] => {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
      '#06B6D4', '#A855F7', '#F43F5E', '#0EA5E9', '#22C55E'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  };
  
  const handleTakeScreenshot = async () => {
    if (!contentRef.current) return;
    
    playSound('buttonClick');
    setTakingScreenshot(true);
    
    try {
      // Add temporary title
      const titleElement = document.createElement('div');
      titleElement.className = 'screenshot-title text-center mb-6 bg-gray-800 p-6';
      titleElement.innerHTML = `
        <h1 class="text-3xl font-bold">Guards of Atlantis II - Skill Rating Over Time</h1>
        <p class="text-gray-400 mt-2">Generated on ${new Date().toLocaleDateString()}</p>
      `;
      
      contentRef.current.insertBefore(titleElement, contentRef.current.firstChild);
      
      // Hide no-screenshot elements
      const noScreenshotElements = contentRef.current.querySelectorAll('.no-screenshot');
      noScreenshotElements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      
      // Take screenshot
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#1F2937',
        scale: 2,
        logging: false,
        windowWidth: 1400,
        windowHeight: contentRef.current.scrollHeight
      });
      
      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `skill-over-time-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      
      // Cleanup
      contentRef.current.removeChild(titleElement);
      noScreenshotElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
    } catch (error) {
      console.error('Error creating screenshot:', error);
    } finally {
      setTakingScreenshot(false);
    }
  };
  
  const toggleFilters = () => {
    playSound('buttonClick');
    setShowFilters(!showFilters);
  };
  
  return (
    <div ref={contentRef} className="bg-gray-800 rounded-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 no-screenshot">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back</span>
        </button>
        
        <h2 className="text-xl sm:text-2xl font-bold">Skill Rating Over Time</h2>
        
        <button
          onClick={handleTakeScreenshot}
          disabled={takingScreenshot}
          className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg w-full sm:w-auto justify-center"
        >
          <Camera size={18} className="mr-2" />
          <span>{takingScreenshot ? 'Capturing...' : 'Screenshot'}</span>
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Mobile Filter Toggle */}
          <div className="mb-4 sm:hidden no-screenshot">
            <button
              onClick={toggleFilters}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center">
                <Filter size={18} className="mr-2" />
                <span>Player Selection ({selectedPlayers.size} selected)</span>
              </div>
              {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          
          {/* Player Selection - Collapsible on mobile */}
          <div className={`mb-6 no-screenshot ${!showFilters && isMobile ? 'hidden' : ''}`}>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h3 className="font-semibold flex items-center">
                  <Users size={18} className="mr-2" />
                  Select Players to Compare
                </h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={selectAllPlayers}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm flex-1 sm:flex-none"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm flex-1 sm:flex-none"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {playerHistory.map(player => (
                  <button
                    key={player.playerId}
                    onClick={() => togglePlayer(player.playerId)}
                    className={`p-2 sm:p-3 rounded-lg text-left transition-all ${
                      selectedPlayers.has(player.playerId)
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="font-medium truncate">{player.playerName}</div>
                    <div className="text-xs sm:text-sm opacity-80">
                      Rating: {player.currentRating}
                    </div>
                    <div className="text-xs opacity-60">
                      {player.data.length} matches
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Chart */}
          {selectedPlayers.size > 0 ? (
            <div className="bg-gray-700 rounded-lg p-2 sm:p-4">
              <div style={{ width: '100%', height: isMobile ? 300 : 500 }}>
                <ResponsiveContainer>
                  <LineChart 
                    data={chartData}
                    margin={{ 
                      top: 5, 
                      right: isMobile ? 5 : 30, 
                      left: isMobile ? 5 : 20, 
                      bottom: isMobile ? 40 : 5 
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="matchNumber" 
                      stroke="#9CA3AF"
                      label={{ 
                        value: 'Match Number', 
                        position: 'insideBottom', 
                        offset: isMobile ? -35 : -5,
                        style: { fontSize: isMobile ? 12 : 14 }
                      }}
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      label={{ 
                        value: 'Skill Rating', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { fontSize: isMobile ? 12 : 14 }
                      }}
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      wrapperStyle={{ zIndex: 100 }}
                    />
                    {!isMobile && showLegend && (
                      <Legend 
                        wrapperStyle={{ fontSize: 12 }}
                        iconType="line"
                      />
                    )}
                    {playerHistory
                      .filter(p => selectedPlayers.has(p.playerId))
                      .map(player => (
                        <Line
                          key={player.playerId}
                          type="monotone"
                          dataKey={player.playerName}
                          stroke={colorMap[player.playerName]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Mobile Legend */}
              {isMobile && showLegend && selectedPlayers.size > 0 && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Legend</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {playerHistory
                      .filter(p => selectedPlayers.has(p.playerId))
                      .map(player => (
                        <div key={player.playerId} className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: colorMap[player.playerName] }}
                          />
                          <span className="truncate">{player.playerName}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg p-8 text-center">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">Select players to view their rating progression</p>
            </div>
          )}
          
          {/* Info Box */}
          <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-start">
              <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="mb-2">
                  This chart shows how player skill ratings change over time. Each point represents a player's rating after a match.
                </p>
                <p>
                  Ratings use the TrueSkill system where new players start low and converge to their true skill level after ~20 matches.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SkillOverTime;