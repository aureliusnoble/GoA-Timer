// src/context/ConnectionContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { P2PService, ConnectionState } from '../services/P2PService';
import { DatabaseSyncService, SyncProgress } from '../services/DatabaseSyncService';

interface ConnectionContextType {
  // Connection state
  connectionState: ConnectionState;
  syncProgress: SyncProgress;
  
  // Connection methods
  initAsHost: () => Promise<string>;
  connect: (code: string) => Promise<void>;
  disconnect: () => void;
  
  // Sync methods
  requestSync: () => Promise<void>;
}

// Default sync progress state
const defaultSyncProgress: SyncProgress = {
  percent: 0,
  status: 'idle',
  message: 'Ready to sync'
};

// Create context with default values
const ConnectionContext = createContext<ConnectionContextType>({
  connectionState: {
    isConnecting: false,
    isConnected: false,
    error: null,
    connectionCode: null,
    isHost: false,
    peerCount: 0
  },
  syncProgress: defaultSyncProgress,
  
  initAsHost: async () => '',
  connect: async () => {},
  disconnect: () => {},
  requestSync: async () => {}
});

// Hook for accessing connection context
export const useConnection = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: React.ReactNode;
  onDataReceived?: (data: any) => void;
  debug?: boolean;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ 
  children, 
  onDataReceived,
  debug = false
}) => {
  // Initialize services
  const [p2pService] = useState(() => new P2PService({
    debug,
    onData: onDataReceived,
  }));
  
  const [dbSyncService] = useState(() => new DatabaseSyncService(p2pService));
  
  // Track connection and sync state
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    p2pService.getState()
  );
  
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(defaultSyncProgress);
  
  // Set up event handlers
  useEffect(() => {
    // Handle connection state changes
    const handleConnectionStateChange = (state: ConnectionState) => {
      setConnectionState(state);
      
      // Reset sync progress when disconnected
      if (!state.isConnected && syncProgress.status !== 'idle') {
        setSyncProgress(defaultSyncProgress);
      }
    };
    
    // Set up connection state change handler
    if (p2pService) {
      p2pService.onConnectionStateChange = handleConnectionStateChange;
    }
    
    // Set up sync progress handler
    dbSyncService.onProgress(setSyncProgress);
    
    // Check URL for connection code
    const checkUrlForCode = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('connect');
      if (code) {
        // Attempt to connect with the code from URL
        connect(code).catch((err) => {
          console.error('Failed to connect with URL code:', err);
        });
        
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('connect');
        window.history.replaceState({}, document.title, url.toString());
      }
    };
    
    // Check on mount
    checkUrlForCode();
    
    // Cleanup on unmount
    return () => {
      if (p2pService) {
        // Remove the connection state change handler
        p2pService.onConnectionStateChange = null;
        // Disconnect any active connections
        p2pService.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  /**
   * Initialize as host with a new connection code
   */
  const initAsHost = async (): Promise<string> => {
    try {
      console.log('ConnectionContext: Initializing as host');
      const code = await p2pService.initAsHost();
      console.log('ConnectionContext: Host initialized with code:', code);
      return code;
    } catch (error) {
      console.error('ConnectionContext: Error initializing as host:', error);
      // Make sure the UI reflects the error
      setConnectionState({
        ...connectionState,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
  
  /**
   * Connect to an existing session
   */
  const connect = async (code: string): Promise<void> => {
    try {
      console.log('ConnectionContext: Connecting to:', code);
      await p2pService.connect(code);
      console.log('ConnectionContext: Connected successfully');
    } catch (error) {
      console.error('ConnectionContext: Error connecting:', error);
      // Make sure the UI reflects the error
      setConnectionState({
        ...connectionState,
        isConnecting: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
  
  /**
   * Disconnect from all peers
   */
  const disconnect = () => {
    p2pService.disconnect();
  };
  
  /**
   * Request sync from connected peer(s)
   */
  const requestSync = async (): Promise<void> => {
    try {
      await dbSyncService.requestSync();
    } catch (error) {
      console.error('Sync request error:', error);
      throw error;
    }
  };
  
  // Provide connection context to children
  return (
    <ConnectionContext.Provider
      value={{
        connectionState,
        syncProgress,
        initAsHost,
        connect,
        disconnect,
        requestSync
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};