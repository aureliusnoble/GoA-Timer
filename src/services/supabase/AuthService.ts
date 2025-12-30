import { supabase, isSupabaseConfigured } from './SupabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  shareStatsWithFriends: boolean;
  shareMatchHistoryWithFriends: boolean;
}

class AuthServiceClass {
  async signUp(data: SignUpData): Promise<AuthResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: available, error: checkError } = await supabase
        .rpc('check_username_available', { check_username: data.username });

      if (checkError) {
        return { success: false, error: 'Failed to check username availability' };
      }

      if (!available) {
        return { success: false, error: 'Username is already taken' };
      }

      const passwordError = this.validatePassword(data.password);
      if (passwordError) {
        return { success: false, error: passwordError };
      }

      const usernameError = this.validateUsername(data.username);
      if (usernameError) {
        return { success: false, error: usernameError };
      }

      // Get the redirect URL - use current origin + base path for GitHub Pages
      const redirectUrl = window.location.origin + (import.meta.env.BASE_URL || '/');

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: data.username,
            display_name: data.displayName || data.username,
          },
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user account' };
      }

      // Check if email is already registered
      // Supabase returns success but with empty identities array to prevent email enumeration
      if (authData.user.identities && authData.user.identities.length === 0) {
        return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: data.username,
          display_name: data.displayName || data.username,
          device_id: this.getDeviceId(),
        });

      if (profileError) {
        console.error('[AuthService] Failed to create profile:', profileError);
      }

      return {
        success: true,
        user: authData.user,
        session: authData.session || undefined,
      };
    } catch (error) {
      console.error('[AuthService] Sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async login(data: LoginData): Promise<AuthResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: authData.user,
        session: authData.session,
      };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async logout(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Logout error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async getUser(): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  async getProfile(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    const user = await this.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, share_stats_with_friends, share_match_history_with_friends')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      console.error('[AuthService] Failed to get profile:', error);

      // Profile might not exist yet - try to create it from user metadata
      if (error?.code === 'PGRST116') {
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: username,
            display_name: user.user_metadata?.display_name || username,
            device_id: this.getDeviceId(),
          })
          .select()
          .single();

        if (createError) {
          console.error('[AuthService] Failed to create profile:', createError);
          return null;
        }

        if (newProfile) {
          return {
            id: newProfile.id,
            username: newProfile.username,
            displayName: newProfile.display_name,
            avatarUrl: newProfile.avatar_url,
            shareStatsWithFriends: newProfile.share_stats_with_friends ?? true,
            shareMatchHistoryWithFriends: newProfile.share_match_history_with_friends ?? true,
          };
        }
      }
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      shareStatsWithFriends: data.share_stats_with_friends,
      shareMatchHistoryWithFriends: data.share_match_history_with_friends,
    };
  }

  async updateProfile(updates: Partial<Pick<UserProfile, 'displayName' | 'shareStatsWithFriends' | 'shareMatchHistoryWithFriends'>>): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    const user = await this.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.shareStatsWithFriends !== undefined) dbUpdates.share_stats_with_friends = updates.shareStatsWithFriends;
    if (updates.shareMatchHistoryWithFriends !== undefined) dbUpdates.share_match_history_with_friends = updates.shareMatchHistoryWithFriends;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        callback(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    const { data, error } = await supabase
      .rpc('check_username_available', { check_username: username });

    if (error) {
      console.error('[AuthService] Username check error:', error);
      return false;
    }

    return data === true;
  }

  validatePassword(password: string): string | null {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  }

  validateUsername(username: string): string | null {
    if (username.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (username.length > 30) {
      return 'Username must be at most 30 characters long';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  }

  async resendConfirmationEmail(email: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[AuthService] Resend confirmation error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async deleteCloudData(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    const user = await this.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Call the database function that handles deletion with proper permissions
      const { data, error } = await supabase.rpc('delete_own_cloud_data');

      if (error) {
        console.error('[AuthService] Failed to delete cloud data:', error);
        return { success: false, error: error.message };
      }

      if (data !== true) {
        return { success: false, error: 'Failed to delete cloud data' };
      }

      // Clear local sync timestamp
      localStorage.removeItem('cloudSync_lastSync');

      return { success: true };
    } catch (error) {
      console.error('[AuthService] Delete cloud data error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async deleteAccount(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    const user = await this.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Call the database function that handles complete account deletion
      // This function uses SECURITY DEFINER to delete from auth.users
      // which will cascade to all other tables (profiles, friends, cloud_data, etc.)
      const { data, error } = await supabase.rpc('delete_own_account');

      if (error) {
        console.error('[AuthService] Failed to delete account:', error);
        return { success: false, error: error.message };
      }

      if (data !== true) {
        return { success: false, error: 'Failed to delete account' };
      }

      // Sign out locally (the session is already invalid since the user was deleted)
      await supabase.auth.signOut();

      // Clear all local cloud-related storage
      localStorage.removeItem('cloudSync_lastSync');
      localStorage.removeItem('cloudSync_autoEnabled');

      return { success: true };
    } catch (error) {
      console.error('[AuthService] Delete account error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  private getDeviceId(): string {
    const storageKey = 'guards-of-atlantis-device-id';
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      deviceId = `device_${timestamp}_${randomPart}`;
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }
}

export const AuthService = new AuthServiceClass();
