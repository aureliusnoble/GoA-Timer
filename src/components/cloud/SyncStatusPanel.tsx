import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Upload,
  Download,
  Check,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { CloudSyncService, SyncStatus } from '../../services/supabase/CloudSyncService';

const SyncStatusPanel: React.FC = () => {
  const { playSound } = useSound();

  const [status, setStatus] = useState<SyncStatus>(CloudSyncService.getStatus());
  const [autoUploadEnabled, setAutoUploadEnabled] = useState(CloudSyncService.isAutoUploadEnabled());
  const [autoSyncOwnDevicesEnabled, setAutoSyncOwnDevicesEnabled] = useState(
    CloudSyncService.isAutoSyncOwnDevicesEnabled()
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(CloudSyncService.getLastSyncTime());
  const [lastOwnSyncTime, setLastOwnSyncTime] = useState<Date | null>(
    CloudSyncService.getLastOwnSyncTime()
  );

  useEffect(() => {
    const unsubscribe = CloudSyncService.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus.lastSyncAt) {
        setLastSyncTime(newStatus.lastSyncAt);
      }
    });

    return unsubscribe;
  }, []);

  const handleUpload = async () => {
    playSound('buttonClick');
    await CloudSyncService.uploadLocalData();
  };

  const handleDownloadOwnData = async () => {
    playSound('buttonClick');
    const result = await CloudSyncService.downloadOwnCloudData();
    if (result.success) {
      setLastOwnSyncTime(new Date());
    }
  };

  const handleToggleAutoUpload = () => {
    playSound('toggleSwitch');
    const newValue = !autoUploadEnabled;
    setAutoUploadEnabled(newValue);
    CloudSyncService.setAutoUpload(newValue);
  };

  const handleToggleAutoSyncOwnDevices = () => {
    playSound('toggleSwitch');
    const newValue = !autoSyncOwnDevicesEnabled;
    setAutoSyncOwnDevicesEnabled(newValue);
    CloudSyncService.setAutoSyncOwnDevices(newValue);
  };

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  const isWorking = ['uploading', 'downloading', 'merging'].includes(status.status);

  const getStatusIcon = () => {
    switch (status.status) {
      case 'uploading':
        return <Upload size={18} className="animate-pulse text-orange-400" />;
      case 'downloading':
        return <Download size={18} className="animate-pulse text-orange-400" />;
      case 'merging':
        return <RefreshCw size={18} className="animate-spin text-orange-400" />;
      case 'complete':
        return <Check size={18} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-500" />;
      default:
        return <Clock size={18} className="text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'uploading':
      case 'downloading':
      case 'merging':
        return 'text-orange-400';
      case 'complete':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-400">Sync Status</h4>
          {getStatusIcon()}
        </div>

        <p className={`text-sm font-medium ${getStatusColor()}`}>
          {status.message}
        </p>

        {/* Progress Bar */}
        {isWorking && (
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              {status.progress}%
            </p>
          </div>
        )}

        {/* Error Message */}
        {status.error && (
          <div className="mt-3 bg-red-900/50 border border-red-700 rounded p-2">
            <p className="text-red-300 text-xs">{status.error}</p>
          </div>
        )}

        {/* Last Sync Time */}
        <div className="mt-3 flex items-center text-xs text-gray-500">
          <Clock size={12} className="mr-1" />
          Last sync: {formatLastSync(lastSyncTime)}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={isWorking}
          className="w-full flex items-center justify-center bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition-colors"
        >
          {status.status === 'uploading' ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={18} className="mr-2" />
              Upload My Data
            </>
          )}
        </button>

        {/* Download Own Cloud Data Button */}
        <button
          onClick={handleDownloadOwnData}
          disabled={isWorking}
          className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded transition-colors"
        >
          {status.status === 'downloading' ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              Downloading...
            </>
          ) : (
            <>
              <Download size={18} className="mr-2" />
              Download My Data
            </>
          )}
        </button>

        {/* Last Download Time */}
        <div className="flex items-center text-xs text-gray-500 px-1">
          <Clock size={12} className="mr-1" />
          Last download from other devices: {formatLastSync(lastOwnSyncTime)}
        </div>
      </div>

      {/* Auto-Upload Toggle */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Auto-Upload</p>
            <p className="text-gray-500 text-xs">
              Automatically upload data when you record matches
            </p>
          </div>
          <button
            onClick={handleToggleAutoUpload}
            disabled={isWorking}
            className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
              autoUploadEnabled
                ? 'bg-orange-600 justify-end'
                : 'bg-gray-600 justify-start'
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow"></div>
          </button>
        </div>
      </div>

      {/* Auto-Sync Own Devices Toggle */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">Auto-Sync Devices</p>
            <p className="text-gray-500 text-xs">
              Automatically download data from your other devices
            </p>
          </div>
          <button
            onClick={handleToggleAutoSyncOwnDevices}
            disabled={isWorking}
            className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${
              autoSyncOwnDevicesEnabled
                ? 'bg-blue-600 justify-end'
                : 'bg-gray-600 justify-start'
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow"></div>
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Upload:</strong> Sends your local match data to the cloud.
        </p>
        <p>
          <strong>Download:</strong> Gets your data from other devices you own.
        </p>
        <p>
          <strong>Auto-Upload:</strong> Uploads after recording matches.
        </p>
        <p>
          <strong>Auto-Sync Devices:</strong> Downloads when other devices upload.
        </p>
        <p className="text-gray-600 mt-2">
          To sync from friends, go to the Friends tab.
        </p>
      </div>
    </div>
  );
};

export default SyncStatusPanel;
