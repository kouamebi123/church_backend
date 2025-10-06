const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware pour vérifier que l'utilisateur a une église locale assignée
 * Bloque l'accès au système si l'utilisateur n'a pas d'église.
 * @param req
 * @param res
 * @param next
 * @example
 */
exports.requireChurchAssignment = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur est connecté
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non connecté'
      });
    }

    // Récupérer les informations complètes de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        eglise_locale_id: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur a une église locale assignée
    if (!user.eglise_locale_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Vous devez être assigné à une église pour accéder au système. Veuillez contacter un administrateur.',
        code: 'NO_CHURCH_ASSIGNMENT',
        requiresAction: true
      });
    }

    // Vérifier que l'église existe toujours
    const church = await prisma.church.findUnique({
      where: { id: user.eglise_locale_id },
      select: { id: true, nom: true }
    });

    if (!church) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Votre église assignée n\'existe plus. Veuillez contacter un administrateur.',
        code: 'CHURCH_NOT_FOUND',
        requiresAction: true
      });
    }

    // Ajouter les informations d'église à req.user pour utilisation ultérieure
    req.user.eglise_locale_id = user.eglise_locale_id;
    req.user.churchName = church.nom;

    next();
  } catch (error) {
    // Erreur dans requireChurchAssignment - Supprimé pour la production
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la vérification de l\'église'
    });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur a une église locale (version simplifiée)
 * Utilisé pour les routes qui ne nécessitent pas de vérification complète.
 * @param req
 * @param res
 * @param next
 * @example
 */
exports.hasChurchAssignment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.eglise_locale_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Église locale requise',
        code: 'NO_CHURCH_ASSIGNMENT'
      });
    }
    next();
  } catch (error) {
    // Erreur dans hasChurchAssignment - Supprimé pour la production
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};
