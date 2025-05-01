import { useState, useEffect, useReducer, useRef } from 'react';
import './App.css';
import GameSetup from './components/GameSetup';
import GameTimer from './components/GameTimer';
import DraftingSystem from './components/DraftingSystem';
import CoinToss from './components/CoinToss';
import DraftModeSelection from './components/DraftModeSelection';
import CollapsibleFeedback from './components/common/CollapsibleFeedback';
import SoundToggle from './components/common/SoundToggle';
import AudioInitializer from './components/common/AudioInitializer';
import VictoryScreen from './components/VictoryScreen';
import { SoundProvider, useSound } from './context/SoundContext';
import { PlayerRoundStats } from './components/EndOfRoundAssistant';
import { 
  Hero, 
  GameState, 
  Player, 
  Team, 
  GameLength, 
  Lane, 
  LaneState, 
  DraftMode,
  DraftingState,
  PickBanStep,
  PlayerStats
} from './types';
import { getAllExpansions, filterHeroesByExpansions } from './data/heroes';

// Modified interface for lane state return type
// Fix: Removed the index signature and made it more explicit
interface LaneStateResult {
  single?: LaneState;
  top?: LaneState;
  bottom?: LaneState;
  hasMultipleLanes: boolean;
}

// Initial state for different game configurations - UPDATED
const getInitialLaneState = (
  gameLength: GameLength, 
  playerCount: number, 
  useDoubleLaneFor6Players: boolean
): LaneStateResult => {
  // Double lane for 7+ players or 6 players with double lane option enabled
  if (playerCount >= 7 || (playerCount === 6 && useDoubleLaneFor6Players && gameLength === GameLength.Long)) {
    return {
      top: {
        currentWave: 1,
        totalWaves: 7
      },
      bottom: {
        currentWave: 1,
        totalWaves: 7
      },
      hasMultipleLanes: true
    };
  } 
  
  // Default single lane
  return {
    single: {
      currentWave: 1,
      totalWaves: gameLength === GameLength.Quick ? 3 : 5
    },
    hasMultipleLanes: false
  };
};

// Calculate team lives based on game length and player count - UPDATED
const calculateTeamLives = (
  gameLength: GameLength, 
  playerCount: number, 
  useDoubleLaneFor6Players: boolean
): number => {
  if (gameLength === GameLength.Quick) {
    // Quick game: 4 lives for 3-5 players, 5 lives for 6 players
    return playerCount <= 5 ? 4 : 5;
  } else { // Long game
    // Special case: 6 players in single lane mode
    if (playerCount === 6 && !useDoubleLaneFor6Players) {
      return 8; // 6 players in long single-lane = 8 lives
    }
    
    // 3-5 players in single lane
    if (playerCount <= 5) {
      return 6;
    }
    
    // Double lane for 6-8 players
    if ((playerCount === 6 && useDoubleLaneFor6Players) || playerCount <= 8) {
      return 6;
    }
    
    // 9-10 players
    return 7;
  }
};

// Generate pick/ban sequence based on player count
const generatePickBanSequence = (playerCount: number): PickBanStep[] => {
  const sequence: PickBanStep[] = [];

  // MODIFIED: Round up to the nearest even number for odd counts
  // 5 → 6, 7 → 8, 9 → 10
  const adjustedPlayerCount = playerCount % 2 === 1 ? playerCount + 1 : playerCount;

  // Define the base sequence for 4 players as per your specification
  sequence.push({ team: 'A', action: 'ban', round: 1 }); // Tie-break team bans
  sequence.push({ team: 'B', action: 'ban', round: 1 }); // Other team bans
  sequence.push({ team: 'A', action: 'pick', round: 1 }); // tie break team picks
  sequence.push({ team: 'B', action: 'pick', round: 1 }); // other team picks
  sequence.push({ team: 'B', action: 'ban', round: 2 }); // other team bans
  sequence.push({ team: 'A', action: 'ban', round: 2 }); // tie break team bans
  sequence.push({ team: 'B', action: 'pick', round: 2 }); // other team picks
  sequence.push({ team: 'A', action: 'pick', round: 2 }); // tie break team picks

  // Add steps for 6 players (appended to the 4-player sequence)
  if (adjustedPlayerCount >= 6) {
    sequence.push({ team: 'A', action: 'ban', round: 3 }); // tie break team bans
    sequence.push({ team: 'B', action: 'ban', round: 3 }); // other team bans
    sequence.push({ team: 'B', action: 'pick', round: 3 }); // other team picks
    sequence.push({ team: 'A', action: 'pick', round: 3 }); // tie break team picks
  }

  // Add steps for 8 players (appended to the 6-player sequence)
  if (adjustedPlayerCount >= 8) {
    sequence.push({ team: 'B', action: 'ban', round: 4 }); // other team bans
    sequence.push({ team: 'A', action: 'ban', round: 4 }); // tie break team bans
    sequence.push({ team: 'A', action: 'pick', round: 4 }); // tie break team picks
    sequence.push({ team: 'B', action: 'pick', round: 4 }); // other team picks
  }

  // Add steps for 10 players (appended to the 8-player sequence)
  if (adjustedPlayerCount >= 10) {
    sequence.push({ team: 'B', action: 'ban', round: 5 }); // other team bans
    sequence.push({ team: 'A', action: 'ban', round: 5 }); // tie break team bans
    sequence.push({ team: 'B', action: 'pick', round: 5 }); // other team picks
    sequence.push({ team: 'A', action: 'pick', round: 5 }); // tie break team picks
  }

  return sequence;
};

// Create the initial game state
const createInitialGameState = (): GameState => {
  return {
    round: 1,
    turn: 1,
    gameLength: GameLength.Quick,
    waves: {
      [Lane.Single]: { currentWave: 1, totalWaves: 3 }
    },
    teamLives: {
      [Team.Titans]: 4,
      [Team.Atlanteans]: 4
    },
    currentPhase: 'setup',
    activeHeroIndex: -1,
    coinSide: Math.random() > 0.5 ? Team.Titans : Team.Atlanteans, // Random initial team
    hasMultipleLanes: false,
    completedTurns: [], // New field to track which players have moved
    allPlayersMoved: false // New field to track when all players have moved
  };
};

// Game state reducer
type GameAction = 
  | { type: 'START_GAME', payload: GameState }
  | { type: 'START_STRATEGY' }
  | { type: 'END_STRATEGY' }
  | { type: 'SELECT_PLAYER', playerIndex: number }
  | { type: 'MARK_PLAYER_COMPLETE', playerIndex: number }
  | { type: 'START_NEXT_TURN' }
  | { type: 'ADJUST_TEAM_LIFE', team: Team, delta: number }
  | { type: 'INCREMENT_WAVE', lane: Lane }
  | { type: 'DECREMENT_WAVE', lane: Lane } // New action for decrementing wave
  | { type: 'ADJUST_ROUND', delta: number } // New action for adjusting round
  | { type: 'ADJUST_TURN', delta: number }  // New action for adjusting turn
  | { type: 'DECLARE_VICTORY', team: Team } // New action for declaring victory
  | { type: 'RESET_GAME' }                  // New action for resetting game
  | { type: 'FLIP_COIN' };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'START_GAME':
      // Use the full payload to initialize game state
      return action.payload;
      
    case 'START_STRATEGY':
      return {
        ...state,
        currentPhase: 'strategy',
        activeHeroIndex: -1
      };
      
    case 'END_STRATEGY':
      // Transition from strategy to move selection phase
      return {
        ...state,
        currentPhase: 'move',
        activeHeroIndex: -1, // No player selected yet
        completedTurns: [] // Reset completed turns for this turn
      };
      
    case 'SELECT_PLAYER':
      // Only allow selecting a player that hasn't moved yet
      if (state.completedTurns.includes(action.playerIndex)) {
        return state;
      }
      
      return {
        ...state,
        activeHeroIndex: action.playerIndex
      };
      
    case 'MARK_PLAYER_COMPLETE': {
      // Add this player to the completed turns
      const newCompletedTurns = [...state.completedTurns, action.playerIndex];
      const allMoved = newCompletedTurns.length === players.length;
      
      // Check if all players have now moved
      if (allMoved) {
        return {
          ...state,
          completedTurns: newCompletedTurns,
          activeHeroIndex: -1,
          currentPhase: 'turn-end',
          allPlayersMoved: true
        };
      }
      
      return {
        ...state,
        completedTurns: newCompletedTurns,
        activeHeroIndex: -1
      };
    }
      
    case 'START_NEXT_TURN': {
      const newTurn = state.turn + 1;
      
      // If we've completed all 4 turns, go to next round
      if (newTurn > 4) {
        return {
          ...state,
          round: state.round + 1,
          turn: 1, 
          currentPhase: 'strategy',
          completedTurns: [],
          allPlayersMoved: false
        };
      } else {
        return {
          ...state,
          turn: newTurn,
          currentPhase: 'strategy',
          completedTurns: [],
          allPlayersMoved: false
        };
      }
    }
      
    case 'ADJUST_TEAM_LIFE':
      return {
        ...state,
        teamLives: {
          ...state.teamLives,
          [action.team]: Math.max(0, state.teamLives[action.team] + action.delta)
        }
      };
      
    case 'INCREMENT_WAVE': {
      if (action.lane === Lane.Single && !state.hasMultipleLanes) {
        const laneState = state.waves[Lane.Single];
        if (laneState) {
          return {
            ...state,
            waves: {
              ...state.waves,
              [Lane.Single]: {
                ...laneState,
                currentWave: Math.min(laneState.currentWave + 1, laneState.totalWaves)
              }
            }
          };
        }
      } else if (state.hasMultipleLanes && (action.lane === Lane.Top || action.lane === Lane.Bottom)) {
        const laneState = state.waves[action.lane];
        if (laneState) {
          return {
            ...state,
            waves: {
              ...state.waves,
              [action.lane]: {
                ...laneState,
                currentWave: Math.min(laneState.currentWave + 1, laneState.totalWaves)
              }
            }
          };
        }
      }
      return state;
    }
    
    // New case for decrementing wave
    case 'DECREMENT_WAVE': {
      if (action.lane === Lane.Single && !state.hasMultipleLanes) {
        const laneState = state.waves[Lane.Single];
        if (laneState) {
          return {
            ...state,
            waves: {
              ...state.waves,
              [Lane.Single]: {
                ...laneState,
                currentWave: Math.max(1, laneState.currentWave - 1)
              }
            }
          };
        }
      } else if (state.hasMultipleLanes && (action.lane === Lane.Top || action.lane === Lane.Bottom)) {
        const laneState = state.waves[action.lane];
        if (laneState) {
          return {
            ...state,
            waves: {
              ...state.waves,
              [action.lane]: {
                ...laneState,
                currentWave: Math.max(1, laneState.currentWave - 1)
              }
            }
          };
        }
      }
      return state;
    }
    
    // New case for adjusting round
    case 'ADJUST_ROUND': {
      const newRound = Math.max(1, state.round + action.delta);
      return {
        ...state,
        round: newRound
      };
    }
    
    // New case for adjusting turn
    case 'ADJUST_TURN': {
      const newTurn = Math.max(1, Math.min(4, state.turn + action.delta));
      return {
        ...state,
        turn: newTurn
      };
    }
    
    // New case for declaring victory
    case 'DECLARE_VICTORY': {
      return {
        ...state,
        currentPhase: 'victory',
        victorTeam: action.team
      };
    }
    
    // Fixed case for resetting game
    case 'RESET_GAME': {
      return createInitialGameState();
    }
      
    case 'FLIP_COIN':
      return {
        ...state,
        coinSide: state.coinSide === Team.Titans ? Team.Atlanteans : Team.Titans
      };
      
    default:
      return state;
  }
};

// Make players accessible to the reducer
let players: Player[] = [];

// Inner App component that has access to the Sound context
function AppContent() {
  // Access sound functions
  const { playSound, unlockAudio, isAudioReady } = useSound();

  // Game setup state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [strategyTime, setStrategyTime] = useState<number>(90); // 90 seconds default
  const [moveTime, setMoveTime] = useState<number>(30); // 30 seconds default
  const [strategyTimerEnabled, setStrategyTimerEnabled] = useState<boolean>(true);
  const [moveTimerEnabled, setMoveTimerEnabled] = useState<boolean>(true);
  const [gameLength, setGameLength] = useState<GameLength>(GameLength.Quick);
  
  // NEW: Option for 6-player double lane
  const [useDoubleLaneFor6Players, setUseDoubleLaneFor6Players] = useState<boolean>(false);
  
  // Players and heroes state
  const [localPlayers, setLocalPlayers] = useState<Player[]>([]);
  
  // Expansion selection state
  const [selectedExpansions, setSelectedExpansions] = useState<string[]>(getAllExpansions());
  
  // Max complexity state
  const [maxComplexity, setMaxComplexity] = useState<number>(4); // Default to 4 (maximum)
  
  // Drafting states
  const [isDraftingMode, setIsDraftingMode] = useState<boolean>(false);
  const [showDraftModeSelection, setShowDraftModeSelection] = useState<boolean>(false);
  const [draftingState, setDraftingState] = useState<DraftingState>({
    mode: DraftMode.None,
    currentTeam: Team.Titans,
    availableHeroes: [],
    assignedHeroes: [],
    selectedHeroes: [],
    bannedHeroes: [],
    currentStep: 0,
    pickBanSequence: [],
    isComplete: false
  });
  
  // NEW: Add draft history state for undo functionality
  const [draftHistory, setDraftHistory] = useState<DraftingState[]>([]);
  
  // Coin flip animation state
  const [showCoinAnimation, setShowCoinAnimation] = useState<boolean>(false);
  
  // Victory screen state
  const [showVictoryScreen, setShowVictoryScreen] = useState<boolean>(false);
  const [victorTeam, setVictorTeam] = useState<Team | null>(null);
  
  // Available heroes (filtered by expansions and complexity)
  const filteredHeroes = filterHeroesByExpansions(selectedExpansions).filter(
    hero => hero.complexity <= maxComplexity
  );
  
  // Update the shared players reference
  players = localPlayers;
  
  // Reference to track if we've checked player names
  const nameCheckRef = useRef<boolean>(false);
  
  // Initial game state
  const initialGameState = createInitialGameState();
  
  // Game state with reducer
  const [gameState, dispatch] = useReducer(gameReducer, initialGameState);
  
  // Timer states
  const [strategyTimerActive, setStrategyTimerActive] = useState<boolean>(false);
  const [moveTimerActive, setMoveTimerActive] = useState<boolean>(false);
  const [strategyTimeRemaining, setStrategyTimeRemaining] = useState<number>(strategyTime);
  const [moveTimeRemaining, setMoveTimeRemaining] = useState<number>(moveTime);

  // Attempt to unlock audio on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      console.log("First interaction detected, unlocking audio");
      unlockAudio();
      
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction, true);
      document.removeEventListener('keydown', handleFirstInteraction, true);
      document.removeEventListener('touchstart', handleFirstInteraction, true);
    };
    
    // Add event listeners for first interaction
    document.addEventListener('click', handleFirstInteraction, true);
    document.addEventListener('keydown', handleFirstInteraction, true);
    document.addEventListener('touchstart', handleFirstInteraction, true);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction, true);
      document.removeEventListener('keydown', handleFirstInteraction, true);
      document.removeEventListener('touchstart', handleFirstInteraction, true);
    };
  }, [unlockAudio]);

  // Check for duplicate player names
  const findDuplicateNames = (): string[] => {
    const names = localPlayers.map(p => p.name.trim()).filter(name => name !== '');
    const uniqueNames = new Set(names);
    
    if (uniqueNames.size !== names.length) {
      // Find which names are duplicated
      const duplicates: string[] = [];
      const seen = new Set<string>();
      
      for (const name of names) {
        if (seen.has(name)) {
          duplicates.push(name);
        } else {
          seen.add(name);
        }
      }
      
      return [...new Set(duplicates)]; // Return unique duplicates
    }
    
    return [];
  };

  // Add a new player
  const addPlayer = (team: Team) => {
    // Don't add more than 10 players
    if (localPlayers.length >= 10) {
      return;
    }
    
    playSound('buttonClick');
    
    // Determine lane for 8+ player games or 6 players with double lane enabled
    let lane: Lane | undefined = undefined;
    const hasDoubleLane = localPlayers.length >= 7 || 
                          (localPlayers.length === 5 && useDoubleLaneFor6Players && gameLength === GameLength.Long);
    
    if (hasDoubleLane) {
      // If we're adding the 7th or 8th player, or 6th with double lane enabled, assign lanes to everyone
      if (localPlayers.length === 6) {
        // We need to assign lanes to the first 6 players too
        const updatedPlayers = localPlayers.map((player, index) => ({
          ...player,
          lane: index < 3 ? Lane.Top : Lane.Bottom
        }));
        setLocalPlayers(updatedPlayers);
      } 
      
      // For the new player, assign to top or bottom lane
      if (localPlayers.length === 5 && useDoubleLaneFor6Players && gameLength === GameLength.Long) {
        lane = Lane.Top; // 6th player with double lane goes to top lane
      } else if (localPlayers.length === 6) {
        lane = Lane.Top; // 7th player goes to top lane
      } else if (localPlayers.length === 7) {
        lane = Lane.Bottom; // 8th player goes to bottom lane
      } else if (localPlayers.length >= 8) {
        // For 9th and 10th players, alternate lanes
        lane = localPlayers.length % 2 === 0 ? Lane.Top : Lane.Bottom;
      }
    }
    
    // Initialize player with default stats
    const newPlayer: Player = {
      id: localPlayers.length + 1,
      team,
      hero: null,
      lane,
      name: '', // Initialize with empty name
      stats: {
        totalGoldEarned: 0,
        totalKills: 0,
        totalAssists: 0,
        totalDeaths: 0,
        totalMinionKills: 0
      }
    };
    
    setLocalPlayers([...localPlayers, newPlayer]);
    
    // Enforce Long game for 8+ players
    if (localPlayers.length >= 7 && gameLength === GameLength.Quick) {
      setGameLength(GameLength.Long);
    }
  };

  // Remove a player
  const removePlayer = (playerId: number) => {
    // Find the player to remove
    const playerToRemove = localPlayers.find(p => p.id === playerId);
    if (!playerToRemove) return;
    
    playSound('buttonClick');
    
    // Filter out the player
    const updatedPlayers = localPlayers.filter(p => p.id !== playerId);
    
    // Reassign IDs to ensure contiguous numbering
    const reindexedPlayers = updatedPlayers.map((player, index) => ({
      ...player,
      id: index + 1
    }));
    
    // Update player state
    setLocalPlayers(reindexedPlayers);
    
    // If we've dropped below 8 players (or 6 with double lane option enabled), reset lanes if needed
    const shouldHaveDoubleLane = 
      reindexedPlayers.length >= 7 || 
      (reindexedPlayers.length === 6 && useDoubleLaneFor6Players && gameLength === GameLength.Long);
    
    if (!shouldHaveDoubleLane) {
      // If we no longer need double lanes, remove lane assignments
      const playersWithoutLanes = reindexedPlayers.map(player => ({
        ...player,
        lane: undefined
      }));
      setLocalPlayers(playersWithoutLanes);
    }
    
    // If we dropped below 7 players and were in long game mode,
    // we keep the same game length to avoid confusion
  };

  // Game length change handler
  const handleGameLengthChange = (newLength: GameLength) => {
    // Only allow changing to Quick if we have 6 or fewer players
    if (newLength === GameLength.Quick && localPlayers.length > 6) {
      alert('Quick game is only available for 6 or fewer players');
      return;
    }
    
    playSound('toggleSwitch');
    
    // When changing to Long, reset double lane for 6 players to false
    if (newLength === GameLength.Long && localPlayers.length === 6 && useDoubleLaneFor6Players) {
      // Remove lane assignments if we had them
      const playersWithoutLanes = localPlayers.map(player => ({
        ...player,
        lane: undefined
      }));
      setLocalPlayers(playersWithoutLanes);
      setUseDoubleLaneFor6Players(false);
    }
    
    setGameLength(newLength);
  };

  // Handle toggling expansions
  const handleToggleExpansion = (expansion: string) => {
    playSound('toggleSwitch');
    
    if (selectedExpansions.includes(expansion)) {
      // Remove the expansion if it's already selected
      setSelectedExpansions(selectedExpansions.filter(exp => exp !== expansion));
    } else {
      // Add the expansion if it's not already selected
      setSelectedExpansions([...selectedExpansions, expansion]);
    }
  };

  // Handle player name change
  const handlePlayerNameChange = (playerId: number, name: string) => {
    const updatedPlayers = localPlayers.map(player => {
      if (player.id === playerId) {
        return { ...player, name };
      }
      return player;
    });
    
    setLocalPlayers(updatedPlayers);
    nameCheckRef.current = false; // Reset name check when names change
  };

  // Check if we have enough heroes in the selected expansions for different draft modes
  const canUseDraftMode = (mode: DraftMode): boolean => {
    const playerCount = localPlayers.length;
    const availableHeroCount = filteredHeroes.length;
    
    switch(mode) {
      case DraftMode.AllPick:
        return availableHeroCount >= playerCount;
      case DraftMode.Single:
        return availableHeroCount >= playerCount * 3;
      case DraftMode.Random:
        return availableHeroCount >= playerCount + 2;
      case DraftMode.PickAndBan:
        return availableHeroCount >= playerCount * 2;
      default:
        return false;
    }
  };
  
  const [handicapTeam, setHandicapTeam] = useState<Team | null>(null);

  // Update the startDrafting function
  const startDrafting = () => {
    // Try to unlock audio again
    unlockAudio();
    
    // Check for duplicate names
    const duplicateNames = findDuplicateNames();
    if (duplicateNames.length > 0) {
      alert(`Players must have unique names. Duplicates found: ${duplicateNames.join(', ')}`);
      return;
    }
    
    playSound('buttonClick');
    
    // Validate team composition
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans);
    
    // UPDATED: Allow a difference of at most 1 player between teams
    if (Math.abs(titansPlayers.length - atlanteansPlayers.length) > 1) {
      alert('Teams must have equal player counts or differ by only 1 player');
      return;
    }
    
    // NEW: Determine which team has more players (if any)
    if (titansPlayers.length !== atlanteansPlayers.length) {
      const teamWithMorePlayers = titansPlayers.length > atlanteansPlayers.length 
        ? Team.Titans 
        : Team.Atlanteans;
      setHandicapTeam(teamWithMorePlayers);
    } else {
      setHandicapTeam(null);
    }
    
    // Check if each team has at least 2 players
    if (titansPlayers.length < 2 || atlanteansPlayers.length < 2) {
      alert('Each team must have at least 2 players');
      return;
    }
    
    // Check if all players have entered their names
    const playersWithoutNames = localPlayers.filter(p => !p.name.trim());
    if (playersWithoutNames.length > 0) {
      alert('All players must enter their names');
      return;
    }
    
    // Check if we have enough heroes in selected expansions
    if (!canUseDraftMode(DraftMode.AllPick)) {
      alert('Not enough heroes in selected expansions. Please select more expansions, increase complexity, or reduce player count.');
      return;
    }
    
    // Set an initial random tiebreaker coin and show animation
    const initialCoinSide = Math.random() > 0.5 ? Team.Titans : Team.Atlanteans;
    dispatch({ 
      type: 'START_GAME', 
      payload: {
        ...initialGameState,
        coinSide: initialCoinSide
      }
    });
    
    // Play coin flip sound and show animation
    playSound('coinFlip');
    
    // Show coin animation - the CoinToss component will handle showing
    // the draft mode selection when the user clicks "Continue"
    setShowCoinAnimation(true);
  };

  // Handle draft mode selection
  const handleSelectDraftMode = (mode: DraftMode) => {
    let initialDraftingState: DraftingState;
    const totalPlayerCount = localPlayers.length;
    
    playSound('buttonClick');
    
    // Always create a fresh copy of heroes to shuffle
    const availableHeroesForDraft = [...filteredHeroes];
    
    // Set current team based on the tiebreaker coin
    const firstTeam = gameState.coinSide; 
    
    // Perform a deep shuffle of the heroes array to ensure randomness
    const deepShuffledHeroes = shuffleArray([...availableHeroesForDraft]);
    
    switch (mode) {
      case DraftMode.AllPick:
        // All Pick mode - start with full hero pool, no assignments
        initialDraftingState = {
          mode,
          currentTeam: firstTeam,
          availableHeroes: deepShuffledHeroes,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        break;
        
      case DraftMode.Single:
        // Create a new shuffled array for each player's options
        // Ensure no duplicate heroes between players
        const heroPool = [...deepShuffledHeroes];
        const assignedHeroes = localPlayers.map(player => {
          // Take 3 unique heroes from the pool
          const heroOptions: Hero[] = [];
          for (let i = 0; i < 3; i++) {
            if (heroPool.length > 0) {
              // Get a random hero from what's left in the pool
              const randomIndex = Math.floor(Math.random() * heroPool.length);
              heroOptions.push(heroPool[randomIndex]);
              // Remove this hero from the pool so it's not assigned to other players
              heroPool.splice(randomIndex, 1);
            }
          }
          
          return {
            playerId: player.id,
            heroOptions: heroOptions
          };
        });
        
        initialDraftingState = {
          mode,
          currentTeam: firstTeam,
          availableHeroes: [],
          assignedHeroes,
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        break;
        
      case DraftMode.Random:
        // Perform fresh shuffle for Random mode
        const randomHeroPool = deepShuffledHeroes.slice(0, Math.min(totalPlayerCount + 2, deepShuffledHeroes.length));
        
        initialDraftingState = {
          mode,
          currentTeam: firstTeam,
          availableHeroes: randomHeroPool,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        break;
        
      case DraftMode.PickAndBan:
        // Generate pick and ban sequence based on player count
        const pickBanSequence = generatePickBanSequence(totalPlayerCount);
        
        initialDraftingState = {
          mode,
          currentTeam: firstTeam,
          availableHeroes: deepShuffledHeroes,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence,
          isComplete: false
        };
        break;
        
      default:
        // This shouldn't happen
        initialDraftingState = {
          mode: DraftMode.None,
          currentTeam: firstTeam,
          availableHeroes: [],
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
    }
    
    setDraftingState(initialDraftingState);
    // Clear history when starting a new draft
    setDraftHistory([]);
    setShowDraftModeSelection(false);
    setIsDraftingMode(true);
  };

  const handleDraftHeroSelect = (hero: Hero, playerId: number) => {
    // Save current state to history for undo
    setDraftHistory(prev => [...prev, { ...draftingState }]);
    
    playSound('heroSelect');
    
    const player = localPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    // Update selected heroes
    const newSelectedHeroes = [...draftingState.selectedHeroes, { playerId, hero }];
    
    // Update available heroes (remove selected hero)
    const newAvailableHeroes = draftingState.availableHeroes.filter(h => h.id !== hero.id);
    
    // Update assigned heroes (remove this assignment if in Single mode)
    const newAssignedHeroes = draftingState.mode === DraftMode.Single 
      ? draftingState.assignedHeroes.map(assignment => {
          if (assignment.playerId === playerId) {
            return {
              ...assignment,
              heroOptions: [] // Clear options after selection
            };
          }
          return assignment;
        })
      : draftingState.assignedHeroes;
    
    // Determine next team and completion status
    let newCurrentTeam = draftingState.currentTeam;
    let newStep = draftingState.currentStep;
    let isComplete = false;
    
    // Get player counts for each team
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans);
    
    // Count how many players on each team have selected heroes
    const titansPicked = newSelectedHeroes.filter(s => 
      localPlayers.find(p => p.id === s.playerId)?.team === Team.Titans
    ).length;
    
    const atlanteansPicked = newSelectedHeroes.filter(s => 
      localPlayers.find(p => p.id === s.playerId)?.team === Team.Atlanteans
    ).length;
    
    // Check if all players have selected heroes
    if (titansPicked >= titansPlayers.length && atlanteansPicked >= atlanteansPlayers.length) {
      isComplete = true;
    }
    
    // Handle next team selection based on draft mode
    if (draftingState.mode === DraftMode.Single || draftingState.mode === DraftMode.AllPick || draftingState.mode === DraftMode.Random) {
      // UPDATED: Check if a team has all heroes picked
      const titansComplete = titansPicked >= titansPlayers.length;
      const atlanteansComplete = atlanteansPicked >= atlanteansPlayers.length;
      
      if (titansComplete && !atlanteansComplete) {
        // If Titans are complete but Atlanteans aren't, it's Atlanteans' turn
        newCurrentTeam = Team.Atlanteans;
      } else if (atlanteansComplete && !titansComplete) {
        // If Atlanteans are complete but Titans aren't, it's Titans' turn
        newCurrentTeam = Team.Titans;
      } else {
        // Otherwise, alternate as normal
        newCurrentTeam = draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
      }
    } else if (draftingState.mode === DraftMode.PickAndBan) {
      // For pick and ban, move to next step
      newStep = draftingState.currentStep + 1;
      
      // Check if we've completed all steps
      if (newStep >= draftingState.pickBanSequence.length) {
        isComplete = true;
      } else {
        // UPDATED: Check if we need to skip a step because a team has all heroes
        let skipStep = false;
        
        do {
          // Get the next step
          const nextStep = draftingState.pickBanSequence[newStep];
          
          // Only need to check for 'pick' actions (can't skip bans)
          if (nextStep && nextStep.action === 'pick') {
            // Determine which team corresponds to 'A' and 'B'
            const teamAIsFirst = gameState.coinSide === Team.Titans;
            const nextTeam = nextStep.team === 'A' 
              ? (teamAIsFirst ? Team.Titans : Team.Atlanteans)
              : (teamAIsFirst ? Team.Atlanteans : Team.Titans);
            
            // Check if this team already has all heroes picked
            const teamComplete = nextTeam === Team.Titans 
              ? titansPicked >= titansPlayers.length
              : atlanteansPicked >= atlanteansPlayers.length;
            
            // Skip this step if team is complete
            if (teamComplete) {
              skipStep = true;
              newStep++;
              
              // If we've run out of steps, mark as complete
              if (newStep >= draftingState.pickBanSequence.length) {
                isComplete = true;
                break;
              }
            } else {
              skipStep = false;
            }
          } else {
            // Don't skip ban steps
            skipStep = false;
          }
        } while (skipStep && newStep < draftingState.pickBanSequence.length);
        
        // If we haven't completed all steps, determine the next team
        if (!isComplete && newStep < draftingState.pickBanSequence.length) {
          const nextTeamChar = draftingState.pickBanSequence[newStep].team;
          const teamAIsFirst = gameState.coinSide === Team.Titans;
          
          if (nextTeamChar === 'A') {
            newCurrentTeam = teamAIsFirst ? Team.Titans : Team.Atlanteans;
          } else {
            newCurrentTeam = teamAIsFirst ? Team.Atlanteans : Team.Titans;
          }
        }
      }
    }
    
    // Update drafting state
    setDraftingState({
      ...draftingState,
      currentTeam: newCurrentTeam,
      availableHeroes: newAvailableHeroes,
      assignedHeroes: newAssignedHeroes,
      selectedHeroes: newSelectedHeroes,
      currentStep: newStep,
      isComplete
    });
  };

  // Handle hero ban in draft mode
  const handleDraftHeroBan = (hero: Hero) => {
    // Save current state to history for undo
    setDraftHistory(prev => [...prev, { ...draftingState }]);
    
    playSound('heroBan');
    
    if (draftingState.mode !== DraftMode.PickAndBan) return;
    
    // Update banned heroes
    const newBannedHeroes = [...draftingState.bannedHeroes, hero];
    
    // Update available heroes
    const newAvailableHeroes = draftingState.availableHeroes.filter(h => h.id !== hero.id);
    
    // Move to next step in the sequence
    const newStep = draftingState.currentStep + 1;
    
    // Determine next team
    let newCurrentTeam = draftingState.currentTeam;
    let isComplete = draftingState.isComplete;
    
    // Check if we've completed all steps
    if (newStep >= draftingState.pickBanSequence.length) {
      isComplete = true;
    } else {
      // Determine next team based on the sequence
      const nextTeamChar = draftingState.pickBanSequence[newStep].team;
      const teamAIsFirst = gameState.coinSide === Team.Titans;
      
      if (nextTeamChar === 'A') {
        newCurrentTeam = teamAIsFirst ? Team.Titans : Team.Atlanteans;
      } else {
        newCurrentTeam = teamAIsFirst ? Team.Atlanteans : Team.Titans;
      }
    }
    
    // Update drafting state
    setDraftingState({
      ...draftingState,
      currentTeam: newCurrentTeam,
      availableHeroes: newAvailableHeroes,
      bannedHeroes: newBannedHeroes,
      currentStep: newStep,
      isComplete
    });
  };

  // NEW: Handle undo last draft action
  const handleUndoLastDraftAction = () => {
    if (draftHistory.length > 0) {
      playSound('buttonClick');
      
      // Get the last state from history
      const previousState = draftHistory[draftHistory.length - 1];
      
      // Remove the last state from history
      setDraftHistory(prev => prev.slice(0, -1));
      
      // Restore previous state
      setDraftingState(previousState);
    }
  };

  // NEW: Create initial state for a draft mode
  const createInitialStateForDraftMode = (mode: DraftMode): DraftingState => {
    const totalPlayerCount = localPlayers.length;
    const availableHeroesForDraft = [...filteredHeroes];
    const firstTeam = gameState.coinSide;
    const deepShuffledHeroes = shuffleArray([...availableHeroesForDraft]);
    
    switch (mode) {
      case DraftMode.AllPick:
        return {
          mode,
          currentTeam: firstTeam,
          availableHeroes: deepShuffledHeroes,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        
      case DraftMode.Single:
        const heroPool = [...deepShuffledHeroes];
        const assignedHeroes = localPlayers.map(player => {
          const heroOptions: Hero[] = [];
          for (let i = 0; i < 3; i++) {
            if (heroPool.length > 0) {
              const randomIndex = Math.floor(Math.random() * heroPool.length);
              heroOptions.push(heroPool[randomIndex]);
              heroPool.splice(randomIndex, 1);
            }
          }
          
          return {
            playerId: player.id,
            heroOptions: heroOptions
          };
        });
        
        return {
          mode,
          currentTeam: firstTeam,
          availableHeroes: [],
          assignedHeroes,
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        
      case DraftMode.Random:
        const randomHeroPool = deepShuffledHeroes.slice(
          0, 
          Math.min(totalPlayerCount + 2, deepShuffledHeroes.length)
        );
        
        return {
          mode,
          currentTeam: firstTeam,
          availableHeroes: randomHeroPool,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
        
      case DraftMode.PickAndBan:
        const pickBanSequence = generatePickBanSequence(totalPlayerCount);
        
        return {
          mode,
          currentTeam: firstTeam,
          availableHeroes: deepShuffledHeroes,
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence,
          isComplete: false
        };
        
      default:
        return {
          mode: DraftMode.None,
          currentTeam: firstTeam,
          availableHeroes: [],
          assignedHeroes: [],
          selectedHeroes: [],
          bannedHeroes: [],
          currentStep: 0,
          pickBanSequence: [],
          isComplete: false
        };
    }
  };

  // NEW: Handle reset draft
  const handleResetDraft = () => {
    // Ask for confirmation before resetting
    playSound('buttonClick');
    
    // Create a fresh initial state with the same draft mode
    const freshState = createInitialStateForDraftMode(draftingState.mode);
    
    // Reset drafting state and history
    setDraftingState(freshState);
    setDraftHistory([]);
  };

  // NEW: Handle back to draft selection
  const handleBackToDraftSelection = () => {
    // Return to draft mode selection without flipping the coin
    playSound('buttonClick');
    
    setIsDraftingMode(false);
    setShowDraftModeSelection(true);
    // Clear history
    setDraftHistory([]);
  };

  // Finish drafting and start the game
  const finishDrafting = () => {
    // Apply selected heroes to players
    const updatedPlayers = localPlayers.map(player => {
      const selection = draftingState.selectedHeroes.find(s => s.playerId === player.id);
      if (selection) {
        return {
          ...player,
          hero: selection.hero
        };
      }
      return player;
    });
    
    playSound('phaseChange');
    
    setLocalPlayers(updatedPlayers);
    players = updatedPlayers;
    
    // Start the game without additional validation
    startGameWithPlayers(updatedPlayers);
  };

  // Start the game with the specified players
  const startGameWithPlayers = (playersToUse: Player[]) => {
    // Calculate total player count
    const playerCount = playersToUse.length;
    
    // Set initial lives and wave counters
    const laneState = getInitialLaneState(gameLength, playerCount, useDoubleLaneFor6Players);
    const teamLives = calculateTeamLives(gameLength, playerCount, useDoubleLaneFor6Players);
    
    // Create initial game state
    const initialState: GameState = {
      round: 1,
      turn: 1,
      gameLength: gameLength,
      waves: laneState.hasMultipleLanes 
        ? { 
            [Lane.Top]: laneState.top!,
            [Lane.Bottom]: laneState.bottom!
          }
        : { [Lane.Single]: laneState.single! },
      teamLives: {
        [Team.Titans]: teamLives,
        [Team.Atlanteans]: teamLives
      },
      currentPhase: 'strategy',
      activeHeroIndex: -1,
      coinSide: gameState.coinSide,
      hasMultipleLanes: laneState.hasMultipleLanes,
      completedTurns: [], // Initialize empty array for completed turn tracking
      allPlayersMoved: false // Initialize to false
    };
    
    // Set game state and mark game as started
    dispatch({ type: 'START_GAME', payload: initialState });
    setGameStarted(true);
    setStrategyTimerActive(true);
    setStrategyTimeRemaining(strategyTime);
    setIsDraftingMode(false);
    
    playSound('turnStart');
  };

  // Cancel drafting and return to setup
  const cancelDrafting = () => {
    playSound('buttonClick');
    
    setIsDraftingMode(false);
    setShowDraftModeSelection(false);
  };
  
  // Select a player for their move
  const selectPlayer = (playerIndex: number) => {
    // Only allow selecting if we're not in the middle of a move and this player hasn't gone yet
    if (gameState.activeHeroIndex === -1 && !gameState.completedTurns.includes(playerIndex)) {
      playSound('heroSelect');
      
      dispatch({ type: 'SELECT_PLAYER', playerIndex });
      setMoveTimerActive(true);
      setMoveTimeRemaining(moveTime);
    }
  };

  // Mark a player's turn as complete
  const completePlayerTurn = () => {
    if (gameState.activeHeroIndex >= 0) {
      playSound('turnComplete');
      
      setMoveTimerActive(false);
      dispatch({ type: 'MARK_PLAYER_COMPLETE', playerIndex: gameState.activeHeroIndex });
    }
  };

  // Start the next turn (after all players have moved)
  const startNextTurn = () => {
    playSound('turnStart');
    
    dispatch({ type: 'START_NEXT_TURN' });
    setStrategyTimerActive(true);
    setStrategyTimeRemaining(strategyTime);
  };

  // End the strategy phase
  const endStrategyPhase = () => {
    playSound('phaseChange');
    
    setStrategyTimerActive(false);
    dispatch({ type: 'END_STRATEGY' });
  };

  // Adjust team life counter
  const adjustTeamLife = (team: Team, delta: number) => {
    playSound('lifeChange');
    
    dispatch({ type: 'ADJUST_TEAM_LIFE', team, delta });
  };

  // Increment wave counter for a specific lane
  const incrementWave = (lane: Lane) => {
    playSound('buttonClick');
    
    dispatch({ type: 'INCREMENT_WAVE', lane });
  };
  
  // Decrement wave counter for a specific lane
  const decrementWave = (lane: Lane) => {
    playSound('buttonClick');
    
    dispatch({ type: 'DECREMENT_WAVE', lane });
  };
  
  // Adjust round counter
  const adjustRound = (delta: number) => {
    playSound('buttonClick');
    
    dispatch({ type: 'ADJUST_ROUND', delta });
  };
  
  // Adjust turn counter
  const adjustTurn = (delta: number) => {
    playSound('buttonClick');
    
    dispatch({ type: 'ADJUST_TURN', delta });
  };
  
  // Declare victory for a team
  const declareVictory = (team: Team) => {
    playSound('victory');
    
    setVictorTeam(team);
    setShowVictoryScreen(true);
  };
  
  // Reset game to setup
  const resetToSetup = () => {
    playSound('buttonClick');
    
    setShowVictoryScreen(false);
    setVictorTeam(null);
    setGameStarted(false);
    setIsDraftingMode(false);
    setShowDraftModeSelection(false);
    dispatch({ type: 'RESET_GAME' });
  };

  // Flip the tiebreaker coin
  const flipCoin = () => {
    playSound('coinFlip');
    
    dispatch({ type: 'FLIP_COIN' });
  };

  // NEW: Handle saving player round stats
  const handleSavePlayerStats = (roundStats: { [playerId: number]: PlayerRoundStats }) => {
    // Update the players with new stats
    const updatedPlayers = localPlayers.map(player => {
      const playerRoundStats = roundStats[player.id];
      
      if (playerRoundStats) {
        // Calculate updated totals
        const updatedStats: PlayerStats = {
          totalGoldEarned: (player.stats?.totalGoldEarned || 0) + playerRoundStats.goldCollected,
          totalKills: (player.stats?.totalKills || 0) + playerRoundStats.kills,
          totalAssists: (player.stats?.totalAssists || 0) + playerRoundStats.assists,
          totalDeaths: (player.stats?.totalDeaths || 0) + playerRoundStats.deaths,
          totalMinionKills: (player.stats?.totalMinionKills || 0) + playerRoundStats.minionKills
        };
        
        return {
          ...player,
          stats: updatedStats
        };
      }
      
      return player;
    });
    
    setLocalPlayers(updatedPlayers);
    players = updatedPlayers;
  };

  // Handle strategy timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (strategyTimerActive && strategyTimeRemaining > 0) {
      timer = setTimeout(() => {
        // Play warning sound at 10 seconds remaining
        if (strategyTimeRemaining === 11) {
          playSound('timerWarning');
        }
        
        // Play tick sound every second if not muted
        if (isAudioReady) {
          playSound('timerTick');
        }
        
        setStrategyTimeRemaining(strategyTimeRemaining - 1);
      }, 1000);
    } else if (strategyTimerActive && strategyTimeRemaining === 0) {
      playSound('timerComplete');
      
      setStrategyTimerActive(false);
      endStrategyPhase();
    }
    
    return () => clearTimeout(timer);
  }, [strategyTimerActive, strategyTimeRemaining, playSound, isAudioReady]);

  // Handle move timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (moveTimerActive && moveTimeRemaining > 0) {
      timer = setTimeout(() => {
        // Play warning sound at 10 seconds remaining
        if (moveTimeRemaining === 11) {
          playSound('timerWarning');
        }
        
        // Play tick sound every second if not muted
        if (isAudioReady) {
          playSound('timerTick');
        }
        
        setMoveTimeRemaining(moveTimeRemaining - 1);
      }, 1000);
    } else if (moveTimerActive && moveTimeRemaining === 0) {
      playSound('timerComplete');
      
      setMoveTimerActive(false);
      completePlayerTurn();
    }
    
    return () => clearTimeout(timer);
  }, [moveTimerActive, moveTimeRemaining, playSound, isAudioReady]);

  // Utility function to shuffle an array
  const shuffleArray = <T extends unknown>(array: T[]): T[] => {
    // Create a new copy to avoid modifying the original
    const shuffled = [...array];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Use cryptographically strong random if available, fallback to Math.random
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Add some extra randomness for ensuring different results each time
    if (shuffled.length > 3) {
      const midpoint = Math.floor(shuffled.length / 2);
      const firstHalf = shuffled.slice(0, midpoint);
      const secondHalf = shuffled.slice(midpoint);
      return [...secondHalf, ...firstHalf];
    }
    
    return shuffled;
  };


  return (
    <div className="App min-h-screen bg-gradient-to-b from-blue-400 to-orange-300 text-white p-6">
      {/* Add AudioInitializer at the top level */}
      <AudioInitializer />
      
      <header className="App-header mb-8">
        <h1 className="text-3xl font-bold mb-2">Guards of Atlantis II Timer</h1>
      </header>

      {/* Coin flip animation */}
      {showCoinAnimation && (
        <CoinToss 
          result={gameState.coinSide} 
          onComplete={() => {
            setShowCoinAnimation(false);
            setShowDraftModeSelection(true);
          }} 
        />
      )}

      {!gameStarted ? (
        <div className="game-setup-container">
          {showDraftModeSelection ? (
  <DraftModeSelection 
    onSelectMode={handleSelectDraftMode}
    onCancel={() => setShowDraftModeSelection(false)}
    playerCount={localPlayers.length}
    availableDraftModes={{
      [DraftMode.AllPick]: canUseDraftMode(DraftMode.AllPick),
      [DraftMode.Single]: canUseDraftMode(DraftMode.Single),
      [DraftMode.Random]: canUseDraftMode(DraftMode.Random),
      [DraftMode.PickAndBan]: canUseDraftMode(DraftMode.PickAndBan)
    }}
    heroCount={filteredHeroes.length}
    handicapTeam={handicapTeam} // NEW: Pass handicapTeam to DraftModeSelection
  />
) : isDraftingMode ? (
  <DraftingSystem 
    players={localPlayers}
    availableHeroes={filteredHeroes}
    draftingState={draftingState}
    onHeroSelect={handleDraftHeroSelect}
    onHeroBan={handleDraftHeroBan}
    onFinishDrafting={finishDrafting}
    onCancelDrafting={cancelDrafting}
    onUndoLastAction={handleUndoLastDraftAction}
    onResetDraft={handleResetDraft}
    onBackToDraftSelection={handleBackToDraftSelection}
    canUndo={draftHistory.length > 0}
  />
) : (
  <GameSetup 
    strategyTime={strategyTime}
    moveTime={moveTime}
    gameLength={gameLength}
    strategyTimerEnabled={strategyTimerEnabled}
    moveTimerEnabled={moveTimerEnabled}
    onStrategyTimeChange={setStrategyTime}
    onMoveTimeChange={setMoveTime}
    onGameLengthChange={handleGameLengthChange}
    onStrategyTimerEnabledChange={setStrategyTimerEnabled}
    onMoveTimerEnabledChange={setMoveTimerEnabled}
    players={localPlayers}
    onAddPlayer={addPlayer}
    onRemovePlayer={removePlayer}
    onDraftHeroes={startDrafting}
    selectedExpansions={selectedExpansions}
    onToggleExpansion={handleToggleExpansion}
    onPlayerNameChange={handlePlayerNameChange}
    duplicateNames={findDuplicateNames()}
    canStartDrafting={canUseDraftMode(DraftMode.AllPick)}
    heroCount={filteredHeroes.length}
    maxComplexity={maxComplexity}
    onMaxComplexityChange={setMaxComplexity}
    useDoubleLaneFor6Players={useDoubleLaneFor6Players}
    onUseDoubleLaneFor6PlayersChange={setUseDoubleLaneFor6Players}
  />
)}
          
        </div>
      ) : (
        <GameTimer 
          gameState={gameState}
          players={localPlayers}
          strategyTimeRemaining={strategyTimeRemaining}
          moveTimeRemaining={moveTimeRemaining}
          strategyTimerEnabled={strategyTimerEnabled}
          moveTimerEnabled={moveTimerEnabled}
          strategyTimerActive={strategyTimerActive}
          moveTimerActive={moveTimerActive}
          onStartStrategyTimer={() => setStrategyTimerActive(true)}
          onPauseStrategyTimer={() => setStrategyTimerActive(false)}
          onEndStrategyPhase={endStrategyPhase}
          onStartMoveTimer={() => setMoveTimerActive(true)}
          onPauseMoveTimer={() => setMoveTimerActive(false)}
          onSelectPlayer={selectPlayer}
          onCompletePlayerTurn={completePlayerTurn}
          onStartNextTurn={startNextTurn}
          onAdjustTeamLife={adjustTeamLife}
          onIncrementWave={incrementWave}
          onDecrementWave={decrementWave}
          onAdjustRound={adjustRound}
          onAdjustTurn={adjustTurn}
          onDeclareVictory={declareVictory}
          onFlipCoin={flipCoin}
          onSavePlayerStats={handleSavePlayerStats}
        />
      )}

      {/* Victory Screen */}
      {showVictoryScreen && victorTeam && (
        <VictoryScreen 
          winningTeam={victorTeam} 
          onReturnToSetup={resetToSetup} 
        />
      )}

      {/* CollapsibleFeedback component */}
      <CollapsibleFeedback feedbackUrl="https://forms.gle/dsjjDSbqhTn3hATt6" />
      
      {/* Sound toggle component */}
      <SoundToggle />
    </div>
  );
}

// Main App component wrapped with SoundProvider
function App() {
  return (
    <SoundProvider>
      <AppContent />
    </SoundProvider>
  );
}

export default App;