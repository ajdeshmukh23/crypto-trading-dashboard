-- Create candlesticks table
CREATE TABLE IF NOT EXISTS candlesticks (
    id SERIAL PRIMARY KEY,
    token VARCHAR(10) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open_time BIGINT NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    close_time BIGINT NOT NULL,
    quote_volume DECIMAL(20, 8) NOT NULL,
    trades INTEGER NOT NULL,
    taker_buy_base_volume DECIMAL(20, 8) NOT NULL,
    taker_buy_quote_volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token, timeframe, open_time)
);

-- Create indexes for better query performance
CREATE INDEX idx_candlesticks_token_timeframe ON candlesticks(token, timeframe);
CREATE INDEX idx_candlesticks_open_time ON candlesticks(open_time);
CREATE INDEX idx_candlesticks_token_timeframe_time ON candlesticks(token, timeframe, open_time DESC);

-- Create current_prices table for quick access to latest prices
CREATE TABLE IF NOT EXISTS current_prices (
    id SERIAL PRIMARY KEY,
    token VARCHAR(10) NOT NULL UNIQUE,
    price DECIMAL(20, 8) NOT NULL,
    change_24h DECIMAL(10, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial tokens
INSERT INTO current_prices (token, price, change_24h) VALUES
    ('BTC', 45000, 0),
    ('ETH', 2500, 0),
    ('SOL', 100, 0),
    ('ADA', 0.5, 0)
ON CONFLICT (token) DO NOTHING;