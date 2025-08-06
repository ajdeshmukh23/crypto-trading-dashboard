import { BinanceService, MARKET_CONFIG } from './binanceService';
import { CandlestickData } from '../types/market';

describe('BinanceService', () => {
  let binanceService: BinanceService;

  beforeEach(() => {
    binanceService = new BinanceService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('generateSyntheticData', () => {
    it('generates correct number of data points', () => {
      const data = binanceService.generateSyntheticData('BTC', '5m', 10);
      expect(data).toHaveLength(10);
    });

    it('generates data with correct structure', () => {
      const data = binanceService.generateSyntheticData('BTC', '5m', 1);
      expect(data[0]).toMatchObject({
        openTime: expect.any(Number),
        open: expect.any(Number),
        high: expect.any(Number),
        low: expect.any(Number),
        close: expect.any(Number),
        volume: expect.any(Number),
        closeTime: expect.any(Number),
        quoteVolume: expect.any(Number),
        trades: expect.any(Number),
        takerBuyBaseVolume: expect.any(Number),
        takerBuyQuoteVolume: expect.any(Number),
      });
    });

    it('generates chronologically ordered data', () => {
      const data = binanceService.generateSyntheticData('BTC', '5m', 5);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].openTime).toBeGreaterThan(data[i - 1].openTime);
      }
    });

    it('respects interval parameter', () => {
      const data5m = binanceService.generateSyntheticData('BTC', '5m', 2);
      const data1d = binanceService.generateSyntheticData('BTC', '1d', 2);
      
      const interval5m = data5m[1].openTime - data5m[0].openTime;
      const interval1d = data1d[1].openTime - data1d[0].openTime;
      
      expect(interval5m).toBeCloseTo(5 * 60 * 1000, -3);
      expect(interval1d).toBeCloseTo(24 * 60 * 60 * 1000, -3);
    });

    it('generates appropriate price ranges for different tokens', () => {
      const btcData = binanceService.generateSyntheticData('BTC', '5m', 10);
      const adaData = binanceService.generateSyntheticData('ADA', '5m', 10);
      
      const avgBtcPrice = btcData.reduce((sum, d) => sum + d.close, 0) / btcData.length;
      const avgAdaPrice = adaData.reduce((sum, d) => sum + d.close, 0) / adaData.length;
      
      expect(avgBtcPrice).toBeGreaterThan(10000);
      expect(avgAdaPrice).toBeLessThan(10);
    });

    it('ensures high >= max(open, close) and low <= min(open, close)', () => {
      const data = binanceService.generateSyntheticData('BTC', '5m', 50);
      data.forEach(candle => {
        expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
        expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      });
    });

    it('calculates closeTime correctly', () => {
      const data = binanceService.generateSyntheticData('BTC', '5m', 5);
      data.forEach(candle => {
        expect(candle.closeTime).toBe(candle.openTime + 5 * 60 * 1000 - 1);
      });
    });
  });

  // Note: convertStreamData method was removed from BinanceService
  // The conversion is now done inline in connectKlineStream

  describe('calculateIndicators', () => {
    const generateTestData = (count: number): CandlestickData[] => {
      const data: CandlestickData[] = [];
      for (let i = 0; i < count; i++) {
        data.push({
          openTime: Date.now() - (count - i) * 300000,
          open: 100 + i,
          high: 100 + i + 2,
          low: 100 + i - 1,
          close: 100 + i + 1,
          volume: 1000 + i * 10,
          closeTime: Date.now() - (count - i) * 300000 + 299999,
          quoteVolume: (100 + i) * (1000 + i * 10),
          trades: 100 + i,
          takerBuyBaseVolume: (1000 + i * 10) * 0.6,
          takerBuyQuoteVolume: (100 + i) * (1000 + i * 10) * 0.6,
        });
      }
      return data;
    };

    it('returns null for empty data', () => {
      const result = BinanceService.calculateIndicators([]);
      expect(result).toBeNull();
    });

    it('calculates SMA correctly', () => {
      const data = generateTestData(50);
      const result = BinanceService.calculateIndicators(data);
      
      expect(result).toBeDefined();
      expect(result!.sma20).toHaveLength(31); // 50 - 20 + 1
      expect(result!.sma50).toHaveLength(1); // 50 - 50 + 1
      
      // Check last SMA20 value (average of last 20 closes)
      const expectedSma20 = data.slice(-20).reduce((sum, d) => sum + d.close, 0) / 20;
      expect(result!.sma20[result!.sma20.length - 1]).toBeCloseTo(expectedSma20, 2);
    });

    it('calculates RSI correctly', () => {
      const data = generateTestData(30);
      const result = BinanceService.calculateIndicators(data);
      
      expect(result).toBeDefined();
      expect(result!.rsi.length).toBeGreaterThan(0);
      
      // RSI should be between 0 and 100
      result!.rsi.forEach(rsi => {
        expect(rsi).toBeGreaterThanOrEqual(0);
        expect(rsi).toBeLessThanOrEqual(100);
      });
    });

    it('calculates volume metrics correctly', () => {
      const data = generateTestData(10);
      const result = BinanceService.calculateIndicators(data);
      
      expect(result).toBeDefined();
      expect(result!.volume).toHaveLength(10);
      expect(result!.avgVolume).toBeCloseTo(
        data.reduce((sum, d) => sum + d.volume, 0) / data.length,
        2
      );
    });

    it('finds high and low correctly', () => {
      const data = generateTestData(10);
      const result = BinanceService.calculateIndicators(data);
      
      expect(result).toBeDefined();
      expect(result!.high).toBe(Math.max(...data.map(d => d.high)));
      expect(result!.low).toBe(Math.min(...data.map(d => d.low)));
    });
  });

  describe('MARKET_CONFIG', () => {
    it('contains all supported tokens', () => {
      expect(MARKET_CONFIG).toHaveProperty('BTC');
      expect(MARKET_CONFIG).toHaveProperty('ETH');
      expect(MARKET_CONFIG).toHaveProperty('SOL');
      expect(MARKET_CONFIG).toHaveProperty('ADA');
    });

    it('has correct structure for each token', () => {
      Object.entries(MARKET_CONFIG).forEach(([token, config]) => {
        expect(config).toHaveProperty('symbol');
        expect(config).toHaveProperty('name');
        expect(config.symbol).toMatch(/^[a-z]+usdt$/);
        expect(typeof config.name).toBe('string');
      });
    });
  });

  describe('connectKlineStream', () => {
    it('creates WebSocket with correct URL', () => {
      const originalWebSocket = global.WebSocket;
      const mockWebSocketInstance = {
        readyState: 1, // WebSocket.OPEN
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null
      };
      const mockWebSocket = jest.fn().mockReturnValue(mockWebSocketInstance);
      global.WebSocket = mockWebSocket as any;
      // Also mock the WebSocket constants
      (global as any).WebSocket.CONNECTING = 0;
      (global as any).WebSocket.OPEN = 1;
      (global as any).WebSocket.CLOSING = 2;
      (global as any).WebSocket.CLOSED = 3;

      binanceService.connectKlineStream(['BTC', 'ETH'], '5m', jest.fn());

      expect(mockWebSocket).toHaveBeenCalledWith(
        'wss://stream.binance.us:9443/stream?streams=btcusdt@kline_5m/ethusdt@kline_5m'
      );

      global.WebSocket = originalWebSocket;
    });

    it('handles unsupported tokens gracefully', () => {
      const originalWebSocket = global.WebSocket;
      const mockWebSocketInstance = {
        readyState: 1, // WebSocket.OPEN
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null
      };
      const mockWebSocket = jest.fn().mockReturnValue(mockWebSocketInstance);
      global.WebSocket = mockWebSocket as any;
      // Also mock the WebSocket constants
      (global as any).WebSocket.CONNECTING = 0;
      (global as any).WebSocket.OPEN = 1;
      (global as any).WebSocket.CLOSING = 2;
      (global as any).WebSocket.CLOSED = 3;

      binanceService.connectKlineStream(['BTC', 'UNKNOWN'], '5m', jest.fn());

      expect(mockWebSocket).toHaveBeenCalledWith(
        'wss://stream.binance.us:9443/stream?streams=btcusdt@kline_5m'
      );

      global.WebSocket = originalWebSocket;
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('manages subscriptions correctly', () => {
      const callback = jest.fn();
      
      binanceService.subscribe('BTC', '5m', callback);
      expect(binanceService['subscribers'].size).toBe(1);
      expect(binanceService['subscribers'].get('BTC_5m')).toBe(callback);
      
      binanceService.unsubscribe('BTC', '5m');
      expect(binanceService['subscribers'].size).toBe(0);
    });
  });
});