// src/services/DatabaseSyncService.ts
import { P2PService } from './P2PService';
import dbService, { ExportData } from './DatabaseService';

/**
 * Sync progress interface for tracking data transfer status
 */
export interface SyncProgress {
  percent: number;
  status: 'idle' | 'preparing' | 'sending' | 'receiving' | 'processing' | 'complete' | 'error' | 'pending-confirmation' | 'awaiting-confirmation' | 'reconnecting';
  message: string;
  isDataRequest?: boolean; // Indicates if this is a request for data (true) or a send of data (false)
  error?: string; // Added for detailed error reporting
}

/**
 * Message types for P2P sync protocol
 */
export enum SyncMessageType {
  // Data request messages
  REQUEST_DATA = 'db-sync-request-data',
  REQUEST_CONFIRM = 'db-sync-request-confirm',
  REQUEST_REJECT = 'db-sync-request-reject',
  
  // Data send messages
  SEND_DATA_REQUEST = 'db-sync-send-data-request',
  SEND_DATA_CONFIRM = 'db-sync-send-data-confirm',
  SEND_DATA_REJECT = 'db-sync-send-data-reject',
  
  // Data transfer messages
  DATA = 'db-sync-data',
  CHUNK = 'db-sync-chunk',
  CHUNK_ACK = 'db-sync-chunk-ack',
  COMPLETE = 'db-sync-complete',
  ERROR = 'db-sync-error',
  INFO = 'db-sync-info',
  
  // Health check messages
  HEALTHCHECK = 'db-sync-healthcheck',
  HEALTHCHECK_RESPONSE = 'db-sync-healthcheck-response'
}

/**
 * Sync message interface for P2P data exchange
 */
interface SyncMessage {
  type: SyncMessageType;
  payload?: any;
  chunkId?: number;
  totalChunks?: number;
  isLast?: boolean;
}

/**
 * Database synchronization service for P2P data sharing
 * Handles the extraction and merging of database data between peers
 */
export class DatabaseSyncService {
  private p2pService: P2PService;
  private onProgressCallback: ((progress: SyncProgress) => void) | null = null;
  private chunkSize = 10 * 1024; // Reduced chunk size to 10KB for better reliability
  private syncInProgress = false;
  private receivedChunks: Map<number, string> = new Map();
  private totalExpectedChunks = 0;
  private transferStartTime = 0;
  private currentOperationId: string | null = null;
  private currentProgress: SyncProgress = {
    percent: 0,
    status: 'idle',
    message: 'Ready to sync'
  };
  // Retry-related properties
  private retryCount = 0;
  private maxRetries = 5; // Increased retry attempts
  private chunkRetryCount: Map<number, number> = new Map();
  private maxChunkRetries = 3;
  private healthcheckInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(p2pService: P2PService) {
    this.p2pService = p2pService;
    console.log('[DatabaseSyncService] Initialized');
    
    // Listen for sync messages
    this.p2pService.onData(this.handleSyncMessage.bind(this));
  }
  
  /**
   * Request database sync from connected peer(s)
   */
  public async requestData(): Promise<void> {
    console.log('[DatabaseSyncService] requestData called');
    
    const connectionState = this.p2pService.getState();
    console.log('[DatabaseSyncService] Current connection state:', 
                 connectionState.isConnected ? 'connected' : 'disconnected',
                 'peers:', connectionState.peerCount);
                 
    if (!connectionState.isConnected) {
      console.error('[DatabaseSyncService] Not connected to any peers');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Not connected to any peers',
        error: 'Connection is not active'
      });
      throw new Error('Not connected to any peers');
    }
    
    if (this.syncInProgress) {
      console.error('[DatabaseSyncService] Sync already in progress');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Sync already in progress',
        error: 'Sync operation is already running'
      });
      throw new Error('Sync already in progress');
    }
    
    // Send a health check message first to verify the connection is active
    const isHealthy = await this.performConnectionHealthCheck();
    if (!isHealthy) {
      console.error('[DatabaseSyncService] Connection health check failed');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Connection health check failed. Try disconnecting and reconnecting.',
        error: 'Connection health check failed'
      });
      throw new Error('Connection health check failed');
    }
    
    this.syncInProgress = true;
    this.currentOperationId = this.generateOperationId();
    this.retryCount = 0;
    
    console.log('[DatabaseSyncService] Starting data request with operation ID:', this.currentOperationId);
    
    // Update progress to show we're waiting for confirmation
    this.updateProgress({
      percent: 0,
      status: 'awaiting-confirmation',
      message: 'Waiting for the other device to approve data request',
      isDataRequest: true
    });
    
    // Send data request message
    const sendResult = this.p2pService.send({
      type: SyncMessageType.REQUEST_DATA,
      payload: {
        operationId: this.currentOperationId
      }
    });
    
    // If send fails immediately, update progress and throw
    if (!sendResult) {
      console.error('[DatabaseSyncService] Failed to send data request');
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Failed to send data request. Try reconnecting.',
        error: 'Message sending failed'
      });
      throw new Error('Failed to send data request');
    }
    
    // Start healthcheck interval
    this.startHealthcheckInterval();
  }
  
  /**
   * Send database data to connected peer(s)
   */
  public async sendData(): Promise<void> {
    console.log('[DatabaseSyncService] sendData called');
    
    const connectionState = this.p2pService.getState();
    console.log('[DatabaseSyncService] Current connection state:', 
                 connectionState.isConnected ? 'connected' : 'disconnected',
                 'peers:', connectionState.peerCount);
                 
    if (!connectionState.isConnected) {
      console.error('[DatabaseSyncService] Not connected to any peers');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Not connected to any peers',
        error: 'Connection is not active'
      });
      throw new Error('Not connected to any peers');
    }
    
    if (this.syncInProgress) {
      console.error('[DatabaseSyncService] Sync already in progress');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Sync already in progress',
        error: 'Sync operation is already running'
      });
      throw new Error('Sync already in progress');
    }
    
    // Send a health check message first to verify the connection is active
    const isHealthy = await this.performConnectionHealthCheck();
    if (!isHealthy) {
      console.error('[DatabaseSyncService] Connection health check failed');
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Connection health check failed. Try disconnecting and reconnecting.',
        error: 'Connection health check failed'
      });
      throw new Error('Connection health check failed');
    }
    
    this.syncInProgress = true;
    this.currentOperationId = this.generateOperationId();
    this.retryCount = 0;
    this.chunkRetryCount.clear();
    
    console.log('[DatabaseSyncService] Starting data send with operation ID:', this.currentOperationId);
    
    // Update progress to show we're waiting for confirmation
    this.updateProgress({
      percent: 0,
      status: 'awaiting-confirmation',
      message: 'Waiting for the other device to accept data',
      isDataRequest: false
    });
    
    // Send data request message
    const sendResult = this.p2pService.send({
      type: SyncMessageType.SEND_DATA_REQUEST,
      payload: {
        operationId: this.currentOperationId
      }
    });
    
    // If send fails immediately, update progress and throw
    if (!sendResult) {
      console.error('[DatabaseSyncService] Failed to send data request');
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Failed to send data request. Try reconnecting.',
        error: 'Message sending failed'
      });
      throw new Error('Failed to send data request');
    }
    
    // Start healthcheck interval
    this.startHealthcheckInterval();
  }
  
  /**
   * Perform a connection health check
   * @returns Promise resolving to true if connection is healthy
   */
  private async performConnectionHealthCheck(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      console.log('[DatabaseSyncService] Performing connection health check');
      
      // Increase timeout from 5000ms to 8000ms for more reliability
      const timeout = setTimeout(() => {
        console.error('[DatabaseSyncService] Health check timed out');
        // Remove the temporary listener before resolving
        this.p2pService.removeDataListener(healthCheckListener);
        resolve(false);
      }, 8000);
      
      // Create a one-time listener for the health check response
      const healthCheckListener = (message: any) => {
        if (message && message.type === SyncMessageType.HEALTHCHECK_RESPONSE) {
          console.log('[DatabaseSyncService] Received health check response in listener');
          clearTimeout(timeout);
          // Remove the temporary listener
          this.p2pService.removeDataListener(healthCheckListener);
          resolve(true);
        }
      };
      
      // Add the listener before sending the message
      this.p2pService.onData(healthCheckListener);
      
      // Send the health check message
      const sendResult = this.p2pService.send({
        type: SyncMessageType.HEALTHCHECK
      });
      
      // If send fails immediately, fail the health check
      if (!sendResult) {
        console.error('[DatabaseSyncService] Failed to send health check');
        clearTimeout(timeout);
        this.p2pService.removeDataListener(healthCheckListener);
        resolve(false);
      }
    });
  }
  
  /**
   * Start a healthcheck interval to detect connection issues
   */
  private startHealthcheckInterval(): void {
    // Clear any existing interval
    this.stopHealthcheckInterval();
    
    // Set a new interval with longer delay (20 seconds instead of 10)
    this.healthcheckInterval = setInterval(() => {
      // Only check if sync is in progress and we're still waiting for confirmation
      if (this.syncInProgress && 
         (this.currentProgress.status === 'awaiting-confirmation' || 
          this.currentProgress.status === 'pending-confirmation')) {
        
        console.log('[DatabaseSyncService] Performing periodic health check');
        this.performConnectionHealthCheck().then(isHealthy => {
          if (!isHealthy) {
            console.error('[DatabaseSyncService] Periodic health check failed');
            
            // Add a retry attempt before failing completely
            if (this.retryCount < this.maxRetries) {
              this.retryCount++;
              console.log(`[DatabaseSyncService] Retrying health check (${this.retryCount}/${this.maxRetries})`);
              
              // Update progress to show retry
              this.updateProgress({
                percent: 0,
                status: 'reconnecting',
                message: `Connection issue detected, retrying (${this.retryCount}/${this.maxRetries})...`,
                isDataRequest: this.currentProgress.isDataRequest
              });
              
              // Don't fail immediately, give it a chance to recover
              return;
            }
            
            // Only show error if we're still in a waiting state after max retries
            if (this.currentProgress.status === 'awaiting-confirmation' || 
                this.currentProgress.status === 'pending-confirmation') {
              this.updateProgress({
                percent: 0,
                status: 'error',
                message: 'Connection was lost while waiting for confirmation',
                error: 'Connection health check failed after multiple attempts'
              });
              this.syncInProgress = false;
              this.currentOperationId = null;
              this.stopHealthcheckInterval();
            }
          } else {
            // Reset retry count on successful health check
            this.retryCount = 0;
          }
        });
      } else {
        // If no longer in these states, stop the interval
        this.stopHealthcheckInterval();
      }
    }, 20000); // Check every 20 seconds instead of 10
  }
  
  /**
   * Stop the healthcheck interval
   */
  private stopHealthcheckInterval(): void {
    if (this.healthcheckInterval) {
      clearInterval(this.healthcheckInterval);
      this.healthcheckInterval = null;
    }
  }
  
  
  /**
 * Confirm a data operation (sending or receiving)
 */
public confirmDataOperation(): void {
  console.log('[DatabaseSyncService] confirmDataOperation called, current status:', this.currentProgress.status);
  
  if (this.currentProgress.status === 'pending-confirmation') {
    // Verify connection state before proceeding
    const connectionState = this.p2pService.getState();
    if (!connectionState.isConnected || connectionState.peerCount === 0) {
      console.error('[DatabaseSyncService] Cannot confirm - connection lost');
      
      // Try to reconnect if we have a connection code
      const connectionCode = connectionState.connectionCode;
      if (connectionCode) {
        this.attemptReconnection(connectionCode).then(success => {
          if (success) {
            console.log('[DatabaseSyncService] Reconnection successful, retrying confirm');
            // Wait a moment for reconnection to stabilize
            setTimeout(() => this.confirmDataOperation(), 1000);
          } else {
            this.updateProgress({
              percent: 0,
              status: 'error',
              message: 'Connection lost and reconnection failed. Please try again.',
              error: 'Reconnection failed'
            });
            this.syncInProgress = false;
            this.currentOperationId = null;
          }
        });
      } else {
        this.updateProgress({
          percent: 0,
          status: 'error',
          message: 'Connection lost. Please reconnect and try again.',
          error: 'Connection lost'
        });
        this.syncInProgress = false;
        this.currentOperationId = null;
      }
      return;
    }
    
    const isDataRequest = this.currentProgress.isDataRequest;
    
    if (isDataRequest) {
      // We're being asked to send data
      console.log('[DatabaseSyncService] Confirming data request, sending data');
      this.handleSendDataAfterConfirmation();
    } else {
      // We're being asked to receive data
      console.log('[DatabaseSyncService] Confirming data send request, ready to receive');
      const sendResult = this.p2pService.send({
        type: SyncMessageType.SEND_DATA_CONFIRM,
        payload: {
          operationId: this.currentOperationId
        }
      });
      
      if (!sendResult) {
        console.error('[DatabaseSyncService] Failed to send confirmation');
        
        // Try to reconnect
        const connectionCode = this.p2pService.getState().connectionCode;
        if (connectionCode) {
          this.attemptReconnection(connectionCode).then(success => {
            if (success) {
              console.log('[DatabaseSyncService] Reconnection successful, retrying confirm');
              setTimeout(() => this.confirmDataOperation(), 1000);
            } else {
              this.updateProgress({
                percent: 0,
                status: 'error',
                message: 'Failed to send confirmation and reconnection failed. Please try again.',
                error: 'Confirmation failed'
              });
              this.syncInProgress = false;
              this.currentOperationId = null;
            }
          });
          return;
        }
        
        this.updateProgress({
          percent: 0,
          status: 'error',
          message: 'Failed to send confirmation. Try reconnecting.',
          error: 'Message sending failed'
        });
        this.syncInProgress = false;
        this.currentOperationId = null;
        return;
      }
      
      this.updateProgress({
        percent: 0,
        status: 'preparing',
        message: 'Preparing to receive data'
      });
    }
  } else {
    console.warn('[DatabaseSyncService] confirmDataOperation called when not in pending-confirmation state');
  }
}

/**
 * Attempt reconnection with the provided code
 * @param code The connection code to reconnect with
 * @returns Promise resolving to true if reconnection successful
 */
private async attemptReconnection(code: string): Promise<boolean> {
  this.updateProgress({
    percent: 0,
    status: 'reconnecting',
    message: 'Connection lost - attempting to reconnect...'
  });
  
  console.log(`[DatabaseSyncService] Attempting to reconnect with code: ${code}`);
  
  try {
    // First verify connection is actually disconnected
    const currentState = this.p2pService.getState();
    if (currentState.isConnected && currentState.peerCount > 0) {
      console.log('[DatabaseSyncService] Already connected, no need to reconnect');
      return true;
    }
    
    // Try up to 3 reconnection attempts
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[DatabaseSyncService] Reconnection attempt ${attempt}/3`);
      
      // Add increasing delay between attempts
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
      try {
        await this.p2pService.connect(code);
        
        // Verify connection was successful
        const newState = this.p2pService.getState();
        if (newState.isConnected && newState.peerCount > 0) {
          console.log('[DatabaseSyncService] Reconnection successful');
          return true;
        }
      } catch (error) {
        console.error(`[DatabaseSyncService] Reconnection attempt ${attempt} failed:`, error);
      }
    }
    
    console.error('[DatabaseSyncService] All reconnection attempts failed');
    return false;
  } catch (error) {
    console.error('[DatabaseSyncService] Error during reconnection:', error);
    return false;
  }
}
  
  /**
   * Reject a data operation (sending or receiving)
   */
  public rejectDataOperation(): void {
    console.log('[DatabaseSyncService] rejectDataOperation called, current status:', this.currentProgress.status);
    
    if (this.currentProgress.status === 'pending-confirmation') {
      const isDataRequest = this.currentProgress.isDataRequest;
      
      if (isDataRequest) {
        // Reject request to send data
        console.log('[DatabaseSyncService] Rejecting data request');
        const sendResult = this.p2pService.send({
          type: SyncMessageType.REQUEST_REJECT,
          payload: {
            operationId: this.currentOperationId
          }
        });
        
        if (!sendResult) {
          console.warn('[DatabaseSyncService] Failed to send rejection, but continuing with local state reset');
        }
      } else {
        // Reject incoming data
        console.log('[DatabaseSyncService] Rejecting data send request');
        const sendResult = this.p2pService.send({
          type: SyncMessageType.SEND_DATA_REJECT,
          payload: {
            operationId: this.currentOperationId
          }
        });
        
        if (!sendResult) {
          console.warn('[DatabaseSyncService] Failed to send rejection, but continuing with local state reset');
        }
      }
    } else if (this.currentProgress.status === 'awaiting-confirmation') {
      console.log('[DatabaseSyncService] Cancelling our own operation while awaiting confirmation');
      // No need to send a message, just reset state
    } else {
      console.warn('[DatabaseSyncService] rejectDataOperation called when not in expected state');
    }
    
    // Reset the sync state regardless of message send success
    this.syncInProgress = false;
    this.currentOperationId = null;
    this.stopHealthcheckInterval();
    
    // Update progress to idle
    this.updateProgress({
      percent: 0,
      status: 'idle',
      message: 'Ready to sync'
    });
  }
  
  /**
   * Register progress callback function
   */
  public onProgress(callback: (progress: SyncProgress) => void): void {
    this.onProgressCallback = callback;
  }
  
  /**
   * Handle incoming sync messages
   */
  private handleSyncMessage(message: SyncMessage): void {
    if (!message || !message.type) {
      console.warn('[DatabaseSyncService] Received malformed message:', message);
      return;
    }
    
    console.log('[DatabaseSyncService] Received message type:', message.type);
    
    switch (message.type) {
      // Health check messages
      case SyncMessageType.HEALTHCHECK:
        console.log('[DatabaseSyncService] Responding to health check');
        this.p2pService.send({
          type: SyncMessageType.HEALTHCHECK_RESPONSE
        });
        break;
      
      case SyncMessageType.HEALTHCHECK_RESPONSE:
        // This response is already handled by the health check promise
        console.log('[DatabaseSyncService] Received health check response');
        // No action needed here as the specific listener in performConnectionHealthCheck handles this
        break;
      
      // Handle data request
      case SyncMessageType.REQUEST_DATA:
        this.handleDataRequest(message.payload);
        break;
      
      // Handle data request confirmation/rejection
      case SyncMessageType.REQUEST_CONFIRM:
        this.handleDataRequestConfirmation(message.payload);
        break;
      case SyncMessageType.REQUEST_REJECT:
        this.handleDataRequestRejection(message.payload);
        break;
      
      // Handle data send request
      case SyncMessageType.SEND_DATA_REQUEST:
        this.handleSendDataRequest(message.payload);
        break;
      
      // Handle data send confirmation/rejection
      case SyncMessageType.SEND_DATA_CONFIRM:
        this.handleSendDataConfirmation(message.payload);
        break;
      case SyncMessageType.SEND_DATA_REJECT:
        this.handleSendDataRejection(message.payload);
        break;
      
      // Handle direct data transfer
      case SyncMessageType.DATA:
        this.handleDirectData(message.payload);
        break;
      
      // Handle chunked data transfer
      case SyncMessageType.CHUNK:
        this.handleDataChunk(message);
        break;
      case SyncMessageType.CHUNK_ACK:
        // This is handled in the sendLargeData promise
        console.log('[DatabaseSyncService] Received chunk acknowledgment');
        break;
      
      // Handle errors and info messages
      case SyncMessageType.ERROR:
        console.error('[DatabaseSyncService] Received error from peer:', message.payload?.message);
        this.updateProgress({
          percent: 0,
          status: 'error',
          message: `Peer error: ${message.payload?.message || 'Unknown error'}`,
          error: message.payload?.message
        });
        this.syncInProgress = false;
        this.currentOperationId = null;
        this.stopHealthcheckInterval();
        break;
      
      case SyncMessageType.INFO:
        console.log('[DatabaseSyncService] Info from peer:', message.payload);
        break;
        
      default:
        console.warn('[DatabaseSyncService] Received unknown message type:', message.type);
    }
  }
  
  /**
   * Handle a request for data from a peer
   */
  private handleDataRequest(payload: any): void {
    console.log('[DatabaseSyncService] Handling data request:', payload);
    
    if (this.syncInProgress) {
      // Reject the request if we're already in a sync
      console.warn('[DatabaseSyncService] Rejecting data request because sync is already in progress');
      this.p2pService.send({
        type: SyncMessageType.REQUEST_REJECT,
        payload: {
          operationId: payload?.operationId,
          message: 'Sync already in progress'
        }
      });
      return;
    }
    
    // Set up state for this operation
    this.syncInProgress = true;
    this.currentOperationId = payload?.operationId;
    
    console.log('[DatabaseSyncService] Set up for data request, operation ID:', this.currentOperationId);
    
    // Update progress to show confirmation request
    this.updateProgress({
      percent: 0,
      status: 'pending-confirmation',
      message: 'The connected device is requesting your match data',
      isDataRequest: true
    });
  }
  
  /**
   * Handle confirmation of our data request
   */
  private handleDataRequestConfirmation(payload: any): void {
    console.log('[DatabaseSyncService] Handling data request confirmation:', payload);
    
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('[DatabaseSyncService] Received confirmation for unknown operation:', payload?.operationId);
      return;
    }
    
    // Stop healthcheck as we're moving to the next phase
    this.stopHealthcheckInterval();
    
    // Update progress
    this.updateProgress({
      percent: 0,
      status: 'preparing',
      message: 'Request approved, receiving data...'
    });
  }
  
  /**
   * Handle rejection of our data request
   */
  private handleDataRequestRejection(payload: any): void {
    console.log('[DatabaseSyncService] Handling data request rejection:', payload);
    
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('[DatabaseSyncService] Received rejection for unknown operation:', payload?.operationId);
      return;
    }
    
    // Stop healthcheck interval
    this.stopHealthcheckInterval();
    
    // Update progress and reset state
    this.updateProgress({
      percent: 0,
      status: 'error',
      message: 'Data request was declined by the other device',
      error: 'Request rejected by peer'
    });
    
    this.syncInProgress = false;
    this.currentOperationId = null;
  }
  
  /**
   * Handle a request to send data to us
   */
  private handleSendDataRequest(payload: any): void {
    console.log('[DatabaseSyncService] Handling send data request:', payload);
    
    if (this.syncInProgress) {
      // Reject the request if we're already in a sync
      console.warn('[DatabaseSyncService] Rejecting send data request because sync is already in progress');
      this.p2pService.send({
        type: SyncMessageType.SEND_DATA_REJECT,
        payload: {
          operationId: payload?.operationId,
          message: 'Sync already in progress'
        }
      });
      return;
    }
    
    // Set up state for this operation
    this.syncInProgress = true;
    this.currentOperationId = payload?.operationId;
    
    console.log('[DatabaseSyncService] Set up for send data request, operation ID:', this.currentOperationId);
    
    // Update progress to show confirmation request
    this.updateProgress({
      percent: 0,
      status: 'pending-confirmation',
      message: 'The connected device wants to send you match data',
      isDataRequest: false
    });
  }
  
  /**
   * Handle confirmation of our request to send data
   */
  private handleSendDataConfirmation(payload: any): void {
    console.log('[DatabaseSyncService] Handling send data confirmation:', payload);
    
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('[DatabaseSyncService] Received confirmation for unknown operation:', payload?.operationId);
      return;
    }
    
    // Stop healthcheck as we're moving to the next phase
    this.stopHealthcheckInterval();
    
    // Start sending data
    this.handleSendDataAfterConfirmation();
  }
  
  /**
   * Handle rejection of our request to send data
   */
  private handleSendDataRejection(payload: any): void {
    console.log('[DatabaseSyncService] Handling send data rejection:', payload);
    
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('[DatabaseSyncService] Received rejection for unknown operation:', payload?.operationId);
      return;
    }
    
    // Stop healthcheck interval
    this.stopHealthcheckInterval();
    
    // Update progress and reset state
    this.updateProgress({
      percent: 0,
      status: 'error',
      message: 'Your data send was declined by the other device',
      error: 'Send request rejected by peer'
    });
    
    this.syncInProgress = false;
    this.currentOperationId = null;
  }
  
  /**
   * Send data after confirmation has been received
   */
  private async handleSendDataAfterConfirmation(): Promise<void> {
    console.log('[DatabaseSyncService] Handling send data after confirmation');
    this.transferStartTime = Date.now();
    
    this.updateProgress({
      percent: 0,
      status: 'preparing',
      message: 'Preparing database for export'
    });
    
    try {
      // Reset chunk retry tracking
      this.chunkRetryCount.clear();
      
      // Export database data
      console.log('[DatabaseSyncService] Exporting database data');
      const exportData = await dbService.exportData();
      
      // Convert to JSON string
      const dataString = JSON.stringify(exportData);
      console.log(`[DatabaseSyncService] Exported data size: ${this.formatDataSize(dataString.length)}`);
      
      // Always use chunked transfer for reliability, regardless of size
      console.log('[DatabaseSyncService] Using chunked transfer for data sending');
      await this.sendLargeData(dataString);
      
      // Reset sync state with a delay to show completion message
      setTimeout(() => {
        this.syncInProgress = false;
        this.currentOperationId = null;
      }, 3000);
    } catch (error) {
      console.error('[DatabaseSyncService] Error handling data send:', error);
      
      // Try to notify the other side
      this.p2pService.send({
        type: SyncMessageType.ERROR,
        payload: {
          message: `Export error: ${error}`
        }
      });
      
      // If we can retry the whole operation
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`[DatabaseSyncService] Retrying entire send operation (${this.retryCount}/${this.maxRetries})`);
        
        this.updateProgress({
          percent: 0,
          status: 'reconnecting',
          message: `Connection issue, retrying entire operation (${this.retryCount}/${this.maxRetries})...`
        });
        
        // Verify connection health before retrying
        const isHealthy = await this.performConnectionHealthCheck();
        if (isHealthy) {
          // Give a moment before retrying
          setTimeout(() => {
            this.handleSendDataAfterConfirmation();
          }, 2000);
          return;
        } else {
          console.error('[DatabaseSyncService] Connection health check failed before retry');
        }
      }
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error preparing or sending data: ${error}`,
        error: String(error)
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.stopHealthcheckInterval();
    }
  }
  
  /**
   * Send large data in chunks with robust error handling
   */
  private async sendLargeData(dataString: string): Promise<void> {
    try {
      // Split into chunks
      const totalChunks = Math.ceil(dataString.length / this.chunkSize);
      let sentChunks = 0;
      
      console.log(`[DatabaseSyncService] Preparing to send data in ${totalChunks} chunks (${this.formatDataSize(dataString.length)})`);
      
      this.updateProgress({
        percent: 10,
        status: 'sending',
        message: `Preparing to send data in ${totalChunks} chunks (${this.formatDataSize(dataString.length)})`
      });
      
      // Send each chunk with retry logic
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(dataString.length, start + this.chunkSize);
        const chunk = dataString.substring(start, end);
        
        // Track retries for this specific chunk
        let chunkAttempts = this.chunkRetryCount.get(i) || 0;
        let chunkSent = false;
        
        while (!chunkSent && chunkAttempts < this.maxChunkRetries) {
          console.log(`[DatabaseSyncService] Sending chunk ${i+1}/${totalChunks} (attempt ${chunkAttempts+1}/${this.maxChunkRetries})`);
          
          try {
            // Verify connection before sending chunk
            if (chunkAttempts > 0) {
              // Only do health check on retry attempts to avoid slowing down initial sends
              const isHealthy = await this.performConnectionHealthCheck();
              if (!isHealthy) {
                console.error(`[DatabaseSyncService] Connection health check failed before sending chunk ${i+1}`);
                throw new Error("Connection health check failed");
              }
            }
            
            // Send the chunk
            const sendResult = this.p2pService.send({
              type: SyncMessageType.CHUNK,
              chunkId: i,
              totalChunks,
              payload: chunk,
              isLast: i === totalChunks - 1
            });
            
            if (!sendResult) {
              console.error(`[DatabaseSyncService] Failed to send chunk ${i+1}/${totalChunks}`);
              throw new Error(`Failed to send chunk ${i+1}/${totalChunks}`);
            }
            
            // If we get here, the chunk was sent successfully
            chunkSent = true;
            sentChunks++;
            
            // Update progress
            this.updateProgress({
              percent: 10 + Math.floor((sentChunks / totalChunks) * 80),
              status: 'sending',
              message: `Sending data: chunk ${sentChunks}/${totalChunks}`
            });
            
          } catch (error) {
            chunkAttempts++;
            this.chunkRetryCount.set(i, chunkAttempts);
            console.error(`[DatabaseSyncService] Error sending chunk ${i+1}, attempt ${chunkAttempts}:`, error);
            
            if (chunkAttempts < this.maxChunkRetries) {
              // Update progress to indicate retrying
              this.updateProgress({
                percent: 10 + Math.floor((sentChunks / totalChunks) * 80),
                status: 'reconnecting',
                message: `Retrying chunk ${i+1}/${totalChunks} (attempt ${chunkAttempts}/${this.maxChunkRetries})...`
              });
              
              // Wait a bit before retry, increasing delay with each attempt
              const retryDelay = 500 * chunkAttempts;
              console.log(`[DatabaseSyncService] Waiting ${retryDelay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
              // Max retries exceeded for this chunk
              console.error(`[DatabaseSyncService] Max retries exceeded for chunk ${i+1}`);
              throw new Error(`Failed to send chunk ${i+1} after ${chunkAttempts} attempts`);
            }
          }
        }
        
        // If all retries failed for this chunk, the error would have thrown and we wouldn't reach here
        
        // Wait between chunks to avoid network congestion
        // More delay between chunks for reliability
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`[DatabaseSyncService] Successfully sent all ${sentChunks} chunks`);
      
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: `Data sent successfully in ${sentChunks} chunks (${this.formatDataSize(dataString.length)})`
      });
    } catch (error) {
      console.error('[DatabaseSyncService] Error sending large data:', error);
      
      // Try to notify the other side if possible
      try {
        this.p2pService.send({
          type: SyncMessageType.ERROR,
          payload: {
            message: `Send error: ${error}`
          }
        });
      } catch (e) {
        // Ignore errors sending the error notification
      }
      
      // Throw the error to be handled by the caller
      throw error;
    }
  }
  
  /**
   * Handle direct data transfer (non-chunked)
   */
  private async handleDirectData(data: ExportData): Promise<void> {
    console.log('[DatabaseSyncService] Handling direct data transfer');
    
    this.updateProgress({
      percent: 50,
      status: 'receiving',
      message: 'Received data, processing...'
    });
    
    try {
      await this.importAndMergeData(data);
      
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: 'Data received and merged successfully'
      });
      
      // Reset sync flag with delay to allow user to see completion message
      setTimeout(() => {
        this.syncInProgress = false;
        this.currentOperationId = null;
      }, 3000);
    } catch (error) {
      console.error('[DatabaseSyncService] Error handling direct data:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error importing data: ${error}`,
        error: String(error)
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.stopHealthcheckInterval();
    }
  }
  
  /**
   * Handle data chunk and reassemble when complete
   */
  private handleDataChunk(message: SyncMessage): void {
    if (message.chunkId === undefined || 
        message.totalChunks === undefined || 
        !message.payload) {
      console.warn('[DatabaseSyncService] Received malformed chunk message');
      return;
    }
    
    console.log(`[DatabaseSyncService] Received chunk ${message.chunkId + 1}/${message.totalChunks}`);
    
    // Store chunk information
    this.totalExpectedChunks = message.totalChunks;
    this.receivedChunks.set(message.chunkId, message.payload);
    
    // Calculate progress
    const progress = Math.floor((this.receivedChunks.size / this.totalExpectedChunks) * 100);
    
    // Update progress
    this.updateProgress({
      percent: progress * 0.8, // Scale to 80% (leave 20% for processing)
      status: 'receiving',
      message: `Receiving data: ${this.receivedChunks.size}/${this.totalExpectedChunks} chunks`
    });
    
    // Check if all chunks received
    if (this.receivedChunks.size === this.totalExpectedChunks) {
      console.log('[DatabaseSyncService] All chunks received, reassembling');
      // Reassemble chunks
      this.reassembleAndProcessChunks();
    }
  }
  
  /**
   * Reassemble chunks and process the data
   */
  private async reassembleAndProcessChunks(): Promise<void> {
    try {
      this.updateProgress({
        percent: 80,
        status: 'processing',
        message: 'Reassembling data chunks...'
      });
      
      // Reassemble chunks in correct order
      let completeData = '';
      for (let i = 0; i < this.totalExpectedChunks; i++) {
        const chunk = this.receivedChunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        completeData += chunk;
      }
      
      console.log(`[DatabaseSyncService] Reassembled data size: ${this.formatDataSize(completeData.length)}`);
      
      // Parse JSON
      console.log('[DatabaseSyncService] Parsing JSON data');
      const data = JSON.parse(completeData) as ExportData;
      
      this.updateProgress({
        percent: 85,
        status: 'processing',
        message: 'Processing and merging data...'
      });
      
      // Import and merge data
      await this.importAndMergeData(data);
      
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: `Data received and merged successfully (${this.formatDataSize(completeData.length)})`
      });
      
      // Clear received chunks
      this.receivedChunks.clear();
      this.totalExpectedChunks = 0;
      
      // Reset sync flag with delay to allow user to see completion message
      setTimeout(() => {
        this.syncInProgress = false;
        this.currentOperationId = null;
      }, 3000);
    } catch (error) {
      console.error('[DatabaseSyncService] Error reassembling chunks:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error processing received data: ${error}`,
        error: String(error)
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.stopHealthcheckInterval();
      this.receivedChunks.clear();
      this.totalExpectedChunks = 0;
    }
  }
  
  /**
   * Import and merge the received data
   */
  private async importAndMergeData(data: ExportData): Promise<void> {
    try {
      // Validate data structure
      this.validateExportData(data);
      
      console.log('[DatabaseSyncService] Importing data with merge mode');
      
      // Import using merge mode
      await dbService.importData(data, 'merge');
      
      const duration = ((Date.now() - this.transferStartTime) / 1000).toFixed(1);
      console.log(`[DatabaseSyncService] Data merged successfully in ${duration}s`);
      
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: `Data successfully merged in ${duration}s`
      });
    } catch (error) {
      console.error('[DatabaseSyncService] Error importing data:', error);
      this.syncInProgress = false;
      this.currentOperationId = null;
      this.stopHealthcheckInterval();
      throw error;
    }
  }
  
  /**
   * Validate the structure of export data
   */
  private validateExportData(data: any): void {
    if (!data) {
      throw new Error('No data received');
    }
    
    console.log('[DatabaseSyncService] Validating export data structure');
    
    // Check for required fields
    if (!data.players || !Array.isArray(data.players) ||
        !data.matches || !Array.isArray(data.matches) ||
        !data.matchPlayers || !Array.isArray(data.matchPlayers)) {
      throw new Error('Invalid data format: missing required collections');
    }
    
    console.log('[DatabaseSyncService] Export data validation passed');
    
    // Additional logging for debugging
    console.log(`[DatabaseSyncService] Data contains: ${data.players.length} players, ${data.matches.length} matches, ${data.matchPlayers.length} match players`);
  }
  
  /**
   * Format data size for display (KB, MB)
   */
  private formatDataSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }
  
  /**
   * Update progress and notify callback
   */
  private updateProgress(progress: SyncProgress): void {
    console.log(`[DatabaseSyncService] Progress update: ${progress.status} - ${progress.message}`);
    
    // Store the current progress
    this.currentProgress = progress;
    
    // Notify callback if set
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }
  
  /**
   * Generate a unique operation ID
   */
  private generateOperationId(): string {
    return 'op_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
}