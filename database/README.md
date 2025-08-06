# Database Configuration

PostgreSQL database schema and initialization scripts for the Crypto Trading Platform.

## 📄 Files

### init.sql
Database initialization script that creates:
- Tables for candlestick data
- Current prices tracking
- Indexes for performance
- Initial configuration

## 🗄️ Schema

### Tables

#### candlesticks
Stores historical OHLCV (Open, High, Low, Close, Volume) data.

```sql
CREATE TABLE candlesticks (
    id SERIAL PRIMARY KEY,
    token VARCHAR(10) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open_time BIGINT NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    close_time BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, timeframe, open_time)
);
```

#### current_prices
Tracks latest prices and 24-hour changes.

```sql
CREATE TABLE current_prices (
    token VARCHAR(10) PRIMARY KEY,
    price DECIMAL(20, 8) NOT NULL,
    change_24h DECIMAL(10, 2),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

Performance-optimized indexes:
- `idx_candlesticks_token_timeframe_time`: For time-series queries
- `idx_candlesticks_time`: For time-based filtering

## 🚀 Setup

### Manual Setup
```bash
psql -U postgres
CREATE DATABASE crypto_dashboard;
\c crypto_dashboard
\i init.sql
```

### Docker Setup
Automatically executed when PostgreSQL container starts.

## 📊 Data Management

### Supported Tokens
- BTC (Bitcoin)
- ETH (Ethereum)
- SOL (Solana)
- ADA (Cardano)

### Timeframes
- 5m (5 minutes)
- 1h (1 hour)
- 1d (1 day)

### Data Retention
- 5m data: 30 days (auto-cleanup)
- 1h data: Indefinite
- 1d data: Indefinite

## 🔧 Maintenance

### Vacuum Operations
```sql
VACUUM ANALYZE candlesticks;
```

### Index Maintenance
```sql
REINDEX TABLE candlesticks;
```

### Statistics Update
```sql
ANALYZE candlesticks;
```

## 📈 Performance Tips

1. **Partitioning**: Consider partitioning by timeframe for very large datasets
2. **Archiving**: Move old data to archive tables
3. **Connection Pooling**: Use PgBouncer for high traffic
4. **Read Replicas**: Scale read operations

## 🔒 Security

### Best Practices
1. Use strong passwords
2. Limit connection sources
3. Enable SSL/TLS
4. Regular backups
5. Audit logging

### User Permissions
```sql
-- Read-only user
CREATE USER crypto_reader WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crypto_reader;

-- Application user
CREATE USER crypto_app WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO crypto_app;
```

## 🔄 Backup and Recovery

### Backup
```bash
pg_dump -U postgres crypto_dashboard > backup.sql
```

### Restore
```bash
psql -U postgres crypto_dashboard < backup.sql
```

### Continuous Archiving
Configure WAL archiving for point-in-time recovery.

## 📊 Monitoring Queries

### Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Active Connections
```sql
SELECT count(*) FROM pg_stat_activity;
```

### Slow Queries
```sql
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```