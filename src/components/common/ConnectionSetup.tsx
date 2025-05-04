// src/components/common/ConnectionSetup.tsx
import React, { useState, useEffect } from 'react';
import { Share2, Link, Wifi, WifiOff, Copy, Check, HelpCircle, X, Loader2, ArrowUpCircle, ArrowDownCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import { useSound } from '../../context/SoundContext';

interface ConnectionSetupProps {
  onClose?: () => void;
  onDataReceived?: () => void;
}

export const ConnectionSetup: React.FC<ConnectionSetupProps> = ({ onClose, onDataReceived }) => {
  const { 
    connectionState, 
    syncProgress, 
    initAsHost, 
    connect, 
    disconnect, 
    sendData,
    requestData,
    confirmDataOperation,
    rejectDataOperation
  } = useConnection();
  const { playSound } = useSound();
  
  const [joinCode, setJoinCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Format and validate join code
  useEffect(() => {
    // Code is valid if it's 6+ alphanumeric characters
    setIsCodeValid(/^[A-Z0-9]{6,}$/.test(joinCode));
  }, [joinCode]);
  
  // Handle input change for join code
  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip any non-alphanumeric characters and convert to uppercase
    const formattedCode = e.target.value
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    
    setJoinCode(formattedCode);
  };
  
  // Handle creating a new host connection
  const handleHostSession = async () => {
    try {
      playSound('buttonClick');
      console.log("[ConnectionSetup] Initiating host session...");
      setIsRetrying(true);
      const code = await initAsHost();
      setIsRetrying(false);
      console.log("[ConnectionSetup] Host session created with code:", code);
    } catch (err) {
      setIsRetrying(false);
      console.error("[ConnectionSetup] Failed to host session:", err);
    }
  };
  
  // Handle joining an existing session
  const handleJoinSession = async () => {
    if (!isCodeValid) return;
    
    try {
      playSound('buttonClick');
      console.log("[ConnectionSetup] Joining session with code:", joinCode);
      setIsRetrying(true);
      await connect(joinCode);
      setIsRetrying(false);
      console.log("[ConnectionSetup] Successfully joined session");
    } catch (err) {
      setIsRetrying(false);
      console.error("[ConnectionSetup] Failed to join session:", err);
    }
  };
  
  // Handle disconnecting
  const handleDisconnect = () => {
    playSound('buttonClick');
    console.log("[ConnectionSetup] Disconnecting from session");
    disconnect();
  };
  
  // Handle sending data
  const handleSendData = async () => {
    try {
      playSound('buttonClick');
      console.log("[ConnectionSetup] Sending data...");
      await sendData();
    } catch (err) {
      console.error("[ConnectionSetup] Failed to send data:", err);
    }
  };
  
  // Handle requesting data
  const handleRequestData = async () => {
    try {
      playSound('buttonClick');
      console.log("[ConnectionSetup] Requesting data...");
      await requestData();
    } catch (err) {
      console.error("[ConnectionSetup] Failed to request data:", err);
    }
  };
  
  // Handle confirming a data operation
  const handleConfirmOperation = () => {
    playSound('buttonClick');
    console.log("[ConnectionSetup] Confirming data operation");
    confirmDataOperation();
  };
  
  // Handle rejecting a data operation
  const handleRejectOperation = () => {
    playSound('buttonClick');
    console.log("[ConnectionSetup] Rejecting data operation");
    rejectDataOperation();
  };
  
  // Handle copying connection code
  const handleCopyCode = () => {
    if (connectionState.connectionCode) {
      playSound('buttonClick');
      navigator.clipboard.writeText(connectionState.connectionCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };
  
  // Handle copying connection link
  const handleCopyLink = () => {
    if (connectionState.connectionCode) {
      playSound('buttonClick');
      
      // Generate shareable URL with connection code
      const url = new URL(window.location.href);
      url.searchParams.set('connect', connectionState.connectionCode);
      
      navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };
  
  // Handle close button
  const handleClose = () => {
    playSound('buttonClick');
    if (onClose) onClose();
  };
  
  // Determine if we're waiting for a confirmation
  const isAwaitingConfirmation = syncProgress.status === 'awaiting-confirmation';
  
  // Determine if we need to show the confirmation UI
  const showConfirmationUI = syncProgress.status === 'pending-confirmation';
  
  // Show detailed connection status if available
  const detailedStatus = connectionState.detailedStatus;
  
  // Effect to trigger the onDataReceived callback when data sync completes
  useEffect(() => {
    if (syncProgress.status === 'complete' && onDataReceived) {
      console.log("[ConnectionSetup] Data sync completed, calling onDataReceived");
      onDataReceived();
    }
  }, [syncProgress.status, onDataReceived]);
  
  // Debug logging for connections and sync status
  useEffect(() => {
    console.log("[ConnectionSetup] Connection state update:", 
                connectionState.isConnected ? 'connected' : 'disconnected',
                'peers:', connectionState.peerCount,
                'status:', syncProgress.status);
  }, [connectionState.isConnected, connectionState.peerCount, syncProgress.status]);
  
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md mx-auto">
      {/* Header with optional close button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center">
          <Share2 className="mr-2" size={22} />
          P2P Connection
        </h2>
        {onClose && (
          <button 
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      {/* Error message */}
      {connectionState.error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 flex items-start">
          <span className="flex-shrink-0 mr-2">⚠️</span>
          <div>
            <div className="font-medium">Connection Error</div>
            <div className="text-sm mt-1">{connectionState.error}</div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={connectionState.isHost ? handleHostSession : handleDisconnect}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                {connectionState.isHost ? "Try Again" : "Start Over"}
              </button>
              {/* Added a manual reconnect button for peer connection */}
              {!connectionState.isHost && (
                <button
                  onClick={() => connect(joinCode || connectionState.connectionCode || '')}
                  className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm flex items-center"
                  disabled={(!joinCode && !connectionState.connectionCode) || isRetrying}
                >
                  {isRetrying ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <RefreshCw size={14} className="mr-1" />
                  )}
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Connection detailed status (if available) */}
      {detailedStatus && !connectionState.error && connectionState.isConnecting && (
        <div className="mb-4 p-2 bg-blue-900/30 border border-blue-500 rounded-lg text-blue-300 text-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-400 mr-2 animate-pulse"></div>
            {detailedStatus}
          </div>
        </div>
      )}
      
      {/* Not connected state */}
      {!connectionState.isConnected && !connectionState.isConnecting ? (
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <WifiOff className="text-gray-400" size={48} />
          </div>
          
          <p className="text-center text-gray-300 mb-4">
            Create a new connection to share data, or join an existing connection using a code.
          </p>
          
          <button 
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center"
            onClick={handleHostSession}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Creating Connection...
              </>
            ) : (
              <>
                <Share2 size={18} className="mr-2" />
                Create New Connection
              </>
            )}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-3 text-gray-400">or</span>
            <div className="flex-grow border-t border-gray-600"></div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Enter code"
              value={joinCode}
              onChange={handleJoinCodeChange}
              className="flex-grow px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg uppercase tracking-wider"
              maxLength={12}
              disabled={isRetrying}
            />
            <button 
              className={`py-3 px-4 ${
                isCodeValid && !isRetrying
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-gray-600 cursor-not-allowed'
              } text-white rounded-lg flex-shrink-0 flex items-center justify-center`}
              onClick={handleJoinSession}
              disabled={!isCodeValid || isRetrying}
            >
              {isRetrying ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Join"
              )}
            </button>
          </div>
        </div>
      ) : connectionState.isConnecting && !connectionState.connectionCode ? (
        <div className="text-center py-4">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-lg mb-2">Establishing connection...</p>
          <p className="text-sm text-gray-400 mb-4">
            {connectionState.isHost 
              ? "Creating secure connection code..." 
              : "Connecting to remote device..."}
          </p>
          <button 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            onClick={handleDisconnect}
          >
            Cancel
          </button>
        </div>
      ) : connectionState.connectionCode && !connectionState.isConnected ? (
        // Show code while waiting for connection
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <Loader2 className="animate-spin text-blue-400" size={48} />
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center text-lg font-medium mb-2">
            <span>
              {connectionState.isHost 
                ? 'Waiting for Connection' 
                : 'Connecting to Host...'}
            </span>
          </div>
          
          {/* Connection Code (for host) */}
          {connectionState.isHost && connectionState.connectionCode && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Share this code with others:
              </label>
              <div className="flex">
                <div className="flex-grow py-3 px-4 bg-gray-700 border border-gray-600 rounded-l-lg text-center font-mono text-xl tracking-wider">
                  {connectionState.connectionCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-3 bg-blue-600 hover:bg-blue-500 rounded-r-lg flex items-center"
                  title="Copy code"
                >
                  {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              
              <button
                onClick={handleCopyLink}
                className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
              >
                <Link size={16} className="mr-2" />
                {linkCopied ? 'Link Copied!' : 'Copy as Link'}
              </button>
            </div>
          )}
          
          <button 
            className="w-full py-2 bg-red-600 hover:bg-red-500 rounded-lg"
            onClick={handleDisconnect}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center mb-2">
            <Wifi className="text-green-400" size={48} />
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center text-lg font-medium mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span>
              {connectionState.isHost 
                ? `Hosting Connection (${connectionState.peerCount} ${connectionState.peerCount === 1 ? 'peer' : 'peers'} connected)` 
                : 'Connected to Host'}
            </span>
          </div>
          
          {/* Connection Code (for host) */}
          {connectionState.isHost && connectionState.connectionCode && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Share this code with others:
              </label>
              <div className="flex">
                <div className="flex-grow py-3 px-4 bg-gray-700 border border-gray-600 rounded-l-lg text-center font-mono text-xl tracking-wider">
                  {connectionState.connectionCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-3 bg-blue-600 hover:bg-blue-500 rounded-r-lg flex items-center"
                  title="Copy code"
                >
                  {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              
              <button
                onClick={handleCopyLink}
                className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
              >
                <Link size={16} className="mr-2" />
                {linkCopied ? 'Link Copied!' : 'Copy as Link'}
              </button>
            </div>
          )}
          
          {/* Sync data section */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-medium mb-2 flex items-center">
              <HelpCircle size={18} className="mr-2 text-blue-400" />
              Share Match Data
            </h3>
            
            {/* Confirmation UI - Shown when user needs to confirm an operation */}
            {showConfirmationUI && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <AlertTriangle size={18} className="text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-1">
                      {syncProgress.message}
                    </h4>
                    <p className="text-sm text-gray-300 mb-3">
                      Do you want to {syncProgress.isDataRequest ? 'send' : 'receive'} match data?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConfirmOperation}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded"
                      >
                        {syncProgress.isDataRequest ? 'Send Data' : 'Receive Data'}
                      </button>
                      <button
                        onClick={handleRejectOperation}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Sync Idle State - Ready to send/request */}
            {syncProgress.status === 'idle' && !showConfirmationUI && !isAwaitingConfirmation && (
              <div>
                <p className="text-sm text-gray-300 mb-3">
                  Exchange match history, player stats, and game data with the connected device.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSendData}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center"
                  >
                    <ArrowUpCircle size={16} className="mr-2" />
                    Send My Data
                  </button>
                  
                  <button
                    onClick={handleRequestData}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center justify-center"
                  >
                    <ArrowDownCircle size={16} className="mr-2" />
                    Request Data
                  </button>
                </div>
              </div>
            )}
            
            {/* Awaiting Confirmation State */}
            {isAwaitingConfirmation && (
              <div className="p-3 bg-blue-900/30 border border-blue-600 rounded-lg mb-4">
                <div className="flex items-start">
                  <Loader2 size={18} className="text-blue-500 mr-2 mt-0.5 animate-spin" />
                  <div>
                    <p className="text-blue-300">{syncProgress.message}</p>
                    <p className="text-sm text-gray-400 mt-1">Waiting for the other device to respond...</p>
                    <button
                      onClick={handleRejectOperation}
                      className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Sync in Progress State */}
            {(syncProgress.status === 'preparing' || 
              syncProgress.status === 'sending' || 
              syncProgress.status === 'receiving' || 
              syncProgress.status === 'processing') && (
              <div className="space-y-2">
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${syncProgress.percent}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm">{syncProgress.message}</p>
              </div>
            )}
            
            {/* Sync Complete State */}
            {syncProgress.status === 'complete' && (
              <div className="p-3 bg-green-900/30 border border-green-600 rounded-lg mb-4">
                <div className="flex items-start">
                  <Check size={18} className="text-green-500 mr-2 mt-0.5" />
                  <p className="text-green-300">{syncProgress.message}</p>
                </div>
                <div className="mt-2 text-right">
                  <button
                    onClick={() => { 
                      // Reset sync status so the user can perform another operation
                      rejectDataOperation();
                    }}
                    className="px-3 py-1 bg-green-800 hover:bg-green-700 rounded text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            
            {/* Sync Error State */}
            {syncProgress.status === 'error' && (
              <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle size={18} className="text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-red-300">{syncProgress.message}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          // Reset sync status so the user can try again
                          rejectDataOperation();
                        }}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                      >
                        Dismiss
                      </button>
                      {syncProgress.error?.includes('connection') && (
                        <button
                          onClick={() => {
                            // Try reconnecting
                            if (connectionState.connectionCode) {
                              rejectDataOperation();
                              connect(connectionState.connectionCode);
                            }
                          }}
                          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm flex items-center"
                        >
                          <RefreshCw size={14} className="mr-1" />
                          Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Disconnect button */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleDisconnect}
              className="w-full py-2 bg-red-600 hover:bg-red-500 rounded-lg"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};