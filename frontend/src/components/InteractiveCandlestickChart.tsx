import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart
} from 'recharts';
import { CandlestickData } from '../types/market';

interface InteractiveCandlestickChartProps {
  data: CandlestickData[];
  token: string;
  showVolume?: boolean;
  height?: number;
  onPeriodChange?: (period: string) => void;
  period?: string;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  candlestick: [number, number, number, number]; // [low, open, close, high]
  color: string;
  index: number;
}

interface ZoomState {
  startIndex: number;
  endIndex: number;
  refAreaLeft: string | null;
  refAreaRight: string | null;
}

export const InteractiveCandlestickChart: React.FC<InteractiveCandlestickChartProps> = ({
  data,
  token,
  showVolume = true,
  height = 500,
  onPeriodChange,
  period = '1D'
}) => {
  const [zoomState, setZoomState] = useState<ZoomState>({
    startIndex: 0,
    endIndex: Math.max(0, data.length - 1),
    refAreaLeft: null,
    refAreaRight: null
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(period);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, index: 0 });
  const chartRef = useRef<HTMLDivElement>(null);

  const priceChartHeight = showVolume ? height * 0.7 : height;
  const volumeChartHeight = height * 0.25;
  const chartGap = height * 0.05;

  useEffect(() => {
    if (data.length > 0) {
      setZoomState({
        startIndex: 0,
        endIndex: data.length - 1,
        refAreaLeft: null,
        refAreaRight: null
      });
    } else {
      setZoomState({
        startIndex: 0,
        endIndex: 0,
        refAreaLeft: null,
        refAreaRight: null
      });
    }
  }, [data.length, period]);

  const chartData = useMemo(() => {
    return data.map((candle, index): ChartDataPoint => {
      const isGreen = candle.close >= candle.open;
      const date = new Date(candle.openTime);
      let timeStr: string;
      
      if (period === '1D') {
        timeStr = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      } else if (period === '1W') {
        timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + 
                  date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      } else if (period === '1M') {
        timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                  date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit' }) + ':00';
      } else {
        timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return {
        time: timeStr,
        timestamp: candle.openTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        candlestick: [candle.low, candle.open, candle.close, candle.high],
        color: isGreen ? '#10b981' : '#ef4444',
        index
      };
    });
  }, [data]);

  const visibleData = useMemo(() => {
    return chartData.slice(zoomState.startIndex, zoomState.endIndex + 1);
  }, [chartData, zoomState.startIndex, zoomState.endIndex]);

  const yDomain = useMemo(() => {
    if (visibleData.length === 0) return [0, 100];
    const prices = visibleData.flatMap(d => [d.high, d.low]);
    if (prices.length === 0) return [0, 100];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) {
      return [min * 0.9, max * 1.1];
    }
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [visibleData]);

  const volumeYDomain = useMemo(() => {
    if (visibleData.length === 0) return [0, 100];
    const volumes = visibleData.map(d => d.volume);
    if (volumes.length === 0) return [0, 100];
    const max = Math.max(...volumes);
    return [0, max * 1.2 || 100];
  }, [visibleData]);

  const formatPrice = (value: number): string => {
    if (token === 'ADA') return `$${value.toFixed(4)}`;
    if (token === 'SOL') return `$${value.toFixed(2)}`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const formatVolume = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const handlePeriodChange = useCallback((period: string) => {
    setSelectedPeriod(period);
    if (onPeriodChange) {
      onPeriodChange(period);
    }
  }, [onPeriodChange]);

  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastWheelTime = useRef<number>(0);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastWheelTime.current < 100) return;
    lastWheelTime.current = now;
    
    const delta = e.deltaY;
    const range = zoomState.endIndex - zoomState.startIndex;
    
    const panAmount = Math.max(1, Math.floor(range * 0.01));
    
    if (wheelTimeoutRef.current) {
      clearTimeout(wheelTimeoutRef.current);
    }
    
    if (delta > 0) {
      const newEnd = Math.min(chartData.length - 1, zoomState.endIndex + panAmount);
      const newStart = Math.max(0, newEnd - range);
      setIsTransitioning(true);
      setZoomState(prev => ({
        ...prev,
        startIndex: newStart,
        endIndex: newEnd
      }));
      wheelTimeoutRef.current = setTimeout(() => setIsTransitioning(false), 500);
    } else {
      const newStart = Math.max(0, zoomState.startIndex - panAmount);
      const newEnd = Math.min(chartData.length - 1, newStart + range);
      setIsTransitioning(true);
      setZoomState(prev => ({
        ...prev,
        startIndex: newStart,
        endIndex: newEnd
      }));
      wheelTimeoutRef.current = setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [zoomState, chartData.length]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setZoomState(prev => {
          const range = prev.endIndex - prev.startIndex;
          const newStart = Math.max(0, prev.startIndex - Math.floor(range * 0.1));
          const newEnd = newStart + range;
          return { ...prev, startIndex: newStart, endIndex: newEnd };
        });
      } else if (e.key === 'ArrowRight') {
        setZoomState(prev => {
          const range = prev.endIndex - prev.startIndex;
          const newEnd = Math.min(chartData.length - 1, prev.endIndex + Math.floor(range * 0.1));
          const newStart = newEnd - range;
          return { ...prev, startIndex: newStart, endIndex: newEnd };
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [chartData.length]);

  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 0 && !zoomState.refAreaLeft) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, index: zoomState.startIndex });
    }
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (isDragging && chartRef.current) {
      const rect = chartRef.current.getBoundingClientRect();
      const chartWidth = rect.width - 80;
      const candlesVisible = zoomState.endIndex - zoomState.startIndex + 1;
      const pixelsPerCandle = chartWidth / candlesVisible;
      
      const deltaX = e.clientX - dragStart.x;
      const candlesDelta = Math.round((deltaX / pixelsPerCandle) * 0.3);
      
      const newStart = Math.max(0, dragStart.index - candlesDelta);
      const newEnd = Math.min(chartData.length - 1, newStart + candlesVisible - 1);
      
      if (newEnd - newStart >= 10) {
        setZoomState(prev => ({
          ...prev,
          startIndex: newStart,
          endIndex: newEnd
        }));
      }
    }
  };

  const handlePanEnd = () => {
    setIsDragging(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: '#000000',
          border: '1px solid #1a1a1a',
          borderRadius: '0',
          padding: '16px',
          color: 'white',
          fontSize: '0.75rem'
        }}>
          <p style={{ fontWeight: 400, marginBottom: '12px', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>Open</span> <span>{formatPrice(data.open)}</span></p>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>High</span> <span>{formatPrice(data.high)}</span></p>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>Low</span> <span>{formatPrice(data.low)}</span></p>
            <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>Close</span> <span style={{ color: data.color }}>{formatPrice(data.close)}</span></p>
            {showVolume && (
              <p style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666666' }}>Volume</span> <span>{formatVolume(data.volume)}</span></p>
            )}
          </div>
        </div>
      );
    }
    return null;
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

  const CandlestickBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const [low, open, close, high] = payload.candlestick;
    const isGreen = close >= open;
    const color = isGreen ? '#00ff88' : '#ff3366';
    
    const yHigh = y;
    const yLow = y + height;
    const yOpen = y + height * (1 - (open - low) / (high - low));
    const yClose = y + height * (1 - (close - low) / (high - low));
    
    const candleTop = Math.min(yOpen, yClose);
    const candleHeight = Math.abs(yOpen - yClose) || 1;
    const candleWidth = width * 0.8;
    const candleX = x + width * 0.1;
    const wickX = x + width / 2;

    return (
      <g>
        <line
          x1={wickX}
          y1={yHigh}
          x2={wickX}
          y2={yLow}
          stroke={color}
          strokeWidth={1}
        />
        <rect
          x={candleX}
          y={candleTop}
          width={candleWidth}
          height={candleHeight}
          fill={isGreen ? color : 'none'}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    );
  };

  if (data.length === 0) {
    return (
      <div style={{ 
        height: height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#666666',
        fontSize: '0.875rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div>Loading chart data...</div>
          <div style={{ fontSize: '0.75rem', marginTop: '8px', color: '#444444' }}>
            Fetching candlestick data from Binance
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.75rem', color: '#444444' }}>
          {visibleData.length} candles • Scroll to pan
        </span>
      </div>
      
      <div 
        ref={chartRef}
        onWheel={handleWheel}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isTransitioning ? 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
        }}
      >
        <ResponsiveContainer width="100%" height={priceChartHeight}>
          <ComposedChart 
            data={visibleData} 
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a" strokeOpacity={0.5} />
            <XAxis
              dataKey="time"
              stroke="#333333"
              fontSize={12}
              interval="preserveStartEnd"
              tick={{ fontSize: showVolume ? 0 : 12 }}
            />
            <YAxis
              yAxisId="price"
              domain={yDomain}
              stroke="#333333"
              fontSize={12}
              tickFormatter={formatPrice}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Bar
              yAxisId="price"
              dataKey="candlestick"
              shape={CandlestickBar}
              isAnimationActive={false}
            />

          </ComposedChart>
        </ResponsiveContainer>

        {showVolume && (
          <div style={{ marginTop: `-${chartGap}px` }}>
            <ResponsiveContainer width="100%" height={volumeChartHeight}>
              <BarChart 
                data={visibleData} 
                margin={{ top: 0, right: 30, left: 20, bottom: 20 }}
                syncId="crypto"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a" strokeOpacity={0.5} />
                <XAxis
                  dataKey="time"
                  stroke="#333333"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={volumeYDomain}
                  stroke="#333333"
                  fontSize={12}
                  tickFormatter={formatVolume}
                />
                <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'transparent' }} />
                
                <Bar dataKey="volume" opacity={0.6} fill="transparent">
                  {visibleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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