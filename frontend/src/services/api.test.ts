import { ApiService } from './api';

// Mock fetch globally
global.fetch = jest.fn();

describe('ApiService', () => {
  let apiService: ApiService;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    process.env.REACT_APP_API_URL = undefined;
    apiService = new ApiService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('returns true when API is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      } as Response);

      const result = await apiService.checkHealth();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/health');
    });

    it('returns false when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      const result = await apiService.checkHealth();
      expect(result).toBe(false);
    });

    it('returns false when fetch throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiService.checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('fetchCandlesticks', () => {
    const mockCandlestickData = [
      {
        openTime: 1234567890,
        open: 42000,
        high: 42500,
        low: 41800,
        close: 42300,
        volume: 1000,
        closeTime: 1234567890,
        quoteVolume: 42000000,
        trades: 500,
        takerBuyBaseVolume: 600,
        takerBuyQuoteVolume: 25200000,
      },
    ];

    it('fetches candlestick data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCandlestickData }),
      } as Response);

      const result = await apiService.fetchCandlesticks('BTC', '1h', 100);
      
      expect(result).toEqual(mockCandlestickData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/candlesticks/BTC/1h?limit=100'
      );
    });

    it('includes optional parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockCandlestickData }),
      } as Response);

      const startTime = 1234567890;
      const endTime = 1234567899;
      
      await apiService.fetchCandlesticks('ETH', '5m', 50, startTime, endTime);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/candlesticks/ETH/5m?limit=50&startTime=${startTime}&endTime=${endTime}`
      );
    });

    it('returns empty array on error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiService.fetchCandlesticks('BTC', '1h', 100);
      
      expect(result).toEqual([]);
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching candlesticks:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });

    it('returns empty array when response is not ok', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await apiService.fetchCandlesticks('BTC', '1h');
      
      expect(result).toEqual([]);
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });

  describe('fetchCurrentPrices', () => {
    const mockPriceData = {
      BTC: { price: 42000, change24h: 2.5 },
      ETH: { price: 2800, change24h: -1.2 },
      SOL: { price: 120, change24h: 5.8 },
      ADA: { price: 0.45, change24h: 0.0 },
    };

    it('fetches current prices successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockPriceData }),
      } as Response);

      const result = await apiService.fetchCurrentPrices();
      
      expect(result).toEqual(mockPriceData);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/prices/current');
    });

    it('returns empty object on error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiService.fetchCurrentPrices();
      
      expect(result).toEqual({});
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching current prices:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });

    it('returns empty object when response is not ok', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await apiService.fetchCurrentPrices();
      
      expect(result).toEqual({});
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });

  describe('fetch24hStats', () => {
    const mockStatsData = {
      currentPrice: 42000,
      change24h: 2.5
    };

    it('fetches 24h stats successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStatsData }),
      } as Response);

      const result = await apiService.fetch24hStats('BTC');
      
      expect(result).toEqual(mockStatsData);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/prices/stats/BTC'
      );
    });

    it('returns null on error', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiService.fetch24hStats('BTC');
      
      expect(result).toEqual({ currentPrice: 0, change24h: 0 });
      expect(consoleError).toHaveBeenCalledWith(
        'Error fetching 24h stats:',
        expect.any(Error)
      );
      
      consoleError.mockRestore();
    });

    it('returns null when response is not ok', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await apiService.fetch24hStats('BTC');
      
      expect(result).toEqual({ currentPrice: 0, change24h: 0 });
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });

});