import React from 'react';
import { Eye, X, Loader2, AlertCircle } from 'lucide-react';
import { useViewMode } from '../../context/ViewModeContext';

const ViewModeBanner: React.FC = () => {
  const { isViewMode, ownerDisplayName, isLoading, error, exitViewMode } = useViewMode();

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

  // Show error state
  if (error) {
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
        <div className="flex items-center">
          <Eye size={18} className="mr-2" />
          <span className="text-sm font-medium">
            Viewing <span className="font-bold">{ownerDisplayName}</span>'s Stats
          </span>
          <span className="ml-2 text-xs bg-blue-700 px-2 py-0.5 rounded">Read-only</span>
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
