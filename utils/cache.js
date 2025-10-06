const logger = require('./logger');

/**
 *
 */
class MemoryCache {
  /**
   *
   * @example
   */
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  // Générer une clé de cache basée sur les paramètres
  /**
   *
   * @param prefix
   * @param params
   * @example
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  // Vérifier si le cache est valide
  /**
   *
   * @param key
   * @param ttl
   * @example
   */
  isValid(key, ttl = 300000) { // 5 minutes par défaut
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < ttl;
  }

  // Obtenir une valeur du cache
  /**
   *
   * @param key
   * @example
   */
  get(key) {
    if (this.isValid(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }
    this.stats.misses++;
    return null;
  }

  // Définir une valeur dans le cache
  /**
   *
   * @param key
   * @param value
   * @param ttl
   * @example
   */
  set(key, value, ttl = 300000) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.stats.sets++;

    // Nettoyer automatiquement après TTL
    setTimeout(() => {
      this.delete(key);
    }, ttl);
  }

  // Supprimer une clé
  /**
   *
   * @param key
   * @example
   */
  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    this.stats.deletes++;
  }

  // Vider tout le cache
  /**
   *
   * @example
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
    logger.info('Cache vidé');
  }

  // Obtenir les statistiques
  /**
   *
   * @example
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) * 100
    };
  }

  // Nettoyer les entrées expirées
  /**
   *
   * @example
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > 300000) { // 5 minutes
        this.delete(key);
      }
    }
  }
}

// Cache global pour l'application
const globalCache = new MemoryCache();

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
  globalCache.cleanup();
}, 5 * 60 * 1000);

module.exports = globalCache;
