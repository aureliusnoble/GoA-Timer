// src/shared/utils/pendingPlayerRenames.ts
//
// Queue ("outbox") of player renames still to be applied to the user's cloud
// rows. Stored in localStorage by CloudSyncService and drained, oldest first,
// at the start of every upload/download so the old ID cannot come back.

export interface PendingPlayerRename {
  oldId: string;
  newId: string;
  /** ISO timestamp; also makes otherwise identical entries distinguishable. */
  queuedAt: string;
}

function isPendingPlayerRename(value: unknown): value is PendingPlayerRename {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.oldId === 'string' && entry.oldId !== ''
    && typeof entry.newId === 'string' && entry.newId !== ''
    && typeof entry.queuedAt === 'string';
}

/** Parse the stored queue; anything malformed is dropped rather than throwing. */
export function parsePendingRenames(raw: string | null): PendingPlayerRename[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingPlayerRename) : [];
  } catch {
    return [];
  }
}

/** Append a rename (ignored when oldId === newId). Order is preserved. */
export function appendPendingRename(
  queue: readonly PendingPlayerRename[],
  entry: PendingPlayerRename
): PendingPlayerRename[] {
  if (entry.oldId === entry.newId) return [...queue];
  return [...queue, entry];
}

/** Remove the first entry equal to `entry` (same oldId, newId and queuedAt). */
export function removePendingRename(
  queue: readonly PendingPlayerRename[],
  entry: PendingPlayerRename
): PendingPlayerRename[] {
  const index = queue.findIndex(item =>
    item.oldId === entry.oldId && item.newId === entry.newId && item.queuedAt === entry.queuedAt
  );
  if (index === -1) return [...queue];
  return [...queue.slice(0, index), ...queue.slice(index + 1)];
}
