# Cryptocurrency Trading Platform

A comprehensive cryptocurrency trading platform featuring a real-time dashboard and an AI-powered sentiment-driven trading signal bot. Built with React, Node.js, PostgreSQL, and integrates with Binance, social media, and news APIs.

## 🚀 Features

- **Real-time Price Tracking**: Live updates for BTC, ETH, SOL, and ADA via WebSocket
- **Interactive Candlestick Charts**: Advanced charting with zoom, pan, and multiple timeframes (5m, 1h, 1d)
- **Technical Indicators**: 10+ indicators including RSI, MACD, Bollinger Bands, and more
- **Trading Signals**: Automated BUY/SELL signal generation based on technical analysis
- **Responsive Design**: Optimized for desktop and mobile devices
- **Data Persistence**: PostgreSQL for historical data and IndexedDB for offline support
- **Dockerized Deployment**: One-command setup with Docker Compose
- **100% Test Coverage**: Comprehensive unit and integration tests

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Recharts** for interactive data visualization
- **IndexedDB** for client-side data caching
- **CSS Grid/Flexbox** for responsive layouts

### Backend Stack
- **Node.js** with Express.js framework
- **PostgreSQL** for time-series data storage
- **WebSocket** for real-time Binance data streams
- **Node-cron** for scheduled tasks

### DevOps
- **Docker** & **Docker Compose** for containerization
- **Jest** for testing with 100% coverage
- **GitHub Actions** ready for CI/CD

## 📁 Repository Structure

```
crypto-dashboard/
├── frontend/               # React-based trading dashboard
│   ├── src/               # Source code
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
│
├── backend/               # Node.js API server
│   ├── src/               # Source code
│   │   ├── routes/        # API endpoints
│   │   └── services/      # Business logic
│   └── package.json       # Backend dependencies
│
├── database/              # Database schemas and migrations
│   └── init.sql          # PostgreSQL initialization
│
├── deployment/            # Deployment configurations
│   ├── docker-compose.yml          # Development setup
│   ├── docker-compose.prod.yml     # Production setup
│   ├── Dockerfile.frontend         # Frontend container
│   └── Dockerfile.frontend.prod    # Production frontend
│
├── docs/                  # Documentation
│   ├── design/           # System design documents
│   ├── testing/          # Test cases and coverage
│   └── videos/           # Video documentation scripts
│
└── LICENSE               # MIT License
```

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd crypto-dashboard
```

2. Start all services:
```bash
cd deployment
docker-compose up -d
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432

### Manual Setup

#### Backend
```bash
cd backend
npm install
npm start
```

#### Frontend
```bash
npm install
npm start
```

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build

# Clean up (including volumes)
docker-compose down -v
```

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: API server port (default: 3001)

### Frontend
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:3001)

## Database Schema

The PostgreSQL database stores:
- Candlestick data (OHLCV)
- Current prices
- Historical data for charting

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```

### Candlestick Data
```http
GET /api/candlesticks/:token/:timeframe
```
Parameters:
- `token`: BTC, ETH, SOL, or ADA
- `timeframe`: 5m, 1h, or 1d
- `limit`: Number of candles (default: 1000)
- `startTime` & `endTime`: Unix timestamps (optional)

### Current Prices
```http
GET /api/prices/current
```
Returns real-time prices and 24h changes for all supported tokens.

### 24-Hour Statistics
```http
GET /api/prices/stats/:token
```

## 🧪 Testing

Run comprehensive test suite:

```bash
# All tests with coverage report
npm test

# Frontend tests only
npm test

# Backend tests only
cd backend && npm test

# Watch mode for development
npm run test:watch
```

## 🛠️ Development

### Project Structure
```
crypto-dashboard/
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── services/          # API & WebSocket services
│   └── types/            # TypeScript definitions
├── backend/              # Node.js backend
│   └── src/
│       ├── routes/       # API endpoints
│       ├── services/     # Business logic
│       └── index.js      # Server entry
└── docker-compose.yml    # Container orchestration
```

### Adding New Features

1. **New Cryptocurrency**:
   - Update `MARKET_CONFIG` in both frontend and backend
   - Add to database schema
   - Restart services

2. **New Technical Indicator**:
   - Add calculation in `TradingIndicators.tsx`
   - Update signal generation logic
   - Add tests

3. **Chart Customization**:
   - Modify `InteractiveCandlestickChart.tsx`
   - Update chart colors and styles

## Production Deployment

For production deployment:

1. Update environment variables
2. Use production database credentials
3. Enable SSL/TLS
4. Set up reverse proxy (nginx)
5. Configure firewall rules

## 🚢 Production Deployment

### Prerequisites
- Domain with SSL certificate
- VPS with Docker installed
- PostgreSQL backup strategy

### Deployment Steps

1. **Clone and Configure**:
```bash
git clone https://github.com/yourusername/crypto-dashboard.git
cd crypto-dashboard
```

2. **Set Production Environment**:
```bash
# Create .env file
DATABASE_URL=postgresql://user:pass@db:5432/crypto
NODE_ENV=production
REACT_APP_API_URL=https://api.yourdomain.com
```

3. **Deploy with Docker**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

4. **Setup Nginx Reverse Proxy**:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
    }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Binance API](https://binance-docs.github.io/apidocs/) for market data
- [Recharts](https://recharts.org/) for charting library
- [Docker](https://www.docker.com/) for containerization

## ⚠️ Disclaimer

This dashboard is for educational and informational purposes only. Cryptocurrency trading carries substantial risk. Always do your own research before making investment decisions.

---

**Star this repository** if you find it helpful! 🌟