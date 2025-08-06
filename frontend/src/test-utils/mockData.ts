import { CandlestickData } from '../types/market';

export const mockCandlestickData: CandlestickData[] = [
  {
    openTime: 1704067200000, // 2024-01-01T00:00:00Z
    open: 42000,
    high: 42500,
    low: 41800,
    close: 42300,
    volume: 1000,
    closeTime: 1704070799999, // 2024-01-01T00:59:59.999Z
    quoteVolume: 42150000,
    trades: 1500,
    takerBuyBaseVolume: 600,
    takerBuyQuoteVolume: 25290000,
  },
  {
    openTime: 1704070800000, // 2024-01-01T01:00:00Z
    open: 42300,
    high: 42800,
    low: 42100,
    close: 42600,
    volume: 1200,
    closeTime: 1704074399999, // 2024-01-01T01:59:59.999Z
    quoteVolume: 51060000,
    trades: 1800,
    takerBuyBaseVolume: 720,
    takerBuyQuoteVolume: 30636000,
  },
];

export const mockPriceUpdate = {
  symbol: 'BTCUSDT',
  price: '42600.50',
  timestamp: Date.now(),
};

export const mockTradingIndicators = {
  rsi: 65.5,
  macd: {
    MACD: 250.5,
    signal: 200.3,
    histogram: 50.2,
  },
  bollinger: {
    upper: 43000,
    middle: 42000,
    lower: 41000,
  },
  volume: {
    current: 1200,
    average: 1000,
  },
};

// Helper function to generate mock candlestick data
export function generateMockCandlestickData(count: number, basePrice: number = 42000): CandlestickData[] {
  const data: CandlestickData[] = [];
  const baseTime = Date.now() - count * 3600000; // Start from count hours ago
  
  for (let i = 0; i < count; i++) {
    const openTime = baseTime + i * 3600000;
    const open = basePrice + (Math.random() - 0.5) * 1000;
    const close = open + (Math.random() - 0.5) * 500;
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const volume = 1000 + Math.random() * 500;
    
    data.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + 3599999,
      quoteVolume: volume * (open + close) / 2,
      trades: Math.floor(1000 + Math.random() * 1000),
      takerBuyBaseVolume: volume * 0.6,
      takerBuyQuoteVolume: volume * (open + close) / 2 * 0.6,
    });
  }
  
  return data;
}