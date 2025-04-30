// src/App.tsx
import React, { useState, useEffect, useReducer } from 'react';
import './App.css';
import HeroSelection from './components/HeroSelection';
import GameSetup from './components/GameSetup';
import GameTimer from './components/GameTimer';
import { Hero, GameState, Player, Team, GameLength, Lane, LaneState } from './types';
import { heroes } from './data/heroes';

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

// Game state reducer
type GameAction = 
  | { type: 'START_GAME', payload: GameState }
  | { type: 'START_STRATEGY' }
  | { type: 'START_MOVE' }
  | { type: 'NEXT_PLAYER', playerCount: number }
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
      
    case 'START_MOVE':
      return {
        ...state,
        currentPhase: 'move',
        activeHeroIndex: 0
      };
      
    case 'NEXT_PLAYER': {
      const nextIndex = (state.activeHeroIndex + 1) % action.playerCount;
      
      // If we've gone through all players, increment the turn
      if (nextIndex === 0) {
        const newTurn = state.turn + 1;
        
        // If we've completed all 4 turns, go to next round
        if (newTurn > 4) {
          return {
            ...state,
            round: state.round + 1,
            turn: 1,
            currentPhase: 'strategy',
            activeHeroIndex: -1
          };
        } else {
          return {
            ...state,
            turn: newTurn,
            activeHeroIndex: nextIndex
          };
        }
      } else {
        return {
          ...state,
          activeHeroIndex: nextIndex
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
        coinSide: Math.random() > 0.5 ? 'heads' : 'tails'
      };
      
    default:
      return state;
  }
};

function App() {
  // Game setup state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [strategyTime, setStrategyTime] = useState<number>(90); // 90 seconds default
  const [moveTime, setMoveTime] = useState<number>(30); // 30 seconds default
  const [gameLength, setGameLength] = useState<GameLength>(GameLength.Quick);
  
  // Players and heroes
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedHeroes, setSelectedHeroes] = useState<Hero[]>([]);
  
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
    coinSide: 'heads',
    hasMultipleLanes: false
  };
  
  // Game state with reducer
  const [gameState, dispatch] = useReducer(gameReducer, initialGameState);
  
  // Timer states
  const [strategyTimerActive, setStrategyTimerActive] = useState<boolean>(false);
  const [moveTimerActive, setMoveTimerActive] = useState<boolean>(false);
  const [strategyTimeRemaining, setStrategyTimeRemaining] = useState<number>(strategyTime);
  const [moveTimeRemaining, setMoveTimeRemaining] = useState<number>(moveTime);

  // Handle hero selection
  const handleHeroSelect = (hero: Hero, playerIndex: number) => {
    const updatedPlayers = [...players];
    
    // If this player already has a hero, remove it
    if (updatedPlayers[playerIndex]) {
      const previousHero = updatedPlayers[playerIndex].hero;
      if (previousHero) {
        setSelectedHeroes(selectedHeroes.filter(h => h.id !== previousHero.id));
      }
    }
    
    // Update player's hero
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      hero: hero
    };
    
    setPlayers(updatedPlayers);
    setSelectedHeroes([...selectedHeroes, hero]);
  };

  // Add a new player
  const addPlayer = (team: Team) => {
    // Determine lane for 8+ player games
    let lane: Lane | undefined = undefined;
    
    // If we're adding the 7th or 8th player, assign lanes to everyone
    if (players.length === 6) {
      // We need to assign lanes to the first 6 players too
      const updatedPlayers = players.map((player, index) => ({
        ...player,
        lane: index < 3 ? Lane.Top : Lane.Bottom
      }));
      setPlayers(updatedPlayers);
      lane = Lane.Top; // 7th player goes to top lane
    } else if (players.length === 7) {
      lane = Lane.Bottom; // 8th player goes to bottom lane
    } else if (players.length >= 8) {
      // For 9th and 10th players, alternate lanes
      lane = players.length % 2 === 0 ? Lane.Top : Lane.Bottom;
    }
    
    const newPlayer: Player = {
      id: players.length + 1,
      team,
      hero: null,
      lane
    };
    
    setPlayers([...players, newPlayer]);
    
    // Enforce Long game for 8+ players
    if (players.length >= 7 && gameLength === GameLength.Quick) {
      setGameLength(GameLength.Long);
    }
  };

  // Game length change handler
  const handleGameLengthChange = (newLength: GameLength) => {
    // Only allow changing to Quick if we have 6 or fewer players
    if (newLength === GameLength.Quick && players.length > 6) {
      alert('Quick game is only available for 6 or fewer players');
      return;
    }
    setGameLength(newLength);
  };

  // Start the game
  const startGame = () => {
    // Validate team composition
    const titansPlayers = players.filter(p => p.team === Team.Titans && p.hero);
    const atlanteansPlayers = players.filter(p => p.team === Team.Atlanteans && p.hero);
    
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
    
    // Check if all players have selected unique heroes
    const heroIds = players.filter(p => p.hero).map(p => p.hero!.id);
    const uniqueHeroIds = new Set(heroIds);
    if (heroIds.length !== uniqueHeroIds.size) {
      alert('Each player must select a unique hero - no duplicate heroes allowed');
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
      coinSide: 'heads',
      hasMultipleLanes: laneState.hasMultipleLanes
    };
    
    // Set game state and mark game as started
    dispatch({ type: 'START_GAME', payload: initialState });
    setGameStarted(true);
    setStrategyTimerActive(true);
    setStrategyTimeRemaining(strategyTime);
  };

  // Start the move phase after strategy phase
  const startMovePhase = () => {
    setStrategyTimerActive(false);
    dispatch({ type: 'START_MOVE' });
    setMoveTimerActive(true);
    setMoveTimeRemaining(moveTime);
  };

  // Move to the next player's turn
  const nextPlayerTurn = () => {
    setMoveTimerActive(false);
    dispatch({ type: 'NEXT_PLAYER', playerCount: players.length });
    setMoveTimerActive(true);
    setMoveTimeRemaining(moveTime);
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
      startMovePhase();
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
      nextPlayerTurn();
    }
    
    return () => clearTimeout(timer);
  }, [moveTimerActive, moveTimeRemaining]);

  return (
    <div className="App min-h-screen bg-gradient-to-b from-gray-300 to-blue-900 text-white p-6">
      <header className="App-header mb-8">
        <h1 className="text-3xl font-bold mb-2">Guards of Atlantis II Timer</h1>
      </header>

      {!gameStarted ? (
        <div className="game-setup-container">
          <GameSetup 
            strategyTime={strategyTime}
            moveTime={moveTime}
            gameLength={gameLength}
            onStrategyTimeChange={setStrategyTime}
            onMoveTimeChange={setMoveTime}
            onGameLengthChange={handleGameLengthChange}
            players={players}
            onAddPlayer={addPlayer}
            onStartGame={startGame}
          />
          <HeroSelection 
            heroes={heroes}
            selectedHeroes={selectedHeroes}
            players={players}
            onHeroSelect={handleHeroSelect}
          />
        </div>
      ) : (
        <GameTimer 
          gameState={gameState}
          players={players}
          strategyTimeRemaining={strategyTimeRemaining}
          moveTimeRemaining={moveTimeRemaining}
          strategyTimerActive={strategyTimerActive}
          moveTimerActive={moveTimerActive}
          onStartStrategyTimer={() => setStrategyTimerActive(true)}
          onPauseStrategyTimer={() => setStrategyTimerActive(false)}
          onEndStrategyPhase={startMovePhase}
          onStartMoveTimer={() => setMoveTimerActive(true)}
          onPauseMoveTimer={() => setMoveTimerActive(false)}
          onNextPlayer={nextPlayerTurn}
          onAdjustTeamLife={adjustTeamLife}
          onIncrementWave={incrementWave}
          onFlipCoin={flipCoin}
        />
      )}
    </div>
  );
}

export default App;