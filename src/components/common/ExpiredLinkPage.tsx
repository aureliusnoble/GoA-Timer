import React from 'react';
import { Clock, Home } from 'lucide-react';

interface ExpiredLinkPageProps {
  expiredAt?: Date | null;
  onGoHome: () => void;
}

const ExpiredLinkPage: React.FC<ExpiredLinkPageProps> = ({ expiredAt, onGoHome }) => {
  const formatExpiredDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-gray-900 flex items-center justify-center p-6">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full text-center shadow-xl border border-gray-700">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-orange-600/20 rounded-full flex items-center justify-center">
            <Clock size={40} className="text-orange-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          This Link Has Expired
        </h1>

        <p className="text-gray-400 mb-4">
          The share link you're trying to access is no longer available.
        </p>

        {expiredAt && (
          <p className="text-gray-500 text-sm mb-6 bg-gray-900/50 rounded p-3">
            Expired on: {formatExpiredDate(expiredAt)}
          </p>
        )}

        <p className="text-gray-500 text-sm mb-8">
          If you believe this is an error, please contact the person who shared
          this link with you to request a new one.
        </p>

        <button
          onClick={onGoHome}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Home size={18} />
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default ExpiredLinkPage;
