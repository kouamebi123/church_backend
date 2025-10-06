const fs = require('fs');
const path = require('path');

/**
 * Logger intelligent pour l'application Church
 * Ne crée des fichiers que pour les informations pertinentes :
 * - Connexion à la base de données
 * - Démarrage des services
 * - Erreurs critiques
 */
class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
    this.maxLogSize = 5 * 1024 * 1024; // 5MB max par fichier
    this.maxLogFiles = 7; // Garder seulement 7 jours de logs
    
    // Types de logs qui méritent un fichier
    this.fileWorthyLevels = new Set([
      'startup',      // Démarrage des services
      'database',     // Connexion base de données
      'error',        // Erreurs critiques
      'security'      // Incidents de sécurité
    ]);
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName(level = 'app') {
    const date = new Date().toISOString().split('T')[0];
    return `${level}-${date}.log`;
  }

  formatMessage(level, message, data = null, context = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (context) {
      logEntry += ` | Context: ${JSON.stringify(context)}`;
    }

    if (data) {
      if (typeof data === 'object') {
        try {
          logEntry += ` | Data: ${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          logEntry += ` | Data: [Object - JSON.stringify failed: ${e.message}]`;
        }
      } else {
        logEntry += ` | Data: ${data}`;
      }
    }

    return logEntry;
  }

  writeToFile(message, level = 'app') {
    // Ne créer un fichier que pour les niveaux importants
    if (!this.fileWorthyLevels.has(level)) {
      // Log uniquement en console pour les autres niveaux
      console.log(message);
      return;
    }
    
    const logFile = path.join(this.logDir, this.getLogFileName(level));
    
    try {
      // Vérifier la taille du fichier et le faire pivoter si nécessaire
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > this.maxLogSize) {
        this.rotateLogFile(logFile);
      }
      
      fs.appendFileSync(logFile, `${message}\n`);
      console.log(message); // Afficher aussi en console
    } catch (error) {
      console.error('Erreur lors de l\'écriture du log:', error);
    }
  }

  rotateLogFile(logFile) {
    try {
      const backupFile = `${logFile}.${Date.now()}`;
      fs.renameSync(logFile, backupFile);
      
      // Nettoyer les anciens fichiers de log
      this.cleanOldLogs();
    } catch (error) {
      //console.error('Erreur lors de la rotation du fichier de log:', error);
    }
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      if (logFiles.length > this.maxLogFiles) {
        const sortedFiles = logFiles
          .map(file => ({ name: file, path: path.join(this.logDir, file) }))
          .sort((a, b) => fs.statSync(a.path).mtime.getTime() - fs.statSync(b.path).mtime.getTime());
        
        // Supprimer les fichiers les plus anciens
        const filesToDelete = sortedFiles.slice(0, logFiles.length - this.maxLogFiles);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      //console.error('Erreur lors du nettoyage des anciens logs:', error);
    }
  }

  // === LOGGING STANDARD ===
  info(message, data = null, context = null) {
    const logMessage = this.formatMessage('info', message, data, context);
    console.log(`ℹ️  ${message}`, data || '');
    // Pas de fichier pour les infos générales
  }

  error(message, data = null, context = null) {
    const logMessage = this.formatMessage('error', message, data, context);
    this.writeToFile(logMessage, 'error'); // Fichier pour les erreurs
    console.error(`❌ ${message}`, data || '');
  }

  warn(message, data = null, context = null) {
    const logMessage = this.formatMessage('warn', message, data, context);
    console.warn(`⚠️  ${message}`, data || '');
    // Pas de fichier pour les warnings
  }

  debug(message, data = null, context = null) {
    const logMessage = this.formatMessage('debug', message, data, context);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${message}`, data || '');
    }
    // Pas de fichier pour les debug
  }

  // === LOGGING SPÉCIALISÉ POUR FICHIERS ===
  
  // Démarrage des services
  startup(message, data = null, context = null) {
    const logMessage = this.formatMessage('startup', message, data, context);
    this.writeToFile(logMessage, 'startup');
    console.log(`🚀 ${message}`, data || '');
  }

  // Connexion base de données
  database(operation, query, params = null, duration = null, context = null) {
    const dbData = {
      operation,
      query: typeof query === 'string' ? query : JSON.stringify(query),
      params,
      duration: duration ? `${duration}ms` : null
    };

    const logMessage = this.formatMessage('database', `🗄️  DB ${operation}`, dbData, context);
    this.writeToFile(logMessage, 'database');
    console.log(`🗄️  ${operation}`, dbData);
  }

  // === LOGGING SPÉCIALISÉ (CONSOLE UNIQUEMENT) ===
  
  // Logging des requêtes HTTP (console uniquement)
  request(req, context = null) {
    const requestData = {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[PRESENT]' : '[ABSENT]',
        'csrf-token': req.headers['csrf-token'] ? '[PRESENT]' : '[ABSENT]'
      },
      ip: req.ip || req.connection.remoteAddress,
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      } : null
    };

    console.log(`📥 ${req.method} ${req.path}`, requestData);
    // Pas de fichier pour les requêtes
  }

  // Logging des réponses HTTP (console uniquement)
  response(res, data = null, context = null) {
    const responseData = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage
    };

    console.log(`📤 Response ${res.statusCode}`, responseData);
    // Pas de fichier pour les réponses
  }

  // Logging des erreurs HTTP (fichier pour les erreurs)
  httpError(error, req, context = null) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        user: req.user ? { id: req.user.id, username: req.user.username } : null
      }
    };

    const logMessage = this.formatMessage('http_error', `💥 HTTP Error ${errorData.statusCode}`, errorData, context);
    this.writeToFile(logMessage, 'error'); // Fichier pour les erreurs
    console.error(`💥 HTTP Error ${errorData.statusCode}`, errorData);
  }

  // Logging des opérations d'authentification (console uniquement)
  auth(operation, user = null, success = true, context = null) {
    const authData = {
      operation,
      success,
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.role
      } : null
    };

    console.log(`🔐 Auth ${operation}`, authData);
    // Pas de fichier pour l'auth
  }

  // Logging des opérations CSRF (fichier pour la sécurité)
  csrf(operation, token = null, success = true, context = null) {
    const csrfData = {
      operation,
      success,
      token: token ? '[PRESENT]' : '[ABSENT]'
    };

    const logMessage = this.formatMessage('csrf', `🛡️  CSRF ${operation}`, csrfData, context);
    this.writeToFile(logMessage, 'security');
    console.log(`🛡️  CSRF ${operation}`, csrfData);
  }

  // Logging des opérations de cache (console uniquement)
  cache(operation, key = null, hit = null, context = null) {
    const cacheData = {
      operation,
      key,
      hit
    };

    console.log(`💾 Cache ${operation}`, cacheData);
    // Pas de fichier pour le cache
  }

  // Logging des performances (console uniquement)
  performance(operation, duration, details = null, context = null) {
    const perfData = {
      operation,
      duration: `${duration}ms`,
      details
    };

    console.log(`⚡ ${operation}`, perfData);
    // Pas de fichier pour les performances
  }

  // Logging des opérations de fichier (console uniquement)
  file(operation, filename = null, size = null, context = null) {
    const fileData = {
      operation,
      filename,
      size: size ? `${size} bytes` : null
    };

    console.log(`📁 File ${operation}`, fileData);
    // Pas de fichier pour les fichiers
  }
}

module.exports = new Logger();
