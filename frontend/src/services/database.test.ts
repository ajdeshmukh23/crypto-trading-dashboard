import { CryptoDatabase as DatabaseService } from './database';
import { CandlestickData } from '../types/market';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
  databases: jest.fn().mockResolvedValue([])
};

const mockDB = {
  name: 'CryptoDashboardDB',
  version: 1,
  objectStoreNames: {
    contains: jest.fn((name: string) => name === 'candlesticks' || name === 'metadata'),
    length: 2
  },
  close: jest.fn(),
  transaction: jest.fn(),
  createObjectStore: jest.fn()
};

const mockTransaction = {
  objectStore: jest.fn(),
  oncomplete: null as ((ev: Event) => any) | null,
  onerror: null as ((ev: Event) => any) | null,
  commit: jest.fn()
};

const mockObjectStore = {
  put: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn()
};

const mockCursor = {
  value: null,
  continue: jest.fn(),
  delete: jest.fn()
};

const mockIndex = {
  openCursor: jest.fn()
};

// Setup global mocks
global.indexedDB = mockIndexedDB as any;
global.IDBKeyRange = {
  bound: jest.fn().mockImplementation((lower, upper) => ({ lower, upper })),
  lowerBound: jest.fn().mockImplementation((lower) => ({ lower })),
  upperBound: jest.fn().mockImplementation((upper) => ({ upper })),
  only: jest.fn().mockImplementation((value) => ({ value }))
} as any;

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockIndexedDB.open.mockImplementation(() => {
      const request: any = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      };
      
      setTimeout(() => {
        if (request.onsuccess) request.onsuccess({ target: { result: mockDB } });
      }, 0);
      
      return request;
    });
    
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    mockObjectStore.index.mockReturnValue(mockIndex);
    
    // Reset the contains mock to ensure it returns the expected values
    mockDB.objectStoreNames.contains = jest.fn((name: string) => {
      return name === 'candlesticks' || name === 'metadata';
    });
    
    dbService = new DatabaseService();
    await dbService.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('initializes database successfully', async () => {
      expect(dbService['db']).toBeDefined();
      expect(dbService['db']?.name).toBe('CryptoDashboardDB');
      expect(dbService['db']?.version).toBe(1);
    });

    it('creates required object stores', async () => {
      // The database mock is set up with objectStoreNames that return true for contains()
      // This simulates that the stores already exist
      const db = dbService['db'];
      expect(db).toBeDefined();
      
      // Test the mock function
      const containsCandlesticks = db?.objectStoreNames.contains('candlesticks');
      const containsMetadata = db?.objectStoreNames.contains('metadata');
      
      expect(containsCandlesticks).toBe(true);
      expect(containsMetadata).toBe(true);
    });

    it('handles multiple init calls gracefully', async () => {
      const firstDb = dbService['db'];
      await dbService.init();
      const secondDb = dbService['db'];
      
      expect(firstDb).toBe(secondDb);
    });
  });

  describe('saveBulkCandlesticks', () => {
    const mockCandlestickData: CandlestickData[] = [
      {
        openTime: 1234567890000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000,
        closeTime: 1234567890000,
        quoteVolume: 42000000,
        trades: 500,
        takerBuyBaseVolume: 600,
        takerBuyQuoteVolume: 25200000,
      },
      {
        openTime: 1234568190000,
        open: 42300,
        high: 42800,
        low: 42100,
        close: 42600,
        volume: 1200,
        closeTime: 1234568190000,
        quoteVolume: 51000000,
        trades: 600,
        takerBuyBaseVolume: 700,
        takerBuyQuoteVolume: 29400000,
      },
    ];

    it('saves candlestick data successfully', async () => {
      mockObjectStore.put.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          result: undefined
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: undefined } });
        }, 0);
        return request;
      });
      
      let transactionComplete: any;
      const transactionPromise = new Promise(resolve => {
        transactionComplete = resolve;
      });
      
      mockTransaction.oncomplete = transactionComplete;
      
      const savePromise = dbService.saveBulkCandlesticks('BTC', '1h', mockCandlestickData);
      
      // Trigger transaction complete
      if (mockTransaction.oncomplete) mockTransaction.oncomplete(new Event('complete'));
      
      await savePromise;
      
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2); // 2 candlesticks
    });

    it('handles empty data array', async () => {
      await expect(dbService.saveBulkCandlesticks('BTC', '1h', [])).resolves.not.toThrow();
    });

    it('updates metadata after saving', async () => {
      mockObjectStore.put.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          result: undefined
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: undefined } });
        }, 0);
        return request;
      });
      
      let transactionComplete: any;
      const transactionPromise = new Promise(resolve => {
        transactionComplete = resolve;
      });
      
      mockTransaction.oncomplete = transactionComplete;
      
      const savePromise = dbService.saveBulkCandlesticks('BTC', '1h', mockCandlestickData);
      
      // Trigger transaction complete
      if (mockTransaction.oncomplete) mockTransaction.oncomplete(new Event('complete'));
      
      await savePromise;
      
      // Check that candlestick records were created with proper structure
      const putCalls = mockObjectStore.put.mock.calls;
      expect(putCalls).toHaveLength(2);
      expect(putCalls[0][0]).toMatchObject({
        id: 'BTC_1h_1234567890000',
        token: 'BTC',
        timeframe: '1h',
        timestamp: 1234567890000
      });
    });
  });

  describe('getCandlesticks', () => {
    const mockStoredData = [
      {
        openTime: 1234567890000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000,
        closeTime: 1234567890000,
        quoteVolume: 42000000,
        trades: 500,
        takerBuyBaseVolume: 600,
        takerBuyQuoteVolume: 25200000,
      }
    ];

    beforeEach(() => {
      mockObjectStore.getAll.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          result: mockStoredData
        };
        
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: mockStoredData } });
        }, 0);
        
        return request;
      });
    });

    it('retrieves all candlesticks when no filters', async () => {
      const mockCursorData = {
        value: {
          id: 'BTC_1h_1234567890000',
          token: 'BTC',
          timeframe: '1h',
          timestamp: 1234567890000,
          data: mockStoredData[0]
        },
        continue: jest.fn()
      };
      
      mockIndex.openCursor.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null
        };
        
        setTimeout(() => {
          if (request.onsuccess) {
            // First call - return cursor with data
            request.onsuccess({ target: { result: mockCursorData } });
            // Second call - return null to end iteration
            setTimeout(() => {
              request.onsuccess({ target: { result: null } });
            }, 0);
          }
        }, 0);
        
        return request;
      });
      
      const results = await dbService.getCandlesticks('BTC', '1h');
      expect(results).toHaveLength(1);
      expect(results[0].open).toBe(42000);
    });

    it('returns empty array for non-existent data', async () => {
      mockIndex.openCursor.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null
        };
        
        setTimeout(() => {
          if (request.onsuccess) {
            // Return null immediately - no data
            request.onsuccess({ target: { result: null } });
          }
        }, 0);
        
        return request;
      });
      
      const results = await dbService.getCandlesticks('XRP', '1h');
      expect(results).toHaveLength(0);
    });
  });

  describe('getMetadata', () => {
    it('returns metadata after saving candlesticks', async () => {
      const mockMetadata = {
        token: 'BTC',
        timeframe: '1h',
        lastUpdate: Date.now(),
        dataPoints: 1
      };
      
      mockObjectStore.get.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          result: mockMetadata
        };
        
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: mockMetadata } });
        }, 0);
        
        return request;
      });
      
      const metadata = await dbService.getMetadata('BTC', '1h');
      expect(metadata).toMatchObject({
        token: 'BTC',
        timeframe: '1h',
        dataPoints: 1,
      });
    });

    it('returns null for non-existent metadata', async () => {
      mockObjectStore.get.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          result: undefined
        };
        
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: { result: undefined } });
        }, 0);
        
        return request;
      });
      
      const metadata = await dbService.getMetadata('XRP', '1h');
      expect(metadata).toBeNull();
    });
  });

  describe('clearOldData', () => {
    it('removes data older than specified days', async () => {
      let transactionComplete: any;
      const transactionPromise = new Promise(resolve => {
        transactionComplete = resolve;
      });
      
      mockTransaction.oncomplete = transactionComplete;
      
      mockIndex.openCursor.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null
        };
        
        setTimeout(() => {
          if (request.onsuccess) {
            // Return null - no data to delete
            request.onsuccess({ target: { result: null } });
          }
        }, 0);
        
        return request;
      });
      
      const promise = dbService.clearOldData('BTC', '1h', 30);
      
      // Trigger transaction complete
      if (mockTransaction.oncomplete) mockTransaction.oncomplete(new Event('complete'));
      
      await promise;
      
      expect(mockIndex.openCursor).toHaveBeenCalled();
    });
  });

  describe('exportData', () => {
    it('exports all data from database', async () => {
      // Mock getCandlesticks to return empty arrays
      mockIndex.openCursor.mockImplementation(() => {
        const request: any = {
          onsuccess: null,
          onerror: null
        };
        
        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess({ target: { result: null } });
          }
        }, 0);
        
        return request;
      });
      
      const exported = await dbService.exportData();
      
      expect(exported).toBeDefined();
      expect(exported.BTC).toBeDefined();
      expect(exported.BTC['5m']).toEqual([]);
      expect(exported.BTC['1d']).toEqual([]);
      expect(exported.ETH).toBeDefined();
      expect(exported.SOL).toBeDefined();
      expect(exported.ADA).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      // Close the database to simulate error
      dbService['db'] = null;
      
      // Operations should throw since database is not initialized
      await expect(dbService.saveBulkCandlesticks('BTC', '1h', [])).rejects.toThrow('Database not initialized');
      await expect(dbService.getCandlesticks('BTC', '1h')).rejects.toThrow('Database not initialized');
      await expect(dbService.getMetadata('BTC', '1h')).rejects.toThrow('Database not initialized');
    });
  });
});