const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { injectPrisma } = require('./config/dbPostgres');
const logger = require('./utils/logger');

// Force redeploy for calendar system
const securityLogger = require('./utils/securityLogger');
const socketService = require('./services/socketService');
// Services optionnels - gérer l'absence de Redis
let redisService, metricsService;
try {
  redisService = require('./services/redisService');
  metricsService = require('./services/metricsService');
} catch (error) {
  // console.warn('Services optionnels non disponibles:', error.message);
  redisService = null;
  metricsService = null;
}
const {
  requestLogger,
  errorLogger,
  slowRequestLogger,
  unauthorizedAccessLogger,
  databaseLogger,
  authLogger,
  csrfLogger
} = require('./middlewares/requestLogger');
const prismaLogger = require('./middlewares/prismaLogger');
const csrfProtection = require('./middlewares/csrfProtection');
const securityHeaders = require('./middlewares/securityHeaders');
require('dotenv').config();

const app = express();
// Derrière un proxy/Load Balancer (X-Forwarded-For) pour un rate limit fiable
app.set('trust proxy', 1);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Optimisation du pool de connexions pour haute charge
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Pool de connexions optimisé
  __internal: {
    engine: {
      connectionLimit: 50, // Limite de connexions par worker
      pool: {
        min: 4,
        max: 30,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    }
  }
});

// Configuration CORS - DOIT être avant helmet et rate limiting
const allowedOrigins = [
  'http://localhost:3000', // Développement direct
  'http://localhost', // Production via nginx
  'http://localhost:8080', // Port Swagger UI
  'https://multitudeszno.up.railway.app', // Railway frontend
  'https://churchbackend-production.up.railway.app', // Railway backend
  'https://web-production-f5a55.up.railway.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (comme les apps mobiles ou Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS Error: Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-CSRF-Token' // Ajout du header CSRF
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-CSRF-Token'], // Exposer le header CSRF
  maxAge: 86400, // 24 heures
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Appliquer CORS AVANT tout autre middleware
app.use(cors(corsOptions));

// Gestion explicite des requêtes OPTIONS (preflight)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-CSRF-Token');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.status(200).end();
  } else {
    res.status(403).json({ error: 'Origin not allowed by CORS' });
  }
});


// Security middleware (après CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Désactivé car géré par securityHeaders
}));

// Headers de sécurité ultra-stricts
app.use(securityHeaders);


// Middleware de protection supprimé
app.use((req, res, next) => {
  return next();
});


// Rate limiting - Configuration équilibrée pour la sécurité et l'usage normal
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // limite chaque IP à 200 requêtes par minute (augmenté pour la messagerie)
  message: {
    success: false,
    message: '🚫 Rate limit dépassé: Trop de requêtes depuis cette IP'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    // Logger la tentative d'attaque
    const context = securityLogger.enrichWithRequestContext(req);
    securityLogger.logRateLimitExceeded(context.ip, context.endpoint, context.method, req.rateLimit.current);

    res.status(429).json({
      success: false,
      message: '🚫 Rate limit dépassé: Trop de requêtes depuis cette IP',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting spécial pour l'authentification (sécurisé mais utilisable)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 tentatives de connexion par 15 minutes
  message: {
    success: false,
    message: '🚫 Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne pas compter les connexions réussies
  skipFailedRequests: false,
  handler: (req, res) => {
    const context = securityLogger.enrichWithRequestContext(req);
    securityLogger.logUnauthorizedAccess(
      null, null, context.ip, context.endpoint, context.method,
      'Rate limit authentification dépassé'
    );

    res.status(429).json({
      success: false,
      message: '🚫 Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Compression middleware (AVANT parsing pour optimiser)
app.use(compression({
  level: 6, // Niveau de compression équilibré
  threshold: 1024, // Compresser seulement si > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === MIDDLEWARES DE LOGGING COMPLET ===
app.use(requestLogger);                    // Logging de toutes les requêtes/réponses
app.use(slowRequestLogger(2000));         // Détection des requêtes lentes (>2s)
app.use(unauthorizedAccessLogger);        // Logging des accès non autorisés
app.use(authLogger);                      // Logging des authentifications

// Timeout pour les requêtes lourdes (30 secondes)
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// Injecter Prisma dans req (PostgreSQL obligatoire)
app.use(injectPrisma);

// Servir les fichiers statiques avec CORS pour les images
app.use('/uploads', cors({
  origin: ['http://localhost:3000', 'http://localhost', 'https://multitudeszno.up.railway.app'],
  credentials: false
}), express.static(path.join(__dirname, 'uploads')));

// Servir spécifiquement les fichiers de témoignages
app.use('/uploads/testimonies', cors({
  origin: ['http://localhost:3000', 'http://localhost', 'https://multitudeszno.up.railway.app'],
  credentials: false
}), express.static(path.join(__dirname, 'uploads/testimonies')));

// Routes publiques (AVANT le rate limiting)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ Serveur Church opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Endpoint de santé simple pour Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Endpoint de santé avec base de données (pour monitoring avancé)
app.get('/api/health/db', async (req, res) => {
  try {
    await prisma.$connect();
    res.json({
      success: true,
      message: '✅ Serveur Church PostgreSQL opérationnel',
      database: 'PostgreSQL + Prisma',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Erreur de connexion PostgreSQL:', error);
    res.status(500).json({
      success: false,
      message: '❌ Erreur de connexion PostgreSQL',
      error: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : error.message
    });
  }
});

// Route de statistiques du cache (pour monitoring)
app.get('/api/cache/stats', (req, res) => {
  try {
    const cache = require('./utils/cache');
    const stats = cache.getStats();

    res.json({
      success: true,
      message: '📊 Statistiques du cache',
      data: {
        ...stats,
        // Informations système masquées en production
        uptime: process.env.NODE_ENV === 'production' ? 'Masqué' : process.uptime(),
        memory: process.env.NODE_ENV === 'production' ? 'Masqué' : process.memoryUsage(),
        cpu: process.env.NODE_ENV === 'production' ? 'Masqué' : process.cpuUsage(),
        workers: process.env.NODE_ENV === 'production' ? 'Masqué' : (require('cluster').isMaster ? require('os').cpus().length : 'worker')
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des stats du cache:', error);
    res.status(500).json({
      success: false,
      message: '❌ Erreur lors de la récupération des statistiques'
    });
  }
});

// MAINTENANT appliquer le rate limiting APRÈS les routes publiques
app.use('/api/', limiter);

// Rate limiting spécial pour l'authentification
app.use('/api/auth', authLimiter);

// Endpoint de santé
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisService ? redisService.isConnected : false,
    metrics: metricsService ? 'available' : 'unavailable'
  });
});

// Routes (le middleware protect est appliqué dans chaque route)
try {
  app.use('/api', require('./routes'));
  logger.startup('✅ Routes principales chargées');
} catch (error) {
  logger.error('❌ Erreur lors du chargement des routes principales:', error);
}

// Route d'urgence pour créer un super admin (sans authentification)
try {
  app.use('/api/emergency', require('./routes/emergency'));
  logger.startup('✅ Route emergency chargée');
} catch (error) {
  logger.error('❌ Erreur lors du chargement de la route emergency:', error);
}

// Routes email (avec authentification)
try {
  app.use('/api/email', require('./routes/email'));
  logger.startup('✅ Route email chargée');
} catch (error) {
  logger.error('❌ Erreur lors du chargement de la route email:', error);
}

// Routes préférences (avec authentification)
try {
  app.use('/api/preferences', require('./routes/preferences'));
  logger.startup('✅ Route preferences chargée');
} catch (error) {
  logger.error('❌ Erreur lors du chargement de la route preferences:', error);
}

// === LOGGING PRISMA APRÈS AUTHENTIFICATION ===
app.use(prismaLogger);                    // Logging détaillé des opérations Prisma (après auth)

// Error handling middleware avec logging complet
app.use(errorLogger);

app.use((err, req, res, next) => {
  // Logger l'erreur complète côté serveur
  logger.error('Erreur serveur:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Gestion spécifique des erreurs CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Origine non autorisée par CORS'
    });
  }

  // Ne JAMAIS exposer les détails d'erreur en production
  const errorMessage = process.env.NODE_ENV === 'production'
    ? 'Une erreur interne s\'est produite. Veuillez réessayer plus tard.'
    : `Erreur: ${err.message}`;

  // Masquer les informations sensibles
  const sanitizedError = {
    success: false,
    error: errorMessage,
    // En développement uniquement
    ...(process.env.NODE_ENV !== 'production' && {
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    })
  };

  res.status(500).json(sanitizedError);
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée '
  });
});

const PORT = process.env.PORT || 5001;

// Créer le serveur HTTP
const server = http.createServer(app);

// Initialiser Socket.IO
socketService.initialize(server);

// Démarrer le serveur avec gestion d'erreur
try {
  server.listen(PORT, () => {
    logger.startup(`🚀 Serveur Church PostgreSQL démarré sur le port ${PORT}`);
    logger.startup('🗄️ Base de données: PostgreSQL + Prisma');
    logger.startup('🔌 Socket.IO activé pour la messagerie en temps réel');
    logger.startup(`🌐 URL: http://localhost:${PORT}`);
    logger.startup(`🔒 CORS activé pour: ${corsOptions.origin}`);
  });

  server.on('error', (err) => {
    logger.error('❌ Erreur du serveur:', err);
    process.exit(1);
  });
} catch (error) {
  logger.error('❌ Erreur lors du démarrage du serveur:', error);
  process.exit(1);
}

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
  logger.info('🛑 Arrêt du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Arrêt du serveur...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { name: err.name, message: err.message });
  process.exit(1);
});

