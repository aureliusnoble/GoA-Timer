// src/services/DatabaseSyncService.ts
import { P2PService } from './P2PService';
import dbService, { ExportData } from './DatabaseService';

/**
 * Sync progress interface for tracking data transfer status
 */
export interface SyncProgress {
  percent: number;
  status: 'idle' | 'preparing' | 'sending' | 'receiving' | 'processing' | 'complete' | 'error';
  message: string;
}

/**
 * Message types for P2P sync protocol
 */
export enum SyncMessageType {
  REQUEST = 'db-sync-request',
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
  
  constructor(p2pService: P2PService) {
    this.p2pService = p2pService;
    
    // Listen for sync messages
    this.p2pService.onData(this.handleSyncMessage.bind(this));
  }
  
  /**
   * Request database sync from connected peer(s)
   */
  public async requestSync(): Promise<void> {
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
    this.transferStartTime = Date.now();
    
    this.updateProgress({
      percent: 0,
      status: 'preparing',
      message: 'Requesting data from peer'
    });
    
    // Send sync request
    this.p2pService.send({
      type: SyncMessageType.REQUEST
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
      case SyncMessageType.REQUEST:
        this.handleSyncRequest();
        break;
        
      case SyncMessageType.DATA:
        this.handleDirectData(message.payload);
        break;
        
      case SyncMessageType.CHUNK:
        this.handleDataChunk(message);
        break;
        
      case SyncMessageType.CHUNK_ACK:
        // This is handled in the sendLargeData promise
        break;
        
      case SyncMessageType.ERROR:
        this.updateProgress({
          percent: 0,
          status: 'error',
          message: `Peer error: ${message.payload || 'Unknown error'}`
        });
        this.syncInProgress = false;
        break;
        
      case SyncMessageType.INFO:
        console.log('[Sync] Info from peer:', message.payload);
        break;
    }
  }
  
  /**
   * Handle sync request by sending database data
   */
  private async handleSyncRequest(): Promise<void> {
    if (this.syncInProgress) {
      this.p2pService.send({
        type: SyncMessageType.ERROR,
        payload: 'Sync already in progress'
      });
      return;
    }
    
    this.syncInProgress = true;
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
      
      this.syncInProgress = false;
    } catch (error) {
      console.error('Error handling sync request:', error);
      
      this.p2pService.send({
        type: SyncMessageType.ERROR,
        payload: `Export error: ${error}`
      });
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error preparing data: ${error}`
      });
      
      this.syncInProgress = false;
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
        payload: `Send error: ${error}`
      });
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error sending data: ${error}`
      });
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
      
      this.syncInProgress = false;
    } catch (error) {
      console.error('Error handling direct data:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error importing data: ${error}`
      });
      
      this.syncInProgress = false;
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
      this.syncInProgress = false;
    } catch (error) {
      console.error('Error reassembling chunks:', error);
      
      this.updateProgress({
        percent: 0,
        status: 'error',
        message: `Error processing received data: ${error}`
      });
      
      this.syncInProgress = false;
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
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }
}