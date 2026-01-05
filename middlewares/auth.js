const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const securityLogger = require('../utils/securityLogger');
const logger = require('../utils/logger');

// Logging détaillé des tentatives d'authentification
const logAuthAttempt = (req, success, reason = null, user = null) => {
  const context = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || `req_${Date.now()}`
  };

  if (success) {
    logger.auth('AUTH_SUCCESS', user, true, context);
  } else {
    logger.auth('AUTH_FAILED', null, false, {
      ...context,
      reason: reason || 'Token invalide ou expiré'
    });
  }
};

exports.protect = async (req, res, next) => {
  try {
    // 1. Vérifier si le token existe
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logUnauthorizedAccess(
        null, null, context.ip, context.endpoint, context.method,
        'Token manquant'
      );
      
      // Logging détaillé de l'échec d'authentification
      logAuthAttempt(req, false, 'Token manquant');
      
      return res.status(401).json({
        success: false,
        message: 'Veuillez vous connecter pour accéder à cette ressource'
      });
    }

    // 2. Vérifier la validité du token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logJWTError(token, context.ip, jwtError);
      
      // Logging détaillé de l'échec d'authentification
      logAuthAttempt(req, false, `JWT Error: ${jwtError.message}`);
      
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // 3. Vérifier si l'utilisateur existe toujours
    let user;
    const prismaUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        pseudo: true,
        role: true,
        current_role: true,
        qualification: true,
        eglise_locale_id: true,
        role_assignments: {
          where: { is_active: true },
          select: { role: true }
        }
      }
    });
    if (prismaUser) {
      const roleMap = {
        SUPER_ADMIN: 'SUPER_ADMIN',
        ADMIN: 'ADMIN',
        MANAGER: 'MANAGER',
        SUPERVISEUR: 'SUPERVISEUR',
        COLLECTEUR_RESEAUX: 'COLLECTEUR_RESEAUX',
        COLLECTEUR_CULTE: 'COLLECTEUR_CULTE',
        MEMBRE: 'MEMBRE',
        GOUVERNANCE: 'GOUVERNANCE'
      };
      // Utiliser le rôle actuel ou le rôle par défaut
      const activeRole = prismaUser.current_role || prismaUser.role;
      
      user = {
        _id: prismaUser.id,
        id: prismaUser.id,
        username: prismaUser.username,
        pseudo: prismaUser.pseudo,
        role: roleMap[activeRole] || 'membre',
        current_role: roleMap[activeRole] || 'membre',
        available_roles: prismaUser.role_assignments?.map(assignment => roleMap[assignment.role] || assignment.role) || [roleMap[prismaUser.role] || 'membre'],
        qualification: prismaUser.qualification,
        eglise_locale: prismaUser.eglise_locale_id || null,
        eglise_locale_id: prismaUser.eglise_locale_id || null
      };
    }
    if (!user) {
      const context = securityLogger.enrichWithRequestContext(req);
      securityLogger.logUnauthorizedAccess(
        decoded.id, null, context.ip, context.endpoint, context.method,
        'Utilisateur inexistant'
      );
      
      // Logging détaillé de l'échec d'authentification
      logAuthAttempt(req, false, 'Utilisateur inexistant');
      
      return res.status(401).json({
        success: false,
        message: 'L\'utilisateur associé à ce token n\'existe plus'
      });
    }

    // 4. Ajouter l'utilisateur à la requête
    req.user = user;
    
    // Logging détaillé de l'authentification réussie
    logAuthAttempt(req, true, null, user);
    
    next();
  } catch (error) {
    // Erreur d'authentification - Supprimé pour la production
    res.status(401).json({
      success: false,
      message: 'Non autorisé à accéder à cette ressource'
    });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non authentifié'
      });
    }

    // SUPER_ADMIN a tous les droits
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Vérifier si le rôle de l'utilisateur correspond à l'un des rôles autorisés
    // Normaliser les rôles pour la comparaison
    const userRole = req.user.role;
    const normalizedRoles = roles.map(role => role.toUpperCase());

    if (normalizedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Accès refusé : permissions insuffisantes pour cette action'
    });
  };
};

// Autorise uniquement ADMIN, SUPER_ADMIN, COLLECTEUR_RESEAUX
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeAdminOrCollecteurReseaux(req, res, next) {
  const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX'];
  if (req.user && allowedRoles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Vous n'avez pas les droits pour effectuer cette action"
  });
}

// Autorise les admins à lire mais pas à modifier (lecture seule)
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeAdminReadOnly(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    // Admin peut seulement lire
    if (req.method === 'GET') {
      return next();
    } else {
      return res.status(403).json({
        success: false,
        message: "L'admin n'a que des droits de lecture. Contactez un super-admin pour les modifications."
      });
    }
  }
  // Pour les autres rôles, continuer normalement
  return next();
}

// Autorise les admins à modifier (pour les cas où c'est nécessaire)
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeAdminWrite(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: "L'admin n'a que des droits de lecture. Contactez un super-admin pour les modifications."
    });
  }
  return next();
}

// Autorise le manager à gérer uniquement son église
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeManager(req, res, next) {
  if (req.user && req.user.role === 'MANAGER') {
    // Le manager peut accéder aux ressources de son église
    return next();
  }
  return next();
}

// Vérifie que l'utilisateur peut accéder à une église spécifique
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeChurchAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
  }

  // super-admin et admin ont accès à toutes les églises
  if (req.user.role === 'super-admin' || req.user.role === 'admin') {
    return next();
  }

  // manager ne peut accéder qu'à son église
  if (req.user.role === 'manager') {
    const targetChurchId = req.params.churchId || req.query.churchId || req.body.eglise_locale || req.body.church;

    if (targetChurchId && targetChurchId !== req.user.eglise_locale?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez accéder qu\'aux données de votre église'
      });
    }
  }

  return next();
}

// Vérifie que l'utilisateur peut modifier un utilisateur
exports.authorizeUserModification = function(req, res, next) {
  // Debug de la modification d'utilisateur - Supprimé pour la production
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
  }

  // super-admin peut tout faire
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // admin et manager ont des restrictions
  if (req.user.role === 'ADMIN' || req.user.role === 'MANAGER') {
    const targetUserId = req.params.id;
    const targetUser = req.body;

    // Vérifier que l'utilisateur cible appartient à la même église (pour manager)
    if (req.user.role === 'MANAGER') {
      // TODO: Vérifier que targetUserId appartient à l'église du manager
      // Cette vérification sera faite dans le contrôleur
    }

    // Empêcher l'attribution de rôles privilégiés
    if (targetUser.role && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(targetUser.role)) {
      // Attribution de rôle privilégié bloquée
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas attribuer ce rôle'
      });
    }

    // Empêcher la modification du champ église (pour manager)
    if (req.user.role === 'MANAGER' && targetUser.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas modifier l\'église d\'un utilisateur'
      });
    }
  }

  return next();
};

// Nouveau middleware pour autoriser le manager à gérer les réseaux
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeManagerNetworkAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
  }

  // super-admin et admin ont accès à tous les réseaux
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return next();
  }

  // manager et COLLECTEUR_RESEAUX ne peuvent accéder qu'aux réseaux de leur église
  if (req.user.role === 'MANAGER' || req.user.role === 'COLLECTEUR_RESEAUX') {
    const targetChurchId = req.params.churchId || req.query.churchId || req.body.church;

    if (targetChurchId && targetChurchId !== req.user.eglise_locale?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez accéder qu\'aux réseaux de votre église'
      });
    }
  }

  return next();
}

// Nouveau middleware pour autoriser le manager et collecteur_reseaux à gérer les groupes
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeManagerGroupAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
  }

  // super-admin et admin ont accès à tous les groupes
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return next();
  }

  // manager et collecteur_reseaux ont accès aux groupes de leur église
  if (req.user.role === 'MANAGER' || req.user.role === 'COLLECTEUR_RESEAUX') {
    // Pour les opérations sur les groupes, on doit récupérer le churchId depuis le groupe
    // Ce middleware sera appelé après que le groupe soit récupéré dans le contrôleur
    // On stocke la logique de vérification pour plus tard
    req.requiresChurchCheck = true;
  }

  return next();
}

// Nouveau middleware pour autoriser le manager à gérer les services
/**
 *
 * @param req
 * @param res
 * @param next
 * @example
 */
function authorizeManagerServiceAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
  }

  // super-admin et admin ont accès à tous les services
  if (req.user.role === 'super-admin' || req.user.role === 'admin') {
    return next();
  }

  // manager et collecteur_culte peuvent accéder aux services
  // La vérification de l'église est faite dans le contrôleur
  if (req.user.role === 'manager' || req.user.role === 'collecteur_culte') {
    return next();
  }

  return next();
}

module.exports = {
  protect: exports.protect,
  authorize: exports.authorize,
  authorizeAdminOrCollecteurReseaux,
  authorizeAdminReadOnly,
  authorizeAdminWrite,
  authorizeManager,
  authorizeChurchAccess,
  authorizeUserModification: exports.authorizeUserModification,
  authorizeManagerNetworkAccess,
  authorizeManagerGroupAccess,
  authorizeManagerServiceAccess
};
