import { useState, useEffect, useReducer, useRef } from 'react';
import './App.css';
import GameSetup from './components/GameSetup';
import GameTimer from './components/GameTimer';
import DraftingSystem from './components/DraftingSystem';
import CoinToss from './components/CoinToss';
import DraftModeSelection from './components/DraftModeSelection';
import CollapsibleFeedback from './components/common/CollapsibleFeedback';
import VictoryScreen from './components/VictoryScreen';
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
  PickBanStep
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

// Initial state for different game configurations
const getInitialLaneState = (gameLength: GameLength, playerCount: number): LaneStateResult => {
  // Default single lane
  if (playerCount <= 6) {
    return {
      single: {
        currentWave: 1,
        totalWaves: gameLength === GameLength.Quick ? 3 : 5
      },
      hasMultipleLanes: false
    };
  } 
  
  // Multiple lanes for 8-10 players
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
};

// Calculate team lives based on game length and player count
const calculateTeamLives = (gameLength: GameLength, playerCount: number): number => {
  if (gameLength === GameLength.Quick) {
    return playerCount <= 4 ? 4 : 5; // 4 or 6 players
  } else { // Long game
    if (playerCount <= 4) return 6;
    if (playerCount <= 6) return 8;
    if (playerCount <= 8) return 6;
    return 7; // 10 players
  }
};

// Generate pick/ban sequence based on player count
const generatePickBanSequence = (playerCount: number): PickBanStep[] => {
  const sequence: PickBanStep[] = [];

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
  if (playerCount >= 6) {
    sequence.push({ team: 'A', action: 'ban', round: 3 }); // tie break team bans
    sequence.push({ team: 'B', action: 'ban', round: 3 }); // other team bans
    sequence.push({ team: 'B', action: 'pick', round: 3 }); // other team picks
    sequence.push({ team: 'A', action: 'pick', round: 3 }); // tie break team picks
  }

  // Add steps for 8 players (appended to the 6-player sequence)
  if (playerCount >= 8) {
    sequence.push({ team: 'B', action: 'ban', round: 4 }); // other team bans
    sequence.push({ team: 'A', action: 'ban', round: 4 }); // tie break team bans
    sequence.push({ team: 'A', action: 'pick', round: 4 }); // tie break team picks
    sequence.push({ team: 'B', action: 'pick', round: 4 }); // other team picks
  }

  // Add steps for 10 players (appended to the 8-player sequence)
  if (playerCount >= 10) {
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

function App() {
  // Game setup state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [strategyTime, setStrategyTime] = useState<number>(90); // 90 seconds default
  const [moveTime, setMoveTime] = useState<number>(30); // 30 seconds default
  const [strategyTimerEnabled, setStrategyTimerEnabled] = useState<boolean>(true);
  const [moveTimerEnabled, setMoveTimerEnabled] = useState<boolean>(true);
  const [gameLength, setGameLength] = useState<GameLength>(GameLength.Quick);
  
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
    
    // Determine lane for 8+ player games
    let lane: Lane | undefined = undefined;
    
    // If we're adding the 7th or 8th player, assign lanes to everyone
    if (localPlayers.length === 6) {
      // We need to assign lanes to the first 6 players too
      const updatedPlayers = localPlayers.map((player, index) => ({
        ...player,
        lane: index < 3 ? Lane.Top : Lane.Bottom
      }));
      setLocalPlayers(updatedPlayers);
      lane = Lane.Top; // 7th player goes to top lane
    } else if (localPlayers.length === 7) {
      lane = Lane.Bottom; // 8th player goes to bottom lane
    } else if (localPlayers.length >= 8) {
      // For 9th and 10th players, alternate lanes
      lane = localPlayers.length % 2 === 0 ? Lane.Top : Lane.Bottom;
    }
    
    const newPlayer: Player = {
      id: localPlayers.length + 1,
      team,
      hero: null,
      lane,
      name: '' // Initialize with empty name
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
    
    // Filter out the player
    const updatedPlayers = localPlayers.filter(p => p.id !== playerId);
    
    // Reassign IDs to ensure contiguous numbering
    const reindexedPlayers = updatedPlayers.map((player, index) => ({
      ...player,
      id: index + 1
    }));
    
    // Update player state
    setLocalPlayers(reindexedPlayers);
    
    // If we've dropped below 8 players, reset lanes if needed
    if (reindexedPlayers.length < 8) {
      // If we're at 6 players or fewer, remove lane assignments
      if (reindexedPlayers.length <= 6) {
        const playersWithoutLanes = reindexedPlayers.map(player => ({
          ...player,
          lane: undefined
        }));
        setLocalPlayers(playersWithoutLanes);
      }
      
      // If we've dropped below 8 players and are in Long game mode,
      // we don't automatically switch back to Quick to avoid confusion
    }
  };

  // Game length change handler
  const handleGameLengthChange = (newLength: GameLength) => {
    // Only allow changing to Quick if we have 6 or fewer players
    if (newLength === GameLength.Quick && localPlayers.length > 6) {
      alert('Quick game is only available for 6 or fewer players');
      return;
    }
    setGameLength(newLength);
  };

  // Handle toggling expansions
  const handleToggleExpansion = (expansion: string) => {
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

  // Start the drafting process
  const startDrafting = () => {
    // Check for duplicate names
    const duplicateNames = findDuplicateNames();
    if (duplicateNames.length > 0) {
      alert(`Players must have unique names. Duplicates found: ${duplicateNames.join(', ')}`);
      return;
    }
    
    // Validate team composition
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans);
    
    // Check if both teams have the same number of players
    if (titansPlayers.length !== atlanteansPlayers.length) {
      alert('Both teams must have the same number of players');
      return;
    }
    
    // Check if each team has at least 2 players but no more than 5
    if (titansPlayers.length < 2 || titansPlayers.length > 5) {
      alert('Each team must have between 2 and 5 players');
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
    
    // Show coin animation - the CoinToss component will handle showing
    // the draft mode selection when the user clicks "Continue"
    setShowCoinAnimation(true);
  };

  // Handle draft mode selection
  const handleSelectDraftMode = (mode: DraftMode) => {
    let initialDraftingState: DraftingState;
    const totalPlayerCount = localPlayers.length;
    
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

  // Handle hero selection in draft mode
  const handleDraftHeroSelect = (hero: Hero, playerId: number) => {
    // Save current state to history for undo
    setDraftHistory(prev => [...prev, { ...draftingState }]);
    
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
    
    // Determine completion status based on selected heroes
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans);
    
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
    if (draftingState.mode === DraftMode.Single || draftingState.mode === DraftMode.AllPick) {
      // For Single draft and All Pick, always alternate teams
      newCurrentTeam = draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
    } else if (draftingState.mode === DraftMode.Random) {
      // For Random draft, check if current team has all picks and switch if necessary
      if (draftingState.currentTeam === Team.Titans && titansPicked >= titansPlayers.length) {
        newCurrentTeam = Team.Atlanteans;
      } else if (draftingState.currentTeam === Team.Atlanteans && atlanteansPicked >= atlanteansPlayers.length) {
        newCurrentTeam = Team.Titans;
      } else {
        // Otherwise alternate teams
        newCurrentTeam = draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
      }
    } else if (draftingState.mode === DraftMode.PickAndBan) {
      // For pick and ban, move to next step
      newStep = draftingState.currentStep + 1;
      
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
    if (window.confirm('Reset draft? This will clear all selections.')) {
      // Create a fresh initial state with the same draft mode
      const freshState = createInitialStateForDraftMode(draftingState.mode);
      
      // Reset drafting state and history
      setDraftingState(freshState);
      setDraftHistory([]);
    }
  };

  // NEW: Handle back to draft selection
  const handleBackToDraftSelection = () => {
    // Return to draft mode selection without flipping the coin
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
    const laneState = getInitialLaneState(gameLength, playerCount);
    const teamLives = calculateTeamLives(gameLength, playerCount);
    
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
  };

  // Cancel drafting and return to setup
  const cancelDrafting = () => {
    setIsDraftingMode(false);
    setShowDraftModeSelection(false);
  };
  
  // Select a player for their move
  const selectPlayer = (playerIndex: number) => {
    // Only allow selecting if we're not in the middle of a move and this player hasn't gone yet
    if (gameState.activeHeroIndex === -1 && !gameState.completedTurns.includes(playerIndex)) {
      dispatch({ type: 'SELECT_PLAYER', playerIndex });
      setMoveTimerActive(true);
      setMoveTimeRemaining(moveTime);
    }
  };

  // Mark a player's turn as complete
  const completePlayerTurn = () => {
    if (gameState.activeHeroIndex >= 0) {
      setMoveTimerActive(false);
      dispatch({ type: 'MARK_PLAYER_COMPLETE', playerIndex: gameState.activeHeroIndex });
    }
  };

  // Start the next turn (after all players have moved)
  const startNextTurn = () => {
    dispatch({ type: 'START_NEXT_TURN' });
    setStrategyTimerActive(true);
    setStrategyTimeRemaining(strategyTime);
  };

  // End the strategy phase
  const endStrategyPhase = () => {
    setStrategyTimerActive(false);
    dispatch({ type: 'END_STRATEGY' });
  };

  // Adjust team life counter
  const adjustTeamLife = (team: Team, delta: number) => {
    dispatch({ type: 'ADJUST_TEAM_LIFE', team, delta });
  };

  // Increment wave counter for a specific lane
  const incrementWave = (lane: Lane) => {
    dispatch({ type: 'INCREMENT_WAVE', lane });
  };
  
  // Decrement wave counter for a specific lane
  const decrementWave = (lane: Lane) => {
    dispatch({ type: 'DECREMENT_WAVE', lane });
  };
  
  // Adjust round counter
  const adjustRound = (delta: number) => {
    dispatch({ type: 'ADJUST_ROUND', delta });
  };
  
  // Adjust turn counter
  const adjustTurn = (delta: number) => {
    dispatch({ type: 'ADJUST_TURN', delta });
  };
  
  // Declare victory for a team
  const declareVictory = (team: Team) => {
    setVictorTeam(team);
    setShowVictoryScreen(true);
  };
  
  // Reset game to setup
  const resetToSetup = () => {
    setShowVictoryScreen(false);
    setVictorTeam(null);
    setGameStarted(false);
    setIsDraftingMode(false);
    setShowDraftModeSelection(false);
    dispatch({ type: 'RESET_GAME' });
  };

  // Flip the tiebreaker coin
  const flipCoin = () => {
    dispatch({ type: 'FLIP_COIN' });
  };

  // Handle strategy timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (strategyTimerActive && strategyTimeRemaining > 0) {
      timer = setTimeout(() => {
        setStrategyTimeRemaining(strategyTimeRemaining - 1);
      }, 1000);
    } else if (strategyTimerActive && strategyTimeRemaining === 0) {
      setStrategyTimerActive(false);
      endStrategyPhase();
    }
    
    return () => clearTimeout(timer);
  }, [strategyTimerActive, strategyTimeRemaining]);

  // Handle move timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (moveTimerActive && moveTimeRemaining > 0) {
      timer = setTimeout(() => {
        setMoveTimeRemaining(moveTimeRemaining - 1);
      }, 1000);
    } else if (moveTimerActive && moveTimeRemaining === 0) {
      setMoveTimerActive(false);
      completePlayerTurn();
    }
    
    return () => clearTimeout(timer);
  }, [moveTimerActive, moveTimeRemaining]);

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
onStrategyTimerEnabledChange={setStrategyTimerEnabled}
onMoveTimerEnabledChange={setMoveTimerEnabled}
              onGameLengthChange={handleGameLengthChange}
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
        />
      )}

      {/* Victory Screen */}
      {showVictoryScreen && victorTeam && (
        <VictoryScreen 
          winningTeam={victorTeam} 
          onReturnToSetup={resetToSetup} 
        />
      )}

      {/* Replace static footer with CollapsibleFeedback */}
      <CollapsibleFeedback feedbackUrl="https://forms.gle/dsjjDSbqhTn3hATt6" />
    </div>
  );
}

export default App;