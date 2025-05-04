// src/components/common/ConnectionSetup.tsx
import React, { useState, useEffect } from 'react';
import { Share2, Link, Wifi, WifiOff, Copy, Check, HelpCircle, X, Loader2 } from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import { useSound } from '../../context/SoundContext';

interface ConnectionSetupProps {
  onClose?: () => void;
}

export const ConnectionSetup: React.FC<ConnectionSetupProps> = ({ onClose }) => {
  const { connectionState, syncProgress, initAsHost, connect, disconnect, requestSync } = useConnection();
  const { playSound } = useSound();
  
  const [joinCode, setJoinCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(false);
  
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
      console.log("[P2P] Initiating host session...");
      const code = await initAsHost();
      console.log("[P2P] Host session created with code:", code);
    } catch (err) {
      console.error("[P2P] Failed to host session:", err);
    }
  };
  
  // Handle joining an existing session
  const handleJoinSession = async () => {
    if (!isCodeValid) return;
    
    try {
      playSound('buttonClick');
      console.log("[P2P] Joining session with code:", joinCode);
      await connect(joinCode);
      console.log("[P2P] Successfully joined session");
    } catch (err) {
      console.error("[P2P] Failed to join session:", err);
    }
  };
  
  // Handle disconnecting
  const handleDisconnect = () => {
    playSound('buttonClick');
    disconnect();
  };
  
  // Handle requesting sync
  const handleRequestSync = async () => {
    try {
      playSound('buttonClick');
      await requestSync();
    } catch (err) {
      console.error("Failed to request sync:", err);
    }
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
            <button
              onClick={connectionState.isHost ? handleHostSession : handleDisconnect}
              className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
            >
              {connectionState.isHost ? "Try Again" : "Start Over"}
            </button>
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
          >
            <Share2 size={18} className="mr-2" />
            Create New Connection
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
            />
            <button 
              className={`py-3 px-4 ${
                isCodeValid 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : 'bg-gray-600 cursor-not-allowed'
              } text-white rounded-lg flex-shrink-0 flex items-center justify-center`}
              onClick={handleJoinSession}
              disabled={!isCodeValid}
            >
              Join
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
                ? 'Hosting Connection' 
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
            
            {syncProgress.status === 'idle' ? (
              <div>
                <p className="text-sm text-gray-300 mb-3">
                  Get match history, player stats, and game data from the connected device.
                </p>
                
                <button
                  onClick={handleRequestSync}
                  className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center justify-center"
                >
                  <Share2 size={16} className="mr-2" />
                  Request Game Data
                </button>
              </div>
            ) : syncProgress.status === 'complete' ? (
              <div className="p-3 bg-green-900/30 border border-green-600 rounded-lg mb-4">
                <div className="flex items-start">
                  <Check size={18} className="text-green-500 mr-2 mt-0.5" />
                  <p className="text-green-300">{syncProgress.message}</p>
                </div>
                
                {/* New: Button to start another sync */}
                <button
                  onClick={handleRequestSync}
                  className="mt-3 w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center justify-center"
                >
                  <Share2 size={16} className="mr-2" />
                  Request More Data
                </button>
              </div>
            ) : syncProgress.status === 'error' ? (
              <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
                <p className="text-red-300">{syncProgress.message}</p>
                <button
                  onClick={handleRequestSync}
                  className="mt-2 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
                >
                  Try Again
                </button>
              </div>
            ) : (
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