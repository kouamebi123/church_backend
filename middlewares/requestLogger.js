const logger = require('../utils/logger');

/**
 * Middleware de logging optimisé pour la production
 * Réduit la verbosité pour éviter le rate limit Railway
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Contexte de la requête
  const context = {
    requestId,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer
  };

  // Log de la requête entrante seulement pour les erreurs et les requêtes importantes
  if (process.env.NODE_ENV === 'development' || req.path.includes('/api/') && !req.path.includes('/uploads/')) {
    logger.request(req, context);
  }

  // Intercepter la réponse pour la logger
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  let responseData = null;
  let statusCode = 200;

  // Override res.status pour capturer le code de statut
  res.status = function(code) {
    statusCode = code;
    return originalStatus.apply(this, arguments);
  };

  // Override res.send pour capturer la réponse
  res.send = function(data) {
    responseData = data;
    logResponse();
    return originalSend.apply(this, arguments);
  };

  // Override res.json pour capturer la réponse JSON
  res.json = function(data) {
    responseData = data;
    logResponse();
    return originalJson.apply(this, arguments);
  };

  // Fonction pour logger la réponse
  const logResponse = () => {
    const duration = Date.now() - startTime;
    
    // Log seulement les erreurs et les requêtes importantes en production
    if (process.env.NODE_ENV === 'development' || statusCode >= 400 || req.path.includes('/api/') && !req.path.includes('/uploads/')) {
      // Log de la réponse
      logger.response(res, responseData, {
        ...context,
        duration,
        statusCode
      });

      // Log des performances
      logger.performance(`${req.method} ${req.path}`, duration, {
        requestId,
        statusCode,
        responseSize: responseData ? JSON.stringify(responseData).length : 0
      }, context);

      // Log de succès ou d'échec
      if (statusCode >= 200 && statusCode < 400) {
        logger.info(`✅ ${req.method} ${req.path} - Succès`, {
          statusCode,
          duration: `${duration}ms`,
          requestId
        }, context);
      } else {
        logger.warn(`⚠️  ${req.method} ${req.path} - Échec`, {
          statusCode,
          duration: `${duration}ms`,
          requestId
        }, context);
      }
    }
  };

  // Gestion des erreurs
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    logger.httpError(error, req, {
      ...context,
      duration
    });
  });

  // Log de fin de requête (fallback si pas de réponse)
  res.on('finish', () => {
    if (!responseData) {
      const duration = Date.now() - startTime;
      logResponse();
    }
  });

  next();
};

/**
 * Middleware de logging des erreurs globales
 */
const errorLogger = (error, req, res, next) => {
  const context = {
    requestId: req.headers['x-request-id'] || generateRequestId(),
    timestamp: new Date().toISOString(),
    user: req.user ? { id: req.user.id, username: req.user.username } : null
  };

  // Log détaillé de l'erreur
  logger.httpError(error, req, context);

  // Log des détails de l'erreur
  logger.error('🚨 Erreur serveur détaillée', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode || 500,
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: req.headers
    }
  }, context);

  next(error);
};

/**
 * Middleware de logging des requêtes lentes
 */
const slowRequestLogger = (threshold = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        logger.warn(`🐌 Requête lente détectée: ${req.method} ${req.path}`, {
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          user: req.user ? { id: req.user.id, username: req.user.username } : null,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    next();
  };
};

/**
 * Middleware de logging des tentatives d'accès non autorisées
 */
const unauthorizedAccessLogger = (req, res, next) => {
  // Intercepter les erreurs 401/403
  const originalStatus = res.status;
  
  res.status = function(code) {
    if (code === 401 || code === 403) {
      logger.warn(`🚫 Accès non autorisé: ${req.method} ${req.path}`, {
        statusCode: code,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        authorization: req.headers.authorization ? '[PRESENT]' : '[ABSENT]',
        csrfToken: '[SUPPRIMÉ]',
        user: req.user ? { id: req.user.id, username: req.user.username } : null,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalStatus.apply(this, arguments);
  };
  
  next();
};

/**
 * Middleware de logging des opérations de base de données
 */
const databaseLogger = (req, res, next) => {
  // Intercepter les requêtes Prisma
  if (global.prisma) {
    const originalQuery = global.prisma.$queryRaw;
    const originalExecute = global.prisma.$executeRaw;
    
    global.prisma.$queryRaw = function(...args) {
      const startTime = Date.now();
      const query = args[0];
      const params = args.slice(1);
      
      logger.database('QUERY', query, params, null, {
        requestId: req.headers['x-request-id'] || generateRequestId(),
        path: req.path,
        method: req.method
      });
      
      return originalQuery.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('QUERY_COMPLETE', query, params, duration, {
          requestId: req.headers['x-request-id'] || generateRequestId(),
          path: req.path,
          method: req.method
        });
      });
    };
    
    global.prisma.$executeRaw = function(...args) {
      const startTime = Date.now();
      const query = args[0];
      const params = args.slice(1);
      
      logger.database('EXECUTE', query, params, null, {
        requestId: req.headers['x-request-id'] || generateRequestId(),
        path: req.path,
        method: req.method
      });
      
      return originalExecute.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('EXECUTE_COMPLETE', query, params, duration, {
          requestId: req.headers['x-request-id'] || generateRequestId(),
          path: req.path,
          method: req.method
        });
      });
    };
  }
  
  next();
};

/**
 * Middleware de logging des opérations d'authentification
 */
const authLogger = (req, res, next) => {
  // Log de l'authentification réussie
  if (req.user) {
    logger.auth('AUTH_SUCCESS', req.user, true, {
      requestId: req.headers['x-request-id'] || generateRequestId(),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Middleware de logging des opérations CSRF
 */
const csrfLogger = (req, res, next) => {
  next();
};

/**
 * Génère un ID unique pour chaque requête
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  requestLogger,
  errorLogger,
  slowRequestLogger,
  unauthorizedAccessLogger,
  databaseLogger,
  authLogger,
  csrfLogger
};
