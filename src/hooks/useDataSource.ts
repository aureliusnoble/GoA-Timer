import { useCallback, useMemo } from 'react';
import { useViewMode } from '../context/ViewModeContext';
import { dbService, DBPlayer, DBMatch, DBMatchPlayer } from '../services/DatabaseService';
import { CloudPlayer, CloudMatch, CloudMatchPlayer } from '../services/supabase/ShareService';
import { Team, GameLength } from '../types';

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
  const { isViewMode, sharedData } = useViewMode();

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

  return {
    isViewMode,
    getAllPlayers,
    getPlayer,
    getAllMatches,
    getMatchPlayers,
    getAllMatchPlayers,
    getPlayerMatches,
  };
}
