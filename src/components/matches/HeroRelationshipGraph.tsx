// src/components/matches/HeroRelationshipGraph.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Filter, ChevronDown, ChevronUp, Globe, Users, Loader2, Network, Info } from 'lucide-react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import * as d3 from 'd3-force';
import { GlobalStatsService } from '../../services/supabase/GlobalStatsService';
import { isSupabaseConfigured } from '../../services/supabase/SupabaseClient';
import { useSound } from '../../context/SoundContext';
import { heroes as allHeroes } from '../../data/heroes';
import { useDataSource } from '../../hooks/useDataSource';

interface HeroRelationshipGraphProps {
  onBack: () => void;
  initialStatsMode?: 'local' | 'global';
  inheritedDateRange?: { startDate?: Date; endDate?: Date };
}

// Edge types
type EdgeType = 'teammate_won' | 'teammate_lost' | 'opponent_won' | 'opponent_lost';

// Graph data structures
interface GraphNode {
  id: string;
  heroId: number;
  heroName: string;
  icon: string;
  totalGames: number;
  winRate: number;
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

const HeroRelationshipGraph: React.FC<HeroRelationshipGraphProps> = ({ onBack, initialStatsMode = 'local', inheritedDateRange }) => {
  const { playSound } = useSound();
  const { isViewModeLoading, getHeroRelationshipNetwork } = useDataSource();
  const [loading, setLoading] = useState(false);
  const [selectedHeroes, setSelectedHeroes] = useState<Set<number>>(new Set());
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Stats mode toggle
  const [statsMode, setStatsMode] = useState<'local' | 'global'>(initialStatsMode);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const cloudAvailable = isSupabaseConfigured();

  // Date range from inherited filters only
  const dateRange = useMemo(() => {
    if (inheritedDateRange?.startDate && inheritedDateRange?.endDate) {
      return {
        startDate: inheritedDateRange.startDate,
        endDate: inheritedDateRange.endDate
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [inheritedDateRange]);

  // Check if using inherited date filter
  const usingInheritedDateFilter = !!(inheritedDateRange?.startDate && inheritedDateRange?.endDate);

  // Heroes with recorded relationships (filtered list)
  const [availableHeroes, setAvailableHeroes] = useState<typeof allHeroes>([]);
  const [loadingHeroes, setLoadingHeroes] = useState(true);

  // Edge type visibility
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Record<EdgeType, boolean>>({
    teammate_won: true,
    teammate_lost: true,
    opponent_won: true,
    opponent_lost: true
  });

  // Hero images cache
  const [heroImages, setHeroImages] = useState<Record<string, HTMLImageElement>>({});

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
        // Use clientWidth as primary (more reliable), fall back to rect.width
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

    // Multiple timeouts to catch layout at different stages
    const timeouts = [
      setTimeout(updateDimensions, 0),
      setTimeout(updateDimensions, 100),
      setTimeout(updateDimensions, 300),
    ];

    // Use ResizeObserver for responsive updates
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
  }, [isMobile, selectedHeroes.size]); // Re-run when selection changes (container becomes visible)

  // Load available heroes (those with at least one recorded relationship)
  useEffect(() => {
    // Wait for view mode data to load
    if (isViewModeLoading) return;

    const loadAvailableHeroes = async () => {
      setLoadingHeroes(true);
      try {
        const allHeroIds = allHeroes.map(h => h.id);
        let heroIdsWithData = new Set<number>();

        if (statsMode === 'local') {
          // Get all relationships from local data with date filtering (view mode aware)
          const relationships = await getHeroRelationshipNetwork(
            allHeroIds,
            1, // Show all relationships
            dateRange.startDate,
            dateRange.endDate
          );
          relationships.forEach(rel => {
            heroIdsWithData.add(rel.heroId);
            heroIdsWithData.add(rel.relatedHeroId);
          });
        } else {
          // Get from global data (no date filtering available for global stats)
          const result = await GlobalStatsService.getHeroRelationshipNetwork(
            allHeroIds,
            1 // Show all relationships
          );
          if (result.success && result.data) {
            result.data.forEach(rel => {
              heroIdsWithData.add(rel.heroId);
              heroIdsWithData.add(rel.relatedHeroId);
            });
          }
        }

        // Filter to only heroes with data
        const filteredHeroes = allHeroes.filter(h => heroIdsWithData.has(h.id));
        setAvailableHeroes(filteredHeroes);
      } catch (error) {
        console.error('Error loading available heroes:', error);
        // Fallback to all heroes on error
        setAvailableHeroes(allHeroes);
      } finally {
        setLoadingHeroes(false);
      }
    };

    loadAvailableHeroes();
  }, [statsMode, dateRange.startDate, dateRange.endDate, isViewModeLoading, getHeroRelationshipNetwork]);

  // Preload hero images
  useEffect(() => {
    const loadImages = async () => {
      const images: Record<string, HTMLImageElement> = {};
      for (const hero of allHeroes) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = hero.icon;
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        images[String(hero.id)] = img;
      }
      setHeroImages(images);
    };
    loadImages();
  }, []);

  // Configure forces after graph ref is available
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const fg = graphRef.current;

      // Configure forces for stable, bounded layout
      // Center force - keeps graph centered
      fg.d3Force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2));

      // Charge force - repulsion between nodes (negative = repel)
      const chargeForce = d3.forceManyBody<GraphNode>()
        .strength(-300)
        .distanceMax(300);
      fg.d3Force('charge', chargeForce);

      // Collision force - prevents node overlap
      const collisionForce = d3.forceCollide<GraphNode>()
        .radius(50)
        .strength(1);
      fg.d3Force('collision', collisionForce);

      // Link force - adjust link distance
      const linkForce = fg.d3Force('link') as d3.ForceLink<GraphNode, GraphLink> | undefined;
      if (linkForce) {
        linkForce.distance(120).strength(0.3);
      }

      // Boundary force - custom force to keep nodes within bounds
      const boundaryPadding = 60;
      const boundaryForce = () => {
        for (const node of graphData.nodes) {
          if (node.x !== undefined && node.y !== undefined) {
            // Soft boundary - push back when approaching edges
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

      // Reheat simulation gently (don't restart from scratch)
      fg.d3ReheatSimulation();

      // Handle camera positioning
      if (!hasInitializedRef.current && graphData.nodes.length >= 2) {
        // Initial load - zoom to fit all nodes, but cap zoom level
        hasInitializedRef.current = true;
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(400, 80); // More padding
            // Cap zoom level to prevent over-zooming on few nodes
            setTimeout(() => {
              if (graphRef.current) {
                const currentZoom = graphRef.current.zoom();
                const maxZoom = 1.5; // Slightly more zoomed in
                if (currentZoom > maxZoom) {
                  graphRef.current.zoom(maxZoom, 300);
                }
              }
            }, 450); // After zoomToFit animation completes
          }
        }, 600);
      } else if (pendingCameraRestoreRef.current && cameraStateRef.current) {
        // Subsequent updates - restore camera position
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
    // Wait for view mode data to load
    if (isViewModeLoading) return;

    const loadData = async () => {
      if (selectedHeroes.size < 2) {
        setGraphData({ nodes: [], links: [] });
        return;
      }

      const heroIds = Array.from(selectedHeroes);

      // If we already have nodes, mark for camera restore after update
      if (hasInitializedRef.current && nodePositionsRef.current.size > 0) {
        pendingCameraRestoreRef.current = true;
      }

      if (statsMode === 'local') {
        setLoading(true);
        try {
          const relationships = await getHeroRelationshipNetwork(
            heroIds,
            1, // Show all relationships
            dateRange.startDate,
            dateRange.endDate
          );
          const data = buildGraphData(heroIds, relationships);
          setGraphData(data);
        } catch (error) {
          console.error('Error loading relationship data:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // Global mode (no date filtering available for global stats)
        setGlobalLoading(true);
        setGlobalError(null);
        try {
          const result = await GlobalStatsService.getHeroRelationshipNetwork(
            heroIds,
            1 // Show all relationships
          );
          if (result.success && result.data) {
            const data = buildGraphData(heroIds, result.data);
            setGraphData(data);
          } else {
            setGlobalError(result.error || 'Failed to load global data');
          }
        } catch (error) {
          console.error('Error loading global relationship data:', error);
          setGlobalError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
          setGlobalLoading(false);
        }
      }
    };

    loadData();
  }, [selectedHeroes, statsMode, dateRange.startDate, dateRange.endDate, isViewModeLoading, getHeroRelationshipNetwork]);

  // Build graph data from relationships - preserves existing node positions
  const buildGraphData = useCallback((
    heroIds: number[],
    relationships: Array<{
      heroId: number;
      relatedHeroId: number;
      teammateWins: number;
      teammateLosses: number;
      opponentWins: number;
      opponentLosses: number;
    }>
  ): GraphData => {
    // Use ref for existing positions (avoids stale closure issues)
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

    const nodeCount = heroIds.length;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.25;
    const isInitialLoad = existingPositions.size === 0;

    const nodes: GraphNode[] = heroIds.map((heroId, index) => {
      const hero = allHeroes.find(h => h.id === heroId);
      const nodeId = String(heroId);

      // Preserve existing position if available
      const existingPos = existingPositions.get(nodeId);
      let x: number, y: number;

      if (existingPos) {
        // Keep existing position
        x = existingPos.x;
        y = existingPos.y;
      } else if (!isInitialLoad) {
        // New node - place near centroid with slight offset
        const angle = Math.random() * 2 * Math.PI;
        const dist = 50 + Math.random() * 50;
        x = centroidX + dist * Math.cos(angle);
        y = centroidY + dist * Math.sin(angle);
      } else {
        // Initial load - use circular layout
        const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
        x = dimensions.width / 2 + radius * Math.cos(angle);
        y = dimensions.height / 2 + radius * Math.sin(angle);
      }

      return {
        id: nodeId,
        heroId,
        heroName: hero?.name || `Hero ${heroId}`,
        icon: hero?.icon || '',
        totalGames: 0,
        winRate: 0,
        x,
        y
      };
    });

    // Build ALL links with percentage calculations
    const links: GraphLink[] = [];
    const processedTeammatePairs = new Set<string>();

    for (const rel of relationships) {
      const sourceId = String(rel.heroId);
      const targetId = String(rel.relatedHeroId);
      const pairKey = [rel.heroId, rel.relatedHeroId].sort().join('-');

      // Calculate totals for percentage
      const totalTeammateGames = rel.teammateWins + rel.teammateLosses;
      const totalOpponentGames = rel.opponentWins + rel.opponentLosses;

      // Teammate won (undirected - only add once per pair)
      // Percentage = what % of games together did they win?
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
      // Percentage = what % of games together did they lose?
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
      // Percentage = what % of games against this opponent did they win/lose?
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
  }, [dimensions.width, dimensions.height]);

  // Check if a link should be visible based on hover state
  const isLinkVisible = useCallback((link: GraphLink): boolean => {
    if (!hoveredNode) return false; // No edges when nothing hovered

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    // Check if edge type is enabled
    if (!visibleEdgeTypes[link.type]) return false;

    if (link.type.startsWith('teammate')) {
      // Teammate edges - show if hovered node is either end
      return sourceId === hoveredNode || targetId === hoveredNode;
    } else {
      // Opponent edges - only show from hovered hero's perspective
      return sourceId === hoveredNode;
    }
  }, [hoveredNode, visibleEdgeTypes]);

  // Get hovered hero name for display
  const hoveredHeroName = useMemo(() => {
    if (!hoveredNode) return null;
    const hero = allHeroes.find(h => String(h.id) === hoveredNode);
    return hero?.name || null;
  }, [hoveredNode]);

  const handleBack = useCallback(() => {
    playSound('buttonClick');
    onBack();
  }, [playSound, onBack]);

  const toggleHero = useCallback((heroId: number) => {
    playSound('buttonClick');
    setSelectedHeroes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(heroId)) {
        newSet.delete(heroId);
      } else {
        newSet.add(heroId);
      }
      return newSet;
    });
  }, [playSound]);

  const selectAllHeroes = useCallback(() => {
    playSound('buttonClick');
    setSelectedHeroes(new Set(availableHeroes.map(h => h.id)));
  }, [playSound, availableHeroes]);

  const clearSelection = useCallback(() => {
    playSound('buttonClick');
    setSelectedHeroes(new Set());
    // Reset refs so next selection gets fresh zoomToFit
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

  // Custom node rendering with hero images
  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, _globalScale: number) => {
    const size = 40;
    const img = heroImages[node.id];
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

    // Draw circular image
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, size / 2, 0, 2 * Math.PI);
    ctx.closePath();

    // Fill background
    ctx.fillStyle = '#1F2937';
    ctx.fill();

    // Clip and draw image
    ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, (node.x || 0) - size / 2, (node.y || 0) - size / 2, size, size);
    } else {
      // Fallback circle with initial
      ctx.fillStyle = '#4B5563';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold 16px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.heroName.charAt(0), node.x || 0, node.y || 0);
    }
    ctx.restore();

    // Draw border
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, size / 2, 0, 2 * Math.PI);
    ctx.strokeStyle = shouldHighlight ? '#60A5FA' : '#6B7280';
    ctx.lineWidth = shouldHighlight ? 3 : 2;
    ctx.stroke();

    // Draw label below
    const fontSize = shouldHighlight ? 13 : 11;
    ctx.font = `${shouldHighlight ? 'bold ' : ''}${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = shouldHighlight ? '#fff' : '#9CA3AF';
    ctx.fillText(node.heroName, node.x || 0, (node.y || 0) + size / 2 + 5);
  }, [heroImages, hoveredNode, graphData.links, isLinkVisible]);

  // Node pointer area
  const nodePointerAreaPaint = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, 28, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  // Link color - returns transparent when link shouldn't be visible (no graph data change!)
  const linkColor = useCallback((link: GraphLink): string => {
    if (!isLinkVisible(link)) {
      return 'rgba(0,0,0,0)'; // Invisible
    }
    return edgeColors[link.type];
  }, [isLinkVisible]);

  // Link width - scaled by percentage (0% = 1px, 100% = 10px)
  const linkWidth = useCallback((link: GraphLink): number => {
    if (!isLinkVisible(link)) return 0;
    const minWidth = 1;
    const maxWidth = 10;
    return minWidth + (maxWidth - minWidth) * link.percentage;
  }, [isLinkVisible]);

  // Arrow length - no arrows (removed for cleaner look)
  const linkArrowLength = useCallback((): number => {
    return 0;
  }, []);

  // Custom link rendering - no labels, just use default line rendering
  const linkCanvasObjectMode = useCallback(() => undefined, []);

  const linkCanvasObject = useCallback(() => {
    // No custom rendering - edges are drawn by the library with thickness based on percentage
    return undefined;
  }, []);

  // Track camera state for restore after hero selection changes
  const handleZoomPan = useCallback((transform: { k: number; x: number; y: number }) => {
    // Convert transform to center coordinates
    // The transform x,y are the translation, and k is the zoom scale
    // Center = -translate / scale + canvasCenter / scale
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

        // Enforce boundaries
        if (node.x < minX) node.x = minX;
        if (node.x > maxX) node.x = maxX;
        if (node.y < minY) node.y = minY;
        if (node.y > maxY) node.y = maxY;

        // Save position to ref for persistence when adding/removing heroes
        nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
      }
    }
  }, [graphData.nodes, dimensions.width, dimensions.height]);

  const isLoading = loading || globalLoading || isViewModeLoading;

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
          Hero Relationship Network
        </h2>
      </div>

      {/* Stats Mode Toggle */}
      {cloudAvailable && (
        <div className="mb-4 no-screenshot">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                playSound('buttonClick');
                setStatsMode('local');
              }}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                statsMode === 'local'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Users size={18} className="mr-2" />
              Play Group
            </button>
            <button
              onClick={() => {
                playSound('buttonClick');
                setStatsMode('global');
              }}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                statsMode === 'global'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Globe size={18} className="mr-2" />
              Global
            </button>
          </div>
        </div>
      )}

      {/* Global Stats Banner */}
      {statsMode === 'global' && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg no-screenshot">
          <div className="flex items-center">
            <Globe size={18} className="mr-2 text-green-400 flex-shrink-0" />
            <span className="text-sm text-green-200">
              Viewing global statistics from all players
            </span>
          </div>
        </div>
      )}

      {/* Global Error */}
      {statsMode === 'global' && globalError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg no-screenshot">
          <p className="text-sm text-red-200">{globalError}</p>
        </div>
      )}

      {/* Inherited Filters Banner */}
      {usingInheritedDateFilter && (
        <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700/50 rounded-lg flex items-center flex-wrap gap-2 no-screenshot">
          <Filter size={18} className="mr-2 text-purple-400" />
          <span className="text-sm text-purple-200">
            Using date filter from Hero Stats: {inheritedDateRange?.startDate?.toLocaleDateString()} - {inheritedDateRange?.endDate?.toLocaleDateString()}
          </span>
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
            <span>Settings ({selectedHeroes.size} heroes)</span>
          </div>
          {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Filters Section */}
      <div className={`${isMobile && !showFilters ? 'hidden' : ''} mb-4 space-y-4 no-screenshot`}>
        {/* Hero Selection */}
        <div className="bg-gray-700 rounded-lg p-4">
          {/* Hero Selection Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Select Heroes</span>
            <div className="flex gap-2">
              <button
                onClick={selectAllHeroes}
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

          {/* Hero Grid - Bigger boxes, no scroll */}
          {loadingHeroes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-400 mr-2" />
              <span className="text-gray-400">Loading heroes...</span>
            </div>
          ) : availableHeroes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No heroes with recorded relationships found
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mb-4">
              {availableHeroes.map(hero => (
                <button
                  key={hero.id}
                  onClick={() => toggleHero(hero.id)}
                  className={`p-2 rounded-lg transition-all flex flex-col items-center ${
                    selectedHeroes.has(hero.id)
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                  title={hero.name}
                >
                  <img
                    src={hero.icon}
                    alt={hero.name}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=H';
                    }}
                  />
                  <span className="text-[10px] mt-1 truncate w-full text-center leading-tight">
                    {hero.name}
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
      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="animate-spin text-blue-400 mb-2" />
            <span className="text-gray-400">Loading relationship data...</span>
          </div>
        </div>
      ) : selectedHeroes.size < 2 ? (
        <div className="bg-gray-700 rounded-lg p-12 text-center">
          <Network size={64} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 text-lg">
            Select at least 2 heroes to visualize their relationships
          </p>
        </div>
      ) : (
        <>
          {/* Hover instruction */}
          <div className="mb-2 px-3 py-2 bg-gray-700/50 rounded-lg text-center">
            {hoveredHeroName ? (
              <span className="text-white">
                <span className="font-bold text-blue-400">{hoveredHeroName}</span>
                <span className="text-gray-300">'s relationships:</span>
                <span className="ml-2 text-blue-400">■ Won with</span>
                <span className="mx-1 text-purple-400">■ Lost with</span>
                <span className="mx-1 text-green-400">■ Beat</span>
                <span className="ml-1 text-red-400">■ Lost to</span>
              </span>
            ) : (
              <span className="text-gray-400">
                Hover over a hero to see their relationships
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
      {selectedHeroes.size >= 2 && !isLoading && (
        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-start">
            <Info size={16} className="mr-2 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="mb-1">
                <strong>Hover</strong> over any hero to reveal their relationships with other selected heroes.
              </p>
              <p className="mb-1">
                <span className="text-blue-400 font-medium">Blue</span> = won together,
                <span className="text-purple-400 font-medium ml-2">Purple</span> = lost together,
                <span className="text-green-400 font-medium ml-2">Green</span> = beat opponent,
                <span className="text-red-400 font-medium ml-2">Red</span> = lost to opponent.
              </p>
              <p className="text-gray-400">
                <strong>Edge thickness</strong> = win/loss rate (thicker = higher % of games with that outcome).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroRelationshipGraph;
