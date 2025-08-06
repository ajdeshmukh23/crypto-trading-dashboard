const https = require('https');

const BINANCE_API_HOST = 'api.binance.us';

// Fetch historical klines from Binance
async function fetchKlines(symbol, interval, limit = 500, startTime = null, endTime = null) {
  return new Promise((resolve, reject) => {
    let path = `/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    
    if (startTime) {
      path += `&startTime=${startTime}`;
    }
    if (endTime) {
      path += `&endTime=${endTime}`;
    }

    const options = {
      hostname: BINANCE_API_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Crypto-Dashboard/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const klines = JSON.parse(data);
            const formattedKlines = klines.map(k => ({
              openTime: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
              closeTime: k[6],
              quoteVolume: parseFloat(k[7]),
              trades: k[8],
              takerBuyBaseVolume: parseFloat(k[9]),
              takerBuyQuoteVolume: parseFloat(k[10])
            }));
            resolve(formattedKlines);
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Get server time to ensure our timestamps are in sync
async function getServerTime() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BINANCE_API_HOST,
      path: '/api/v3/time',
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result.serverTime);
          } catch (error) {
            reject(new Error('Failed to parse server time'));
          }
        } else {
          reject(new Error(`Failed to get server time: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

module.exports = {
  fetchKlines,
  getServerTime
};