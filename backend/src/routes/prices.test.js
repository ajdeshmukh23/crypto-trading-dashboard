const express = require('express');
const request = require('supertest');
const pricesRouter = require('./prices');

describe('Prices Routes', () => {
  let app;
  let mockPool;

  beforeEach(() => {
    app = express();
    mockPool = {
      query: jest.fn()
    };
    app.use('/api/prices', pricesRouter(mockPool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /current', () => {
    const mockPriceData = {
      rows: [
        {
          token: 'BTC',
          price: '42000.50',
          change_24h: '2.44',
          updated_at: new Date('2024-01-01T12:00:00Z')
        },
        {
          token: 'ETH',
          price: '2800.75',
          change_24h: '-1.73',
          updated_at: new Date('2024-01-01T12:00:00Z')
        },
        {
          token: 'SOL',
          price: '120.25',
          change_24h: '4.57',
          updated_at: new Date('2024-01-01T12:00:00Z')
        },
        {
          token: 'ADA',
          price: '0.4523',
          change_24h: '0.51',
          updated_at: new Date('2024-01-01T12:00:00Z')
        }
      ]
    };

    const mock24hData = {
      rows: [
        { token: 'BTC', close: '41000.00' },
        { token: 'ETH', close: '2850.00' },
        { token: 'SOL', close: '115.00' },
        { token: 'ADA', close: '0.4500' }
      ]
    };

    it('returns current prices with 24h change', async () => {
      mockPool.query.mockResolvedValueOnce(mockPriceData);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          BTC: {
            price: 42000.50,
            change24h: 2.44,
            updatedAt: mockPriceData.rows[0].updated_at.toISOString()
          },
          ETH: {
            price: 2800.75,
            change24h: -1.73,
            updatedAt: mockPriceData.rows[1].updated_at.toISOString()
          },
          SOL: {
            price: 120.25,
            change24h: 4.57,
            updatedAt: mockPriceData.rows[2].updated_at.toISOString()
          },
          ADA: {
            price: 0.4523,
            change24h: 0.51,
            updatedAt: mockPriceData.rows[3].updated_at.toISOString()
          }
        }
      });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT token, price, change_24h, updated_at')
      );
    });

    it('handles missing 24h data', async () => {
      const mockDataNoChange = {
        rows: mockPriceData.rows.map(row => ({
          ...row,
          change_24h: null
        }))
      };
      
      mockPool.query.mockResolvedValueOnce(mockDataNoChange);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body.data).toEqual({
        BTC: {
          price: 42000.50,
          change24h: 0,
          updatedAt: mockDataNoChange.rows[0].updated_at.toISOString()
        },
        ETH: {
          price: 2800.75,
          change24h: 0,
          updatedAt: mockDataNoChange.rows[1].updated_at.toISOString()
        },
        SOL: {
          price: 120.25,
          change24h: 0,
          updatedAt: mockDataNoChange.rows[2].updated_at.toISOString()
        },
        ADA: {
          price: 0.4523,
          change24h: 0,
          updatedAt: mockDataNoChange.rows[3].updated_at.toISOString()
        }
      });
    });

    it('handles partial 24h data', async () => {
      const partialMockData = {
        rows: [
          {
            token: 'BTC',
            price: '42000.50',
            change_24h: '2.44',
            updated_at: new Date('2024-01-01T12:00:00Z')
          },
          {
            token: 'ETH',
            price: '2800.75',
            change_24h: '-1.73',
            updated_at: new Date('2024-01-01T12:00:00Z')
          },
          {
            token: 'SOL',
            price: '120.25',
            change_24h: null,
            updated_at: new Date('2024-01-01T12:00:00Z')
          },
          {
            token: 'ADA',
            price: '0.4523',
            change_24h: null,
            updated_at: new Date('2024-01-01T12:00:00Z')
          }
        ]
      };
      
      mockPool.query.mockResolvedValueOnce(partialMockData);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body.data.BTC.change24h).toBe(2.44);
      expect(response.body.data.ETH.change24h).toBe(-1.73);
      expect(response.body.data.SOL.change24h).toBe(0);
      expect(response.body.data.ADA.change24h).toBe(0);
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/prices/current')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch current prices'
      });
    });

    it('returns empty object when no price data', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {}
      });
    });

    it('handles null values in price data', async () => {
      const mockDataWithNulls = {
        rows: [{
          token: 'BTC',
          price: null,
          change_24h: null,
          updated_at: new Date('2024-01-01T12:00:00Z')
        }]
      };

      mockPool.query.mockResolvedValueOnce(mockDataWithNulls);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      expect(response.body.data.BTC).toEqual({
        price: null,
        change24h: 0,
        updatedAt: mockDataWithNulls.rows[0].updated_at.toISOString()
      });
    });

    it('calculates percentage change correctly for edge cases', async () => {
      const currentPrices = {
        rows: [
          { token: 'BTC', price: '0', change_24h: '-100', updated_at: new Date() },
          { token: 'ETH', price: '100', change_24h: '0', updated_at: new Date() }
        ]
      };

      mockPool.query.mockResolvedValueOnce(currentPrices);

      const response = await request(app)
        .get('/api/prices/current')
        .expect(200);

      // When new price is 0, change should be -100%
      expect(response.body.data.BTC.change24h).toBe(-100);
      // When old price is 0, change should be 0%
      expect(response.body.data.ETH.change24h).toBe(0);
    });
  });

  describe('GET /stats/:token', () => {
    it('returns 24h stats for a token', async () => {
      const mockCurrentPrice = {
        rows: [{ close: '42000.50' }]
      };

      const mockOldPrice = {
        rows: [{ close: '41000.00' }]
      };

      mockPool.query
        .mockResolvedValueOnce(mockCurrentPrice)
        .mockResolvedValueOnce(mockOldPrice);

      const response = await request(app)
        .get('/api/prices/stats/BTC')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          token: 'BTC',
          currentPrice: 42000.50,
          price24hAgo: 41000.00,
          change24h: 2.44
        }
      });

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // First query gets current price
      expect(mockPool.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('SELECT close'),
        ['BTC']
      );
      // Second query gets price from 24h ago
      expect(mockPool.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('open_time <= $2'),
        ['BTC', expect.any(String)]
      );
    });

    it('converts token to uppercase', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: '2800.75' }] })
        .mockResolvedValueOnce({ rows: [{ close: '2850.00' }] });

      await request(app)
        .get('/api/prices/stats/eth')
        .expect(200);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['ETH']
      );
    });

    it('handles missing current price', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/prices/stats/XRP')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          token: 'XRP',
          currentPrice: 0,
          price24hAgo: 0,
          change24h: 0
        }
      });
    });

    it('handles missing 24h ago price', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: '120.50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/prices/stats/SOL')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          token: 'SOL',
          currentPrice: 120.50,
          price24hAgo: 0,
          change24h: 0
        }
      });
    });

    it('handles database errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      const response = await request(app)
        .get('/api/prices/stats/BTC')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch 24h stats'
      });
    });

    it('calculates negative percentage change correctly', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: '0.4500' }] })
        .mockResolvedValueOnce({ rows: [{ close: '0.5000' }] });

      const response = await request(app)
        .get('/api/prices/stats/ADA')
        .expect(200);

      expect(response.body.data).toEqual({
        token: 'ADA',
        currentPrice: 0.45,
        price24hAgo: 0.50,
        change24h: -10.00
      });
    });

    it('handles zero old price', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: '100.00' }] })
        .mockResolvedValueOnce({ rows: [{ close: '0' }] });

      const response = await request(app)
        .get('/api/prices/stats/TEST')
        .expect(200);

      expect(response.body.data.change24h).toBe(0);
    });

    it('handles null values', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: null }] })
        .mockResolvedValueOnce({ rows: [{ close: null }] });

      const response = await request(app)
        .get('/api/prices/stats/BTC')
        .expect(200);

      expect(response.body.data).toEqual({
        token: 'BTC',
        currentPrice: null,
        price24hAgo: null,
        change24h: 0
      });
    });

    it('handles very small percentage changes', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ close: '42000.01' }] })
        .mockResolvedValueOnce({ rows: [{ close: '42000.00' }] });

      const response = await request(app)
        .get('/api/prices/stats/BTC')
        .expect(200);

      expect(response.body.data.change24h).toBeCloseTo(0.00, 2);
    });
  });

  describe('Error scenarios', () => {
    it('handles database connection errors gracefully', async () => {
      mockPool.query.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const response = await request(app)
        .get('/api/prices/current')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('handles malformed database responses', async () => {
      mockPool.query.mockResolvedValue({ 
        // Missing 'rows' property
        data: [] 
      });

      const response = await request(app)
        .get('/api/prices/current')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});