import { supabase, isSupabaseConfigured } from './SupabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUser?: UserProfile;
  toUser?: UserProfile;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface Friend {
  id: string;
  friendProfile: UserProfile;
  createdAt: Date;
}

class FriendServiceClass {
  private realtimeChannel: RealtimeChannel | null = null;

  async searchUsers(query: string): Promise<UserProfile[]> {
    if (!isSupabaseConfigured() || !supabase || query.length < 2) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .rpc('search_users', { search_query: query });

      if (error) {
        console.error('[FriendService] Search error:', error);
        return [];
      }

      return (data || []).map((row: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      }));
    } catch (error) {
      console.error('[FriendService] Search error:', error);
      return [];
    }
  }

  async sendFriendRequest(toUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if already friends
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', toUserId)
        .single();

      if (existingFriend) {
        return { success: false, error: 'Already friends with this user' };
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: toUserId,
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Friend request already sent' };
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[FriendService] Send request error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async getPendingRequests(): Promise<FriendRequest[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          to_user_id,
          status,
          created_at,
          from_user:profiles!friend_requests_from_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FriendService] Get requests error:', error);
        return [];
      }

      return (data || []).map((row) => {
        const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
        return {
          id: row.id,
          fromUserId: row.from_user_id,
          toUserId: row.to_user_id,
          status: row.status as 'pending' | 'accepted' | 'rejected',
          createdAt: new Date(row.created_at),
          fromUser: fromUser ? {
            id: fromUser.id,
            username: fromUser.username,
            displayName: fromUser.display_name,
            avatarUrl: fromUser.avatar_url,
          } : undefined,
        };
      });
    } catch (error) {
      console.error('[FriendService] Get requests error:', error);
      return [];
    }
  }

  async getSentRequests(): Promise<FriendRequest[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user_id,
          to_user_id,
          status,
          created_at,
          to_user:profiles!friend_requests_to_user_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq('from_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FriendService] Get sent requests error:', error);
        return [];
      }

      return (data || []).map((row) => {
        const toUser = Array.isArray(row.to_user) ? row.to_user[0] : row.to_user;
        return {
          id: row.id,
          fromUserId: row.from_user_id,
          toUserId: row.to_user_id,
          status: row.status as 'pending' | 'accepted' | 'rejected',
          createdAt: new Date(row.created_at),
          toUser: toUser ? {
            id: toUser.id,
            username: toUser.username,
            displayName: toUser.display_name,
            avatarUrl: toUser.avatar_url,
          } : undefined,
        };
      });
    } catch (error) {
      console.error('[FriendService] Get sent requests error:', error);
      return [];
    }
  }

  async acceptRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data, error } = await supabase
        .rpc('accept_friend_request', { request_id: requestId });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: data === true };
    } catch (error) {
      console.error('[FriendService] Accept request error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async rejectRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('to_user_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[FriendService] Reject request error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async cancelRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId)
        .eq('from_user_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[FriendService] Cancel request error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async getFriends(): Promise<Friend[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          created_at,
          friend:profiles!friends_friend_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[FriendService] Get friends error:', error);
        return [];
      }

      return (data || []).map((row) => {
        const friend = Array.isArray(row.friend) ? row.friend[0] : row.friend;
        return {
          id: row.id,
          createdAt: new Date(row.created_at),
          friendProfile: {
            id: friend.id,
            username: friend.username,
            displayName: friend.display_name,
            avatarUrl: friend.avatar_url,
          },
        };
      });
    } catch (error) {
      console.error('[FriendService] Get friends error:', error);
      return [];
    }
  }

  async removeFriend(friendUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features are not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Delete both directions of friendship
      const { error: error1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendUserId);

      const { error: error2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendUserId)
        .eq('friend_id', user.id);

      if (error1 || error2) {
        return { success: false, error: error1?.message || error2?.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[FriendService] Remove friend error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  subscribeToRequests(
    onNewRequest: (request: FriendRequest) => void,
    onRequestUpdate: (request: FriendRequest) => void
  ): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    this.realtimeChannel = supabase
      .channel('friend_requests_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
        },
        (payload) => {
          const request = this.mapRequestFromPayload(payload.new);
          if (request) onNewRequest(request);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friend_requests',
        },
        (payload) => {
          const request = this.mapRequestFromPayload(payload.new);
          if (request) onRequestUpdate(request);
        }
      )
      .subscribe();

    return () => {
      if (this.realtimeChannel) {
        supabase?.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    };
  }

  private mapRequestFromPayload(data: Record<string, unknown>): FriendRequest | null {
    if (!data) return null;
    return {
      id: data.id as string,
      fromUserId: data.from_user_id as string,
      toUserId: data.to_user_id as string,
      status: data.status as 'pending' | 'accepted' | 'rejected',
      createdAt: new Date(data.created_at as string),
    };
  }
}

export const FriendService = new FriendServiceClass();
