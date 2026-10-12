// src/services/supabase/authStorage.ts
//
// Where the Supabase client persists the signed-in session (localStorage), so
// code that must not wait on the network can read the signed-in user directly.
// supabase.auth.getSession() waits on the auth lock and may retry a token
// refresh for a long time when offline.

export const SUPABASE_AUTH_STORAGE_KEY = 'goa-timer-auth';

/** Id of the user in the persisted session; undefined when there is none or it can't be read. */
export function getStoredSessionUserId(): string | undefined {
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (!raw) return undefined;
    const id: unknown = JSON.parse(raw)?.user?.id;
    return typeof id === 'string' && id !== '' ? id : undefined;
  } catch {
    return undefined;
  }
}
