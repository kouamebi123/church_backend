const logger = require('../utils/logger');

/**
 * Middleware de logging complet pour Prisma
 * Intercepte toutes les opérations de base de données
 */
const prismaLogger = (req, res, next) => {
  // Stocker la requête courante globalement pour le logging CSRF
  global.currentRequest = req;
  
  // Intercepter Prisma si disponible
  if (global.prisma) {
    const originalQuery = global.prisma.$queryRaw;
    const originalExecute = global.prisma.$executeRaw;
    const originalFindMany = global.prisma.$findMany;
    const originalFindUnique = global.prisma.$findUnique;
    const originalCreate = global.prisma.$create;
    const originalUpdate = global.prisma.$update;
    const originalDelete = global.prisma.$delete;
    const originalUpsert = global.prisma.$upsert;
    const originalCreateMany = global.prisma.$createMany;
    const originalUpdateMany = global.prisma.$updateMany;
    const originalDeleteMany = global.prisma.$deleteMany;
    const originalCount = global.prisma.$count;
    const originalAggregate = global.prisma.$aggregate;
    const originalGroupBy = global.prisma.$groupBy;

    // Logging des requêtes SQL brutes
    global.prisma.$queryRaw = function(...args) {
      const startTime = Date.now();
      const query = args[0];
      const params = args.slice(1);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('QUERY_RAW', query, params, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalQuery.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('QUERY_RAW_COMPLETE', query, params, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
        
        // Log des performances
        if (duration > 1000) {
          logger.warn(`🐌 Requête SQL lente détectée: ${duration}ms`, {
            query,
            params,
            duration,
            requestId,
            path: req.path,
            method: req.method
          });
        }
      });
    };

    global.prisma.$executeRaw = function(...args) {
      const startTime = Date.now();
      const query = args[0];
      const params = args.slice(1);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('EXECUTE_RAW', query, params, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalExecute.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('EXECUTE_RAW_COMPLETE', query, params, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    // Logging des opérations CRUD
    global.prisma.$findMany = function(...args) {
      const startTime = Date.now();
      const model = this.constructor.name;
      const argsStr = JSON.stringify(args);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('FIND_MANY', `${model}.findMany`, argsStr, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalFindMany.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('FIND_MANY_COMPLETE', `${model}.findMany`, argsStr, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    global.prisma.$findUnique = function(...args) {
      const startTime = Date.now();
      const model = this.constructor.name;
      const argsStr = JSON.stringify(args);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('FIND_UNIQUE', `${model}.findUnique`, argsStr, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalFindUnique.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('FIND_UNIQUE_COMPLETE', `${model}.findUnique`, argsStr, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    global.prisma.$create = function(...args) {
      const startTime = Date.now();
      const model = this.constructor.name;
      const argsStr = JSON.stringify(args);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('CREATE', `${model}.create`, argsStr, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalCreate.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('CREATE_COMPLETE', `${model}.create`, argsStr, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    global.prisma.$update = function(...args) {
      const startTime = Date.now();
      const model = this.constructor.name;
      const argsStr = JSON.stringify(args);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('UPDATE', `${model}.update`, argsStr, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalUpdate.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('UPDATE_COMPLETE', `${model}.update`, argsStr, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    global.prisma.$delete = function(...args) {
      const startTime = Date.now();
      const model = this.constructor.name;
      const argsStr = JSON.stringify(args);
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('DELETE', `${model}.delete`, argsStr, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return originalDelete.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('DELETE_COMPLETE', `${model}.delete`, argsStr, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };

    // Logging des opérations de transaction
    global.prisma.$transaction = function(...args) {
      const startTime = Date.now();
      const operations = args[0];
      const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
      
      logger.database('TRANSACTION_START', 'Transaction', {
        operationsCount: Array.isArray(operations) ? operations.length : 1,
        operations: Array.isArray(operations) ? operations.map(op => op.constructor?.name || 'Unknown') : [operations.constructor?.name || 'Unknown']
      }, null, {
        requestId,
        path: req.path,
        method: req.method,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      });
      
      return global.prisma.$transaction.apply(this, args).finally(() => {
        const duration = Date.now() - startTime;
        logger.database('TRANSACTION_COMPLETE', 'Transaction', {
          operationsCount: Array.isArray(operations) ? operations.length : 1,
          duration
        }, duration, {
          requestId,
          path: req.path,
          method: req.method,
          user: req.user ? { id: req.user.id, username: req.user.username } : null
        });
      });
    };
  }

  next();
};

module.exports = prismaLogger;
