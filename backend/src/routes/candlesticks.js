const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get candlesticks for a specific token and timeframe
  router.get('/:token/:timeframe', async (req, res) => {
    try {
      const { token, timeframe } = req.params;
      const { limit = 1000, startTime, endTime } = req.query;

      let query = `
        SELECT 
          open_time,
          open,
          high,
          low,
          close,
          volume,
          close_time,
          quote_volume,
          trades,
          taker_buy_base_volume,
          taker_buy_quote_volume
        FROM candlesticks
        WHERE token = $1 AND timeframe = $2
      `;

      const params = [token.toUpperCase(), timeframe];

      if (startTime) {
        query += ` AND open_time >= $${params.length + 1}`;
        params.push(parseInt(startTime));
      }

      if (endTime) {
        query += ` AND open_time <= $${params.length + 1}`;
        params.push(parseInt(endTime));
      }

      query += ` ORDER BY open_time DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));

      const result = await pool.query(query, params);

      const candlesticks = result.rows.map(row => ({
        openTime: parseInt(row.open_time),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        closeTime: parseInt(row.close_time),
        quoteVolume: parseFloat(row.quote_volume),
        trades: row.trades,
        takerBuyBaseVolume: parseFloat(row.taker_buy_base_volume),
        takerBuyQuoteVolume: parseFloat(row.taker_buy_quote_volume)
      }));

      res.json({
        success: true,
        data: candlesticks.reverse() // Return in chronological order
      });
    } catch (error) {
      console.error('Error fetching candlesticks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch candlesticks'
      });
    }
  });

  // Get all tokens with data
  router.get('/tokens', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT token, COUNT(*) as count
        FROM candlesticks
        GROUP BY token
        ORDER BY token
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching tokens:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tokens'
      });
    }
  });

  return router;
};