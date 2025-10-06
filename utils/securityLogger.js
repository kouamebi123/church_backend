const logger = require('./logger');

/**
 *
 */
class SecurityLogger {
  /**
   *
   * @example
   */
  constructor() {
    this.securityEvents = [];
    this.maxEvents = 1000; // Garder seulement les 1000 derniers événements
  }

  // Log des tentatives de connexion
  /**
   *
   * @param userId
   * @param username
   * @param ip
   * @param success
   * @param reason
   * @example
   */
  logLoginAttempt(userId, username, ip, success, reason = '') {
    const event = {
      type: 'LOGIN_ATTEMPT',
      userId,
      username,
      ip,
      success,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent()
    };

    this.logSecurityEvent(event);

    if (success) {
      logger.info(`🔐 Connexion réussie: ${username} (${ip})`);
    } else {
      logger.warn(`🚨 Tentative de connexion échouée: ${username} (${ip}) - ${reason}`);
    }
  }

  // Log des tentatives d'accès non autorisé
  /**
   *
   * @param userId
   * @param username
   * @param ip
   * @param endpoint
   * @param method
   * @param reason
   * @example
   */
  logUnauthorizedAccess(userId, username, ip, endpoint, method, reason) {
    const event = {
      type: 'UNAUTHORIZED_ACCESS',
      userId,
      username,
      ip,
      endpoint,
      method,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent()
    };

    this.logSecurityEvent(event);
    logger.warn(`🚨 Accès non autorisé: ${username} (${ip}) - ${method} ${endpoint} - ${reason}`);
  }

  // Log des changements de rôle
  /**
   *
   * @param adminId
   * @param adminUsername
   * @param targetUserId
   * @param targetUsername
   * @param oldRole
   * @param newRole
   * @example
   */
  logRoleChange(adminId, adminUsername, targetUserId, targetUsername, oldRole, newRole) {
    const event = {
      type: 'ROLE_CHANGE',
      adminId,
      adminUsername,
      targetUserId,
      targetUsername,
      oldRole,
      newRole,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent()
    };

    this.logSecurityEvent(event);
    logger.info(`🔐 Changement de rôle: ${adminUsername} a changé ${targetUsername} de ${oldRole} vers ${newRole}`);
  }

  // Log des suppressions d'utilisateurs
  /**
   *
   * @param adminId
   * @param adminUsername
   * @param targetUserId
   * @param targetUsername
   * @param reason
   * @example
   */
  logUserDeletion(adminId, adminUsername, targetUserId, targetUsername, reason) {
    const event = {
      type: 'USER_DELETION',
      adminId,
      adminUsername,
      targetUserId,
      targetUsername,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent()
    };

    this.logSecurityEvent(event);
    logger.warn(`🗑️ Suppression d'utilisateur: ${adminUsername} a supprimé ${targetUsername} - ${reason}`);
  }

  // Log des tentatives de rate limiting
  /**
   *
   * @param ip
   * @param endpoint
   * @param method
   * @param count
   * @example
   */
  logRateLimitExceeded(ip, endpoint, method, count) {
    const event = {
      type: 'RATE_LIMIT_EXCEEDED',
      ip,
      endpoint,
      method,
      count,
      timestamp: new Date().toISOString()
    };

    this.logSecurityEvent(event);
    logger.warn(`🚫 Rate limit dépassé: ${ip} - ${method} ${endpoint} (${count} requêtes)`);
  }

  // Log des erreurs de validation JWT
  /**
   *
   * @param token
   * @param ip
   * @param error
   * @example
   */
  logJWTError(token, ip, error) {
    const event = {
      type: 'JWT_ERROR',
      token: token ? `${token.substring(0, 20)}...` : 'null',
      ip,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    this.logSecurityEvent(event);
    logger.warn(`🔑 Erreur JWT: ${ip} - ${error.message}`);
  }

  // Log des tentatives de modification de données sensibles
  /**
   *
   * @param userId
   * @param username
   * @param ip
   * @param endpoint
   * @param method
   * @param dataType
   * @example
   */
  logSensitiveDataModification(userId, username, ip, endpoint, method, dataType) {
    const event = {
      type: 'SENSITIVE_DATA_MODIFICATION',
      userId,
      username,
      ip,
      endpoint,
      method,
      dataType,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent()
    };

    this.logSecurityEvent(event);
    logger.info(`🔒 Modification de données sensibles: ${username} (${ip}) - ${method} ${endpoint} - ${dataType}`);
  }

  // Log des événements de sécurité génériques
  /**
   *
   * @param event
   * @example
   */
  logSecurityEvent(event) {
    this.securityEvents.push(event);

    // Garder seulement les derniers événements
    if (this.securityEvents.length > this.maxEvents) {
      this.securityEvents.shift();
    }
  }

  // Obtenir les statistiques de sécurité
  /**
   *
   * @example
   */
  getSecurityStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = this.securityEvents.filter(event =>
      new Date(event.timestamp) > last24h
    );

    const stats = {
      totalEvents: this.securityEvents.length,
      events24h: recentEvents.length,
      loginAttempts: recentEvents.filter(e => e.type === 'LOGIN_ATTEMPT').length,
      failedLogins: recentEvents.filter(e => e.type === 'LOGIN_ATTEMPT' && !e.success).length,
      unauthorizedAccess: recentEvents.filter(e => e.type === 'UNAUTHORIZED_ACCESS').length,
      rateLimitExceeded: recentEvents.filter(e => e.type === 'RATE_LIMIT_EXCEEDED').length,
      jwtErrors: recentEvents.filter(e => e.type === 'JWT_ERROR').length,
      roleChanges: recentEvents.filter(e => e.type === 'ROLE_CHANGE').length,
      userDeletions: recentEvents.filter(e => e.type === 'USER_DELETION').length,
      sensitiveModifications: recentEvents.filter(e => e.type === 'SENSITIVE_DATA_MODIFICATION').length
    };

    return stats;
  }

  // Obtenir les événements de sécurité récents
  /**
   *
   * @param limit
   * @example
   */
  getRecentSecurityEvents(limit = 50) {
    return this.securityEvents
      .slice(-limit)
      .reverse();
  }

  // Nettoyer les anciens événements
  /**
   *
   * @param daysToKeep
   * @example
   */
  cleanupOldEvents(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.securityEvents = this.securityEvents.filter(event =>
      new Date(event.timestamp) > cutoffDate
    );
  }

  // Obtenir l'user agent (pour le contexte)
  /**
   *
   * @example
   */
  getUserAgent() {
    // Cette fonction sera appelée dans le contexte d'une requête HTTP
    // L'user agent sera passé depuis le middleware
    return 'Unknown';
  }

  // Middleware pour enrichir les logs avec le contexte de la requête
  /**
   *
   * @param req
   * @example
   */
  enrichWithRequestContext(req) {
    return {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      username: req.user?.username
    };
  }
}

// Instance singleton
const securityLogger = new SecurityLogger();

module.exports = securityLogger;
