# Frontend - Crypto Trading Dashboard

React-based real-time cryptocurrency trading dashboard with advanced charting and technical indicators.

## 🚀 Features

- Real-time price updates via WebSocket
- Interactive candlestick charts with zoom/pan
- 10+ technical indicators
- Responsive design for mobile/desktop
- Offline support with IndexedDB

## 📦 Installation

```bash
npm install
```

## 🔧 Development

```bash
npm start
```

The app will run on http://localhost:3000

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🏗️ Build

```bash
npm run build
```

## 📁 Structure

```
frontend/
├── src/
│   ├── components/      # React components
│   │   ├── CandlestickChart.tsx
│   │   ├── InteractiveCandlestickChart.tsx
│   │   └── TradingIndicators.tsx
│   ├── services/        # API and data services
│   │   ├── api.ts      # Backend API client
│   │   ├── binanceService.ts  # WebSocket service
│   │   └── database.ts # IndexedDB service
│   ├── types/          # TypeScript definitions
│   ├── test-utils/     # Testing utilities
│   └── App.tsx         # Main application
├── public/             # Static assets
└── package.json        # Dependencies
```

## 🔑 Environment Variables

Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:3001
```

## 🎨 Key Components

### CandlestickChart
Basic candlestick chart visualization using Recharts.

### InteractiveCandlestickChart
Advanced chart with D3.js featuring:
- Mouse wheel zoom
- Click and drag panning
- Keyboard navigation
- Volume bars
- Custom tooltips

### TradingIndicators
Calculates and displays:
- RSI (Relative Strength Index)
- MACD with signal line
- Moving Average crossovers
- Bollinger Bands
- Stochastic Oscillator
- And more...

## 🔌 API Integration

The frontend connects to the backend API for:
- Historical candlestick data
- Current prices
- 24-hour statistics

WebSocket connection for real-time updates:
- Binance price streams
- Automatic reconnection
- Error handling

## 💾 Data Persistence

Uses IndexedDB for:
- Offline data access
- Performance optimization
- Reduced API calls

## 🎯 Performance

- Component memoization
- Virtual scrolling for large datasets
- Lazy loading
- Optimized re-renders