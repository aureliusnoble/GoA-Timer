// src/services/P2PService.ts
import Peer, { DataConnection } from 'peerjs';

/**
 * Connection state interface for tracking P2P connection status
 */
export interface ConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connectionCode: string | null;
  isHost: boolean;
  peerCount: number;
  // Added new field to track detailed status
  detailedStatus?: string;
}

/**
 * Options for initializing the P2P service
 */
export interface P2POptions {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onData?: (data: any) => void;
  debug?: boolean;
}

/**
 * P2P Service powered by PeerJS for WebRTC connections
 * Provides methods to create and join connections using simple
 * human-readable connection codes
 */
export class P2PService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private dataListeners: Set<(data: any) => void> = new Set();
  private connectionStateChangeHandler: ((state: ConnectionState) => void) | null = null;
  private connectionState: ConnectionState = {
    isConnecting: false,
    isConnected: false,
    error: null,
    connectionCode: null,
    isHost: false,
    peerCount: 0,
    detailedStatus: 'Initialized'
  };
  private options: P2POptions;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  
  constructor(options: P2POptions = {}) {
    this.options = {
      debug: false,
      ...options
    };
    
    // Add the primary data listener if provided
    if (options.onData) {
      this.dataListeners.add(options.onData);
    }
    
    this.logConnectionStatus("P2PService initialized");
  }
  
  /**
   * Initialize as host with a generated connection code
   * @returns Promise resolving to the connection code
   */
  public async initAsHost(): Promise<string> {
    const connectionCode = this.generateConnectionCode();
    
    // Immediately update state with connection code
    this.updateState({
      isHost: true,
      isConnecting: true,
      connectionCode,
      detailedStatus: "Initializing as host"
    });
    
    // Return the code immediately so UI can show it
    this.log('Generated connection code:', connectionCode);
    
    // Then continue establishing the actual connection
    return new Promise((resolve, reject) => {
      try {
        // Clean up any existing peer
        this.cleanupPeer();
        
        // Create timeout for initialization
        const timeout = setTimeout(() => {
          reject(new Error('PeerJS initialization timeout'));
        }, 15000); // 15 seconds timeout
        
        // Initialize PeerJS with the connection code as ID
        this.peer = new Peer(connectionCode, {
          debug: this.options.debug ? 2 : 0
        });
        
        this.peer.on('open', (id) => {
          clearTimeout(timeout);
          this.log('Host initialized with ID:', id);
          this.logConnectionStatus("Host peer opened, waiting for connections");
          
          // Set up connection listeners
          this.setupPeerListeners();
          
          resolve(id);
        });
        
        this.peer.on('error', (err) => {
          clearTimeout(timeout);
          
          // If the ID is taken, try again with a new code
          if (err.type === 'unavailable-id') {
            this.log('Connection code already in use, generating new one');
            this.logConnectionStatus("Connection code in use, retrying");
            this.initAsHost().then(resolve).catch(reject);
            return;
          }
          
          this.handleError('Failed to initialize as host', err);
          reject(err);
        });
      } catch (error) {
        this.handleError('Failed to initialize as host', error);
        reject(error);
      }
    });
  }
  

/**
 * Connect to an existing session using a connection code
 * @param connectionCode The host's connection code to join
 * @returns Promise that resolves when connection is established
 */
public async connect(connectionCode: string): Promise<void> {
  if (!connectionCode) {
    throw new Error('Connection code is required');
  }
  
  connectionCode = connectionCode.trim().toUpperCase();
  
  // Check if we're already connected to this peer
  if (this.connectionState.isConnected && 
      this.connectionState.connectionCode === connectionCode &&
      this.connections.size > 0) {
    
    console.log('Already connected to', connectionCode);
    
    // Just validate the connection is actually working
    const isHealthy = await this.checkConnectionHealth();
    if (isHealthy) {
      console.log('Connection is healthy, no need to reconnect');
      return;
    } else {
      console.log('Connection is not healthy despite appearing connected, will reconnect');
      // Clean up before attempting a new connection
      this.cleanupPeer();
    }
  }
  
  this.updateState({
    isHost: false,
    isConnecting: true,
    connectionCode,
    detailedStatus: `Connecting to host: ${connectionCode}`
  });
  
  return new Promise((resolve, reject) => {
    try {
      // Clean up any existing peer
      this.cleanupPeer();
      
      // Connection timeout
      const timeout = setTimeout(() => {
        reject(new Error('PeerJS initialization timeout'));
        this.updateState({
          isConnecting: false,
          error: 'Connection timed out. Please try again.',
          detailedStatus: 'Connection timeout'
        });
      }, 15000); // 15 seconds timeout
      
      // Create peer with random ID
      this.peer = new Peer({
        debug: this.options.debug ? 2 : 0
      });
      
      this.peer.on('open', (myId) => {
        this.log('Initialized with ID:', myId);
        this.logConnectionStatus(`Client peer opened with ID ${myId}, connecting to ${connectionCode}`);
        
        // Set up general peer event listeners
        this.setupPeerListeners();
        
        // Make sure peer is still available before connecting
        if (!this.peer) {
          clearTimeout(timeout);
          reject(new Error('Peer connection was lost'));
          return;
        }
        
        // Connect to the host using their connection code
        try {
          this.log(`Attempting to connect to host ${connectionCode}`);
          const conn = this.peer.connect(connectionCode, {
            reliable: true,
            serialization: 'json'
          });
          
          this.handleOutgoingConnection(conn, () => {
            clearTimeout(timeout);
            resolve();
          }, (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        } catch (err) {
          clearTimeout(timeout);
          this.handleError('Failed to connect to peer', err);
          reject(err);
        }
      });
      
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        this.handleError('Connection error', err);
        reject(err);
      });
    } catch (error) {
      this.handleError('Failed to connect', error);
      reject(error);
    }
  });
}


/**
 * Check if current connections are healthy
 * @returns True if connections are healthy
 */
private async checkConnectionHealth(): Promise<boolean> {
  // If no connections, health check fails
  if (this.connections.size === 0) {
    return false;
  }
  
  try {
    // Send a ping/pong message to verify connection
    return new Promise((resolve) => {
      // Set timeout for health check
      const timeout = setTimeout(() => {
        this.log('Health check timed out');
        resolve(false);
      }, 3000);
      
      // Create one-time listener for health check response
      const responseHandler = (data: any) => {
        if (data && data.type === 'health-check-response') {
          clearTimeout(timeout);
          // Remove listener
          this.removeDataListener(responseHandler);
          resolve(true);
        }
      };
      
      // Add listener
      this.onData(responseHandler);
      
      // Send health check request to all connections
      const sendSuccess = this.send({
        type: 'health-check-request',
        timestamp: Date.now()
      });
      
      // If send fails immediately, connection is not healthy
      if (!sendSuccess) {
        clearTimeout(timeout);
        this.removeDataListener(responseHandler);
        resolve(false);
      }
    });
  } catch (error) {
    this.log('Error during health check:', error);
    return false;
  }
}

  
  /**
   * Send data to all connected peers
   * @param data Any JSON-serializable data
   * @returns True if sent successfully, false otherwise
   */
  public send(data: any): boolean {
    // Log verbose connection status before sending
    this.logConnectionStatus(`Attempting to send data, connections: ${this.connections.size}`);
    
    // Validate connections before sending
    if (!this.validateConnections()) {
      this.updateState({
        error: 'Cannot send data: not connected to any peers',
        detailedStatus: 'No active connections for sending'
      });
      return false;
    }
    
    try {
      let sentCount = 0;
      // Send to all connections
      for (const conn of this.connections.values()) {
        if (conn.open) {
          this.log(`Sending data to peer: ${conn.peer}`);
          conn.send(data);
          sentCount++;
        } else {
          this.log(`Connection to ${conn.peer} exists but is not open, skipping`);
        }
      }
      
      if (sentCount === 0) {
        this.updateState({
          error: 'Cannot send data: all connections are closed',
          detailedStatus: 'All connections closed'
        });
        return false;
      }
      
      this.log(`Successfully sent data to ${sentCount} peer(s)`);
      return true;
    } catch (error) {
      this.handleError('Failed to send data', error);
      return false;
    }
  }
  
  /**
   * Get the current connection state
   */
  public getState(): ConnectionState {
    return { ...this.connectionState };
  }
  
  /**
   * Register a listener for incoming data
   * @param listener Function to handle received data
   */
  public onData(listener: (data: any) => void): void {
    this.dataListeners.add(listener);
  }
  
  /**
   * Remove a previously registered data listener
   * @param listener The listener function to remove
   */
  public removeDataListener(listener: (data: any) => void): void {
    this.dataListeners.delete(listener);
  }
  
  /**
   * Disconnect from all peers and clean up resources
   */
  public disconnect(): void {
    this.log('Disconnecting from all peers');
    this.cleanupPeer();
    
    this.updateState({
      isConnecting: false,
      isConnected: false,
      connectionCode: null,
      error: null,
      peerCount: 0,
      detailedStatus: 'Disconnected'
    });
  }
  
  /**
   * Validate that we have at least one active connection
   * @returns True if there's at least one active connection
   */
  private validateConnections(): boolean {
    if (this.connections.size === 0) {
      this.log('No connections in the connections map');
      return false;
    }
    
    // Check if any connections are actually open
    let hasOpenConnection = false;
    for (const conn of this.connections.values()) {
      if (conn.open) {
        hasOpenConnection = true;
        break;
      }
    }
    
    if (!hasOpenConnection) {
      this.log('No open connections found despite having connection objects');
    }
    
    return hasOpenConnection;
  }
  
  /**
   * Set up listeners for peer events
   */
  private setupPeerListeners(): void {
    if (!this.peer) return;
    
    // Handle incoming connections (when acting as host)
    this.peer.on('connection', (conn) => {
      this.log('Incoming connection from peer:', conn.peer);
      this.logConnectionStatus(`Incoming connection from: ${conn.peer}`);
      this.handleIncomingConnection(conn);
    });
    
    this.peer.on('disconnected', () => {
      this.log('Disconnected from PeerJS server');
      this.logConnectionStatus('Disconnected from signaling server, attempting reconnect');
      
      // Try to reconnect to the signaling server
      if (this.peer && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.peer.reconnect();
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.log('Max reconnect attempts reached, giving up');
        this.updateState({
          isConnected: false,
          isConnecting: false,
          error: 'Connection lost and could not reconnect automatically',
          detailedStatus: 'Max reconnect attempts reached'
        });
      }
    });
    
    this.peer.on('close', () => {
      this.log('Peer connection closed');
      this.logConnectionStatus('Peer closed');
      this.updateState({
        isConnected: false,
        isConnecting: false,
        peerCount: 0,
        detailedStatus: 'Peer connection closed'
      });
    });
    
    this.peer.on('error', (err) => {
      this.handleError('Peer error', err);
    });
  }
  
  /**
   * Handle an incoming connection from a peer
   * @param conn The PeerJS DataConnection
   */
  private handleIncomingConnection(conn: DataConnection): void {
    this.log(`Handling incoming connection from ${conn.peer}`);
    
    // Save the connection immediately
    this.connections.set(conn.peer, conn);
    this.log(`Added connection to map, current size: ${this.connections.size}`);
    
    conn.on('open', () => {
      this.log('Connection opened to peer:', conn.peer);
      this.logConnectionStatus(`Connection opened with peer: ${conn.peer}`);
      
      // Update the connection status
      this.updateConnectionStateFromMap();
    });
    
    conn.on('data', (data) => {
      this.log('Received data from peer:', conn.peer);
      this.notifyDataListeners(data);
    });
    
    conn.on('close', () => {
      this.log('Connection closed from peer:', conn.peer);
      this.logConnectionStatus(`Connection closed from peer: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.log(`Removed connection from map, current size: ${this.connections.size}`);
      
      // Update connection status after removing the connection
      this.updateConnectionStateFromMap();
    });
    
    conn.on('error', (err) => {
      this.handleError(`Connection error with peer ${conn.peer}`, err);
      
      // Try to remove this problematic connection
      this.connections.delete(conn.peer);
      this.log(`Removed errored connection, current size: ${this.connections.size}`);
      
      // Update connection status
      this.updateConnectionStateFromMap();
    });
  }
  
  /**
   * Update connection state based on the connections map
   */
  private updateConnectionStateFromMap(): void {
    const openConnections = [...this.connections.values()].filter(conn => conn.open).length;
    
    this.log(`Updating connection state based on map: ${openConnections} open connections`);
    
    this.updateState({
      isConnected: openConnections > 0,
      isConnecting: false,
      error: null,
      peerCount: openConnections,
      detailedStatus: openConnections > 0 
        ? `Connected with ${openConnections} peer(s)` 
        : 'No active connections'
    });
  }
  
  /**
   * Handle an outgoing connection to a peer
   * @param conn The PeerJS DataConnection
   * @param resolve Promise resolution function
   * @param reject Promise rejection function 
   */
  private handleOutgoingConnection(
    conn: DataConnection, 
    resolve: () => void, 
    reject: (err: Error) => void
  ): void {
    // Set timeout for connection
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 15000);
    
    // Log the connection attempt
    this.log(`Attempting outgoing connection to ${conn.peer}`);
    
    conn.on('open', () => {
      clearTimeout(timeout);
      this.log('Connection opened to host:', conn.peer);
      this.logConnectionStatus(`Connection opened to host: ${conn.peer}`);
      
      // Save the connection
      this.connections.set(conn.peer, conn);
      this.log(`Added connection to map, current size: ${this.connections.size}`);
      
      // Update state based on map contents
      this.updateConnectionStateFromMap();
      
      resolve();
    });
    
    conn.on('data', (data) => {
      this.log('Received data from host:', conn.peer);
      this.notifyDataListeners(data);
    });
    
    conn.on('close', () => {
      this.log('Connection closed from host:', conn.peer);
      this.logConnectionStatus(`Connection closed from host: ${conn.peer}`);
      this.connections.delete(conn.peer);
      this.log(`Removed connection from map, current size: ${this.connections.size}`);
      
      // Update state based on map contents
      this.updateConnectionStateFromMap();
    });
    
    conn.on('error', (err) => {
      clearTimeout(timeout);
      this.handleError(`Connection error with host ${conn.peer}`, err);
      
      // Clean up problematic connection
      this.connections.delete(conn.peer);
      this.log(`Removed errored connection, current size: ${this.connections.size}`);
      
      // Update state
      this.updateConnectionStateFromMap();
      
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  }
  
  /**
   * Clean up peer and connections
   */
  private cleanupPeer(): void {
    this.log(`Cleaning up peer and ${this.connections.size} connections`);
    
    // Close all active connections
    for (const conn of this.connections.values()) {
      try {
        this.log(`Closing connection to ${conn.peer}`);
        conn.close();
      } catch (e) {
        this.log(`Error closing connection: ${e}`);
      }
    }
    this.connections.clear();
    this.log('Cleared all connections from map');
    
    // Close and destroy peer
    if (this.peer) {
      try {
        this.log('Destroying peer instance');
        this.peer.destroy();
      } catch (e) {
        this.log(`Error destroying peer: ${e}`);
      }
      this.peer = null;
    }
    
    // Reset reconnect counter
    this.reconnectAttempts = 0;
  }
  
  /**
   * Handle errors and update state
   * @param message Error message prefix
   * @param error Error object or string
   */
  private handleError(message: string, error: any): void {
    let errorMessage: string;
    let detailedStatus: string;
    
    // Extract more specific error information from PeerJS errors
    if (error && typeof error === 'object' && error.type) {
      switch (error.type) {
        case 'peer-unavailable':
          errorMessage = `${message}: The connection code is invalid or the host is no longer available`;
          detailedStatus = 'Host unavailable';
          break;
        case 'disconnected':
          errorMessage = `${message}: Connection to signaling server lost`;
          detailedStatus = 'Signaling server disconnected';
          break;
        case 'server-error':
          errorMessage = `${message}: WebRTC server error`;
          detailedStatus = 'WebRTC server error';
          break;
        case 'socket-error':
          errorMessage = `${message}: Network connection issue`;
          detailedStatus = 'Network connection issue';
          break;
        case 'socket-closed':
          errorMessage = `${message}: Connection closed unexpectedly`;
          detailedStatus = 'Connection closed unexpectedly';
          break;
        default:
          errorMessage = `${message}: ${error.type || error.message || 'Unknown error'}`;
          detailedStatus = `Error: ${error.type || 'Unknown'}`;
      }
    } else {
      errorMessage = `${message}: ${error?.message || error || 'Unknown error'}`;
      detailedStatus = 'Unknown error occurred';
    }
    
    this.log('ERROR:', errorMessage, error);
    
    // Update connection state to not connecting
    this.updateState({
      isConnecting: false,
      error: errorMessage,
      detailedStatus: detailedStatus
    });
  }
  
  /**
   * Set connection state change handler
   * @param handler Function to call when connection state changes
   */
  public set onConnectionStateChange(handler: ((state: ConnectionState) => void) | null) {
    this.connectionStateChangeHandler = handler;
  }
  
  /**
   * Update connection state and notify listeners
   * @param updates State properties to update
   */
  private updateState(updates: Partial<ConnectionState>): void {
    this.connectionState = {
      ...this.connectionState,
      ...updates
    };
    
    // Log significant state changes
    if (updates.isConnected !== undefined || 
        updates.isConnecting !== undefined || 
        updates.error !== undefined ||
        updates.peerCount !== undefined) {
      this.log(`State updated: connected=${this.connectionState.isConnected}, connecting=${this.connectionState.isConnecting}, peers=${this.connectionState.peerCount}, error=${this.connectionState.error ? 'yes' : 'no'}`);
    }
    
    // Notify via options callback if provided
    if (this.options.onConnectionStateChange) {
      this.options.onConnectionStateChange(this.connectionState);
    }
    
    // Notify via the setter method if set
    if (this.connectionStateChangeHandler) {
      this.connectionStateChangeHandler(this.connectionState);
    }
  }
  
  /**
   * Notify all data listeners
   * @param data The received data
   */
  private notifyDataListeners(data: any): void {
    this.dataListeners.forEach(listener => {
      try {
        listener(data);
      } catch (e) {
        this.log('Error in data listener:', e);
      }
    });
  }
  
  /**
   * Generate a human-friendly connection code
   * Using characters that are less likely to be confused
   */
  private generateConnectionCode(length: number = 6): string {
    // Exclude confusing characters like 0/O, 1/I, etc.
    const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * allowedChars.length);
      code += allowedChars[randomIndex];
    }
    
    return code;
  }
  
  /**
   * Log detailed connection status
   */
  private logConnectionStatus(status: string): void {
    this.log(`CONNECTION STATUS: ${status} (connections: ${this.connections.size}, connected: ${this.connectionState.isConnected})`);
  }
  
  /**
   * Conditional logger
   */
  private log(...args: any[]): void {
    // Always log connection errors for debugging
    if (args[0] === 'ERROR:' || this.options.debug) {
      console.log('[P2PService]', ...args);
    }
  }
}