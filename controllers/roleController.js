const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Changer le rôle actuel de l'utilisateur
exports.changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.user.id;

    logger.info('ChangeRole - Tentative de changement de rôle', { userId, newRole: role });

    // Vérifier que l'utilisateur a ce rôle dans ses rôles assignés
    const userRoleAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        user_id: userId,
        role: role,
        is_active: true
      }
    });

    if (!userRoleAssignment) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à ce rôle'
      });
    }

    // Mettre à jour le rôle actuel
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { current_role: role },
      select: {
        id: true,
        username: true,
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

    logger.info('ChangeRole - Rôle changé avec succès', { userId, newRole: role });

    res.status(200).json({
      success: true,
      message: 'Rôle changé avec succès',
      data: {
        current_role: updatedUser.current_role,
        available_roles: updatedUser.role_assignments.map(assignment => assignment.role)
      }
    });
  } catch (error) {
    const { status, message } = handleError(error, 'le changement de rôle');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les rôles disponibles de l'utilisateur
exports.getAvailableRoles = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        current_role: true,
        role_assignments: {
          where: { is_active: true },
          select: { role: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const availableRoles = user.role_assignments.map(assignment => assignment.role);

    res.status(200).json({
      success: true,
      data: {
        current_role: user.current_role,
        available_roles: availableRoles
      }
    });
  } catch (error) {
    const { status, message } = handleError(error, 'la récupération des rôles');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Assigner un rôle à un utilisateur (pour les admins)
exports.assignRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const adminId = req.user.id;

    logger.info('AssignRole - Tentative d\'assignation de rôle', { adminId, userId, role });

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si le rôle est déjà assigné
    const existingAssignment = await prisma.userRoleAssignment.findFirst({
      where: {
        user_id: userId,
        role: role
      }
    });

    if (existingAssignment) {
      if (existingAssignment.is_active) {
        return res.status(400).json({
          success: false,
          message: 'Ce rôle est déjà assigné à cet utilisateur'
        });
      } else {
        // Réactiver le rôle
        await prisma.userRoleAssignment.update({
          where: { id: existingAssignment.id },
          data: { is_active: true }
        });
      }
    } else {
      // Créer une nouvelle assignation
      await prisma.userRoleAssignment.create({
        data: {
          user_id: userId,
          role: role,
          is_active: true
        }
      });
    }

    logger.info('AssignRole - Rôle assigné avec succès', { adminId, userId, role });

    res.status(200).json({
      success: true,
      message: 'Rôle assigné avec succès'
    });
  } catch (error) {
    const { status, message } = handleError(error, 'l\'assignation de rôle');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Retirer un rôle d'un utilisateur (pour les admins)
exports.removeRole = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const adminId = req.user.id;

    logger.info('RemoveRole - Tentative de suppression de rôle', { adminId, userId, role });

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Désactiver l'assignation de rôle
    const updatedAssignment = await prisma.userRoleAssignment.updateMany({
      where: {
        user_id: userId,
        role: role
      },
      data: { is_active: false }
    });

    if (updatedAssignment.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce rôle n\'est pas assigné à cet utilisateur'
      });
    }

    // Si c'était le rôle actuel, changer vers le rôle par défaut
    if (user.current_role === role) {
      await prisma.user.update({
        where: { id: userId },
        data: { current_role: user.role }
      });
    }

    logger.info('RemoveRole - Rôle supprimé avec succès', { adminId, userId, role });

    res.status(200).json({
      success: true,
      message: 'Rôle supprimé avec succès'
    });
  } catch (error) {
    const { status, message } = handleError(error, 'la suppression de rôle');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Assigner plusieurs rôles à un utilisateur
exports.assignMultipleRoles = async (req, res) => {
  try {
    const { userId, roles } = req.body;
    const currentUserId = req.user.id;

    logger.info('AssignMultipleRoles - Tentative d\'assignation de rôles multiples', { 
      currentUserId, 
      targetUserId: userId, 
      roles 
    });

    // Vérifier que l'utilisateur a les permissions pour assigner des rôles
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, current_role: true }
    });

    const userRole = currentUser.current_role || currentUser.role;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Vous n\'avez pas les permissions pour assigner des rôles.',
      });
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Valider les rôles
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE', 'COLLECTEUR_RESEAUX', 'MEMBRE'];
    const invalidRoles = roles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Rôles invalides : ${invalidRoles.join(', ')}`,
      });
    }

    // Supprimer tous les rôles existants de l'utilisateur
    await prisma.userRoleAssignment.deleteMany({
      where: { user_id: userId }
    });

    // Assigner les nouveaux rôles
    const roleAssignments = roles.map(role => ({
      user_id: userId,
      role: role,
      is_active: true
    }));

    await prisma.userRoleAssignment.createMany({
      data: roleAssignments
    });

    // Mettre à jour le rôle principal de l'utilisateur (le plus élevé)
    const roleHierarchy = {
      'SUPER_ADMIN': 6,
      'ADMIN': 5,
      'MANAGER': 4,
      'SUPERVISEUR': 3,
      'COLLECTEUR_CULTE': 2,
      'COLLECTEUR_RESEAUX': 2,
      'MEMBRE': 1
    };

    const highestRole = roles.reduce((highest, current) => {
      return roleHierarchy[current] > roleHierarchy[highest] ? current : highest;
    }, roles[0]);

    await prisma.user.update({
      where: { id: userId },
      data: { 
        role: highestRole,
        current_role: highestRole
      }
    });

    logger.info('AssignMultipleRoles - Rôles assignés avec succès', { 
      currentUserId, 
      targetUserId: userId, 
      assignedRoles: roles,
      primaryRole: highestRole
    });

    res.status(200).json({
      success: true,
      message: 'Rôles assignés avec succès',
      data: {
        assigned_roles: roles,
        primary_role: highestRole
      }
    });
  } catch (error) {
    const { status, message } = handleError(error, 'l\'assignation des rôles multiples');
    res.status(status).json({ success: false, message });
  }
};

// Obtenir les rôles d'un utilisateur spécifique
exports.getUserRoles = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    logger.info('GetUserRoles - Récupération des rôles utilisateur', { 
      currentUserId, 
      targetUserId: userId 
    });

    // Vérifier les permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, current_role: true }
    });

    const userRole = currentUser.current_role || currentUser.role;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Vous n\'avez pas les permissions pour voir les rôles.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        current_role: true,
        role_assignments: {
          where: { is_active: true },
          select: { role: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const assignedRoles = user.role_assignments.map(ra => ra.role);

    res.status(200).json({
      success: true,
      data: {
        user_id: user.id,
        username: user.username,
        primary_role: user.role,
        current_role: user.current_role,
        assigned_roles: assignedRoles
      }
    });
  } catch (error) {
    const { status, message } = handleError(error, 'la récupération des rôles de l\'utilisateur');
    res.status(status).json({ success: false, message });
  }
};
