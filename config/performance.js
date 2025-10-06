module.exports = {
  // Configuration du cache
  cache: {
    defaultTTL: 2 * 60 * 1000, // 2 minutes
    maxSize: 1000, // Nombre maximum d'éléments en cache
    cleanupInterval: 5 * 60 * 1000 // Nettoyage toutes les 5 minutes
  },

  // Configuration de la base de données
  database: {
    connectionPool: {
      min: 5,        // Augmenté pour 300 utilisateurs
      max: 20,       // Augmenté pour 300 utilisateurs
      acquireTimeout: 30000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      idleTimeout: 30000
    },
    queryTimeout: 30000 // 30 secondes
  },

  // Configuration du rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Augmenté pour 300 utilisateurs simultanés
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // Configuration de la compression
  compression: {
    level: 6, // Niveau de compression équilibré
    threshold: 1024 // Compresser seulement si > 1KB
  },

  // Configuration des timeouts
  timeouts: {
    request: 30000, // 30 secondes
    response: 30000, // 30 secondes
    keepAlive: 5000 // 5 secondes
  },

  // Configuration du clustering
  cluster: {
    enabled: true,
    maxWorkers: 'auto', // Utiliser tous les CPU disponibles
    restartOnCrash: true
  },

  // Configuration du monitoring
  monitoring: {
    enabled: true,
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info',
    performanceMetrics: true
  }
};
