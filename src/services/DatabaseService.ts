// src/services/DatabaseService.ts
import { Team, GameLength } from '../types';

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
  deviceId?: string; // New field to track origin device
  level?: number; // New field to track player level
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
  deviceId?: string; // New field to track origin device
}

// MatchPlayer database model (connects players to matches) - Updated to include level
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
  level?: number; // New field to track player level
  deviceId?: string; // New field to track origin device
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
   * Get or generate a unique device ID for this device
   */
  private getDeviceId(): string {
    const storageKey = 'guards-of-atlantis-device-id';
    
    // Try to get existing device ID from localStorage
    let deviceId = localStorage.getItem(storageKey);
    
    // If none exists, create one with timestamp and random component
    if (!deviceId) {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      
      deviceId = `device_${timestamp}_${randomPart}`;
      localStorage.setItem(storageKey, deviceId);
    }
    
    return deviceId;
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

    // Add device ID if missing
    if (!player.deviceId) {
      player.deviceId = this.getDeviceId();
    }

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

 // New method to add to DatabaseService class

/**
 * Get hero statistics based on match history
 * This includes win rates, most common teammates, best matchups, and counters
 */
async getHeroStats(): Promise<any[]> {
  try {
    // 1. Get all match players (heroes played in matches)
    const allMatchPlayers = await this.getAllMatchPlayers();
    
    // 2. Get all matches for context
    const allMatches = await this.getAllMatches();
    const matchesMap = new Map(allMatches.map(m => [m.id, m]));
    
    // 3. Get all heroes from match data
    const heroMap = new Map<number, {
      heroId: number;
      heroName: string;
      icon: string;
      roles: string[];
      complexity: number;
      expansion: string;
      totalGames: number;
      wins: number;
      losses: number;
      teammates: Map<number, { wins: number; games: number }>;
      opponents: Map<number, { wins: number; games: number }>;
    }>();
    
    // First pass: create the hero records
    for (const matchPlayer of allMatchPlayers) {
      const heroId = matchPlayer.heroId;
      
      // Skip if no hero is assigned
      if (heroId === undefined || heroId === null) continue;
      
      // Get or create hero stats record
      if (!heroMap.has(heroId)) {
        heroMap.set(heroId, {
          heroId,
          heroName: matchPlayer.heroName,
          icon: `heroes/${matchPlayer.heroName.toLowerCase()}.png`, // Base icon path
          roles: matchPlayer.heroRoles,
          complexity: 1, // Will be populated later from heroes.ts
          expansion: 'Unknown', // Will be populated later from heroes.ts
          totalGames: 0,
          wins: 0,
          losses: 0,
          teammates: new Map(),
          opponents: new Map()
        });
      }
      
      // Update hero record
      const heroRecord = heroMap.get(heroId)!;
      heroRecord.totalGames += 1;
      
      // Check if the match exists and get the result
      const match = matchesMap.get(matchPlayer.matchId);
      if (!match) continue;
      
      // Determine if this hero won
      const won = matchPlayer.team === match.winningTeam;
      
      // Update wins/losses
      if (won) {
        heroRecord.wins += 1;
      } else {
        heroRecord.losses += 1;
      }
    }
    
    // Second pass: calculate synergies and counters
    for (const match of allMatches) {
      // Get all heroes in this match
      const matchHeroes = allMatchPlayers.filter(mp => mp.matchId === match.id);
      
      // Process each hero in the match
      for (const heroMatchPlayer of matchHeroes) {
        const heroId = heroMatchPlayer.heroId;
        if (heroId === undefined || heroId === null) continue;
        
        // Skip if not in our heroMap
        if (!heroMap.has(heroId)) continue;
        
        const heroRecord = heroMap.get(heroId)!;
        const heroTeam = heroMatchPlayer.team;
        const heroWon = heroTeam === match.winningTeam;
        
        // Process teammates (same team)
        const teammates = matchHeroes.filter(mp => 
          mp.team === heroTeam && mp.heroId !== heroId
        );
        
        // Process opponents (opposite team)
        const opponents = matchHeroes.filter(mp => 
          mp.team !== heroTeam
        );
        
        // Update teammate data
        for (const teammate of teammates) {
          if (teammate.heroId === undefined || teammate.heroId === null) continue;
          
          // Get existing teammate record or create new one
          let teammateRecord = heroRecord.teammates.get(teammate.heroId);
          if (!teammateRecord) {
            teammateRecord = { wins: 0, games: 0 };
            heroRecord.teammates.set(teammate.heroId, teammateRecord);
          }
          
          // Update records
          teammateRecord.games += 1;
          if (heroWon) {
            teammateRecord.wins += 1;
          }
        }
        
        // Update opponent data
        for (const opponent of opponents) {
          if (opponent.heroId === undefined || opponent.heroId === null) continue;
          
          // Get existing opponent record or create new one
          let opponentRecord = heroRecord.opponents.get(opponent.heroId);
          if (!opponentRecord) {
            opponentRecord = { wins: 0, games: 0 };
            heroRecord.opponents.set(opponent.heroId, opponentRecord);
          }
          
          // Update records
          opponentRecord.games += 1;
          if (heroWon) {
            opponentRecord.wins += 1;
          }
        }
      }
    }
    
    // 4. Transform map to array with calculated stats
    const heroStats = Array.from(heroMap.values()).map(hero => {
      // Calculate win rate
      const winRate = hero.totalGames > 0 ? (hero.wins / hero.totalGames) * 100 : 0;
      
      // Calculate best teammates (highest win rate when played together)
      const bestTeammates = Array.from(hero.teammates.entries())
        .filter(([_, stats]) => stats.games >= 2) // Minimum 2 games together
        .map(([teammateId, stats]) => {
          // Find the hero record for this teammate
          const teammateHero = heroMap.get(teammateId);
          if (!teammateHero) return null;
          
          return {
            heroId: teammateId,
            heroName: teammateHero.heroName,
            icon: teammateHero.icon,
            winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
            gamesPlayed: stats.games
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) // Type guard to filter out nulls
        .sort((a, b) => b.winRate - a.winRate) // Sort by win rate
        .slice(0, 3); // Top 3
      
      // Calculate best matchups (highest win rate against)
      const bestAgainst = Array.from(hero.opponents.entries())
        .filter(([_, stats]) => stats.games >= 2) // Minimum 2 games against
        .map(([opponentId, stats]) => {
          // Find the hero record for this opponent
          const opponentHero = heroMap.get(opponentId);
          if (!opponentHero) return null;
          
          return {
            heroId: opponentId,
            heroName: opponentHero.heroName,
            icon: opponentHero.icon,
            winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
            gamesPlayed: stats.games
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) // Type guard to filter out nulls
        .sort((a, b) => b.winRate - a.winRate) // Sort by win rate
        .slice(0, 3); // Top 3
      
      // Calculate worst matchups (lowest win rate against)
      const worstAgainst = Array.from(hero.opponents.entries())
        .filter(([_, stats]) => stats.games >= 2) // Minimum 2 games against
        .map(([opponentId, stats]) => {
          // Find the hero record for this opponent
          const opponentHero = heroMap.get(opponentId);
          if (!opponentHero) return null;
          
          return {
            heroId: opponentId,
            heroName: opponentHero.heroName,
            icon: opponentHero.icon,
            winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
            gamesPlayed: stats.games
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) // Type guard to filter out nulls
        .sort((a, b) => a.winRate - b.winRate) // Sort by win rate (ascending)
        .slice(0, 3); // Bottom 3
      
      return {
        ...hero,
        winRate,
        bestTeammates,
        bestAgainst,
        worstAgainst,
        // Remove map objects before returning
        teammates: undefined,
        opponents: undefined
      };
    });
    
    // 5. Enrich with data from heroes.ts if available
    try {
      // Try to import heroes from data/heroes
      const { heroes } = await import('../data/heroes');
      
      // Update hero data with additional information
      for (const heroStat of heroStats) {
        const heroData = heroes.find(h => h.name === heroStat.heroName);
        if (heroData) {
          heroStat.complexity = heroData.complexity;
          heroStat.expansion = heroData.expansion;
          // Add any other useful properties
        }
      }
    } catch (error) {
      console.error('Error enriching hero stats with heroes.ts data:', error);
      // Continue without enrichment if heroes.ts can't be imported
    }
    
    return heroStats;
  } catch (error) {
    console.error('Error getting hero stats:', error);
    return [];
  }
}

/**
 * Get all match players from the database
 * This is a helper method for getHeroStats()
 */
private async getAllMatchPlayers(): Promise<DBMatchPlayer[]> {
  if (!this.db) await this.initialize();
  if (!this.db) return [];

  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction([TABLES.MATCH_PLAYERS], 'readonly');
    const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
    const request = matchPlayerStore.getAll();

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

    // Add device ID if missing
    if (!match.deviceId) {
      match.deviceId = this.getDeviceId();
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
   * Delete a match and its associated player records.
   * This also updates the player statistics to remove the impact of this match.
   */
  async deleteMatch(matchId: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      // 1. Get the match data
      const match = await this.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      // 2. Get all player records for this match
      const matchPlayers = await this.getMatchPlayers(matchId);
      
      // 3. Delete match players and the match itself
      await this.deleteMatchAndPlayers(matchId, matchPlayers);
      
      // 4. Recalculate player statistics
      await this.recalculatePlayerStats();
      
    } catch (error) {
      console.error('Error deleting match:', error);
      throw error;
    }
  }

  /**
   * Helper method to delete a match and its player records
   * without recalculating stats (used internally by deleteMatch)
   */
  private async deleteMatchAndPlayers(matchId: string, matchPlayers: DBMatchPlayer[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES, TABLES.MATCH_PLAYERS], 'readwrite');
      
      // Delete match player records
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      matchPlayers.forEach(player => {
        matchPlayerStore.delete(player.id);
      });
      
      // Delete the match itself
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      matchStore.delete(matchId);
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Recalculate all player statistics based on current match history
   */
  private async recalculatePlayerStats(): Promise<void> {
    try {
      // 1. Get all players and reset their stats
      const players = await this.getAllPlayers();
      
      // Reset all player stats to initial values (keep names, IDs, and created dates)
      const resetPlayers = players.map(player => ({
        ...player,
        totalGames: 0,
        wins: 0,
        losses: 0,
        elo: INITIAL_ELO,
        // Keep level as-is since it's manually set
      }));
      
      // Save reset players
      for (const player of resetPlayers) {
        await this.savePlayer(player);
      }
      
      // 2. Get all matches sorted by date (oldest first)
      let allMatches = await this.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // 3. Replay all matches to recalculate stats
      for (const match of allMatches) {
        // Get match players
        const matchPlayers = await this.getMatchPlayers(match.id);
        
        // Group players by team
        const titanPlayers: string[] = [];
        const atlanteanPlayers: string[] = [];
        
        matchPlayers.forEach(mp => {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
          } else {
            atlanteanPlayers.push(mp.playerId);
          }
        });
        
        // Get current player records
        const currentPlayers: DBPlayer[] = [];
        for (const mp of matchPlayers) {
          const player = await this.getPlayer(mp.playerId);
          if (player) {
            currentPlayers.push(player);
          }
        }
        
        // Skip if any player is missing (should not happen)
        if (currentPlayers.length !== matchPlayers.length) {
          console.warn(`Skipping match ${match.id} due to missing player records`);
          continue;
        }
        
        // Calculate team average ELOs
        const titanPlayerRecords = currentPlayers.filter(p => 
          titanPlayers.includes(p.id)
        );
        
        const atlanteanPlayerRecords = currentPlayers.filter(p => 
          atlanteanPlayers.includes(p.id)
        );
        
        const titanAvgELO = titanPlayerRecords.length > 0 
          ? titanPlayerRecords.reduce((sum, p) => sum + p.elo, 0) / titanPlayerRecords.length
          : INITIAL_ELO;
          
        const atlanteanAvgELO = atlanteanPlayerRecords.length > 0 
          ? atlanteanPlayerRecords.reduce((sum, p) => sum + p.elo, 0) / atlanteanPlayerRecords.length
          : INITIAL_ELO;
        
        // Update each player's stats
        for (const player of currentPlayers) {
          const mp = matchPlayers.find(m => m.playerId === player.id);
          if (!mp) continue;
          
          const isWinner = mp.team === match.winningTeam;
          const opponentAvgELO = mp.team === Team.Titans ? atlanteanAvgELO : titanAvgELO;
          
          // Calculate new ELO
          const newELO = this.calculateNewELO(player.elo, opponentAvgELO, isWinner);
          
          // Update player record
          const updatedPlayer: DBPlayer = {
            ...player,
            totalGames: player.totalGames + 1,
            wins: player.wins + (isWinner ? 1 : 0),
            losses: player.losses + (isWinner ? 0 : 1),
            elo: newELO,
            lastPlayed: new Date(match.date)
          };
          
          await this.savePlayer(updatedPlayer);
        }
      }
      
    } catch (error) {
      console.error('Error recalculating player stats:', error);
      throw error;
    }
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

    // Add device ID if missing
    if (!matchPlayer.deviceId) {
      matchPlayer.deviceId = this.getDeviceId();
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
      level?: number; // New field for player level
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
          dateCreated: new Date(),
          deviceId: this.getDeviceId(),
          level: playerInfo.level || 1 // Initialize with level from player data or default to 1
        };
        await this.savePlayer(newPlayer);
        return newPlayer;
      } 
      
      // Update player level if provided and greater than current level
      if (playerInfo.level !== undefined && 
          (existingPlayer.level === undefined || playerInfo.level > existingPlayer.level)) {
        existingPlayer.level = playerInfo.level;
        await this.savePlayer(existingPlayer);
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
      atlanteanPlayers: atlanteanPlayers.length,
      deviceId: this.getDeviceId()
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
        lastPlayed: new Date(),
        level: playerInfo.level || player.level // Updated to include player level
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
        minionKills: playerInfo.minionKills,
        level: playerInfo.level, // Updated to include player level
        deviceId: this.getDeviceId()
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
   * Generate balanced teams based on gameplay experience (total games)
   * Returns the player IDs split into two arrays
   */
  generateBalancedTeamsByExperience(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    return this.getAllPlayers()
      .then(allPlayers => {
        // Filter to only include the selected players
        const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
        
        // If we don't have enough players, return empty teams
        if (selectedPlayers.length < 4) {
          return { team1: [], team2: [] };
        }
        
        // Sort players by total games (highest to lowest)
        selectedPlayers.sort((a, b) => b.totalGames - a.totalGames);
        
        // Use a greedy algorithm to create balanced teams
        const team1: DBPlayer[] = [];
        const team2: DBPlayer[] = [];
        
        // Distribute players to balance total experience
        selectedPlayers.forEach(player => {
          // Calculate current team total games
          const team1Games = team1.reduce((sum, p) => sum + p.totalGames, 0);
          const team2Games = team2.reduce((sum, p) => sum + p.totalGames, 0);
          
          // Add player to the team with lower total games
          if (team1Games <= team2Games) {
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
   * Import data with an option to replace or merge
   */
  async importData(data: ExportData, mode: 'replace' | 'merge' = 'replace'): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      if (mode === 'replace') {
        // Original behavior: Clear existing data and replace
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
      } else {
        // New behavior: Merge data
        await this.mergeData(data);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  

  /**
   * Merge imported data with existing data - IMPROVED IMPLEMENTATION
   * This method focuses on only adding new matches and preserving existing ones,
   * then recalculating all statistics from match data.
   */
  async mergeData(importedData: ExportData): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // Get current device ID
      const deviceId = this.getDeviceId();
      
      // STEP 1: ENSURE PLAYERS EXIST (minimal player creation)
      const existingPlayers = await this.getAllPlayers();
      const existingPlayerIds = new Set(existingPlayers.map(p => p.id));
      
      // Only add players that don't already exist - with minimal default data
      for (const importedPlayer of importedData.players) {
        if (!existingPlayerIds.has(importedPlayer.id)) {
          // Create a new player with minimal data - stats will be calculated later
          const newPlayer: DBPlayer = {
            id: importedPlayer.id,
            name: importedPlayer.name,
            totalGames: 0, // Will be recalculated
            wins: 0, // Will be recalculated
            losses: 0, // Will be recalculated
            elo: INITIAL_ELO, // Will be recalculated
            lastPlayed: new Date(), // Will be updated during recalculation
            dateCreated: new Date(),
            deviceId: `imported_${deviceId}`,
            level: importedPlayer.level || 1 // Preserve level
          };
          await this.savePlayer(newPlayer);
          existingPlayerIds.add(importedPlayer.id);
        }
      }
      
      // STEP 2: ADD NEW MATCHES ONLY (preserving existing matches)
      // Get all existing matches
      const existingMatches = await this.getAllMatches();
      const existingMatchIds = new Set(existingMatches.map(m => m.id));
      
      // Create a map of all match players from imported data
      const importedMatchPlayersMap = new Map<string, DBMatchPlayer[]>();
      for (const mp of importedData.matchPlayers) {
        if (!importedMatchPlayersMap.has(mp.matchId)) {
          importedMatchPlayersMap.set(mp.matchId, []);
        }
        importedMatchPlayersMap.get(mp.matchId)!.push(mp);
      }
      
      // Add only new matches and their player records
      for (const importedMatch of importedData.matches) {
        // Skip matches that already exist
        if (existingMatchIds.has(importedMatch.id)) {
          continue;
        }
        
        // Add device ID if missing
        if (!importedMatch.deviceId) {
          importedMatch.deviceId = `imported_${deviceId}`;
        }
        
        // Save the new match
        await this.saveMatch(importedMatch);
        
        // Add all associated match player records
        const matchPlayers = importedMatchPlayersMap.get(importedMatch.id) || [];
        for (const matchPlayer of matchPlayers) {
          // Add device ID if missing
          if (!matchPlayer.deviceId) {
            matchPlayer.deviceId = `imported_${deviceId}`;
          }
          
          // Save the match player record
          await this.saveMatchPlayer(matchPlayer);
        }
      }
      
      // STEP 3: RECALCULATE ALL PLAYER STATISTICS
      // This recalculates all statistics based on the combined match history
      await this.recalculatePlayerStats();
      
      return true;
    } catch (error) {
      console.error('Error merging data:', error);
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