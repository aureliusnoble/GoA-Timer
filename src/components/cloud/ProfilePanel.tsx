import React, { useState } from 'react';
import { LogOut, Settings, User, Shield, Eye, EyeOff, Loader2, Trash2, Lock, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';

const ProfilePanel: React.FC = () => {
  const { user, profile, logout, updateProfile, deleteCloudData, deleteAccount, changePassword } = useAuth();
  const { playSound } = useSound();

  const [showSettings, setShowSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleLogout = async () => {
    playSound('buttonClick');
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleToggleShareStats = async () => {
    if (!profile) return;
    playSound('toggleSwitch');
    setIsSaving(true);
    await updateProfile({ shareStatsWithFriends: !profile.shareStatsWithFriends });
    setIsSaving(false);
  };

  const handleToggleShareHistory = async () => {
    if (!profile) return;
    playSound('toggleSwitch');
    setIsSaving(true);
    await updateProfile({ shareMatchHistoryWithFriends: !profile.shareMatchHistoryWithFriends });
    setIsSaving(false);
  };

  const handleDeleteCloudData = async () => {
    if (!confirmDeleteData) {
      setConfirmDeleteData(true);
      return;
    }

    playSound('buttonClick');
    setDeleteError(null);
    setIsDeletingData(true);
    const result = await deleteCloudData();
    setIsDeletingData(false);
    setConfirmDeleteData(false);

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete cloud data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDeleteAccount) {
      setConfirmDeleteAccount(true);
      return;
    }

    playSound('buttonClick');
    setDeleteError(null);
    setIsDeletingAccount(true);
    const result = await deleteAccount();
    setIsDeletingAccount(false);
    setConfirmDeleteAccount(false);

    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete account');
    }
    // If successful, the user will be logged out automatically
  };

  const handleCancelDelete = () => {
    setConfirmDeleteData(false);
    setConfirmDeleteAccount(false);
    setDeleteError(null);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    // Validate new password is different
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    playSound('buttonClick');
    setIsChangingPassword(true);

    const result = await changePassword(currentPassword, newPassword);

    setIsChangingPassword(false);

    if (result.success) {
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(result.error || 'Failed to change password');
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={24} className="animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={32} className="text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {profile.displayName || profile.username}
            </h3>
            <p className="text-sm text-gray-400">@{profile.username}</p>
            <p className="text-xs text-gray-500 mt-1">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Privacy Settings Toggle */}
      <button
        onClick={() => {
          playSound('buttonClick');
          setShowSettings(!showSettings);
        }}
        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-lg p-3 transition-colors"
      >
        <div className="flex items-center">
          <Settings size={18} className="text-gray-400 mr-3" />
          <span className="text-white">Privacy Settings</span>
        </div>
        <span className="text-gray-400">{showSettings ? '▲' : '▼'}</span>
      </button>

      {/* Privacy Settings Panel */}
      {showSettings && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield size={16} className="text-gray-400 mr-2" />
              <div>
                <p className="text-white text-sm">Share Stats</p>
                <p className="text-gray-500 text-xs">Friends can see your player stats</p>
              </div>
            </div>
            <button
              onClick={handleToggleShareStats}
              disabled={isSaving}
              className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                profile.shareStatsWithFriends
                  ? 'bg-orange-600 justify-end'
                  : 'bg-gray-600 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow"></div>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {profile.shareMatchHistoryWithFriends ? (
                <Eye size={16} className="text-gray-400 mr-2" />
              ) : (
                <EyeOff size={16} className="text-gray-400 mr-2" />
              )}
              <div>
                <p className="text-white text-sm">Share Match History</p>
                <p className="text-gray-500 text-xs">Friends can see your matches</p>
              </div>
            </div>
            <button
              onClick={handleToggleShareHistory}
              disabled={isSaving}
              className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
                profile.shareMatchHistoryWithFriends
                  ? 'bg-orange-600 justify-end'
                  : 'bg-gray-600 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow"></div>
            </button>
          </div>
        </div>
      )}

      {/* Security Toggle */}
      <button
        onClick={() => {
          playSound('buttonClick');
          setShowSecurity(!showSecurity);
          if (!showSecurity) resetPasswordForm();
        }}
        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-lg p-3 transition-colors"
      >
        <div className="flex items-center">
          <Lock size={18} className="text-gray-400 mr-3" />
          <span className="text-white">Security</span>
        </div>
        <span className="text-gray-400">{showSecurity ? '▲' : '▼'}</span>
      </button>

      {/* Security Panel - Password Change */}
      {showSecurity && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-400">Change Password</h4>

          {passwordSuccess && (
            <div className="bg-green-900/30 border border-green-700 text-green-300 text-sm p-3 rounded flex items-center">
              <Check size={16} className="mr-2" />
              Password changed successfully!
            </div>
          )}

          {passwordError && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm p-3 rounded">
              {passwordError}
            </div>
          )}

          <div className="space-y-3">
            {/* Current Password */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded pr-10 text-sm"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded pr-10 text-sm"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-1">Minimum 6 characters</p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="text-gray-400 text-xs block mb-1">Confirm New Password</label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                placeholder="Confirm new password"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors text-sm"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 size={14} className="animate-spin inline mr-2" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Account</h4>
        <div className="text-xs text-gray-500 space-y-1">
          <p>User ID: {user.id.substring(0, 8)}...</p>
          <p>Created: {new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Data Management Toggle */}
      <button
        onClick={() => {
          playSound('buttonClick');
          setShowDangerZone(!showDangerZone);
          handleCancelDelete();
        }}
        className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-lg p-3 transition-colors"
      >
        <div className="flex items-center">
          <Trash2 size={18} className="text-gray-400 mr-3" />
          <span className="text-white">Account Management</span>
        </div>
        <span className="text-gray-400">{showDangerZone ? '▲' : '▼'}</span>
      </button>

      {/* Danger Zone Panel */}
      {showDangerZone && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4 border border-red-900/30">
          {deleteError && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm p-3 rounded">
              {deleteError}
            </div>
          )}

          {/* Delete Cloud Data */}
          <div className="space-y-2">
            <div className="flex items-start">
              <Trash2 size={16} className="text-red-500 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Delete Cloud Data</p>
                <p className="text-gray-500 text-xs">
                  Remove all your synced players, matches, and stats from the cloud. Your local data will remain intact. Anyone who has already synced your data will still retain their copy.
                </p>
              </div>
            </div>
            {confirmDeleteData ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDeleteCloudData}
                  disabled={isDeletingData}
                  className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 text-white text-sm py-2 px-3 rounded transition-colors"
                >
                  {isDeletingData ? (
                    <>
                      <Loader2 size={14} className="animate-spin inline mr-1" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete My Data'
                  )}
                </button>
                <button
                  onClick={handleCancelDelete}
                  disabled={isDeletingData}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleDeleteCloudData}
                className="w-full bg-gray-700 hover:bg-red-700 text-red-400 hover:text-white text-sm py-2 px-3 rounded transition-colors"
              >
                Delete Cloud Data
              </button>
            )}
          </div>

          <div className="border-t border-gray-700 my-2"></div>

          {/* Delete Account */}
          <div className="space-y-2">
            <div className="flex items-start">
              <Trash2 size={16} className="text-red-500 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Delete Account</p>
                <p className="text-gray-500 text-xs">
                  Permanently delete your account, all cloud data, and friend connections. This action cannot be undone.
                </p>
              </div>
            </div>
            {confirmDeleteAccount ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 text-white text-sm py-2 px-3 rounded transition-colors"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 size={14} className="animate-spin inline mr-1" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete My Account'
                  )}
                </button>
                <button
                  onClick={handleCancelDelete}
                  disabled={isDeletingAccount}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-gray-700 hover:bg-red-700 text-red-400 hover:text-white text-sm py-2 px-3 rounded transition-colors"
              >
                Delete Account
              </button>
            )}
          </div>
        </div>
      )}

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full flex items-center justify-center bg-red-700 hover:bg-red-600 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
      >
        {isLoggingOut ? (
          <>
            <Loader2 size={18} className="animate-spin mr-2" />
            Signing out...
          </>
        ) : (
          <>
            <LogOut size={18} className="mr-2" />
            Sign Out
          </>
        )}
      </button>
    </div>
  );
};

export default ProfilePanel;
