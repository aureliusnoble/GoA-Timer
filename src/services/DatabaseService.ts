// src/services/DatabaseService.ts
import { Team, GameLength } from '../types';
import { rating, rate, ordinal } from 'openskill';
import NormalDistribution from 'normal-distribution';

// Database configuration
const DB_NAME = 'GuardsOfAtlantisStats';
const DB_VERSION = 4; // Incremented to trigger migration check

// Database tables
const TABLES = {
  PLAYERS: 'players',
  MATCHES: 'matches',
  MATCH_PLAYERS: 'matchPlayers'
};

// Initial ELO rating for new players (kept for backwards compatibility)
const INITIAL_ELO = 1200;

// TrueSkill parameters (from the provided script)
const TRUESKILL_BETA = 25/6;
const TRUESKILL_TAU = 25/300;

// Player database model - Updated to include TrueSkill fields
export interface DBPlayer {
  id: string; // Use name as ID for simplicity
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  elo: number; // Kept for backwards compatibility
  // TrueSkill fields
  mu?: number;
  sigma?: number;
  ordinal?: number;
  lastPlayed: Date;
  dateCreated: Date;
  deviceId?: string;
  level?: number;
}

// Match database model
export interface DBMatch {
  id: string;
  date: Date;
  winningTeam: Team;
  gameLength: GameLength;
  doubleLanes: boolean;
  titanPlayers: number;
  atlanteanPlayers: number;
  deviceId?: string;
}

// MatchPlayer database model
export interface DBMatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  team: Team;
  heroId: number;
  heroName: string;
  heroRoles: string[];
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
  minionKills?: number;
  level?: number;
  deviceId?: string;
}

// Export data model
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
  private playerRatings: Record<string, any> = {}; // TrueSkill rating objects

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<boolean> {
    try {
      this.db = await this.openDatabase();
      
      // Check if we need to migrate ratings to TrueSkill
      await this.checkAndMigrateRatings();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * Check if ratings need migration and migrate if necessary
   */
  private async checkAndMigrateRatings(): Promise<void> {
    try {
      const players = await this.getAllPlayers();
      
      // Check if any player has games but no TrueSkill ratings
      const needsMigration = players.some(p => 
        p.totalGames > 0 && (p.mu === undefined || p.sigma === undefined || p.ordinal === undefined)
      );
      
      if (needsMigration) {
        console.log('Migrating player ratings to TrueSkill system...');
        await this.recalculatePlayerStats();
        console.log('Migration complete!');
      }
    } catch (error) {
      console.error('Error checking rating migration:', error);
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
          playerStore.createIndex('ordinal', 'ordinal', { unique: false });
        } else {
          // Add ordinal index if upgrading
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const playerStore = transaction.objectStore(TABLES.PLAYERS);
            if (!playerStore.indexNames.contains('ordinal')) {
              playerStore.createIndex('ordinal', 'ordinal', { unique: false });
            }
          }
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
   * Get scaled display rating from TrueSkill ordinal or Elo
   * Scales TrueSkill ordinal values to a user-friendly 1000-2000+ range
   */
  getDisplayRating(player: DBPlayer): number {
    if (player.ordinal !== undefined) {
      // Scale ordinal to user-friendly range
      // Original ordinal can be negative, this scales it to ~1000-2000 range
      return Math.round((player.ordinal + 25) * 40 + 200);
    }
    // Fallback to Elo for players without TrueSkill ratings
    return player.elo;
  }
  private getDeviceId(): string {
    const storageKey = 'guards-of-atlantis-device-id';
    
    let deviceId = localStorage.getItem(storageKey);
    
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

  /**
   * Get hero statistics based on match history
   */
  async getHeroStats(): Promise<any[]> {
    try {
      const allMatchPlayers = await this.getAllMatchPlayers();
      const allMatches = await this.getAllMatches();
      const matchesMap = new Map(allMatches.map(m => [m.id, m]));
      
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
        
        if (heroId === undefined || heroId === null) continue;
        
        if (!heroMap.has(heroId)) {
          heroMap.set(heroId, {
            heroId,
            heroName: matchPlayer.heroName,
            icon: `heroes/${matchPlayer.heroName.toLowerCase()}.png`,
            roles: matchPlayer.heroRoles,
            complexity: 1,
            expansion: 'Unknown',
            totalGames: 0,
            wins: 0,
            losses: 0,
            teammates: new Map(),
            opponents: new Map()
          });
        }
        
        const heroRecord = heroMap.get(heroId)!;
        heroRecord.totalGames += 1;
        
        const match = matchesMap.get(matchPlayer.matchId);
        if (!match) continue;
        
        const won = matchPlayer.team === match.winningTeam;
        
        if (won) {
          heroRecord.wins += 1;
        } else {
          heroRecord.losses += 1;
        }
      }
      
      // Second pass: calculate synergies and counters
      for (const match of allMatches) {
        const matchHeroes = allMatchPlayers.filter(mp => mp.matchId === match.id);
        
        for (const heroMatchPlayer of matchHeroes) {
          const heroId = heroMatchPlayer.heroId;
          if (heroId === undefined || heroId === null) continue;
          
          if (!heroMap.has(heroId)) continue;
          
          const heroRecord = heroMap.get(heroId)!;
          const heroTeam = heroMatchPlayer.team;
          const heroWon = heroTeam === match.winningTeam;
          
          const teammates = matchHeroes.filter(mp => 
            mp.team === heroTeam && mp.heroId !== heroId
          );
          
          const opponents = matchHeroes.filter(mp => 
            mp.team !== heroTeam
          );
          
          for (const teammate of teammates) {
            if (teammate.heroId === undefined || teammate.heroId === null) continue;
            
            let teammateRecord = heroRecord.teammates.get(teammate.heroId);
            if (!teammateRecord) {
              teammateRecord = { wins: 0, games: 0 };
              heroRecord.teammates.set(teammate.heroId, teammateRecord);
            }
            
            teammateRecord.games += 1;
            if (heroWon) {
              teammateRecord.wins += 1;
            }
          }
          
          for (const opponent of opponents) {
            if (opponent.heroId === undefined || opponent.heroId === null) continue;
            
            let opponentRecord = heroRecord.opponents.get(opponent.heroId);
            if (!opponentRecord) {
              opponentRecord = { wins: 0, games: 0 };
              heroRecord.opponents.set(opponent.heroId, opponentRecord);
            }
            
            opponentRecord.games += 1;
            if (heroWon) {
              opponentRecord.wins += 1;
            }
          }
        }
      }
      
      // Transform map to array with calculated stats
      const heroStats = Array.from(heroMap.values()).map(hero => {
        const winRate = hero.totalGames > 0 ? (hero.wins / hero.totalGames) * 100 : 0;
        
        const bestTeammates = Array.from(hero.teammates.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([teammateId, stats]) => {
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
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 3);
        
        const bestAgainst = Array.from(hero.opponents.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([opponentId, stats]) => {
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
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 3);
        
        const worstAgainst = Array.from(hero.opponents.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([opponentId, stats]) => {
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
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => a.winRate - b.winRate)
          .slice(0, 3);
        
        return {
          ...hero,
          winRate,
          bestTeammates,
          bestAgainst,
          worstAgainst,
          teammates: undefined,
          opponents: undefined
        };
      });
      
      // Try to enrich with data from heroes.ts
      try {
        const { heroes } = await import('../data/heroes');
        
        for (const heroStat of heroStats) {
          const heroData = heroes.find(h => h.name === heroStat.heroName);
          if (heroData) {
            heroStat.complexity = heroData.complexity;
            heroStat.expansion = heroData.expansion;
          }
        }
      } catch (error) {
        console.error('Error enriching hero stats with heroes.ts data:', error);
      }
      
      return heroStats;
    } catch (error) {
      console.error('Error getting hero stats:', error);
      return [];
    }
  }

  /**
   * Get all match players from the database
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

    if (!match.id) {
      match.id = generateUUID();
    }

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
   * Delete a match and its associated player records
   */
  async deleteMatch(matchId: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      
      await this.deleteMatchAndPlayers(matchId, matchPlayers);
      
      await this.recalculatePlayerStats();
      
    } catch (error) {
      console.error('Error deleting match:', error);
      throw error;
    }
  }

  /**
   * Helper method to delete a match and its player records
   */
  private async deleteMatchAndPlayers(matchId: string, matchPlayers: DBMatchPlayer[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES, TABLES.MATCH_PLAYERS], 'readwrite');
      
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      matchPlayers.forEach(player => {
        matchPlayerStore.delete(player.id);
      });
      
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
   * Initialize TrueSkill ratings for all players
   */
  private initializeTrueSkillRatings(players: DBPlayer[]): void {
    this.playerRatings = {};
    for (const player of players) {
      if (player.mu !== undefined && player.sigma !== undefined) {
        // Use existing TrueSkill ratings
        this.playerRatings[player.id] = {
          mu: player.mu,
          sigma: player.sigma
        };
      } else {
        // Initialize with default rating
        this.playerRatings[player.id] = rating();
      }
    }
  }

  /**
   * Recalculate all player statistics based on current match history using TrueSkill
   */
  private async recalculatePlayerStats(): Promise<void> {
    try {
      console.log("Starting player statistics recalculation with TrueSkill...");
      
      // Get all players and reset their stats
      const players = await this.getAllPlayers();
      console.log(`Found ${players.length} players for recalculation`);
      
      // Initialize TrueSkill ratings for all players
      this.playerRatings = {};
      for (const player of players) {
        this.playerRatings[player.id] = rating();
      }
      
      // Reset all player stats
      const resetPlayers = players.map(player => ({
        ...player,
        totalGames: 0,
        wins: 0,
        losses: 0,
        elo: INITIAL_ELO, // Keep for backwards compatibility
        mu: undefined,
        sigma: undefined,
        ordinal: undefined
      }));
      
      // Save reset players
      for (const player of resetPlayers) {
        await this.savePlayer(player);
      }
      
      // Get all matches sorted by date
      let allMatches = await this.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      console.log(`Processing ${allMatches.length} matches in chronological order`);
      
      // Process matches chronologically
      for (const match of allMatches) {
        const matchPlayers = await this.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const atlanteanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(this.playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(this.playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          console.warn(`Skipping match ${match.id} due to empty team`);
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2]; // Titans win
        } else {
          ranks = [2, 1]; // Atlanteans win
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Store updated ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          this.playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          this.playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
        
        // Update player records
        for (const mp of matchPlayers) {
          const player = await this.getPlayer(mp.playerId);
          if (!player) continue;
          
          const wasWinner = mp.team === match.winningTeam;
          const playerRating = this.playerRatings[mp.playerId];
          
          const updatedPlayer: DBPlayer = {
            ...player,
            totalGames: player.totalGames + 1,
            wins: player.wins + (wasWinner ? 1 : 0),
            losses: player.losses + (wasWinner ? 0 : 1),
            // TrueSkill fields
            mu: playerRating.mu,
            sigma: playerRating.sigma,
            ordinal: ordinal(playerRating),
            // Convert ordinal to a user-friendly scale (similar to Elo range)
            // TrueSkill ordinal can be negative, so we scale it to 1000-2000+ range
            elo: Math.round((ordinal(playerRating) + 25) * 40 + 200),
            lastPlayed: new Date(match.date)
          };
          
          await this.savePlayer(updatedPlayer);
        }
      }
      
      console.log("Player statistics recalculation completed successfully");
    } catch (error) {
      console.error('Error recalculating player stats:', error);
      throw error;
    }
  }

  /**
   * Calculate new ELO ratings (deprecated - kept for backwards compatibility)
   * This now returns an approximation based on TrueSkill ordinal
   */
  calculateNewELO(
    playerELO: number, 
    playerTeamAvgELO: number, 
    opponentTeamAvgELO: number, 
    won: boolean,
    teamWeight: number = 0.7,
    baseKFactor: number = 32
  ): number {
    // This is deprecated - just return the current ELO
    // The actual calculation is done in recordMatch using TrueSkill
    return playerELO;
  }

  /**
   * Save a match player record
   */
  async saveMatchPlayer(matchPlayer: DBMatchPlayer): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    if (!matchPlayer.id) {
      matchPlayer.id = generateUUID();
    }

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
   * Record a completed match and update player statistics using TrueSkill
   */
  async recordMatch(
    matchData: {
      date: Date;
      winningTeam: Team;
      gameLength: GameLength;
      doubleLanes: boolean;
    },
    playerData: {
      id: string;
      team: Team;
      heroId: number;
      heroName: string;
      heroRoles: string[];
      kills?: number;
      deaths?: number;
      assists?: number;
      goldEarned?: number;
      minionKills?: number;
      level?: number;
    }[]
  ): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // Initialize ratings cache if empty
    if (Object.keys(this.playerRatings).length === 0) {
      const allPlayers = await this.getAllPlayers();
      this.initializeTrueSkillRatings(allPlayers);
    }

    // First, ensure all players exist in the database
    const playerPromises = playerData.map(async (playerInfo) => {
      const existingPlayer = await this.getPlayer(playerInfo.id);
      
      if (!existingPlayer) {
        const defaultRating = rating();
        const newPlayer: DBPlayer = {
          id: playerInfo.id,
          name: playerInfo.id,
          totalGames: 0,
          wins: 0,
          losses: 0,
          elo: INITIAL_ELO,
          mu: defaultRating.mu,
          sigma: defaultRating.sigma,
          ordinal: ordinal(defaultRating),
          lastPlayed: new Date(),
          dateCreated: new Date(),
          deviceId: this.getDeviceId(),
          level: playerInfo.level || 1
        };
        await this.savePlayer(newPlayer);
        this.playerRatings[playerInfo.id] = defaultRating;
        return newPlayer;
      } 
      
      // Initialize rating if not present
      if (!this.playerRatings[playerInfo.id]) {
        if (existingPlayer.mu !== undefined && existingPlayer.sigma !== undefined) {
          this.playerRatings[playerInfo.id] = {
            mu: existingPlayer.mu,
            sigma: existingPlayer.sigma
          };
        } else {
          this.playerRatings[playerInfo.id] = rating();
        }
      }
      
      // Update player level if provided
      if (playerInfo.level !== undefined && 
          (existingPlayer.level === undefined || playerInfo.level > existingPlayer.level)) {
        existingPlayer.level = playerInfo.level;
        await this.savePlayer(existingPlayer);
      }
      
      return existingPlayer;
    });
    
    const players = await Promise.all(playerPromises);
    
    // Group players by team and get their ratings
    const titanPlayers: string[] = [];
    const titanRatings: any[] = [];
    const atlanteanPlayers: string[] = [];
    const atlanteanRatings: any[] = [];
    
    for (let i = 0; i < playerData.length; i++) {
      if (playerData[i].team === Team.Titans) {
        titanPlayers.push(playerData[i].id);
        titanRatings.push(this.playerRatings[playerData[i].id]);
      } else {
        atlanteanPlayers.push(playerData[i].id);
        atlanteanRatings.push(this.playerRatings[playerData[i].id]);
      }
    }
    
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
    
    // Update ratings using TrueSkill
    let ranks: number[];
    if (matchData.winningTeam === Team.Titans) {
      ranks = [1, 2];
    } else {
      ranks = [2, 1];
    }
    
    const result = rate([titanRatings, atlanteanRatings], {
      rank: ranks,
      beta: TRUESKILL_BETA,
      tau: TRUESKILL_TAU
    });
    
    // Update player ratings and statistics
    const playerUpdatePromises = playerData.map(async (playerInfo, index) => {
      const player = players[index];
      const isWinner = playerInfo.team === matchData.winningTeam;
      
      // Get updated rating
      let updatedRating;
      if (playerInfo.team === Team.Titans) {
        const titanIndex = titanPlayers.indexOf(playerInfo.id);
        updatedRating = result[0][titanIndex];
      } else {
        const atlanteanIndex = atlanteanPlayers.indexOf(playerInfo.id);
        updatedRating = result[1][atlanteanIndex];
      }
      
      // Update cached rating
      this.playerRatings[playerInfo.id] = updatedRating;
      
      // Update player record
      const updatedPlayer: DBPlayer = {
        ...player,
        totalGames: player.totalGames + 1,
        wins: player.wins + (isWinner ? 1 : 0),
        losses: player.losses + (isWinner ? 0 : 1),
        mu: updatedRating.mu,
        sigma: updatedRating.sigma,
        ordinal: ordinal(updatedRating),
        // Convert ordinal to user-friendly scale
        elo: Math.round((ordinal(updatedRating) + 25) * 40 + 200),
        lastPlayed: new Date(),
        level: playerInfo.level || player.level
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
        level: playerInfo.level,
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
   * Calculate predicted win probability using TrueSkill ratings
   */
  async calculateWinProbability(team1Players: string[], team2Players: string[]): Promise<number> {
    // Ensure ratings are initialized
    if (Object.keys(this.playerRatings).length === 0) {
      // Initialize from database
      const players = await this.getAllPlayers();
      this.initializeTrueSkillRatings(players);
    }
    
    // Get ratings for both teams
    const team1Ratings: any[] = [];
    const team2Ratings: any[] = [];
    
    for (const playerId of team1Players) {
      if (this.playerRatings[playerId]) {
        team1Ratings.push(this.playerRatings[playerId]);
      } else {
        team1Ratings.push(rating()); // Default rating
      }
    }
    
    for (const playerId of team2Players) {
      if (this.playerRatings[playerId]) {
        team2Ratings.push(this.playerRatings[playerId]);
      } else {
        team2Ratings.push(rating()); // Default rating
      }
    }
    
    // Calculate team averages
    const team1Mu = team1Ratings.reduce((sum, r) => sum + r.mu, 0) / team1Ratings.length;
    const team1Sigma = Math.sqrt(team1Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0)) / team1Ratings.length;
    const team2Mu = team2Ratings.reduce((sum, r) => sum + r.mu, 0) / team2Ratings.length;
    const team2Sigma = Math.sqrt(team2Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0)) / team2Ratings.length;
    
    // Combined variance for the difference
    const combinedSigma = Math.sqrt(team1Sigma ** 2 + team2Sigma ** 2 + 2 * TRUESKILL_BETA ** 2);
    
    // Win probability using cumulative normal distribution
    const deltaMu = team1Mu - team2Mu;
    const normalDist = new NormalDistribution(0, combinedSigma);
    const winProb = normalDist.cdf(deltaMu);
    
    return Math.round(winProb * 100);
  }

  /**
   * Generate balanced teams based on skill ratings
   */
  async generateBalancedTeams(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    const allPlayers = await this.getAllPlayers();
    
    // Filter to only include the selected players
    const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
    
    if (selectedPlayers.length < 4) {
      return { team1: [], team2: [] };
    }
    
    // Initialize ratings if needed
    if (Object.keys(this.playerRatings).length === 0) {
      this.initializeTrueSkillRatings(allPlayers);
    }
    
    // Sort players by display rating (highest to lowest)
    selectedPlayers.sort((a, b) => {
      const ratingA = this.getDisplayRating(a);
      const ratingB = this.getDisplayRating(b);
      return ratingB - ratingA;
    });
    
    // Use a greedy algorithm to create balanced teams
    const team1: DBPlayer[] = [];
    const team2: DBPlayer[] = [];
    
    // Distribute players to balance total skill
    selectedPlayers.forEach(player => {
      const team1Skill = team1.reduce((sum, p) => sum + this.getDisplayRating(p), 0);
      const team2Skill = team2.reduce((sum, p) => sum + this.getDisplayRating(p), 0);
      
      if (team1Skill <= team2Skill) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });
    
    return {
      team1: team1.map(p => p.id),
      team2: team2.map(p => p.id)
    };
  }

  /**
   * Generate balanced teams based on gameplay experience (total games)
   */
  async generateBalancedTeamsByExperience(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    return this.getAllPlayers()
      .then(allPlayers => {
        const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
        
        if (selectedPlayers.length < 4) {
          return { team1: [], team2: [] };
        }
        
        selectedPlayers.sort((a, b) => b.totalGames - a.totalGames);
        
        const team1: DBPlayer[] = [];
        const team2: DBPlayer[] = [];
        
        selectedPlayers.forEach(player => {
          const team1Games = team1.reduce((sum, p) => sum + p.totalGames, 0);
          const team2Games = team2.reduce((sum, p) => sum + p.totalGames, 0);
          
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
        await this.clearAllData();
        
        for (const player of data.players) {
          await this.savePlayer(player);
        }
        
        for (const match of data.matches) {
          await this.saveMatch(match);
        }
        
        for (const matchPlayer of data.matchPlayers) {
          await this.saveMatchPlayer(matchPlayer);
        }
      } else {
        await this.mergeData(data);
      }
      
      // Recalculate TrueSkill ratings after import
      await this.recalculatePlayerStats();
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Merge imported data with existing data
   */
  async mergeData(importedData: ExportData): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const deviceId = this.getDeviceId();
      
      const existingPlayers = await this.getAllPlayers();
      const existingPlayerIds = new Set(existingPlayers.map(p => p.id));
      
      for (const importedPlayer of importedData.players) {
        if (!existingPlayerIds.has(importedPlayer.id)) {
          const newPlayer: DBPlayer = {
            id: importedPlayer.id,
            name: importedPlayer.name,
            totalGames: 0,
            wins: 0,
            losses: 0,
            elo: INITIAL_ELO,
            mu: undefined,
            sigma: undefined,
            ordinal: undefined,
            lastPlayed: new Date(),
            dateCreated: new Date(),
            deviceId: `imported_${deviceId}`,
            level: importedPlayer.level || 1
          };
          await this.savePlayer(newPlayer);
          existingPlayerIds.add(importedPlayer.id);
        }
      }
      
      const existingMatches = await this.getAllMatches();
      const existingMatchIds = new Set(existingMatches.map(m => m.id));
      
      const importedMatchPlayersMap = new Map<string, DBMatchPlayer[]>();
      for (const mp of importedData.matchPlayers) {
        if (!importedMatchPlayersMap.has(mp.matchId)) {
          importedMatchPlayersMap.set(mp.matchId, []);
        }
        importedMatchPlayersMap.get(mp.matchId)!.push(mp);
      }
      
      for (const importedMatch of importedData.matches) {
        if (existingMatchIds.has(importedMatch.id)) {
          continue;
        }
        
        if (!importedMatch.deviceId) {
          importedMatch.deviceId = `imported_${deviceId}`;
        }
        
        await this.saveMatch(importedMatch);
        
        const matchPlayers = importedMatchPlayersMap.get(importedMatch.id) || [];
        for (const matchPlayer of matchPlayers) {
          if (!matchPlayer.deviceId) {
            matchPlayer.deviceId = `imported_${deviceId}`;
          }
          
          await this.saveMatchPlayer(matchPlayer);
        }
      }
      
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
      
      // Clear cached ratings
      this.playerRatings = {};
      
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

// Export utility functions
export const getDisplayRating = (player: DBPlayer) => dbService.getDisplayRating(player);