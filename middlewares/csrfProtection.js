const crypto = require('crypto');
const securityLogger = require('../utils/securityLogger');
const logger = require('../utils/logger');

// Logging détaillé des opérations CSRF
const logCSRFOperation = (req, operation, success, details = null) => {
  const context = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
    user: req.user ? { id: req.user.id, username: req.user.username } : null
  };

  logger.csrf(operation, details, success, context);
};

/**
 *
 */
class CSRFProtection {
  /**
   *
   * @example
   */
  constructor() {
    this.tokens = new Map();
    this.tokenExpiry = 24 * 60 * 60 * 1000; // 24 heures
    this.cleanupInterval = setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000); // Nettoyage toutes les heures
  }

  // Générer un token CSRF pour un utilisateur
  /**
   *
   * @param userId
   * @example
   */
  generateToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + this.tokenExpiry;

    // Supprimer l'ancien token de l'utilisateur s'il existe
    this.revokeUserTokens(userId);

    this.tokens.set(token, {
      userId,
      expiry,
      createdAt: Date.now()
    });

    
    // Logging détaillé de la génération du token
    if (global.currentRequest) {
      logCSRFOperation(global.currentRequest, 'TOKEN_GENERATED', true, token);
    }
    
    return token;
  }

  // Valider un token CSRF
  /**
   *
   * @param token
   * @param userId
   * @example
   */
  validateToken(token, userId) {
    const tokenData = this.tokens.get(token);

    if (!tokenData) {
      return { valid: false, reason: 'Token inexistant' };
    }

    if (tokenData.expiry < Date.now()) {
      this.tokens.delete(token);
      return { valid: false, reason: 'Token expiré' };
    }

    if (tokenData.userId !== userId) {
      return { valid: false, reason: 'Token utilisateur invalide' };
    }

    return { valid: true };
  }

  // Révoquer un token spécifique
  /**
   *
   * @param token
   * @example
   */
  revokeToken(token) {
    this.tokens.delete(token);
  }

  // Révoquer tous les tokens d'un utilisateur
  /**
   *
   * @param userId
   * @example
   */
  revokeUserTokens(userId) {
    for (const [token, data] of this.tokens.entries()) {
      if (data.userId === userId) {
        this.tokens.delete(token);
      }
    }
  }

  // Nettoyer les tokens expirés
  /**
   *
   * @example
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, data] of this.tokens.entries()) {
      if (data.expiry < now) {
        this.tokens.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      // Tokens CSRF expirés nettoyés
    }
  }

  // Middleware de protection CSRF
  /**
   *
   * @example
   */
  protect() {
    return (req, res, next) => {
      // Ignorer les méthodes GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Vérifier si l'utilisateur est authentifié
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentification requise pour la protection CSRF'
        });
      }

      // Récupérer le token depuis les headers
      const csrfToken = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];

      if (!csrfToken) {
        const context = securityLogger.enrichWithRequestContext(req);
        securityLogger.logUnauthorizedAccess(
          req.user.id, req.user.username, context.ip, context.endpoint, req.method,
          'Token CSRF manquant'
        );

        return res.status(403).json({
          success: false,
          message: 'Token CSRF manquant',
          code: 'CSRF_TOKEN_MISSING'
        });
      }

      // Valider le token
      const validation = this.validateToken(csrfToken, req.user.id);

      if (!validation.valid) {
        const context = securityLogger.enrichWithRequestContext(req);
        securityLogger.logUnauthorizedAccess(
          req.user.id, req.user.username, context.ip, context.endpoint, req.method,
          `Token CSRF invalide: ${validation.reason}`
        );

        // Si le token est expiré, déconnecter l'utilisateur
        if (validation.reason === 'Token expiré') {
          return res.status(401).json({
            success: false,
            message: 'Session expirée. Veuillez vous reconnecter.',
            code: 'CSRF_TOKEN_EXPIRED'
          });
        }

        return res.status(403).json({
          success: false,
          message: 'Token CSRF invalide',
          code: 'CSRF_TOKEN_INVALID'
        });
      }

      // Token valide, continuer
      next();
    };
  }

  // Middleware pour ajouter le token CSRF aux réponses
  /**
   *
   * @example
   */
  addToken() {
    return (req, res, next) => {
      if (req.user) {
        // Vérifier si l'utilisateur a déjà un token CSRF valide
        let existingToken = null;

        // Chercher un token existant pour cet utilisateur
        for (const [token, data] of this.tokens.entries()) {
          if (data.userId === req.user.id && data.expiry > Date.now()) {
            existingToken = token;
            break;
          }
        }

        // Si pas de token valide, en créer un nouveau
        if (!existingToken) {
          existingToken = this.generateToken(req.user.id);
        }

        // Ajouter le token aux headers de réponse
        res.setHeader('X-CSRF-Token', existingToken);

        // Ajouter le token au body de la réponse si c'est une API
        if (req.path.startsWith('/api/')) {
          res.locals.csrfToken = existingToken;
        }

      }
      next();
    };
  }

  // Middleware pour forcer la régénération du token CSRF
  /**
   *
   * @example
   */
  regenerateToken() {
    return (req, res, next) => {
      if (req.user) {
        const newToken = this.generateToken(req.user.id);
        res.setHeader('X-CSRF-Token', newToken);
        res.locals.csrfToken = newToken;
      }
      next();
    };
  }

  // Obtenir les statistiques des tokens CSRF
  /**
   *
   * @example
   */
  getStats() {
    const now = Date.now();
    const activeTokens = Array.from(this.tokens.values()).filter(token => token.expiry > now);

    return {
      totalTokens: this.tokens.size,
      activeTokens: activeTokens.length,
      expiredTokens: this.tokens.size - activeTokens.length,
      tokensByUser: this.getTokensByUser()
    };
  }

  // Obtenir les tokens par utilisateur
  /**
   *
   * @example
   */
  getTokensByUser() {
    const userTokens = new Map();

    for (const [token, data] of this.tokens.entries()) {
      if (data.expiry > Date.now()) {
        const count = userTokens.get(data.userId) || 0;
        userTokens.set(data.userId, count + 1);
      }
    }

    return Object.fromEntries(userTokens);
  }

  // Nettoyer tous les tokens (pour les tests)
  /**
   *
   * @example
   */
  clearAllTokens() {
    this.tokens.clear();
  }
}

// Instance singleton
const csrfProtection = new CSRFProtection();

module.exports = csrfProtection;
