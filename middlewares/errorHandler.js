/**
 * 🛡️ Gestionnaire d'erreurs ultra-robuste
 * Optimisé pour haute charge et gestion d'erreurs avancée
 */

const logger = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');

/**
 * Gestionnaire d'erreurs principal ultra-robuste
 * @param {Error} error - L'erreur à gérer
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction suivante
 */
const handleError = (error, req, res, next) => {
  // Enrichir le contexte de l'erreur
  const errorContext = {
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.id || 'unknown'
  };

  // Classification des erreurs pour une gestion optimisée
  let errorType = 'UNKNOWN';
  let statusCode = 500;
  let userMessage = 'Une erreur interne s\'est produite';
  let shouldLog = true;
  let shouldAlert = false;

  // Gestion optimisée par type d'erreur
  switch (error.name) {
    case 'ValidationError':
      errorType = 'VALIDATION';
      statusCode = 400;
      userMessage = 'Données de validation invalides';
      shouldLog = false; // Pas de log pour les erreurs de validation
      break;

    case 'UnauthorizedError':
    case 'JsonWebTokenError':
      errorType = 'AUTH';
      statusCode = 401;
      userMessage = 'Authentification requise';
      shouldAlert = true; // Alerte pour les erreurs d'auth
      break;

    case 'TokenExpiredError':
      errorType = 'AUTH_EXPIRED';
      statusCode = 401;
      userMessage = 'Session expirée, veuillez vous reconnecter';
      shouldAlert = true;
      break;

    case 'ForbiddenError':
      errorType = 'PERMISSION';
      statusCode = 403;
      userMessage = 'Accès interdit';
      shouldAlert = true;
      break;

    case 'NotFoundError':
      errorType = 'NOT_FOUND';
      statusCode = 404;
      userMessage = 'Ressource non trouvée';
      shouldLog = false;
      break;

    case 'ConflictError':
      errorType = 'CONFLICT';
      statusCode = 409;
      userMessage = 'Conflit de données';
      break;

    case 'RateLimitError':
      errorType = 'RATE_LIMIT';
      statusCode = 429;
      userMessage = 'Trop de requêtes, veuillez ralentir';
      shouldAlert = true;
      break;

    case 'DatabaseError':
      errorType = 'DATABASE';
      statusCode = 503;
      userMessage = 'Service temporairement indisponible';
      shouldAlert = true;
      break;

    case 'NetworkError':
      errorType = 'NETWORK';
      statusCode = 503;
      userMessage = 'Problème de connexion';
      shouldAlert = true;
      break;

    case 'TimeoutError':
      errorType = 'TIMEOUT';
      statusCode = 408;
      userMessage = 'Requête expirée';
      break;

    default:
      // Analyse intelligente des erreurs non classifiées
      if (error.message?.includes('timeout')) {
        errorType = 'TIMEOUT';
        statusCode = 408;
        userMessage = 'Requête expirée';
      } else if (error.message?.includes('ECONNREFUSED')) {
        errorType = 'DATABASE';
        statusCode = 503;
        userMessage = 'Service temporairement indisponible';
        shouldAlert = true;
      } else if (error.message?.includes('ENOTFOUND')) {
        errorType = 'NETWORK';
        statusCode = 503;
        userMessage = 'Problème de connexion';
        shouldAlert = true;
      }
      break;
  }

  // Logging intelligent et optimisé
  if (shouldLog) {
    const logData = {
      errorType,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      context: errorContext,
      severity: shouldAlert ? 'HIGH' : 'MEDIUM'
    };

    if (shouldAlert) {
      logger.error('🚨 ERREUR CRITIQUE', logData);
      securityLogger.logSecurityEvent(
        req.user?.id,
        req.user?.username,
        req.ip,
        req.originalUrl,
        req.method,
        `Erreur ${errorType}: ${error.message}`
      );
    } else {
      logger.warn(`⚠️ Erreur ${errorType}`, logData);
    }
  }

  // Réponse utilisateur optimisée
  const response = {
    success: false,
    error: {
      type: errorType,
      message: userMessage,
      code: statusCode,
      requestId: errorContext.requestId
    }
  };

  // Ajouter des détails en développement
  if (process.env.NODE_ENV === 'development') {
    response.error.details = {
      originalMessage: error.message,
      stack: error.stack?.split('\n').slice(0, 3) // 3 premières lignes seulement
    };
  }

  // En-têtes de sécurité
  res.set({
    'X-Error-Type': errorType,
    'X-Request-ID': errorContext.requestId,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  // Réponse finale
  res.status(statusCode).json(response);
};

/**
 * Gestionnaire d'erreurs asynchrone pour les contrôleurs
 * @param {Function} fn - Fonction asynchrone à wrapper
 * @returns {Function} - Fonction wrapper avec gestion d'erreur
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Gestionnaire d'erreurs pour les timeouts
 * @param {number} timeout - Timeout en millisecondes
 * @returns {Function} - Middleware de timeout
 */
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      error.statusCode = 408;
      next(error);
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
};

/**
 * Gestionnaire d'erreurs pour les requêtes malformées
 */
const malformedRequestHandler = (req, res, next) => {
  if (req.headers['content-type'] && !req.headers['content-type'].includes('application/json')) {
    const error = new Error('Content-Type non supporté');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }
  next();
};

/**
 * Gestionnaire d'erreurs pour les requêtes trop volumineuses
 * @param {number} maxSize - Taille maximale en bytes
 * @returns {Function} - Middleware de validation de taille
 */
const requestSizeHandler = (maxSize = 10 * 1024 * 1024) => { // 10MB par défaut
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      const error = new Error('Requête trop volumineuse');
      error.name = 'ValidationError';
      error.statusCode = 413;
      return next(error);
    }
    next();
  };
};

module.exports = {
  handleError,
  asyncHandler,
  timeoutHandler,
  malformedRequestHandler,
  requestSizeHandler
};
