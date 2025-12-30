import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  Bell,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download
} from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { FriendService, Friend, FriendRequest } from '../../services/supabase/FriendService';
import { CloudSyncService } from '../../services/supabase/CloudSyncService';
import FriendRequestsPanel from './FriendRequestsPanel';
import UserSearchModal from './UserSearchModal';

interface FriendsPanelProps {
  onPendingCountChange?: (count: number) => void;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ onPendingCountChange }) => {
  const { playSound } = useSound();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [syncingFriendId, setSyncingFriendId] = useState<string | null>(null);
  const [syncPreferences, setSyncPreferences] = useState<Record<string, { autoSync: boolean }>>(
    CloudSyncService.getFriendSyncPreferences()
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friendsList, pending, sent] = await Promise.all([
        FriendService.getFriends(),
        FriendService.getPendingRequests(),
        FriendService.getSentRequests(),
      ]);
      setFriends(friendsList);
      setPendingRequests(pending);
      setSentRequests(sent);
      onPendingCountChange?.(pending.length);
    } catch (error) {
      console.error('[FriendsPanel] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    loadData();

    // Subscribe to real-time updates
    const unsubscribe = FriendService.subscribeToRequests(
      () => loadData(),
      () => loadData()
    );

    return unsubscribe;
  }, [loadData]);

  const handleRemoveFriend = async (friendUserId: string) => {
    playSound('buttonClick');
    setRemovingFriendId(friendUserId);
    const result = await FriendService.removeFriend(friendUserId);
    if (result.success) {
      setFriends(friends.filter(f => f.friendProfile.id !== friendUserId));
    }
    setRemovingFriendId(null);
  };

  const handleToggleFriendSync = (friendId: string) => {
    playSound('toggleSwitch');
    const currentAutoSync = syncPreferences[friendId]?.autoSync ?? true;
    const newAutoSync = !currentAutoSync;
    CloudSyncService.setFriendSyncPreference(friendId, newAutoSync);
    setSyncPreferences({
      ...syncPreferences,
      [friendId]: { autoSync: newAutoSync }
    });
  };

  const isFriendAutoSyncEnabled = (friendId: string): boolean => {
    return syncPreferences[friendId]?.autoSync ?? true;
  };

  const handleSyncFromFriend = async (friendId: string) => {
    playSound('buttonClick');
    setSyncingFriendId(friendId);
    await CloudSyncService.syncFromFriends([friendId]);
    setSyncingFriendId(null);
  };

  const handleRequestAction = async () => {
    await loadData();
  };

  const filteredFriends = friends.filter(friend =>
    friend.friendProfile.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.friendProfile.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={24} className="animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Friend Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Users size={20} className="mr-2" />
          Friends ({friends.length})
        </h3>
        <button
          onClick={() => {
            playSound('buttonClick');
            setShowSearchModal(true);
          }}
          className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded transition-colors"
          title="Add Friend"
        >
          <UserPlus size={18} />
        </button>
      </div>

      {/* Friend Requests Section */}
      {(pendingRequests.length > 0 || sentRequests.length > 0) && (
        <button
          onClick={() => {
            playSound('buttonClick');
            setShowRequests(!showRequests);
          }}
          className="w-full flex items-center justify-between bg-orange-900/50 hover:bg-orange-900/70 border border-orange-700 rounded-lg p-3 transition-colors"
        >
          <div className="flex items-center">
            <Bell size={18} className="text-orange-400 mr-2" />
            <span className="text-white">
              Friend Requests
              {pendingRequests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingRequests.length} new
                </span>
              )}
            </span>
          </div>
          {showRequests ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </button>
      )}

      {showRequests && (
        <FriendRequestsPanel
          pendingRequests={pendingRequests}
          sentRequests={sentRequests}
          onAction={handleRequestAction}
        />
      )}

      {/* Search Friends */}
      {friends.length > 3 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-2">
        {filteredFriends.length === 0 ? (
          <div className="text-center py-8">
            <Users size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400">
              {friends.length === 0
                ? 'No friends yet'
                : 'No friends match your search'}
            </p>
            {friends.length === 0 && (
              <button
                onClick={() => {
                  playSound('buttonClick');
                  setShowSearchModal(true);
                }}
                className="mt-3 text-orange-400 hover:text-orange-300 text-sm"
              >
                Add your first friend
              </button>
            )}
          </div>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center justify-between bg-gray-800 rounded-lg p-3"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                  {friend.friendProfile.avatarUrl ? (
                    <img
                      src={friend.friendProfile.avatarUrl}
                      alt={friend.friendProfile.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-gray-400">
                      {friend.friendProfile.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">
                    {friend.friendProfile.displayName || friend.friendProfile.username}
                  </p>
                  <p className="text-gray-500 text-xs">@{friend.friendProfile.username}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {/* Manual sync button */}
                <button
                  onClick={() => handleSyncFromFriend(friend.friendProfile.id)}
                  disabled={syncingFriendId === friend.friendProfile.id}
                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  title="Sync from this friend"
                >
                  {syncingFriendId === friend.friendProfile.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
                {/* Auto-sync toggle */}
                <button
                  onClick={() => handleToggleFriendSync(friend.friendProfile.id)}
                  className={`p-2 rounded transition-colors ${
                    isFriendAutoSyncEnabled(friend.friendProfile.id)
                      ? 'text-orange-400 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-700 hover:text-gray-400'
                  }`}
                  title={isFriendAutoSyncEnabled(friend.friendProfile.id)
                    ? 'Auto-sync enabled (click to disable)'
                    : 'Auto-sync disabled (click to enable)'}
                >
                  <RefreshCw size={16} />
                </button>
                {/* Remove friend button */}
                <button
                  onClick={() => handleRemoveFriend(friend.friendProfile.id)}
                  disabled={removingFriendId === friend.friendProfile.id}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                  title="Remove friend"
                >
                  {removingFriendId === friend.friendProfile.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <UserMinus size={16} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User Search Modal */}
      {showSearchModal && (
        <UserSearchModal
          onClose={() => setShowSearchModal(false)}
          onRequestSent={loadData}
          existingFriendIds={friends.map(f => f.friendProfile.id)}
          pendingRequestIds={[
            ...pendingRequests.map(r => r.fromUserId),
            ...sentRequests.map(r => r.toUserId),
          ]}
        />
      )}
    </div>
  );
};

export default FriendsPanel;
