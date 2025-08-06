import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CandlestickData } from '../types/market';

interface CandlestickChartProps {
  data: CandlestickData[];
  token: string;
  showVolume?: boolean;
  height?: number;
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
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  token,
  showVolume = true,
  height = 400
}) => {
  const chartData = useMemo(() => {
    return data.map((candle): ChartDataPoint => {
      const isGreen = candle.close >= candle.open;
      const date = new Date(candle.openTime);
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      return {
        time: timeStr,
        timestamp: candle.openTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        candlestick: [candle.low, candle.open, candle.close, candle.high],
        color: isGreen ? '#10b981' : '#ef4444'
      };
    });
  }, [data]);

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '12px',
          color: 'white',
          fontSize: '0.875rem'
        }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p>Open: <span style={{ color: '#3b82f6' }}>{formatPrice(data.open)}</span></p>
            <p>High: <span style={{ color: '#10b981' }}>{formatPrice(data.high)}</span></p>
            <p>Low: <span style={{ color: '#ef4444' }}>{formatPrice(data.low)}</span></p>
            <p>Close: <span style={{ color: data.color }}>{formatPrice(data.close)}</span></p>
            {showVolume && (
              <p>Volume: <span style={{ color: '#8b5cf6' }}>{formatVolume(data.volume)}</span></p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CandlestickBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const [low, open, close, high] = payload.candlestick;
    const isGreen = close >= open;
    const color = isGreen ? '#10b981' : '#ef4444';
    
    // Calculate positions
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
        {/* High-Low line (wick) */}
        <line
          x1={wickX}
          y1={yHigh}
          x2={wickX}
          y2={yLow}
          stroke={color}
          strokeWidth={1}
        />
        {/* Open-Close rectangle (body) */}
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

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const prices = chartData.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [chartData]);

  const volumeYDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const volumes = chartData.map(d => d.volume);
    const max = Math.max(...volumes);
    return [0, max * 1.2];
  }, [chartData]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="time"
          stroke="#9ca3af"
          fontSize={12}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="price"
          domain={yDomain}
          stroke="#9ca3af"
          fontSize={12}
          tickFormatter={formatPrice}
        />
        {showVolume && (
          <YAxis
            yAxisId="volume"
            orientation="right"
            domain={volumeYDomain}
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={formatVolume}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        
        {/* Volume bars */}
        {showVolume && (
          <Bar yAxisId="volume" dataKey="volume" opacity={0.3}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        )}
        
        {/* Candlesticks */}
        <Bar
          yAxisId="price"
          dataKey="candlestick"
          shape={CandlestickBar}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};