import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  RefreshCw,
  X,
  Cloud,
  Share2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import LoginPanel from './LoginPanel';
import ProfilePanel from './ProfilePanel';
import FriendsPanel from './FriendsPanel';
import SyncStatusPanel from './SyncStatusPanel';
import SharePanel from './SharePanel';

type PanelType = 'login' | 'profile' | 'friends' | 'sync' | 'share';

const CloudSidebar: React.FC = () => {
  const { user, isConfigured, isLoading, isPasswordRecoveryMode } = useAuth();
  const { playSound } = useSound();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('cloudSidebar_collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const [activePanel, setActivePanel] = useState<PanelType>('login');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('cloudSidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    // Don't switch away from login panel if in password recovery mode
    if (isPasswordRecoveryMode) {
      setActivePanel('login');
    } else if (user && activePanel === 'login') {
      setActivePanel('profile');
    } else if (!user && activePanel !== 'login') {
      setActivePanel('login');
    }
  }, [user, activePanel, isPasswordRecoveryMode]);

  const toggleCollapsed = () => {
    playSound('buttonClick');
    setIsCollapsed(!isCollapsed);
  };

  const handlePanelChange = (panel: PanelType) => {
    playSound('buttonClick');
    setActivePanel(panel);
  };

  if (!isConfigured) {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleCollapsed}
        className={`fixed top-20 z-40 p-2 rounded-l-lg transition-all duration-300 ${
          isCollapsed ? 'right-0' : 'right-80'
        } bg-orange-600 hover:bg-orange-500 text-white shadow-lg`}
        aria-label={isCollapsed ? 'Open cloud panel' : 'Close cloud panel'}
      >
        {isCollapsed ? (
          <>
            <ChevronLeft size={20} />
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
              </span>
            )}
          </>
        ) : (
          <ChevronRight size={20} />
        )}
      </button>

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-gray-900 shadow-xl z-40 transform transition-transform duration-300 flex flex-col ${
          isCollapsed ? 'translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="bg-orange-600 p-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center">
            <Cloud size={20} className="mr-2" />
            Cloud Sync
          </h2>
          <button
            onClick={toggleCollapsed}
            className="p-1 hover:bg-orange-500 rounded transition-colors"
            aria-label="Close panel"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {user && !isLoading && (
          <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => handlePanelChange('profile')}
              className={`flex-1 p-3 flex items-center justify-center transition-colors ${
                activePanel === 'profile'
                  ? 'bg-gray-800 text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Profile"
            >
              <User size={18} />
            </button>
            <button
              onClick={() => handlePanelChange('friends')}
              className={`flex-1 p-3 flex items-center justify-center relative transition-colors ${
                activePanel === 'friends'
                  ? 'bg-gray-800 text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Friends"
            >
              <Users size={18} />
              {pendingRequestCount > 0 && (
                <span className="absolute top-1 right-4 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                  {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handlePanelChange('sync')}
              className={`flex-1 p-3 flex items-center justify-center transition-colors ${
                activePanel === 'sync'
                  ? 'bg-gray-800 text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Sync"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => handlePanelChange('share')}
              className={`flex-1 p-3 flex items-center justify-center transition-colors ${
                activePanel === 'share'
                  ? 'bg-gray-800 text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Share"
            >
              <Share2 size={18} />
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={24} className="animate-spin text-orange-400" />
            </div>
          ) : !user || isPasswordRecoveryMode ? (
            <LoginPanel />
          ) : (
            <>
              {activePanel === 'profile' && <ProfilePanel />}
              {activePanel === 'friends' && (
                <FriendsPanel onPendingCountChange={setPendingRequestCount} />
              )}
              {activePanel === 'sync' && <SyncStatusPanel />}
              {activePanel === 'share' && <SharePanel />}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CloudSidebar;
