// src/services/DatabaseService.ts
import { Team, GameLength } from '../types';
import { rating, rate, ordinal } from 'openskill';
import NormalDistribution from 'normal-distribution';
import { CloudSyncService } from './supabase/CloudSyncService';

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
   * @param minGamesForRelationships - Minimum games required to show relationship stats (default: 1)
   * @param startDate - Optional start date for filtering matches (inclusive)
   * @param endDate - Optional end date for filtering matches (inclusive)
   */
  async getHeroStats(
    minGamesForRelationships: number = 1,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const allMatchPlayersRaw = await this.getAllMatchPlayers();
      let allMatches = await this.getAllMatches();

      // Filter matches by date range if specified
      if (startDate || endDate) {
        allMatches = allMatches.filter(match => {
          const matchDate = new Date(match.date);
          if (startDate && matchDate < startDate) return false;
          if (endDate && matchDate > endDate) return false;
          return true;
        });
      }

      // Create a set of valid match IDs for filtering match players
      const validMatchIds = new Set(allMatches.map(m => m.id));

      // Filter match players to only include those from valid matches
      const allMatchPlayers = allMatchPlayersRaw.filter(mp => validMatchIds.has(mp.matchId));

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
          .filter(([_, stats]) => stats.games >= minGamesForRelationships)
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
          .filter(([_, stats]) => stats.games >= minGamesForRelationships)
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
          .filter(([_, stats]) => stats.games >= minGamesForRelationships)
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
   * Get hero win rate over time for charting
   * Returns cumulative win rate at each date where matches occurred
   * @param heroIds - Optional array of hero IDs to filter (if empty/undefined, return all)
   * @param minGames - Minimum games before a hero appears (default: 3)
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   */
  async getHeroWinRateOverTime(
    heroIds?: number[],
    minGames: number = 3,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    heroes: Array<{
      heroId: number;
      heroName: string;
      icon: string;
      totalGames: number;
      currentWinRate: number;
      dataPoints: Array<{
        date: string;
        gamesPlayedTotal: number;
        winsTotal: number;
        winRate: number;
        gamesPlayedOnDate: number;
      }>;
    }>;
    dateRange: { firstMatch: string; lastMatch: string } | null;
  }> {
    try {
      const allMatchPlayersRaw = await this.getAllMatchPlayers();
      let allMatches = await this.getAllMatches();

      // Sort matches by date chronologically
      allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Filter matches by date range if specified
      if (startDate || endDate) {
        allMatches = allMatches.filter(match => {
          const matchDate = new Date(match.date);
          if (startDate && matchDate < startDate) return false;
          if (endDate && matchDate > endDate) return false;
          return true;
        });
      }

      if (allMatches.length === 0) {
        return { heroes: [], dateRange: null };
      }

      // Create a set of valid match IDs for filtering
      const validMatchIds = new Set(allMatches.map(m => m.id));
      const allMatchPlayers = allMatchPlayersRaw.filter(mp => validMatchIds.has(mp.matchId));
      const matchesMap = new Map(allMatches.map(m => [m.id, m]));

      // Build hero tracking data structure
      // Key: heroId, Value: { heroName, icon, matches: [{date, won}] }
      const heroTracking = new Map<number, {
        heroName: string;
        icon: string;
        matches: Array<{ date: string; won: boolean }>;
      }>();

      // Process each match player to build match history per hero
      for (const matchPlayer of allMatchPlayers) {
        const heroId = matchPlayer.heroId;
        if (heroId === undefined || heroId === null) continue;

        // Skip if filtering by heroIds and this hero is not in the list
        if (heroIds && heroIds.length > 0 && !heroIds.includes(heroId)) continue;

        const match = matchesMap.get(matchPlayer.matchId);
        if (!match) continue;

        if (!heroTracking.has(heroId)) {
          heroTracking.set(heroId, {
            heroName: matchPlayer.heroName,
            icon: `heroes/${matchPlayer.heroName.toLowerCase().replace(/\s+/g, '')}.png`,
            matches: []
          });
        }

        const heroData = heroTracking.get(heroId)!;
        const matchDate = new Date(match.date).toISOString().split('T')[0]; // YYYY-MM-DD
        const won = matchPlayer.team === match.winningTeam;

        heroData.matches.push({ date: matchDate, won });
      }

      // Now convert to time series data with cumulative stats
      const heroResults: Array<{
        heroId: number;
        heroName: string;
        icon: string;
        totalGames: number;
        currentWinRate: number;
        dataPoints: Array<{
          date: string;
          gamesPlayedTotal: number;
          winsTotal: number;
          winRate: number;
          gamesPlayedOnDate: number;
        }>;
      }> = [];

      for (const [heroId, heroData] of heroTracking.entries()) {
        // Sort matches by date
        heroData.matches.sort((a, b) => a.date.localeCompare(b.date));

        // Group by date and calculate cumulative stats
        const dateGroups = new Map<string, { wins: number; games: number }>();
        for (const match of heroData.matches) {
          if (!dateGroups.has(match.date)) {
            dateGroups.set(match.date, { wins: 0, games: 0 });
          }
          const group = dateGroups.get(match.date)!;
          group.games++;
          if (match.won) group.wins++;
        }

        // Build cumulative data points
        const dataPoints: Array<{
          date: string;
          gamesPlayedTotal: number;
          winsTotal: number;
          winRate: number;
          gamesPlayedOnDate: number;
        }> = [];

        let cumulativeGames = 0;
        let cumulativeWins = 0;

        // Sort dates and process chronologically
        const sortedDates = Array.from(dateGroups.keys()).sort();
        for (const date of sortedDates) {
          const dayStats = dateGroups.get(date)!;
          cumulativeGames += dayStats.games;
          cumulativeWins += dayStats.wins;

          dataPoints.push({
            date,
            gamesPlayedTotal: cumulativeGames,
            winsTotal: cumulativeWins,
            winRate: cumulativeGames > 0 ? (cumulativeWins / cumulativeGames) * 100 : 0,
            gamesPlayedOnDate: dayStats.games
          });
        }

        // Filter data points to only show from minGames onwards
        const filteredDataPoints = dataPoints.filter(dp => dp.gamesPlayedTotal >= minGames);

        // Only include heroes that have data points meeting the threshold
        if (filteredDataPoints.length > 0) {
          heroResults.push({
            heroId,
            heroName: heroData.heroName,
            icon: heroData.icon,
            totalGames: cumulativeGames,
            currentWinRate: cumulativeGames > 0 ? (cumulativeWins / cumulativeGames) * 100 : 0,
            dataPoints: filteredDataPoints
          });
        }
      }

      // Sort heroes by total games descending
      heroResults.sort((a, b) => b.totalGames - a.totalGames);

      // Try to enrich with icon data from heroes.ts
      try {
        const { heroes } = await import('../data/heroes');
        for (const heroResult of heroResults) {
          const heroData = heroes.find(h => h.name === heroResult.heroName);
          if (heroData) {
            heroResult.icon = heroData.icon;
          }
        }
      } catch (error) {
        console.error('Error enriching hero icons:', error);
      }

      // Calculate overall date range
      const allDates = heroResults.flatMap(h => h.dataPoints.map(dp => dp.date));
      const dateRange = allDates.length > 0
        ? {
            firstMatch: allDates.reduce((min, d) => d < min ? d : min),
            lastMatch: allDates.reduce((max, d) => d > max ? d : max)
          }
        : null;

      return { heroes: heroResults, dateRange };
    } catch (error) {
      console.error('Error getting hero win rate over time:', error);
      return { heroes: [], dateRange: null };
    }
  }

  /**
   * Get all player statistics filtered by date range
   * @param startDate - Optional start date for filtering matches (inclusive)
   * @param endDate - Optional end date for filtering matches (inclusive)
   * @param recalculateTrueSkill - If true, recalculate TrueSkill using only matches in the period
   */
  async getFilteredPlayerStats(
    startDate?: Date,
    endDate?: Date,
    recalculateTrueSkill: boolean = false
  ): Promise<{
    players: Array<{
      id: string;
      name: string;
      gamesPlayed: number;
      wins: number;
      losses: number;
      winRate: number;
      kills: number;
      deaths: number;
      assists: number;
      kdRatio: number;
      totalGold: number;
      totalMinionKills: number;
      averageGold: number;
      averageMinionKills: number;
      hasCombatStats: boolean;
      favoriteHeroes: { heroId: number; heroName: string; count: number }[];
      favoriteRoles: { role: string; count: number }[];
      displayRating: number;
      lastPlayed: Date | null;
    }>;
    dateRange: { start: Date; end: Date } | null;
  }> {
    try {
      const allPlayers = await this.getAllPlayers();
      let allMatches = await this.getAllMatches();
      const allMatchPlayersRaw = await this.getAllMatchPlayers();

      // Determine date range
      let dateRange: { start: Date; end: Date } | null = null;
      if (startDate || endDate) {
        dateRange = {
          start: startDate || new Date(0),
          end: endDate || new Date()
        };
      }

      // Filter matches by date range if specified
      if (startDate || endDate) {
        allMatches = allMatches.filter(match => {
          const matchDate = new Date(match.date);
          if (startDate && matchDate < startDate) return false;
          if (endDate && matchDate > endDate) return false;
          return true;
        });
      }

      // Create a set of valid match IDs
      const validMatchIds = new Set(allMatches.map(m => m.id));

      // Filter match players to only include those from valid matches
      const filteredMatchPlayers = allMatchPlayersRaw.filter(mp => validMatchIds.has(mp.matchId));

      // Create matches map for quick lookup
      const matchesMap = new Map(allMatches.map(m => [m.id, m]));

      // Get current TrueSkill ratings (cumulative)
      let trueSkillRatings: Record<string, number> = {};
      if (!recalculateTrueSkill) {
        trueSkillRatings = await this.getCurrentTrueSkillRatings();
      } else {
        // Recalculate TrueSkill using only filtered matches
        trueSkillRatings = await this.calculateTrueSkillForMatches(allMatches);
      }

      // Calculate stats for each player
      const playerStatsArray: Array<{
        id: string;
        name: string;
        gamesPlayed: number;
        wins: number;
        losses: number;
        winRate: number;
        kills: number;
        deaths: number;
        assists: number;
        kdRatio: number;
        totalGold: number;
        totalMinionKills: number;
        averageGold: number;
        averageMinionKills: number;
        hasCombatStats: boolean;
        favoriteHeroes: { heroId: number; heroName: string; count: number }[];
        favoriteRoles: { role: string; count: number }[];
        displayRating: number;
        lastPlayed: Date | null;
      }> = [];

      for (const player of allPlayers) {
        // Get this player's match records from filtered data
        const playerMatches = filteredMatchPlayers.filter(mp => mp.playerId === player.id);

        // Skip players with no games in the period
        if (playerMatches.length === 0) continue;

        // Calculate wins and losses
        let wins = 0;
        let losses = 0;
        let kills = 0;
        let deaths = 0;
        let assists = 0;
        let totalGold = 0;
        let totalMinionKills = 0;
        let hasCombatStats = false;
        let lastPlayedDate: Date | null = null;

        const heroCount = new Map<number, { heroId: number; heroName: string; count: number }>();
        const roleCount = new Map<string, number>();

        for (const mp of playerMatches) {
          const match = matchesMap.get(mp.matchId);
          if (!match) continue;

          // Track last played
          const matchDate = new Date(match.date);
          if (!lastPlayedDate || matchDate > lastPlayedDate) {
            lastPlayedDate = matchDate;
          }

          // Win/Loss
          if (mp.team === match.winningTeam) {
            wins++;
          } else {
            losses++;
          }

          // Combat stats
          if (mp.kills !== undefined) {
            kills += mp.kills;
            hasCombatStats = true;
          }
          if (mp.deaths !== undefined) {
            deaths += mp.deaths;
          }
          if (mp.assists !== undefined) {
            assists += mp.assists;
          }
          if (mp.goldEarned !== undefined) {
            totalGold += mp.goldEarned;
          }
          if (mp.minionKills !== undefined) {
            totalMinionKills += mp.minionKills;
          }

          // Favorite heroes
          if (mp.heroId !== undefined) {
            const existing = heroCount.get(mp.heroId);
            if (existing) {
              existing.count++;
            } else {
              heroCount.set(mp.heroId, { heroId: mp.heroId, heroName: mp.heroName, count: 1 });
            }
          }

          // Favorite roles
          if (mp.heroRoles) {
            for (const role of mp.heroRoles) {
              roleCount.set(role, (roleCount.get(role) || 0) + 1);
            }
          }
        }

        const gamesPlayed = playerMatches.length;
        const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
        const kdRatio = deaths > 0 ? kills / deaths : kills;

        // Sort favorite heroes and roles
        const favoriteHeroes = Array.from(heroCount.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        const favoriteRoles = Array.from(roleCount.entries())
          .map(([role, count]) => ({ role, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        playerStatsArray.push({
          id: player.id,
          name: player.name,
          gamesPlayed,
          wins,
          losses,
          winRate,
          kills,
          deaths,
          assists,
          kdRatio,
          totalGold,
          totalMinionKills,
          averageGold: gamesPlayed > 0 ? totalGold / gamesPlayed : 0,
          averageMinionKills: gamesPlayed > 0 ? totalMinionKills / gamesPlayed : 0,
          hasCombatStats,
          favoriteHeroes,
          favoriteRoles,
          displayRating: trueSkillRatings[player.id] || 1200,
          lastPlayed: lastPlayedDate
        });
      }

      return { players: playerStatsArray, dateRange };
    } catch (error) {
      console.error('Error getting filtered player stats:', error);
      return { players: [], dateRange: null };
    }
  }

  /**
   * Calculate TrueSkill ratings using only the provided matches
   * @param matches - Array of matches to use for calculation
   */
  private async calculateTrueSkillForMatches(matches: DBMatch[]): Promise<Record<string, number>> {
    try {
      // Sort matches by date
      const sortedMatches = [...matches].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // Initialize all players with default rating
      const players = await this.getAllPlayers();
      const playerRatings: { [playerId: string]: any } = {};

      for (const player of players) {
        playerRatings[player.id] = rating();
      }

      // Process each match
      for (const match of sortedMatches) {
        const matchPlayers = await this.getMatchPlayers(match.id);

        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: any[] = [];

        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(playerRatings[mp.playerId] || rating());
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(playerRatings[mp.playerId] || rating());
          }
        }

        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          continue;
        }

        // Determine ranks
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2];
        } else {
          ranks = [2, 1];
        }

        // Update ratings
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });

        // Store updated ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
      }

      // Convert to display ratings
      const displayRatings: Record<string, number> = {};
      for (const playerId in playerRatings) {
        const playerRating = playerRatings[playerId];
        const ordinalValue = ordinal(playerRating);
        displayRatings[playerId] = Math.round((ordinalValue + 25) * 40 + 200);
      }

      return displayRatings;
    } catch (error) {
      console.error('Error calculating TrueSkill for matches:', error);
      return {};
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
   * Delete a match and its associated player records.
   * Also triggers cloud deletion to sync tombstone across devices.
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

      // Trigger cloud deletion (non-blocking) to create tombstone
      CloudSyncService.deleteMatchFromCloud(matchId).catch(error => {
        console.error('[DatabaseService] Cloud deletion failed:', error);
      });

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
   * Delete a match and its player records without triggering cloud deletion.
   * Used when applying tombstones from cloud sync.
   */
  async deleteMatchAndPlayersOnly(matchId: string): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        return false; // Match doesn't exist locally
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      await this.deleteMatchAndPlayers(matchId, matchPlayers);
      return true;
    } catch (error) {
      console.error('Error deleting match locally:', error);
      return false;
    }
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
  public async recalculatePlayerStats(): Promise<void> {
    try {
      console.log("Starting player statistics recalculation with TrueSkill...");
      
      // Get all players and keep a map of their existing stats
      const players = await this.getAllPlayers();
      console.log(`Found ${players.length} players for recalculation`);
      
      // Create a map to track player stats properly
      const playerStatsMap = new Map<string, {
        totalGames: number;
        wins: number;
        losses: number;
      }>();
      
      // Initialize stats map with zeros
      for (const player of players) {
        playerStatsMap.set(player.id, {
          totalGames: 0,
          wins: 0,
          losses: 0
        });
      }
      
      // Initialize TrueSkill ratings for all players
      this.playerRatings = {};
      for (const player of players) {
        this.playerRatings[player.id] = rating();
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
        
        // Update player match statistics
        for (const mp of matchPlayers) {
          const stats = playerStatsMap.get(mp.playerId);
          if (!stats) continue;
          
          stats.totalGames += 1;
          if (mp.team === match.winningTeam) {
            stats.wins += 1;
          } else {
            stats.losses += 1;
          }
        }
      }
      
      // Update all player records with their final stats
      for (const player of players) {
        const stats = playerStatsMap.get(player.id)!;
        const playerRating = this.playerRatings[player.id];
        
        const updatedPlayer: DBPlayer = {
          ...player,
          totalGames: stats.totalGames,
          wins: stats.wins,
          losses: stats.losses,
          // TrueSkill fields
          mu: playerRating.mu,
          sigma: playerRating.sigma,
          ordinal: ordinal(playerRating),
          // Convert ordinal to a user-friendly scale (similar to Elo range)
          elo: Math.round((ordinal(playerRating) + 25) * 40 + 200),
          // Keep existing lastPlayed date if no games played
          lastPlayed: stats.totalGames > 0 ? new Date() : player.lastPlayed
        };
        
        await this.savePlayer(updatedPlayer);
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
    _playerELO: number, 
    _playerTeamAvgELO: number, 
    _opponentTeamAvgELO: number, 
    _won: boolean,
    _teamWeight: number = 0.7,
    _baseKFactor: number = 32
  ): number {
    // This is deprecated - just return the current ELO
    // The actual calculation is done in recordMatch using TrueSkill
    return _playerELO;
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

    // Trigger auto-upload to cloud if enabled
    CloudSyncService.triggerAutoUpload();

    return match.id;
  }

  /**
   * Get player statistics including favorite heroes and roles
   */
  async getPlayerStats(playerId: string): Promise<{
    player: DBPlayer | null;
    favoriteHeroes: { heroId: number, heroName: string, count: number }[];
    allHeroesPlayed: { heroId: number, heroName: string, count: number }[];
    favoriteRoles: { role: string, count: number }[];
    allRolesPlayed: { role: string, count: number }[];
    matchesPlayed: DBMatchPlayer[];
  }> {
    const player = await this.getPlayer(playerId);
    if (!player) return { player: null, favoriteHeroes: [], allHeroesPlayed: [], favoriteRoles: [], allRolesPlayed: [], matchesPlayed: [] };
    
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

    const allHeroesPlayed = Array.from(heroesMap.values())
      .sort((a, b) => b.count - a.count);
    
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

    const allRolesPlayed = Array.from(rolesMap.values())
      .sort((a, b) => b.count - a.count);
    
    return {
      player,
      favoriteHeroes,
      allHeroesPlayed,
      favoriteRoles,
      allRolesPlayed,
      matchesPlayed
    };
  }

  /**
   * Calculate predicted win probability using TrueSkill ratings
   * Following standard TrueSkill team game calculations
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
    
    // Calculate team skill and variance following TrueSkill conventions:
    // Team skill = sum of individual skills
    // Team variance = sum of individual variances + n * beta^2
    const team1Mu = team1Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team1Variance = team1Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0) + 
                          team1Ratings.length * TRUESKILL_BETA ** 2;
    
    const team2Mu = team2Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team2Variance = team2Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0) + 
                          team2Ratings.length * TRUESKILL_BETA ** 2;
    
    // Combined variance for the difference in team performances
    const combinedSigma = Math.sqrt(team1Variance + team2Variance);
    
    // Win probability using cumulative normal distribution
    const deltaMu = team1Mu - team2Mu;
    const normalDist = new NormalDistribution(0, combinedSigma);
    const winProb = normalDist.cdf(deltaMu);
    
    return Math.round(winProb * 100);
  }

  /**
   * Calculate predicted win probability with confidence intervals
   * Using proper TrueSkill team calculations and uncertainty propagation
   */
  async calculateWinProbabilityWithCI(team1Players: string[], team2Players: string[]): Promise<{
    team1Probability: number;
    team1Lower: number;
    team1Upper: number;
    team2Probability: number;
    team2Lower: number;
    team2Upper: number;
  }> {
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
    
    // Calculate team parameters following TrueSkill conventions
    const team1Mu = team1Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team1SkillVariance = team1Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0);
    const team1PerformanceVariance = team1SkillVariance + team1Ratings.length * TRUESKILL_BETA ** 2;
    
    const team2Mu = team2Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team2SkillVariance = team2Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0);
    const team2PerformanceVariance = team2SkillVariance + team2Ratings.length * TRUESKILL_BETA ** 2;
    
    // Delta parameters
    const deltaMu = team1Mu - team2Mu;
    const deltaPerformanceVariance = team1PerformanceVariance + team2PerformanceVariance;
    const deltaPerformanceSigma = Math.sqrt(deltaPerformanceVariance);
    
    // Point estimate of win probability
    const normalDist = new NormalDistribution(0, deltaPerformanceSigma);
    const winProb = normalDist.cdf(deltaMu);
    
    // For confidence intervals, we use only the skill uncertainty (not performance variance)
    // This represents our uncertainty about the true skill levels
    const deltaSkillVariance = team1SkillVariance + team2SkillVariance;
    const deltaSkillSigma = Math.sqrt(deltaSkillVariance);
    
    // 95% confidence interval for the skill difference
    const ciMargin = 1.96 * deltaSkillSigma;
    
    // Calculate win probabilities at the confidence bounds
    // When team skill difference is at its lower bound
    const lowerSkillDelta = deltaMu - ciMargin;
    const lowerWinProb = normalDist.cdf(lowerSkillDelta);
    
    // When team skill difference is at its upper bound
    const upperSkillDelta = deltaMu + ciMargin;
    const upperWinProb = normalDist.cdf(upperSkillDelta);
    
    return {
      team1Probability: Math.round(winProb * 100),
      team1Lower: Math.round(lowerWinProb * 100),
      team1Upper: Math.round(upperWinProb * 100),
      team2Probability: Math.round((1 - winProb) * 100),
      team2Lower: Math.round((1 - upperWinProb) * 100),
      team2Upper: Math.round((1 - lowerWinProb) * 100)
    };
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
   * Get historical ratings for all players over time
   * Returns rating snapshots after each match
   */
  /**
   * Get current TrueSkill ratings calculated fresh from all match history
   * This ensures consistent ratings across all components
   */
  async getCurrentTrueSkillRatings(): Promise<{ [playerId: string]: number }> {
    try {
      // Get all matches sorted by date
      let allMatches = await this.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Initialize player ratings
      const players = await this.getAllPlayers();
      const playerRatings: { [playerId: string]: any } = {};
      
      // Initialize all players with default rating
      for (const player of players) {
        playerRatings[player.id] = rating();
      }
      
      // Process each match chronologically to get final ratings
      for (let matchIndex = 0; matchIndex < allMatches.length; matchIndex++) {
        const match = allMatches[matchIndex];
        const matchPlayers = await this.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2];
        } else {
          ranks = [2, 1];
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Update player ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
      }
      
      // Convert to display ratings
      const currentRatings: { [playerId: string]: number } = {};
      for (const playerId in playerRatings) {
        const playerRating = playerRatings[playerId];
        const ordinalValue = ordinal(playerRating);
        currentRatings[playerId] = Math.round((ordinalValue + 25) * 40 + 200);
      }
      
      return currentRatings;
    } catch (error) {
      console.error('Error getting current TrueSkill ratings:', error);
      return {};
    }
  }

  async getHistoricalRatings(): Promise<Array<{
    date: string;
    matchNumber: number;
    ratings: { [playerId: string]: number };
    participants: string[];
  }>> {
    try {
      // Get all matches sorted by date
      let allMatches = await this.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Initialize player ratings
      const players = await this.getAllPlayers();
      const playerRatings: { [playerId: string]: any } = {};
      
      // Initialize all players with default rating
      for (const player of players) {
        playerRatings[player.id] = rating();
      }

      // Track rating history
      const ratingHistory: Array<{
        date: string;
        matchNumber: number;
        ratings: { [playerId: string]: number };
        participants: string[];
      }> = [];

      // Add initial snapshot (game 0) - default ratings before any matches
      const initialSnapshot: { [playerId: string]: number } = {};
      for (const playerId in playerRatings) {
        const playerRating = playerRatings[playerId];
        const ordinalValue = ordinal(playerRating);
        const displayRating = Math.round((ordinalValue + 25) * 40 + 200);
        initialSnapshot[playerId] = displayRating;
      }

      ratingHistory.push({
        date: allMatches.length > 0 ? allMatches[0].date.toString() : new Date().toISOString(),
        matchNumber: 0,
        ratings: initialSnapshot,
        participants: []  // No participants for initial snapshot (game 0)
      });

      // Process each match chronologically
      for (let matchIndex = 0; matchIndex < allMatches.length; matchIndex++) {
        const match = allMatches[matchIndex];
        const matchPlayers = await this.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2];
        } else {
          ranks = [2, 1];
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Update player ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
        
        // Create snapshot of current ratings
        const snapshot: { [playerId: string]: number } = {};
        for (const playerId in playerRatings) {
          const playerRating = playerRatings[playerId];
          const ordinalValue = ordinal(playerRating);
          const displayRating = Math.round((ordinalValue + 25) * 40 + 200);
          snapshot[playerId] = displayRating;
        }
        
        ratingHistory.push({
          date: match.date.toString(),
          matchNumber: matchIndex + 1,
          ratings: snapshot,
          participants: matchPlayers.map(mp => mp.playerId)
        });
      }
      
      return ratingHistory;
    } catch (error) {
      console.error('Error getting historical ratings:', error);
      return [];
    }
  }
  async hasMatchData(): Promise<boolean> {
    const matches = await this.getAllMatches();
    return matches.length > 0;
  }

  /**
   * Update a specific match player record
   */
  async updateMatchPlayer(matchPlayerId: string, updates: Partial<DBMatchPlayer>): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['matchPlayers'], 'readwrite');
    const store = transaction.objectStore('matchPlayers');
    
    const existingRecord = await store.get(matchPlayerId);
    if (existingRecord) {
      const updatedRecord = { ...existingRecord, ...updates };
      await store.put(updatedRecord);
    }
  }

  /**
   * Get players with zero games recorded
   */
  async getPlayersWithNoGames(): Promise<DBPlayer[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const allPlayers = await this.getAllPlayers();
    return allPlayers.filter(player => player.totalGames === 0);
  }

  /**
   * Delete a player by ID (only if they have no recorded matches)
   * Returns true if successfully deleted, false otherwise
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) return false;

    try {
      // First, validate that the player exists
      const player = await this.getPlayer(playerId);
      if (!player) {
        console.warn(`Player with ID ${playerId} not found`);
        return false;
      }

      // Double-check that the player has no games recorded
      if (player.totalGames !== 0) {
        console.warn(`Cannot delete player ${playerId}: has ${player.totalGames} games recorded`);
        return false;
      }

      // Also verify no match records exist (extra safety check)
      const playerMatches = await this.getPlayerMatches(playerId);
      if (playerMatches.length > 0) {
        console.warn(`Cannot delete player ${playerId}: has ${playerMatches.length} match records`);
        return false;
      }

      // Proceed with deletion
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([TABLES.PLAYERS], 'readwrite');
        const playerStore = transaction.objectStore(TABLES.PLAYERS);
        const request = playerStore.delete(playerId);

        request.onsuccess = () => {
          console.log(`Successfully deleted player ${playerId}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`Error deleting player ${playerId}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error deleting player ${playerId}:`, error);
      return false;
    }
  }

  // ========== MATCH EDITING EXTENSIONS ==========

  /**
   * Update match metadata (date, winner, game length, etc.)
   */
  async updateMatch(matchId: string, updates: Partial<DBMatch>): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCHES], 'readwrite');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      
      // Get existing match first
      const getRequest = matchStore.get(matchId);
      
      getRequest.onsuccess = () => {
        const existingMatch = getRequest.result;
        if (!existingMatch) {
          reject(new Error(`Match with ID ${matchId} not found`));
          return;
        }

        // Apply updates
        const updatedMatch = { ...existingMatch, ...updates };
        const putRequest = matchStore.put(updatedMatch);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update multiple match players atomically
   */
  async updateMatchPlayers(updates: Array<{
    id: string;
    updates: Partial<DBMatchPlayer>;
  }>): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.MATCH_PLAYERS], 'readwrite');
      const store = transaction.objectStore(TABLES.MATCH_PLAYERS);
      
      let pendingOperations = updates.length;
      let hasError = false;

      if (pendingOperations === 0) {
        resolve();
        return;
      }

      updates.forEach((update) => {
        const getRequest = store.get(update.id);
        
        getRequest.onsuccess = () => {
          if (hasError) return;
          
          const existingRecord = getRequest.result;
          if (!existingRecord) {
            hasError = true;
            reject(new Error(`Match player with ID ${update.id} not found`));
            return;
          }

          const updatedRecord = { ...existingRecord, ...update.updates };
          const putRequest = store.put(updatedRecord);
          
          putRequest.onsuccess = () => {
            pendingOperations--;
            if (pendingOperations === 0) {
              resolve();
            }
          };
          
          putRequest.onerror = () => {
            hasError = true;
            reject(putRequest.error);
          };
        };
        
        getRequest.onerror = () => {
          hasError = true;
          reject(getRequest.error);
        };
      });
    });
  }

  /**
   * Validate match edit data before saving
   */
  validateMatchEdit(matchData: DBMatch, playersData: DBMatchPlayer[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Team balance validation
    const titanPlayers = playersData.filter(p => p.team === Team.Titans);
    const atlanteanPlayers = playersData.filter(p => p.team === Team.Atlanteans);
    
    if (titanPlayers.length === 0) {
      errors.push({
        field: 'teams',
        message: 'Titans team cannot be empty',
        severity: 'error'
      });
    }
    
    if (atlanteanPlayers.length === 0) {
      errors.push({
        field: 'teams', 
        message: 'Atlanteans team cannot be empty',
        severity: 'error'
      });
    }

    // Significant team size imbalance warning
    const sizeDifference = Math.abs(titanPlayers.length - atlanteanPlayers.length);
    if (sizeDifference > 1) {
      warnings.push({
        field: 'teams',
        message: `Team sizes are unbalanced (Titans: ${titanPlayers.length}, Atlanteans: ${atlanteanPlayers.length})`,
        severity: 'warning'
      });
    }

    // Hero duplicate validation
    const heroUsage = new Map<number, string[]>();
    playersData.forEach(player => {
      if (!heroUsage.has(player.heroId)) {
        heroUsage.set(player.heroId, []);
      }
      heroUsage.get(player.heroId)!.push(player.playerId);
    });

    heroUsage.forEach((playerIds, heroId) => {
      if (playerIds.length > 1) {
        errors.push({
          field: 'hero',
          message: `Hero ID ${heroId} is assigned to multiple players: ${playerIds.join(', ')}`,
          severity: 'error'
        });
      }
    });

    // Statistics validation
    playersData.forEach(player => {
      // Unrealistic kill counts for game length
      if (player.kills && player.kills > 0) {
        const maxKillsQuick = 10;
        const maxKillsLong = 20;
        const maxKills = matchData.gameLength === GameLength.Quick ? maxKillsQuick : maxKillsLong;
        
        if (player.kills > maxKills) {
          warnings.push({
            field: 'kills',
            playerId: player.playerId,
            message: `${player.kills} kills seems high for ${matchData.gameLength} match`,
            severity: 'warning'
          });
        }
      }

      // Unrealistic death counts
      if (player.deaths && player.deaths > 15) {
        warnings.push({
          field: 'deaths',
          playerId: player.playerId,
          message: `${player.deaths} deaths seems very high`,
          severity: 'warning'
        });
      }

      // Negative statistics
      ['kills', 'deaths', 'assists', 'goldEarned', 'minionKills'].forEach(field => {
        const value = player[field as keyof DBMatchPlayer] as number;
        if (value !== undefined && value < 0) {
          errors.push({
            field,
            playerId: player.playerId,
            message: `${field} cannot be negative`,
            severity: 'error'
          });
        }
      });

      // Level validation
      if (player.level !== undefined && (player.level < 1 || player.level > 10)) {
        errors.push({
          field: 'level',
          playerId: player.playerId,
          message: 'Level must be between 1 and 10',
          severity: 'error'
        });
      }
    });

    // Date validation
    const matchDate = new Date(matchData.date);
    const now = new Date();
    
    if (matchDate > now) {
      warnings.push({
        field: 'date',
        message: 'Match date is in the future',
        severity: 'warning'
      });
    }

    // Very old dates might be typos
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (matchDate < oneYearAgo) {
      warnings.push({
        field: 'date',
        message: 'Match date is more than a year old',
        severity: 'warning'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Complete match edit - atomic operation that updates match, players, and recalculates stats
   */
  async editMatch(
    matchId: string, 
    matchUpdates: Partial<DBMatch>, 
    playerUpdates: Array<{
      id: string;
      updates: Partial<DBMatchPlayer>;
    }>
  ): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    // Step 1: Get current data for validation
    const currentMatch = await this.getMatch(matchId);
    if (!currentMatch) {
      throw new Error(`Match with ID ${matchId} not found`);
    }

    const currentPlayers = await this.getMatchPlayers(matchId);
    
    // Step 2: Apply updates to create proposed data
    const proposedMatch = { ...currentMatch, ...matchUpdates };
    const proposedPlayers = currentPlayers.map(player => {
      const update = playerUpdates.find(u => u.id === player.id);
      return update ? { ...player, ...update.updates } : player;
    });

    // Step 3: Validate the proposed changes
    const validation = this.validateMatchEdit(proposedMatch, proposedPlayers);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Step 4: Perform the atomic update
    try {
      // Use Promise.all to perform updates concurrently but atomically
      await Promise.all([
        this.updateMatch(matchId, matchUpdates),
        this.updateMatchPlayers(playerUpdates)
      ]);

      // Step 5: Recalculate player statistics (this handles rating recalculation)
      await this.recalculatePlayerStats();

      console.log(`Successfully edited match ${matchId}`);
    } catch (error) {
      console.error(`Error editing match ${matchId}:`, error);
      throw new Error(`Failed to edit match: ${(error as Error).message}`);
    }
  }

  /**
   * Get editable match data with all necessary information for editing UI
   */
  async getEditableMatch(matchId: string): Promise<{
    match: DBMatch;
    players: (DBMatchPlayer & { playerName: string })[];
  } | null> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) return null;

      const matchPlayers = await this.getMatchPlayers(matchId);
      
      // Get player names
      const playersWithNames = await Promise.all(
        matchPlayers.map(async (matchPlayer) => {
          const player = await this.getPlayer(matchPlayer.playerId);
          return {
            ...matchPlayer,
            playerName: player?.name || 'Unknown Player'
          };
        })
      );

      return {
        match,
        players: playersWithNames
      };
    } catch (error) {
      console.error(`Error getting editable match ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Check if a match can be safely edited (no data integrity issues)
   */
  async canEditMatch(matchId: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        return { canEdit: false, reason: 'Match not found' };
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      if (matchPlayers.length === 0) {
        return { canEdit: false, reason: 'Match has no player data' };
      }

      // Check if all players still exist
      for (const matchPlayer of matchPlayers) {
        const player = await this.getPlayer(matchPlayer.playerId);
        if (!player) {
          return { canEdit: false, reason: `Player ${matchPlayer.playerId} no longer exists` };
        }
      }

      return { canEdit: true };
    } catch (error) {
      console.error(`Error checking if match ${matchId} can be edited:`, error);
      return { canEdit: false, reason: 'Error checking match editability' };
    }
  }
}

// Export a singleton instance
export const dbService = new DatabaseService();
export default dbService;

// Export utility functions
export const getDisplayRating = (player: DBPlayer) => dbService.getDisplayRating(player);

// Export validation interfaces for UI components
export interface ValidationError {
  field: string;
  playerId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}