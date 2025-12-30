import { supabase, isSupabaseConfigured } from './SupabaseClient';
import dbService from '../DatabaseService';
import type { DBPlayer, DBMatch, DBMatchPlayer, ExportData } from '../DatabaseService';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SyncStatus {
  status: 'idle' | 'uploading' | 'downloading' | 'merging' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
  lastSyncAt?: Date;
}

export interface SyncResult {
  success: boolean;
  recordsAdded: number;
  recordsUpdated: number;
  error?: string;
}

export interface FriendSyncPreference {
  autoSync: boolean;
}

type SyncStatusListener = (status: SyncStatus) => void;

class CloudSyncServiceClass {
  private syncStatusListeners: Set<SyncStatusListener> = new Set();
  private currentStatus: SyncStatus = {
    status: 'idle',
    progress: 0,
    message: 'Ready to sync',
  };
  private realtimeChannels: RealtimeChannel[] = [];
  private syncInProgress = false;
  private autoSyncEnabled = false;
  private autoSyncUnsubscribe: (() => void) | null = null;
  private autoUploadEnabled = true; // Default to enabled
  private autoUploadTimeout: ReturnType<typeof setTimeout> | null = null;
  private autoUploadDebounceMs = 3000; // Wait 3 seconds before uploading to batch changes

  // Multi-device sync for own data
  private autoSyncOwnDevicesEnabled = false;
  private autoSyncOwnDevicesUnsubscribe: (() => void) | null = null;
  private ownDevicesRealtimeChannel: RealtimeChannel | null = null;

  constructor() {
    // Load auto-sync preference from localStorage
    const savedAutoSync = localStorage.getItem('cloudSync_autoEnabled');
    this.autoSyncEnabled = savedAutoSync === 'true';

    // Load auto-upload preference from localStorage (default to true)
    const savedAutoUpload = localStorage.getItem('cloudSync_autoUploadEnabled');
    this.autoUploadEnabled = savedAutoUpload !== 'false'; // Default true unless explicitly disabled

    // Load auto-sync own devices preference (default to true)
    const savedAutoSyncOwn = localStorage.getItem('cloudSync_autoSyncOwnDevices');
    this.autoSyncOwnDevicesEnabled = savedAutoSyncOwn !== 'false'; // Default true unless explicitly disabled
  }

  async uploadLocalData(): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Cloud features not configured' };
    }

    if (this.syncInProgress) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Sync already in progress' };
    }

    this.syncInProgress = true;
    this.updateStatus({ status: 'uploading', progress: 0, message: 'Preparing local data...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const localData = await dbService.exportData();
      this.updateStatus({ status: 'uploading', progress: 5, message: 'Exporting local database...' });

      // Fetch tombstones to exclude deleted matches from upload
      this.updateStatus({ status: 'uploading', progress: 10, message: 'Checking for deleted matches...' });
      const tombstones = await this.getOwnTombstones();
      const tombstoneSet = new Set(tombstones);

      // Filter out tombstoned matches and their players
      const matchesToUpload = localData.matches.filter(m => !tombstoneSet.has(m.id));
      const matchIdsToUpload = new Set(matchesToUpload.map(m => m.id));
      const matchPlayersToUpload = localData.matchPlayers.filter(mp => matchIdsToUpload.has(mp.matchId));

      if (tombstones.length > 0) {
        console.log(`[CloudSyncService] Skipping ${localData.matches.length - matchesToUpload.length} tombstoned matches`);
      }

      const deviceId = this.getDeviceId();
      let recordsAdded = 0;

      // Upload players
      this.updateStatus({ status: 'uploading', progress: 20, message: `Uploading ${localData.players.length} players...` });
      for (let i = 0; i < localData.players.length; i++) {
        const player = localData.players[i];
        const { error } = await supabase
          .from('cloud_players')
          .upsert({
            owner_id: user.id,
            local_id: player.id,
            name: player.name,
            total_games: player.totalGames,
            wins: player.wins,
            losses: player.losses,
            elo: player.elo,
            mu: player.mu,
            sigma: player.sigma,
            ordinal: player.ordinal,
            last_played: player.lastPlayed,
            date_created: player.dateCreated,
            device_id: player.deviceId || deviceId,
            level: player.level,
            sync_source: 'local',
            synced_at: new Date().toISOString(),
          }, {
            onConflict: 'owner_id,local_id',
          });

        if (!error) recordsAdded++;
        this.updateStatus({
          status: 'uploading',
          progress: 20 + Math.floor((i / localData.players.length) * 20),
          message: `Uploading players (${i + 1}/${localData.players.length})...`
        });
      }

      // Upload matches (excluding tombstoned ones)
      this.updateStatus({ status: 'uploading', progress: 40, message: `Uploading ${matchesToUpload.length} matches...` });
      for (let i = 0; i < matchesToUpload.length; i++) {
        const match = matchesToUpload[i];
        const { error } = await supabase
          .from('cloud_matches')
          .upsert({
            id: match.id,
            owner_id: user.id,
            date: match.date,
            winning_team: match.winningTeam.toLowerCase(),
            game_length: match.gameLength.toLowerCase(),
            double_lanes: match.doubleLanes,
            titan_players: match.titanPlayers,
            atlantean_players: match.atlanteanPlayers,
            device_id: match.deviceId || deviceId,
            sync_source: 'local',
            synced_at: new Date().toISOString(),
          }, {
            onConflict: 'owner_id,id',
          });

        if (!error) recordsAdded++;
        this.updateStatus({
          status: 'uploading',
          progress: 40 + Math.floor((i / Math.max(matchesToUpload.length, 1)) * 30),
          message: `Uploading matches (${i + 1}/${matchesToUpload.length})...`
        });
      }

      // Upload match players (excluding those from tombstoned matches)
      this.updateStatus({ status: 'uploading', progress: 70, message: `Uploading ${matchPlayersToUpload.length} match details...` });
      for (let i = 0; i < matchPlayersToUpload.length; i++) {
        const mp = matchPlayersToUpload[i];
        const { error } = await supabase
          .from('cloud_match_players')
          .upsert({
            id: mp.id,
            owner_id: user.id,
            match_id: mp.matchId,
            player_id: mp.playerId,
            team: mp.team.toLowerCase(),
            hero_id: mp.heroId,
            hero_name: mp.heroName,
            hero_roles: mp.heroRoles,
            kills: mp.kills,
            deaths: mp.deaths,
            assists: mp.assists,
            gold_earned: mp.goldEarned,
            minion_kills: mp.minionKills,
            level: mp.level,
            device_id: mp.deviceId || deviceId,
            sync_source: 'local',
            synced_at: new Date().toISOString(),
          }, {
            onConflict: 'owner_id,id',
          });

        if (!error) recordsAdded++;
        this.updateStatus({
          status: 'uploading',
          progress: 70 + Math.floor((i / Math.max(matchPlayersToUpload.length, 1)) * 25),
          message: `Uploading match details (${i + 1}/${matchPlayersToUpload.length})...`
        });
      }

      // Update last sync timestamp
      await supabase
        .from('profiles')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', user.id);

      const lastSyncAt = new Date();
      localStorage.setItem('cloudSync_lastSync', lastSyncAt.toISOString());

      this.updateStatus({
        status: 'complete',
        progress: 100,
        message: `Upload complete! ${recordsAdded} records synced.`,
        lastSyncAt,
      });

      this.syncInProgress = false;
      return { success: true, recordsAdded, recordsUpdated: 0 };
    } catch (error) {
      console.error('[CloudSyncService] Upload error:', error);
      this.updateStatus({
        status: 'error',
        progress: 0,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.syncInProgress = false;
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: String(error) };
    }
  }

  /**
   * Sync data from friends
   * @param selectedFriendIds Optional array of friend IDs to sync from. If not provided, syncs from all friends.
   */
  async syncFromFriends(selectedFriendIds?: string[]): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Cloud features not configured' };
    }

    if (this.syncInProgress) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Sync already in progress' };
    }

    this.syncInProgress = true;
    this.updateStatus({ status: 'downloading', progress: 0, message: 'Fetching friend data...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      let friendIds: string[];

      if (selectedFriendIds && selectedFriendIds.length > 0) {
        // Use the provided friend IDs
        friendIds = selectedFriendIds;
      } else {
        // Get list of all friends
        const { data: friendsData } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', user.id);

        friendIds = (friendsData || []).map(f => f.friend_id);
      }

      if (friendIds.length === 0) {
        this.updateStatus({
          status: 'complete',
          progress: 100,
          message: 'No friends to sync from',
          lastSyncAt: new Date(),
        });
        this.syncInProgress = false;
        return { success: true, recordsAdded: 0, recordsUpdated: 0 };
      }

      this.updateStatus({ status: 'downloading', progress: 20, message: `Downloading from ${friendIds.length} friend${friendIds.length === 1 ? '' : 's'}...` });

      // Download players from friends
      const { data: friendPlayers } = await supabase
        .from('cloud_players')
        .select('*')
        .in('owner_id', friendIds);

      this.updateStatus({ status: 'downloading', progress: 40, message: 'Downloading matches...' });

      // Download matches from friends
      const { data: friendMatches } = await supabase
        .from('cloud_matches')
        .select('*')
        .in('owner_id', friendIds);

      this.updateStatus({ status: 'downloading', progress: 60, message: 'Downloading match details...' });

      // Download match players from friends
      const { data: friendMatchPlayers } = await supabase
        .from('cloud_match_players')
        .select('*')
        .in('owner_id', friendIds);

      this.updateStatus({ status: 'merging', progress: 70, message: 'Merging data...' });

      // Convert to local format and merge
      const importData: ExportData = {
        players: (friendPlayers || []).map(p => this.cloudPlayerToLocal(p)),
        matches: (friendMatches || []).map(m => this.cloudMatchToLocal(m)),
        matchPlayers: (friendMatchPlayers || []).map(mp => this.cloudMatchPlayerToLocal(mp)),
        exportDate: new Date(),
        version: 4,
      };

      // Use existing merge logic
      const success = await dbService.mergeData(importData);

      const lastSyncAt = new Date();
      localStorage.setItem('cloudSync_lastSync', lastSyncAt.toISOString());

      this.updateStatus({
        status: 'complete',
        progress: 100,
        message: `Sync complete! Merged data from ${friendIds.length} friends.`,
        lastSyncAt,
      });

      this.syncInProgress = false;
      return {
        success,
        recordsAdded: importData.players.length + importData.matches.length,
        recordsUpdated: 0,
      };
    } catch (error) {
      console.error('[CloudSyncService] Sync error:', error);
      this.updateStatus({
        status: 'error',
        progress: 0,
        message: 'Sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.syncInProgress = false;
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: String(error) };
    }
  }

  subscribeToFriendUpdates(onUpdate: () => void): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const matchesChannel = supabase
      .channel('friend_matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cloud_matches',
        },
        () => {
          console.log('[CloudSyncService] Friend match update detected');
          onUpdate();
        }
      )
      .subscribe();

    this.realtimeChannels.push(matchesChannel);

    return () => {
      this.realtimeChannels.forEach(channel => {
        supabase?.removeChannel(channel);
      });
      this.realtimeChannels = [];
    };
  }

  setAutoSync(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
    localStorage.setItem('cloudSync_autoEnabled', String(enabled));

    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  isAutoSyncEnabled(): boolean {
    return this.autoSyncEnabled;
  }

  setAutoUpload(enabled: boolean): void {
    this.autoUploadEnabled = enabled;
    localStorage.setItem('cloudSync_autoUploadEnabled', String(enabled));
  }

  isAutoUploadEnabled(): boolean {
    return this.autoUploadEnabled;
  }

  // Per-friend sync preference methods
  private readonly FRIEND_PREFS_KEY = 'cloudSync_friendPreferences';

  getFriendSyncPreferences(): Record<string, FriendSyncPreference> {
    const saved = localStorage.getItem(this.FRIEND_PREFS_KEY);
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  }

  setFriendSyncPreference(friendId: string, autoSync: boolean): void {
    const prefs = this.getFriendSyncPreferences();
    prefs[friendId] = { autoSync };
    localStorage.setItem(this.FRIEND_PREFS_KEY, JSON.stringify(prefs));
  }

  isFriendAutoSyncEnabled(friendId: string): boolean {
    const prefs = this.getFriendSyncPreferences();
    // Default to true for new friends
    return prefs[friendId]?.autoSync ?? true;
  }

  getAutoSyncFriendIds(allFriendIds: string[]): string[] {
    const prefs = this.getFriendSyncPreferences();
    return allFriendIds.filter(id => prefs[id]?.autoSync ?? true);
  }

  /**
   * Trigger an auto-upload if enabled. Debounced to batch multiple changes.
   * Call this after recording matches, adding players, etc.
   */
  triggerAutoUpload(): void {
    if (!this.autoUploadEnabled) {
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      return;
    }

    // Clear any existing timeout
    if (this.autoUploadTimeout) {
      clearTimeout(this.autoUploadTimeout);
    }

    // Debounce the upload to batch changes
    this.autoUploadTimeout = setTimeout(async () => {
      // Check if user is authenticated before uploading
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !this.syncInProgress) {
        console.log('[CloudSyncService] Auto-uploading data...');
        await this.uploadLocalData();
      }
    }, this.autoUploadDebounceMs);
  }

  /**
   * Download user's own cloud data from other devices.
   * Filters to only get records NOT from the current device.
   * Also applies tombstones to delete any locally deleted matches.
   */
  async downloadOwnCloudData(): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Cloud features not configured' };
    }

    if (this.syncInProgress) {
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: 'Sync already in progress' };
    }

    this.syncInProgress = true;
    this.updateStatus({ status: 'downloading', progress: 0, message: 'Downloading your data from cloud...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const currentDeviceId = this.getDeviceId();

      // Fetch tombstones first to know which matches to skip/delete
      this.updateStatus({ status: 'downloading', progress: 10, message: 'Checking for deleted matches...' });
      const tombstones = await this.getOwnTombstones();
      const tombstoneSet = new Set(tombstones);

      this.updateStatus({ status: 'downloading', progress: 20, message: 'Downloading players from other devices...' });

      // Download players owned by self but from OTHER devices
      const { data: ownPlayers } = await supabase
        .from('cloud_players')
        .select('*')
        .eq('owner_id', user.id)
        .neq('device_id', currentDeviceId);

      this.updateStatus({ status: 'downloading', progress: 40, message: 'Downloading matches from other devices...' });

      // Download matches owned by self but from OTHER devices
      const { data: ownMatches } = await supabase
        .from('cloud_matches')
        .select('*')
        .eq('owner_id', user.id)
        .neq('device_id', currentDeviceId);

      this.updateStatus({ status: 'downloading', progress: 60, message: 'Downloading match details from other devices...' });

      // Download match players owned by self but from OTHER devices
      const { data: ownMatchPlayers } = await supabase
        .from('cloud_match_players')
        .select('*')
        .eq('owner_id', user.id)
        .neq('device_id', currentDeviceId);

      this.updateStatus({ status: 'merging', progress: 70, message: 'Applying deletions...' });

      // Apply tombstones - delete any local matches that have been deleted elsewhere
      const deletedCount = await this.applyTombstonesToLocal(tombstones);
      if (deletedCount > 0) {
        console.log(`[CloudSyncService] Applied ${deletedCount} tombstones`);
      }

      this.updateStatus({ status: 'merging', progress: 80, message: 'Merging data...' });

      // Filter downloaded matches against tombstones (skip tombstoned matches)
      const filteredMatches = (ownMatches || []).filter(m => !tombstoneSet.has(m.id));
      const filteredMatchIds = new Set(filteredMatches.map(m => m.id));
      const filteredMatchPlayers = (ownMatchPlayers || []).filter(mp => filteredMatchIds.has(mp.match_id));

      // Convert to local format
      const importData: ExportData = {
        players: (ownPlayers || []).map(p => this.cloudPlayerToLocal(p)),
        matches: filteredMatches.map(m => this.cloudMatchToLocal(m)),
        matchPlayers: filteredMatchPlayers.map(mp => this.cloudMatchPlayerToLocal(mp)),
        exportDate: new Date(),
        version: 4,
      };

      // Use existing merge logic (ID-based: adds new, skips existing)
      const success = await dbService.mergeData(importData);

      const lastSyncAt = new Date();
      localStorage.setItem('cloudSync_lastOwnSync', lastSyncAt.toISOString());

      const recordsCount = importData.players.length + importData.matches.length + importData.matchPlayers.length;

      this.updateStatus({
        status: 'complete',
        progress: 100,
        message: recordsCount > 0 || deletedCount > 0
          ? `Synced: ${recordsCount} records downloaded${deletedCount > 0 ? `, ${deletedCount} deleted` : ''}.`
          : 'No new data found from other devices.',
        lastSyncAt,
      });

      this.syncInProgress = false;
      return { success, recordsAdded: recordsCount, recordsUpdated: deletedCount };
    } catch (error) {
      console.error('[CloudSyncService] Download own data error:', error);
      this.updateStatus({
        status: 'error',
        progress: 0,
        message: 'Download failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.syncInProgress = false;
      return { success: false, recordsAdded: 0, recordsUpdated: 0, error: String(error) };
    }
  }

  /**
   * Subscribe to realtime changes in user's own cloud data.
   * Only triggers on changes from OTHER devices (not this one).
   */
  subscribeToOwnDeviceUpdates(onUpdate: (deviceId: string) => void): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    // Subscribe to cloud_matches table for own data changes
    this.ownDevicesRealtimeChannel = supabase
      .channel('own_device_sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cloud_matches',
        },
        async (payload) => {
          if (!supabase) return;
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const record = payload.new as Record<string, unknown>;
          const recordOwnerId = record.owner_id as string;
          const recordDeviceId = record.device_id as string;
          const currentDeviceId = this.getDeviceId();

          // Only trigger if:
          // 1. Record belongs to current user
          // 2. Record was NOT created by current device
          if (recordOwnerId === user.id && recordDeviceId !== currentDeviceId) {
            console.log('[CloudSyncService] Own data change detected from device:', recordDeviceId);
            onUpdate(recordDeviceId);
          }
        }
      )
      .subscribe();

    return () => {
      if (this.ownDevicesRealtimeChannel) {
        supabase?.removeChannel(this.ownDevicesRealtimeChannel);
        this.ownDevicesRealtimeChannel = null;
      }
    };
  }

  // Auto-sync own devices toggle methods
  setAutoSyncOwnDevices(enabled: boolean): void {
    this.autoSyncOwnDevicesEnabled = enabled;
    localStorage.setItem('cloudSync_autoSyncOwnDevices', String(enabled));

    if (enabled) {
      this.startAutoSyncOwnDevices();
    } else {
      this.stopAutoSyncOwnDevices();
    }
  }

  isAutoSyncOwnDevicesEnabled(): boolean {
    return this.autoSyncOwnDevicesEnabled;
  }

  getLastOwnSyncTime(): Date | null {
    const saved = localStorage.getItem('cloudSync_lastOwnSync');
    return saved ? new Date(saved) : null;
  }

  /**
   * Fetch tombstones (deleted match IDs) for the current user.
   * Used to prevent re-syncing of deleted matches.
   */
  async getOwnTombstones(): Promise<string[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: tombstones } = await supabase
        .from('deleted_matches')
        .select('match_id')
        .eq('owner_id', user.id);

      return (tombstones || []).map(t => t.match_id);
    } catch (error) {
      console.error('[CloudSyncService] Error fetching tombstones:', error);
      return [];
    }
  }

  /**
   * Delete a match from cloud storage and create a tombstone.
   * This ensures the match won't be re-synced to other devices.
   */
  async deleteMatchFromCloud(matchId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Cloud features not configured' };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const deviceId = this.getDeviceId();

      // 1. Delete match players from cloud
      await supabase
        .from('cloud_match_players')
        .delete()
        .eq('owner_id', user.id)
        .eq('match_id', matchId);

      // 2. Delete match from cloud
      await supabase
        .from('cloud_matches')
        .delete()
        .eq('owner_id', user.id)
        .eq('id', matchId);

      // 3. Insert tombstone (upsert to handle duplicates)
      const { error: tombstoneError } = await supabase
        .from('deleted_matches')
        .upsert({
          owner_id: user.id,
          match_id: matchId,
          deleted_at: new Date().toISOString(),
          device_id: deviceId,
        }, {
          onConflict: 'owner_id,match_id',
        });

      if (tombstoneError) {
        console.error('[CloudSyncService] Tombstone insert error:', tombstoneError);
        // Don't fail the whole operation if tombstone fails - cloud deletion still succeeded
      }

      console.log('[CloudSyncService] Match deleted from cloud:', matchId);
      return { success: true };
    } catch (error) {
      console.error('[CloudSyncService] Delete from cloud error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Apply tombstones to local database - delete any matches that have been tombstoned.
   * Returns the count of deleted matches.
   */
  async applyTombstonesToLocal(tombstones: string[]): Promise<number> {
    if (tombstones.length === 0) return 0;

    let deletedCount = 0;
    for (const matchId of tombstones) {
      // Check if match exists locally
      const localMatch = await dbService.getMatch(matchId);
      if (localMatch) {
        // Delete locally without triggering cloud deletion again
        await dbService.deleteMatchAndPlayersOnly(matchId);
        deletedCount++;
        console.log('[CloudSyncService] Applied tombstone - deleted local match:', matchId);
      }
    }

    // Recalculate stats if any matches were deleted
    if (deletedCount > 0) {
      await dbService.recalculatePlayerStats();
    }

    return deletedCount;
  }

  private startAutoSyncOwnDevices(): void {
    if (this.autoSyncOwnDevicesUnsubscribe) return;

    this.autoSyncOwnDevicesUnsubscribe = this.subscribeToOwnDeviceUpdates(async (sourceDeviceId) => {
      // Debounce to avoid excessive calls
      setTimeout(async () => {
        if (this.autoSyncOwnDevicesEnabled && !this.syncInProgress) {
          console.log('[CloudSyncService] Auto-syncing from device:', sourceDeviceId);
          await this.downloadOwnCloudData();
        }
      }, 2000);
    });
  }

  private stopAutoSyncOwnDevices(): void {
    if (this.autoSyncOwnDevicesUnsubscribe) {
      this.autoSyncOwnDevicesUnsubscribe();
      this.autoSyncOwnDevicesUnsubscribe = null;
    }
  }

  private startAutoSync(): void {
    if (this.autoSyncUnsubscribe) return;

    this.autoSyncUnsubscribe = this.subscribeToFriendUpdates(async () => {
      // Debounce auto-sync to avoid excessive calls
      setTimeout(async () => {
        if (this.autoSyncEnabled && !this.syncInProgress && supabase) {
          // Get all friend IDs first
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: friendsData } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', user.id);

          const allFriendIds = (friendsData || []).map(f => f.friend_id);

          // Filter to only friends with auto-sync enabled
          const autoSyncFriendIds = this.getAutoSyncFriendIds(allFriendIds);

          if (autoSyncFriendIds.length > 0) {
            this.syncFromFriends(autoSyncFriendIds);
          }
        }
      }, 2000);
    });
  }

  private stopAutoSync(): void {
    if (this.autoSyncUnsubscribe) {
      this.autoSyncUnsubscribe();
      this.autoSyncUnsubscribe = null;
    }
  }

  onStatusChange(listener: SyncStatusListener): () => void {
    this.syncStatusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.syncStatusListeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  getLastSyncTime(): Date | null {
    const saved = localStorage.getItem('cloudSync_lastSync');
    return saved ? new Date(saved) : null;
  }

  private updateStatus(status: Partial<SyncStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...status };
    this.syncStatusListeners.forEach(listener => listener(this.currentStatus));
  }

  private getDeviceId(): string {
    const storageKey = 'guards-of-atlantis-device-id';
    return localStorage.getItem(storageKey) || 'unknown';
  }

  private cloudPlayerToLocal(cloudPlayer: Record<string, unknown>): DBPlayer {
    return {
      id: cloudPlayer.local_id as string,
      name: cloudPlayer.name as string,
      totalGames: cloudPlayer.total_games as number,
      wins: cloudPlayer.wins as number,
      losses: cloudPlayer.losses as number,
      elo: cloudPlayer.elo as number,
      mu: cloudPlayer.mu as number | undefined,
      sigma: cloudPlayer.sigma as number | undefined,
      ordinal: cloudPlayer.ordinal as number | undefined,
      lastPlayed: new Date(cloudPlayer.last_played as string),
      dateCreated: new Date(cloudPlayer.date_created as string),
      deviceId: cloudPlayer.device_id as string | undefined,
      level: cloudPlayer.level as number | undefined,
    };
  }

  private cloudMatchToLocal(cloudMatch: Record<string, unknown>): DBMatch {
    // Keep values lowercase to match Team and GameLength enum values
    const winningTeam = (cloudMatch.winning_team as string).toLowerCase();
    const gameLength = (cloudMatch.game_length as string).toLowerCase();

    return {
      id: cloudMatch.id as string,
      date: new Date(cloudMatch.date as string),
      winningTeam: winningTeam as DBMatch['winningTeam'],
      gameLength: gameLength as DBMatch['gameLength'],
      doubleLanes: cloudMatch.double_lanes as boolean,
      titanPlayers: cloudMatch.titan_players as number,
      atlanteanPlayers: cloudMatch.atlantean_players as number,
      deviceId: cloudMatch.device_id as string | undefined,
    };
  }

  private cloudMatchPlayerToLocal(cloudMp: Record<string, unknown>): DBMatchPlayer {
    // Keep team lowercase to match Team enum values
    const team = (cloudMp.team as string).toLowerCase();

    return {
      id: cloudMp.id as string,
      matchId: cloudMp.match_id as string,
      playerId: cloudMp.player_id as string,
      team: team as DBMatchPlayer['team'],
      heroId: cloudMp.hero_id as number,
      heroName: cloudMp.hero_name as string,
      heroRoles: cloudMp.hero_roles as string[],
      kills: cloudMp.kills as number | undefined,
      deaths: cloudMp.deaths as number | undefined,
      assists: cloudMp.assists as number | undefined,
      goldEarned: cloudMp.gold_earned as number | undefined,
      minionKills: cloudMp.minion_kills as number | undefined,
      level: cloudMp.level as number | undefined,
      deviceId: cloudMp.device_id as string | undefined,
    };
  }
}

export const CloudSyncService = new CloudSyncServiceClass();
