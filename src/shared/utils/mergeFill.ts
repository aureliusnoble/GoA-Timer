// src/shared/utils/mergeFill.ts

function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Fill the fields that are missing (undefined or null) on `local` with the
 * values from `incoming`. A value the local copy already has is never
 * overwritten, and a missing incoming value is never copied.
 * Returns the merged copy and the keys that were filled (empty = nothing to save).
 */
export function fillMissingFields<T extends object>(
  local: T,
  incoming: Partial<T>
): { merged: T; filledKeys: (keyof T)[] } {
  const merged: T = { ...local };
  const filledKeys: (keyof T)[] = [];

  for (const key of Object.keys(incoming) as (keyof T)[]) {
    const incomingValue = incoming[key];
    if (isMissing(incomingValue) || !isMissing(local[key])) continue;
    merged[key] = incomingValue as T[keyof T];
    filledKeys.push(key);
  }

  return { merged, filledKeys };
}
