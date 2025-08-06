import { CandlestickData, BinanceKlineMessage } from '../types/market';

const BINANCE_WS_URL = 'wss://stream.binance.us:9443';

export const MARKET_CONFIG = {
  'BTC': { name: 'Bitcoin', symbol: 'btcusdt' },
  'ETH': { name: 'Ethereum', symbol: 'ethusdt' },
  'SOL': { name: 'Solana', symbol: 'solusdt' },
  'ADA': { name: 'Cardano', symbol: 'adausdt' }
};

export class BinanceService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribers: Map<string, (data: CandlestickData) => void> = new Map();

  // Generate synthetic historical data for initial display
  generateSyntheticData(token: string, interval: string = '5m', points: number = 50): CandlestickData[] {
    const data: CandlestickData[] = [];
    const now = Date.now();
    const intervalMs = interval === '5m' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    // Base prices for different tokens
    const basePrices: { [key: string]: number } = {
      'BTC': 45000,
      'ETH': 2500,
      'SOL': 100,
      'ADA': 0.5
    };
    
    let basePrice = basePrices[token] || 100;
    
    // Start from the beginning and move forward
    for (let i = 0; i < points; i++) {
      // Calculate openTime ensuring proper spacing
      const openTime = now - ((points - i - 1) * intervalMs);
      // Round to nearest interval to avoid millisecond issues
      const roundedOpenTime = Math.floor(openTime / intervalMs) * intervalMs;
      
      const volatility = 0.002; // 0.2% volatility
      
      // Generate OHLC values
      const open = basePrice;
      const change = (Math.random() - 0.5) * volatility * basePrice;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * volatility * basePrice * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * basePrice * 0.5;
      const volume = 1000 + Math.random() * 9000;
      
      data.push({
        openTime: roundedOpenTime,
        open: parseFloat(open.toFixed(4)),
        high: parseFloat(high.toFixed(4)),
        low: parseFloat(low.toFixed(4)),
        close: parseFloat(close.toFixed(4)),
        volume: parseFloat(volume.toFixed(2)),
        closeTime: roundedOpenTime + intervalMs - 1,
        quoteVolume: parseFloat((volume * close).toFixed(2)),
        trades: Math.floor(100 + Math.random() * 900),
        takerBuyBaseVolume: parseFloat((volume * 0.5).toFixed(2)),
        takerBuyQuoteVolume: parseFloat((volume * close * 0.5).toFixed(2))
      });
      
      basePrice = close; // Use close price as next candle's base
    }
    
    console.log(`Generated ${data.length} synthetic candles for ${token} with interval ${interval}`);
    return data;
  }

  // Connect to WebSocket for real-time kline updates
  connectKlineStream(tokens: string[], interval: string = '5m', onData: (token: string, data: CandlestickData) => void): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Create combined stream URL for all tokens
      const streams = tokens
        .map(token => {
          const symbol = MARKET_CONFIG[token as keyof typeof MARKET_CONFIG]?.symbol;
          return symbol ? `${symbol}@kline_${interval}` : null;
        })
        .filter(Boolean)
        .join('/');

      const streamUrl = `${BINANCE_WS_URL}/stream?streams=${streams}`;
      
      console.log('Connecting to WebSocket:', streamUrl);
      this.ws = new WebSocket(streamUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to Binance kline stream');
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const message: BinanceKlineMessage = parsed.data;
          
          if (message && message.e === 'kline' && message.k) {
            // Find which token this update is for
            const token = Object.entries(MARKET_CONFIG).find(
              ([_, config]) => config.symbol.toUpperCase() === message.s
            )?.[0];
            
            if (token) {
              const candlestick: CandlestickData = {
                openTime: message.k.t,
                open: parseFloat(message.k.o),
                high: parseFloat(message.k.h),
                low: parseFloat(message.k.l),
                close: parseFloat(message.k.c),
                volume: parseFloat(message.k.v),
                closeTime: message.k.T,
                quoteVolume: parseFloat(message.k.q),
                trades: message.k.n,
                takerBuyBaseVolume: parseFloat(message.k.V),
                takerBuyQuoteVolume: parseFloat(message.k.Q)
              };

              onData(token, candlestick);

              // Notify subscribers
              const key = `${token}_${interval}`;
              const subscriber = this.subscribers.get(key);
              if (subscriber) {
                subscriber(candlestick);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        
        // Attempt to reconnect after 5 seconds
        this.reconnectTimeout = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          this.connectKlineStream(tokens, interval, onData);
        }, 5000);
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
    }
  }

  // Subscribe to specific token/interval updates
  subscribe(token: string, interval: string, callback: (data: CandlestickData) => void): void {
    const key = `${token}_${interval}`;
    this.subscribers.set(key, callback);
  }

  // Unsubscribe from updates
  unsubscribe(token: string, interval: string): void {
    const key = `${token}_${interval}`;
    this.subscribers.delete(key);
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscribers.clear();
  }

  // Calculate technical indicators from candlestick data
  static calculateIndicators(candles: CandlestickData[]) {
    if (candles.length === 0) return null;

    // Calculate Simple Moving Averages
    const calculateSMA = (period: number): number[] => {
      const sma: number[] = [];
      for (let i = period - 1; i < candles.length; i++) {
        const sum = candles.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
        sma.push(sum / period);
      }
      return sma;
    };

    // Calculate RSI
    const calculateRSI = (period: number = 14): number[] => {
      const rsi: number[] = [];
      const gains: number[] = [];
      const losses: number[] = [];

      for (let i = 1; i < candles.length; i++) {
        const change = candles[i].close - candles[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }

      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

      for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }

      return rsi;
    };

    return {
      sma20: calculateSMA(20),
      sma50: calculateSMA(50),
      rsi: calculateRSI(14),
      volume: candles.map(c => c.volume),
      high: Math.max(...candles.map(c => c.high)),
      low: Math.min(...candles.map(c => c.low)),
      avgVolume: candles.reduce((acc, c) => acc + c.volume, 0) / candles.length
    };
  }
}