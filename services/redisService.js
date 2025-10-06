const logger = require('../utils/logger');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.redis = null;
  }

  async init() {
    try {
      this.redis = require('redis');
      await this.connect();
    } catch (error) {
      logger.warn('Redis non disponible, mode fallback activé:', error.message);
      this.isConnected = false;
      // Arrêter les tentatives de reconnexion
      this.stopRetryAttempts = true;
    }
  }

  async connect() {
    try {
      // Vérifier si Redis est disponible (Railway ne fournit pas Redis par défaut)
      if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
        logger.warn('Redis non configuré, mode fallback activé');
        this.isConnected = false;
        return;
      }

      // Utiliser REDIS_URL si disponible, sinon fallback sur host/port
      const redisConfig = process.env.REDIS_URL 
        ? { url: process.env.REDIS_URL }
        : {
            socket: {
              host: process.env.REDIS_HOST || 'localhost',
              port: process.env.REDIS_PORT || 6379,
              connectTimeout: 10000,
              lazyConnect: true
            },
            password: process.env.REDIS_PASSWORD || undefined,
          };
      
      this.client = this.redis.createClient({
        ...redisConfig,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (!this.stopRetryAttempts) {
          logger.error('Redis connection error:', err);
        }
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cache des sessions utilisateur
  async cacheSession(userId, sessionData, ttl = 3600) {
    if (!this.isConnected) {
      // Mode fallback : utiliser la mémoire locale
      if (!this.memoryCache) this.memoryCache = new Map();
      this.memoryCache.set(`session:${userId}`, {
        data: sessionData,
        expiry: Date.now() + (ttl * 1000)
      });
      return true;
    }
    
    try {
      const key = `session:${userId}`;
      await this.client.setEx(key, ttl, JSON.stringify(sessionData));
      logger.debug(`Session cached for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error caching session:', error);
      return false;
    }
  }

  async getCachedSession(userId) {
    if (!this.isConnected) {
      // Mode fallback : utiliser la mémoire locale
      if (!this.memoryCache) return null;
      const cached = this.memoryCache.get(`session:${userId}`);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
      if (cached) {
        this.memoryCache.delete(`session:${userId}`);
      }
      return null;
    }
    
    try {
      const key = `session:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting cached session:', error);
      return null;
    }
  }

  async invalidateSession(userId) {
    if (!this.isConnected) {
      // Mode fallback : supprimer de la mémoire locale
      if (this.memoryCache) {
        this.memoryCache.delete(`session:${userId}`);
      }
      return true;
    }
    
    try {
      const key = `session:${userId}`;
      await this.client.del(key);
      logger.debug(`Session invalidated for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error invalidating session:', error);
      return false;
    }
  }

  // Cache des données fréquentes
  async cacheData(key, data, ttl = 300) {
    if (!this.isConnected) {
      // Mode fallback : utiliser la mémoire locale
      if (!this.memoryCache) this.memoryCache = new Map();
      this.memoryCache.set(key, {
        data: data,
        expiry: Date.now() + (ttl * 1000)
      });
      return true;
    }
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
      logger.debug(`Data cached with key: ${key}`);
      return true;
    } catch (error) {
      logger.error('Error caching data:', error);
      return false;
    }
  }

  async getCachedData(key) {
    if (!this.isConnected) {
      // Mode fallback : utiliser la mémoire locale
      if (!this.memoryCache) return null;
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
      if (cached) {
        this.memoryCache.delete(key);
      }
      return null;
    }
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting cached data:', error);
      return null;
    }
  }

  async invalidateData(pattern) {
    if (!this.isConnected) {
      // Mode fallback : supprimer de la mémoire locale
      if (this.memoryCache) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key);
          }
        }
      }
      return true;
    }
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error('Error invalidating data:', error);
      return false;
    }
  }

  // Cache des statistiques
  async cacheStats(churchId, statsType, data, ttl = 600) {
    const key = `stats:${churchId}:${statsType}`;
    return await this.cacheData(key, data, ttl);
  }

  async getCachedStats(churchId, statsType) {
    const key = `stats:${churchId}:${statsType}`;
    return await this.getCachedData(key);
  }

  // Cache des utilisateurs
  async cacheUser(userId, userData, ttl = 1800) {
    const key = `user:${userId}`;
    return await this.cacheData(key, userData, ttl);
  }

  async getCachedUser(userId) {
    const key = `user:${userId}`;
    return await this.getCachedData(key);
  }

  // Cache des réseaux
  async cacheNetworks(churchId, networks, ttl = 600) {
    const key = `networks:${churchId}`;
    return await this.cacheData(key, networks, ttl);
  }

  async getCachedNetworks(churchId) {
    const key = `networks:${churchId}`;
    return await this.getCachedData(key);
  }

  // Méthodes utilitaires
  async isHealthy() {
    if (!this.isConnected) return false;
    
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getStats() {
    if (!this.isConnected) return null;
    
    try {
      const info = await this.client.info();
      return {
        connected: this.isConnected,
        info: info
      };
    } catch (error) {
      logger.error('Error getting Redis stats:', error);
      return null;
    }
  }
}

// Instance singleton
const redisService = new RedisService();

// Initialiser Redis au démarrage
redisService.init().catch(error => {
  logger.warn('Échec de l\'initialisation Redis:', error.message);
});

module.exports = redisService;
