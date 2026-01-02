import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ShareService, SharedData } from '../services/supabase/ShareService';
import { isSupabaseConfigured } from '../services/supabase/SupabaseClient';

interface ViewModeContextType {
  isViewMode: boolean;
  shareToken: string | null;
  sharedData: SharedData | null;
  ownerDisplayName: string | null;
  isLoading: boolean;
  error: string | null;
  exitViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  isViewMode: false,
  shareToken: null,
  sharedData: null,
  ownerDisplayName: null,
  isLoading: false,
  error: null,
  exitViewMode: () => {},
});

export const useViewMode = () => useContext(ViewModeContext);

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isViewMode, setIsViewMode] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for share token in URL on mount
  useEffect(() => {
    const token = ShareService.getShareTokenFromUrl();

    if (!token) {
      return;
    }

    // Only proceed if Supabase is configured
    if (!isSupabaseConfigured()) {
      setError('Cloud features are not available');
      return;
    }

    setShareToken(token);
    setIsLoading(true);
    setError(null);

    const loadSharedData = async () => {
      const result = await ShareService.getSharedData(token);

      if (result.success && result.data) {
        setSharedData(result.data);
        setOwnerDisplayName(result.data.displayName);
        setIsViewMode(true);
      } else {
        setError(result.error || 'Failed to load shared data');
      }

      setIsLoading(false);
    };

    loadSharedData();
  }, []);

  const exitViewMode = useCallback(() => {
    // Clear URL parameter
    ShareService.clearShareTokenFromUrl();

    // Reset state
    setIsViewMode(false);
    setShareToken(null);
    setSharedData(null);
    setOwnerDisplayName(null);
    setError(null);

    // Reload page to get fresh local data
    window.location.reload();
  }, []);

  return (
    <ViewModeContext.Provider
      value={{
        isViewMode,
        shareToken,
        sharedData,
        ownerDisplayName,
        isLoading,
        error,
        exitViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
};
