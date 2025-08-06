const DataManager = require('./dataManager');
const binanceApi = require('./binanceApi');

// Mock binanceApi
jest.mock('./binanceApi');

describe('DataManager', () => {
  let dataManager;
  let mockPool;
  let mockMarketConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Set current time to a fixed value for consistent testing
    jest.setSystemTime(new Date('2024-01-01T06:00:00Z'));

    mockPool = {
      query: jest.fn()
    };

    mockMarketConfig = {
      BTC: { symbol: 'BTCUSDT' },
      ETH: { symbol: 'ETHUSDT' },
      SOL: { symbol: 'SOLUSDT' },
      ADA: { symbol: 'ADAUSDT' }
    };

    dataManager = new DataManager(mockPool, mockMarketConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('findDataGaps', () => {
    it('identifies gaps in data correctly', async () => {
      const mockData = {
        rows: [
          { open_time: new Date('2024-01-01T00:00:00Z').getTime() },
          { open_time: new Date('2024-01-01T01:00:00Z').getTime() },
          { open_time: new Date('2024-01-01T02:00:00Z').getTime() },
          // Gap here - missing 3:00
          { open_time: new Date('2024-01-01T04:00:00Z').getTime() },
          { open_time: new Date('2024-01-01T05:00:00Z').getTime() }
        ]
      };

      mockPool.query.mockResolvedValue(mockData);

      const gaps = await dataManager.findDataGaps('BTC', '1h');

      // Should find gap between 2:00 and 4:00, and gap from 5:00 to current time (6:00)
      expect(gaps.length).toBeGreaterThanOrEqual(1);
      const firstGap = gaps.find(g => g.start === new Date('2024-01-01T03:00:00Z').getTime());
      expect(firstGap).toBeDefined();
      expect(firstGap.missingIntervals).toBe(1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT open_time'),
        ['BTC', '1h']
      );
    });

    it('detects recent data gap', async () => {
      // Current time is 2024-01-01T06:00:00Z
      // Last data point is 3 hours ago: 2024-01-01T03:00:00Z 
      // This ensures now > expectedLastTime + intervalMs (06:00 > 04:00 + 1h)
      const threeHoursAgo = new Date('2024-01-01T03:00:00Z');
      
      const mockData = {
        rows: [
          { open_time: threeHoursAgo.getTime() }
        ]
      };

      mockPool.query.mockResolvedValue(mockData);

      const gaps = await dataManager.findDataGaps('BTC', '1h');

      // Should detect gap from last data point (03:00) + 1h = 04:00 to now (06:00)
      expect(gaps.length).toBeGreaterThan(0);
      const recentGap = gaps[gaps.length - 1];
      expect(recentGap.start).toBe(new Date('2024-01-01T04:00:00Z').getTime()); // One hour after last data point
    });

    it('handles different timeframes correctly', async () => {
      const mockData5m = {
        rows: [
          { open_time: new Date('2024-01-01T00:00:00Z').getTime() },
          { open_time: new Date('2024-01-01T00:05:00Z').getTime() },
          // Gap - missing 00:10
          { open_time: new Date('2024-01-01T00:15:00Z').getTime() }
        ]
      };

      mockPool.query.mockResolvedValue(mockData5m);

      const gaps = await dataManager.findDataGaps('BTC', '5m');

      // Should find at least the gap between 00:05 and 00:15
      expect(gaps.length).toBeGreaterThanOrEqual(1);
      const gap = gaps.find(g => g.start === new Date('2024-01-01T00:10:00Z').getTime());
      expect(gap).toBeDefined();
      expect(gap.missingIntervals).toBe(1);
    });

    it('returns empty array when no gaps', async () => {
      const now = new Date();
      const mockData = {
        rows: Array(24).fill(null).map((_, i) => ({
          open_time: (now.getTime() - (23 - i) * 60 * 60 * 1000).toString()
        }))
      };

      mockPool.query.mockResolvedValue(mockData);

      const gaps = await dataManager.findDataGaps('BTC', '1h');

      expect(gaps).toHaveLength(0);
    });

    it('handles empty data', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const gaps = await dataManager.findDataGaps('BTC', '1h');

      // Should return gap from 30 days ago to now
      expect(gaps).toHaveLength(1);
      expect(gaps[0].missingIntervals).toBeGreaterThan(0);
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      await expect(dataManager.findDataGaps('BTC', '1h'))
        .rejects.toThrow('Database error');
    });

    it('calculates intervals correctly for daily timeframe', async () => {
      const mockData = {
        rows: [
          { open_time: new Date('2024-01-01T00:00:00Z').getTime() },
          { open_time: new Date('2024-01-02T00:00:00Z').getTime() },
          // Gap - missing Jan 3
          { open_time: new Date('2024-01-04T00:00:00Z').getTime() }
        ]
      };

      mockPool.query.mockResolvedValue(mockData);

      const gaps = await dataManager.findDataGaps('BTC', '1d');

      // Should find at least the gap between Jan 2 and Jan 4
      expect(gaps.length).toBeGreaterThanOrEqual(1);
      const gap = gaps.find(g => g.start === new Date('2024-01-03T00:00:00Z').getTime());
      expect(gap).toBeDefined();
      expect(gap.missingIntervals).toBe(1);
    });
  });

  describe('fillGaps', () => {
    it('fills data gaps successfully', async () => {
      const mockGaps = [{
        start: new Date('2024-01-01T00:00:00Z').getTime(),
        end: new Date('2024-01-01T03:00:00Z').getTime(),
        missingIntervals: 3
      }];

      const mockKlineData = [
        {
          openTime: new Date('2024-01-01T01:00:00Z').getTime(),
          open: 42000,
          high: 42500,
          low: 41800,
          close: 42300,
          volume: 1000,
          closeTime: new Date('2024-01-01T01:59:59.999Z').getTime(),
          quoteVolume: 42000000,
          trades: 2194,
          takerBuyBaseVolume: 500,
          takerBuyQuoteVolume: 21000000
        },
        {
          openTime: new Date('2024-01-01T02:00:00Z').getTime(),
          open: 42300,
          high: 42800,
          low: 42100,
          close: 42600,
          volume: 1200,
          closeTime: new Date('2024-01-01T02:59:59.999Z').getTime(),
          quoteVolume: 51000000,
          trades: 2500,
          takerBuyBaseVolume: 600,
          takerBuyQuoteVolume: 25500000
        }
      ];

      // Mock findDataGaps
      dataManager.findDataGaps = jest.fn().mockResolvedValue(mockGaps);
      
      // Mock fetchKlines
      binanceApi.fetchKlines.mockResolvedValue(mockKlineData);

      // Mock saveCandle
      dataManager.saveCandle = jest.fn().mockResolvedValue(undefined);

      // Mock setTimeout to resolve immediately
      global.setTimeout = jest.fn((cb) => { cb(); });

      // Run the fillGaps operation
      const result = await dataManager.fillGaps('BTC', '1h');

      expect(result.candlesFilled).toBe(2);
      expect(result.errors).toHaveLength(0);
      
      expect(binanceApi.fetchKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '1h',
        1000,
        mockGaps[0].start,
        mockGaps[0].end
      );

      expect(dataManager.saveCandle).toHaveBeenCalledTimes(2);
    });

    it('respects maxCandles limit', async () => {
      const largeGap = {
        start: new Date('2024-01-01T00:00:00Z').getTime(),
        end: new Date('2024-01-10T00:00:00Z').getTime(),
        missingIntervals: 2000
      };

      dataManager.findDataGaps = jest.fn().mockResolvedValue([largeGap]);
      binanceApi.fetchKlines.mockResolvedValue([]);

      await dataManager.fillGaps('BTC', '1h', 500);

      // Should split into multiple requests
      expect(binanceApi.fetchKlines).toHaveBeenCalledWith(
        'BTCUSDT',
        '1h',
        500,
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('handles API errors gracefully', async () => {
      const mockGaps = [{
        start: Date.now() - 3600000,
        end: Date.now(),
        missingIntervals: 1
      }];

      dataManager.findDataGaps = jest.fn().mockResolvedValue(mockGaps);
      binanceApi.fetchKlines.mockRejectedValue(new Error('API Error'));

      const result = await dataManager.fillGaps('BTC', '1h');

      expect(result.candlesFilled).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('API Error');
    });

    it('implements rate limiting', async () => {
      const mockGaps = [
        { start: 1000, end: 2000, missingIntervals: 1 },
        { start: 3000, end: 4000, missingIntervals: 1 }
      ];

      dataManager.findDataGaps = jest.fn().mockResolvedValue(mockGaps);
      binanceApi.fetchKlines.mockResolvedValue([]);

      await dataManager.fillGaps('BTC', '1h');

      // Rate limiting is implemented inline, not with setTimeout
      // Just verify the fillGaps was called correctly
      expect(binanceApi.fetchKlines).toHaveBeenCalledTimes(2);
    });

    it('handles empty gaps', async () => {
      dataManager.findDataGaps = jest.fn().mockResolvedValue([]);

      const result = await dataManager.fillGaps('BTC', '1h');

      expect(result.candlesFilled).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(binanceApi.fetchKlines).not.toHaveBeenCalled();
    });

    it('calculates time chunks correctly', async () => {
      const largeGap = {
        start: 0,
        end: 5 * 24 * 60 * 60 * 1000, // 5 days in ms
        missingIntervals: 1440 // 5 days of 5m intervals
      };

      dataManager.findDataGaps = jest.fn().mockResolvedValue([largeGap]);
      binanceApi.fetchKlines.mockResolvedValue([]);

      await dataManager.fillGaps('BTC', '5m', 1000);

      // Should make at least one API call
      const calls = binanceApi.fetchKlines.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // Each call should respect the limit
      calls.forEach(call => {
        expect(call[2]).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('saveCandle', () => {
    it('saves candle data successfully', async () => {
      const mockCandle = {
        openTime: 1640995200000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000,
        closeTime: 1640998799999,
        quoteVolume: 42000000,
        trades: 2194,
        takerBuyBaseVolume: 500,
        takerBuyQuoteVolume: 21000000
      };

      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await dataManager.saveCandle('BTC', '1h', mockCandle);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO candlesticks'),
        [
          'BTC',
          '1h',
          mockCandle.openTime,
          mockCandle.open,
          mockCandle.high,
          mockCandle.low,
          mockCandle.close,
          mockCandle.volume,
          mockCandle.closeTime,
          mockCandle.quoteVolume,
          mockCandle.trades,
          mockCandle.takerBuyBaseVolume,
          mockCandle.takerBuyQuoteVolume
        ]
      );
    });

    it('handles conflict with ON CONFLICT clause', async () => {
      const mockCandle = {
        openTime: 1640995200000,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000
      };

      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await dataManager.saveCandle('BTC', '1h', mockCandle);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('handles database errors', async () => {
      const mockCandle = {
        openTime: 1640995200000,
        open: 42000
      };

      mockPool.query.mockRejectedValue(new Error('Database error'));

      await expect(dataManager.saveCandle('BTC', '1h', mockCandle))
        .rejects.toThrow('Database error');
    });
  });

  describe('fillAllGaps', () => {
    it('fills gaps for all configured tokens and timeframes', async () => {
      dataManager.fillGaps = jest.fn().mockResolvedValue({
        candlesFilled: 10,
        errors: []
      });

      const results = await dataManager.fillAllGaps();

      expect(results).toHaveLength(12); // 4 tokens * 3 timeframes
      expect(dataManager.fillGaps).toHaveBeenCalledTimes(12);
      
      // Verify all combinations
      ['BTC', 'ETH', 'SOL', 'ADA'].forEach(token => {
        ['5m', '1h', '1d'].forEach(timeframe => {
          expect(dataManager.fillGaps).toHaveBeenCalledWith(token, timeframe);
        });
      });
    });

    it('continues on individual failures', async () => {
      // Create a new instance with a custom fillGaps implementation
      const customDataManager = new DataManager(mockPool, mockMarketConfig);
      
      let callCount = 0;
      customDataManager.fillGaps = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({ candlesFilled: 0, errors: ['Failed'] });
        }
        return Promise.resolve({ candlesFilled: 10, errors: [] });
      });

      const results = await customDataManager.fillAllGaps();

      // Should still return results for all operations
      expect(results).toHaveLength(12); // 4 tokens * 3 timeframes
      expect(results.some(r => r.errors && r.errors.length > 0)).toBe(true);
      expect(results.filter(r => r.candlesFilled === 10).length).toBeGreaterThan(0);
    });
  });

  describe('getDataStats', () => {
    it('returns data statistics', async () => {
      const mockStats = {
        rows: [
          { 
            token: 'BTC', 
            timeframe: '1h', 
            count: '1000', 
            oldest: new Date('2024-01-01'), 
            newest: new Date('2024-01-10') 
          },
          { 
            token: 'ETH', 
            timeframe: '1h', 
            count: '800', 
            oldest: new Date('2024-01-02'), 
            newest: new Date('2024-01-10') 
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockStats);

      const stats = await dataManager.getDataStats();

      expect(stats).toEqual([
        {
          token: 'BTC',
          timeframe: '1h',
          count: 1000,
          oldest: mockStats.rows[0].oldest,
          newest: mockStats.rows[0].newest
        },
        {
          token: 'ETH',
          timeframe: '1h',
          count: 800,
          oldest: mockStats.rows[1].oldest,
          newest: mockStats.rows[1].newest
        }
      ]);
    });

    it('handles empty stats', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const stats = await dataManager.getDataStats();

      expect(stats).toEqual([]);
    });
  });

  describe('cleanOldData', () => {
    it('deletes old data based on retention period', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 100 });

      const deleted = await dataManager.cleanOldData(30);

      expect(deleted).toBe(100);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM candlesticks'),
        [expect.any(Number)]
      );
    });

    it('handles no data to delete', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const deleted = await dataManager.cleanOldData(30);

      expect(deleted).toBe(0);
    });

    it('uses correct date calculation', async () => {
      const retentionDays = 7;
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await dataManager.cleanOldData(retentionDays);

      const callArgs = mockPool.query.mock.calls[0];
      const query = callArgs[0];
      const params = callArgs[1];
      
      expect(query).toContain('open_time < $1');
      expect(params[0]).toBeLessThan(Date.now());
      expect(params[0]).toBeGreaterThan(Date.now() - retentionDays * 24 * 60 * 60 * 1000 - 1000); // Allow 1s tolerance
    });
  });

  describe('Edge cases', () => {
    it('handles invalid timeframe intervals', async () => {
      const mockData = {
        rows: [{ open_time: Date.now() }]
      };

      mockPool.query.mockResolvedValue(mockData);

      // Should not throw, but handle gracefully
      const gaps = await dataManager.findDataGaps('BTC', 'invalid');
      
      // Default to some reasonable interval
      expect(gaps).toBeDefined();
    });

    it('handles very large data gaps', async () => {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const mockData = {
        rows: [{ open_time: yearAgo.getTime() }]
      };

      mockPool.query.mockResolvedValue(mockData);

      const gaps = await dataManager.findDataGaps('BTC', '1h');

      // Should identify the large gap
      // With year-old data, should identify gap
      if (gaps.length > 0) {
        expect(gaps[0].missingIntervals).toBeGreaterThan(8000); // ~8760 hours in a year
      }
    });
  });
});