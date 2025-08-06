import React, { useMemo, useState, useEffect } from 'react';
import { CandlestickData } from '../types/market';

interface TradingIndicatorsProps {
  data: CandlestickData[];
  currentPrice: number;
  period?: string;
}

interface IndicatorSignal {
  name: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  value?: number;
  description: string;
}

export const TradingIndicators: React.FC<TradingIndicatorsProps> = ({ data, currentPrice, period = '1D' }) => {
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.indicator-info-button') && !target.closest('.indicator-tooltip')) {
        setSelectedIndicator(null);
      }
    };
    
    if (selectedIndicator) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [selectedIndicator]);
  
  const indicators = useMemo(() => {
    if (!data || data.length < 50) return [];

    const signals: IndicatorSignal[] = [];

    const rsi = calculateRSI(data, 14);
    if (rsi !== null) {
      signals.push({
        name: 'RSI (14)',
        signal: rsi < 30 ? 'BUY' : rsi > 70 ? 'SELL' : 'NEUTRAL',
        value: rsi,
        description: rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Normal'
      });
    }

    const ma20 = calculateSMA(data, 20);
    const ma50 = calculateSMA(data, 50);
    if (ma20 && ma50 && currentPrice) {
      const maCrossSignal = ma20 > ma50 && currentPrice > ma20 ? 'BUY' : 
                           ma20 < ma50 && currentPrice < ma20 ? 'SELL' : 'NEUTRAL';
      signals.push({
        name: 'MA Cross',
        signal: maCrossSignal,
        description: maCrossSignal === 'BUY' ? 'Bullish crossover' : 
                    maCrossSignal === 'SELL' ? 'Bearish crossover' : 'No clear signal'
      });
    }

    const macdResult = calculateMACD(data);
    if (macdResult) {
      const macdSignal = macdResult.histogram > 0 && macdResult.macd > macdResult.signal ? 'BUY' :
                        macdResult.histogram < 0 && macdResult.macd < macdResult.signal ? 'SELL' : 'NEUTRAL';
      signals.push({
        name: 'MACD',
        signal: macdSignal,
        value: macdResult.histogram,
        description: macdSignal === 'BUY' ? 'Bullish momentum' : 
                    macdSignal === 'SELL' ? 'Bearish momentum' : 'Consolidating'
      });
    }

    const bb = calculateBollingerBands(data, 20);
    if (bb && currentPrice) {
      const bbSignal = currentPrice < bb.lower ? 'BUY' : 
                      currentPrice > bb.upper ? 'SELL' : 'NEUTRAL';
      signals.push({
        name: 'Bollinger Bands',
        signal: bbSignal,
        description: bbSignal === 'BUY' ? 'Price below lower band' : 
                    bbSignal === 'SELL' ? 'Price above upper band' : 'Within bands'
      });
    }

    const volumeSignal = analyzeVolume(data);
    if (volumeSignal) {
      signals.push(volumeSignal);
    }

    const stochastic = calculateStochastic(data, 14, 3, 3);
    if (stochastic) {
      const stochSignal = stochastic.k < 20 ? 'BUY' : stochastic.k > 80 ? 'SELL' : 'NEUTRAL';
      signals.push({
        name: 'Stochastic',
        signal: stochSignal,
        value: stochastic.k,
        description: stochSignal === 'BUY' ? 'Oversold zone' : 
                    stochSignal === 'SELL' ? 'Overbought zone' : 'Normal range'
      });
    }

    const atr = calculateATR(data, 14);
    if (atr && currentPrice) {
      const volatilityRatio = (atr / currentPrice) * 100;
      signals.push({
        name: 'Volatility (ATR)',
        signal: 'NEUTRAL',
        value: volatilityRatio,
        description: volatilityRatio > 3 ? 'High volatility' : 
                    volatilityRatio < 1 ? 'Low volatility' : 'Normal volatility'
      });
    }

    const fibLevels = calculateFibonacciLevels(data);
    if (fibLevels && currentPrice) {
      let fibSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
      let fibDescription = 'Between levels';
      
      if (currentPrice <= fibLevels.level236) {
        fibSignal = 'BUY';
        fibDescription = 'Near 23.6% support';
      } else if (currentPrice >= fibLevels.level618) {
        fibSignal = 'SELL';
        fibDescription = 'Near 61.8% resistance';
      }
      
      signals.push({
        name: 'Fibonacci',
        signal: fibSignal,
        description: fibDescription
      });
    }

    const ichimoku = calculateIchimoku(data);
    if (ichimoku && currentPrice) {
      const cloudSignal = currentPrice > ichimoku.senkou_a && currentPrice > ichimoku.senkou_b ? 'BUY' :
                         currentPrice < ichimoku.senkou_a && currentPrice < ichimoku.senkou_b ? 'SELL' : 'NEUTRAL';
      signals.push({
        name: 'Ichimoku Cloud',
        signal: cloudSignal,
        description: cloudSignal === 'BUY' ? 'Above cloud' : 
                    cloudSignal === 'SELL' ? 'Below cloud' : 'Inside cloud'
      });
    }

    const obvTrend = analyzeOBV(data);
    if (obvTrend) {
      signals.push(obvTrend);
    }

    return signals;
  }, [data, currentPrice, period]);

  const overallSentiment = useMemo(() => {
    if (indicators.length === 0) return 'NEUTRAL';
    
    const scores = { BUY: 0, SELL: 0, NEUTRAL: 0 };
    indicators.forEach(ind => scores[ind.signal]++);
    
    if (scores.BUY > scores.SELL + 1) return 'BUY';
    if (scores.SELL > scores.BUY + 1) return 'SELL';
    return 'NEUTRAL';
  }, [indicators]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return '#00ff88';
      case 'SELL': return '#ff3366';
      default: return '#666666';
    }
  };

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY': return '↑';
      case 'SELL': return '↓';
      default: return '→';
    }
  };

  const indicatorDescriptions: { [key: string]: string } = {
    'RSI (14)': 'Relative Strength Index measures momentum. Values below 30 indicate oversold conditions (potential buy), above 70 indicate overbought (potential sell).',
    'MA Cross': 'Moving Average Crossover compares 20-day and 50-day averages. Bullish when short-term crosses above long-term.',
    'MACD': 'Moving Average Convergence Divergence tracks trend changes. Positive histogram indicates bullish momentum.',
    'Bollinger Bands': 'Price bands based on volatility. Price touching lower band suggests oversold, upper band suggests overbought.',
    'Volume Analysis': 'Compares recent volume to average. High volume with price movement confirms trend strength.',
    'Stochastic': 'Momentum indicator comparing closing price to price range. Below 20 is oversold, above 80 is overbought.',
    'Volatility (ATR)': 'Average True Range measures market volatility. Higher values indicate more volatile conditions.',
    'Fibonacci': 'Key retracement levels where price often finds support or resistance (23.6%, 38.2%, 50%, 61.8%).',
    'Ichimoku Cloud': 'Comprehensive indicator showing support/resistance. Price above cloud is bullish, below is bearish.',
    'OBV Trend': 'On-Balance Volume tracks volume flow. Rising OBV with price confirms uptrend, divergence warns of reversal.'
  };

  if (data.length < 50) {
    return (
      <div style={{ padding: '24px', border: '1px solid #0a0a0a', background: 'rgba(255, 255, 255, 0.01)' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 400, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '20px' }}>
          Trading Indicators
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#666666' }}>
          Need more data for indicators (min 50 candles)
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #0a0a0a', background: 'rgba(255, 255, 255, 0.01)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.75rem', fontWeight: 400, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
          Trading Indicators
        </h3>
        <span style={{ fontSize: '0.7rem', color: '#444444' }}>Period: {period}</span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px' }}>
        <div style={{ 
          padding: '12px', 
          border: '1px solid #0a0a0a',
          background: 'rgba(255, 255, 255, 0.01)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.7rem', color: '#666666', marginBottom: '4px' }}>Overall Signal</div>
          <div style={{ 
            fontSize: '1.25rem', 
            fontWeight: 300,
            color: getSignalColor(overallSentiment),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <span>{getSignalIcon(overallSentiment)}</span>
            <span>{overallSentiment}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          {indicators.map((indicator, index) => (
            <div key={index} style={{ 
              padding: '12px',
              border: '1px solid #0a0a0a',
              background: 'rgba(255, 255, 255, 0.01)',
              position: 'relative'
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    className="indicator-info-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndicator(selectedIndicator === indicator.name ? null : indicator.name);
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #333333',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: '0.6rem',
                      color: '#666666',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#666666';
                      e.currentTarget.style.color = '#999999';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#333333';
                      e.currentTarget.style.color = '#666666';
                    }}
                  >
                    i
                  </button>
                  {indicator.name}
                </span>
                <span style={{ 
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  color: getSignalColor(indicator.signal)
                }}>
                  {getSignalIcon(indicator.signal)} {indicator.signal}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666666' }}>
                {indicator.value !== undefined && `${indicator.value.toFixed(1)} - `}
                {indicator.description}
              </div>
              
              {selectedIndicator === indicator.name && (
                <div 
                  className="indicator-tooltip"
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    maxWidth: '400px',
                    padding: '16px',
                    background: '#000000',
                    border: '1px solid #333333',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#cccccc',
                    lineHeight: '1.6',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  {indicatorDescriptions[indicator.name] || 'No description available.'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function calculateSMA(data: CandlestickData[], period: number): number | null {
  if (data.length < period) return null;
  
  const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
  return sum / period;
}

function calculateRSI(data: CandlestickData[], period: number = 14): number | null {
  if (data.length < period + 1) return null;

  const changes = [];
  for (let i = data.length - period - 1; i < data.length - 1; i++) {
    changes.push(data[i + 1].close - data[i].close);
  }

  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

function calculateMACD(data: CandlestickData[]) {
  if (data.length < 26) return null;

  const ema12 = calculateEMA(data.map(d => d.close), 12);
  const ema26 = calculateEMA(data.map(d => d.close), 26);
  
  if (!ema12 || !ema26) return null;

  const macd = ema12 - ema26;
  const signal = calculateEMA([macd], 9) || 0;
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateBollingerBands(data: CandlestickData[], period: number = 20) {
  if (data.length < period) return null;

  const sma = calculateSMA(data, period);
  if (!sma) return null;

  const prices = data.slice(-period).map(d => d.close);
  const squaredDiffs = prices.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: sma + (2 * stdDev),
    middle: sma,
    lower: sma - (2 * stdDev)
  };
}

function analyzeVolume(data: CandlestickData[]): IndicatorSignal | null {
  if (data.length < 20) return null;

  const recentVolume = data.slice(-5).reduce((acc, d) => acc + d.volume, 0) / 5;
  const avgVolume = data.slice(-20).reduce((acc, d) => acc + d.volume, 0) / 20;
  
  const volumeRatio = recentVolume / avgVolume;
  const priceChange = ((data[data.length - 1].close - data[data.length - 5].close) / data[data.length - 5].close) * 100;

  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let description = 'Normal volume';

  if (volumeRatio > 1.5 && priceChange > 1) {
    signal = 'BUY';
    description = 'High volume with rising price';
  } else if (volumeRatio > 1.5 && priceChange < -1) {
    signal = 'SELL';
    description = 'High volume with falling price';
  }

  return {
    name: 'Volume Analysis',
    signal,
    value: volumeRatio,
    description
  };
}

function calculateStochastic(data: CandlestickData[], kPeriod: number, dPeriod: number, smooth: number) {
  if (data.length < kPeriod + dPeriod) return null;

  const recentData = data.slice(-kPeriod);
  const high = Math.max(...recentData.map(d => d.high));
  const low = Math.min(...recentData.map(d => d.low));
  const close = data[data.length - 1].close;

  if (high === low) return null;

  const k = ((close - low) / (high - low)) * 100;
  
  return { k, d: k };
}

function calculateATR(data: CandlestickData[], period: number): number | null {
  if (data.length < period + 1) return null;

  const trueRanges = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

function calculateFibonacciLevels(data: CandlestickData[]) {
  if (data.length < 20) return null;

  const prices = data.map(d => d.high);
  const high = Math.max(...prices);
  const low = Math.min(...data.map(d => d.low));
  const diff = high - low;

  return {
    high,
    low,
    level236: high - (diff * 0.236),
    level382: high - (diff * 0.382),
    level500: high - (diff * 0.5),
    level618: high - (diff * 0.618),
    level786: high - (diff * 0.786)
  };
}

function calculateIchimoku(data: CandlestickData[]) {
  if (data.length < 52) return null;

  const tenkan = calculateMidpoint(data.slice(-9));
  
  const kijun = calculateMidpoint(data.slice(-26));
  
  const senkou_a = (tenkan + kijun) / 2;
  
  const senkou_b = calculateMidpoint(data.slice(-52));

  return { tenkan, kijun, senkou_a, senkou_b };
}

function calculateMidpoint(data: CandlestickData[]): number {
  const high = Math.max(...data.map(d => d.high));
  const low = Math.min(...data.map(d => d.low));
  return (high + low) / 2;
}

function analyzeOBV(data: CandlestickData[]): IndicatorSignal | null {
  if (data.length < 20) return null;

  let obv = 0;
  const obvValues = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += data[i].volume;
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume;
    }
    obvValues.push(obv);
  }

  const recentOBV = obvValues.slice(-10);
  const oldOBV = obvValues.slice(-20, -10);
  const recentAvg = recentOBV.reduce((a, b) => a + b, 0) / recentOBV.length;
  const oldAvg = oldOBV.reduce((a, b) => a + b, 0) / oldOBV.length;

  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let description = 'Stable accumulation';

  const priceChange = ((data[data.length - 1].close - data[data.length - 10].close) / data[data.length - 10].close) * 100;

  if (recentAvg > oldAvg && priceChange > 0) {
    signal = 'BUY';
    description = 'Volume accumulation';
  } else if (recentAvg < oldAvg && priceChange < 0) {
    signal = 'SELL';
    description = 'Volume distribution';
  } else if (recentAvg > oldAvg && priceChange < 0) {
    description = 'Bullish divergence';
  } else if (recentAvg < oldAvg && priceChange > 0) {
    description = 'Bearish divergence';
  }

  return {
    name: 'OBV Trend',
    signal,
    description
  };
}