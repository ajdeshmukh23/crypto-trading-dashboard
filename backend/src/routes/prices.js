const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // Get current prices for all tokens
  router.get('/current', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT token, price, change_24h, updated_at
        FROM current_prices
        ORDER BY token
      `);

      const prices = {};
      result.rows.forEach(row => {
        prices[row.token] = {
          price: parseFloat(row.price),
          change24h: parseFloat(row.change_24h) || 0,
          updatedAt: row.updated_at
        };
      });

      res.json({
        success: true,
        data: prices
      });
    } catch (error) {
      console.error('Error fetching current prices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch current prices'
      });
    }
  });

  // Get 24h stats for a token
  router.get('/stats/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const upperToken = token.toUpperCase();
      
      // Get current price
      const currentResult = await pool.query(`
        SELECT close
        FROM candlesticks
        WHERE token = $1
        ORDER BY open_time DESC
        LIMIT 1
      `, [upperToken]);

      // Get price 24h ago
      const dayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      const oldResult = await pool.query(`
        SELECT close
        FROM candlesticks
        WHERE token = $1 AND open_time <= $2
        ORDER BY open_time DESC
        LIMIT 1
      `, [upperToken, dayAgo.toISOString()]);

      const currentPrice = currentResult.rows.length > 0 ? parseFloat(currentResult.rows[0].close) : 0;
      const oldPrice = oldResult.rows.length > 0 ? parseFloat(oldResult.rows[0].close) : 0;
      
      let change24h = 0;
      if (oldPrice > 0) {
        change24h = ((currentPrice - oldPrice) / oldPrice) * 100;
      }

      res.json({
        success: true,
        data: {
          token: upperToken,
          currentPrice,
          price24hAgo: oldPrice,
          change24h: parseFloat(change24h.toFixed(2))
        }
      });
    } catch (error) {
      console.error('Error fetching 24h stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch 24h stats'
      });
    }
  });

  return router;
};