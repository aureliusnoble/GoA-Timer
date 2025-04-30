// src/App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import HeroSelection from './components/HeroSelection';
import GameSetup from './components/GameSetup';
import GameTimer from './components/GameTimer';
import { Hero, GameState, Player, Team } from './types';
import { heroes } from './data/heroes';

function App() {
  // Game setup state
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [strategyTime, setStrategyTime] = useState<number>(120); // 2 minutes default
  const [moveTime, setMoveTime] = useState<number>(30); // 30 seconds default
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    round: 1,
    turn: 1,
    waveCounter: 1,
    teamLives: {
      [Team.Titans]: 5,
      [Team.Atlanteans]: 5
    },
    currentPhase: 'setup',
    activeHeroIndex: -1, // No active hero during setup
    coinSide: 'heads'
  });

  // Players and heroes
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedHeroes, setSelectedHeroes] = useState<Hero[]>([]);

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
    const newPlayer: Player = {
      id: players.length + 1,
      team,
      hero: null
    };
    setPlayers([...players, newPlayer]);
  };

  // Start the game
  const startGame = () => {
    // Make sure we have equal teams with 2-5 players each
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
    
    setGameStarted(true);
    setGameState({
      ...gameState,
      currentPhase: 'strategy',
      activeHeroIndex: -1 // No hero active during strategy phase
    });
    setStrategyTimerActive(true);
    setStrategyTimeRemaining(strategyTime);
  };

  // Start the move phase after strategy phase
  const startMovePhase = () => {
    setStrategyTimerActive(false);
    setGameState({
      ...gameState,
      currentPhase: 'move',
      activeHeroIndex: 0 // Start with the first player
    });
    setMoveTimerActive(true);
    setMoveTimeRemaining(moveTime);
  };

  // Move to the next player's turn
  const nextPlayerTurn = () => {
    setMoveTimerActive(false);
    
    // Find the next player index
    const nextIndex = (gameState.activeHeroIndex + 1) % players.length;
    
    // If we've gone through all players, increment the turn
    if (nextIndex === 0) {
      const newTurn = gameState.turn + 1;
      
      // If we've completed all 4 turns, go to next round
      if (newTurn > 4) {
        setGameState({
          ...gameState,
          round: gameState.round + 1,
          turn: 1,
          waveCounter: gameState.waveCounter + 1,
          currentPhase: 'strategy',
          activeHeroIndex: -1
        });
        setStrategyTimerActive(true);
        setStrategyTimeRemaining(strategyTime);
      } else {
        setGameState({
          ...gameState,
          turn: newTurn,
          activeHeroIndex: nextIndex
        });
        setMoveTimerActive(true);
        setMoveTimeRemaining(moveTime);
      }
    } else {
      setGameState({
        ...gameState,
        activeHeroIndex: nextIndex
      });
      setMoveTimerActive(true);
      setMoveTimeRemaining(moveTime);
    }
  };

  // Adjust team life counter
  const adjustTeamLife = (team: Team, delta: number) => {
    setGameState({
      ...gameState,
      teamLives: {
        ...gameState.teamLives,
        [team]: Math.max(0, gameState.teamLives[team] + delta)
      }
    });
  };

  // Flip the tiebreaker coin
  const flipCoin = () => {
    const newSide = Math.random() > 0.5 ? 'heads' : 'tails';
    setGameState({
      ...gameState,
      coinSide: newSide
    });
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
    <div className="App min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 text-white p-4">
      <header className="App-header mb-6">
        <h1 className="text-3xl font-bold mb-2">Guards of Atlantis II Timer</h1>
      </header>

      {!gameStarted ? (
        <div className="game-setup-container">
          <GameSetup 
            strategyTime={strategyTime}
            moveTime={moveTime}
            onStrategyTimeChange={setStrategyTime}
            onMoveTimeChange={setMoveTime}
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
          onFlipCoin={flipCoin}
        />
      )}
    </div>
  );
}

export default App;