// src/shared/utils/roundStatEditing.ts
// Editing helpers for the end-of-round review: kills, the assists they grant,
// and undoing exactly what a kill granted.
import type { CountStatKey, RoundValues } from './gameStatLog';

/** One "Got Kill" press: who scored it and which teammates got an assist from it. */
export interface KillEvent {
  killerId: number;
  assistIds: number[];
}

interface TeamMember {
  id: number;
  team: string;
}

/** Add delta to a count stat for one player, never below 0. */
export function adjustCount(values: RoundValues, playerId: number, stat: CountStatKey, delta: number): RoundValues {
  const current = values[playerId]?.[stat] ?? 0;
  return { ...values, [playerId]: { ...values[playerId], [stat]: Math.max(0, current + delta) } };
}

/** +1 kill for the killer; +1 assist for each teammate when grantAssists. Records the event. */
export function recordKill(
  values: RoundValues,
  events: KillEvent[],
  players: ReadonlyArray<TeamMember>,
  killerId: number,
  grantAssists: boolean
): { values: RoundValues; events: KillEvent[] } {
  const killer = players.find(player => player.id === killerId);
  let next = adjustCount(values, killerId, 'kills', 1);
  const assistIds =
    grantAssists && killer
      ? players.filter(player => player.team === killer.team && player.id !== killerId).map(player => player.id)
      : [];
  for (const id of assistIds) next = adjustCount(next, id, 'assists', 1);
  return { values: next, events: [...events, { killerId, assistIds }] };
}

/**
 * -1 kill for the player and remove the assists granted by that player's most
 * recent recorded kill. Kills that were pre-filled (no recorded event) only
 * lose the kill.
 */
export function undoKill(
  values: RoundValues,
  events: KillEvent[],
  killerId: number
): { values: RoundValues; events: KillEvent[] } {
  if ((values[killerId]?.kills ?? 0) <= 0) return { values, events };
  let next = adjustCount(values, killerId, 'kills', -1);
  let index = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].killerId === killerId) {
      index = i;
      break;
    }
  }
  if (index === -1) return { values: next, events };
  for (const id of events[index].assistIds) next = adjustCount(next, id, 'assists', -1);
  return { values: next, events: [...events.slice(0, index), ...events.slice(index + 1)] };
}
