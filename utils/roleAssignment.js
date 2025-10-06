const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Crée automatiquement une assignation de rôle pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} role - Rôle à assigner (UserRole enum)
 * @param {boolean} isActive - Si le rôle est actif (défaut: true)
 * @returns {Promise<Object>} L'assignation de rôle créée
 */
async function createRoleAssignment(userId, role, isActive = true) {
  try {
    // Vérifier si l'assignation existe déjà
    const existingAssignment = await prisma.userRoleAssignment.findUnique({
      where: {
        user_id_role: {
          user_id: userId,
          role: role
        }
      }
    });

    if (existingAssignment) {
      console.log(`⚠️  Assignation de rôle ${role} déjà existante pour l'utilisateur ${userId}`);
      return existingAssignment;
    }

    // Créer l'assignation de rôle
    const roleAssignment = await prisma.userRoleAssignment.create({
      data: {
        user_id: userId,
        role: role,
        is_active: isActive
      }
    });

    console.log(`✅ Assignation de rôle ${role} créée pour l'utilisateur ${userId}`);
    return roleAssignment;
  } catch (error) {
    console.error(`❌ Erreur lors de la création de l'assignation de rôle ${role}:`, error);
    throw error;
  }
}

/**
 * Crée automatiquement les assignations de rôles pour un utilisateur
 * Si le rôle n'est pas MEMBRE, crée une assignation dans UserRoleAssignment
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userRole - Rôle principal de l'utilisateur (UserRole enum)
 * @returns {Promise<Object|null>} L'assignation de rôle créée ou null si MEMBRE
 */
async function createUserRoleAssignment(userId, userRole) {
  // Si le rôle est MEMBRE, pas besoin d'assignation spéciale
  if (userRole === 'MEMBRE') {
    console.log(`ℹ️  Aucune assignation de rôle nécessaire pour MEMBRE (${userId})`);
    return null;
  }

  // Pour tous les autres rôles, créer l'assignation
  return await createRoleAssignment(userId, userRole, true);
}

/**
 * Met à jour le rôle actuel d'un utilisateur et crée l'assignation si nécessaire
 * @param {string} userId - ID de l'utilisateur
 * @param {string} newRole - Nouveau rôle à assigner
 * @returns {Promise<Object>} L'utilisateur mis à jour
 */
async function updateUserRole(userId, newRole) {
  try {
    // Mettre à jour le rôle dans la table User
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        current_role: newRole
      }
    });

    // Créer l'assignation de rôle si nécessaire
    await createUserRoleAssignment(userId, newRole);

    console.log(`✅ Rôle de l'utilisateur ${userId} mis à jour vers ${newRole}`);
    return updatedUser;
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du rôle de l'utilisateur ${userId}:`, error);
    throw error;
  }
}

/**
 * Récupère tous les rôles actifs d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} Liste des assignations de rôles actives
 */
async function getUserActiveRoles(userId) {
  try {
    const roleAssignments = await prisma.userRoleAssignment.findMany({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    return roleAssignments;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des rôles de l'utilisateur ${userId}:`, error);
    throw error;
  }
}

/**
 * Désactive un rôle pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} role - Rôle à désactiver
 * @returns {Promise<Object>} L'assignation de rôle mise à jour
 */
async function deactivateUserRole(userId, role) {
  try {
    const updatedAssignment = await prisma.userRoleAssignment.update({
      where: {
        user_id_role: {
          user_id: userId,
          role: role
        }
      },
      data: {
        is_active: false
      }
    });

    console.log(`✅ Rôle ${role} désactivé pour l'utilisateur ${userId}`);
    return updatedAssignment;
  } catch (error) {
    console.error(`❌ Erreur lors de la désactivation du rôle ${role} pour l'utilisateur ${userId}:`, error);
    throw error;
  }
}

module.exports = {
  createRoleAssignment,
  createUserRoleAssignment,
  updateUserRole,
  getUserActiveRoles,
  deactivateUserRole
};
