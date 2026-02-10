/**
 * Shared Redis client for notification service
 */
const Redis = require('ioredis');
const config = require('./config');
const logger = require('./logger');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  }
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

module.exports = redis;
