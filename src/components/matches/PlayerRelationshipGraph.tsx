// src/components/matches/PlayerRelationshipGraph.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Filter, ChevronDown, ChevronUp, Loader2, Network, Info } from 'lucide-react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { DBPlayer } from '../../services/DatabaseService';
import { useSound } from '../../context/SoundContext';
import { useDataSource } from '../../hooks/useDataSource';

interface PlayerRelationshipGraphProps {
  onBack: () => void;
  inheritedDateRange?: { startDate?: Date; endDate?: Date };
  recalculateTrueSkill?: boolean;
}

// Edge types
type EdgeType = 'teammate_won' | 'teammate_lost' | 'opponent_won' | 'opponent_lost';

// Graph data structures
interface GraphNode {
  id: string;
  playerName: string;
  totalGames: number;
  winRate: number;
  displayRating: number;
  skillPercentile: number; // 0-1, position in skill distribution
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: EdgeType;
  count: number;
  percentage: number; // 0-1, percentage of games with this outcome
  curvature: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface PlayerWithStats extends DBPlayer {
  winRate: number;
  displayRating: number;
  skillPercentile: number;
}

// Edge colors
const edgeColors: Record<EdgeType, string> = {
  teammate_won: '#3B82F6',    // Blue
  teammate_lost: '#A855F7',   // Purple
  opponent_won: '#22C55E',    // Green
  opponent_lost: '#EF4444'    // Red
};

const edgeLabels: Record<EdgeType, string> = {
  teammate_won: 'Won together',
  teammate_lost: 'Lost together',
  opponent_won: 'Beat',
  opponent_lost: 'Lost to'
};

// Interpolate between two hex colors
const interpolateColor = (color1: string, color2: string, factor: number): string => {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Node color based on skill percentile (0 = lowest, 1 = highest)
// Gradient: Red -> Orange -> Yellow -> Green
const getNodeColor = (percentile: number): string => {
  const clampedPercentile = Math.max(0, Math.min(1, percentile));

  // Color stops: red (0%) -> orange (33%) -> yellow (66%) -> green (100%)
  const colors = [
    { stop: 0, color: '#EF4444' },    // Red
    { stop: 0.33, color: '#F97316' }, // Orange
    { stop: 0.66, color: '#EAB308' }, // Yellow
    { stop: 1, color: '#22C55E' }     // Green
  ];

  // Find the two colors to interpolate between
  for (let i = 0; i < colors.length - 1; i++) {
    if (clampedPercentile <= colors[i + 1].stop) {
      const range = colors[i + 1].stop - colors[i].stop;
      const factor = (clampedPercentile - colors[i].stop) / range;
      return interpolateColor(colors[i].color, colors[i + 1].color, factor);
    }
  }

  return colors[colors.length - 1].color;
};

// Calculate skill percentile for a player based on their position in the distribution
const calculateSkillPercentile = (displayRating: number, allRatings: number[]): number => {
  if (allRatings.length <= 1) return 0.5;

  const sorted = [...allRatings].sort((a, b) => a - b);
  const minRating = sorted[0];
  const maxRating = sorted[sorted.length - 1];

  if (maxRating === minRating) return 0.5;

  return (displayRating - minRating) / (maxRating - minRating);
};

const PlayerRelationshipGraph: React.FC<PlayerRelationshipGraphProps> = ({
  onBack,
  inheritedDateRange,
  recalculateTrueSkill = false
}) => {
  const { playSound } = useSound();
  const { isViewModeLoading, getAllPlayers, getPlayerRelationshipNetwork, getPlayerDisplayRating, getFilteredPlayerStats } = useDataSource();
  const [loading, setLoading] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Players with recorded relationships (filtered list)
  const [availablePlayers, setAvailablePlayers] = useState<PlayerWithStats[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Inherited filter state (only date range now)
  const [usingInheritedFilters, setUsingInheritedFilters] = useState<boolean>(
    !!(inheritedDateRange?.startDate && inheritedDateRange?.endDate)
  );
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() => {
    if (inheritedDateRange?.startDate && inheritedDateRange?.endDate) {
      return {
        start: inheritedDateRange.startDate.toISOString().split('T')[0],
        end: inheritedDateRange.endDate.toISOString().split('T')[0]
      };
    }
    return { start: null, end: null };
  });

  // Edge type visibility
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Record<EdgeType, boolean>>({
    teammate_won: true,
    teammate_lost: true,
    opponent_won: true,
    opponent_lost: true
  });

  // Graph ref
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const hasInitializedRef = useRef(false); // Track if initial zoomToFit has been done
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map()); // Store node positions
  const cameraStateRef = useRef<{ x: number; y: number; k: number } | null>(null); // Store camera state
  const pendingCameraRestoreRef = useRef(false); // Flag to restore camera after data update

  // Callback ref to capture dimensions when container mounts
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) {
      const width = node.clientWidth || 800;
      const height = isMobile ? 450 : 600;
      setDimensions({ width, height });
    }
  }, [isMobile]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update container dimensions using ResizeObserver for accurate sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = containerRef.current.clientWidth || Math.floor(rect.width) || 800;
        const newHeight = isMobile ? 450 : 600;
        setDimensions(prev => {
          if (prev.width !== newWidth || prev.height !== newHeight) {
            return { width: newWidth, height: newHeight };
          }
          return prev;
        });
      }
    };

    const timeouts = [
      setTimeout(updateDimensions, 0),
      setTimeout(updateDimensions, 100),
      setTimeout(updateDimensions, 300),
    ];

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      timeouts.forEach(t => clearTimeout(t));
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [isMobile, selectedPlayers.size]);

  // Load available players (those with at least one recorded relationship)
  useEffect(() => {
    // Wait for view mode loading to complete
    if (isViewModeLoading) return;

    const loadAvailablePlayers = async () => {
      setLoadingPlayers(true);
      try {
        // Get all players with games
        const allPlayers = await getAllPlayers();
        const playersWithGames = allPlayers.filter(p => p.totalGames > 0);

        // Get all player IDs
        const allPlayerIds = playersWithGames.map(p => p.id);

        // Get relationships to filter to only players with data
        const startDate = dateRange.start ? new Date(dateRange.start) : undefined;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : undefined;
        const relationships = await getPlayerRelationshipNetwork(allPlayerIds, 1, startDate, endDate);
        const playerIdsWithData = new Set<string>();
        relationships.forEach(rel => {
          playerIdsWithData.add(rel.playerId);
          playerIdsWithData.add(rel.relatedPlayerId);
        });

        // Get ratings - either recalculated or current
        let playerRatings: Record<string, number> = {};
        if (recalculateTrueSkill && startDate) {
          // Use recalculated TrueSkill ratings for the filtered period
          const filteredStats = await getFilteredPlayerStats(startDate, endDate, true);
          playerRatings = filteredStats.players.reduce((acc, p) => {
            acc[p.id] = p.displayRating;
            return acc;
          }, {} as Record<string, number>);
        } else {
          // Use current ratings
          playersWithGames.forEach(p => {
            playerRatings[p.id] = getPlayerDisplayRating(p);
          });
        }

        // Filter to only players with relationship data and calculate stats
        const filteredPlayersBase = playersWithGames
          .filter(p => playerIdsWithData.has(p.id))
          .map(p => ({
            ...p,
            winRate: p.totalGames > 0 ? (p.wins / p.totalGames) * 100 : 0,
            displayRating: playerRatings[p.id] ?? getPlayerDisplayRating(p),
            skillPercentile: 0 // Will be calculated below
          }));

        // Calculate skill percentiles based on displayRating distribution
        const allRatings = filteredPlayersBase.map(p => p.displayRating);
        const filteredPlayers: PlayerWithStats[] = filteredPlayersBase.map(p => ({
          ...p,
          skillPercentile: calculateSkillPercentile(p.displayRating, allRatings)
        }));

        // Sort by name
        filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));

        setAvailablePlayers(filteredPlayers);
      } catch (error) {
        console.error('Error loading available players:', error);
        setAvailablePlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadAvailablePlayers();
  }, [isViewModeLoading, getAllPlayers, getPlayerRelationshipNetwork, getPlayerDisplayRating, getFilteredPlayerStats, dateRange, recalculateTrueSkill]);

  // Configure forces after graph ref is available
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const fg = graphRef.current;

      // Configure forces for stable, bounded layout
      fg.d3Force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2));

      const chargeForce = d3.forceManyBody<GraphNode>()
        .strength(-300)
        .distanceMax(300);
      fg.d3Force('charge', chargeForce);

      const collisionForce = d3.forceCollide<GraphNode>()
        .radius(50)
        .strength(1);
      fg.d3Force('collision', collisionForce);

      const linkForce = fg.d3Force('link') as d3.ForceLink<GraphNode, GraphLink> | undefined;
      if (linkForce) {
        linkForce.distance(120).strength(0.3);
      }

      // Boundary force
      const boundaryPadding = 60;
      const boundaryForce = () => {
        for (const node of graphData.nodes) {
          if (node.x !== undefined && node.y !== undefined) {
            const minX = boundaryPadding;
            const maxX = dimensions.width - boundaryPadding;
            const minY = boundaryPadding;
            const maxY = dimensions.height - boundaryPadding;

            if (node.x < minX) {
              node.vx = (node.vx || 0) + (minX - node.x) * 0.1;
            } else if (node.x > maxX) {
              node.vx = (node.vx || 0) + (maxX - node.x) * 0.1;
            }

            if (node.y < minY) {
              node.vy = (node.vy || 0) + (minY - node.y) * 0.1;
            } else if (node.y > maxY) {
              node.vy = (node.vy || 0) + (maxY - node.y) * 0.1;
            }
          }
        }
      };
      fg.d3Force('boundary', boundaryForce as any);

      fg.d3ReheatSimulation();

      // Handle camera positioning
      if (!hasInitializedRef.current && graphData.nodes.length >= 2) {
        hasInitializedRef.current = true;
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(400, 80);
            setTimeout(() => {
              if (graphRef.current) {
                const currentZoom = graphRef.current.zoom();
                const maxZoom = 1.5;
                if (currentZoom > maxZoom) {
                  graphRef.current.zoom(maxZoom, 300);
                }
              }
            }, 450);
          }
        }, 600);
      } else if (pendingCameraRestoreRef.current && cameraStateRef.current) {
        pendingCameraRestoreRef.current = false;
        const { x, y, k } = cameraStateRef.current;
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.centerAt(x, y, 0);
            graphRef.current.zoom(k, 0);
          }
        }, 50);
      }
    }
  }, [graphData.nodes.length, dimensions.width, dimensions.height]);

  // Load graph data when selection changes
  useEffect(() => {
    const loadData = async () => {
      if (selectedPlayers.size < 2) {
        setGraphData({ nodes: [], links: [] });
        return;
      }

      const playerIds = Array.from(selectedPlayers);

      // If we already have nodes, mark for camera restore after update
      if (hasInitializedRef.current && nodePositionsRef.current.size > 0) {
        pendingCameraRestoreRef.current = true;
      }

      setLoading(true);
      try {
        const startDate = dateRange.start ? new Date(dateRange.start) : undefined;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : undefined;
        const relationships = await getPlayerRelationshipNetwork(playerIds, 1, startDate, endDate);
        const data = buildGraphData(playerIds, relationships);
        setGraphData(data);
      } catch (error) {
        console.error('Error loading relationship data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedPlayers, getPlayerRelationshipNetwork, dateRange]);

  // Build graph data from relationships - preserves existing node positions
  const buildGraphData = useCallback((
    playerIds: string[],
    relationships: Array<{
      playerId: string;
      relatedPlayerId: string;
      relatedPlayerName: string;
      teammateWins: number;
      teammateLosses: number;
      opponentWins: number;
      opponentLosses: number;
    }>
  ): GraphData => {
    const existingPositions = nodePositionsRef.current;

    // Calculate centroid of existing nodes for placing new ones
    let centroidX = dimensions.width / 2;
    let centroidY = dimensions.height / 2;
    if (existingPositions.size > 0) {
      let sumX = 0, sumY = 0;
      existingPositions.forEach(pos => {
        sumX += pos.x;
        sumY += pos.y;
      });
      centroidX = sumX / existingPositions.size;
      centroidY = sumY / existingPositions.size;
    }

    const nodeCount = playerIds.length;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.25;
    const isInitialLoad = existingPositions.size === 0;

    const nodes: GraphNode[] = playerIds.map((playerId, index) => {
      const player = availablePlayers.find(p => p.id === playerId);

      // Preserve existing position if available
      const existingPos = existingPositions.get(playerId);
      let x: number, y: number;

      if (existingPos) {
        x = existingPos.x;
        y = existingPos.y;
      } else if (!isInitialLoad) {
        const angle = Math.random() * 2 * Math.PI;
        const dist = 50 + Math.random() * 50;
        x = centroidX + dist * Math.cos(angle);
        y = centroidY + dist * Math.sin(angle);
      } else {
        const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
        x = dimensions.width / 2 + radius * Math.cos(angle);
        y = dimensions.height / 2 + radius * Math.sin(angle);
      }

      return {
        id: playerId,
        playerName: player?.name || playerId,
        totalGames: player?.totalGames || 0,
        winRate: player?.winRate || 0,
        displayRating: player?.displayRating || 0,
        skillPercentile: player?.skillPercentile || 0.5,
        x,
        y
      };
    });

    // Build ALL links with percentage calculations
    const links: GraphLink[] = [];
    const processedTeammatePairs = new Set<string>();

    for (const rel of relationships) {
      const sourceId = rel.playerId;
      const targetId = rel.relatedPlayerId;
      const pairKey = [rel.playerId, rel.relatedPlayerId].sort().join('-');

      const totalTeammateGames = rel.teammateWins + rel.teammateLosses;
      const totalOpponentGames = rel.opponentWins + rel.opponentLosses;

      // Teammate won (undirected - only add once per pair)
      if (rel.teammateWins > 0 && !processedTeammatePairs.has(`${pairKey}-won`)) {
        processedTeammatePairs.add(`${pairKey}-won`);
        links.push({
          source: sourceId,
          target: targetId,
          type: 'teammate_won',
          count: rel.teammateWins,
          percentage: totalTeammateGames > 0 ? rel.teammateWins / totalTeammateGames : 0,
          curvature: 0.15
        });
      }

      // Teammate lost (undirected - only add once per pair)
      if (rel.teammateLosses > 0 && !processedTeammatePairs.has(`${pairKey}-lost`)) {
        processedTeammatePairs.add(`${pairKey}-lost`);
        links.push({
          source: sourceId,
          target: targetId,
          type: 'teammate_lost',
          count: rel.teammateLosses,
          percentage: totalTeammateGames > 0 ? rel.teammateLosses / totalTeammateGames : 0,
          curvature: -0.15
        });
      }

      // Opponent edges (directed)
      if (rel.opponentWins > 0) {
        links.push({
          source: sourceId,
          target: targetId,
          type: 'opponent_won',
          count: rel.opponentWins,
          percentage: totalOpponentGames > 0 ? rel.opponentWins / totalOpponentGames : 0,
          curvature: 0.25
        });
      }

      if (rel.opponentLosses > 0) {
        links.push({
          source: sourceId,
          target: targetId,
          type: 'opponent_lost',
          count: rel.opponentLosses,
          percentage: totalOpponentGames > 0 ? rel.opponentLosses / totalOpponentGames : 0,
          curvature: -0.25
        });
      }
    }

    return { nodes, links };
  }, [dimensions.width, dimensions.height, availablePlayers]);

  // Check if a link should be visible based on hover state
  const isLinkVisible = useCallback((link: GraphLink): boolean => {
    if (!hoveredNode) return false;

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (!visibleEdgeTypes[link.type]) return false;

    if (link.type.startsWith('teammate')) {
      return sourceId === hoveredNode || targetId === hoveredNode;
    } else {
      return sourceId === hoveredNode;
    }
  }, [hoveredNode, visibleEdgeTypes]);

  // Get hovered player name for display
  const hoveredPlayerName = useMemo(() => {
    if (!hoveredNode) return null;
    const player = availablePlayers.find(p => p.id === hoveredNode);
    return player?.name || null;
  }, [hoveredNode, availablePlayers]);

  const handleBack = useCallback(() => {
    playSound('buttonClick');
    onBack();
  }, [playSound, onBack]);

  const togglePlayer = useCallback((playerId: string) => {
    playSound('buttonClick');
    setSelectedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  }, [playSound]);

  const selectAllPlayers = useCallback(() => {
    playSound('buttonClick');
    setSelectedPlayers(new Set(availablePlayers.map(p => p.id)));
  }, [playSound, availablePlayers]);

  const clearSelection = useCallback(() => {
    playSound('buttonClick');
    setSelectedPlayers(new Set());
    hasInitializedRef.current = false;
    nodePositionsRef.current.clear();
  }, [playSound]);

  const toggleEdgeType = useCallback((type: EdgeType) => {
    playSound('buttonClick');
    setVisibleEdgeTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  }, [playSound]);

  const toggleFilters = () => {
    playSound('buttonClick');
    setShowFilters(!showFilters);
  };

  // Clear inherited filters and reset to defaults
  const clearInheritedFilters = () => {
    playSound('buttonClick');
    setUsingInheritedFilters(false);
    setDateRange({ start: null, end: null });
  };

  // Custom node rendering with player initials and win rate colors
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, _globalScale: number) => {
    const size = 40;
    const isHovered = hoveredNode === node.id;
    const isConnected = hoveredNode && graphData.links.some(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return isLinkVisible(link) && (sourceId === node.id || targetId === node.id);
    });
    const shouldHighlight = isHovered || isConnected;

    // Draw glow for highlighted nodes
    if (shouldHighlight) {
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size / 2 + 8, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? 'rgba(96, 165, 250, 0.4)' : 'rgba(96, 165, 250, 0.2)';
      ctx.fill();
    }

    // Draw circle with skill percentile color (gradient from red to green)
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, size / 2, 0, 2 * Math.PI);
    ctx.fillStyle = getNodeColor(node.skillPercentile);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = shouldHighlight ? '#60A5FA' : '#6B7280';
    ctx.lineWidth = shouldHighlight ? 3 : 2;
    ctx.stroke();

    // Draw initial (first letter of name)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Sans-Serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.playerName.charAt(0).toUpperCase(), node.x || 0, node.y || 0);

    // Draw name below
    const fontSize = shouldHighlight ? 13 : 11;
    ctx.font = `${shouldHighlight ? 'bold ' : ''}${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = shouldHighlight ? '#fff' : '#9CA3AF';
    ctx.fillText(node.playerName, node.x || 0, (node.y || 0) + size / 2 + 5);
  }, [hoveredNode, graphData.links, isLinkVisible]);

  // Node pointer area
  const nodePointerAreaPaint = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, 28, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  // Link color - returns transparent when link shouldn't be visible
  const linkColor = useCallback((link: GraphLink): string => {
    if (!isLinkVisible(link)) {
      return 'rgba(0,0,0,0)';
    }
    return edgeColors[link.type];
  }, [isLinkVisible]);

  // Link width - scaled by percentage
  const linkWidth = useCallback((link: GraphLink): number => {
    if (!isLinkVisible(link)) return 0;
    const minWidth = 1;
    const maxWidth = 10;
    return minWidth + (maxWidth - minWidth) * link.percentage;
  }, [isLinkVisible]);

  // Arrow length - no arrows
  const linkArrowLength = useCallback((): number => {
    return 0;
  }, []);

  // Custom link rendering - not needed
  const linkCanvasObjectMode = useCallback(() => undefined, []);
  const linkCanvasObject = useCallback(() => undefined, []);

  // Track camera state for restore after player selection changes
  const handleZoomPan = useCallback((transform: { k: number; x: number; y: number }) => {
    const centerX = (dimensions.width / 2 - transform.x) / transform.k;
    const centerY = (dimensions.height / 2 - transform.y) / transform.k;
    cameraStateRef.current = { x: centerX, y: centerY, k: transform.k };
  }, [dimensions.width, dimensions.height]);

  // Handle simulation tick - enforce boundaries and save positions
  const handleEngineTick = useCallback(() => {
    if (!graphRef.current) return;

    const padding = 60;

    for (const node of graphData.nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        const minX = padding;
        const maxX = dimensions.width - padding;
        const minY = padding;
        const maxY = dimensions.height - padding;

        if (node.x < minX) node.x = minX;
        if (node.x > maxX) node.x = maxX;
        if (node.y < minY) node.y = minY;
        if (node.y > maxY) node.y = maxY;

        nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
      }
    }
  }, [graphData.nodes, dimensions.width, dimensions.height]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 no-screenshot">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-300 hover:text-white"
        >
          <ChevronLeft size={20} className="mr-1" />
          <span>Back</span>
        </button>

        <h2 className="text-xl sm:text-2xl font-bold flex items-center">
          <Network size={24} className="mr-2" />
          Player Relationship Network
        </h2>
      </div>

      {/* Inherited Filters Banner */}
      {usingInheritedFilters && (
        <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center">
            <Filter size={18} className="mr-2 text-purple-400" />
            <span className="text-sm text-purple-200">
              Using date filter from Player Stats: {dateRange.start} to {dateRange.end}
              {recalculateTrueSkill && ' | TrueSkill recalculated'}
            </span>
          </div>
          <button
            onClick={clearInheritedFilters}
            className="text-sm text-purple-400 hover:text-purple-300 underline"
          >
            Reset to Defaults
          </button>
        </div>
      )}

      {/* Mobile Filter Toggle */}
      <div className="mb-4 sm:hidden no-screenshot">
        <button
          onClick={toggleFilters}
          className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-between"
        >
          <div className="flex items-center">
            <Filter size={18} className="mr-2" />
            <span>Settings ({selectedPlayers.size} players)</span>
          </div>
          {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Filters Section */}
      <div className={`${isMobile && !showFilters ? 'hidden' : ''} mb-4 no-screenshot`}>
        <div className="bg-gray-700 rounded-lg p-4">
          {/* Player Selection Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Select Players</span>
            <div className="flex gap-2">
              <button
                onClick={selectAllPlayers}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              >
                All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Player Grid */}
          {loadingPlayers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-400 mr-2" />
              <span className="text-gray-400">Loading players...</span>
            </div>
          ) : availablePlayers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No players with recorded relationships found
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mb-4">
              {availablePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`p-2 rounded-lg transition-all flex flex-col items-center ${
                    selectedPlayers.has(player.id)
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                  title={`${player.name} - Skill: ${player.displayRating}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: getNodeColor(player.skillPercentile) }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] mt-1 truncate w-full text-center leading-tight">
                    {player.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Edge Type Toggles */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(edgeColors) as EdgeType[]).map(type => (
              <button
                key={type}
                onClick={() => toggleEdgeType(type)}
                className={`flex items-center px-2 py-1 rounded transition-colors text-xs ${
                  visibleEdgeTypes[type]
                    ? 'bg-gray-600'
                    : 'bg-gray-800 opacity-40'
                }`}
                title={edgeLabels[type]}
              >
                <div
                  className="w-3 h-3 rounded-sm mr-1.5"
                  style={{ backgroundColor: edgeColors[type] }}
                />
                <span className="hidden sm:inline">{edgeLabels[type]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Graph Area */}
      {loading ? (
        <div className="flex justify-center items-center h-96">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="animate-spin text-blue-400 mb-2" />
            <span className="text-gray-400">Loading relationship data...</span>
          </div>
        </div>
      ) : selectedPlayers.size < 2 ? (
        <div className="bg-gray-700 rounded-lg p-12 text-center">
          <Network size={64} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg">
            Select at least 2 players to visualize their relationships
          </p>
        </div>
      ) : (
        <>
          {/* Hover instruction */}
          <div className="mb-2 px-3 py-2 bg-gray-700/50 rounded-lg text-center">
            {hoveredPlayerName ? (
              <span className="text-white">
                <span className="font-bold text-blue-400">{hoveredPlayerName}</span>
                <span className="text-gray-300">'s relationships:</span>
                <span className="ml-2 text-blue-400">■ Won with</span>
                <span className="mx-1 text-purple-400">■ Lost with</span>
                <span className="mx-1 text-green-400">■ Beat</span>
                <span className="ml-1 text-red-400">■ Lost to</span>
              </span>
            ) : (
              <span className="text-gray-400">
                Hover over a player to see their relationships
              </span>
            )}
          </div>

          {/* Graph Container */}
          <div
            ref={setContainerRef}
            className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 w-full"
            style={{ height: isMobile ? 450 : 600 }}
          >
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#111827"
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkColor={linkColor}
              linkWidth={linkWidth}
              linkCurvature={(link: GraphLink) => link.curvature}
              linkDirectionalArrowLength={linkArrowLength}
              linkDirectionalArrowRelPos={0.85}
              linkDirectionalArrowColor={linkColor}
              linkCanvasObjectMode={linkCanvasObjectMode}
              linkCanvasObject={linkCanvasObject}
              onNodeHover={(node) => setHoveredNode(node ? (node as GraphNode).id : null)}
              onEngineTick={handleEngineTick}
              onZoom={handleZoomPan}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              cooldownTime={3000}
              warmupTicks={50}
              enableNodeDrag={true}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              minZoom={0.5}
              maxZoom={3}
            />
          </div>
        </>
      )}

      {/* Legend */}
      {selectedPlayers.size >= 2 && !loading && (
        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-start">
            <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="mb-1">
                <strong>Hover</strong> over any player to reveal their relationships with other selected players.
              </p>
              <p className="mb-1">
                <span className="text-blue-400 font-medium">Blue</span> = won together,
                <span className="text-purple-400 font-medium ml-2">Purple</span> = lost together,
                <span className="text-green-400 font-medium ml-2">Green</span> = beat opponent,
                <span className="text-red-400 font-medium ml-2">Red</span> = lost to opponent.
              </p>
              <p className="text-gray-400">
                <strong>Node color</strong> = TrueSkill ranking (green = highest, yellow/orange = middle, red = lowest). <strong>Edge thickness</strong> = win/loss rate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerRelationshipGraph;
