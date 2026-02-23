const { LRUCache } = require("lru-cache");
const { logger } = require("../utils/logger");

// Initialize in-memory cache
// max: 500 items, ttl: 5 minutes default
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5,
});

/**
 * Initialize cache (no-op for LRU cache, just for API compatibility)
 */
async function initRedis() {
  logger.info("🧠 Initialized local LRU cache");
  return cache;
}

/**
 * Cache a value with optional TTL (seconds)
 */
async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds > 0) {
      cache.set(key, data, { ttl: ttlSeconds * 1000 });
    } else {
      cache.set(key, data);
    }
  } catch (err) {
    logger.warn(`Cache SET failed for ${key}: ${err.message}`);
  }
}

/**
 * Get a cached value (returns parsed JSON or null)
 */
async function cacheGet(key) {
  try {
    const data = cache.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn(`Cache GET failed for ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Delete a cached key
 */
async function cacheDel(key) {
  try {
    cache.delete(key);
  } catch (err) {
    logger.warn(`Cache DEL failed for ${key}: ${err.message}`);
  }
}

module.exports = {
  initRedis,
  cacheSet,
  cacheGet,
  cacheDel,
};
