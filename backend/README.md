# Backend - Crypto Trading API

Node.js/Express API server providing real-time cryptocurrency data and technical analysis.

## 🚀 Features

- RESTful API endpoints
- Real-time Binance WebSocket integration
- PostgreSQL time-series data storage
- Automated data gap detection and filling
- Scheduled data maintenance tasks

## 📦 Installation

```bash
npm install
```

## 🔧 Development

```bash
# Development with hot reload
npm run dev

# Production
npm start
```

The API will run on http://localhost:3001

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📁 Structure

```
backend/
├── src/
│   ├── routes/         # API endpoints
│   │   ├── candlesticks.js
│   │   └── prices.js
│   ├── services/       # Business logic
│   │   ├── binanceApi.js   # Binance API client
│   │   └── dataManager.js  # Data management
│   └── index.js        # Server entry point
├── db/                 # Database files
└── package.json        # Dependencies
```

## 🔑 Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/crypto_dashboard
PORT=3001
NODE_ENV=development
```

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```

### Candlestick Data
```http
GET /api/candlesticks/:token/:timeframe
```
- `token`: BTC, ETH, SOL, ADA
- `timeframe`: 5m, 1h, 1d
- Query params: `limit`, `startTime`, `endTime`

### Current Prices
```http
GET /api/prices/current
```
Returns real-time prices for all tokens.

### Statistics
```http
GET /api/stats
```
Database statistics and health metrics.

## 🔄 Data Services

### DataManager
- Gap detection algorithm
- Automatic gap filling
- Data aggregation for longer timeframes
- 24-hour change calculations

### BinanceApi
- REST API integration
- Rate limit handling
- Error recovery
- Data transformation

## ⏰ Scheduled Tasks

1. **Hourly Gap Filling**
   - Checks for missing data
   - Fetches from Binance API
   - Maintains data integrity

2. **5-Minute Price Updates**
   - Recalculates 24h changes
   - Updates current prices

3. **Daily Cleanup**
   - Removes old 5m data (>30 days)
   - Optimizes database

## 🗄️ Database Schema

### candlesticks
- Stores OHLCV data
- Indexed by token, timeframe, time
- Unique constraint prevents duplicates

### current_prices
- Latest price and 24h change
- Updated in real-time

## 🚀 Performance

- Connection pooling
- Efficient batch inserts
- Optimized queries
- Caching strategies

## 🔒 Security

- Input validation
- SQL injection prevention
- Rate limiting ready
- CORS configuration