const redisService = require('../services/redisService');
const logger = require('../utils/logger');

/**
 * Middleware de cache intelligent pour les requêtes fréquentes
 */
const smartCache = (options = {}) => {
  const {
    ttl = 300, // 5 minutes par défaut
    keyGenerator = (req) => `cache:${req.method}:${req.originalUrl}`,
    skipCache = (req) => false,
    skipCacheOnError = true
  } = options;

  return async (req, res, next) => {
    // Vérifier si on doit ignorer le cache
    if (skipCache(req)) {
      return next();
    }

    // Générer la clé de cache
    const cacheKey = keyGenerator(req);
    
    try {
      // Essayer de récupérer depuis le cache
      const cachedData = await redisService.getCachedData(cacheKey);
      
      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Si pas de cache, continuer et intercepter la réponse
      const originalJson = res.json;
      
      res.json = function(data) {
        // Mettre en cache seulement si la réponse est réussie
        if (data && data.success !== false) {
          redisService.cacheData(cacheKey, data.data || data, ttl)
            .then(() => {
              logger.debug(`Data cached with key: ${cacheKey}`);
            })
            .catch(error => {
              logger.error('Error caching data:', error);
            });
        }
        
        // Appeler la méthode originale
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      if (skipCacheOnError) {
        next();
      } else {
        res.status(500).json({
          success: false,
          message: 'Erreur de cache'
        });
      }
    }
  };
};

/**
 * Cache spécialisé pour les statistiques
 */
const statsCache = (statsType, ttl = 600) => {
  return smartCache({
    ttl,
    keyGenerator: (req) => {
      const churchId = req.user?.eglise_locale_id || 'global';
      return `stats:${churchId}:${statsType}`;
    },
    skipCache: (req) => {
      // Ne pas cacher si l'utilisateur demande un refresh
      return req.query.refresh === 'true';
    }
  });
};

/**
 * Cache spécialisé pour les utilisateurs
 */
const usersCache = (ttl = 1800) => {
  return smartCache({
    ttl,
    keyGenerator: (req) => {
      const churchId = req.user?.eglise_locale_id || 'global';
      const filters = JSON.stringify(req.query);
      return `users:${churchId}:${Buffer.from(filters).toString('base64')}`;
    },
    skipCache: (req) => {
      // Ne pas cacher les requêtes de modification
      return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    }
  });
};

/**
 * Cache spécialisé pour les réseaux
 */
const networksCache = (ttl = 600) => {
  return smartCache({
    ttl,
    keyGenerator: (req) => {
      const churchId = req.user?.eglise_locale_id || 'global';
      return `networks:${churchId}`;
    },
    skipCache: (req) => {
      return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    }
  });
};

/**
 * Invalidation intelligente du cache
 */
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    try {
      await redisService.invalidateData(pattern);
      logger.info(`Cache invalidated for pattern: ${pattern}`);
      next();
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      next();
    }
  };
};

/**
 * Middleware pour invalider le cache après modification
 */
const invalidateRelatedCache = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Invalider le cache seulement si la modification est réussie
      if (data && data.success !== false) {
        patterns.forEach(async (pattern) => {
          try {
            await redisService.invalidateData(pattern);
            logger.debug(`Cache invalidated for pattern: ${pattern}`);
          } catch (error) {
            logger.error('Error invalidating cache pattern:', error);
          }
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  smartCache,
  statsCache,
  usersCache,
  networksCache,
  invalidateCache,
  invalidateRelatedCache
};
