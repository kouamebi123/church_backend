const securityLogger = require('../utils/securityLogger');

/**
 * 🛡️ Middleware de validation d'entrées ultra-strict
 * Validation complète de toutes les données entrantes.
 */

// Schémas de validation ultra-stricts
const validationSchemas = {
  // Validation des utilisateurs
  user: {
    username: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-ZÀ-ÿ\s'-]+$/,
      sanitize: true
    },
    pseudo: {
      type: 'string',
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_-]+$/,
      unique: true,
      sanitize: true
    },
    email: {
      type: 'email',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: true
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      strength: 'strong'
    },
    role: {
      type: 'enum',
      values: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MEMBRE'],
      required: true
    }
  },

  // Validation des églises
  church: {
    nom: {
      type: 'string',
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZÀ-ÿ\s'-]+$/,
      sanitize: true
    },
    adresse: {
      type: 'string',
      minLength: 10,
      maxLength: 200,
      sanitize: true
    },
    ville: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-ZÀ-ÿ\s'-]+$/,
      sanitize: true
    },
    latitude: {
      type: 'number',
      min: -90,
      max: 90,
      precision: 6
    },
    longitude: {
      type: 'number',
      min: -180,
      max: 180,
      precision: 6
    }
  },

  // Validation des réseaux
  network: {
    nom: {
      type: 'string',
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZÀ-ÿ\s'-]+$/,
      sanitize: true
    },
    description: {
      type: 'string',
      maxLength: 500,
      sanitize: true
    }
  },

  // Validation des groupes
  group: {
    nom: {
      type: 'string',
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZÀ-ÿ\s'-]+$/,
      sanitize: true
    },
    description: {
      type: 'string',
      maxLength: 500,
      sanitize: true
    }
  }
};

// Fonctions de validation ultra-strictes
const validators = {
  // Validation de type
  type: (value, expectedType) => {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'enum':
        return true; // Sera validé par la fonction enum
      default:
        return false;
    }
  },

  // Validation de longueur
  length: (value, min, max) => {
    if (typeof value !== 'string') return false;
    const len = value.length;
    return (!min || len >= min) && (!max || len <= max);
  },

  // Validation de pattern
  pattern: (value, regex) => {
    if (typeof value !== 'string') return false;
    return regex.test(value);
  },

  // Validation d'énumération
  enum: (value, allowedValues) => {
    return allowedValues.includes(value);
  },

  // Validation de nombre
  number: (value, min, max, precision) => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    if (precision !== undefined) {
      const decimalPlaces = value.toString().split('.')[1]?.length || 0;
      if (decimalPlaces > precision) return false;
    }
    return true;
  },

  // Validation de force de mot de passe
  passwordStrength: (value) => {
    if (typeof value !== 'string') return false;

    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[@$!%*?&]/.test(value);
    const isLongEnough = value.length >= 8;

    return hasLower && hasUpper && hasNumber && hasSpecial && isLongEnough;
  }
};

// Fonctions de sanitisation
const sanitizers = {
  // Sanitisation des chaînes
  string: (value) => {
    if (typeof value !== 'string') return value;

    // Supprimer les caractères dangereux
    return value
      .replace(/[<>]/g, '') // Supprimer < et >
      .replace(/javascript:/gi, '') // Supprimer javascript:
      .replace(/on\w+=/gi, '') // Supprimer les événements inline
      .trim();
  },

  // Sanitisation des emails
  email: (value) => {
    if (typeof value !== 'string') return value;

    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '');
  },

  // Sanitisation des noms
  name: (value) => {
    if (typeof value !== 'string') return value;

    return value
      .replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '') // Garder seulement les lettres, espaces, tirets et apostrophes
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  }
};

// Fonction de validation principale
/**
 *
 * @param value
 * @param schema
 * @param fieldName
 * @example
 */
function validateField(value, schema, fieldName) {
  const errors = [];
  let sanitizedValue = value;

  // Validation de type
  if (schema.type && !validators.type(value, schema.type)) {
    errors.push(`Le champ ${fieldName} doit être de type ${schema.type}`);
  }

  // Validation de longueur
  if (schema.minLength || schema.maxLength) {
    if (!validators.length(value, schema.minLength, schema.maxLength)) {
      const range = [];
      if (schema.minLength) range.push(`minimum ${schema.minLength}`);
      if (schema.maxLength) range.push(`maximum ${schema.maxLength}`);
      errors.push(`Le champ ${fieldName} doit avoir une longueur de ${range.join(' et ')} caractères`);
    }
  }

  // Validation de pattern
  if (schema.pattern && !validators.pattern(value, schema.pattern)) {
    errors.push(`Le champ ${fieldName} ne respecte pas le format requis`);
  }

  // Validation d'énumération
  if (schema.values && !validators.enum(value, schema.values)) {
    errors.push(`Le champ ${fieldName} doit être l'une des valeurs suivantes: ${schema.values.join(', ')}`);
  }

  // Validation de nombre
  if (schema.type === 'number') {
    const { min, max, precision } = schema;
    if (!validators.number(value, min, max, precision)) {
      let msg = `Le champ ${fieldName} doit être un nombre`;
      if (min !== undefined) msg += ` supérieur ou égal à ${min}`;
      if (max !== undefined) msg += ` inférieur ou égal à ${max}`;
      if (precision !== undefined) msg += ` avec maximum ${precision} décimales`;
      errors.push(msg);
    }
  }

  // Validation de force de mot de passe
  if (schema.strength === 'strong' && !validators.passwordStrength(value)) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères, une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&)');
  }

  // Sanitisation si demandée
  if (schema.sanitize) {
    if (schema.type === 'email') {
      sanitizedValue = sanitizers.email(value);
    } else if (schema.type === 'string' && fieldName.includes('nom') || fieldName.includes('name')) {
      sanitizedValue = sanitizers.name(value);
    } else if (schema.type === 'string') {
      sanitizedValue = sanitizers.string(value);
    }
  }

  return {
    isValid: errors.length === 0,
    value: sanitizedValue,
    errors
  };
}

// Middleware de validation ultra-strict
/**
 *
 * @param schemaName
 * @example
 */
function validateInput(schemaName) {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Schéma de validation non trouvé'
      });
    }

    const errors = [];
    const sanitizedData = {};
    const dataToValidate = { ...req.body, ...req.query, ...req.params };

    // Valider chaque champ selon le schéma
    Object.keys(schema).forEach(fieldName => {
      const fieldSchema = schema[fieldName];
      const value = dataToValidate[fieldName];

      // Vérifier si le champ est requis
      if (fieldSchema.required && (value === undefined || value === null || value === '')) {
        errors.push(`Le champ ${fieldName} est requis`);
        return;
      }

      // Valider le champ s'il a une valeur
      if (value !== undefined && value !== null && value !== '') {
        const validation = validateField(value, fieldSchema, fieldName);

        if (!validation.isValid) {
          errors.push(...validation.errors);
        } else {
          sanitizedData[fieldName] = validation.value;
        }
      }
    });

    // Si des erreurs de validation, les logger et retourner une erreur
    if (errors.length > 0) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logUnauthorizedAccess(
        req.user?.id, req.user?.username, context.ip, context.endpoint, req.method,
        `Validation échouée: ${errors.join('; ')}`
      );

      return res.status(400).json({
        success: false,
        message: 'Données de validation invalides',
        errors,
        code: 'VALIDATION_ERROR'
      });
    }

    // Remplacer les données originales par les données sanitizées
    req.body = { ...req.body, ...sanitizedData };
    req.query = { ...req.query, ...sanitizedData };
    req.params = { ...req.params, ...sanitizedData };

    next();
  };
}

// Middlewares spécifiques
const validateUser = validateInput('user');
const validateChurch = validateInput('church');
const validateNetwork = validateInput('network');
const validateGroup = validateInput('group');

module.exports = {
  validateInput,
  validateUser,
  validateChurch,
  validateNetwork,
  validateGroup,
  validators,
  sanitizers
};
