const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

/**
 *
 */
class QualificationService {
  /**
   *
   * @param prisma
   * @example
   */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Met à jour la qualification d'un utilisateur.
   * @param userId
   * @param newQualification
   * @example
   */
  async updateUserQualification(userId, newQualification) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { qualification: newQualification }
      });
      logger.info(`Qualification de l'utilisateur ${userId} mise à jour vers: ${newQualification}`);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de la qualification de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour les qualifications des responsables de groupe.
   * @param groupId
   * @param oldResponsable1Id
   * @param oldResponsable2Id
   * @param newResponsable1Id
   * @param newResponsable2Id
   * @example
   */
  async updateGroupResponsablesQualification(groupId, oldResponsable1Id = null, oldResponsable2Id = null, newResponsable1Id = null, newResponsable2Id = null) {
    try {
      logger.debug('=== DEBUG updateGroupResponsablesQualification ===');
      logger.debug(`Groupe: ${groupId}`);
      logger.debug(`Anciens responsables: ${oldResponsable1Id}, ${oldResponsable2Id}`);
      logger.debug(`Nouveaux responsables: ${newResponsable1Id}, ${newResponsable2Id}`);

      // Anciens responsables : vérifier s'ils sont encore responsables d'autres groupes
      if (oldResponsable1Id && oldResponsable1Id !== newResponsable1Id && oldResponsable1Id !== newResponsable2Id) {
        logger.debug(`Ancien responsable1 ${oldResponsable1Id} n'est plus responsable de ce groupe`);
        await this.downgradeGroupResponsable(oldResponsable1Id);
      }

      if (oldResponsable2Id && oldResponsable2Id !== newResponsable1Id && oldResponsable2Id !== newResponsable2Id) {
        logger.debug(`Ancien responsable2 ${oldResponsable2Id} n'est plus responsable de ce groupe`);
        await this.downgradeGroupResponsable(oldResponsable2Id);
      }

      // Nouveaux responsables : mettre en LEADER
      if (newResponsable1Id) {
        logger.debug(`Nouveau responsable1 ${newResponsable1Id} devient LEADER`);
        await this.updateUserQualification(newResponsable1Id, 'LEADER');
      }

      if (newResponsable2Id) {
        logger.debug(`Nouveau responsable2 ${newResponsable2Id} devient LEADER`);
        await this.updateUserQualification(newResponsable2Id, 'LEADER');
      }

      logger.debug('=== FIN DEBUG ===');
      logger.info(`Qualifications des responsables du groupe ${groupId} mises à jour`);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour des qualifications des responsables du groupe ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour les qualifications des responsables de réseau.
   * @param networkId
   * @param oldResponsable1Id
   * @param oldResponsable2Id
   * @param newResponsable1Id
   * @param newResponsable2Id
   * @example
   */
  async updateNetworkResponsablesQualification(networkId, oldResponsable1Id = null, oldResponsable2Id = null, newResponsable1Id = null, newResponsable2Id = null) {
    try {
      // Anciens responsables : remettre en LEADER
      if (oldResponsable1Id && oldResponsable1Id !== newResponsable1Id && oldResponsable1Id !== newResponsable2Id) {
        await this.downgradeNetworkResponsable(oldResponsable1Id);
      }

      if (oldResponsable2Id && oldResponsable2Id !== newResponsable1Id && oldResponsable2Id !== newResponsable2Id) {
        await this.downgradeNetworkResponsable(oldResponsable2Id);
      }

      // Nouveaux responsables : mettre en RESPONSABLE_RESEAU
      if (newResponsable1Id) {
        await this.updateUserQualification(newResponsable1Id, 'RESPONSABLE_RESEAU');
      }

      if (newResponsable2Id) {
        await this.updateUserQualification(newResponsable2Id, 'RESPONSABLE_RESEAU');
      }

      logger.info(`Qualifications des responsables du réseau ${networkId} mises à jour`);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour des qualifications des responsables du réseau ${networkId}:`, error);
      throw error;
    }
  }

  /**
   * Rétrograder un ancien responsable de groupe.
   * @param userId
   * @example
   */
  async downgradeGroupResponsable(userId) {
    try {
      // Une personne ne peut être responsable que d'un seul groupe (contrainte d'unicité)
      // Donc quand elle n'est plus responsable, elle devient systématiquement REGULIER
      await this.updateUserQualification(userId, 'REGULIER');
      logger.info(`Utilisateur ${userId} rétrogradé en REGULIER (plus responsable de groupe)`);
    } catch (error) {
      logger.error(`Erreur lors de la rétrogradation de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Rétrograder un ancien responsable de réseau.
   * @param userId
   * @example
   */
  async downgradeNetworkResponsable(userId) {
    try {
      // Une personne ne peut être responsable que d'un seul réseau (contrainte d'unicité)
      // Donc quand elle n'est plus responsable, elle devient systématiquement LEADER
      await this.updateUserQualification(userId, 'LEADER');
      logger.info(`Utilisateur ${userId} rétrogradé en LEADER (plus responsable de réseau)`);
    } catch (error) {
      logger.error(`Erreur lors de la rétrogradation de l'utilisateur ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Nettoyer les qualifications lors de la suppression d'un groupe.
   * @param groupId
   * @example
   */
  async cleanupGroupQualification(groupId) {
    try {
      logger.info(`Début du nettoyage des qualifications pour le groupe ${groupId}`);

      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: {
          responsable1_id: true,
          responsable2_id: true
        }
      });

      if (group) {
        logger.info(`Groupe trouvé: responsable1=${group.responsable1_id}, responsable2=${group.responsable2_id}`);

        if (group.responsable1_id) {
          logger.info(`Rétrogradation du responsable1 ${group.responsable1_id}`);
          await this.downgradeGroupResponsable(group.responsable1_id);
        }
        if (group.responsable2_id) {
          logger.info(`Rétrogradation du responsable2 ${group.responsable2_id}`);
          await this.downgradeGroupResponsable(group.responsable2_id);
        }
      } else {
        logger.warn(`Groupe ${groupId} non trouvé lors du nettoyage des qualifications`);
      }

      logger.info(`Qualifications nettoyées avec succès pour le groupe ${groupId}`);
    } catch (error) {
      logger.error(`Erreur lors du nettoyage des qualifications du groupe ${groupId}:`, error);
      // Ne pas bloquer la suppression du groupe en cas d'erreur de qualification
      logger.warn('Continuation de la suppression du groupe malgré l\'erreur de qualification');
    }
  }

  /**
   * Nettoyer les qualifications lors de la suppression d'un réseau.
   * @param networkId
   * @example
   */
  async cleanupNetworkQualification(networkId) {
    try {
      const network = await this.prisma.network.findUnique({
        where: { id: networkId },
        select: {
          responsable1_id: true,
          responsable2_id: true
        }
      });

      if (network) {
        if (network.responsable1_id) {
          await this.downgradeNetworkResponsable(network.responsable1_id);
        }
        if (network.responsable2_id) {
          await this.downgradeNetworkResponsable(network.responsable2_id);
        }
      }

      logger.info(`Qualifications nettoyées pour le réseau ${networkId}`);
    } catch (error) {
      logger.error(`Erreur lors du nettoyage des qualifications du réseau ${networkId}:`, error);
      throw error;
    }
  }

  /**
   * Nettoyer les qualifications lors de la suppression d'une session.
   * @param sessionId
   * @example
   */
  async cleanupSessionQualification(sessionId) {
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          units: {
            select: {
              id: true,
              responsable1_id: true,
              responsable2_id: true,
              members: {
                select: { user_id: true }
              }
            }
          }
        },
        select: {
          responsable1_id: true,
          responsable2_id: true,
          units: {
            select: {
              id: true,
              responsable1_id: true,
              responsable2_id: true,
              members: {
                select: { user_id: true }
              }
            }
          }
        }
      });

      if (session) {
        // Rétrograder les responsables de session
        if (session.responsable1_id) {
          await this.updateUserQualification(session.responsable1_id, 'LEADER');
        }
        if (session.responsable2_id) {
          await this.updateUserQualification(session.responsable2_id, 'LEADER');
        }

        // Rétrograder tous les membres et responsables des unités
        const allUserIds = new Set();
        
        session.units.forEach(unit => {
          // Ajouter les membres des unités
          unit.members.forEach(member => {
            allUserIds.add(member.user_id);
          });
          // Ajouter les responsables des unités
          if (unit.responsable1_id) allUserIds.add(unit.responsable1_id);
          if (unit.responsable2_id) allUserIds.add(unit.responsable2_id);
        });

        // Mettre tous les utilisateurs en IRREGULIER
        if (allUserIds.size > 0) {
          await this.prisma.user.updateMany({
            where: { id: { in: Array.from(allUserIds) } },
            data: { qualification: 'IRREGULIER' }
          });
        }
      }

      logger.info(`Qualifications nettoyées pour la session ${sessionId}`);
    } catch (error) {
      logger.error(`Erreur lors du nettoyage des qualifications de la session ${sessionId}:`, error);
      throw error;
    }
  }
}

module.exports = QualificationService;
