// src/components/matches/SkillOverTime.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Search, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Dot
} from 'recharts';
import dbService, { getDisplayRating } from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import html2canvas from 'html2canvas';

interface SkillOverTimeProps {
  onBack: () => void;
}

interface TimeSeriesPoint {
  gameNumber: number;
  date: string;
  [playerId: string]: number | string; // Dynamic player ratings
}

interface PlayerData {
  id: string;
  name: string;
  color: string;
  lineStyle: string;
  visible: boolean;
  currentRating: number;
}

// Color palette for players (20 distinct colors)
const COLOR_PALETTE = [
  '#e60049', '#0bb4ff', '#50e991', '#e6d800', '#9b19f5',
  '#ffa300', '#dc0ab4', '#b3d4ff', '#00bfa0', '#b30000',
  '#7c1158', '#4421af', '#1a53ff', '#0d88e6', '#00b7c7',
  '#5ad45a', '#8be04e', '#ebdc78', '#fd7f6f', '#7eb0d5'
];

// Line styles for additional distinction
const LINE_STYLES = ['solid', 'dashed', 'dotted'];

const SkillOverTime: React.FC<SkillOverTimeProps> = ({ onBack }) => {
  const { playSound } = useSound();
  const [loading, setLoading] = useState(true);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  // Load and process data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get all players and matches
        const allPlayers = await dbService.getAllPlayers();
        const allMatches = await dbService.getAllMatches();
        
        // Sort matches by date
        const sortedMatches = [...allMatches].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Initialize player ratings tracking
        const playerRatings: { [playerId: string]: number[] } = {};
        const playerNames: { [playerId: string]: string } = {};
        
        // Set initial ratings for all players
        allPlayers.forEach(player => {
          playerRatings[player.id] = [];
          playerNames[player.id] = player.name;
        });

        // Build time series data by replaying matches
        const timeSeries: TimeSeriesPoint[] = [];
        let gameNumber = 0;

        // We need to track cumulative ratings after each match
        // This requires recalculating ratings chronologically
        const ratingHistory = await dbService.getHistoricalRatings();
        
        // Process rating history into time series
        ratingHistory.forEach((snapshot, index) => {
          const point: TimeSeriesPoint = {
            gameNumber: index + 1,
            date: snapshot.date
          };

          // Add each player's rating at this point
          Object.entries(snapshot.ratings).forEach(([playerId, rating]) => {
            point[playerId] = rating;
          });

          timeSeries.push(point);
        });

        // Calculate current average rating
        const activePlayerRatings = allPlayers
          .filter(p => p.totalGames > 0)
          .map(p => getDisplayRating(p));
        
        const avgRating = activePlayerRatings.length > 0
          ? Math.round(activePlayerRatings.reduce((sum, r) => sum + r, 0) / activePlayerRatings.length)
          : 1200;
        
        setAverageRating(avgRating);

        // Create player data with colors and styles
        const playerDataList: PlayerData[] = allPlayers
          .filter(p => p.totalGames > 0)
          .sort((a, b) => getDisplayRating(b) - getDisplayRating(a))
          .map((player, index) => ({
            id: player.id,
            name: player.name,
            color: COLOR_PALETTE[index % COLOR_PALETTE.length],
            lineStyle: LINE_STYLES[Math.floor(index / COLOR_PALETTE.length) % LINE_STYLES.length],
            visible: true,
            currentRating: getDisplayRating(player)
          }));

        setPlayers(playerDataList);
        setTimeSeriesData(timeSeries);
        
        // Default: show top 10 players
        const defaultSelection = new Set(
          playerDataList.slice(0, 10).map(p => p.id)
        );
        setSelectedPlayers(defaultSelection);
        
      } catch (error) {
        console.error('Error loading skill progression data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleBack = () => {
    playSound('buttonClick');
    onBack();
  };

  const togglePlayer = (playerId: string) => {
    playSound('buttonClick');
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  const selectAll = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set(players.map(p => p.id)));
  };

  const selectNone = () => {
    playSound('buttonClick');
    setSelectedPlayers(new Set());
  };

  const handleZoomIn = () => {
    playSound('buttonClick');
    setZoomLevel(Math.min(zoomLevel * 1.5, 5));
  };

  const handleZoomOut = () => {
    playSound('buttonClick');
    setZoomLevel(Math.max(zoomLevel / 1.5, 0.5));
  };

  const handleResetZoom = () => {
    playSound('buttonClick');
    setZoomLevel(1);
  };

  const handleExportChart = async () => {
    playSound('buttonClick');
    if (!chartContainerRef.current) return;

    try {
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#1F2937',
        scale: 2
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `skill-progression-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error exporting chart:', error);
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const relevantPayload = payload.filter((p: any) => 
        selectedPlayers.has(p.dataKey) && p.value !== null
      );

      if (relevantPayload.length === 0) return null;

      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">Game #{label}</p>
          {relevantPayload
            .sort((a: any, b: any) => b.value - a.value)
            .map((entry: any) => {
              const player = players.find(p => p.id === entry.dataKey);
              if (!player) return null;
              
              return (
                <div key={entry.dataKey} className="flex justify-between items-center gap-4">
                  <span style={{ color: entry.color }}>{player.name}:</span>
                  <span className="font-medium">{Math.round(entry.value)}</span>
                </div>
              );
            })}
        </div>
      );
    }
    return null;
  };

  // Custom dot to handle overlapping points
  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    const player = players.find(p => p.id === dataKey);
    
    if (!player || !selectedPlayers.has(dataKey)) return null;
    
    const isHovered = hoveredPlayer === dataKey;
    const radius = isHovered ? 5 : 3;
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={player.color}
        stroke={player.color}
        strokeWidth={2}
        opacity={isHovered ? 1 : 0.8}
      />
    );
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back to Player Stats</span>
        </button>
        <h2 className="text-2xl font-bold">Skill Rating Over Time</h2>
        <button
          onClick={handleExportChart}
          className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
        >
          <Download size={18} className="mr-2" />
          <span>Export Chart</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Player Selection Panel */}
        <div className="lg:col-span-1 bg-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Select Players</h3>
          
          {/* Search */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search players..."
              className="w-full px-3 py-2 pl-9 bg-gray-800 border border-gray-600 rounded-lg text-sm"
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>

          {/* Select All/None */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={selectAll}
              className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
            >
              Select None
            </button>
          </div>

          {/* Player List */}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredPlayers.map(player => (
              <label
                key={player.id}
                className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-600 ${
                  selectedPlayers.has(player.id) ? 'bg-gray-600' : ''
                }`}
                onMouseEnter={() => setHoveredPlayer(player.id)}
                onMouseLeave={() => setHoveredPlayer(null)}
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  className="mr-2"
                />
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: player.color }}
                />
                <span className="flex-1 text-sm">{player.name}</span>
                <span className="text-xs text-gray-400">({player.currentRating})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Chart Area */}
        <div className="lg:col-span-3 bg-gray-700 rounded-lg p-4">
          {/* Zoom Controls */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Rating Progression</h3>
            <div className="flex gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-600 hover:bg-gray-500 rounded"
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 bg-gray-600 hover:bg-gray-500 rounded"
                title="Reset Zoom"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-600 hover:bg-gray-500 rounded"
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div 
            ref={chartContainerRef}
            className="w-full overflow-x-auto"
            style={{ maxWidth: '100%' }}
          >
            <div style={{ width: `${Math.max(800, timeSeriesData.length * 20 * zoomLevel)}px`, height: '500px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="gameNumber" 
                    stroke="#9CA3AF"
                    label={{ value: 'Total Games Played', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    domain={['auto', 'auto']}
                    label={{ value: 'Skill Rating', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Average rating reference line */}
                  <ReferenceLine 
                    y={averageRating} 
                    stroke="#6B7280" 
                    strokeDasharray="5 5"
                    label={{ value: `Avg: ${averageRating}`, position: 'right' }}
                  />
                  
                  {/* Render lines for selected players */}
                  {players.map(player => {
                    if (!selectedPlayers.has(player.id)) return null;
                    
                    const isHovered = hoveredPlayer === player.id;
                    
                    return (
                      <Line
                        key={player.id}
                        type="monotone"
                        dataKey={player.id}
                        stroke={player.color}
                        strokeWidth={isHovered ? 3 : 2}
                        strokeDasharray={player.lineStyle === 'dashed' ? '5 5' : player.lineStyle === 'dotted' ? '2 2' : '0'}
                        dot={false}
                        opacity={isHovered ? 1 : hoveredPlayer && !isHovered ? 0.3 : 0.8}
                        connectNulls
                        onMouseEnter={() => setHoveredPlayer(player.id)}
                        onMouseLeave={() => setHoveredPlayer(null)}
                      />
                    );
                  })}
                  
                  {showLegend && <Legend />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 text-sm text-gray-400">
            <p>• Hover over lines to highlight specific players</p>
            <p>• Use zoom controls or scroll horizontally to navigate</p>
            <p>• Toggle players on/off using the checkbox list</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillOverTime;