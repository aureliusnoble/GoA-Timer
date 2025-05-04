// src/services/DatabaseSyncService.ts
import { P2PService } from './P2PService';
import dbService, { ExportData } from './DatabaseService';

/**
 * Sync progress interface for tracking data transfer status
 */
export interface SyncProgress {
  percent: number;
  status: 'idle' | 'preparing' | 'sending' | 'receiving' | 'processing' | 'complete' | 'error' | 'pending-confirmation' | 'awaiting-confirmation';
  message: string;
  isDataRequest?: boolean; // Indicates if this is a request for data (true) or a send of data (false)
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
  INFO = 'db-sync-info'
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
  private chunkSize = 100 * 1024; // 100KB chunks
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
  
  constructor(p2pService: P2PService) {
    this.p2pService = p2pService;
    
    // Listen for sync messages
    this.p2pService.onData(this.handleSyncMessage.bind(this));
  }
  
  /**
   * Request database sync from connected peer(s)
   */
  public async requestData(): Promise<void> {
    if (!this.p2pService.getState().isConnected) {
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Not connected to any peers'
      });
      throw new Error('Not connected to any peers');
    }
    
    if (this.syncInProgress) {
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Sync already in progress'
      });
      throw new Error('Sync already in progress');
    }
    
    this.syncInProgress = true;
    this.currentOperationId = this.generateOperationId();
    
    // Update progress to show we're waiting for confirmation
    this.updateProgress({
      percent: 0,
      status: 'awaiting-confirmation',
      message: 'Waiting for the other device to approve data request',
      isDataRequest: true
    });
    
    // Send data request message
    this.p2pService.send({
      type: SyncMessageType.REQUEST_DATA,
      payload: {
        operationId: this.currentOperationId
      }
    });
  }
  
  /**
   * Send database data to connected peer(s)
   */
  public async sendData(): Promise<void> {
    if (!this.p2pService.getState().isConnected) {
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Not connected to any peers'
      });
      throw new Error('Not connected to any peers');
    }
    
    if (this.syncInProgress) {
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: 'Sync already in progress'
      });
      throw new Error('Sync already in progress');
    }
    
    this.syncInProgress = true;
    this.currentOperationId = this.generateOperationId();
    
    // Update progress to show we're waiting for confirmation
    this.updateProgress({
      percent: 0,
      status: 'awaiting-confirmation',
      message: 'Waiting for the other device to accept data',
      isDataRequest: false
    });
    
    // Send data request message
    this.p2pService.send({
      type: SyncMessageType.SEND_DATA_REQUEST,
      payload: {
        operationId: this.currentOperationId
      }
    });
  }
  
  /**
   * Confirm a data operation (sending or receiving)
   */
  public confirmDataOperation(): void {
    if (this.currentProgress.status === 'pending-confirmation') {
      const isDataRequest = this.currentProgress.isDataRequest;
      
      if (isDataRequest) {
        // We're being asked to send data
        this.handleSendDataAfterConfirmation();
      } else {
        // We're being asked to receive data
        this.p2pService.send({
          type: SyncMessageType.SEND_DATA_CONFIRM,
          payload: {
            operationId: this.currentOperationId
          }
        });
        
        this.updateProgress({
          percent: 0,
          status: 'preparing',
          message: 'Preparing to receive data'
        });
      }
    }
  }
  
  /**
   * Reject a data operation (sending or receiving)
   */
  public rejectDataOperation(): void {
    if (this.currentProgress.status === 'pending-confirmation') {
      const isDataRequest = this.currentProgress.isDataRequest;
      
      if (isDataRequest) {
        // Reject request to send data
        this.p2pService.send({
          type: SyncMessageType.REQUEST_REJECT,
          payload: {
            operationId: this.currentOperationId
          }
        });
      } else {
        // Reject incoming data
        this.p2pService.send({
          type: SyncMessageType.SEND_DATA_REJECT,
          payload: {
            operationId: this.currentOperationId
          }
        });
      }
    } else if (this.currentProgress.status === 'awaiting-confirmation') {
      // Cancel our own request or send operation
      // No need to send a message, just reset state
    }
    
    // Reset the sync state
    this.syncInProgress = false;
    this.currentOperationId = null;
    
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
    if (!message || !message.type) return;
    
    switch (message.type) {
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
        break;
      
      // Handle errors and info messages
      case SyncMessageType.ERROR:
        this.updateProgress({
          percent: 0,
          status: 'error',
          message: `Peer error: ${message.payload?.message || 'Unknown error'}`
        });
        this.syncInProgress = false;
        this.currentOperationId = null;
        break;
      
      case SyncMessageType.INFO:
        console.log('[Sync] Info from peer:', message.payload);
        break;
    }
  }
  
  /**
   * Handle a request for data from a peer
   */
  private handleDataRequest(payload: any): void {
    if (this.syncInProgress) {
      // Reject the request if we're already in a sync
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
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('Received confirmation for unknown operation:', payload?.operationId);
      return;
    }
    
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
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('Received rejection for unknown operation:', payload?.operationId);
      return;
    }
    
    // Update progress and reset state
    this.updateProgress({
      percent: 0,
      status: 'error',
      message: 'Data request was declined by the other device'
    });
    
    this.syncInProgress = false;
    this.currentOperationId = null;
  }
  
  /**
   * Handle a request to send data to us
   */
  private handleSendDataRequest(payload: any): void {
    if (this.syncInProgress) {
      // Reject the request if we're already in a sync
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
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('Received confirmation for unknown operation:', payload?.operationId);
      return;
    }
    
    // Start sending data
    this.handleSendDataAfterConfirmation();
  }
  
  /**
   * Handle rejection of our request to send data
   */
  private handleSendDataRejection(payload: any): void {
    // Verify this is for our current operation
    if (payload?.operationId !== this.currentOperationId) {
      console.warn('Received rejection for unknown operation:', payload?.operationId);
      return;
    }
    
    // Update progress and reset state
    this.updateProgress({
      percent: 0,
      status: 'error',
      message: 'Your data send was declined by the other device'
    });
    
    this.syncInProgress = false;
    this.currentOperationId = null;
  }
  
  /**
   * Send data after confirmation has been received
   */
  private async handleSendDataAfterConfirmation(): Promise<void> {
    this.transferStartTime = Date.now();
    
    this.updateProgress({
      percent: 0,
      status: 'preparing',
      message: 'Preparing database for export'
    });
    
    try {
      // Export database data
      const exportData = await dbService.exportData();
      
      // Convert to JSON string
      const dataString = JSON.stringify(exportData);
      
      // For small data, send directly
      if (dataString.length < this.chunkSize) {
        this.updateProgress({
          percent: 40,
          status: 'sending',
          message: 'Sending data directly'
        });
        
        this.p2pService.send({
          type: SyncMessageType.DATA,
          payload: exportData
        });
        
        this.updateProgress({
          percent: 100,
          status: 'complete',
          message: `Data sent successfully (${this.formatDataSize(dataString.length)})`
        });
      } else {
        // For larger data, send in chunks
        await this.sendLargeData(dataString);
      }
      
      // Reset sync state with a delay to show completion message
      setTimeout(() => {
        this.syncInProgress = false;
        this.currentOperationId = null;
      }, 3000);
    } catch (error) {
      console.error('Error handling data send:', error);
      
      this.p2pService.send({
        type: SyncMessageType.ERROR,
        payload: {
          message: `Export error: ${error}`
        }
      });
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error preparing data: ${error}`
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
    }
  }
  
  /**
   * Send large data in chunks
   */
  private async sendLargeData(dataString: string): Promise<void> {
    try {
      // Split into chunks
      const totalChunks = Math.ceil(dataString.length / this.chunkSize);
      let sentChunks = 0;
      
      this.updateProgress({
        percent: 10,
        status: 'sending',
        message: `Preparing to send data in ${totalChunks} chunks (${this.formatDataSize(dataString.length)})`
      });
      
      // Send each chunk with confirmation
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(dataString.length, start + this.chunkSize);
        const chunk = dataString.substring(start, end);
        
        // Send the chunk
        this.p2pService.send({
          type: SyncMessageType.CHUNK,
          chunkId: i,
          totalChunks,
          payload: chunk,
          isLast: i === totalChunks - 1
        });
        
        sentChunks++;
        
        this.updateProgress({
          percent: 10 + Math.floor((sentChunks / totalChunks) * 80),
          status: 'sending',
          message: `Sending data: chunk ${sentChunks}/${totalChunks}`
        });
        
        // Wait a bit between chunks to avoid flooding
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: `Data sent successfully in ${sentChunks} chunks (${this.formatDataSize(dataString.length)})`
      });
    } catch (error) {
      console.error('Error sending large data:', error);
      
      this.p2pService.send({
        type: SyncMessageType.ERROR,
        payload: {
          message: `Send error: ${error}`
        }
      });
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error sending data: ${error}`
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
    }
  }
  
  /**
   * Handle direct data transfer (non-chunked)
   */
  private async handleDirectData(data: ExportData): Promise<void> {
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
      console.error('Error handling direct data:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error importing data: ${error}`
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
    }
  }
  
  /**
   * Handle data chunk and reassemble when complete
   */
  private handleDataChunk(message: SyncMessage): void {
    if (message.chunkId === undefined || 
        message.totalChunks === undefined || 
        !message.payload) {
      return;
    }
    
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
      
      // Parse JSON
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
      console.error('Error reassembling chunks:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error processing received data: ${error}`
      });
      
      this.syncInProgress = false;
      this.currentOperationId = null;
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
      
      // Import using merge mode
      await dbService.importData(data, 'merge');
      
      const duration = ((Date.now() - this.transferStartTime) / 1000).toFixed(1);
      this.updateProgress({
        percent: 100,
        status: 'complete',
        message: `Data successfully merged in ${duration}s`
      });
    } catch (error) {
      console.error('Error importing data:', error);
      this.syncInProgress = false;
      this.currentOperationId = null;
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
    
    // Check for required fields
    if (!data.players || !Array.isArray(data.players) ||
        !data.matches || !Array.isArray(data.matches) ||
        !data.matchPlayers || !Array.isArray(data.matchPlayers)) {
      throw new Error('Invalid data format: missing required collections');
    }
    
    // Basic validation passed
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