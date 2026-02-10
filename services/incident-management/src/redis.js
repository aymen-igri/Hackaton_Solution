const Redis = require('ioredis');
const config = require('./config');

// Shared Redis client (for LPUSH, general commands)
const redis = new Redis(config.redisUrl);

redis.on('connect', () => console.log('[redis] Connected'));
redis.on('error', (err) => console.error('[redis] Error:', err.message));

module.exports = redis;