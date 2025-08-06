import { CandlestickData } from '../types/market';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export class ApiService {
  // Fetch candlestick data from API
  async fetchCandlesticks(
    token: string, 
    timeframe: string, 
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<CandlestickData[]> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (startTime) params.append('startTime', startTime.toString());
      if (endTime) params.append('endTime', endTime.toString());

      const response = await fetch(
        `${API_URL}/api/candlesticks/${token}/${timeframe}?${params}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Error fetching candlesticks:', error);
      return [];
    }
  }

  // Fetch current prices for all tokens
  async fetchCurrentPrices(): Promise<{ [token: string]: { price: number; change24h: number } }> {
    try {
      const response = await fetch(`${API_URL}/api/prices/current`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        const prices: { [token: string]: { price: number; change24h: number } } = {};
        Object.entries(data.data).forEach(([token, info]: [string, any]) => {
          prices[token] = {
            price: info.price,
            change24h: info.change24h
          };
        });
        return prices;
      }
      return {};
    } catch (error) {
      console.error('Error fetching current prices:', error);
      return {};
    }
  }

  // Fetch 24h stats for a specific token
  async fetch24hStats(token: string): Promise<{ currentPrice: number; change24h: number }> {
    try {
      const response = await fetch(`${API_URL}/api/prices/stats/${token}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : { currentPrice: 0, change24h: 0 };
    } catch (error) {
      console.error('Error fetching 24h stats:', error);
      return { currentPrice: 0, change24h: 0 };
    }
  }

  // Check API health
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }
}