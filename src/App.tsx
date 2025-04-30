// src/App.tsx
import React, { useState, useEffect, useReducer } from 'react';
import './App.css';
import HeroSelection from './components/HeroSelection';
import GameSetup from './components/GameSetup';
import GameTimer from './components/GameTimer';
import DraftingSystem from './components/DraftingSystem';
import DraftModeSelection from './components/DraftModeSelection';
import { 
  Hero, 
  GameState, 
  Player, 
  Team, 
  GameLength, 
  Lane, 
  LaneState, 
  GamePhase,
  DraftMode,
  DraftingState,
  PickBanStep
} from './types';
import { heroes, getAllExpansions, filterHeroesByExpansions } from './data/heroes';

// Initial state for different game configurations
const getInitialLaneState = (gameLength: GameLength, playerCount: number): { 
  [key: string]: LaneState, 
  hasMultipleLanes: boolean 
} => {
  // Default single lane
  if (playerCount <= 6) {
    return {
      [Lane.Single]: {
        currentWave: 1,
        totalWaves: gameLength === GameLength.Quick ? 3 : 5
      },
      hasMultipleLanes: false
    };
  } 
  
  // Multiple lanes for 8-10 players
  return {
    [Lane.Top]: {
      currentWave: 1,
      totalWaves: 7
    },
    [Lane.Bottom]: {
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
  
  // First ban round - A then B
  sequence.push({ team: 'A', action: 'ban', round: 1 });
  sequence.push({ team: 'B', action: 'ban', round: 1 });
  
  // First pick round - A then B
  sequence.push({ team: 'A', action: 'pick', round: 1 });
  sequence.push({ team: 'B', action: 'pick', round: 1 });
  
  // Second ban round - B then A
  sequence.push({ team: 'B', action: 'ban', round: 2 });
  sequence.push({ team: 'A', action: 'ban', round: 2 });
  
  // Second pick round - B then A
  sequence.push({ team: 'B', action: 'pick', round: 2 });
  sequence.push({ team: 'A', action: 'pick', round: 2 });
  
  if (playerCount > 4) {
    // Third ban round - A then B (6+ players)
    sequence.push({ team: 'A', action: 'ban', round: 3 });
    sequence.push({ team: 'B', action: 'ban', round: 3 });
    
    // Third pick round - B then A (6+ players)
    sequence.push({ team: 'B', action: 'pick', round: 3 });
    sequence.push({ team: 'A', action: 'pick', round: 3 });
  }
  
  if (playerCount > 6) {
    // Fourth ban round - B then A (8+ players)
    sequence.push({ team: 'B', action: 'ban', round: 4 });
    sequence.push({ team: 'A', action: 'ban', round: 4 });
    
    // Fourth pick round - A then B (8+ players)
    sequence.push({ team: 'A', action: 'pick', round: 4 });
    sequence.push({ team: 'B', action: 'pick', round: 4 });
  }
  
  if (playerCount > 8) {
    // Fifth ban round - B then A (10 players)
    sequence.push({ team: 'B', action: 'ban', round: 5 });
    sequence.push({ team: 'A', action: 'ban', round: 5 });
    
    // Fifth pick round - A then B (10 players)
    sequence.push({ team: 'A', action: 'pick', round: 5 });
    sequence.push({ team: 'B', action: 'pick', round: 5 });
  }
  
  return sequence;
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
        const currentWave = state.waves[Lane.Single].currentWave;
        const totalWaves = state.waves[Lane.Single].totalWaves;
        
        return {
          ...state,
          waves: {
            ...state.waves,
            [Lane.Single]: {
              ...state.waves[Lane.Single],
              currentWave: Math.min(currentWave + 1, totalWaves)
            }
          }
        };
      } else if (state.hasMultipleLanes && (action.lane === Lane.Top || action.lane === Lane.Bottom)) {
        return {
          ...state,
          waves: {
            ...state.waves,
            [action.lane]: {
              ...state.waves[action.lane],
              currentWave: Math.min(
                state.waves[action.lane].currentWave + 1, 
                state.waves[action.lane].totalWaves
              )
            }
          }
        };
      }
      return state;
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
  const [gameLength, setGameLength] = useState<GameLength>(GameLength.Quick);
  
  // Players and heroes state
  const [localPlayers, setLocalPlayers] = useState<Player[]>([]);
  const [selectedHeroes, setSelectedHeroes] = useState<Hero[]>([]);
  
  // Expansion selection state
  const [selectedExpansions, setSelectedExpansions] = useState<string[]>(getAllExpansions());
  
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
  
  // Available heroes (filtered by expansions)
  const filteredHeroes = filterHeroesByExpansions(selectedExpansions);
  
  // Update the shared players reference
  players = localPlayers;
  
  // Initial game state
  const initialGameState: GameState = {
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
  
  // Game state with reducer
  const [gameState, dispatch] = useReducer(gameReducer, initialGameState);
  
  // Timer states
  const [strategyTimerActive, setStrategyTimerActive] = useState<boolean>(false);
  const [moveTimerActive, setMoveTimerActive] = useState<boolean>(false);
  const [strategyTimeRemaining, setStrategyTimeRemaining] = useState<number>(strategyTime);
  const [moveTimeRemaining, setMoveTimeRemaining] = useState<number>(moveTime);

  // Handle hero selection (for non-draft mode)
  const handleHeroSelect = (hero: Hero, playerIndex: number) => {
    const updatedPlayers = [...localPlayers];
    
    // If this player already has a hero, remove it
    if (updatedPlayers[playerIndex]) {
      const previousHero = updatedPlayers[playerIndex].hero;
      if (previousHero) {
        // If the same hero is passed back, we're clearing the selection (Change button)
        if (previousHero.id === hero.id) {
          setSelectedHeroes(selectedHeroes.filter(h => h.id !== previousHero.id));
          updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            hero: null
          };
          setLocalPlayers(updatedPlayers);
          return; // Exit early, we're just clearing the hero
        } else {
          // Otherwise, we're changing to a new hero, so remove the old one
          setSelectedHeroes(selectedHeroes.filter(h => h.id !== previousHero.id));
        }
      }
    }
    
    // Update player's hero
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      hero: hero
    };
    
    setLocalPlayers(updatedPlayers);
    setSelectedHeroes([...selectedHeroes, hero]);
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
  };

  // Start the drafting process
  const startDrafting = () => {
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
    
    // Show draft mode selection
    setShowDraftModeSelection(true);
  };

  // Handle draft mode selection
  const handleSelectDraftMode = (mode: DraftMode) => {
    let initialDraftingState: DraftingState;
    const totalPlayerCount = localPlayers.length;
    const availableHeroesForDraft = [...filteredHeroes];
    
    // Set current team based on the tiebreaker coin
    const firstTeam = gameState.coinSide; 
    
    switch (mode) {
      case DraftMode.Single:
        // Shuffle heroes and assign 3 to each player
        shuffleArray(availableHeroesForDraft);
        
        const assignedHeroes = localPlayers.map(player => {
          // Get 3 heroes for this player
          const heroOptions = availableHeroesForDraft.splice(0, 3);
          return {
            playerId: player.id,
            heroOptions
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
        // Shuffle heroes and select N+2 for the pool
        shuffleArray(availableHeroesForDraft);
        const randomPoolSize = Math.min(totalPlayerCount + 2, availableHeroesForDraft.length);
        const randomHeroPool = availableHeroesForDraft.slice(0, randomPoolSize);
        
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
          availableHeroes: availableHeroesForDraft,
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
    setShowDraftModeSelection(false);
    setIsDraftingMode(true);
  };

  // Handle hero selection in draft mode
  const handleDraftHeroSelect = (hero: Hero, playerId: number) => {
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
    
    // Determine next team
    let newCurrentTeam = draftingState.currentTeam;
    let newStep = draftingState.currentStep;
    let isComplete = draftingState.isComplete;
    
    // Check if we need to switch teams
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans);
    
    const titansPicked = newSelectedHeroes.filter(s => 
      localPlayers.find(p => p.id === s.playerId)?.team === Team.Titans
    ).length;
    
    const atlanteansPicked = newSelectedHeroes.filter(s => 
      localPlayers.find(p => p.id === s.playerId)?.team === Team.Atlanteans
    ).length;
    
    // If this team has picked all their heroes, switch to the other team
    if (draftingState.currentTeam === Team.Titans && titansPicked >= titansPlayers.length) {
      newCurrentTeam = Team.Atlanteans;
    } else if (draftingState.currentTeam === Team.Atlanteans && atlanteansPicked >= atlanteansPlayers.length) {
      newCurrentTeam = Team.Titans;
    } else if (draftingState.mode === DraftMode.Single) {
      // For Single draft, always switch teams after one player makes a selection
      newCurrentTeam = draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
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
    } else {
      // For other modes, just alternate teams
      newCurrentTeam = draftingState.currentTeam === Team.Titans ? Team.Atlanteans : Team.Titans;
    }
    
    // Check if drafting is complete
    if (titansPicked >= titansPlayers.length && atlanteansPicked >= atlanteansPlayers.length) {
      isComplete = true;
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
    setSelectedHeroes(draftingState.selectedHeroes.map(s => s.hero));
    
    // Start the game
    startGame();
  };

  // Cancel drafting and return to setup
  const cancelDrafting = () => {
    setIsDraftingMode(false);
    setShowDraftModeSelection(false);
  };

  // Start the game
  const startGame = () => {
    // Validate team composition
    const titansPlayers = localPlayers.filter(p => p.team === Team.Titans && p.hero);
    const atlanteansPlayers = localPlayers.filter(p => p.team === Team.Atlanteans && p.hero);
    
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
    
    // Check if all players have selected heroes
    if (titansPlayers.length + atlanteansPlayers.length !== localPlayers.length) {
      alert('All players must be assigned a hero');
      return;
    }
    
    // Check if all players have selected unique heroes
    const heroIds = localPlayers.filter(p => p.hero).map(p => p.hero!.id);
    const uniqueHeroIds = new Set(heroIds);
    if (heroIds.length !== uniqueHeroIds.size) {
      alert('Each player must select a unique hero - no duplicate heroes allowed');
      return;
    }
    
    // Check if all players have entered their names
    const playersWithoutNames = localPlayers.filter(p => !p.name.trim());
    if (playersWithoutNames.length > 0) {
      alert('All players must enter their names');
      return;
    }
    
    // Calculate total player count
    const playerCount = titansPlayers.length + atlanteansPlayers.length;
    
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
            [Lane.Top]: laneState[Lane.Top],
            [Lane.Bottom]: laneState[Lane.Bottom]
          }
        : { [Lane.Single]: laneState[Lane.Single] },
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

  // Flip the tiebreaker coin
  const flipCoin = () => {
    dispatch({ type: 'FLIP_COIN' });
  };

  // Handle strategy timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
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
    let timer: NodeJS.Timeout;
    
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
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  return (
    <div className="App min-h-screen bg-gradient-to-b from-gray-400 to-gray-600 text-white p-6">
      <header className="App-header mb-8">
        <h1 className="text-3xl font-bold mb-2">Guards of Atlantis II Timer</h1>
      </header>

      {!gameStarted ? (
        <div className="game-setup-container">
          {showDraftModeSelection ? (
            <DraftModeSelection 
              onSelectMode={handleSelectDraftMode}
              onCancel={() => setShowDraftModeSelection(false)}
              playerCount={localPlayers.length}
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
            />
          ) : (
            <>
              <GameSetup 
                strategyTime={strategyTime}
                moveTime={moveTime}
                gameLength={gameLength}
                onStrategyTimeChange={setStrategyTime}
                onMoveTimeChange={setMoveTime}
                onGameLengthChange={handleGameLengthChange}
                players={localPlayers}
                onAddPlayer={addPlayer}
                onStartGame={startGame}
                onDraftHeroes={startDrafting}
                selectedExpansions={selectedExpansions}
                onToggleExpansion={handleToggleExpansion}
                onPlayerNameChange={handlePlayerNameChange}
              />
              <HeroSelection 
                heroes={filteredHeroes}
                selectedHeroes={selectedHeroes}
                players={localPlayers}
                onHeroSelect={handleHeroSelect}
              />
            </>
          )}
        </div>
      ) : (
        <GameTimer 
          gameState={gameState}
          players={localPlayers}
          strategyTimeRemaining={strategyTimeRemaining}
          moveTimeRemaining={moveTimeRemaining}
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
          onFlipCoin={flipCoin}
        />
      )}
    </div>
  );
}

export default App;