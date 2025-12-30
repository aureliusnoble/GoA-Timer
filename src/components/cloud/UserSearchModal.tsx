import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus, Check, Loader2 } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { FriendService, UserProfile } from '../../services/supabase/FriendService';

interface UserSearchModalProps {
  onClose: () => void;
  onRequestSent: () => void;
  existingFriendIds: string[];
  pendingRequestIds: string[];
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({
  onClose,
  onRequestSent,
  existingFriendIds,
  pendingRequestIds,
}) => {
  const { playSound } = useSound();
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      const users = await FriendService.searchUsers(query);
      setResults(users);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSendRequest = async (userId: string) => {
    playSound('buttonClick');
    setError(null);
    setSendingToId(userId);

    const result = await FriendService.sendFriendRequest(userId);

    if (result.success) {
      playSound('phaseChange');
      setSentIds(new Set([...sentIds, userId]));
      onRequestSent();
    } else {
      setError(result.error || 'Failed to send request');
    }

    setSendingToId(null);
  };

  const getButtonContent = (user: UserProfile) => {
    const isFriend = existingFriendIds.includes(user.id);
    const isPending = pendingRequestIds.includes(user.id);
    const isSent = sentIds.has(user.id);
    const isSending = sendingToId === user.id;

    if (isFriend) {
      return (
        <span className="text-green-500 text-xs flex items-center">
          <Check size={14} className="mr-1" />
          Friends
        </span>
      );
    }

    if (isPending || isSent) {
      return (
        <span className="text-orange-400 text-xs flex items-center">
          <Check size={14} className="mr-1" />
          Pending
        </span>
      );
    }

    if (isSending) {
      return <Loader2 size={16} className="animate-spin text-orange-400" />;
    }

    return (
      <button
        onClick={() => handleSendRequest(user.id)}
        className="p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors"
        title="Send friend request"
      >
        <UserPlus size={16} />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg w-full max-w-md shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Find Friends</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            {isSearching && (
              <Loader2
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-orange-400"
              />
            )}
          </div>

          {error && (
            <div className="mt-2 bg-red-900/50 border border-red-700 rounded p-2">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {query.length < 2 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              Type at least 2 characters to search
            </p>
          ) : results.length === 0 && !isSearching ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No users found matching "{query}"
            </p>
          ) : (
            <div className="px-4 pb-4 space-y-2">
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg p-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-gray-400">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {user.displayName || user.username}
                      </p>
                      <p className="text-gray-500 text-xs">@{user.username}</p>
                    </div>
                  </div>
                  {getButtonContent(user)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserSearchModal;
