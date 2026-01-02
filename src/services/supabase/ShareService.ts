import { supabase, isSupabaseConfigured } from './SupabaseClient';

export interface ShareLink {
  id: string;
  shareToken: string;
  isActive: boolean;
  createdAt: Date;
  viewCount: number;
  lastViewedAt: Date | null;
}

export interface CloudPlayer {
  id: string;
  owner_id: string;
  local_id: string;
  name: string;
  total_games: number;
  wins: number;
  losses: number;
  elo: number;
  mu: number;
  sigma: number;
  ordinal: number;
  last_played: string | null;
  date_created: string;
  device_id: string | null;
  level: number | null;
}

export interface CloudMatch {
  id: string;
  owner_id: string;
  date: string;
  winning_team: 'titans' | 'atlanteans';
  game_length: 'quick' | 'long';
  double_lanes: boolean;
  titan_players: number;
  atlantean_players: number;
  device_id: string | null;
}

export interface CloudMatchPlayer {
  id: string;
  owner_id: string;
  match_id: string;
  player_id: string;
  team: 'titans' | 'atlanteans';
  hero_id: number;
  hero_name: string;
  hero_roles: string[];
  kills: number;
  deaths: number;
  assists: number;
  gold_earned: number;
  minion_kills: number;
  level: number;
  device_id: string | null;
}

export interface SharedData {
  ownerId: string;
  displayName: string;
  players: CloudPlayer[];
  matches: CloudMatch[];
  matchPlayers: CloudMatchPlayer[];
}

class ShareServiceClass {
  /**
   * Generate a cryptographically secure share token
   */
  private generateToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const base64 = btoa(String.fromCharCode(...bytes));
    // Make URL-safe
    return 'goa_' + base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Get the current user's share link (if it exists)
   */
  async getMyShareLink(): Promise<ShareLink | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is expected if no link exists yet
          return null;
        }
        console.error('[ShareService] Get share link error:', error);
        return null;
      }

      return {
        id: data.id,
        shareToken: data.share_token,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        viewCount: data.view_count,
        lastViewedAt: data.last_viewed_at ? new Date(data.last_viewed_at) : null,
      };
    } catch (error) {
      console.error('[ShareService] Get share link error:', error);
      return null;
    }
  }

  /**
   * Enable sharing for the current user
   * Creates a new share link if one doesn't exist, or activates the existing one
   */
  async enableSharing(): Promise<{ success: boolean; shareLink?: ShareLink; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if link already exists
      const existingLink = await this.getMyShareLink();

      if (existingLink) {
        // Activate existing link
        const { error } = await supabase
          .from('share_links')
          .update({ is_active: true })
          .eq('id', existingLink.id);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          shareLink: { ...existingLink, isActive: true },
        };
      }

      // Create new share link
      const token = this.generateToken();
      const { data, error } = await supabase
        .from('share_links')
        .insert({
          owner_id: user.id,
          share_token: token,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        shareLink: {
          id: data.id,
          shareToken: data.share_token,
          isActive: data.is_active,
          createdAt: new Date(data.created_at),
          viewCount: data.view_count,
          lastViewedAt: null,
        },
      };
    } catch (error) {
      console.error('[ShareService] Enable sharing error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Disable sharing for the current user
   * Does not delete the link, just deactivates it (preserves view count, etc.)
   */
  async disableSharing(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('share_links')
        .update({ is_active: false })
        .eq('owner_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[ShareService] Disable sharing error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Fetch shared data for a given share token
   * This can be called by anonymous users
   */
  async getSharedData(token: string): Promise<{ success: boolean; data?: SharedData; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data, error } = await supabase.rpc('get_shared_data', {
        p_share_token: token,
      });

      if (error) {
        console.error('[ShareService] Get shared data error:', error);
        return { success: false, error: error.message };
      }

      // Check if the function returned an error
      if (data && data.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        data: {
          ownerId: data.owner_id,
          displayName: data.display_name || 'Unknown User',
          players: data.players || [],
          matches: data.matches || [],
          matchPlayers: data.match_players || [],
        },
      };
    } catch (error) {
      console.error('[ShareService] Get shared data error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Generate the full share URL for a given token
   */
  getShareUrl(token: string): string {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${token}`;
  }

  /**
   * Extract share token from URL if present
   */
  getShareTokenFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  }

  /**
   * Remove share token from URL without reloading
   */
  clearShareTokenFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  }
}

export const ShareService = new ShareServiceClass();
