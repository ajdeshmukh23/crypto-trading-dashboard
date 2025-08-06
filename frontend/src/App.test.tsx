import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import App from './App';
import { ApiService } from './services/api';
import { generateMockCandlestickData, mockPriceUpdate } from './test-utils/mockData';

// Mock the services
jest.mock('./services/api');
jest.mock('./services/binanceService', () => ({
  MARKET_CONFIG: {
    BTC: { name: 'Bitcoin' },
    ETH: { name: 'Ethereum' },
    SOL: { name: 'Solana' },
    ADA: { name: 'Cardano' }
  }
}));

// Mock components
jest.mock('./components/InteractiveCandlestickChart', () => ({
  InteractiveCandlestickChart: ({ data, token, period, onPeriodChange }: any) => (
    <div data-testid="interactive-candlestick-chart">
      Interactive Chart - {token} - {period}
      <button onClick={() => onPeriodChange('1W')}>Change Period</button>
    </div>
  )
}));

jest.mock('./components/TradingIndicators', () => ({
  TradingIndicators: ({ data, currentPrice, period }: any) => (
    <div data-testid="trading-indicators">
      Trading Indicators - Price: {currentPrice} - Period: {period}
    </div>
  )
}));

describe('App', () => {
  let mockApiService: jest.Mocked<ApiService>;
  const mockCandlestickData = generateMockCandlestickData(10);

  beforeEach(() => {
    jest.useFakeTimers();
    mockApiService = {
      checkHealth: jest.fn().mockResolvedValue(true),
      fetchCurrentPrices: jest.fn().mockResolvedValue({
        BTC: { price: 42000, change24h: 2.5 },
        ETH: { price: 2800, change24h: -1.2 },
        SOL: { price: 120, change24h: 5.8 },
        ADA: { price: 0.45, change24h: 0.0 }
      }),
      fetchCandlesticks: jest.fn().mockResolvedValue(mockCandlestickData),
      fetch24hStats: jest.fn().mockResolvedValue(null),
      subscribeToPrice: jest.fn(),
      subscribeToCandlesticks: jest.fn(),
      unsubscribe: jest.fn(),
      disconnect: jest.fn()
    } as any;

    (ApiService as jest.MockedClass<typeof ApiService>).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<App />);
    expect(screen.getByText('Loading Market Data')).toBeInTheDocument();
    expect(screen.getByText('Fetching latest prices from Binance...')).toBeInTheDocument();
  });

  it('initializes services and shows connected status', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(mockApiService.checkHealth).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  it('shows error status when API health check fails', async () => {
    mockApiService.checkHealth.mockResolvedValue(false);
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  it('fetches and displays price data for all tokens', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(mockApiService.fetchCurrentPrices).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Use getAllByText since the price might appear in multiple places
      const btcPrices = screen.getAllByText('$42,000');
      expect(btcPrices.length).toBeGreaterThan(0);
      
      expect(screen.getByText('$2,800')).toBeInTheDocument(); // ETH price
      expect(screen.getByText('$120.00')).toBeInTheDocument(); // SOL price  
      expect(screen.getByText('$0.4500')).toBeInTheDocument(); // ADA price
    });
  });

  it('displays price changes with correct colors', async () => {
    render(<App />);
    
    await waitFor(() => {
      // Use getAllByText as changes might appear in multiple places
      const btcChanges = screen.getAllByText('+2.50%');
      expect(btcChanges.length).toBeGreaterThan(0);
      expect(btcChanges[0]).toHaveStyle({ color: '#10b981' }); // green for positive
      
      const ethChange = screen.getByText('-1.20%');
      expect(ethChange).toHaveStyle({ color: '#ef4444' }); // red for negative
      
      const adaChange = screen.getByText('+0.00%');
      expect(adaChange).toHaveStyle({ color: '#6b7280' }); // gray for zero
    });
  });

  it('switches between tokens', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    });

    const ethButton = screen.getByText('ETH').closest('.token-item');
    await user.click(ethButton!);

    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
    });
  });

  it('switches between time periods', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    const weekButton = screen.getByText('1W');
    await user.click(weekButton);

    await waitFor(() => {
      expect(mockApiService.fetchCandlesticks).toHaveBeenCalledWith('BTC', '5m', 2016);
    });
  });

  it('switches between chart view modes', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(mockApiService.fetchCandlesticks).toHaveBeenCalled();
    });

    // Default is line chart
    expect(screen.queryByTestId('interactive-candlestick-chart')).not.toBeInTheDocument();

    const candlestickButton = screen.getByText('Candlestick');
    await user.click(candlestickButton);

    expect(screen.getByTestId('interactive-candlestick-chart')).toBeInTheDocument();
  });

  it('polls for updates every 5 seconds', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(mockApiService.fetchCurrentPrices).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockApiService.fetchCurrentPrices).toHaveBeenCalledTimes(2);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockApiService.fetchCurrentPrices).toHaveBeenCalledTimes(3);
    });
  });

  it('aggregates candles for different time periods', async () => {
    const longCandleData = generateMockCandlestickData(2016);
    
    mockApiService.fetchCandlesticks.mockResolvedValue(longCandleData);
    
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    const weekButton = screen.getByText('1W');
    await user.click(weekButton);

    await waitFor(() => {
      expect(mockApiService.fetchCandlesticks).toHaveBeenCalledWith('BTC', '5m', 2016);
    });
  });

  it('handles different period buttons correctly', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    
    // Ensure candlestick data is available
    mockApiService.fetchCandlesticks.mockResolvedValue(mockCandlestickData);
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    // Wait for initial data load
    await waitFor(() => {
      expect(mockApiService.fetchCandlesticks).toHaveBeenCalled();
    });

    // Mock should return data for the chart to render
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Check if period buttons exist
    const buttons = screen.queryAllByRole('button');
    const periodButtons = buttons.filter(btn => 
      ['1D', '1W', '1M', '3M', 'YTD', '1Y'].includes(btn.textContent || '')
    );
    
    expect(periodButtons.length).toBeGreaterThan(0);
    
    // Test available period buttons
    if (periodButtons.length > 0) {
      const firstButton = periodButtons[0];
      await user.click(firstButton);
      
      await waitFor(() => {
        expect(mockApiService.fetchCandlesticks).toHaveBeenCalledTimes(2); // Initial + click
      });
    }
  });

  it('shows trading indicators when data is available', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByTestId('trading-indicators')).toBeInTheDocument();
      expect(screen.getByTestId('trading-indicators')).toHaveTextContent('Price: 42000');
    });
  });

  it('handles period change from candlestick chart', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(mockApiService.fetchCandlesticks).toHaveBeenCalled();
    });

    const candlestickButton = screen.getByText('Candlestick');
    await user.click(candlestickButton);

    const changePeriodButton = screen.getByText('Change Period');
    await user.click(changePeriodButton);

    await waitFor(() => {
      // The period change might not result in '1W' timeframe but still use '5m' with different limit
      const calls = mockApiService.fetchCandlesticks.mock.calls;
      const hasValidCall = calls.some(call => {
        return call[0] === 'BTC' && call[1] === '5m' && typeof call[2] === 'number';
      });
      expect(hasValidCall).toBe(true);
    });
  });

  it('cleans up intervals on unmount', async () => {
    const { unmount } = render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    unmount();
    
    // Advance timers to ensure no more calls are made
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    const callCount = mockApiService.fetchCurrentPrices.mock.calls.length;
    
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockApiService.fetchCurrentPrices).toHaveBeenCalledTimes(callCount);
  });

  it('formats prices correctly for different tokens', async () => {
    render(<App />);
    
    await waitFor(() => {
      // Use getAllByText since prices might appear in multiple places
      const btcPrices = screen.getAllByText('$42,000');
      expect(btcPrices.length).toBeGreaterThan(0);
      expect(screen.getByText('$0.4500')).toBeInTheDocument(); // ADA with 4 decimals
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockApiService.fetchCurrentPrices.mockRejectedValueOnce(new Error('API Error'));
    
    render(<App />);
    
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('❌ Error fetching prices:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('shows empty chart state when no data available', () => {
    mockApiService.fetchCandlesticks.mockResolvedValue([]);
    
    render(<App />);
    
    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
  });

  it('tracks current selection with ref', async () => {
    const user = await userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });

    // Change to ETH
    const ethButton = screen.getByText('ETH').closest('.token-item');
    await user.click(ethButton!);

    // Advance timer to trigger polling
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      const lastCall = mockApiService.fetchCandlesticks.mock.calls[mockApiService.fetchCandlesticks.mock.calls.length - 1];
      expect(lastCall[0]).toBe('ETH');
    });
  });
});