const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const cacheMiddleware = (duration = CACHE_DURATION) => {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse && Date.now() - cachedResponse.timestamp < duration) {
      return res.json(cachedResponse.data);
    }

    // Intercepter la réponse pour la mettre en cache
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
      return originalJson.call(this, data);
    };

    next();
  };
};

// Fonction pour invalider le cache
const invalidateCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cache
};
