const { body, validationResult, query } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Validation pour l'inscription
exports.validateRegister = [
  body('username').trim().isLength({ min: 2, max: 50 }).withMessage('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères'),
  body('pseudo').trim().isLength({ min: 3, max: 30 }).withMessage('Le pseudo doit contenir entre 3 et 30 caractères'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
  body('email').isEmail().withMessage('Email invalide'),
  body('telephone').optional().custom((value) => {
    if (!value) return true; // Si pas de téléphone, c'est OK
    // Validation basique : doit commencer par 0 et avoir 10 chiffres
    const phoneRegex = /^0[1-9](\d{8})$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      throw new Error('Numéro de téléphone français invalide (format: 0X XX XX XX XX)');
    }
    return true;
  }),
  body('genre')
    .customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      const map = {
        'Homme': 'HOMME',
        'Femme': 'FEMME',
        'Enfant': 'ENFANT',
        'homme': 'HOMME',
        'femme': 'FEMME',
        'enfant': 'ENFANT'
      };
      return map[trimmed] || trimmed.toUpperCase();
    })
    .isIn(['HOMME', 'FEMME', 'ENFANT'])
    .withMessage('Genre invalide'),
  body('tranche_age').notEmpty().withMessage('Tranche d\'âge requise'),
  body('profession').notEmpty().withMessage('Profession requise'),
  body('ville_residence').notEmpty().withMessage('Ville de résidence requise'),
  body('origine').notEmpty().withMessage('Origine requise'),
  body('situation_matrimoniale').notEmpty().withMessage('Situation matrimoniale requise'),
  body('niveau_education').notEmpty().withMessage('Niveau d\'éducation requis'),
  body('eglise_locale_id').notEmpty().withMessage('Église locale requise'),
  handleValidationErrors
];

// Validation pour la connexion
exports.validateLogin = [
  body('username').optional().trim().notEmpty().withMessage('Username ou pseudo requis'),
  body('pseudo').optional().trim().notEmpty().withMessage('Username ou pseudo requis'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  // Validation personnalisée pour s'assurer qu'au moins username ou pseudo est fourni
  body().custom((value, { req }) => {
    if (!req.body.username && !req.body.pseudo) {
      throw new Error('Username ou pseudo requis');
    }
    return true;
  }),
  handleValidationErrors
];

// Validation pour la mise à jour du profil
exports.validateUpdateProfile = [
  body('username').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Le nom d\'utilisateur doit contenir entre 2 et 50 caractères'),
  body('email').optional().isEmail().withMessage('Email invalide'),
  body('telephone').optional().custom((value) => {
    if (!value) return true; // Si pas de téléphone, c'est OK
    // Validation basique : doit commencer par 0 et avoir 10 chiffres
    const phoneRegex = /^0[1-9](\d{8})$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      throw new Error('Numéro de téléphone français invalide (format: 0X XX XX XX XX)');
    }
    return true;
  }),
  handleValidationErrors
];

// Validation pour la mise à jour du mot de passe
exports.validateUpdatePassword = [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères'),
  handleValidationErrors
];

// Validation pour les filtres de requête (protection NoSQL injection)
exports.validateQueryFilters = [
  query('role').optional().isIn(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MEMBRE', 'GOUVERNANCE']).withMessage('Rôle invalide'),
  query('genre').optional().isIn(['HOMME', 'FEMME', 'ENFANT']).withMessage('Genre invalide'),
  query('qualification').optional().isIn([
    'QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'LEADER',
    'RESPONSABLE_RESEAU', 'RESPONSABLE_DEPARTEMENT',
    'REGULIER', 'IRREGULIER', 'EN_INTEGRATION',
    'GOUVERNANCE', 'ECODIM', 'RESPONSABLE_ECODIM'
  ]).withMessage('Qualification invalide'),
  handleValidationErrors
];

// Fonction pour filtrer les paramètres de requête autorisés
exports.filterQueryParams = (allowedFields) => {
  return (req, res, next) => {
    const filteredQuery = {};
    Object.keys(req.query).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredQuery[key] = req.query[key];
      }
    });
    req.filteredQuery = filteredQuery;
    next();
  };
};
