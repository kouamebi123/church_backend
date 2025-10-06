const securityLogger = require('../utils/securityLogger');

// Règles de validation strictes
const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Le nom d\'utilisateur doit contenir 3-30 caractères alphanumériques, tirets ou underscores'
  },
  password: {
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial'
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Format d\'email invalide'
  },
  phone: {
    pattern: /^[\+]?[0-9\s\-\(\)]{8,}$/,
    message: 'Format de téléphone invalide'
  }
};

// Fonction de sanitisation des données
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    return data
      .trim()
      .replace(/[<>]/g, '') // Supprimer les balises HTML
      .replace(/javascript:/gi, '') // Supprimer les protocoles dangereux
      .replace(/on\w+=/gi, '') // Supprimer les événements inline
      .replace(/data:/gi, '') // Supprimer les protocoles data
      .replace(/vbscript:/gi, '') // Supprimer VBScript
      .replace(/expression\(/gi, '') // Supprimer les expressions CSS
      .replace(/url\(/gi, '') // Supprimer les URLs CSS
      .replace(/import\(/gi, '') // Supprimer les imports CSS
      .replace(/@import/gi, '') // Supprimer les imports CSS
      .replace(/eval\(/gi, '') // Supprimer eval()
      .replace(/setTimeout\(/gi, '') // Supprimer setTimeout()
      .replace(/setInterval\(/gi, ''); // Supprimer setInterval()
  }
  return data;
};

// Validation stricte des données
const validateField = (value, rule, fieldName) => {
  if (value === undefined || value === null) {
    return { isValid: false, message: `${fieldName} est requis` };
  }

  const sanitizedValue = sanitizeData(value);

  if (rule.minLength && sanitizedValue.length < rule.minLength) {
    return { isValid: false, message: `${fieldName} doit contenir au moins ${rule.minLength} caractères` };
  }

  if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
    return { isValid: false, message: `${fieldName} doit contenir au maximum ${rule.maxLength} caractères` };
  }

  if (rule.pattern && !rule.pattern.test(sanitizedValue)) {
    return { isValid: false, message: rule.message };
  }

  return { isValid: true, value: sanitizedValue };
};

// Middleware de validation des données
const validateData = (rules) => {
  return (req, res, next) => {
    const errors = [];
    const sanitizedData = {};

    // Valider chaque champ selon les règles
    Object.keys(rules).forEach(fieldName => {
      const rule = rules[fieldName];
      const value = req.body[fieldName] || req.query[fieldName] || req.params[fieldName];

      const validation = validateField(value, rule, fieldName);

      if (!validation.isValid) {
        errors.push({
          field: fieldName,
          message: validation.message
        });
      } else {
        sanitizedData[fieldName] = validation.value;
      }
    });

    // Si des erreurs de validation, les logger et retourner une erreur
    if (errors.length > 0) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logUnauthorizedAccess(
        req.user?.id, req.user?.username, context.ip, context.endpoint, req.method,
        `Validation échouée: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
      );

      return res.status(400).json({
        success: false,
        message: 'Données de validation invalides',
        errors
      });
    }

    // Remplacer les données originales par les données sanitizées
    req.body = { ...req.body, ...sanitizedData };
    req.query = { ...req.query, ...sanitizedData };
    req.params = { ...req.params, ...sanitizedData };

    next();
  };
};

// Validation spécifique pour l'authentification
const validateAuth = validateData({
  username: VALIDATION_RULES.username,
  password: VALIDATION_RULES.password
});

// Validation spécifique pour l'enregistrement
const validateRegistration = validateData({
  username: VALIDATION_RULES.username,
  password: VALIDATION_RULES.password,
  email: VALIDATION_RULES.email,
  pseudo: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9\s_-]+$/,
    message: 'Le pseudo doit contenir 3-30 caractères alphanumériques, espaces, tirets ou underscores'
  }
});

// Validation spécifique pour les mises à jour de profil
const validateProfileUpdate = validateData({
  email: VALIDATION_RULES.email,
  phone: VALIDATION_RULES.phone,
  pseudo: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9\s_-]+$/,
    message: 'Le pseudo doit contenir 3-30 caractères alphanumériques, espaces, tirets ou underscores'
  }
});

// Validation des paramètres d'URL
const validateUrlParams = (paramRules) => {
  return (req, res, next) => {
    const errors = [];

    Object.keys(paramRules).forEach(paramName => {
      const rule = paramRules[paramName];
      const value = req.params[paramName];

      if (!value) {
        errors.push({
          field: paramName,
          message: `Paramètre ${paramName} manquant`
        });
      } else {
        const validation = validateField(value, rule, paramName);
        if (!validation.isValid) {
          errors.push({
            field: paramName,
            message: validation.message
          });
        }
      }
    });

    if (errors.length > 0) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logUnauthorizedAccess(
        req.user?.id, req.user?.username, context.ip, context.endpoint, req.method,
        `Paramètres d'URL invalides: ${errors.map(e => e.message).join(', ')}`
      );

      return res.status(400).json({
        success: false,
        message: 'Paramètres d\'URL invalides',
        errors
      });
    }

    next();
  };
};

module.exports = {
  validateData,
  validateAuth,
  validateRegistration,
  validateProfileUpdate,
  validateUrlParams,
  sanitizeData,
  VALIDATION_RULES
};
