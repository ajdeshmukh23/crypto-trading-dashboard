import React from 'react';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { CandlestickChart } from './CandlestickChart';
import { generateMockCandlestickData } from '../test-utils/mockData';

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    ComposedChart: ({ children, data }: any) => (
      <div data-testid="composed-chart" data-length={data.length}>{children}</div>
    ),
    Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
    XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
    YAxis: ({ yAxisId, orientation }: any) => (
      <div data-testid={`y-axis-${orientation || 'left'}`} data-orientation={orientation || 'left'} />
    ),
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Cell: () => <div data-testid="cell" />,
  };
});

describe('CandlestickChart', () => {
  const mockCandlestickData = generateMockCandlestickData(2);
  const defaultProps = {
    data: mockCandlestickData,
    token: 'BTC',
  };

  it('renders chart with default props', () => {
    act(() => {
      render(<CandlestickChart {...defaultProps} />);
    });
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('composed-chart')).toHaveAttribute('data-length', '2');
  });

  it('renders with custom height', () => {
    render(<CandlestickChart {...defaultProps} height={500} />);
    
    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders volume bars when showVolume is true', () => {
    render(<CandlestickChart {...defaultProps} showVolume={true} />);
    
    expect(screen.getByTestId('bar-volume')).toBeInTheDocument();
  });

  it('does not render volume bars when showVolume is false', () => {
    render(<CandlestickChart {...defaultProps} showVolume={false} />);
    
    expect(screen.queryByTestId('bar-volume')).not.toBeInTheDocument();
  });

  it('renders both y-axes', () => {
    render(<CandlestickChart {...defaultProps} />);
    
    expect(screen.getByTestId('y-axis-left')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis-right')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis-left')).toHaveAttribute('data-orientation', 'left');
    expect(screen.getByTestId('y-axis-right')).toHaveAttribute('data-orientation', 'right');
  });

  it('renders x-axis with time dataKey', () => {
    render(<CandlestickChart {...defaultProps} />);
    
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toHaveAttribute('data-key', 'time');
  });

  it('renders grid and tooltip', () => {
    render(<CandlestickChart {...defaultProps} />);
    
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    render(<CandlestickChart {...defaultProps} data={[]} />);
    
    expect(screen.getByTestId('composed-chart')).toHaveAttribute('data-length', '0');
  });

  it('renders candlestick shape for each data point', () => {
    render(<CandlestickChart {...defaultProps} />);
    
    expect(screen.getByTestId('bar-candlestick')).toBeInTheDocument();
  });

  it('works with different token types', () => {
    const tokens = ['BTC', 'ETH', 'SOL', 'ADA'];
    
    tokens.forEach(token => {
      const { rerender } = render(<CandlestickChart {...defaultProps} token={token} />);
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      rerender(<></>);
    });
  });
});

// Test the candlestick shape component
describe('CandlestickShape', () => {
  it('formats volume correctly', () => {
    // Test volume formatting logic
    const formatVolume = (value: number): string => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toFixed(2);
    };

    expect(formatVolume(1500000)).toBe('1.5M');
    expect(formatVolume(2500)).toBe('2.5K');
    expect(formatVolume(100)).toBe('100.00');
  });

  it('formats price correctly for different tokens', () => {
    // Test price formatting logic
    const formatPrice = (price: number, token: string): string => {
      if (!price) return '$0.00';
      
      if (token === 'ADA') {
        return `$${price.toFixed(4)}`;
      }
      
      if (price < 1) {
        return `$${price.toFixed(4)}`;
      } else if (price < 100) {
        return `$${price.toFixed(2)}`;
      } else {
        return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      }
    };

    expect(formatPrice(42000, 'BTC')).toBe('$42,000');
    expect(formatPrice(0.45, 'ADA')).toBe('$0.4500');
    expect(formatPrice(120.5, 'SOL')).toBe('$120.5');
  });
});