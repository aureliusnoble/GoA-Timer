// src/services/GameStorageService.ts
import { GameState, Player } from '../types';

// Interface for saved game data
interface SavedGameData {
  gameState: GameState;
  players: Player[];
  timestamp: number;
  strategyTimeRemaining: number;
  moveTimeRemaining: number;
  strategyTimerActive: boolean;
  moveTimerActive: boolean;
  strategyTimerEnabled: boolean;
  moveTimerEnabled: boolean;
}

class GameStorageService {
  private readonly dbName = 'guards-of-atlantis-timer';
  private readonly storeName = 'game-state';
  private readonly version = 1;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject(event);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });

    return this.dbPromise;
  }

  async saveGame(data: Omit<SavedGameData, 'timestamp'>): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      // Add timestamp
      const savedData: SavedGameData = {
        ...data,
        timestamp: Date.now()
      };

      // Always use the same key 'current' for the current game
      store.put({ id: 'current', ...savedData });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event);
      });
    } catch (error) {
      console.error('Error saving game:', error);
      throw error;
    }
  }

  async loadGame(): Promise<SavedGameData | null> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get('current');

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const data = request.result;
          if (data) {
            // Remove the 'id' field that's used as the keyPath
            const { id, ...savedData } = data;
            resolve(savedData as SavedGameData);
          } else {
            resolve(null);
          }
        };
        request.onerror = (event) => reject(event);
      });
    } catch (error) {
      console.error('Error loading game:', error);
      return null;
    }
  }

  async clearGame(): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete('current');

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(event);
      });
    } catch (error) {
      console.error('Error clearing game:', error);
      throw error;
    }
  }

  // Check if IndexedDB is supported by the browser
  isSupported(): boolean {
    return !!window.indexedDB;
  }
}

export const gameStorageService = new GameStorageService()