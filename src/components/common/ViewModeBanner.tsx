import React from 'react';
import { Eye, X, Loader2, AlertCircle, Clock, UserX } from 'lucide-react';
import { useViewMode } from '../../context/ViewModeContext';
import ExpiredLinkPage from './ExpiredLinkPage';

const ViewModeBanner: React.FC = () => {
  const { isViewMode, ownerDisplayName, sharedData, isLoading, error, isExpired, expiredAt, exitViewMode } = useViewMode();

  const formatExpirationDate = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 7) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (days > 0) {
      return `${days}d`;
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours > 0) {
        return `${hours}h`;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      return `${Math.max(1, minutes)}m`;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white py-2 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-sm font-medium">Loading shared stats...</span>
        </div>
      </div>
    );
  }

  // Show expired link page (full screen)
  if (isExpired) {
    return <ExpiredLinkPage expiredAt={expiredAt} onGoHome={exitViewMode} />;
  }

  // Show error state (for non-expired errors)
  if (error && !isExpired) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle size={18} className="mr-2" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={exitViewMode}
            className="flex items-center bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            <X size={16} className="mr-1" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Don't render if not in view mode
  if (!isViewMode) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white py-2 px-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center">
            <Eye size={18} className="mr-2" />
            <span className="text-sm font-medium">
              Viewing <span className="font-bold">{ownerDisplayName}</span>'s Stats
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-blue-700 px-2 py-0.5 rounded">Read-only</span>
            {sharedData?.expiresAt && (
              <span className="text-xs bg-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                <Clock size={12} />
                Expires: {formatExpirationDate(sharedData.expiresAt)}
              </span>
            )}
            {sharedData?.isAnonymized && (
              <span className="text-xs bg-purple-600 px-2 py-0.5 rounded flex items-center gap-1">
                <UserX size={12} />
                Anonymised
              </span>
            )}
          </div>
        </div>
        <button
          onClick={exitViewMode}
          className="flex items-center bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          <X size={16} className="mr-1" />
          Exit
        </button>
      </div>
    </div>
  );
};

export default ViewModeBanner;
