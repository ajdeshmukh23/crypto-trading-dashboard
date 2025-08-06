const https = require('https');
const { fetchKlines, getServerTime } = require('./binanceApi');

// Mock https module
jest.mock('https');

describe('BinanceApi Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchKlines', () => {
    const mockKlineData = [
      [
        1640995200000, // Open time
        "46707.01",    // Open
        "46779.00",    // High
        "46690.00",    // Low
        "46715.68",    // Close
        "45.174",      // Volume
        1640998799999, // Close time
        "2105029.84",  // Quote asset volume
        2194,          // Number of trades
        "23.456",      // Taker buy base asset volume
        "1095234.56",  // Taker buy quote asset volume
        "0"            // Ignore
      ],
      [
        1640998800000,
        "46715.68",
        "46800.00",
        "46700.00",
        "46780.00",
        "50.123",
        1641002399999,
        "2340567.89",
        2500,
        "25.678",
        "1200000.00",
        "0"
      ]
    ];

    it('fetches kline data successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(mockKlineData));
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchKlines('BTCUSDT', '1h', 2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        openTime: 1640995200000,
        open: 46707.01,
        high: 46779.00,
        low: 46690.00,
        close: 46715.68,
        volume: 45.174,
        closeTime: 1640998799999,
        quoteVolume: 2105029.84,
        trades: 2194,
        takerBuyBaseVolume: 23.456,
        takerBuyQuoteVolume: 1095234.56
      });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.binance.us',
          path: '/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2',
          method: 'GET'
        }),
        expect.any(Function)
      );
    });

    it('includes optional parameters in request', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify([]));
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await fetchKlines('ETHUSDT', '5m', 500, 1640995200000, 1641081600000);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/v3/klines?symbol=ETHUSDT&interval=5m&limit=500&startTime=1640995200000&endTime=1641081600000'
        }),
        expect.any(Function)
      );
    });

    it('handles non-200 status codes', async () => {
      const mockResponse = {
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('{"code":-1003,"msg":"Too many requests"}');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(fetchKlines('BTCUSDT', '1h'))
        .rejects.toThrow('HTTP 429:');
    });

    it('handles network errors', async () => {
      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
        }),
        end: jest.fn()
      };

      https.request.mockImplementation(() => mockRequest);

      await expect(fetchKlines('BTCUSDT', '1h'))
        .rejects.toThrow('Network error');
    });

    it('handles invalid JSON response', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('invalid json');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(fetchKlines('BTCUSDT', '1h'))
        .rejects.toThrow();
    });

    it('handles chunked response data', async () => {
      const chunk1 = JSON.stringify(mockKlineData).slice(0, 100);
      const chunk2 = JSON.stringify(mockKlineData).slice(100);

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(chunk1);
            handler(chunk2);
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchKlines('BTCUSDT', '1h', 2);
      expect(result).toHaveLength(2);
    });

    it('returns empty array for empty response', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('[]');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchKlines('BTCUSDT', '1h');
      expect(result).toEqual([]);
    });

    it('handles API error responses', async () => {
      const mockResponse = {
        statusCode: 400,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('{"code":-1121,"msg":"Invalid symbol."}');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(fetchKlines('INVALID', '1h'))
        .rejects.toThrow('HTTP 400');
    });
  });

  describe('getServerTime', () => {
    it('fetches server time successfully', async () => {
      const mockServerTime = { serverTime: 1640995200000 };

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(mockServerTime));
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await getServerTime();

      expect(result).toEqual(mockServerTime.serverTime);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.binance.us',
          path: '/api/v3/time',
          method: 'GET'
        }),
        expect.any(Function)
      );
    });

    it('handles server time fetch errors', async () => {
      const mockResponse = {
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('Service Unavailable');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(getServerTime())
        .rejects.toThrow('Failed to get server time: 503');
    });

    it('handles network timeouts', async () => {
      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('ETIMEDOUT'));
          }
        }),
        end: jest.fn()
      };

      https.request.mockImplementation(() => mockRequest);

      await expect(getServerTime())
        .rejects.toThrow('ETIMEDOUT');
    });
  });

  describe('Integration scenarios', () => {
    it('handles rate limiting with retry-after header', async () => {
      const mockResponse = {
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        headers: {
          'retry-after': '60'
        },
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('{"code":-1003,"msg":"Too many requests"}');
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(fetchKlines('BTCUSDT', '1h'))
        .rejects.toThrow('HTTP 429:');
    });

    it('handles malformed kline data gracefully', async () => {
      const malformedKlineData = [
        [1640995200000, "46707.01"], // Missing fields
        null, // Null entry
        [], // Empty array
        [
          1640998800000,
          "46715.68",
          "46800.00",
          "46700.00",
          "46780.00",
          "50.123",
          1641002399999,
          "2340567.89",
          2500,
          "25.678",
          "1200000.00",
          "0"
        ]
      ];

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(malformedKlineData));
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        end: jest.fn()
      };

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      // Should reject with parse error for malformed data
      await expect(fetchKlines('BTCUSDT', '1h'))
        .rejects.toThrow('Failed to parse response');
    });
  });
});