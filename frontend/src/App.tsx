import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import './App.css';
import { InteractiveCandlestickChart } from './components/InteractiveCandlestickChart';
import { TradingIndicators } from './components/TradingIndicators';
import { ApiService } from './services/api';
import { MARKET_CONFIG } from './services/binanceService';
import { CandlestickData } from './types/market';

declare global {
  interface Window {
    lastCandlestickUpdate?: number;
  }
}

const SUPPORTED_TOKENS = ['BTC', 'ETH', 'SOL', 'ADA'];

const CryptoDashboard: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1D');
  const [selectedToken, setSelectedToken] = useState<string>('BTC');

  // Update ref whenever selection changes
  useEffect(() => {
    currentSelectionRef.current = { token: selectedToken, period: selectedPeriod };
  }, [selectedToken, selectedPeriod]);
  const [candlestickData, setCandlestickData] = useState<{ [key: string]: CandlestickData[] }>({});
  const [currentPrices, setCurrentPrices] = useState<{ [token: string]: number }>({});
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [priceChanges24h, setPriceChanges24h] = useState<{ [token: string]: number }>({});
  const [viewMode, setViewMode] = useState<'line' | 'candlestick'>('line');
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const apiServiceRef = useRef<ApiService | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectionRef = useRef({ token: selectedToken, period: selectedPeriod });

  useEffect(() => {
    const initializeServices = async () => {
      try {
        apiServiceRef.current = new ApiService();
        
        const isHealthy = await apiServiceRef.current.checkHealth();
        if (!isHealthy) {
          console.error('API is not responding');
          setConnectionStatus('error');
          return;
        }
        
        setConnectionStatus('connected');
        setIsInitialLoading(false);
      } catch (error) {
        console.error('❌ Initialization error:', error);
        setConnectionStatus('error');
      }
    };

    initializeServices();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const getTimeframeForPeriod = (period: string): string => {
    switch (period) {
      case '1D':
        return '5m';
      case '1W':
        return '5m';
      case '1M':
        return '5m';
      default:
        return '1d';
    }
  };

  const fetchPricesOnly = useCallback(async () => {
    if (!apiServiceRef.current) return;

    try {
      const prices = await apiServiceRef.current.fetchCurrentPrices();
      const priceData: { [token: string]: number } = {};
      const changeData: { [token: string]: number } = {};
      
      Object.entries(prices).forEach(([token, data]) => {
        priceData[token] = data.price;
        changeData[token] = data.change24h;
      });
      
      setCurrentPrices(priceData);
      setPriceChanges24h(changeData);
    } catch (error) {
      console.error('❌ Error fetching prices:', error);
    }
  }, []);

  const fetchCandlestickData = useCallback(async (tokenToLoad?: string, periodToLoad?: string) => {
    if (!apiServiceRef.current) return;

    const token = tokenToLoad || selectedToken;
    const period = periodToLoad || selectedPeriod;
    const timeframe = getTimeframeForPeriod(period);
    
    try {
      let limit = 288;
      
      if (period === '1D') {
        limit = 288; // 24 hours * 12 (5min intervals per hour)
      } else if (period === '1W') {
        limit = 2016; // 7 days * 24 hours * 12 (5min intervals per hour)
      } else if (period === '1M') {
        limit = 8640; // 30 days * 24 hours * 12 (5min intervals per hour)
      } else if (timeframe === '1d') {
        if (period === '3M') {
          limit = 90;
        } else if (period === 'YTD') {
          const now = new Date();
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          const daysSinceYearStart = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
          limit = Math.max(1, daysSinceYearStart);
        } else if (period === '1Y') {
          limit = 365;
        } else {
          limit = 180;
        }
      }
      
      const candles = await apiServiceRef.current.fetchCandlesticks(token, timeframe, limit);
      const key = `${token}_${timeframe}`;
      
      console.log(`📊 Fetched ${candles.length} ${timeframe} candles for ${token} ${period} (requested: ${limit})`);
      if (candles.length > 0) {
        const firstCandle = new Date(candles[0].openTime);
        const lastCandle = new Date(candles[candles.length - 1].openTime);
        const daysDiff = Math.round((lastCandle.getTime() - firstCandle.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`📅 Data range: ${firstCandle.toLocaleDateString()} to ${lastCandle.toLocaleDateString()} (${daysDiff} days)`);
        
        // Expected vs actual data analysis
        let expectedDays = 0;
        if (period === '1D') expectedDays = 1;
        else if (period === '1W') expectedDays = 7;
        else if (period === '1M') expectedDays = 30;
        else if (period === '3M') expectedDays = 90;
        else if (period === '1Y') expectedDays = 365;
        
        if (expectedDays > 0) {
          const coverage = Math.round((daysDiff / expectedDays) * 100);
          console.log(`📈 Data coverage: ${coverage}% (${daysDiff}/${expectedDays} days)`);
          if (coverage < 80) {
            console.warn(`⚠️  Low data coverage for ${period}! Expected ${expectedDays} days, got ${daysDiff} days`);
          }
        }
      }
      
      setCandlestickData(prev => ({
        ...prev,
        [key]: candles
      }));
    } catch (tokenError) {
      console.error(`Error loading candlestick data for ${token}:`, tokenError);
    }
  }, [selectedToken, selectedPeriod]);

  const loadDataFromAPI = useCallback(async (tokenToLoad?: string, periodToLoad?: string) => {
    await Promise.all([
      fetchPricesOnly(),
      fetchCandlestickData(tokenToLoad, periodToLoad)
    ]);
  }, [fetchPricesOnly, fetchCandlestickData]);

  const startDataPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      if (!apiServiceRef.current) return;
      
      try {
        // Update prices for all tokens (every 5 seconds)
        await fetchPricesOnly();
        
        // Update candlestick data for current selection
        const { token, period } = currentSelectionRef.current;
        if (token && period) {
          await fetchCandlestickData(token, period);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
  }, [fetchPricesOnly, fetchCandlestickData]);

  useEffect(() => {
    if (apiServiceRef.current && !isInitialLoading) {
      loadDataFromAPI();
      startDataPolling();
    }
  }, [isInitialLoading, loadDataFromAPI, startDataPolling]);

  const formatPrice = (price: number, token: string): string => {
    if (!price) return '$0.00';
    if (token === 'ADA') return `$${price.toFixed(4)}`;
    if (token === 'SOL') return `$${price.toFixed(2)}`;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const formatChange = (change: number): string => {
    if (!change && change !== 0) return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  const getChangeColor = (change: number): string => {
    if (change > 0) return '#10b981';
    if (change < 0) return '#ef4444';
    return '#6b7280';
  };

  const getStatusColor = (status: typeof connectionStatus): string => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-price">
            <span style={{ color: payload[0].color }}>
              {`Price: ${formatPrice(payload[0].value, selectedToken)}`}
            </span>
          </p>
          {data.change !== undefined && (
            <p className="tooltip-change" style={{ color: getChangeColor(data.change) }}>
              {`Change: ${formatChange(data.change)}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const handlePeriodChange = useCallback(async (period: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setSelectedPeriod(period);
    
    const newTimeframe = getTimeframeForPeriod(period);
    const key = `${selectedToken}_${newTimeframe}`;
    setCandlestickData(prev => ({
      ...prev,
      [key]: []
    }));
    
    await fetchCandlestickData(selectedToken, period);
    
    startDataPolling();
  }, [selectedToken, fetchCandlestickData, startDataPolling]);

  const aggregateCandles = (candles: CandlestickData[], intervalMinutes: number): CandlestickData[] => {
    if (candles.length === 0) return [];
    
    const aggregated: CandlestickData[] = [];
    const candlesPerInterval = intervalMinutes / 5;
    
    for (let i = 0; i < candles.length; i += candlesPerInterval) {
      const group = candles.slice(i, i + candlesPerInterval);
      if (group.length === 0) continue;
      
      const aggregatedCandle: CandlestickData = {
        openTime: group[0].openTime,
        open: group[0].open,
        high: Math.max(...group.map(c => c.high)),
        low: Math.min(...group.map(c => c.low)),
        close: group[group.length - 1].close,
        volume: group.reduce((sum, c) => sum + c.volume, 0),
        closeTime: group[group.length - 1].closeTime,
        quoteVolume: group.reduce((sum, c) => sum + c.quoteVolume, 0),
        trades: group.reduce((sum, c) => sum + c.trades, 0),
        takerBuyBaseVolume: group.reduce((sum, c) => sum + c.takerBuyBaseVolume, 0),
        takerBuyQuoteVolume: group.reduce((sum, c) => sum + c.takerBuyQuoteVolume, 0)
      };
      
      aggregated.push(aggregatedCandle);
    }
    
    return aggregated;
  };

  const currentTimeframe = getTimeframeForPeriod(selectedPeriod);
  const currentCandlestickKey = `${selectedToken}_${currentTimeframe}`;
  let currentCandlestickData = candlestickData[currentCandlestickKey] || [];
  
  if (selectedPeriod === '1W' && currentTimeframe === '5m') {
    const originalLength = currentCandlestickData.length;
    currentCandlestickData = aggregateCandles(currentCandlestickData, 10);
    console.log(`🔄 1W aggregation: ${originalLength} 5m candles → ${currentCandlestickData.length} 10m candles`);
  } else if (selectedPeriod === '1M' && currentTimeframe === '5m') {
    const originalLength = currentCandlestickData.length;
    currentCandlestickData = aggregateCandles(currentCandlestickData, 120);
    console.log(`🔄 1M aggregation: ${originalLength} 5m candles → ${currentCandlestickData.length} 2h candles`);
  }
  
  
  const lineChartData = currentCandlestickData.map((candle) => {
    const date = new Date(candle.openTime);
    let timeKey: string;
    
    if (selectedPeriod === '1D') {
      timeKey = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } else if (selectedPeriod === '1W') {
      timeKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + 
                date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    } else if (selectedPeriod === '1M') {
      timeKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit' }) + ':00';
    } else {
      timeKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    const isGreen = candle.close >= candle.open;
    
    return {
      time: timeKey,
      timestamp: candle.openTime,
      price: candle.close,
      volume: candle.volume,
      volumeColor: isGreen ? '#10b981' : '#ef4444',
      change: 0
    };
  });

  const currentPrice = currentPrices[selectedToken];
  const change24h = priceChanges24h[selectedToken] || 0;
  
  // Calculate price change for the current timeframe
  const timeframeChange = useMemo(() => {
    if (currentCandlestickData.length < 2) return 0;
    const firstPrice = currentCandlestickData[0].open;
    const lastPrice = currentCandlestickData[currentCandlestickData.length - 1].close;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [currentCandlestickData]);

  return (
    <div className="dashboard">
      {isInitialLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', color: '#666666', marginBottom: '16px' }}>Loading Market Data</div>
            <div style={{ fontSize: '0.875rem', color: '#444444' }}>Fetching latest prices from Binance...</div>
          </div>
        </div>
      )}
      <header className="dashboard-header">
        <h1>Crypto Trading Dashboard</h1>
        <div className="header-info">
          <div className="status-indicator">
            <span 
              className="status-dot" 
              style={{ backgroundColor: getStatusColor(connectionStatus) }}
            ></span>
            <span>{connectionStatus}</span>
          </div>
        </div>
      </header>



      <div className="content-grid">
        <div className="price-display">
          <div className="main-price-card">
            <div className="price-header">
              <div className="token-details">
                <h2>{selectedToken}/USDT</h2>
                <span className="token-name">
                  {MARKET_CONFIG[selectedToken as keyof typeof MARKET_CONFIG].name}
                </span>
              </div>
              <span className="price-badge">
                {currentPrice ? formatPrice(currentPrice, selectedToken) : 'Waiting for data...'}
              </span>
            </div>
            <div className="price-metrics">
              <div className="metric-row">
                <div className="metric-item">
                  <span className="metric-label">24h Change:</span>
                  <span className="metric-value" style={{ color: getChangeColor(change24h) }}>
                    {formatChange(change24h)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="tokens-overview">
            <h3>All Tokens</h3>
            <div className="token-list">
              {SUPPORTED_TOKENS.map(token => {
                const isSelected = token === selectedToken;
                const tokenPrice = currentPrices[token];
                const token24hChange = priceChanges24h[token] || 0;
                
                return (
                  <div 
                    key={token} 
                    className={`token-item ${isSelected ? 'selected' : ''}`}
                    onClick={async () => {
                      setSelectedToken(token);
                      const timeframe = getTimeframeForPeriod(selectedPeriod);
                      const key = `${token}_${timeframe}`;
                      if (!candlestickData[key]) {
                        await loadDataFromAPI(token, selectedPeriod);
                      }
                    }}
                  >
                    <div className="token-symbol">{token}</div>
                    <div className="token-price">
                      {tokenPrice ? formatPrice(tokenPrice, token) : 'Loading...'}
                    </div>
                    <div className="token-change" style={{ color: getChangeColor(token24hChange) }}>
                      {formatChange(token24hChange)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>

        <div className="chart-section">
          {currentCandlestickData.length > 0 ? (
            <div className="chart-container">
              <div className="chart-header">
                <h3>{selectedToken}/USDT {viewMode === 'candlestick' ? 'Candlestick' : 'Price'} Chart</h3>
              </div>
              
              <div style={{ marginBottom: '32px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  <button onClick={() => handlePeriodChange('1D')} style={{...periodButtonStyle, ...(selectedPeriod === '1D' ? activeButtonStyle : {})}}>1D</button>
                  <button onClick={() => handlePeriodChange('1W')} style={{...periodButtonStyle, ...(selectedPeriod === '1W' ? activeButtonStyle : {})}}>1W</button>
                  <button onClick={() => handlePeriodChange('1M')} style={{...periodButtonStyle, ...(selectedPeriod === '1M' ? activeButtonStyle : {})}}>1M</button>
                  <button onClick={() => handlePeriodChange('3M')} style={{...periodButtonStyle, ...(selectedPeriod === '3M' ? activeButtonStyle : {})}}>3M</button>
                  <button onClick={() => handlePeriodChange('YTD')} style={{...periodButtonStyle, ...(selectedPeriod === 'YTD' ? activeButtonStyle : {})}}>YTD</button>
                  <button onClick={() => handlePeriodChange('1Y')} style={{...periodButtonStyle, ...(selectedPeriod === '1Y' ? activeButtonStyle : {})}}>1Y</button>
                </div>
                
                <div style={{ display: 'flex', background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  <button 
                    onClick={() => setViewMode('line')} 
                    style={{...periodButtonStyle, ...(viewMode === 'line' ? activeButtonStyle : {})}}
                  >
                    Line
                  </button>
                  <button 
                    onClick={() => setViewMode('candlestick')} 
                    style={{...periodButtonStyle, ...(viewMode === 'candlestick' ? activeButtonStyle : {})}}
                  >
                    Candlestick
                  </button>
                </div>
              </div>
              
              {viewMode === 'candlestick' ? (
                <InteractiveCandlestickChart
                  data={currentCandlestickData}
                  token={selectedToken}
                  showVolume={true}
                  height={400}
                  onPeriodChange={handlePeriodChange}
                  period={selectedPeriod}
                />
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart 
                      data={lineChartData} 
                      margin={{ top: 5, right: 30, left: 20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorGradientGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorGradientRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff3366" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ff3366" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#333333"
                        fontSize={0}
                        tick={false}
                      />
                      <YAxis 
                        stroke="#333333"
                        fontSize={12}
                        tickFormatter={(value) => formatPrice(value, selectedToken)}
                        domain={[
                          (dataMin: number) => {
                            if (!dataMin || !isFinite(dataMin) || dataMin === 0) return 0;
                            const padding = Math.abs(dataMin) * 0.01;
                            return dataMin - padding;
                          },
                          (dataMax: number) => {
                            if (!dataMax || !isFinite(dataMax) || dataMax === 0) return 100;
                            const padding = Math.abs(dataMax) * 0.01;
                            return dataMax + padding;
                          }
                        ]}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke={timeframeChange >= 0 ? "#00ff88" : "#ff3366"}
                        strokeWidth={2}
                        fill={timeframeChange >= 0 ? "url(#colorGradientGreen)" : "url(#colorGradientRed)"}
                        activeDot={{ r: 4, fill: timeframeChange >= 0 ? "#00ff88" : "#ff3366", stroke: "#000000", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  
                  <div style={{ marginTop: '-10px' }}>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart 
                        data={lineChartData} 
                        margin={{ top: 0, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a" strokeOpacity={0.5} />
                        <XAxis 
                          dataKey="time" 
                          stroke="#333333"
                          fontSize={12}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          stroke="#333333"
                          fontSize={12}
                          tickFormatter={(value) => formatVolume(value)}
                        />
                        <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="volume" opacity={0.6} fill="transparent">
                          {lineChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.volumeColor || '#666666'} stroke="none" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="chart-container" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 350
            }}>
              <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{
                  width: '40px',
                  height: '40px',
                  border: '2px solid #1a1a1a',
                  borderTopColor: '#666666',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}></div>
                <div style={{ fontSize: '0.875rem', color: '#666666' }}>Loading chart data...</div>
              </div>
            </div>
          )}
          
          {currentCandlestickData.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <TradingIndicators 
                data={currentCandlestickData} 
                currentPrice={currentPrice || 0}
                period={selectedPeriod}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

const periodButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: 'transparent',
  border: 'none',
  borderRight: '1px solid #1a1a1a',
  color: '#666666',
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: '300',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative'
};

const activeButtonStyle: React.CSSProperties = {
  color: '#ffffff',
  backgroundColor: 'rgba(255, 255, 255, 0.05)'
};

const formatVolume = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
};

const VolumeTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: '#000000',
        border: '1px solid #1a1a1a',
        borderRadius: '0',
        padding: '12px',
        color: 'white',
        fontSize: '0.75rem'
      }}>
        <p style={{ marginBottom: '8px', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
        <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>Volume</span> <span>{formatVolume(data.volume)}</span></p>
      </div>
    );
  }
  return null;
};

export default CryptoDashboard;