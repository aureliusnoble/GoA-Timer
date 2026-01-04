import { supabase, isSupabaseConfigured } from './SupabaseClient';

export interface ShareLink {
  id: string;
  shareToken: string;
  isActive: boolean;
  createdAt: Date;
  viewCount: number;
  lastViewedAt: Date | null;
  // Enhanced fields for multiple links
  label: string | null;
  expiresAt: Date | null;
  isAnonymized: boolean;
}

export interface CreateShareLinkOptions {
  label?: string;
  expiresAt?: Date;
  isAnonymized?: boolean;
}

export interface UpdateShareLinkOptions {
  label?: string | null;
  expiresAt?: Date | null;
  isAnonymized?: boolean;
  isActive?: boolean;
}

export type ShareLinkErrorCode = 'LINK_NOT_FOUND' | 'LINK_EXPIRED';

export interface GetSharedDataResult {
  success: boolean;
  data?: SharedData;
  error?: string;
  errorCode?: ShareLinkErrorCode;
  expiredAt?: Date;
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
  isAnonymized: boolean;
  expiresAt: Date | null;
  playerNameMapping?: Record<string, string>; // Maps local_id to anonymized name
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
   * Map database row to ShareLink interface
   */
  private mapDbRowToShareLink(row: Record<string, unknown>): ShareLink {
    return {
      id: row.id as string,
      shareToken: row.share_token as string,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      viewCount: row.view_count as number,
      lastViewedAt: row.last_viewed_at ? new Date(row.last_viewed_at as string) : null,
      label: row.label as string | null,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      isAnonymized: row.is_anonymized as boolean ?? false,
    };
  }

  /**
   * Get all share links for the current user (up to 3)
   */
  async getMyShareLinks(): Promise<ShareLink[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ShareService] Get share links error:', error);
        return [];
      }

      return (data || []).map(row => this.mapDbRowToShareLink(row));
    } catch (error) {
      console.error('[ShareService] Get share links error:', error);
      return [];
    }
  }

  /**
   * Create a new share link (up to 3 allowed)
   */
  async createShareLink(options: CreateShareLinkOptions = {}): Promise<{
    success: boolean;
    shareLink?: ShareLink;
    error?: string;
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check current link count
      const existingLinks = await this.getMyShareLinks();
      if (existingLinks.length >= 3) {
        return { success: false, error: 'Maximum of 3 share links allowed' };
      }

      const token = this.generateToken();
      const { data, error } = await supabase
        .from('share_links')
        .insert({
          owner_id: user.id,
          share_token: token,
          is_active: true,
          label: options.label || null,
          expires_at: options.expiresAt?.toISOString() || null,
          is_anonymized: options.isAnonymized || false,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        shareLink: this.mapDbRowToShareLink(data),
      };
    } catch (error) {
      console.error('[ShareService] Create share link error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Update an existing share link
   */
  async updateShareLink(
    linkId: string,
    options: UpdateShareLinkOptions
  ): Promise<{ success: boolean; shareLink?: ShareLink; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const updateData: Record<string, unknown> = {};
      if (options.label !== undefined) updateData.label = options.label;
      if (options.expiresAt !== undefined) {
        updateData.expires_at = options.expiresAt?.toISOString() || null;
      }
      if (options.isAnonymized !== undefined) {
        updateData.is_anonymized = options.isAnonymized;
      }
      if (options.isActive !== undefined) {
        updateData.is_active = options.isActive;
      }

      const { data, error } = await supabase
        .from('share_links')
        .update(updateData)
        .eq('id', linkId)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        shareLink: this.mapDbRowToShareLink(data),
      };
    } catch (error) {
      console.error('[ShareService] Update share link error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Expire a share link immediately (permanent)
   */
  async expireShareLink(linkId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data, error } = await supabase.rpc('expire_share_link', {
        p_link_id: linkId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: data === true };
    } catch (error) {
      console.error('[ShareService] Expire share link error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Delete a share link permanently
   */
  async deleteShareLink(linkId: string): Promise<{ success: boolean; error?: string }> {
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
        .delete()
        .eq('id', linkId)
        .eq('owner_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[ShareService] Delete share link error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Fetch shared data for a given share token with enhanced error handling
   * This can be called by anonymous users
   */
  async getSharedData(token: string): Promise<GetSharedDataResult> {
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
        return {
          success: false,
          error: data.error,
          errorCode: data.error_code as ShareLinkErrorCode,
          expiredAt: data.expired_at ? new Date(data.expired_at) : undefined,
        };
      }

      // Debug log to see what's coming from the RPC
      console.log('[ShareService] Raw shared data from RPC:', {
        is_anonymized: data.is_anonymized,
        expires_at: data.expires_at,
        display_name: data.display_name,
      });

      return {
        success: true,
        data: {
          ownerId: data.owner_id,
          displayName: data.display_name || 'Unknown User',
          players: data.players || [],
          matches: data.matches || [],
          matchPlayers: data.match_players || [],
          isAnonymized: data.is_anonymized || false,
          expiresAt: data.expires_at ? new Date(data.expires_at) : null,
          playerNameMapping: data.player_name_mapping || undefined,
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

  // ============================================
  // DEPRECATED: Keep for backwards compatibility
  // ============================================

  /**
   * @deprecated Use getMyShareLinks() instead
   * Get the current user's first share link (if it exists)
   */
  async getMyShareLink(): Promise<ShareLink | null> {
    const links = await this.getMyShareLinks();
    return links.length > 0 ? links[0] : null;
  }

  /**
   * @deprecated Use createShareLink() instead
   * Enable sharing for the current user
   */
  async enableSharing(): Promise<{ success: boolean; shareLink?: ShareLink; error?: string }> {
    const existingLinks = await this.getMyShareLinks();
    if (existingLinks.length > 0) {
      // Activate the first existing link
      return this.updateShareLink(existingLinks[0].id, { isActive: true });
    }
    return this.createShareLink();
  }

  /**
   * @deprecated Use updateShareLink() or expireShareLink() instead
   * Disable sharing for the current user (deactivates all links)
   */
  async disableSharing(): Promise<{ success: boolean; error?: string }> {
    const links = await this.getMyShareLinks();
    for (const link of links) {
      await this.updateShareLink(link.id, { isActive: false });
    }
    return { success: true };
  }
}

export const ShareService = new ShareServiceClass();
