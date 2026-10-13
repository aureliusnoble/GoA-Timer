// src/shared/utils/cloudMapping.ts
//
// The single place that converts rows between the Supabase cloud tables and the
// local IndexedDB models. To add a column, add one line in each direction here.
//
// Download (cloud -> local): SQL NULL and malformed values become `undefined`
// ("not tracked"); a tracked zero stays 0.
// Upload (local -> cloud): keys whose local value is `undefined` or `null` are
// omitted, so a single-row upsert never overwrites a value already in the cloud.
// Keep uploading ONE row per upsert call: a bulk (array) upsert sends a `columns`
// list and PostgREST then writes NULL into rows that lack a key.
import type { DBMatch, DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';
import { GameLength, Team, VictoryType } from '../../types';
import { sanitizeRoundStats } from './roundStats';

export interface CloudPlayerRow {
  local_id?: string | null;
  name: string;
  total_games?: number | null;
  wins?: number | null;
  losses?: number | null;
  elo?: number | null;
  mu?: number | string | null;
  sigma?: number | string | null;
  ordinal?: number | string | null;
  last_played?: string | null;
  date_created?: string | null;
  device_id?: string | null;
  level?: number | null;
}

export interface CloudMatchRow {
  id: string;
  date: string;
  winning_team: string;
  game_length: string;
  double_lanes?: boolean | null;
  titan_players?: number | null;
  atlantean_players?: number | null;
  device_id?: string | null;
  victory_type?: string | null;
}

export interface CloudMatchPlayerRow {
  id: string;
  match_id: string;
  player_id: string;
  team: string;
  hero_id: number;
  hero_name: string;
  hero_roles?: string[] | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  gold_earned?: number | null;
  minion_kills?: number | null;
  level?: number | null;
  /** JSONB round log; absent/null for rows recorded without one (and anonymized shares). */
  round_stats?: unknown;
  device_id?: string | null;
}

/** Values needed to build an upload payload. */
export interface CloudUploadContext {
  ownerId: string;
  /** Used when the local record has no deviceId of its own. */
  deviceId: string;
  /** ISO timestamp written to synced_at. */
  syncedAt: string;
}

export type CloudRowPayload = Record<string, unknown>;

const VICTORY_TYPES: readonly VictoryType[] = ['throne', 'wave', 'kills'];

/** Finite number (or numeric string, as Postgres DECIMAL may arrive) -> number; anything else -> undefined. */
export function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** 'throne' | 'wave' | 'kills' (any case) -> VictoryType; anything else -> undefined. */
export function toVictoryType(value: unknown): VictoryType | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  return (VICTORY_TYPES as readonly string[]).includes(lower) ? (lower as VictoryType) : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function toDateOr(value: unknown, fallback: () => Date): Date {
  if (typeof value === 'string' || value instanceof Date) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback();
}

/** Copy of `row` without keys whose value is undefined or null. */
export function omitMissing(row: CloudRowPayload): CloudRowPayload {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== null)
  );
}

// ---------------------------------------------------------------------------
// Download direction
// ---------------------------------------------------------------------------

export function cloudPlayerRowToLocal(row: CloudPlayerRow): DBPlayer {
  return {
    id: toOptionalString(row.local_id) ?? row.name,
    name: row.name,
    totalGames: toOptionalNumber(row.total_games) ?? 0,
    wins: toOptionalNumber(row.wins) ?? 0,
    losses: toOptionalNumber(row.losses) ?? 0,
    elo: toOptionalNumber(row.elo) ?? 1200,
    mu: toOptionalNumber(row.mu),
    sigma: toOptionalNumber(row.sigma),
    ordinal: toOptionalNumber(row.ordinal),
    lastPlayed: toDateOr(row.last_played, () => new Date()),
    dateCreated: toDateOr(row.date_created, () => new Date()),
    deviceId: toOptionalString(row.device_id),
    level: toOptionalNumber(row.level),
  };
}

export function cloudMatchRowToLocal(row: CloudMatchRow): DBMatch {
  return {
    id: row.id,
    date: new Date(row.date),
    // Keep values lowercase to match the Team and GameLength enum values
    winningTeam: row.winning_team.toLowerCase() as Team,
    gameLength: row.game_length.toLowerCase() as GameLength,
    doubleLanes: row.double_lanes === true,
    titanPlayers: toOptionalNumber(row.titan_players) ?? 0,
    atlanteanPlayers: toOptionalNumber(row.atlantean_players) ?? 0,
    deviceId: toOptionalString(row.device_id),
    victoryType: toVictoryType(row.victory_type),
  };
}

export function cloudMatchPlayerRowToLocal(row: CloudMatchPlayerRow): DBMatchPlayer {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    team: row.team.toLowerCase() as Team,
    heroId: row.hero_id,
    heroName: row.hero_name,
    heroRoles: Array.isArray(row.hero_roles) ? row.hero_roles : [],
    kills: toOptionalNumber(row.kills),
    deaths: toOptionalNumber(row.deaths),
    assists: toOptionalNumber(row.assists),
    goldEarned: toOptionalNumber(row.gold_earned),
    minionKills: toOptionalNumber(row.minion_kills),
    level: toOptionalNumber(row.level),
    roundStats: sanitizeRoundStats(row.round_stats),
    deviceId: toOptionalString(row.device_id),
  };
}

// ---------------------------------------------------------------------------
// Upload direction
// ---------------------------------------------------------------------------

export function localPlayerToCloudRow(player: DBPlayer, ctx: CloudUploadContext): CloudRowPayload {
  return omitMissing({
    owner_id: ctx.ownerId,
    local_id: player.id,
    name: player.name,
    total_games: player.totalGames,
    wins: player.wins,
    losses: player.losses,
    elo: player.elo,
    mu: player.mu,
    sigma: player.sigma,
    ordinal: player.ordinal,
    last_played: player.lastPlayed,
    date_created: player.dateCreated,
    device_id: player.deviceId || ctx.deviceId,
    level: player.level,
    sync_source: 'local',
    synced_at: ctx.syncedAt,
  });
}

export function localMatchToCloudRow(match: DBMatch, ctx: CloudUploadContext): CloudRowPayload {
  return omitMissing({
    id: match.id,
    owner_id: ctx.ownerId,
    date: match.date,
    winning_team: match.winningTeam.toLowerCase(),
    game_length: match.gameLength.toLowerCase(),
    double_lanes: match.doubleLanes,
    titan_players: match.titanPlayers,
    atlantean_players: match.atlanteanPlayers,
    device_id: match.deviceId || ctx.deviceId,
    sync_source: 'local',
    synced_at: ctx.syncedAt,
    victory_type: toVictoryType(match.victoryType),
  });
}

export function localMatchPlayerToCloudRow(mp: DBMatchPlayer, ctx: CloudUploadContext): CloudRowPayload {
  return omitMissing({
    id: mp.id,
    owner_id: ctx.ownerId,
    match_id: mp.matchId,
    player_id: mp.playerId,
    team: mp.team.toLowerCase(),
    hero_id: mp.heroId,
    hero_name: mp.heroName,
    hero_roles: mp.heroRoles,
    kills: mp.kills,
    deaths: mp.deaths,
    assists: mp.assists,
    gold_earned: mp.goldEarned,
    minion_kills: mp.minionKills,
    level: mp.level,
    // Omitted when there is no log (see omitMissing), so an existing cloud log is never wiped
    round_stats: mp.roundStats,
    device_id: mp.deviceId || ctx.deviceId,
    sync_source: 'local',
    synced_at: ctx.syncedAt,
  });
}
