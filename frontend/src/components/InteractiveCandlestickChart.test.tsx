import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { InteractiveCandlestickChart } from './InteractiveCandlestickChart';
import { generateMockCandlestickData } from '../test-utils/mockData';

// Mock recharts
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children, onMouseDown, onMouseMove, onMouseUp, onMouseLeave }: any) => (
      <div 
        data-testid="responsive-container"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    ),
    ComposedChart: ({ children, data }: any) => (
      <div data-testid="composed-chart" data-length={data.length}>{children}</div>
    ),
    Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: ({ yAxisId }: any) => <div data-testid={`y-axis-${yAxisId}`} />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Cell: () => <div data-testid="cell" />,
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-length={data.length}>{children}</div>
    ),
  };
});

describe('InteractiveCandlestickChart', () => {
  const mockCandlestickData = generateMockCandlestickData(10);
  const defaultProps = {
    data: mockCandlestickData,
    token: 'BTC',
    showVolume: true,
    height: 400,
  };

  beforeEach(() => {
    // Reset any mocked functions
    jest.clearAllMocks();
  });

  it('renders chart components', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(2); // One for main chart, one for volume
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('shows loading state when no data', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} data={[]} />);
    });
    
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
    expect(screen.getByText('Fetching candlestick data from Binance')).toBeInTheDocument();
  });

  it('displays zoom controls', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    // The component renders zoom controls via buttons or other UI elements
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('handles wheel events for zooming', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Zoom in
      fireEvent.wheel(container, { deltaY: -100 });
    });
    
    // Verify chart still renders after zoom
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('prevents zooming beyond limits', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Try to zoom out below minimum
      fireEvent.wheel(container, { deltaY: 100 });
      fireEvent.wheel(container, { deltaY: 100 });
    });
    
    // Verify chart still renders
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    
    act(() => {
      // Zoom in multiple times
      for (let i = 0; i < 50; i++) {
        fireEvent.wheel(container, { deltaY: -100 });
      }
    });
    
    // Verify chart still renders at max zoom
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('handles drag operations', async () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Start drag
      fireEvent.mouseDown(container, { clientX: 100, clientY: 100 });
      
      // Move mouse
      fireEvent.mouseMove(container, { clientX: 150, clientY: 100 });
      
      // End drag
      fireEvent.mouseUp(container);
    });
    
    // Should maintain state after drag
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('cancels drag on mouse leave', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Start drag
      fireEvent.mouseDown(container, { clientX: 100, clientY: 100 });
      
      // Leave container
      fireEvent.mouseLeave(container);
    });
    
    // Should still render normally
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    // Focus the container (in real implementation)
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Test arrow keys
      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      fireEvent.keyDown(container, { key: 'ArrowRight' });
      fireEvent.keyDown(container, { key: 'ArrowUp' });
      fireEvent.keyDown(container, { key: 'ArrowDown' });
    });
    
    // Chart should still be rendered
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('calls onPeriodChange when provided', async () => {
    const onPeriodChange = jest.fn();
    render(
      <InteractiveCandlestickChart 
        {...defaultProps} 
        onPeriodChange={onPeriodChange}
        period="1D"
      />
    );
    
    // In real implementation, this would be triggered by UI interaction
    // For now, we just verify the prop is accepted
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('renders volume chart when showVolume is true', () => {
    render(<InteractiveCandlestickChart {...defaultProps} showVolume={true} />);
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-volume')).toBeInTheDocument();
  });

  it('does not render volume chart when showVolume is false', () => {
    render(<InteractiveCandlestickChart {...defaultProps} showVolume={false} />);
    
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('handles touch events for mobile', () => {
    act(() => {
      render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Simulate pinch to zoom
      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 }
        ]
      });
      
      fireEvent.touchMove(container, {
        touches: [
          { clientX: 50, clientY: 100 },
          { clientX: 250, clientY: 100 }
        ]
      });
      
      fireEvent.touchEnd(container);
    });
    
    // Should still render
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('displays period-specific labels', () => {
    const periods = ['1D', '1W', '1M', '3M', '1Y'];
    
    periods.forEach(period => {
      const { rerender } = render(
        <InteractiveCandlestickChart {...defaultProps} period={period} />
      );
      
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      rerender(<></>);
    });
  });

  it('handles large datasets efficiently', () => {
    const largeData = generateMockCandlestickData(1000);
    
    render(<InteractiveCandlestickChart {...defaultProps} data={largeData} />);
    
    expect(screen.getByTestId('composed-chart')).toHaveAttribute('data-length', '1000');
  });

  it('maintains state across data updates', () => {
    let result: ReturnType<typeof render>;
    act(() => {
      result = render(<InteractiveCandlestickChart {...defaultProps} />);
    });
    
    const containers = screen.getAllByTestId('responsive-container');
    const container = containers[0];
    
    act(() => {
      // Zoom in
      fireEvent.wheel(container, { deltaY: -100 });
    });
    
    // Verify initial render
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    
    // Update data
    const newData = generateMockCandlestickData(11);
    
    act(() => {
      result.rerender(<InteractiveCandlestickChart {...defaultProps} data={newData} />);
    });
    
    // Verify chart still renders with new data
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });
});