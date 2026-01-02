import React, { useState, useEffect } from 'react';
import {
  Share2,
  Plus,
  Loader2,
  AlertCircle,
  X,
  UserX,
  Calendar,
  Info,
} from 'lucide-react';
import {
  ShareService,
  ShareLink,
  CreateShareLinkOptions,
} from '../../services/supabase/ShareService';
import { useSound } from '../../context/SoundContext';
import ShareLinkCard from './ShareLinkCard';

type ExpirationPreset = 'never' | '1day' | '7days' | '30days' | 'custom';

const SharePanel: React.FC = () => {
  const { playSound } = useSound();

  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>('never');
  const [customExpirationDate, setCustomExpirationDate] = useState('');
  const [isAnonymized, setIsAnonymized] = useState(false);

  // Load existing share links on mount
  useEffect(() => {
    const loadShareLinks = async () => {
      setIsLoading(true);
      const links = await ShareService.getMyShareLinks();
      setShareLinks(links);
      setIsLoading(false);
    };

    loadShareLinks();
  }, []);

  const calculateExpirationDate = (): Date | undefined => {
    const now = new Date();

    switch (expirationPreset) {
      case 'never':
        return undefined;
      case '1day':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '7days':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case '30days':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      case 'custom':
        return customExpirationDate ? new Date(customExpirationDate) : undefined;
      default:
        return undefined;
    }
  };

  const handleCreateLink = async () => {
    playSound('buttonClick');
    setIsCreating(true);
    setError(null);

    const options: CreateShareLinkOptions = {
      label: newLinkLabel.trim() || undefined,
      expiresAt: calculateExpirationDate(),
      isAnonymized,
    };

    const result = await ShareService.createShareLink(options);

    if (result.success && result.shareLink) {
      setShareLinks((prev) => [...prev, result.shareLink!]);
      setShowCreateModal(false);
      resetCreateForm();
    } else {
      setError(result.error || 'Failed to create share link');
    }

    setIsCreating(false);
  };

  const resetCreateForm = () => {
    setNewLinkLabel('');
    setExpirationPreset('never');
    setCustomExpirationDate('');
    setIsAnonymized(false);
  };

  const handleUpdateLink = (updatedLink: ShareLink) => {
    setShareLinks((prev) =>
      prev.map((link) => (link.id === updatedLink.id ? updatedLink : link))
    );
  };

  const handleExpireLink = async (linkId: string) => {
    const result = await ShareService.expireShareLink(linkId);
    if (result.success) {
      // Refresh links to get updated state
      const links = await ShareService.getMyShareLinks();
      setShareLinks(links);
    } else {
      setError(result.error || 'Failed to expire link');
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    const result = await ShareService.deleteShareLink(linkId);
    if (result.success) {
      setShareLinks((prev) => prev.filter((link) => link.id !== linkId));
    } else {
      setError(result.error || 'Failed to delete link');
    }
  };

  const canCreateMore = shareLinks.length < 3;

  // Get minimum date for custom expiration (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={24} className="animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Share2 size={20} className="text-orange-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">Public Sharing</h3>
        </div>
        <p className="text-sm text-gray-400">
          Create shareable links that let anyone view your stats. You can have up to 3 active
          share links with different settings.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm p-3 rounded flex items-center">
          <AlertCircle size={16} className="mr-2 flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Share Links List */}
      {shareLinks.length > 0 ? (
        <div className="space-y-4">
          {shareLinks.map((link, index) => (
            <ShareLinkCard
              key={link.id}
              link={link}
              index={index}
              onUpdate={handleUpdateLink}
              onDelete={handleDeleteLink}
              onExpire={handleExpireLink}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <Share2 size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No share links yet</p>
          <p className="text-gray-500 text-sm">
            Create a share link to let others view your stats
          </p>
        </div>
      )}

      {/* Create New Link Button */}
      <button
        onClick={() => {
          playSound('buttonClick');
          setShowCreateModal(true);
        }}
        disabled={!canCreateMore}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
          canCreateMore
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        <Plus size={18} />
        {canCreateMore ? 'Create New Share Link' : 'Maximum Links Reached (3/3)'}
      </button>

      {/* What's Shared Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">What viewers can see:</h4>
        <ul className="text-sm text-gray-500 space-y-1">
          <li className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            Player statistics and rankings
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            Match history and results
          </li>
          <li className="flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
            Hero performance stats
          </li>
        </ul>
        <p className="text-xs text-gray-600 mt-3">
          Viewers cannot modify your data. You can expire or delete links at any time.
        </p>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Create Share Link</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="e.g., Friends, Discord, Public"
                  maxLength={50}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Calendar size={14} className="inline mr-1" />
                  Expiration
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { value: 'never', label: 'Never' },
                    { value: '1day', label: '1 Day' },
                    { value: '7days', label: '7 Days' },
                    { value: '30days', label: '30 Days' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExpirationPreset(option.value as ExpirationPreset)}
                      className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
                        expirationPreset === option.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setExpirationPreset('custom')}
                  className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors ${
                    expirationPreset === 'custom'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Custom Date
                </button>
                {expirationPreset === 'custom' && (
                  <input
                    type="date"
                    value={customExpirationDate}
                    onChange={(e) => setCustomExpirationDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full mt-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  />
                )}
              </div>

              {/* Anonymize */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserX size={16} className="text-purple-400" />
                    <span className="text-sm font-medium text-gray-300">Anonymize Players</span>
                  </div>
                  <button
                    onClick={() => setIsAnonymized(!isAnonymized)}
                    className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                      isAnonymized ? 'bg-purple-600 justify-end' : 'bg-gray-600 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  Player names will be shown as "Player 1", "Player 2", etc. Your display name will
                  still be visible.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={isCreating || (expirationPreset === 'custom' && !customExpirationDate)}
                className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Link'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharePanel;
