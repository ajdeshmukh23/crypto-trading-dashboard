const { fetchKlines } = require('./binanceApi');

class DataManager {
  constructor(pool, marketConfig) {
    this.pool = pool;
    this.marketConfig = marketConfig;
    this.isFillingGaps = false;
  }

  // Check for gaps in the data
  async findDataGaps(token, timeframe) {
    let intervalMs;
    if (timeframe === '5m') {
      intervalMs = 5 * 60 * 1000; // 5 minutes
    } else if (timeframe === '1h') {
      intervalMs = 60 * 60 * 1000; // 1 hour
    } else {
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
    }
    
    const query = `
      SELECT open_time
      FROM candlesticks
      WHERE token = $1 AND timeframe = $2
      ORDER BY open_time ASC
    `;
    
    const result = await this.pool.query(query, [token, timeframe]);
    const gaps = [];
    
    if (result.rows.length === 0) {
      // No data at all, need to fetch historical data
      const now = Date.now();
      let startTime;
      if (timeframe === '5m') {
        startTime = now - (1 * 24 * 60 * 60 * 1000); // 1 day for 5m
      } else if (timeframe === '1h') {
        startTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days for hourly
      } else {
        startTime = now - (90 * 24 * 60 * 60 * 1000); // 90 days for daily
      }
      
      gaps.push({
        start: startTime,
        end: now,
        missingIntervals: Math.floor((now - startTime) / intervalMs)
      });
      return gaps;
    }
    
    // Check for gaps between existing data points
    for (let i = 1; i < result.rows.length; i++) {
      const prevTime = parseInt(result.rows[i - 1].open_time);
      const currTime = parseInt(result.rows[i].open_time);
      const expectedTime = prevTime + intervalMs;
      
      if (currTime > expectedTime) {
        gaps.push({
          start: expectedTime,
          end: currTime - intervalMs,
          missingIntervals: Math.floor((currTime - expectedTime) / intervalMs)
        });
      }
    }
    
    // Check for gap from last data point to now
    const lastTime = parseInt(result.rows[result.rows.length - 1].open_time);
    const now = Date.now();
    const expectedLastTime = lastTime + intervalMs;
    
    if (now > expectedLastTime + intervalMs) {
      gaps.push({
        start: expectedLastTime,
        end: now,
        missingIntervals: Math.floor((now - expectedLastTime) / intervalMs)
      });
    }
    
    return gaps;
  }

  // Fill gaps in the data
  async fillGaps(token, timeframe, maxCandles = 1000) {
    const symbol = this.marketConfig[token]?.symbol;
    if (!symbol) {
      console.error(`Unknown token: ${token}`);
      return { candlesFilled: 0, errors: [`Unknown token: ${token}`] };
    }

    const gaps = await this.findDataGaps(token, timeframe);
    
    if (gaps.length === 0) {
      console.log(`No gaps found for ${token} ${timeframe}`);
      return { candlesFilled: 0, errors: [] };
    }

    console.log(`Found ${gaps.length} gaps for ${token} ${timeframe}`);

    let candlesFilled = 0;
    const errors = [];

    for (const gap of gaps) {
      try {
        // Binance has a limit of 1000 candles per request
        let currentStart = gap.start;
        
        while (currentStart < gap.end) {
          const klines = await fetchKlines(
            symbol,
            timeframe,
            Math.min(maxCandles, 1000),
            currentStart,
            gap.end
          );

          if (klines.length === 0) {
            break;
          }

          // Save the fetched data
          for (const kline of klines) {
            await this.saveCandle(token, timeframe, kline);
          }

          candlesFilled += klines.length;
          console.log(`Filled ${klines.length} candles for ${token} ${timeframe}`);

          // Move to the next batch
          const lastKline = klines[klines.length - 1];
          currentStart = lastKline.closeTime + 1;

          // Rate limiting - Binance allows 1200 requests per minute
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error filling gap for ${token} ${timeframe}:`, error);
        errors.push(error.message);
      }
    }

    return { candlesFilled, errors };
  }

  // Save a single candle with duplicate prevention
  async saveCandle(token, timeframe, candle) {
    const query = `
      INSERT INTO candlesticks 
      (token, timeframe, open_time, open, high, low, close, volume, close_time, quote_volume, trades, taker_buy_base_volume, taker_buy_quote_volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (token, timeframe, open_time) 
      DO UPDATE SET 
        high = GREATEST(candlesticks.high, EXCLUDED.high),
        low = LEAST(candlesticks.low, EXCLUDED.low),
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        close_time = EXCLUDED.close_time,
        quote_volume = EXCLUDED.quote_volume,
        trades = EXCLUDED.trades,
        taker_buy_base_volume = EXCLUDED.taker_buy_base_volume,
        taker_buy_quote_volume = EXCLUDED.taker_buy_quote_volume
      WHERE candlesticks.close_time < EXCLUDED.close_time
    `;

    const values = [
      token,
      timeframe,
      candle.openTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.closeTime,
      candle.quoteVolume,
      candle.trades,
      candle.takerBuyBaseVolume,
      candle.takerBuyQuoteVolume
    ];

    await this.pool.query(query, values);
  }

  // Run gap filling for all tokens and timeframes
  async fillAllGaps() {
    if (this.isFillingGaps) {
      console.log('Gap filling already in progress');
      return [];
    }

    this.isFillingGaps = true;
    const tokens = Object.keys(this.marketConfig);
    const timeframes = ['5m', '1h', '1d'];

    try {
      // Process all tokens in parallel
      const promises = [];
      for (const token of tokens) {
        for (const timeframe of timeframes) {
          promises.push(
            this.fillGaps(token, timeframe)
              .catch(error => ({ token, timeframe, error: error.message }))
          );
        }
      }
      
      // Wait for all to complete
      const results = await Promise.all(promises);
      return results;
    } finally {
      this.isFillingGaps = false;
    }
  }

  // Get data statistics
  async getDataStats() {
    const query = `
      SELECT 
        token,
        timeframe,
        COUNT(*) as count,
        MIN(open_time) as oldest,
        MAX(open_time) as newest
      FROM candlesticks
      GROUP BY token, timeframe
      ORDER BY token, timeframe
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      token: row.token,
      timeframe: row.timeframe,
      count: parseInt(row.count),
      oldest: row.oldest,
      newest: row.newest
    }));
  }

  // Clean up old data (optional, based on retention policy)
  async cleanOldData(retentionDays = 30) {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    const query = `
      DELETE FROM candlesticks
      WHERE timeframe = '5m' AND open_time < $1
    `;

    const result = await this.pool.query(query, [cutoffTime]);
    console.log(`Cleaned ${result.rowCount} old 5m candles`);
    return result.rowCount;
  }
}

module.exports = DataManager;