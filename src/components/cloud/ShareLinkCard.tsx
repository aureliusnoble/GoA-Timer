import React, { useState } from 'react';
import {
  Copy,
  Check,
  Eye,
  Clock,
  Trash2,
  XCircle,
  UserX,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { ShareLink, ShareService } from '../../services/supabase/ShareService';
import { useSound } from '../../context/SoundContext';

interface ShareLinkCardProps {
  link: ShareLink;
  index: number;
  onUpdate: (link: ShareLink) => void;
  onDelete: (linkId: string) => void;
  onExpire: (linkId: string) => void;
}

const ShareLinkCard: React.FC<ShareLinkCardProps> = ({
  link,
  index,
  onUpdate,
  onDelete,
  onExpire,
}) => {
  const { playSound } = useSound();
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpireConfirm, setShowExpireConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isExpired = !link.isActive || (link.expiresAt && new Date(link.expiresAt) < new Date());

  const handleCopyLink = async () => {
    playSound('buttonClick');
    const url = ShareService.getShareUrl(link.shareToken);

    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleToggleActive = async () => {
    if (isExpired && !link.isActive) return; // Can't reactivate expired links

    playSound('toggleSwitch');
    setIsUpdating(true);

    const result = await ShareService.updateShareLink(link.id, {
      isActive: !link.isActive,
    });

    if (result.success && result.shareLink) {
      onUpdate(result.shareLink);
    }

    setIsUpdating(false);
  };

  const handleExpire = async () => {
    playSound('buttonClick');
    setShowExpireConfirm(false);
    onExpire(link.id);
  };

  const handleDelete = async () => {
    playSound('buttonClick');
    setShowDeleteConfirm(false);
    onDelete(link.id);
  };

  const formatViewCount = (count: number): string => {
    if (count === 0) return 'No views';
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
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatExpiration = (): { text: string; isExpired: boolean; isWarning: boolean } => {
    if (!link.expiresAt) {
      return { text: 'Never expires', isExpired: false, isWarning: false };
    }

    const expiresAt = new Date(link.expiresAt);
    const now = new Date();

    if (expiresAt < now) {
      return { text: 'Expired', isExpired: true, isWarning: false };
    }

    const diff = expiresAt.getTime() - now.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) {
      return { text: `Expires in ${days}d`, isExpired: false, isWarning: days <= 1 };
    }
    if (hours > 0) {
      return { text: `Expires in ${hours}h`, isExpired: false, isWarning: true };
    }
    const minutes = Math.floor(diff / 60000);
    return { text: `Expires in ${minutes}m`, isExpired: false, isWarning: true };
  };

  const expirationStatus = formatExpiration();
  const displayLabel = link.label || `Link ${index + 1}`;

  return (
    <div
      className={`bg-gray-800 rounded-lg border ${
        isExpired ? 'border-gray-700 opacity-75' : 'border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{displayLabel}</span>
            {link.isAnonymized && (
              <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded flex items-center gap-1">
                <UserX size={12} />
                Anonymous
              </span>
            )}
            {isExpired && (
              <span className="text-xs bg-red-600/30 text-red-300 px-2 py-0.5 rounded">
                {!link.isActive ? 'Inactive' : 'Expired'}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* URL with Copy */}
        {!isExpired && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-gray-900 rounded px-3 py-2 overflow-hidden">
              <code className="text-xs text-green-400 truncate block">
                {ShareService.getShareUrl(link.shareToken)}
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300 transition-colors px-3 py-2 bg-gray-900 rounded"
            >
              {isCopied ? (
                <>
                  <Check size={14} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy
                </>
              )}
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Eye size={14} />
              {formatViewCount(link.viewCount)}
            </div>
            <div>Last viewed: {formatLastViewed(link.lastViewedAt)}</div>
          </div>
          <div
            className={`flex items-center gap-1 ${
              expirationStatus.isExpired
                ? 'text-red-400'
                : expirationStatus.isWarning
                ? 'text-yellow-400'
                : 'text-gray-500'
            }`}
          >
            <Clock size={14} />
            {expirationStatus.text}
          </div>
        </div>
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-3">
          {/* Toggle Active */}
          {!isExpired && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Active</p>
                <p className="text-xs text-gray-500">Link can be accessed by others</p>
              </div>
              <button
                onClick={handleToggleActive}
                disabled={isUpdating}
                className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                  link.isActive ? 'bg-orange-600 justify-end' : 'bg-gray-600 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow" />
              </button>
            </div>
          )}

          {/* Expire Now */}
          {!isExpired && (
            <div>
              {showExpireConfirm ? (
                <div className="bg-red-900/20 border border-red-800 rounded p-3">
                  <div className="flex items-center gap-2 text-red-300 text-sm mb-2">
                    <AlertCircle size={16} />
                    <span>This action cannot be undone</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExpire}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded transition-colors"
                    >
                      Expire Now
                    </button>
                    <button
                      onClick={() => setShowExpireConfirm(false)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowExpireConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm py-2 border border-red-800/50 hover:border-red-700 rounded transition-colors"
                >
                  <XCircle size={16} />
                  Expire This Link
                </button>
              )}
            </div>
          )}

          {/* Delete */}
          <div>
            {showDeleteConfirm ? (
              <div className="bg-red-900/20 border border-red-800 rounded p-3">
                <div className="flex items-center gap-2 text-red-300 text-sm mb-2">
                  <AlertCircle size={16} />
                  <span>Delete this link permanently?</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-400 text-sm py-2 border border-gray-700 hover:border-red-800/50 rounded transition-colors"
              >
                <Trash2 size={16} />
                Delete Link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareLinkCard;
