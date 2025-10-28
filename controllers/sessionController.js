const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const QualificationService = require('../services/qualificationService');

// Créer une nouvelle session
exports.createSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, responsable1_id, responsable2_id, church_id } = req.body;
    const created_by_id = req.user.id;

    logger.info('Session createSession - Données reçues:', { nom, responsable1_id, responsable2_id, church_id });

    // Vérifier que l'église existe
    const church = await prisma.church.findUnique({
      where: { id: church_id }
    });

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Créer la session
    const session = await prisma.session.create({
      data: {
        nom,
        responsable1_id,
        responsable2_id,
        church_id,
        created_by_id
      }
    });

    // Mettre à jour les qualifications des responsables
    const responsables = [];
    if (responsable1_id) responsables.push(responsable1_id);
    if (responsable2_id) responsables.push(responsable2_id);

    if (responsables.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsables } },
        data: { qualification: 'RESPONSABLE_SESSION' }
      });
      logger.info('Session createSession - Responsables mis à RESPONSABLE_SESSION', { responsables });
    }

    // Invalider le cache
    try {
      cache.flushByPattern('sessions');
    } catch (cacheError) {
      logger.error('Session - createSession - Erreur cache', cacheError);
    }

    res.status(201).json({
      success: true,
      message: 'Session créée avec succès',
      data: session
    });
  } catch (error) {
    logger.error('Session - createSession - Erreur complète', error);
    
    let errorMessage = 'Erreur lors de la création de la session';
    
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('nom')) {
        errorMessage = 'Une session avec ce nom existe déjà';
      } else if (error.meta?.target?.includes('responsable1_id')) {
        errorMessage = 'Cette personne est déjà responsable d\'une autre session';
      } else if (error.meta?.target?.includes('responsable2_id')) {
        errorMessage = 'Cette personne est déjà responsable d\'une autre session';
      }
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// Supprimer une session
exports.deleteSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    logger.info('Session deleteSession - Starting deletion for session:', id);

    // Vérifier que la session existe
    const existingSession = await prisma.session.findUnique({
      where: { id }
    });

    if (!existingSession) {
      return res.status(404).json({
        success: false,
        message: 'Session introuvable'
      });
    }

    // Supprimer la session dans une transaction
    await prisma.$transaction(async (tx) => {
      logger.info('Session deleteSession - Début de la suppression en cascade', { session_id: id });

      // 1. Supprimer d'abord tous les membres des unités
      const units = await tx.unit.findMany({
        where: { session_id: id }
      });

      logger.info('Session deleteSession - Unités trouvées', { count: units.length });

      for (const unit of units) {
        // Supprimer les membres de l'unité
        const deletedMembers = await tx.unitMember.deleteMany({
          where: { unit_id: unit.id }
        });

        logger.info('Session deleteSession - Unité nettoyée', { 
          unit_id: unit.id, 
          unit_name: unit.nom,
          members_deleted: deletedMembers.count
        });
      }

      // Supprimer toutes les unités de cette session
      const deletedUnits = await tx.unit.deleteMany({
        where: { session_id: id }
      });

      logger.info('Session deleteSession - Unités supprimées', { count: deletedUnits.count });

      // 2. Nettoyer les qualifications des responsables avant de supprimer la session
      const qualificationService = new QualificationService(tx);
      await qualificationService.cleanupSessionQualification(id);

      // 3. Supprimer la session
      await tx.session.delete({
        where: { id }
      });

      logger.info('Session deleteSession - Session supprimée avec succès', { session_id: id });
    });

    // Invalider le cache (ne pas faire échouer la requête si cela échoue)
    try {
      cache.flushByPattern('sessions');
    } catch (cacheError) {
      logger.error('Session - deleteSession - Erreur cache', cacheError);
    }

    res.status(200).json({
      success: true,
      message: 'Session supprimée avec succès'
    });
  } catch (error) {
    logger.error('Session - deleteSession - Erreur complète', error);
    
    // Message d'erreur plus informatif
    let errorMessage = 'Erreur lors de la suppression de la session';
    
    if (error.code === 'P2003') {
      errorMessage = 'Impossible de supprimer cette session. Il y a encore des unités ou des membres associés.';
    } else if (error.code === 'P2025') {
      errorMessage = 'Session introuvable';
    } else if (error.meta) {
      errorMessage = error.meta.cause || errorMessage;
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// Récupérer toutes les sessions
exports.getSessions = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.query;

    logger.info('Session getSessions - churchId:', churchId);

    const sessions = await prisma.session.findMany({
      where: churchId ? { church_id: churchId } : {},
      include: {
        responsable1: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        },
        units: {
          include: {
            members: true,
            responsable1: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                qualification: true
              }
            },
            responsable2: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                qualification: true
              }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    logger.info('Session getSessions - Sessions trouvées:', sessions.length);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Session - getSessions - Erreur complète', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sessions'
    });
  }
};

// Récupérer une session par ID
exports.getSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        responsable1: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        },
        units: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    nom: true,
                    prenom: true,
                    qualification: true
                  }
                }
              }
            },
            responsable1: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                qualification: true
              }
            },
            responsable2: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                qualification: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session introuvable'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Session - getSession - Erreur complète', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la session'
    });
  }
};

// Mettre à jour une session
exports.updateSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { nom, responsable1_id, responsable2_id } = req.body;

    // Récupérer l'ancienne session pour les responsables
    const oldSession = await prisma.session.findUnique({
      where: { id },
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });

    if (!oldSession) {
      return res.status(404).json({
        success: false,
        message: 'Session introuvable'
      });
    }

    // Mettre à jour la session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        nom,
        responsable1_id,
        responsable2_id
      }
    });

    // Gérer les changements de qualification des responsables
    const anciensResponsables = [];
    if (oldSession.responsable1_id) anciensResponsables.push(oldSession.responsable1_id);
    if (oldSession.responsable2_id) anciensResponsables.push(oldSession.responsable2_id);

    const nouveauxResponsables = [];
    if (updatedSession.responsable1_id) nouveauxResponsables.push(updatedSession.responsable1_id);
    if (updatedSession.responsable2_id) nouveauxResponsables.push(updatedSession.responsable2_id);

    // Remettre LEADER aux anciens responsables qui ne le sont plus
    const responsablesARetirer = anciensResponsables.filter(id => !nouveauxResponsables.includes(id));
    if (responsablesARetirer.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsablesARetirer } },
        data: { qualification: 'LEADER' }
      });
      logger.info('Session updateSession - Anciens responsables remis à LEADER', { responsablesARetirer });
    }

    // Assigner RESPONSABLE_SESSION aux nouveaux responsables
    if (nouveauxResponsables.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: nouveauxResponsables } },
        data: { qualification: 'RESPONSABLE_SESSION' }
      });
      logger.info('Session updateSession - Nouveaux responsables mis à RESPONSABLE_SESSION', { nouveauxResponsables });
    }

    // Invalider le cache
    try {
      cache.flushByPattern('sessions');
    } catch (cacheError) {
      logger.error('Session - updateSession - Erreur cache', cacheError);
    }

    res.json({
      success: true,
      message: 'Session mise à jour avec succès',
      data: updatedSession
    });
  } catch (error) {
    logger.error('Session - updateSession - Erreur complète', error);
    
    let errorMessage = 'Erreur lors de la mise à jour de la session';
    
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('nom')) {
        errorMessage = 'Une session avec ce nom existe déjà';
      } else if (error.meta?.target?.includes('responsable1_id')) {
        errorMessage = 'Cette personne est déjà responsable d\'une autre session';
      } else if (error.meta?.target?.includes('responsable2_id')) {
        errorMessage = 'Cette personne est déjà responsable d\'une autre session';
      }
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// Récupérer les statistiques d'une session
exports.getSessionStatsById = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        units: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    qualification: true
                  }
                }
              }
            },
            responsable1: {
              select: {
                id: true,
                qualification: true
              }
            },
            responsable2: {
              select: {
                id: true,
                qualification: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session introuvable'
      });
    }

    // Collecter tous les IDs d'utilisateurs uniques
    const memberIds = new Set();
    const userQualifications = new Map(); // Map pour éviter les doublons par utilisateur
    const unitResponsables = new Set();

    session.units.forEach(unit => {
      // Ajouter les membres de l'unité
      unit.members.forEach(member => {
        memberIds.add(member.user.id);
        // Ne pas ajouter de doublons pour le même utilisateur
        if (!userQualifications.has(member.user.id)) {
          userQualifications.set(member.user.id, member.user.qualification);
        }
      });

      // Ajouter les responsables de l'unité
      if (unit.responsable1) {
        unitResponsables.add(unit.responsable1.id);
        // Ajouter la qualification du responsable seulement s'il n'est pas déjà compté
        if (!userQualifications.has(unit.responsable1.id)) {
          userQualifications.set(unit.responsable1.id, unit.responsable1.qualification);
        }
      }
      if (unit.responsable2) {
        unitResponsables.add(unit.responsable2.id);
        // Ajouter la qualification du responsable seulement s'il n'est pas déjà compté
        if (!userQualifications.has(unit.responsable2.id)) {
          userQualifications.set(unit.responsable2.id, unit.responsable2.qualification);
        }
      }
    });

    // Ajouter les responsables de la session
    const sessionResponsables = await prisma.user.findMany({
      where: {
        OR: [
          { session_responsable1: { some: { id } } },
          { session_responsable2: { some: { id } } }
        ]
      },
      select: {
        id: true,
        qualification: true
      }
    });

    sessionResponsables.forEach(resp => {
      memberIds.add(resp.id);
      // Ajouter la qualification seulement si l'utilisateur n'est pas déjà compté
      if (!userQualifications.has(resp.id)) {
        userQualifications.set(resp.id, resp.qualification);
      }
    });

    // Compter uniquement les qualifications session/unité
    const qualificationsArray = Array.from(userQualifications.values());
    const stats = {
      totalUnits: session.units.length,
      'RESPONSABLE_SESSION': qualificationsArray.filter(q => q === 'RESPONSABLE_SESSION').length,
      'RESPONSABLE_UNITE': qualificationsArray.filter(q => q === 'RESPONSABLE_UNITE').length,
      'MEMBRE_SESSION': qualificationsArray.filter(q => q === 'MEMBRE_SESSION').length,
      'Membre simple': qualificationsArray.filter(q => q === 'MEMBRE_SESSION').length,
      totalMembers: memberIds.size
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Session - getSessionStatsById - Erreur complète', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques de la session'
    });
  }
};

// Récupérer les unités d'une session
exports.getSessionUnits = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const units = await prisma.unit.findMany({
      where: { session_id: id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                qualification: true
              }
            }
          }
        },
        responsable1: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            qualification: true
          }
        }
      },
      orderBy: { created_at: 'asc' }
    });

    res.json({
      success: true,
      data: units
    });
  } catch (error) {
    logger.error('Session - getSessionUnits - Erreur complète', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des unités de la session'
    });
  }
};
