import { CandlestickData, MarketData } from '../types/market';

const DB_NAME = 'CryptoDashboardDB';
const DB_VERSION = 1;
const CANDLESTICK_STORE = 'candlesticks';
const METADATA_STORE = 'metadata';

interface CandlestickRecord {
  id: string; // Format: "BTC_5m_1234567890"
  token: string;
  timeframe: string;
  timestamp: number;
  data: CandlestickData;
}

interface MetadataRecord {
  token: string;
  timeframe: string;
  lastUpdate: number;
  dataPoints: number;
}

export class CryptoDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create candlestick store
        if (!db.objectStoreNames.contains(CANDLESTICK_STORE)) {
          const candlestickStore = db.createObjectStore(CANDLESTICK_STORE, { keyPath: 'id' });
          candlestickStore.createIndex('token', 'token', { unique: false });
          candlestickStore.createIndex('timeframe', 'timeframe', { unique: false });
          candlestickStore.createIndex('timestamp', 'timestamp', { unique: false });
          candlestickStore.createIndex('token_timeframe', ['token', 'timeframe'], { unique: false });
        }

        // Create metadata store if not exists (for backward compatibility)
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: ['token', 'timeframe'] });
        }
      };
    });
  }

  async saveCandlestick(token: string, timeframe: string, data: CandlestickData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CANDLESTICK_STORE], 'readwrite');
      const candlestickStore = transaction.objectStore(CANDLESTICK_STORE);

      const record: CandlestickRecord = {
        id: `${token}_${timeframe}_${data.openTime}`,
        token,
        timeframe,
        timestamp: data.openTime,
        data
      };

      const request = candlestickStore.put(record);
      
      request.onsuccess = () => {
        console.log(`Saved candlestick for ${token} at ${new Date(data.openTime).toLocaleTimeString()}`);
      };
      
      request.onerror = () => {
        console.error('Error saving candlestick:', request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  async saveBulkCandlesticks(token: string, timeframe: string, data: CandlestickData[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (data.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CANDLESTICK_STORE], 'readwrite');
      const candlestickStore = transaction.objectStore(CANDLESTICK_STORE);

      // Save all candlesticks
      for (const candle of data) {
        const record: CandlestickRecord = {
          id: `${token}_${timeframe}_${candle.openTime}`,
          token,
          timeframe,
          timestamp: candle.openTime,
          data: candle
        };
        
        const request = candlestickStore.put(record);
        request.onerror = () => {
          console.error('Error saving candlestick:', request.error);
        };
      }

      transaction.oncomplete = () => {
        console.log(`Saved ${data.length} candlesticks for ${token}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('Transaction error:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async getCandlesticks(
    token: string, 
    timeframe: string, 
    startTime?: number, 
    endTime?: number,
    limit?: number
  ): Promise<CandlestickData[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CANDLESTICK_STORE], 'readonly');
      const store = transaction.objectStore(CANDLESTICK_STORE);
      const index = store.index('token_timeframe');
      
      const range = IDBKeyRange.only([token, timeframe]);
      const request = index.openCursor(range);
      
      const results: CandlestickData[] = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value as CandlestickRecord;
          
          // Apply time filters if provided
          if ((!startTime || record.timestamp >= startTime) && 
              (!endTime || record.timestamp <= endTime)) {
            results.push(record.data);
          }
          
          if (!limit || results.length < limit) {
            cursor.continue();
          } else {
            resolve(results.sort((a, b) => a.openTime - b.openTime));
          }
        } else {
          resolve(results.sort((a, b) => a.openTime - b.openTime));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getLatestCandlestick(token: string, timeframe: string): Promise<CandlestickData | null> {
    const candlesticks = await this.getCandlesticks(token, timeframe, undefined, undefined, 1);
    return candlesticks.length > 0 ? candlesticks[candlesticks.length - 1] : null;
  }

  async getDataPointCount(token: string, timeframe: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CANDLESTICK_STORE], 'readonly');
      const store = transaction.objectStore(CANDLESTICK_STORE);
      const index = store.index('token_timeframe');
      
      const range = IDBKeyRange.only([token, timeframe]);
      const request = index.count(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(token: string, timeframe: string): Promise<MetadataRecord | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get([token, timeframe]);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearOldData(token: string, timeframe: string, daysToKeep: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CANDLESTICK_STORE], 'readwrite');
      const store = transaction.objectStore(CANDLESTICK_STORE);
      const index = store.index('token_timeframe');
      
      const range = IDBKeyRange.only([token, timeframe]);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const record = cursor.value as CandlestickRecord;
          if (record.timestamp < cutoffTime) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async exportData(): Promise<MarketData> {
    if (!this.db) throw new Error('Database not initialized');

    const marketData: MarketData = {};
    const tokens = ['BTC', 'ETH', 'SOL', 'ADA'];
    const timeframes = ['5m', '1d'];

    for (const token of tokens) {
      marketData[token] = {};
      for (const timeframe of timeframes) {
        const candlesticks = await this.getCandlesticks(token, timeframe);
        marketData[token][timeframe] = candlesticks;
      }
    }

    return marketData;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}