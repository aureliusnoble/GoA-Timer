// src/shared/utils/playerRename.ts
//
// Pure planning for "rename player" / "merge player into another".
// A player's name is its ID (players.id === players.name, matchPlayers.playerId),
// so a rename re-keys the player record and every match-player row.
import type { DBMatchPlayer, DBPlayer } from '../../services/DatabaseService';

export type RenameKind = 'rename' | 'merge';

export type RenamePlayerError =
  | { code: 'EMPTY_NAME' }
  | { code: 'SAME_NAME' }
  | { code: 'PLAYER_NOT_FOUND'; playerId: string }
  | { code: 'NAME_HELD_BY_OTHER_RECORD'; name: string }
  | { code: 'PLAYERS_SHARE_MATCHES'; matchIds: string[] }
  | { code: 'KIND_CHANGED'; expected: RenameKind; actual: RenameKind };

export interface RenamePlan {
  kind: RenameKind;
  oldId: string;
  newId: string;
  /** Record to store under newId: the renamed player, or the merge target with combined metadata. */
  player: DBPlayer;
  /** Every match-player row of oldId with playerId set to newId (row ids unchanged). */
  matchPlayers: DBMatchPlayer[];
  /** Distinct ids of the matches those rows belong to. */
  matchIds: string[];
}

export type RenamePlanResult =
  | { ok: true; plan: RenamePlan }
  | { ok: false; error: RenamePlayerError };

export interface RenamePlanInput {
  oldId: string;
  /** Raw user input; trimmed before use. */
  newName: string;
  /** All player records (or at least the old player, the target and any record named newName). */
  players: readonly DBPlayer[];
  /** All match-player rows of oldId and of the target name. Other rows are ignored. */
  matchPlayers: readonly DBMatchPlayer[];
}

/** Store-like object accepted by applyRenamePlan (IDBObjectStore satisfies it). */
export interface RenameWritableStore {
  put(value: unknown): unknown;
  delete(key: string): unknown;
}

export function normalisePlayerName(name: string): string {
  return name.trim();
}

function earlierDate(a: Date, b: Date): Date {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function mergePlayerRecords(target: DBPlayer, absorbed: DBPlayer): DBPlayer {
  const levels = [target.level, absorbed.level].filter(
    (level): level is number => typeof level === 'number' && Number.isFinite(level)
  );
  return {
    ...target,
    dateCreated: earlierDate(target.dateCreated, absorbed.dateCreated),
    level: levels.length > 0 ? Math.max(...levels) : target.level,
  };
}

/**
 * Work out what renaming `oldId` to `newName` means. If no player is called
 * newName it is a rename; if one is, it is a merge into that player, refused
 * when both players appear in the same match. Nothing is written here.
 */
export function planPlayerRename(input: RenamePlanInput): RenamePlanResult {
  const { oldId, players, matchPlayers } = input;
  const newId = normalisePlayerName(input.newName);

  if (newId === '') return { ok: false, error: { code: 'EMPTY_NAME' } };
  if (newId === oldId) return { ok: false, error: { code: 'SAME_NAME' } };

  const oldPlayer = players.find(p => p.id === oldId);
  if (!oldPlayer) return { ok: false, error: { code: 'PLAYER_NOT_FOUND', playerId: oldId } };

  // The players store has a unique index on `name`; a different record already
  // using newName as its name would make the write fail.
  const nameHolder = players.find(p => p.name === newId && p.id !== newId && p.id !== oldId);
  if (nameHolder) return { ok: false, error: { code: 'NAME_HELD_BY_OTHER_RECORD', name: newId } };

  const oldRows = matchPlayers.filter(mp => mp.playerId === oldId);
  const targetMatchIds = new Set(matchPlayers.filter(mp => mp.playerId === newId).map(mp => mp.matchId));
  const matchIds = [...new Set(oldRows.map(mp => mp.matchId))];

  const sharedMatchIds = matchIds.filter(matchId => targetMatchIds.has(matchId));
  if (sharedMatchIds.length > 0) {
    return { ok: false, error: { code: 'PLAYERS_SHARE_MATCHES', matchIds: sharedMatchIds } };
  }

  const rekeyedRows = oldRows.map(mp => ({ ...mp, playerId: newId }));
  const target = players.find(p => p.id === newId);

  if (!target) {
    return {
      ok: true,
      plan: {
        kind: 'rename',
        oldId,
        newId,
        player: { ...oldPlayer, id: newId, name: newId },
        matchPlayers: rekeyedRows,
        matchIds,
      },
    };
  }

  return {
    ok: true,
    plan: {
      kind: 'merge',
      oldId,
      newId,
      player: mergePlayerRecords(target, oldPlayer),
      matchPlayers: rekeyedRows,
      matchIds,
    },
  };
}

/**
 * Issue the writes for a plan. Call inside ONE readwrite transaction over the
 * players and matchPlayers stores so the whole rename commits or rolls back.
 * The old record is deleted before the new one is written (unique name index).
 */
export function applyRenamePlan(
  plan: RenamePlan,
  stores: { players: RenameWritableStore; matchPlayers: RenameWritableStore }
): void {
  stores.players.delete(plan.oldId);
  stores.players.put(plan.player);
  for (const row of plan.matchPlayers) {
    stores.matchPlayers.put(row);
  }
}

/**
 * Rename a player inside an in-memory list (setup screen, saved game).
 * Matches the name exactly, as the name is the stored ID.
 * Returns a new array, or null when nothing changed.
 */
export function renamePlayerInPlayerList<T extends { name: string }>(
  players: readonly T[],
  oldId: string,
  newId: string
): T[] | null {
  let changed = false;
  const renamed = players.map(player => {
    if (player.name !== oldId) return player;
    changed = true;
    return { ...player, name: newId };
  });
  return changed ? renamed : null;
}

/**
 * True when an in-memory player list (setup screen, saved game) holds both
 * names. Renaming one to the other would leave two entries with the same name,
 * and recording that game would then fail on the unique [playerId, matchId]
 * index and lose the match, so such a rename/merge must not touch the list.
 */
export function playerListHasBoth(
  players: readonly { name: string }[],
  oldId: string,
  newId: string
): boolean {
  return players.some(player => player.name === oldId) && players.some(player => player.name === newId);
}

export type GameRenameOutcome<T> =
  | { status: 'renamed'; value: T }
  /** Nobody in it has the old name (or there is nothing to rename in). */
  | { status: 'unchanged' }
  /** It already holds both names; left as it is rather than creating a duplicate. */
  | { status: 'duplicate' };

/** Rename a player in a game's player list without ever creating two entries with one name. */
export function renamePlayerInGameList<T extends { name: string }>(
  players: readonly T[],
  oldId: string,
  newId: string
): GameRenameOutcome<T[]> {
  if (playerListHasBoth(players, oldId, newId)) return { status: 'duplicate' };
  const renamed = renamePlayerInPlayerList(players, oldId, newId);
  return renamed ? { status: 'renamed', value: renamed } : { status: 'unchanged' };
}

/**
 * Rename a player in saved in-progress game data (the stored record, or App's
 * copy behind the resume prompt). Every other field is kept as it is.
 */
export function renamePlayerInSavedGameData<T extends { players?: readonly { name: string }[] }>(
  saved: T | null | undefined,
  oldId: string,
  newId: string
): GameRenameOutcome<T> {
  if (!saved || !Array.isArray(saved.players)) return { status: 'unchanged' };
  const outcome = renamePlayerInGameList(saved.players, oldId, newId);
  return outcome.status === 'renamed' ? { status: 'renamed', value: { ...saved, players: outcome.value } } : outcome;
}

/** User-facing text for a planning error. */
export function describeRenameError(error: RenamePlayerError): string {
  switch (error.code) {
    case 'EMPTY_NAME':
      return 'Enter a name.';
    case 'SAME_NAME':
      return 'That is already this player\'s name.';
    case 'PLAYER_NOT_FOUND':
      return `Player "${error.playerId}" no longer exists.`;
    case 'NAME_HELD_BY_OTHER_RECORD':
      return `The name "${error.name}" is used by another player record.`;
    case 'PLAYERS_SHARE_MATCHES':
      return error.matchIds.length === 1
        ? "Can't merge: both players are in the same match."
        : `Can't merge: both players are in ${error.matchIds.length} of the same matches.`;
    case 'KIND_CHANGED':
      return 'The player list changed while you were confirming. Please try again.';
  }
}
