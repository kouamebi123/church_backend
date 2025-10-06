const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: {},
        byMethod: {},
        responseTimes: []
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      database: {
        queries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        queryTimes: []
      },
      memory: {
        used: 0,
        free: 0,
        total: 0
      },
      uptime: {
        startTime: Date.now(),
        current: 0
      }
    };

    this.startTime = Date.now();
    this.startMetricsCollection();
  }

  /**
   * Démarrer la collecte de métriques
   */
  startMetricsCollection() {
    // Collecter les métriques de mémoire toutes les 30 secondes
    setInterval(() => {
      this.collectMemoryMetrics();
    }, 30000);

    // Calculer le hit rate du cache toutes les minutes
    setInterval(() => {
      this.calculateCacheHitRate();
    }, 60000);

    // Calculer les temps de réponse moyens toutes les 5 minutes
    setInterval(() => {
      this.calculateAverageResponseTime();
    }, 300000);
  }

  /**
   * Enregistrer une requête
   */
  recordRequest(endpoint, method, statusCode, responseTime) {
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }

    // Enregistrer par endpoint
    if (!this.metrics.requests.byEndpoint[endpoint]) {
      this.metrics.requests.byEndpoint[endpoint] = {
        total: 0,
        success: 0,
        errors: 0,
        averageResponseTime: 0
      };
    }

    this.metrics.requests.byEndpoint[endpoint].total++;
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.byEndpoint[endpoint].success++;
    } else {
      this.metrics.requests.byEndpoint[endpoint].errors++;
    }

    // Enregistrer par méthode
    if (!this.metrics.requests.byMethod[method]) {
      this.metrics.requests.byMethod[method] = 0;
    }
    this.metrics.requests.byMethod[method]++;

    // Enregistrer le temps de réponse
    this.metrics.requests.responseTimes.push({
      endpoint,
      method,
      responseTime,
      timestamp: Date.now()
    });

    // Garder seulement les 1000 derniers temps de réponse
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes = this.metrics.requests.responseTimes.slice(-1000);
    }
  }

  /**
   * Enregistrer un hit de cache
   */
  recordCacheHit() {
    this.metrics.cache.hits++;
  }

  /**
   * Enregistrer un miss de cache
   */
  recordCacheMiss() {
    this.metrics.cache.misses++;
  }

  /**
   * Enregistrer une requête de base de données
   */
  recordDatabaseQuery(queryTime, isSlow = false) {
    this.metrics.database.queries++;
    
    if (isSlow) {
      this.metrics.database.slowQueries++;
    }

    this.metrics.database.queryTimes.push({
      queryTime,
      timestamp: Date.now()
    });

    // Garder seulement les 1000 derniers temps de requête
    if (this.metrics.database.queryTimes.length > 1000) {
      this.metrics.database.queryTimes = this.metrics.database.queryTimes.slice(-1000);
    }
  }

  /**
   * Collecter les métriques de mémoire
   */
  collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    
    this.metrics.memory.used = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    this.metrics.memory.free = Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024); // MB
    this.metrics.memory.total = Math.round(memUsage.heapTotal / 1024 / 1024); // MB
  }

  /**
   * Calculer le hit rate du cache
   */
  calculateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
  }

  /**
   * Calculer le temps de réponse moyen
   */
  calculateAverageResponseTime() {
    if (this.metrics.requests.responseTimes.length === 0) return;

    const totalTime = this.metrics.requests.responseTimes.reduce((sum, req) => sum + req.responseTime, 0);
    this.metrics.requests.averageResponseTime = totalTime / this.metrics.requests.responseTimes.length;
  }

  /**
   * Calculer le temps de requête moyen de la base de données
   */
  calculateAverageQueryTime() {
    if (this.metrics.database.queryTimes.length === 0) return;

    const totalTime = this.metrics.database.queryTimes.reduce((sum, query) => sum + query.queryTime, 0);
    this.metrics.database.averageQueryTime = totalTime / this.metrics.database.queryTimes.length;
  }

  /**
   * Obtenir les métriques actuelles
   */
  getMetrics() {
    this.metrics.uptime.current = Date.now() - this.startTime;
    this.calculateAverageQueryTime();
    
    return {
      ...this.metrics,
      uptime: {
        ...this.metrics.uptime,
        current: Math.round(this.metrics.uptime.current / 1000) // en secondes
      }
    };
  }

  /**
   * Obtenir les métriques de performance
   */
  getPerformanceMetrics() {
    const metrics = this.getMetrics();
    
    return {
      requestsPerSecond: this.calculateRequestsPerSecond(),
      averageResponseTime: metrics.requests.averageResponseTime,
      errorRate: this.calculateErrorRate(),
      cacheHitRate: metrics.cache.hitRate,
      memoryUsage: {
        used: metrics.memory.used,
        free: metrics.memory.free,
        total: metrics.memory.total,
        usagePercentage: Math.round((metrics.memory.used / metrics.memory.total) * 100)
      },
      database: {
        queriesPerSecond: this.calculateQueriesPerSecond(),
        averageQueryTime: metrics.database.averageQueryTime,
        slowQueryRate: this.calculateSlowQueryRate()
      }
    };
  }

  /**
   * Calculer les requêtes par seconde
   */
  calculateRequestsPerSecond() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.metrics.requests.responseTimes.filter(
      req => req.timestamp > oneMinuteAgo
    );
    
    return recentRequests.length / 60; // requêtes par seconde
  }

  /**
   * Calculer le taux d'erreur
   */
  calculateErrorRate() {
    if (this.metrics.requests.total === 0) return 0;
    return (this.metrics.requests.errors / this.metrics.requests.total) * 100;
  }

  /**
   * Calculer les requêtes de base de données par seconde
   */
  calculateQueriesPerSecond() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentQueries = this.metrics.database.queryTimes.filter(
      query => query.timestamp > oneMinuteAgo
    );
    
    return recentQueries.length / 60;
  }

  /**
   * Calculer le taux de requêtes lentes
   */
  calculateSlowQueryRate() {
    if (this.metrics.database.queries === 0) return 0;
    return (this.metrics.database.slowQueries / this.metrics.database.queries) * 100;
  }

  /**
   * Réinitialiser les métriques
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: {},
        byMethod: {},
        responseTimes: []
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      database: {
        queries: 0,
        slowQueries: 0,
        averageQueryTime: 0,
        queryTimes: []
      },
      memory: {
        used: 0,
        free: 0,
        total: 0
      },
      uptime: {
        startTime: Date.now(),
        current: 0
      }
    };
    
    this.startTime = Date.now();
    logger.info('Metrics reset');
  }

  /**
   * Logger les métriques de performance
   */
  logPerformanceMetrics() {
    const perf = this.getPerformanceMetrics();
    
    logger.info('Performance Metrics:', {
      requestsPerSecond: perf.requestsPerSecond.toFixed(2),
      averageResponseTime: perf.averageResponseTime.toFixed(2) + 'ms',
      errorRate: perf.errorRate.toFixed(2) + '%',
      cacheHitRate: perf.cacheHitRate.toFixed(2) + '%',
      memoryUsage: perf.memoryUsage.usagePercentage + '%',
      databaseQueriesPerSecond: perf.database.queriesPerSecond.toFixed(2),
      slowQueryRate: perf.database.slowQueryRate.toFixed(2) + '%'
    });
  }
}

// Instance singleton
const metricsService = new MetricsService();

module.exports = metricsService;
