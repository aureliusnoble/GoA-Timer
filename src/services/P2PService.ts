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
    peerCount: 0
  };
  private options: P2POptions;
  
  constructor(options: P2POptions = {}) {
    this.options = {
      debug: false,
      ...options
    };
    
    // Add the primary data listener if provided
    if (options.onData) {
      this.dataListeners.add(options.onData);
    }
  }
  
  /**
   * Initialize as host with a generated connection code
   * @returns Promise resolving to the connection code
   */
  public async initAsHost(): Promise<string> {
    const connectionCode = this.generateConnectionCode();
    
    this.updateState({
      isHost: true,
      isConnecting: true,
      connectionCode
    });
    
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
          
          // Set up connection listeners
          this.setupPeerListeners();
          
          resolve(id);
        });
        
        this.peer.on('error', (err) => {
          clearTimeout(timeout);
          
          // If the ID is taken, try again with a new code
          if (err.type === 'unavailable-id') {
            this.log('Connection code already in use, generating new one');
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
    
    this.updateState({
      isHost: false,
      isConnecting: true,
      connectionCode
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
            error: 'Connection timed out. Please try again.'
          });
        }, 15000); // 15 seconds timeout
        
        // Create peer with random ID
        this.peer = new Peer({
          debug: this.options.debug ? 2 : 0
        });
        
        this.peer.on('open', (myId) => {
          this.log('Initialized with ID:', myId);
          
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
   * Send data to all connected peers
   * @param data Any JSON-serializable data
   * @returns True if sent successfully, false otherwise
   */
  public send(data: any): boolean {
    if (this.connections.size === 0) {
      this.updateState({
        error: 'Cannot send data: not connected to any peers'
      });
      return false;
    }
    
    try {
      // Send to all connections
      for (const conn of this.connections.values()) {
        if (conn.open) {
          conn.send(data);
        }
      }
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
    this.cleanupPeer();
    
    this.updateState({
      isConnecting: false,
      isConnected: false,
      connectionCode: null,
      error: null,
      peerCount: 0
    });
  }
  
  /**
   * Set up listeners for peer events
   */
  private setupPeerListeners(): void {
    if (!this.peer) return;
    
    // Handle incoming connections (when acting as host)
    this.peer.on('connection', (conn) => {
      this.log('Incoming connection from peer:', conn.peer);
      this.handleIncomingConnection(conn);
    });
    
    this.peer.on('disconnected', () => {
      this.log('Disconnected from PeerJS server');
      
      // Try to reconnect to the signaling server
      if (this.peer) {
        this.peer.reconnect();
      }
    });
    
    this.peer.on('close', () => {
      this.log('Peer connection closed');
      this.updateState({
        isConnected: false,
        isConnecting: false,
        peerCount: 0
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
    // Save the connection
    this.connections.set(conn.peer, conn);
    
    conn.on('open', () => {
      this.log('Connection opened to peer:', conn.peer);
      
      this.updateState({
        isConnecting: false,
        isConnected: true,
        error: null,
        peerCount: this.connections.size
      });
    });
    
    conn.on('data', (data) => {
      this.log('Received data from peer:', conn.peer);
      this.notifyDataListeners(data);
    });
    
    conn.on('close', () => {
      this.log('Connection closed from peer:', conn.peer);
      this.connections.delete(conn.peer);
      
      this.updateState({
        peerCount: this.connections.size,
        isConnected: this.connections.size > 0
      });
    });
    
    conn.on('error', (err) => {
      this.handleError(`Connection error with peer ${conn.peer}`, err);
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
    
    conn.on('open', () => {
      clearTimeout(timeout);
      this.log('Connection opened to host:', conn.peer);
      
      // Save the connection
      this.connections.set(conn.peer, conn);
      
      this.updateState({
        isConnecting: false,
        isConnected: true,
        error: null,
        peerCount: this.connections.size
      });
      
      resolve();
    });
    
    conn.on('data', (data) => {
      this.log('Received data from host:', conn.peer);
      this.notifyDataListeners(data);
    });
    
    conn.on('close', () => {
      this.log('Connection closed from host:', conn.peer);
      this.connections.delete(conn.peer);
      
      this.updateState({
        peerCount: this.connections.size,
        isConnected: this.connections.size > 0
      });
    });
    
    conn.on('error', (err) => {
      clearTimeout(timeout);
      this.handleError(`Connection error with host ${conn.peer}`, err);
      reject(err);
    });
  }
  
  /**
   * Clean up peer and connections
   */
  private cleanupPeer(): void {
    // Close all active connections
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear();
    
    // Close and destroy peer
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.peer = null;
    }
  }
  
  /**
   * Handle errors and update state
   * @param message Error message prefix
   * @param error Error object or string
   */
  private handleError(message: string, error: any): void {
    let errorMessage: string;
    
    // Extract more specific error information from PeerJS errors
    if (error && typeof error === 'object' && error.type) {
      switch (error.type) {
        case 'peer-unavailable':
          errorMessage = `${message}: The connection code is invalid or the host is no longer available`;
          break;
        case 'disconnected':
          errorMessage = `${message}: Connection to signaling server lost`;
          break;
        case 'server-error':
          errorMessage = `${message}: WebRTC server error`;
          break;
        case 'socket-error':
          errorMessage = `${message}: Network connection issue`;
          break;
        case 'socket-closed':
          errorMessage = `${message}: Connection closed unexpectedly`;
          break;
        default:
          errorMessage = `${message}: ${error.type || error.message || 'Unknown error'}`;
      }
    } else {
      errorMessage = `${message}: ${error?.message || error || 'Unknown error'}`;
    }
    
    this.log('ERROR:', errorMessage, error);
    
    // Update connection state to not connecting
    this.updateState({
      isConnecting: false,
      error: errorMessage
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
   * Conditional logger
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[P2PService]', ...args);
    }
  }
}