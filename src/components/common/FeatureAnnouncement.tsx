import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { useViewMode } from '../../context/ViewModeContext';

interface FeatureAnnouncementProps {
  id: string;
  title: string;
  description: string | React.ReactNode;
  icon?: React.ReactNode;
  buttonText?: string;
}

const STORAGE_KEY = 'dismissedFeatureAnnouncements';

/**
 * Get the list of dismissed feature announcement IDs from localStorage
 */
export function getDismissedAnnouncements(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Check if a specific announcement has been dismissed
 */
export function isAnnouncementDismissed(id: string): boolean {
  return getDismissedAnnouncements().includes(id);
}

/**
 * Mark an announcement as dismissed
 */
export function dismissAnnouncement(id: string): void {
  const dismissed = getDismissedAnnouncements();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  }
}

/**
 * FeatureAnnouncement - A popup to announce new features to users.
 * Only shows once per announcement ID, then stores dismissal in localStorage.
 * Does not show or persist dismissal in View Only mode.
 */
const FeatureAnnouncement: React.FC<FeatureAnnouncementProps> = ({
  id,
  title,
  description,
  icon,
  buttonText = 'Got it!',
}) => {
  const { playSound } = useSound();
  const { isViewMode } = useViewMode();

  // Don't show announcements in View Only mode
  const [isVisible, setIsVisible] = React.useState(() => !isViewMode && !isAnnouncementDismissed(id));

  const handleDismiss = () => {
    playSound('buttonClick');
    // Only persist dismissal if not in view mode
    if (!isViewMode) {
      dismissAnnouncement(id);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md border border-orange-600/50 shadow-xl shadow-orange-600/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            {icon || <Sparkles size={24} className="text-orange-400" />}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="text-gray-300 text-sm leading-relaxed">
            {description}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleDismiss}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 px-4 rounded transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureAnnouncement;
