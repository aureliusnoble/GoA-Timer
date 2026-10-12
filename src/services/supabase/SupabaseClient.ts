import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_AUTH_STORAGE_KEY } from './authStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[SupabaseClient] Missing Supabase environment variables. Cloud features will be disabled.'
  );
}

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
          storage: localStorage,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

export const isSupabaseConfigured = (): boolean => supabase !== null;

export type { SupabaseClient };
