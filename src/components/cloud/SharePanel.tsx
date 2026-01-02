import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, Loader2, Eye, Link, AlertCircle } from 'lucide-react';
import { ShareService, ShareLink } from '../../services/supabase/ShareService';
import { useSound } from '../../context/SoundContext';

const SharePanel: React.FC = () => {
  const { playSound } = useSound();

  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing share link on mount
  useEffect(() => {
    const loadShareLink = async () => {
      setIsLoading(true);
      const link = await ShareService.getMyShareLink();
      setShareLink(link);
      setIsLoading(false);
    };

    loadShareLink();
  }, []);

  const handleToggleSharing = async () => {
    playSound('toggleSwitch');
    setIsToggling(true);
    setError(null);

    if (shareLink?.isActive) {
      // Disable sharing
      const result = await ShareService.disableSharing();
      if (result.success) {
        setShareLink(prev => prev ? { ...prev, isActive: false } : null);
      } else {
        setError(result.error || 'Failed to disable sharing');
      }
    } else {
      // Enable sharing
      const result = await ShareService.enableSharing();
      if (result.success && result.shareLink) {
        setShareLink(result.shareLink);
      } else {
        setError(result.error || 'Failed to enable sharing');
      }
    }

    setIsToggling(false);
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    playSound('buttonClick');
    const url = ShareService.getShareUrl(shareLink.shareToken);

    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const formatViewCount = (count: number): string => {
    if (count === 0) return 'No views yet';
    if (count === 1) return '1 view';
    return `${count} views`;
  };

  const formatLastViewed = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
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
          Create a shareable link that lets anyone with the link view your player stats, match history, and hero statistics.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm p-3 rounded flex items-center">
          <AlertCircle size={16} className="mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Toggle Sharing */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link size={18} className="text-gray-400 mr-3" />
            <div>
              <p className="text-white font-medium">Enable Sharing</p>
              <p className="text-gray-500 text-xs">
                {shareLink?.isActive
                  ? 'Your stats are publicly viewable'
                  : 'Your stats are private'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleSharing}
            disabled={isToggling}
            className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
              shareLink?.isActive
                ? 'bg-orange-600 justify-end'
                : 'bg-gray-600 justify-start'
            }`}
          >
            {isToggling ? (
              <Loader2 size={14} className="animate-spin text-white mx-auto" />
            ) : (
              <div className="bg-white w-4 h-4 rounded-full shadow" />
            )}
          </button>
        </div>
      </div>

      {/* Share URL (only shown when active) */}
      {shareLink?.isActive && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Your share link:</p>
            <button
              onClick={handleCopyLink}
              className="flex items-center text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              {isCopied ? (
                <>
                  <Check size={14} className="mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} className="mr-1" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-900 rounded p-2 break-all">
            <code className="text-xs text-green-400">
              {ShareService.getShareUrl(shareLink.shareToken)}
            </code>
          </div>

          {/* View Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
            <div className="flex items-center">
              <Eye size={14} className="mr-1" />
              {formatViewCount(shareLink.viewCount)}
            </div>
            <div>Last viewed: {formatLastViewed(shareLink.lastViewedAt)}</div>
          </div>
        </div>
      )}

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
          Viewers cannot modify your data. You can disable sharing at any time.
        </p>
      </div>
    </div>
  );
};

export default SharePanel;
