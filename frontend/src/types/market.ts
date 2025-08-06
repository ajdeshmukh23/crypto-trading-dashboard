export interface CandlestickData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}

export interface PricePoint {
  time: string;
  timestamp: number;
  price: number;
  change: number;
  volume?: number;
  volumeColor?: string;
}

export interface TokenData {
  [timeframe: string]: PricePoint[] | CandlestickData[];
}

export interface MarketData {
  [token: string]: TokenData;
}

export interface BinanceKlineMessage {
  e: string;  // Event type = 'kline'
  E: number;  // Event time
  s: string;  // Symbol
  k: {
    t: number;  // Kline start time
    T: number;  // Kline close time
    s: string;  // Symbol
    i: string;  // Interval
    f: number;  // First trade ID
    L: number;  // Last trade ID
    o: string;  // Open price
    c: string;  // Close price
    h: string;  // High price
    l: string;  // Low price
    v: string;  // Base asset volume
    n: number;  // Number of trades
    x: boolean; // Is this kline closed?
    q: string;  // Quote asset volume
    V: string;  // Taker buy base asset volume
    Q: string;  // Taker buy quote asset volume
    B: string;  // Ignore
  };
}

export interface BinanceTickerMessage {
  e: string;  // Event type
  E: number;  // Event time
  s: string;  // Symbol
  p: string;  // Price change
  P: string;  // Price change percent
  w: string;  // Weighted average price
  x: string;  // First trade(F)-1 price (previous close)
  c: string;  // Last price
  Q: string;  // Last quantity
  b: string;  // Best bid price
  B: string;  // Best bid quantity
  a: string;  // Best ask price
  A: string;  // Best ask quantity
  o: string;  // Open price
  h: string;  // High price
  l: string;  // Low price
  v: string;  // Total traded base asset volume
  q: string;  // Total traded quote asset volume
  O: number;  // Statistics open time
  C: number;  // Statistics close time
  F: number;  // First trade ID
  L: number;  // Last trade Id
  n: number;  // Total number of trades
}