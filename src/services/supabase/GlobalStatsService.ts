// src/services/supabase/GlobalStatsService.ts
import { supabase, isSupabaseConfigured } from './SupabaseClient';
import { heroes as allHeroes } from '../../data/heroes';
import { HeroImpactResult, Team, GameLength } from '../../types';
import { DBMatch, DBMatchPlayer, DBPlayer } from '../DatabaseService';
import { computeHeroImpactAsync } from '../HeroSkillService';

// Victory type stats for heroes
interface VictoryTypeStats {
  throne: { wins: number; total: number };
  wave: { wins: number; total: number };
  kills: { wins: number; total: number };
}

// Interface matching the HeroStats component's expectations
export interface GlobalHeroStats {
  heroId: number;
  heroName: string;
  icon: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  complexity: number;
  roles: string[];
  bestTeammates: HeroRelationship[];
  bestAgainst: HeroRelationship[];
  worstAgainst: HeroRelationship[];
  expansion: string;
  victoryTypeStats?: VictoryTypeStats;
}

export interface HeroRelationship {
  heroId: number;
  heroName: string;
  icon: string;
  winRate: number;
  gamesPlayed: number;
}

// Database response interfaces (from get_global_hero_stats_full RPC)
interface DBHeroRelationship {
  related_hero_id: number;
  related_hero_name: string;
  games_played: number;
  wins: number;
  win_rate: number;
}

interface DBVictoryTypeStats {
  throne: { wins: number; total: number };
  wave: { wins: number; total: number };
  kills: { wins: number; total: number };
}

interface DBHeroStats {
  hero_id: number;
  hero_name: string;
  total_games: number;
  wins: number;
  losses: number;
  win_rate: number;
  best_teammates: DBHeroRelationship[];
  best_against: DBHeroRelationship[];
  worst_against: DBHeroRelationship[];
  victory_type_stats?: DBVictoryTypeStats;
}

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: GlobalHeroStats[];
  timestamp: number;
  minGamesHero: number;
  minGamesRelationship: number;
  gameLengthFilter: string | null;
  playerCountFilter: number | null;
}

class GlobalStatsServiceClass {
  private cache: CacheEntry | null = null;
  private heroSkillCache: {
    data: HeroImpactResult[];
    timestamp: number;
  } | null = null;
  private rawMatchDataCache: {
    data: any[];
    timestamp: number;
  } | null = null;
  private prefetchPromise: Promise<void> | null = null;

  /**
   * Check if the cache is valid for the given parameters
   */
  private isCacheValid(
    minGamesHero: number,
    minGamesRelationship: number,
    gameLengthFilter: string | null = null,
    playerCountFilter: number | null = null
  ): boolean {
    if (!this.cache) return false;

    const now = Date.now();
    const isExpired = now - this.cache.timestamp > CACHE_TTL_MS;
    const paramsMatch =
      this.cache.minGamesHero === minGamesHero &&
      this.cache.minGamesRelationship === minGamesRelationship &&
      this.cache.gameLengthFilter === gameLengthFilter &&
      this.cache.playerCountFilter === playerCountFilter;

    return !isExpired && paramsMatch;
  }

  /**
   * Get cache age in seconds (for display purposes)
   */
  getCacheAge(): number | null {
    if (!this.cache) return null;
    return Math.floor((Date.now() - this.cache.timestamp) / 1000);
  }

  /**
   * Check if data is currently cached
   */
  isCached(): boolean {
    return this.cache !== null && (Date.now() - this.cache.timestamp) <= CACHE_TTL_MS;
  }

  /**
   * Clear the cache (for manual refresh)
   */
  clearCache(): void {
    this.cache = null;
    this.heroSkillCache = null;
    this.rawMatchDataCache = null;
    console.log('[GlobalStatsService] Cache cleared');
  }

  /**
   * Pre-fetch raw global match data so it's ready when the user navigates
   * to hero stats. Only does network I/O — no heavy computation.
   */
  prefetchGlobalMatchData(): void {
    if (!isSupabaseConfigured() || !supabase) return;
    if (this.heroSkillCache && Date.now() - this.heroSkillCache.timestamp < CACHE_TTL_MS) return;
    if (this.rawMatchDataCache && Date.now() - this.rawMatchDataCache.timestamp < CACHE_TTL_MS) return;
    if (this.prefetchPromise) return;

    this.prefetchPromise = Promise.resolve(supabase.rpc('get_hero_skill_match_data'))
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          this.rawMatchDataCache = { data, timestamp: Date.now() };
          console.log(`[GlobalStatsService] Pre-fetched ${data.length} match data rows`);
        }
      })
      .catch(() => {})
      .finally(() => { this.prefetchPromise = null; });
  }

  /**
   * Transform database hero relationship to client format
   */
  private transformRelationship(rel: DBHeroRelationship): HeroRelationship {
    const hero = allHeroes.find(h => h.id === rel.related_hero_id);
    return {
      heroId: rel.related_hero_id,
      heroName: rel.related_hero_name,
      icon: hero?.icon || `heroes/${rel.related_hero_name.toLowerCase().replace(/\s+/g, '')}.png`,
      winRate: rel.win_rate,
      gamesPlayed: rel.games_played,
    };
  }

  /**
   * Transform database hero stats to client format
   */
  private transformHeroStats(dbStats: DBHeroStats): GlobalHeroStats {
    const hero = allHeroes.find(h => h.id === dbStats.hero_id);

    return {
      heroId: dbStats.hero_id,
      heroName: dbStats.hero_name,
      icon: hero?.icon || `heroes/${dbStats.hero_name.toLowerCase().replace(/\s+/g, '')}.png`,
      totalGames: dbStats.total_games,
      wins: dbStats.wins,
      losses: dbStats.losses,
      winRate: dbStats.win_rate,
      complexity: hero?.complexity || 1,
      roles: hero?.roles || [],
      expansion: hero?.expansion || 'Unknown',
      bestTeammates: (dbStats.best_teammates || []).map(r => this.transformRelationship(r)),
      bestAgainst: (dbStats.best_against || []).map(r => this.transformRelationship(r)),
      worstAgainst: (dbStats.worst_against || []).map(r => this.transformRelationship(r)),
      victoryTypeStats: dbStats.victory_type_stats ? {
        throne: {
          wins: dbStats.victory_type_stats.throne?.wins || 0,
          total: dbStats.victory_type_stats.throne?.total || 0
        },
        wave: {
          wins: dbStats.victory_type_stats.wave?.wins || 0,
          total: dbStats.victory_type_stats.wave?.total || 0
        },
        kills: {
          wins: dbStats.victory_type_stats.kills?.wins || 0,
          total: dbStats.victory_type_stats.kills?.total || 0
        }
      } : undefined
    };
  }

  /**
   * Fetch global hero statistics from Supabase
   * Returns cached data if available and not expired
   */
  async getGlobalHeroStats(
    minGamesHero: number = 1,
    minGamesRelationship: number = 3,
    forceRefresh: boolean = false,
    gameLengthFilter: string | null = null,
    playerCountFilter: number | null = null
  ): Promise<{ success: boolean; data?: GlobalHeroStats[]; error?: string }> {
    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Cloud features are not configured. Please set up Supabase environment variables.',
      };
    }

    // Check cache (unless force refresh)
    if (!forceRefresh && this.isCacheValid(minGamesHero, minGamesRelationship, gameLengthFilter, playerCountFilter)) {
      console.log('[GlobalStatsService] Returning cached data');
      return { success: true, data: this.cache!.data };
    }

    try {
      console.log('[GlobalStatsService] Fetching global stats from Supabase...');

      const hasFilters = gameLengthFilter != null || playerCountFilter != null;
      const rpcName = hasFilters ? 'get_global_hero_stats_filtered' : 'get_global_hero_stats_full';
      const params = hasFilters
        ? {
            min_games_hero: minGamesHero,
            min_games_relationship: minGamesRelationship,
            p_game_length: gameLengthFilter,
            p_player_count: playerCountFilter,
          }
        : {
            min_games_hero: minGamesHero,
            min_games_relationship: minGamesRelationship,
          };

      // Call the RPC function
      const { data, error } = await supabase.rpc(rpcName, params);

      if (error) {
        console.error('[GlobalStatsService] RPC error:', error);
        return {
          success: false,
          error: `Failed to fetch global stats: ${error.message}`,
        };
      }

      if (!data || !Array.isArray(data)) {
        console.log('[GlobalStatsService] No data returned or empty array');
        return { success: true, data: [] };
      }

      // Transform the data
      const transformedData = (data as DBHeroStats[]).map(s => this.transformHeroStats(s));

      // Update cache
      this.cache = {
        data: transformedData,
        timestamp: Date.now(),
        minGamesHero,
        minGamesRelationship,
        gameLengthFilter,
        playerCountFilter,
      };

      console.log(`[GlobalStatsService] Fetched ${transformedData.length} hero stats`);
      return { success: true, data: transformedData };

    } catch (err) {
      console.error('[GlobalStatsService] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      };
    }
  }

  /**
   * Fetch global match data from Supabase and compute hero impact locally.
   * Downloads deduplicated match rows with player skill ratings, converts
   * to the format expected by computeHeroImpact, and runs the g-formula.
   */
  async getGlobalHeroSkillStats(
    forceRefresh: boolean = false
  ): Promise<{ success: boolean; data?: HeroImpactResult[]; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured.' };
    }

    if (
      !forceRefresh &&
      this.heroSkillCache &&
      Date.now() - this.heroSkillCache.timestamp < CACHE_TTL_MS
    ) {
      return { success: true, data: this.heroSkillCache.data };
    }

    try {
      // Wait for any in-flight prefetch before potentially re-fetching
      if (this.prefetchPromise) {
        await this.prefetchPromise;
      }

      let rows: any[];
      if (this.rawMatchDataCache && Date.now() - this.rawMatchDataCache.timestamp < CACHE_TTL_MS) {
        rows = this.rawMatchDataCache.data;
      } else {
        const { data, error } = await supabase.rpc('get_hero_skill_match_data');
        if (error) {
          return { success: false, error: `Failed to fetch global match data: ${error.message}` };
        }
        if (!data || data.length === 0) {
          return { success: true, data: [] };
        }
        rows = data;
        this.rawMatchDataCache = { data: rows, timestamp: Date.now() };
        this.heroSkillCache = null;
      }

      if (rows.length === 0) {
        return { success: true, data: [] };
      }

      // Convert raw rows into DBMatch / DBMatchPlayer / DBPlayer structures
      const matchMap = new Map<string, DBMatch>();
      const matchPlayers: DBMatchPlayer[] = [];
      const playerMap = new Map<string, DBPlayer>();

      for (const row of rows as any[]) {
        const matchId = row.match_id as string;
        if (!matchMap.has(matchId)) {
          matchMap.set(matchId, {
            id: matchId,
            date: new Date(),
            winningTeam: row.winning_team as Team,
            gameLength: 'long' as GameLength,
            doubleLanes: false,
            titanPlayers: 0,
            atlanteanPlayers: 0,
            victoryType: row.victory_type || undefined,
          });
        }

        const playerId = `global_${matchId}_${row.team}_${row.hero_id}`;
        matchPlayers.push({
          id: `${matchId}_${playerId}`,
          matchId,
          playerId,
          team: row.team as Team,
          heroId: row.hero_id,
          heroName: row.hero_name,
          heroRoles: [],
        });

        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, {
            id: playerId,
            name: playerId,
            totalGames: 0,
            wins: 0,
            losses: 0,
            elo: 1200,
            mu: row.player_mu ?? 25,
            lastPlayed: new Date(),
            dateCreated: new Date(),
          });
        }
      }

      const matches = Array.from(matchMap.values());
      const players = Array.from(playerMap.values());

      const results = await computeHeroImpactAsync(matches, matchPlayers, players);

      this.heroSkillCache = { data: results, timestamp: Date.now() };
      return { success: true, data: results };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      };
    }
  }

  /**
   * Get the total number of unique matches in global stats
   * (Sum of all hero games divided by average heroes per match)
   */
  async getGlobalMatchCount(): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features not configured' };
    }

    try {
      // Rough estimate: sum of all hero games / 10 (average heroes per match in 5v5)
      const { data: sumData, error: sumError } = await supabase
        .from('global_hero_stats')
        .select('total_games');

      if (sumError || !sumData) {
        // View might not exist yet
        return { success: true, count: 0 };
      }

      const totalHeroGames = sumData.reduce((sum, row) => sum + (row.total_games || 0), 0);
      const estimatedMatches = Math.round(totalHeroGames / 10);

      return { success: true, count: estimatedMatches };
    } catch {
      return { success: true, count: 0 };
    }
  }

  /**
   * Fetch global hero win rate over time from Supabase
   * @param heroIds - Optional array of hero IDs to filter
   * @param minGames - Minimum games before showing hero (default: 3)
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   */
  async getGlobalHeroStatsOverTime(
    heroIds?: number[],
    minGames: number = 3,
    startDate?: Date | null,
    endDate?: Date | null,
    gameLengthFilter: string | null = null,
    playerCountFilter: number | null = null
  ): Promise<{
    success: boolean;
    data?: {
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
    };
    error?: string;
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Cloud features are not configured. Please set up Supabase environment variables.',
      };
    }

    try {
      console.log('[GlobalStatsService] Fetching global hero stats over time...');

      // Format dates for Postgres
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
      const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;

      const hasFilters = gameLengthFilter != null || playerCountFilter != null;
      const rpcName = hasFilters ? 'get_global_hero_stats_over_time_filtered' : 'get_global_hero_stats_over_time';
      const rpcParams = hasFilters
        ? {
            p_hero_ids: heroIds && heroIds.length > 0 ? heroIds : null,
            p_min_games: minGames,
            p_start_date: startDateStr,
            p_end_date: endDateStr,
            p_game_length: gameLengthFilter,
            p_player_count: playerCountFilter,
          }
        : {
            p_hero_ids: heroIds && heroIds.length > 0 ? heroIds : null,
            p_min_games: minGames,
            p_start_date: startDateStr,
            p_end_date: endDateStr,
          };

      // Call the RPC function
      const { data, error } = await supabase.rpc(rpcName, rpcParams);

      if (error) {
        console.error('[GlobalStatsService] RPC error:', error);
        return {
          success: false,
          error: `Failed to fetch global hero stats over time: ${error.message}`,
        };
      }

      if (!data) {
        return {
          success: true,
          data: { heroes: [], dateRange: null },
        };
      }

      // Transform the response
      const responseData = data as {
        heroes: Array<{
          heroId: number;
          heroName: string;
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
      };

      // Enrich with hero icons and apply client-side minGames truncation
      // (ensures data starts from Nth game even if server doesn't filter correctly)
      const enrichedHeroes = responseData.heroes
        .map(hero => {
          const heroData = allHeroes.find(h => h.id === hero.heroId);
          // Filter data points to only show from minGames-th game onwards
          const filteredDataPoints = hero.dataPoints.filter(dp => dp.gamesPlayedTotal >= minGames);
          return {
            ...hero,
            icon: heroData?.icon || `heroes/${hero.heroName.toLowerCase().replace(/\s+/g, '')}.png`,
            dataPoints: filteredDataPoints,
          };
        })
        // Only include heroes that have data points meeting the threshold
        .filter(hero => hero.dataPoints.length > 0);

      console.log(`[GlobalStatsService] Fetched ${enrichedHeroes.length} heroes over time`);

      return {
        success: true,
        data: {
          heroes: enrichedHeroes,
          dateRange: responseData.dateRange,
        },
      };
    } catch (err) {
      console.error('[GlobalStatsService] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      };
    }
  }

  /**
   * Get hero relationship network data for graph visualization
   * Returns relationship data between selected heroes for network graph
   */
  async getHeroRelationshipNetwork(
    heroIds: number[],
    minGames: number = 1,
    gameLengthFilter: string | null = null,
    playerCountFilter: number | null = null
  ): Promise<{
    success: boolean;
    data?: Array<{
      heroId: number;
      relatedHeroId: number;
      teammateWins: number;
      teammateLosses: number;
      opponentWins: number;
      opponentLosses: number;
    }>;
    error?: string;
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Cloud features are not configured. Please set up Supabase environment variables.',
      };
    }

    try {
      console.log('[GlobalStatsService] Fetching hero relationship network...');

      const hasFilters = gameLengthFilter != null || playerCountFilter != null;

      let data: any[] | null;
      let error: any;

      if (hasFilters) {
        const resp = await supabase.rpc('get_global_hero_relationships_filtered', {
          p_hero_ids: heroIds,
          p_min_games: minGames,
          p_game_length: gameLengthFilter,
          p_player_count: playerCountFilter,
        });
        data = resp.data;
        error = resp.error;
      } else {
        const resp = await supabase
          .from('global_hero_relationships')
          .select('hero_id, related_hero_id, relationship_type, games_played, wins')
          .in('hero_id', heroIds)
          .in('related_hero_id', heroIds)
          .gte('games_played', minGames);
        data = resp.data;
        error = resp.error;
      }

      if (error) {
        console.error('[GlobalStatsService] Query error:', error);
        return {
          success: false,
          error: `Failed to fetch relationship data: ${error.message}`,
        };
      }

      if (!data || data.length === 0) {
        return { success: true, data: [] };
      }

      // Transform the data: combine teammate and opponent records
      // The view has separate rows for 'teammate' and 'opponent' relationship types
      const relationshipMap = new Map<string, {
        heroId: number;
        relatedHeroId: number;
        teammateWins: number;
        teammateLosses: number;
        opponentWins: number;
        opponentLosses: number;
      }>();

      for (const row of data) {
        const key = `${row.hero_id}-${row.related_hero_id}`;

        if (!relationshipMap.has(key)) {
          relationshipMap.set(key, {
            heroId: row.hero_id,
            relatedHeroId: row.related_hero_id,
            teammateWins: 0,
            teammateLosses: 0,
            opponentWins: 0,
            opponentLosses: 0
          });
        }

        const rel = relationshipMap.get(key)!;

        if (row.relationship_type === 'teammate') {
          rel.teammateWins = row.wins;
          rel.teammateLosses = row.games_played - row.wins;
        } else if (row.relationship_type === 'opponent') {
          rel.opponentWins = row.wins;
          rel.opponentLosses = row.games_played - row.wins;
        }
      }

      const relationships = Array.from(relationshipMap.values());
      console.log(`[GlobalStatsService] Fetched ${relationships.length} hero relationships`);

      return { success: true, data: relationships };
    } catch (err) {
      console.error('[GlobalStatsService] Unexpected error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      };
    }
  }
  /**
   * Get full relationship data for a single hero from the materialized view.
   * Unlike getGlobalHeroStats (which returns top 3), this returns ALL relationships.
   */
  async getGlobalHeroRelationships(
    heroId: number,
    minGames: number = 1
  ): Promise<{
    success: boolean;
    data?: {
      bestTeammates: HeroRelationship[];
      bestAgainst: HeroRelationship[];
      worstAgainst: HeroRelationship[];
    };
    error?: string;
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('global_hero_relationships')
        .select('hero_id, related_hero_id, related_hero_name, relationship_type, games_played, wins, win_rate')
        .eq('hero_id', heroId)
        .gte('games_played', minGames);

      if (error) {
        return { success: false, error: error.message };
      }

      const teammates: HeroRelationship[] = [];
      const opponents: HeroRelationship[] = [];

      for (const row of (data || [])) {
        const hero = allHeroes.find(h => h.id === row.related_hero_id);
        const rel: HeroRelationship = {
          heroId: row.related_hero_id,
          heroName: row.related_hero_name,
          icon: hero?.icon || `heroes/${row.related_hero_name.toLowerCase().replace(/\s+/g, '')}.png`,
          winRate: row.win_rate,
          gamesPlayed: row.games_played,
        };
        if (row.relationship_type === 'teammate') {
          teammates.push(rel);
        } else {
          opponents.push(rel);
        }
      }

      teammates.sort((a, b) => b.winRate - a.winRate);
      opponents.sort((a, b) => b.winRate - a.winRate);

      return {
        success: true,
        data: {
          bestTeammates: teammates,
          bestAgainst: opponents.filter(o => o.winRate >= 50),
          worstAgainst: [...opponents.filter(o => o.winRate < 50)].sort((a, b) => a.winRate - b.winRate),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      };
    }
  }
}

// Export singleton instance
export const GlobalStatsService = new GlobalStatsServiceClass();
