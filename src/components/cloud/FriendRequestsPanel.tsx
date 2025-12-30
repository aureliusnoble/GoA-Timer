import React, { useState } from 'react';
import { Check, X, Loader2, Clock, Send } from 'lucide-react';
import { useSound } from '../../context/SoundContext';
import { FriendService, FriendRequest } from '../../services/supabase/FriendService';

interface FriendRequestsPanelProps {
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  onAction: () => void;
}

const FriendRequestsPanel: React.FC<FriendRequestsPanelProps> = ({
  pendingRequests,
  sentRequests,
  onAction,
}) => {
  const { playSound } = useSound();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    playSound('buttonClick');
    setProcessingId(requestId);
    const result = await FriendService.acceptRequest(requestId);
    if (result.success) {
      playSound('phaseChange');
      onAction();
    }
    setProcessingId(null);
  };

  const handleReject = async (requestId: string) => {
    playSound('buttonClick');
    setProcessingId(requestId);
    await FriendService.rejectRequest(requestId);
    onAction();
    setProcessingId(null);
  };

  const handleCancel = async (requestId: string) => {
    playSound('buttonClick');
    setProcessingId(requestId);
    await FriendService.cancelRequest(requestId);
    onAction();
    setProcessingId(null);
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4 bg-gray-800 rounded-lg p-3">
      {/* Incoming Requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            <Clock size={14} className="mr-1" />
            Received ({pendingRequests.length})
          </h4>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-gray-900 rounded p-2"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-400">
                      {request.fromUser?.username.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm">
                      {request.fromUser?.displayName || request.fromUser?.username || 'Unknown'}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {formatTimeAgo(request.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {processingId === request.id ? (
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleAccept(request.id)}
                        className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                        title="Accept"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                        title="Reject"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            <Send size={14} className="mr-1" />
            Sent ({sentRequests.length})
          </h4>
          <div className="space-y-2">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-gray-900 rounded p-2"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-400">
                      {request.toUser?.username.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm">
                      {request.toUser?.displayName || request.toUser?.username || 'Unknown'}
                    </p>
                    <p className="text-gray-500 text-xs flex items-center">
                      <Clock size={10} className="mr-1" />
                      Pending - {formatTimeAgo(request.createdAt)}
                    </p>
                  </div>
                </div>
                {processingId === request.id ? (
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                ) : (
                  <button
                    onClick={() => handleCancel(request.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                    title="Cancel request"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length === 0 && sentRequests.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-2">
          No pending requests
        </p>
      )}
    </div>
  );
};

export default FriendRequestsPanel;
