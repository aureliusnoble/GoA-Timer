// src/services/DatabaseService.ts
import { Team, Hero, GameLength } from '../types';

// Database configuration
const DB_NAME = 'GuardsOfAtlantisStats';
const DB_VERSION = 1;

// Database tables
const TABLES = {
  PLAYERS: 'players',
  MATCHES: 'matches',
  MATCH_PLAYERS: 'matchPlayers'
};

// Initial ELO rating for new players
const INITIAL_ELO = 1200;

// Constants for ELO calculation
const K_FACTOR = 32; // How much ELO changes per match (higher = faster changes)

// Player database model
export interface DBPlayer {
  id: string; // Use name as ID for simplicity
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  elo: number;
  lastPlayed: Date;
  dateCreated: Date;
}

// Match database model
export interface DBMatch {
  id: string; // Auto-generated UUID
  date: Date;
  winningTeam: Team;
  gameLength: GameLength;
  doubleLanes: boolean;
  titanPlayers: number; // Count of players
  atlanteanPlayers: number; // Count of players
}

// MatchPlayer database model (connects players to matches)
export interface DBMatchPlayer {
  id: string; // Auto-generated UUID
  matchId: string;
  playerId: string;
  team: Team;
  heroId: number;
  heroName: string; // For easier querying
  heroRoles: string[]; // Primary roles 
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
  minionKills?: number;
}

// Export data model (for import/export)
export interface ExportData {
  players: DBPlayer[];
  matches: DBMatch[];
  matchPlayers: DBMatchPlayer[];
  exportDate: Date;
  version: number;
}

// Helper function to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Database service for managing match statistics
 */
class DatabaseService {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<boolean> {
    try {
      this.db = await this.openDatabase();
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * Open the IndexedDB database connection
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create players table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.PLAYERS)) {
          const playerStore = db.createObjectStore(TABLES.PLAYERS, { keyPath: 'id' });
          playerStore.createIndex('name', 'name', { unique: true });
          playerStore.createIndex('elo', 'elo', { unique: false });
        }
        
        // Create matches table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.MATCHES)) {
          const matchStore = db.createObjectStore(TABLES.MATCHES, { keyPath: 'id' });
          matchStore.createIndex('date', 'date', { unique: false });
          matchStore.createIndex('winningTeam', 'winningTeam', { unique: false });
        }
        
        // Create match players table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.MATCH_PLAYERS)) {
          const matchPlayerStore = db.createObjectStore(TABLES.MATCH_PLAYERS, { keyPath: 'id' });
          matchPlayerStore.createIndex('matchId', 'matchId', { unique: false });
          matchPlayerStore.createIndex('playerId', 'playerId', { unique: false });
          matchPlayerStore.createIndex('heroId', 'heroId', { unique: false });
          matchPlayerStore.createIndex('heroName', 'heroName', { unique: false });
          matchPlayerStore.createIndex('playerMatch', ['playerId', 'matchId'], { unique: true });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Get a player by ID (name)
   */
  async getPlayer(playerId: string): Promise<DBPlayer | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.PLAYERS], 'readonly');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.get(playerId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Create or update a player
   */
  async savePlayer(player: DBPlayer): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.PLAYERS], 'readwrite');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.put(player);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<DBPlayer[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.PLAYERS], 'readonly');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all matches
   */
  async getAllMatches(): Promise<DBMatch[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES], 'readonly');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get a match by ID
   */
  async getMatch(matchId: string): Promise<DBMatch | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES], 'readonly');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.get(matchId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save a match
   */
  async saveMatch(match: DBMatch): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // If no ID, generate one
    if (!match.id) {
      match.id = generateUUID();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES], 'readwrite');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.put(match);

      request.onsuccess = () => {
        resolve(match.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a match and its associated player records
   */
  async deleteMatch(matchId: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES, TABLES.MATCH_PLAYERS], 'readwrite');
      
      // First, delete the match players
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const matchPlayersIndex = matchPlayerStore.index('matchId');
      const matchPlayersRequest = matchPlayersIndex.getAll(matchId);
      
      matchPlayersRequest.onsuccess = () => {
        // Delete each match player record
        const matchPlayers = matchPlayersRequest.result || [];
        matchPlayers.forEach(matchPlayer => {
          matchPlayerStore.delete(matchPlayer.id);
        });
        
        // Then delete the match itself
        const matchStore = transaction.objectStore(TABLES.MATCHES);
        const matchRequest = matchStore.delete(matchId);
        
        matchRequest.onsuccess = () => {
          resolve();
        };
        
        matchRequest.onerror = () => {
          reject(matchRequest.error);
        };
      };
      
      matchPlayersRequest.onerror = () => {
        reject(matchPlayersRequest.error);
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Save a match player record
   */
  async saveMatchPlayer(matchPlayer: DBMatchPlayer): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // If no ID, generate one
    if (!matchPlayer.id) {
      matchPlayer.id = generateUUID();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCH_PLAYERS], 'readwrite');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const request = matchPlayerStore.put(matchPlayer);

      request.onsuccess = () => {
        resolve(matchPlayer.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all players for a match
   */
  async getMatchPlayers(matchId: string): Promise<DBMatchPlayer[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCH_PLAYERS], 'readonly');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const index = matchPlayerStore.index('matchId');
      const request = index.getAll(matchId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all matches for a player
   */
  async getPlayerMatches(playerId: string): Promise<DBMatchPlayer[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCH_PLAYERS], 'readonly');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const index = matchPlayerStore.index('playerId');
      const request = index.getAll(playerId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Calculate new ELO ratings after a match
   * Using the standard ELO formula: R' = R + K * (S - E)
   * Where:
   * - R' is the new rating
   * - R is the old rating
   * - K is the K-factor (how much ratings can change)
   * - S is the score (1 for win, 0 for loss)
   * - E is the expected score based on rating difference
   */
  calculateNewELO(playerELO: number, opponentTeamAvgELO: number, won: boolean): number {
    // Calculate expected outcome
    const expectedOutcome = 1 / (1 + Math.pow(10, (opponentTeamAvgELO - playerELO) / 400));
    
    // Calculate actual outcome (1 for win, 0 for loss)
    const actualOutcome = won ? 1 : 0;
    
    // Calculate new ELO
    const newELO = Math.round(playerELO + K_FACTOR * (actualOutcome - expectedOutcome));
    
    return newELO;
  }

  /**
   * Record a completed match and update player statistics
   */
  async recordMatch(
    matchData: {
      date: Date;
      winningTeam: Team;
      gameLength: GameLength;
      doubleLanes: boolean;
    },
    playerData: {
      id: string; // player name
      team: Team;
      heroId: number;
      heroName: string;
      heroRoles: string[];
      kills?: number;
      deaths?: number;
      assists?: number;
      goldEarned?: number;
      minionKills?: number;
    }[]
  ): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // First, ensure all players exist in the database
    const playerPromises = playerData.map(async (playerInfo) => {
      const existingPlayer = await this.getPlayer(playerInfo.id);
      
      if (!existingPlayer) {
        // Create new player record
        const newPlayer: DBPlayer = {
          id: playerInfo.id,
          name: playerInfo.id, // Use name as ID
          totalGames: 0,
          wins: 0,
          losses: 0,
          elo: INITIAL_ELO,
          lastPlayed: new Date(),
          dateCreated: new Date()
        };
        await this.savePlayer(newPlayer);
        return newPlayer;
      }
      
      return existingPlayer;
    });
    
    const players = await Promise.all(playerPromises);
    
    // Group players by team
    const titanPlayers = players.filter((_, index) => playerData[index].team === Team.Titans);
    const atlanteanPlayers = players.filter((_, index) => playerData[index].team === Team.Atlanteans);
    
    // Calculate average ELO for each team
    const titanAvgELO = titanPlayers.reduce((sum, p) => sum + p.elo, 0) / titanPlayers.length;
    const atlanteanAvgELO = atlanteanPlayers.reduce((sum, p) => sum + p.elo, 0) / atlanteanPlayers.length;
    
    // Create the match record
    const match: DBMatch = {
      id: generateUUID(),
      date: matchData.date,
      winningTeam: matchData.winningTeam,
      gameLength: matchData.gameLength,
      doubleLanes: matchData.doubleLanes,
      titanPlayers: titanPlayers.length,
      atlanteanPlayers: atlanteanPlayers.length
    };
    
    // Save the match
    await this.saveMatch(match);
    
    // Update player statistics and create match player records
    const playerUpdatePromises = playerData.map(async (playerInfo, index) => {
      const player = players[index];
      const isWinner = playerInfo.team === matchData.winningTeam;
      
      // Calculate new ELO based on team average ELOs
      const opponentAvgELO = playerInfo.team === Team.Titans ? atlanteanAvgELO : titanAvgELO;
      const newELO = this.calculateNewELO(player.elo, opponentAvgELO, isWinner);
      
      // Update player record
      const updatedPlayer: DBPlayer = {
        ...player,
        totalGames: player.totalGames + 1,
        wins: player.wins + (isWinner ? 1 : 0),
        losses: player.losses + (isWinner ? 0 : 1),
        elo: newELO,
        lastPlayed: new Date()
      };
      
      await this.savePlayer(updatedPlayer);
      
      // Create match player record
      const matchPlayer: DBMatchPlayer = {
        id: generateUUID(),
        matchId: match.id,
        playerId: player.id,
        team: playerInfo.team,
        heroId: playerInfo.heroId,
        heroName: playerInfo.heroName,
        heroRoles: playerInfo.heroRoles,
        kills: playerInfo.kills,
        deaths: playerInfo.deaths,
        assists: playerInfo.assists,
        goldEarned: playerInfo.goldEarned,
        minionKills: playerInfo.minionKills
      };
      
      await this.saveMatchPlayer(matchPlayer);
    });
    
    await Promise.all(playerUpdatePromises);
    
    return match.id;
  }

  /**
   * Get player statistics including favorite heroes and roles
   */
  async getPlayerStats(playerId: string): Promise<{
    player: DBPlayer | null;
    favoriteHeroes: { heroId: number, heroName: string, count: number }[];
    favoriteRoles: { role: string, count: number }[];
    matchesPlayed: DBMatchPlayer[];
  }> {
    const player = await this.getPlayer(playerId);
    if (!player) return { player: null, favoriteHeroes: [], favoriteRoles: [], matchesPlayed: [] };
    
    const matchesPlayed = await this.getPlayerMatches(playerId);
    
    // Calculate favorite heroes
    const heroesMap = new Map<number, { heroId: number, heroName: string, count: number }>();
    
    matchesPlayed.forEach(match => {
      const existingHero = heroesMap.get(match.heroId);
      
      if (existingHero) {
        existingHero.count += 1;
      } else {
        heroesMap.set(match.heroId, {
          heroId: match.heroId,
          heroName: match.heroName,
          count: 1
        });
      }
    });
    
    const favoriteHeroes = Array.from(heroesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    // Calculate favorite roles
    const rolesMap = new Map<string, { role: string, count: number }>();
    
    matchesPlayed.forEach(match => {
      match.heroRoles.forEach(role => {
        const existingRole = rolesMap.get(role);
        
        if (existingRole) {
          existingRole.count += 1;
        } else {
          rolesMap.set(role, {
            role,
            count: 1
          });
        }
      });
    });
    
    const favoriteRoles = Array.from(rolesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    return {
      player,
      favoriteHeroes,
      favoriteRoles,
      matchesPlayed
    };
  }

  /**
   * Calculate predicted win probability for a given team composition
   * Returns the probability as a percentage (0-100)
   */
  calculateWinProbability(team1ELO: number, team2ELO: number): number {
    // Use the ELO formula to calculate probability
    const probability = 1 / (1 + Math.pow(10, (team2ELO - team1ELO) / 400));
    
    // Convert to percentage
    return Math.round(probability * 100);
  }

  /**
   * Generate balanced teams based on ELO ratings
   * Returns the player IDs split into two arrays
   */
  generateBalancedTeams(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    return this.getAllPlayers()
      .then(allPlayers => {
        // Filter to only include the selected players
        const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
        
        // If we don't have enough players, return empty teams
        if (selectedPlayers.length < 4) {
          return { team1: [], team2: [] };
        }
        
        // Sort players by ELO (highest to lowest)
        selectedPlayers.sort((a, b) => b.elo - a.elo);
        
        // Use a greedy algorithm to create balanced teams
        const team1: DBPlayer[] = [];
        const team2: DBPlayer[] = [];
        
        // Distribute players to balance total ELO
        selectedPlayers.forEach(player => {
          // Calculate current team ELOs
          const team1ELO = team1.reduce((sum, p) => sum + p.elo, 0);
          const team2ELO = team2.reduce((sum, p) => sum + p.elo, 0);
          
          // Add player to the team with lower ELO
          if (team1ELO <= team2ELO) {
            team1.push(player);
          } else {
            team2.push(player);
          }
        });
        
        return {
          team1: team1.map(p => p.id),
          team2: team2.map(p => p.id)
        };
      });
  }

  /**
   * Export all database data
   */
  async exportData(): Promise<ExportData> {
    const players = await this.getAllPlayers();
    const matches = await this.getAllMatches();
    
    // Get all match players
    const matchPlayers: DBMatchPlayer[] = [];
    for (const match of matches) {
      const matchPlayersList = await this.getMatchPlayers(match.id);
      matchPlayers.push(...matchPlayersList);
    }
    
    return {
      players,
      matches,
      matchPlayers,
      exportDate: new Date(),
      version: DB_VERSION
    };
  }

  /**
   * Import data (overwrites existing data)
   */
  async importData(data: ExportData): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // Clear existing data
      await this.clearAllData();
      
      // Import players
      for (const player of data.players) {
        await this.savePlayer(player);
      }
      
      // Import matches
      for (const match of data.matches) {
        await this.saveMatch(match);
      }
      
      // Import match players
      for (const matchPlayer of data.matchPlayers) {
        await this.saveMatchPlayer(matchPlayer);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const transaction = this.db.transaction(
        [TABLES.PLAYERS, TABLES.MATCHES, TABLES.MATCH_PLAYERS],
        'readwrite'
      );
      
      transaction.objectStore(TABLES.PLAYERS).clear();
      transaction.objectStore(TABLES.MATCHES).clear();
      transaction.objectStore(TABLES.MATCH_PLAYERS).clear();
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }

  /**
   * Check if the database has any match data
   */
  async hasMatchData(): Promise<boolean> {
    const matches = await this.getAllMatches();
    return matches.length > 0;
  }
}

// Export a singleton instance
export const dbService = new DatabaseService();
export default dbService;