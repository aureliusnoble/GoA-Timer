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
  isPasswordRecoveryMode: boolean;
  signUp: (data: SignUpData) => Promise<AuthResult>;
  login: (data: LoginData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'shareStatsWithFriends' | 'shareMatchHistoryWithFriends'>>) => Promise<{ success: boolean; error?: string }>;
  deleteCloudData: () => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePasswordFromReset: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  clearPasswordRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isConfigured: false,
  error: null,
  isPasswordRecoveryMode: false,
  signUp: async () => ({ success: false }),
  login: async () => ({ success: false }),
  logout: async () => {},
  clearError: () => {},
  checkUsernameAvailable: async () => false,
  refreshProfile: async () => {},
  updateProfile: async () => ({ success: false }),
  deleteCloudData: async () => ({ success: false }),
  deleteAccount: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  sendPasswordResetEmail: async () => ({ success: false }),
  updatePasswordFromReset: async () => ({ success: false }),
  clearPasswordRecoveryMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);
  const isConfigured = isSupabaseConfigured();

  const refreshProfile = useCallback(async () => {
    if (!isConfigured) return;
    const userProfile = await AuthService.getProfile();
    setProfile(userProfile);
  }, [isConfigured]);

  useEffect(() => {
    // Check URL for recovery tokens on initial load
    // Supabase can redirect with either:
    // - Hash: #access_token=...&type=recovery (implicit flow)
    // - Query: ?code=xxx&type=recovery (PKCE flow)
    const checkUrlForRecovery = () => {
      console.log('[AuthContext] Checking URL for recovery...');
      console.log('[AuthContext] Full URL:', window.location.href);
      console.log('[AuthContext] Hash:', window.location.hash);
      console.log('[AuthContext] Search:', window.location.search);

      // Check hash fragment (implicit flow)
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const hashType = hashParams.get('type');
        console.log('[AuthContext] Hash params - type:', hashType);
        if (hashType === 'recovery') {
          console.log('[AuthContext] Detected recovery from URL hash');
          return true;
        }
      }

      // Check query parameters (PKCE flow)
      const searchParams = new URLSearchParams(window.location.search);
      const queryType = searchParams.get('type');
      console.log('[AuthContext] Query params - type:', queryType);
      if (queryType === 'recovery') {
        console.log('[AuthContext] Detected recovery from URL query params');
        return true;
      }

      return false;
    };

    // Check URL immediately before setting up listener
    const recoveryDetectedFromUrl = checkUrlForRecovery();

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

    // Set up listener BEFORE calling initAuth to avoid missing events
    const unsubscribe = AuthService.onAuthStateChange(async (newUser, event) => {
      console.log('[AuthContext] Auth state change - event:', event, 'user:', newUser?.email);

      setUser(newUser);

      // Detect password recovery mode when user clicks reset link from email
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[AuthContext] PASSWORD_RECOVERY event detected');
        setIsPasswordRecoveryMode(true);
      }

      if (newUser) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
    });

    initAuth();

    // If we detected recovery from URL but state wasn't set yet, ensure it's set
    if (recoveryDetectedFromUrl) {
      setIsPasswordRecoveryMode(true);
    }

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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setError(null);
    const result = await AuthService.changePassword(currentPassword, newPassword);
    if (!result.success && result.error) {
      setError(result.error);
    }
    return result;
  }, []);

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    setError(null);
    const result = await AuthService.sendPasswordResetEmail(email);
    if (!result.success && result.error) {
      setError(result.error);
    }
    return result;
  }, []);

  const updatePasswordFromReset = useCallback(async (newPassword: string) => {
    setError(null);
    const result = await AuthService.updatePasswordFromReset(newPassword);
    if (!result.success && result.error) {
      setError(result.error);
    } else if (result.success) {
      // Clear recovery mode after successful password update
      setIsPasswordRecoveryMode(false);
      await refreshProfile();
    }
    return result;
  }, [refreshProfile]);

  const clearPasswordRecoveryMode = useCallback(() => {
    setIsPasswordRecoveryMode(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isConfigured,
        error,
        isPasswordRecoveryMode,
        signUp,
        login,
        logout,
        clearError,
        checkUsernameAvailable,
        refreshProfile,
        updateProfile,
        deleteCloudData,
        deleteAccount,
        changePassword,
        sendPasswordResetEmail,
        updatePasswordFromReset,
        clearPasswordRecoveryMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
