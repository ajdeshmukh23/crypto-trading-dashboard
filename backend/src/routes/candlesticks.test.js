const express = require('express');
const request = require('supertest');
const candlesticksRouter = require('./candlesticks');

describe('Candlesticks Routes', () => {
  let app;
  let mockPool;

  beforeEach(() => {
    app = express();
    mockPool = {
      query: jest.fn()
    };
    app.use('/api/candlesticks', candlesticksRouter(mockPool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /:token/:timeframe', () => {
    const mockCandlestickData = {
      rows: [
        {
          open_time: '1704070800000',
          open: '42300.00',
          high: '42800.50',
          low: '42100.25',
          close: '42600.75',
          volume: '1200.25',
          close_time: '1704074399999',
          quote_volume: '51000000.75',
          trades: 600,
          taker_buy_base_volume: '700.50',
          taker_buy_quote_volume: '29400000.00'
        },
        {
          open_time: '1704067200000',
          open: '42000.50',
          high: '42500.75',
          low: '41800.25',
          close: '42300.00',
          volume: '1000.5',
          close_time: '1704070799999',
          quote_volume: '42000000.50',
          trades: 500,
          taker_buy_base_volume: '600.75',
          taker_buy_quote_volume: '25200000.25'
        }
      ]
    };

    it('returns candlestick data successfully', async () => {
      mockPool.query.mockResolvedValue(mockCandlestickData);

      const response = await request(app)
        .get('/api/candlesticks/BTC/1h')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [
          {
            openTime: 1704067200000,
            open: 42000.50,
            high: 42500.75,
            low: 41800.25,
            close: 42300.00,
            volume: 1000.5,
            closeTime: 1704070799999,
            quoteVolume: 42000000.50,
            trades: 500,
            takerBuyBaseVolume: 600.75,
            takerBuyQuoteVolume: 25200000.25
          },
          {
            openTime: 1704070800000,
            open: 42300.00,
            high: 42800.50,
            low: 42100.25,
            close: 42600.75,
            volume: 1200.25,
            closeTime: 1704074399999,
            quoteVolume: 51000000.75,
            trades: 600,
            takerBuyBaseVolume: 700.50,
            takerBuyQuoteVolume: 29400000.00
          }
        ]
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['BTC', '1h', 1000]
      );
    });

    it('handles query parameters correctly', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/ETH/5m')
        .query({ 
          limit: 500, 
          startTime: 1640995200000, 
          endTime: 1641081600000 
        })
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND open_time >= $3'),
        ['ETH', '5m', 1640995200000, 1641081600000, 500]
      );
    });

    it('uses default limit when not provided', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/SOL/1d')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['SOL', '1d', 1000]
      );
    });

    it('converts token to uppercase', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/btc/1h')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['BTC', '1h', 1000]
      );
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/candlesticks/BTC/1h')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch candlesticks'
      });
    });

    it('returns empty array when no data found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/candlesticks/XRP/1h')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: []
      });
    });

    it('handles invalid timestamps gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/BTC/1h')
        .query({ 
          startTime: 'invalid', 
          endTime: 'invalid' 
        })
        .expect(200);

      // Should use NaN for invalid timestamps
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['BTC', '1h'])
      );
    });
  });

  describe('GET /tokens', () => {
    it('returns list of available tokens', async () => {
      const mockTokenData = {
        rows: [
          { token: 'BTC', count: '1000' },
          { token: 'ETH', count: '800' },
          { token: 'SOL', count: '600' },
          { token: 'ADA', count: '400' }
        ]
      };

      mockPool.query.mockResolvedValue(mockTokenData);

      const response = await request(app)
        .get('/api/candlesticks/tokens')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTokenData.rows
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT token')
      );
    });

    it('handles database errors for tokens endpoint', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/candlesticks/tokens')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch tokens'
      });
    });

    it('returns empty array when no tokens found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/candlesticks/tokens')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: []
      });
    });
  });

  describe('Edge cases', () => {
    it('handles null values in database response', async () => {
      const mockDataWithNulls = {
        rows: [{
          open_time: '1704067200000',
          open: null,
          high: '42500.75',
          low: '41800.25',
          close: '42300.00',
          volume: null,
          close_time: '1704070799999',
          quote_volume: '42000000.50',
          trades: null,
          taker_buy_base_volume: '600.75',
          taker_buy_quote_volume: null
        }]
      };

      mockPool.query.mockResolvedValue(mockDataWithNulls);

      const response = await request(app)
        .get('/api/candlesticks/BTC/1h')
        .expect(200);

      // NaN values are serialized as null in JSON
      expect(response.body.data[0]).toEqual({
        openTime: 1704067200000,
        open: null,
        high: 42500.75,
        low: 41800.25,
        close: 42300.00,
        volume: null,
        closeTime: 1704070799999,
        quoteVolume: 42000000.50,
        trades: null,
        takerBuyBaseVolume: 600.75,
        takerBuyQuoteVolume: null
      });
    });

    it('handles very large limit values', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/BTC/1h')
        .query({ limit: 999999999 })
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['BTC', '1h', 999999999]
      );
    });

    it('handles negative limit values', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get('/api/candlesticks/BTC/1h')
        .query({ limit: -100 })
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['BTC', '1h', -100]
      );
    });
  });
});