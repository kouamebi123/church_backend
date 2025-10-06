const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Instance Prisma globale
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // En développement, réutilise l'instance si elle existe
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error']
    });
  }
  prisma = global.prisma;
}

// Fonction de test de connexion
/**
 *
 * @example
 */
async function testConnection() {
  try {
    await prisma.$connect();
    logger.info('Connexion PostgreSQL réussie via Prisma');
    return true;
  } catch (error) {
    logger.error('Erreur de connexion PostgreSQL:', error);
    return false;
  }
}

// Fonction de fermeture de connexion
/**
 *
 * @example
 */
async function closeConnection() {
  try {
    await prisma.$disconnect();
    logger.info('Connexion PostgreSQL fermée');
  } catch (error) {
    logger.error('Erreur lors de la fermeture de la connexion:', error);
  }
}

// Middleware pour injecter Prisma dans les requêtes
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function injectPrisma(req, res, next) {
  req.prisma = prisma;
  next();
}

module.exports = {
  prisma,
  testConnection,
  closeConnection,
  injectPrisma
};
