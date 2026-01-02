import { useCallback, useMemo } from 'react';
import { useViewMode } from '../context/ViewModeContext';
import { dbService, DBPlayer, DBMatch, DBMatchPlayer } from '../services/DatabaseService';
import { CloudPlayer, CloudMatch, CloudMatchPlayer } from '../services/supabase/ShareService';
import { Team, GameLength } from '../types';
import { heroes as allHeroesData } from '../data/heroes';
import { rating, rate, ordinal } from 'openskill';

// TrueSkill constants (must match DatabaseService)
const TRUESKILL_BETA = 25/6;
const TRUESKILL_TAU = 25/300;

// Hero stats interface (matches the one in HeroStats.tsx)
export interface HeroStatsData {
  heroId: number;
  heroName: string;
  icon: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  complexity: number;
  roles: string[];
  bestTeammates: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
  bestAgainst: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
  worstAgainst: { heroId: number; heroName: string; icon: string; winRate: number; gamesPlayed: number }[];
  expansion: string;
}

/**
 * Calculate hero stats from matches and match players data
 * This is a pure function that can work with any data source
 */
function calculateHeroStats(
  allMatchPlayers: DBMatchPlayer[],
  allMatches: DBMatch[],
  minGamesForRelationships: number = 1,
  startDate?: Date,
  endDate?: Date
): HeroStatsData[] {
  // Filter matches by date range if specified
  let filteredMatches = allMatches;
  if (startDate || endDate) {
    filteredMatches = allMatches.filter(match => {
      const matchDate = new Date(match.date);
      if (startDate && matchDate < startDate) return false;
      if (endDate && matchDate > endDate) return false;
      return true;
    });
  }

  // Create a set of valid match IDs for filtering match players
  const validMatchIds = new Set(filteredMatches.map(m => m.id));

  // Filter match players to only include those from valid matches
  const filteredMatchPlayers = allMatchPlayers.filter(mp => validMatchIds.has(mp.matchId));

  const matchesMap = new Map(filteredMatches.map(m => [m.id, m]));

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
  for (const matchPlayer of filteredMatchPlayers) {
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
  for (const match of filteredMatches) {
    const matchHeroes = filteredMatchPlayers.filter(mp => mp.matchId === match.id);

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
      .filter(([, stats]) => stats.games >= minGamesForRelationships)
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
      .filter(([, stats]) => stats.games >= minGamesForRelationships)
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
      .filter(([, stats]) => stats.games >= minGamesForRelationships)
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
      heroId: hero.heroId,
      heroName: hero.heroName,
      icon: hero.icon,
      roles: hero.roles,
      complexity: hero.complexity,
      expansion: hero.expansion,
      totalGames: hero.totalGames,
      wins: hero.wins,
      losses: hero.losses,
      winRate,
      bestTeammates,
      bestAgainst,
      worstAgainst
    };
  });

  // Enrich with data from heroes.ts
  for (const heroStat of heroStats) {
    const heroData = allHeroesData.find(h => h.name === heroStat.heroName);
    if (heroData) {
      heroStat.complexity = heroData.complexity;
      heroStat.expansion = heroData.expansion;
    }
  }

  return heroStats;
}

// Player relationship interface
export interface PlayerRelationship {
  playerId: string;
  relatedPlayerId: string;
  relatedPlayerName: string;
  teammateWins: number;
  teammateLosses: number;
  opponentWins: number;
  opponentLosses: number;
}

/**
 * Calculate player relationship network from matches
 */
function calculatePlayerRelationships(
  allMatchPlayers: DBMatchPlayer[],
  allMatches: DBMatch[],
  allPlayers: DBPlayer[],
  playerIds: string[],
  minGames: number = 1,
  startDate?: Date,
  endDate?: Date
): PlayerRelationship[] {
  // Create a map for player name lookup
  const playerNameMap = new Map(allPlayers.map(p => [p.id, p.name]));

  // Filter matches by date range if specified
  let filteredMatches = allMatches;
  if (startDate || endDate) {
    filteredMatches = allMatches.filter(match => {
      const matchDate = new Date(match.date);
      if (startDate && matchDate < startDate) return false;
      if (endDate && matchDate > endDate) return false;
      return true;
    });
  }

  if (filteredMatches.length === 0) {
    return [];
  }

  // Create a set of valid match IDs for filtering
  const validMatchIds = new Set(filteredMatches.map(m => m.id));
  const filteredMatchPlayers = allMatchPlayers.filter(mp => validMatchIds.has(mp.matchId));

  // Create a set of selected player IDs for filtering
  const selectedPlayerIds = new Set(playerIds);

  // Track relationships
  const relationshipMap = new Map<string, PlayerRelationship>();

  // Process each match
  for (const match of filteredMatches) {
    const matchPlayerRecords = filteredMatchPlayers.filter(mp => mp.matchId === match.id);

    for (const player1 of matchPlayerRecords) {
      if (!player1.playerId) continue;
      if (!selectedPlayerIds.has(player1.playerId)) continue;

      const player1Won = player1.team === match.winningTeam;

      for (const player2 of matchPlayerRecords) {
        if (!player2.playerId) continue;
        if (player1.playerId === player2.playerId) continue;
        if (!selectedPlayerIds.has(player2.playerId)) continue;

        const key = `${player1.playerId}-${player2.playerId}`;

        if (!relationshipMap.has(key)) {
          relationshipMap.set(key, {
            playerId: player1.playerId,
            relatedPlayerId: player2.playerId,
            relatedPlayerName: playerNameMap.get(player2.playerId) || player2.playerId,
            teammateWins: 0,
            teammateLosses: 0,
            opponentWins: 0,
            opponentLosses: 0
          });
        }

        const rel = relationshipMap.get(key)!;
        const sameTeam = player1.team === player2.team;

        if (sameTeam) {
          if (player1Won) {
            rel.teammateWins++;
          } else {
            rel.teammateLosses++;
          }
        } else {
          if (player1Won) {
            rel.opponentWins++;
          } else {
            rel.opponentLosses++;
          }
        }
      }
    }
  }

  // Filter by minGames
  return Array.from(relationshipMap.values()).filter(rel => {
    const totalGames = rel.teammateWins + rel.teammateLosses + rel.opponentWins + rel.opponentLosses;
    return totalGames >= minGames;
  });
}

// Historical rating snapshot interface
export interface RatingSnapshot {
  date: string;
  matchNumber: number;
  ratings: { [playerId: string]: number };
  participants: string[];
}

/**
 * Calculate historical ratings by replaying all matches chronologically
 */
async function calculateHistoricalRatings(
  allMatches: DBMatch[],
  allPlayers: DBPlayer[],
  getMatchPlayersForMatch: (matchId: string) => Promise<DBMatchPlayer[]>
): Promise<RatingSnapshot[]> {
  // Sort matches by date
  const sortedMatches = [...allMatches].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  // Initialize player ratings
  const playerRatings: { [playerId: string]: ReturnType<typeof rating> } = {};
  for (const player of allPlayers) {
    playerRatings[player.id] = rating();
  }

  const ratingHistory: RatingSnapshot[] = [];

  // Add initial snapshot (game 0)
  const initialSnapshot: { [playerId: string]: number } = {};
  for (const playerId in playerRatings) {
    const playerRating = playerRatings[playerId];
    const ordinalValue = ordinal(playerRating);
    const displayRating = Math.round((ordinalValue + 25) * 40 + 200);
    initialSnapshot[playerId] = displayRating;
  }

  ratingHistory.push({
    date: sortedMatches.length > 0 ? sortedMatches[0].date.toString() : new Date().toISOString(),
    matchNumber: 0,
    ratings: initialSnapshot,
    participants: []
  });

  // Process each match chronologically
  for (let matchIndex = 0; matchIndex < sortedMatches.length; matchIndex++) {
    const match = sortedMatches[matchIndex];
    const matchPlayers = await getMatchPlayersForMatch(match.id);

    // Separate into teams
    const titanPlayers: string[] = [];
    const titanRatings: ReturnType<typeof rating>[] = [];
    const atlanteanPlayers: string[] = [];
    const atlanteanRatings: ReturnType<typeof rating>[] = [];

    for (const mp of matchPlayers) {
      // Initialize rating if player wasn't in initial list
      if (!playerRatings[mp.playerId]) {
        playerRatings[mp.playerId] = rating();
      }

      if (mp.team === 'titans') {
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
    const ranks = match.winningTeam === 'titans' ? [1, 2] : [2, 1];

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

    // Create snapshot
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
      participants: [...titanPlayers, ...atlanteanPlayers]
    });
  }

  return ratingHistory;
}

/**
 * Convert ordinal rating to display rating
 */
function getDisplayRating(player: DBPlayer): number {
  if (player.ordinal !== undefined) {
    return Math.round((player.ordinal + 25) * 40 + 200);
  }
  // Fallback calculation from mu/sigma
  const ord = (player.mu || 25) - 3 * (player.sigma || 25/3);
  return Math.round((ord + 25) * 40 + 200);
}

/**
 * Convert cloud player data to local DBPlayer format
 */
function cloudPlayerToLocal(cp: CloudPlayer): DBPlayer {
  return {
    id: cp.local_id || cp.name,
    name: cp.name,
    totalGames: cp.total_games,
    wins: cp.wins,
    losses: cp.losses,
    elo: cp.elo,
    mu: cp.mu,
    sigma: cp.sigma,
    ordinal: cp.ordinal,
    lastPlayed: cp.last_played ? new Date(cp.last_played) : new Date(),
    dateCreated: new Date(cp.date_created),
    deviceId: cp.device_id || undefined,
    level: cp.level || undefined,
  };
}

/**
 * Convert cloud match data to local DBMatch format
 */
function cloudMatchToLocal(cm: CloudMatch): DBMatch {
  return {
    id: cm.id,
    date: new Date(cm.date),
    winningTeam: cm.winning_team as Team,
    gameLength: cm.game_length as GameLength,
    doubleLanes: cm.double_lanes,
    titanPlayers: cm.titan_players,
    atlanteanPlayers: cm.atlantean_players,
    deviceId: cm.device_id || undefined,
  };
}

/**
 * Convert cloud match player data to local DBMatchPlayer format
 */
function cloudMatchPlayerToLocal(cmp: CloudMatchPlayer): DBMatchPlayer {
  return {
    id: cmp.id,
    matchId: cmp.match_id,
    playerId: cmp.player_id,
    team: cmp.team as Team,
    heroId: cmp.hero_id,
    heroName: cmp.hero_name,
    heroRoles: cmp.hero_roles || [],
    kills: cmp.kills,
    deaths: cmp.deaths,
    assists: cmp.assists,
    goldEarned: cmp.gold_earned,
    minionKills: cmp.minion_kills,
    level: cmp.level,
    deviceId: cmp.device_id || undefined,
  };
}

/**
 * Hook that provides data source abstraction
 * Returns data from shared cloud data when in view mode,
 * otherwise returns data from local IndexedDB
 */
export function useDataSource() {
  const { isViewMode, sharedData, isLoading: isViewModeLoading } = useViewMode();

  // Convert shared data to local format (memoized)
  const localPlayers = useMemo(() => {
    if (!isViewMode || !sharedData?.players) return null;
    return sharedData.players.map(cloudPlayerToLocal);
  }, [isViewMode, sharedData?.players]);

  const localMatches = useMemo(() => {
    if (!isViewMode || !sharedData?.matches) return null;
    return sharedData.matches.map(cloudMatchToLocal);
  }, [isViewMode, sharedData?.matches]);

  const localMatchPlayers = useMemo(() => {
    if (!isViewMode || !sharedData?.matchPlayers) return null;
    return sharedData.matchPlayers.map(cloudMatchPlayerToLocal);
  }, [isViewMode, sharedData?.matchPlayers]);

  // Get all players
  const getAllPlayers = useCallback(async (): Promise<DBPlayer[]> => {
    if (isViewMode && localPlayers) {
      return localPlayers;
    }
    return dbService.getAllPlayers();
  }, [isViewMode, localPlayers]);

  // Get a specific player
  const getPlayer = useCallback(async (playerId: string): Promise<DBPlayer | undefined> => {
    if (isViewMode && localPlayers) {
      return localPlayers.find(p => p.id === playerId || p.name === playerId);
    }
    const player = await dbService.getPlayer(playerId);
    return player ?? undefined;
  }, [isViewMode, localPlayers]);

  // Get all matches
  const getAllMatches = useCallback(async (): Promise<DBMatch[]> => {
    if (isViewMode && localMatches) {
      return localMatches;
    }
    return dbService.getAllMatches();
  }, [isViewMode, localMatches]);

  // Get match players for a specific match
  const getMatchPlayers = useCallback(async (matchId: string): Promise<DBMatchPlayer[]> => {
    if (isViewMode && localMatchPlayers) {
      return localMatchPlayers.filter(mp => mp.matchId === matchId);
    }
    return dbService.getMatchPlayers(matchId);
  }, [isViewMode, localMatchPlayers]);

  // Get all match players
  const getAllMatchPlayers = useCallback(async (): Promise<DBMatchPlayer[]> => {
    if (isViewMode && localMatchPlayers) {
      return localMatchPlayers;
    }
    // Get all matches and then all their players
    const allMatches = await dbService.getAllMatches();
    const allMatchPlayers: DBMatchPlayer[] = [];
    for (const match of allMatches) {
      const players = await dbService.getMatchPlayers(match.id);
      allMatchPlayers.push(...players);
    }
    return allMatchPlayers;
  }, [isViewMode, localMatchPlayers]);

  // Get matches for a specific player
  const getPlayerMatches = useCallback(async (playerId: string): Promise<{match: DBMatch; matchPlayer: DBMatchPlayer}[]> => {
    if (isViewMode && localMatches && localMatchPlayers) {
      const playerMatchPlayers = localMatchPlayers.filter(mp => mp.playerId === playerId);
      return playerMatchPlayers.map(mp => {
        const match = localMatches.find(m => m.id === mp.matchId);
        return match ? { match, matchPlayer: mp } : null;
      }).filter(Boolean) as {match: DBMatch; matchPlayer: DBMatchPlayer}[];
    }
    // dbService.getPlayerMatches returns DBMatchPlayer[], need to augment with match data
    const matchPlayers = await dbService.getPlayerMatches(playerId);
    const results: {match: DBMatch; matchPlayer: DBMatchPlayer}[] = [];
    for (const mp of matchPlayers) {
      const matches = await dbService.getAllMatches();
      const match = matches.find(m => m.id === mp.matchId);
      if (match) {
        results.push({ match, matchPlayer: mp });
      }
    }
    return results;
  }, [isViewMode, localMatches, localMatchPlayers]);

  // Get hero stats (view mode aware)
  const getHeroStats = useCallback(async (
    minGamesForRelationships: number = 1,
    startDate?: Date,
    endDate?: Date
  ): Promise<HeroStatsData[]> => {
    const allMatchPlayers = await getAllMatchPlayers();
    const allMatches = await getAllMatches();
    return calculateHeroStats(allMatchPlayers, allMatches, minGamesForRelationships, startDate, endDate);
  }, [getAllMatchPlayers, getAllMatches]);

  // Get player relationship network (view mode aware)
  const getPlayerRelationshipNetwork = useCallback(async (
    playerIds: string[],
    minGames: number = 1,
    startDate?: Date,
    endDate?: Date
  ): Promise<PlayerRelationship[]> => {
    const allMatchPlayers = await getAllMatchPlayers();
    const allMatches = await getAllMatches();
    const allPlayers = await getAllPlayers();
    return calculatePlayerRelationships(allMatchPlayers, allMatches, allPlayers, playerIds, minGames, startDate, endDate);
  }, [getAllMatchPlayers, getAllMatches, getAllPlayers]);

  // Get historical ratings (view mode aware)
  const getHistoricalRatings = useCallback(async (): Promise<RatingSnapshot[]> => {
    const allMatches = await getAllMatches();
    const allPlayers = await getAllPlayers();
    return calculateHistoricalRatings(allMatches, allPlayers, getMatchPlayers);
  }, [getAllMatches, getAllPlayers, getMatchPlayers]);

  // Get current TrueSkill ratings (view mode aware)
  const getCurrentTrueSkillRatings = useCallback(async (): Promise<{ [playerId: string]: number }> => {
    const allPlayers = await getAllPlayers();
    const ratings: { [playerId: string]: number } = {};
    for (const player of allPlayers) {
      ratings[player.id] = getDisplayRating(player);
    }
    return ratings;
  }, [getAllPlayers]);

  // Get display rating for a player (view mode aware)
  const getPlayerDisplayRating = useCallback((player: DBPlayer): number => {
    return getDisplayRating(player);
  }, []);

  // Get a specific match by ID (view mode aware)
  const getMatch = useCallback(async (matchId: string): Promise<DBMatch | undefined> => {
    if (isViewMode && localMatches) {
      return localMatches.find(m => m.id === matchId);
    }
    const allMatches = await dbService.getAllMatches();
    return allMatches.find(m => m.id === matchId);
  }, [isViewMode, localMatches]);

  // Get player stats for a specific player (view mode aware)
  // Returns the same structure as dbService.getPlayerStats
  const getPlayerStats = useCallback(async (playerId: string): Promise<{
    matchesPlayed: Array<{
      matchId: string;
      heroId: number;
      heroName: string;
      heroRoles?: string[];
      team: Team;
      won: boolean;
      date: Date;
      kills?: number;
      deaths?: number;
      assists?: number;
      goldEarned?: number;
      minionKills?: number;
      level?: number;
    }>;
  }> => {
    const allMatches = await getAllMatches();
    const allMatchPlayers = await getAllMatchPlayers();

    // Find all match records for this player
    const playerMatchRecords = allMatchPlayers.filter(mp => mp.playerId === playerId);

    // Build matches played array
    const matchesPlayed = playerMatchRecords.map(mp => {
      const match = allMatches.find(m => m.id === mp.matchId);
      if (!match) return null;

      return {
        matchId: mp.matchId,
        heroId: mp.heroId,
        heroName: mp.heroName,
        heroRoles: mp.heroRoles,
        team: mp.team,
        won: mp.team === match.winningTeam,
        date: match.date,
        kills: mp.kills,
        deaths: mp.deaths,
        assists: mp.assists,
        goldEarned: mp.goldEarned,
        minionKills: mp.minionKills,
        level: mp.level
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    return { matchesPlayed };
  }, [getAllMatches, getAllMatchPlayers]);

  // Get historical ratings for a specific period with optional TrueSkill recalculation
  const getHistoricalRatingsForPeriod = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    recalculateTrueSkill: boolean = false
  ): Promise<RatingSnapshot[]> => {
    const allMatches = await getAllMatches();
    const allPlayers = await getAllPlayers();

    // Filter matches by date range if specified
    let filteredMatches = allMatches;
    if (startDate || endDate) {
      filteredMatches = allMatches.filter(match => {
        const matchDate = new Date(match.date);
        if (startDate && matchDate < startDate) return false;
        if (endDate && matchDate > endDate) return false;
        return true;
      });
    }

    if (filteredMatches.length === 0) {
      return [];
    }

    // Sort matches by date
    const sortedMatches = [...filteredMatches].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    // Initialize player ratings
    const playerRatings: { [playerId: string]: ReturnType<typeof rating> } = {};

    if (recalculateTrueSkill) {
      // Start fresh - all players begin with default rating
      for (const player of allPlayers) {
        playerRatings[player.id] = rating();
      }
    } else {
      // Use stored ratings as starting point
      for (const player of allPlayers) {
        // Create a rating object from stored values
        if (player.mu !== undefined && player.sigma !== undefined) {
          playerRatings[player.id] = rating({ mu: player.mu, sigma: player.sigma });
        } else {
          playerRatings[player.id] = rating();
        }
      }

      // If we're just filtering (not recalculating), get the full history and filter by date
      const fullHistory = await calculateHistoricalRatings(allMatches, allPlayers, getMatchPlayers);

      if (!startDate && !endDate) {
        return fullHistory;
      }

      // Filter snapshots by date
      return fullHistory.filter(snapshot => {
        const snapshotDate = new Date(snapshot.date);
        if (startDate && snapshotDate < startDate) return false;
        if (endDate && snapshotDate > endDate) return false;
        return true;
      });
    }

    // If recalculating, replay matches and build history
    const ratingHistory: RatingSnapshot[] = [];

    // Add initial snapshot (game 0)
    const initialSnapshot: { [playerId: string]: number } = {};
    for (const playerId in playerRatings) {
      const playerRating = playerRatings[playerId];
      const ordinalValue = ordinal(playerRating);
      const displayRating = Math.round((ordinalValue + 25) * 40 + 200);
      initialSnapshot[playerId] = displayRating;
    }

    ratingHistory.push({
      date: sortedMatches[0].date.toString(),
      matchNumber: 0,
      ratings: initialSnapshot,
      participants: []
    });

    // Process each match chronologically
    for (let matchIndex = 0; matchIndex < sortedMatches.length; matchIndex++) {
      const match = sortedMatches[matchIndex];
      const matchPlayers = await getMatchPlayers(match.id);

      // Separate into teams
      const titanPlayers: string[] = [];
      const titanRatings: ReturnType<typeof rating>[] = [];
      const atlanteanPlayers: string[] = [];
      const atlanteanRatings: ReturnType<typeof rating>[] = [];

      for (const mp of matchPlayers) {
        // Initialize rating if player wasn't in initial list
        if (!playerRatings[mp.playerId]) {
          playerRatings[mp.playerId] = rating();
        }

        if (mp.team === 'titans') {
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
      const ranks = match.winningTeam === 'titans' ? [1, 2] : [2, 1];

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

      // Create snapshot
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
        participants: [...titanPlayers, ...atlanteanPlayers]
      });
    }

    return ratingHistory;
  }, [getAllMatches, getAllPlayers, getMatchPlayers]);

  // Interface for filtered player stats
  interface FilteredPlayerStats {
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
  }

  // Get hero win rate over time (view mode aware)
  const getHeroWinRateOverTime = useCallback(async (
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
  }> => {
    // In view mode, calculate from local data
    if (isViewMode && localMatches && localMatchPlayers) {
      let allMatches = [...localMatches];

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
      const allMatchPlayers = localMatchPlayers.filter(mp => validMatchIds.has(mp.matchId));
      const matchesMap = new Map(allMatches.map(m => [m.id, m]));

      // Build hero tracking data structure
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

      // Convert to time series data with cumulative stats
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

      // Enrich with icon data from heroes.ts
      for (const heroResult of heroResults) {
        const heroData = allHeroesData.find(h => h.name === heroResult.heroName);
        if (heroData) {
          heroResult.icon = heroData.icon;
        }
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
    }

    // Not in view mode - use database service
    return dbService.getHeroWinRateOverTime(heroIds, minGames, startDate, endDate);
  }, [isViewMode, localMatches, localMatchPlayers]);

  // Get hero relationship network (view mode aware)
  const getHeroRelationshipNetwork = useCallback(async (
    heroIds: number[],
    minGames: number = 1,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    heroId: number;
    relatedHeroId: number;
    teammateWins: number;
    teammateLosses: number;
    opponentWins: number;
    opponentLosses: number;
  }[]> => {
    // In view mode, calculate from local data
    if (isViewMode && localMatches && localMatchPlayers) {
      let allMatches = [...localMatches];

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
        return [];
      }

      // Create a set of valid match IDs for filtering
      const validMatchIds = new Set(allMatches.map(m => m.id));
      const allMatchPlayers = localMatchPlayers.filter(mp => validMatchIds.has(mp.matchId));

      // Create a set of selected hero IDs for filtering
      const selectedHeroIds = new Set(heroIds);

      // Track relationships: key is "heroId-relatedHeroId"
      const relationshipMap = new Map<string, {
        heroId: number;
        relatedHeroId: number;
        teammateWins: number;
        teammateLosses: number;
        opponentWins: number;
        opponentLosses: number;
      }>();

      // Process each match
      for (const match of allMatches) {
        const matchHeroes = allMatchPlayers.filter(mp => mp.matchId === match.id);

        // For each hero in the match
        for (const hero1 of matchHeroes) {
          if (hero1.heroId === undefined || hero1.heroId === null) continue;
          if (!selectedHeroIds.has(hero1.heroId)) continue;

          const hero1Won = hero1.team === match.winningTeam;

          // Compare with every other hero in the match
          for (const hero2 of matchHeroes) {
            if (hero2.heroId === undefined || hero2.heroId === null) continue;
            if (hero1.heroId === hero2.heroId) continue;
            if (!selectedHeroIds.has(hero2.heroId)) continue;

            const key = `${hero1.heroId}-${hero2.heroId}`;

            if (!relationshipMap.has(key)) {
              relationshipMap.set(key, {
                heroId: hero1.heroId,
                relatedHeroId: hero2.heroId,
                teammateWins: 0,
                teammateLosses: 0,
                opponentWins: 0,
                opponentLosses: 0
              });
            }

            const rel = relationshipMap.get(key)!;
            const sameTeam = hero1.team === hero2.team;

            if (sameTeam) {
              // Teammates
              if (hero1Won) {
                rel.teammateWins++;
              } else {
                rel.teammateLosses++;
              }
            } else {
              // Opponents
              if (hero1Won) {
                rel.opponentWins++;  // hero1 beat hero2
              } else {
                rel.opponentLosses++; // hero1 lost to hero2
              }
            }
          }
        }
      }

      // Filter by minGames and convert to array
      const relationships = Array.from(relationshipMap.values()).filter(rel => {
        const totalGames = rel.teammateWins + rel.teammateLosses + rel.opponentWins + rel.opponentLosses;
        return totalGames >= minGames;
      });

      return relationships;
    }

    // Not in view mode - use database service
    return dbService.getHeroRelationshipNetwork(heroIds, minGames, startDate, endDate);
  }, [isViewMode, localMatches, localMatchPlayers]);

  // Get filtered player stats (view mode aware)
  const getFilteredPlayerStats = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    recalculateTrueSkill: boolean = false
  ): Promise<{
    players: FilteredPlayerStats[];
    dateRange: { start: Date; end: Date } | null;
  }> => {
    const allPlayers = await getAllPlayers();
    let allMatches = await getAllMatches();
    const allMatchPlayersRaw = await getAllMatchPlayers();

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

    // Get TrueSkill ratings
    let trueSkillRatings: Record<string, number> = {};
    if (!recalculateTrueSkill) {
      // Use stored ratings
      for (const player of allPlayers) {
        trueSkillRatings[player.id] = getDisplayRating(player);
      }
    } else {
      // Recalculate TrueSkill using only filtered matches
      const sortedMatches = [...allMatches].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // Initialize all players with default rating
      const playerRatings: { [playerId: string]: ReturnType<typeof rating> } = {};
      for (const player of allPlayers) {
        playerRatings[player.id] = rating();
      }

      // Process each match
      for (const match of sortedMatches) {
        const matchPlayers = filteredMatchPlayers.filter(mp => mp.matchId === match.id);

        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: ReturnType<typeof rating>[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: ReturnType<typeof rating>[] = [];

        for (const mp of matchPlayers) {
          if (!playerRatings[mp.playerId]) {
            playerRatings[mp.playerId] = rating();
          }
          if (mp.team === 'titans') {
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

        // Determine ranks
        const ranks = match.winningTeam === 'titans' ? [1, 2] : [2, 1];

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
      for (const playerId in playerRatings) {
        const playerRating = playerRatings[playerId];
        const ordinalValue = ordinal(playerRating);
        trueSkillRatings[playerId] = Math.round((ordinalValue + 25) * 40 + 200);
      }
    }

    // Calculate stats for each player
    const playerStatsArray: FilteredPlayerStats[] = [];

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
  }, [getAllPlayers, getAllMatches, getAllMatchPlayers]);

  return {
    isViewMode,
    isViewModeLoading,
    getAllPlayers,
    getPlayer,
    getAllMatches,
    getMatch,
    getMatchPlayers,
    getAllMatchPlayers,
    getPlayerMatches,
    getPlayerStats,
    getHeroStats,
    getPlayerRelationshipNetwork,
    getHistoricalRatings,
    getHistoricalRatingsForPeriod,
    getCurrentTrueSkillRatings,
    getPlayerDisplayRating,
    getFilteredPlayerStats,
    getHeroWinRateOverTime,
    getHeroRelationshipNetwork,
  };
}
