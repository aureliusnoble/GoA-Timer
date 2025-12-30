import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthService, AuthResult, SignUpData, LoginData, UserProfile } from '../services/supabase/AuthService';
import { isSupabaseConfigured } from '../services/supabase/SupabaseClient';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signUp: (data: SignUpData) => Promise<AuthResult>;
  login: (data: LoginData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'shareStatsWithFriends' | 'shareMatchHistoryWithFriends'>>) => Promise<{ success: boolean; error?: string }>;
  deleteCloudData: () => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isConfigured: false,
  error: null,
  signUp: async () => ({ success: false }),
  login: async () => ({ success: false }),
  logout: async () => {},
  clearError: () => {},
  checkUsernameAvailable: async () => false,
  refreshProfile: async () => {},
  updateProfile: async () => ({ success: false }),
  deleteCloudData: async () => ({ success: false }),
  deleteAccount: async () => ({ success: false }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

  const refreshProfile = useCallback(async () => {
    if (!isConfigured) return;
    const userProfile = await AuthService.getProfile();
    setProfile(userProfile);
  }, [isConfigured]);

  useEffect(() => {
    const initAuth = async () => {
      if (!isConfigured) {
        setIsLoading(false);
        return;
      }

      const currentUser = await AuthService.getUser();
      setUser(currentUser);

      if (currentUser) {
        await refreshProfile();
      }

      setIsLoading(false);
    };

    initAuth();

    const unsubscribe = AuthService.onAuthStateChange(async (newUser) => {
      setUser(newUser);
      if (newUser) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
    });

    return unsubscribe;
  }, [isConfigured, refreshProfile]);

  const signUp = useCallback(async (data: SignUpData): Promise<AuthResult> => {
    setError(null);
    const result = await AuthService.signUp(data);
    if (!result.success && result.error) {
      setError(result.error);
    } else if (result.success) {
      await refreshProfile();
    }
    return result;
  }, [refreshProfile]);

  const login = useCallback(async (data: LoginData): Promise<AuthResult> => {
    setError(null);
    const result = await AuthService.login(data);
    if (!result.success && result.error) {
      setError(result.error);
    } else if (result.success) {
      await refreshProfile();
    }
    return result;
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    setError(null);
    const result = await AuthService.logout();
    if (!result.success && result.error) {
      setError(result.error);
    } else {
      setProfile(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const checkUsernameAvailable = useCallback(
    (username: string) => AuthService.isUsernameAvailable(username),
    []
  );

  const updateProfile = useCallback(async (updates: Partial<Pick<UserProfile, 'displayName' | 'shareStatsWithFriends' | 'shareMatchHistoryWithFriends'>>) => {
    const result = await AuthService.updateProfile(updates);
    if (result.success) {
      await refreshProfile();
    }
    return result;
  }, [refreshProfile]);

  const deleteCloudData = useCallback(async () => {
    setError(null);
    const result = await AuthService.deleteCloudData();
    if (!result.success && result.error) {
      setError(result.error);
    }
    return result;
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);
    const result = await AuthService.deleteAccount();
    if (!result.success && result.error) {
      setError(result.error);
    } else {
      setUser(null);
      setProfile(null);
    }
    return result;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured,
        error,
        signUp,
        login,
        logout,
        clearError,
        checkUsernameAvailable,
        refreshProfile,
        updateProfile,
        deleteCloudData,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
