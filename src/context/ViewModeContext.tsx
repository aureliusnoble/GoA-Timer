import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ShareService, SharedData, ShareLinkErrorCode } from '../services/supabase/ShareService';
import { isSupabaseConfigured } from '../services/supabase/SupabaseClient';

interface ViewModeContextType {
  isViewMode: boolean;
  shareToken: string | null;
  sharedData: SharedData | null;
  ownerDisplayName: string | null;
  isLoading: boolean;
  error: string | null;
  errorCode: ShareLinkErrorCode | null;
  isExpired: boolean;
  expiredAt: Date | null;
  exitViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  isViewMode: false,
  shareToken: null,
  sharedData: null,
  ownerDisplayName: null,
  isLoading: false,
  error: null,
  errorCode: null,
  isExpired: false,
  expiredAt: null,
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
  const [errorCode, setErrorCode] = useState<ShareLinkErrorCode | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [expiredAt, setExpiredAt] = useState<Date | null>(null);

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
    setErrorCode(null);
    setIsExpired(false);
    setExpiredAt(null);

    const loadSharedData = async () => {
      const result = await ShareService.getSharedData(token);

      if (result.success && result.data) {
        setSharedData(result.data);
        setOwnerDisplayName(result.data.displayName);
        setIsViewMode(true);
      } else {
        setError(result.error || 'Failed to load shared data');
        setErrorCode(result.errorCode || null);

        // Handle expired link state
        if (result.errorCode === 'LINK_EXPIRED') {
          setIsExpired(true);
          setExpiredAt(result.expiredAt || null);
        }
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
    setErrorCode(null);
    setIsExpired(false);
    setExpiredAt(null);

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
        errorCode,
        isExpired,
        expiredAt,
        exitViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
};
