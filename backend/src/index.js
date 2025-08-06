const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const WebSocket = require('ws');
const cron = require('node-cron');
const DataManager = require('./services/dataManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://crypto_user:crypto_password@localhost:5432/crypto_dashboard'
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// Market configuration
const MARKET_CONFIG = {
  'BTC': { symbol: 'btcusdt' },
  'ETH': { symbol: 'ethusdt' },
  'SOL': { symbol: 'solusdt' },
  'ADA': { symbol: 'adausdt' }
};

// Initialize data manager
const dataManager = new DataManager(pool, MARKET_CONFIG);

// Import routes
const candlestickRoutes = require('./routes/candlesticks');
const pricesRoutes = require('./routes/prices');

// Use routes
app.use('/api/candlesticks', candlestickRoutes(pool));
app.use('/api/prices', pricesRoutes(pool));

// Data statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dataManager.getDataStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Manual gap fill endpoint (for testing)
app.post('/api/fill-gaps', async (req, res) => {
  try {
    const { token, timeframe } = req.body;
    
    if (token && timeframe) {
      await dataManager.fillGaps(token, timeframe);
    } else {
      // Fill all gaps in background
      dataManager.fillAllGaps().catch(console.error);
    }
    
    res.json({ success: true, message: 'Gap filling started' });
  } catch (error) {
    console.error('Error starting gap fill:', error);
    res.status(500).json({ success: false, error: 'Failed to start gap filling' });
  }
});

// Manual recalculate 24h changes endpoint (for testing)
app.post('/api/recalculate-changes', async (req, res) => {
  try {
    await recalculate24hChanges();
    res.json({ success: true, message: '24h changes recalculated' });
  } catch (error) {
    console.error('Error recalculating 24h changes:', error);
    res.status(500).json({ success: false, error: 'Failed to recalculate 24h changes' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection to Binance
const BINANCE_WS_URL = 'wss://stream.binance.us:9443';

function connectToBinance() {
  const tokens = Object.keys(MARKET_CONFIG);
  const streams5m = tokens.map(token => `${MARKET_CONFIG[token].symbol}@kline_5m`);
  const streams1h = tokens.map(token => `${MARKET_CONFIG[token].symbol}@kline_1h`);
  const streams1d = tokens.map(token => `${MARKET_CONFIG[token].symbol}@kline_1d`);
  const allStreams = [...streams5m, ...streams1h, ...streams1d].join('/');
  
  const ws = new WebSocket(`${BINANCE_WS_URL}/stream?streams=${allStreams}`);

  ws.on('open', () => {
    console.log('Connected to Binance WebSocket');
  });

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);
      const message = parsed.data;
      
      if (message && message.e === 'kline' && message.k) {
        const token = Object.entries(MARKET_CONFIG).find(
          ([_, config]) => config.symbol.toUpperCase() === message.s
        )?.[0];
        
        if (token) {
          const candle = {
            openTime: message.k.t,
            open: parseFloat(message.k.o),
            high: parseFloat(message.k.h),
            low: parseFloat(message.k.l),
            close: parseFloat(message.k.c),
            volume: parseFloat(message.k.v),
            closeTime: message.k.T,
            quoteVolume: parseFloat(message.k.q),
            trades: message.k.n,
            takerBuyBaseVolume: parseFloat(message.k.V),
            takerBuyQuoteVolume: parseFloat(message.k.Q)
          };

          // Save to database (the dataManager handles duplicates)
          await dataManager.saveCandle(token, '5m', candle);
          
          // Update current price
          await updateCurrentPrice(token, candle.close);
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket disconnected, reconnecting in 5 seconds...');
    setTimeout(connectToBinance, 5000);
  });
}

async function updateCurrentPrice(token, price) {
  try {
    // First, get the price from 24 hours ago
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const historicalResult = await pool.query(`
      SELECT close
      FROM candlesticks
      WHERE token = $1 AND open_time >= $2
      ORDER BY open_time ASC
      LIMIT 1
    `, [token, dayAgo]);

    let change24h = 0;
    if (historicalResult.rows.length > 0) {
      const oldPrice = parseFloat(historicalResult.rows[0].close);
      if (oldPrice > 0) {
        change24h = ((price - oldPrice) / oldPrice) * 100;
      }
    }

    // Update current price with 24h change
    const query = `
      INSERT INTO current_prices (token, price, change_24h, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (token)
      DO UPDATE SET price = $2, change_24h = $3, updated_at = NOW()
    `;

    await pool.query(query, [token, price, change24h]);
  } catch (error) {
    console.error('Error updating current price:', error);
  }
}

// Recalculate 24h changes for all tokens
async function recalculate24hChanges() {
  const tokens = Object.keys(MARKET_CONFIG);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  for (const token of tokens) {
    try {
      // Get current price
      const currentResult = await pool.query(`
        SELECT price FROM current_prices WHERE token = $1
      `, [token]);
      
      if (currentResult.rows.length === 0) continue;
      
      const currentPrice = parseFloat(currentResult.rows[0].price);
      
      // Get price from 24h ago
      const historicalResult = await pool.query(`
        SELECT close
        FROM candlesticks
        WHERE token = $1 AND open_time >= $2
        ORDER BY open_time ASC
        LIMIT 1
      `, [token, dayAgo]);
      
      let change24h = 0;
      if (historicalResult.rows.length > 0) {
        const oldPrice = parseFloat(historicalResult.rows[0].close);
        if (oldPrice > 0) {
          change24h = ((currentPrice - oldPrice) / oldPrice) * 100;
        }
      }
      
      // Update the 24h change
      await pool.query(`
        UPDATE current_prices 
        SET change_24h = $1 
        WHERE token = $2
      `, [change24h, token]);
      
      console.log(`Updated 24h change for ${token}: ${change24h.toFixed(2)}%`);
    } catch (error) {
      console.error(`Error calculating 24h change for ${token}:`, error);
    }
  }
}

// Initialize data and start services
async function initialize() {
  try {
    console.log('Initializing Crypto Dashboard Backend...');
    
    // Clear any synthetic data from the database
    console.log('Clearing synthetic data...');
    await pool.query(`
      DELETE FROM candlesticks 
      WHERE created_at < '2024-01-01'
      OR open_time > ${Date.now()}
    `);

    // Start filling gaps for all tokens
    console.log('Starting initial data fetch...');
    const results = await dataManager.fillAllGaps();
    console.log('Initial data fetch completed:', results);
    
    // Recalculate 24h changes after data is loaded
    console.log('Recalculating 24h changes...');
    await recalculate24hChanges();
    
    // Connect to Binance WebSocket for real-time updates
    connectToBinance();
    
    // Schedule regular gap filling (every hour)
    cron.schedule('0 * * * *', async () => {
      console.log('Running scheduled gap fill...');
      try {
        await dataManager.fillAllGaps();
      } catch (error) {
        console.error('Error in scheduled gap fill:', error);
      }
    });
    
    // Schedule 24h change recalculation (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      console.log('Recalculating 24h changes...');
      try {
        await recalculate24hChanges();
      } catch (error) {
        console.error('Error recalculating 24h changes:', error);
      }
    });
    
    // Schedule daily cleanup of old 5m data (keep 30 days)
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily cleanup...');
      try {
        await dataManager.cleanOldData(30);
      } catch (error) {
        console.error('Error in daily cleanup:', error);
      }
    });
    
    console.log('Initialization complete');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`Backend server running on port ${PORT}`);
    await initialize();
  });
}

// Export app for testing
module.exports = app;