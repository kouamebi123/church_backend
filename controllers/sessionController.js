const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

// Récupérer toutes les sessions
exports.getSessions = async (req, res) => {
  try {
    const { prisma } = req;

    const filter = {};

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        filter.church_id = churchId;
      }
    } else {
      if (req.query.churchId) {
        filter.church_id = req.query.churchId;
      }
    }

    logger.info('Session getSessions - Filter:', JSON.stringify(filter));
    logger.info('Session getSessions - Query churchId:', req.query.churchId);

    const cacheKey = cache.generateKey('sessions', {
      ...filter,
      role: req.user?.role,
      userId: req.user?.id
    });

    // DÉSACTIVÉ LE CACHE TEMPORAIREMENT POUR DIAGNOSTIC (comme networks)
    // const cachedData = cache.get(cacheKey);
    // if (cachedData) {
    //   return res.status(200).json(cachedData);
    // }

    const sessions = await prisma.session.findMany({
      where: filter,
      include: {
        church: {
          select: {
            id: true,
            nom: true,
            adresse: true
          }
        },
        responsable1: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        responsable2: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        units: {
          select: {
            id: true,
            nom: true,
            active: true,
            _count: {
              select: {
                members: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logger.info('Session getSessions - Found sessions:', sessions.length);

    const response = {
      success: true,
      count: sessions.length,
      data: sessions
    };

    // DÉSACTIVÉ LE CACHE TEMPORAIREMENT POUR DIAGNOSTIC (comme networks)
    // cache.set(cacheKey, response, 120000);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Session - getSessions - Erreur complète', error);

    const { status, message } = handleError(error, 'la récupération des sessions');

    res.status(status).json({
      success: false,
      message
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
        church: {
          select: {
            id: true,
            nom: true,
            adresse: true
          }
        },
        responsable1: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true
          }
        },
        units: {
          include: {
            responsable1: {
              select: {
                id: true,
                username: true,
                pseudo: true,
                qualification: true
              }
            },
            responsable2: {
              select: {
                id: true,
                username: true,
                pseudo: true,
                qualification: true
              }
            },
            superieur_hierarchique: {
              select: {
                id: true,
                username: true,
                pseudo: true,
                qualification: true
              }
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    pseudo: true,
                    qualification: true,
                    image: true
                  }
                }
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

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Session - getSession - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération de la session');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer une nouvelle session
exports.createSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, church_id, responsable1_id, responsable2_id } = req.body;

    if (!nom || !church_id || !responsable1_id) {
      return res.status(400).json({
        success: false,
        message: 'Nom, église et responsable 1 sont requis'
      });
    }

    const session = await prisma.session.create({
      data: {
        nom,
        church_id,
        responsable1_id,
        responsable2_id: responsable2_id || null
      },
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable1: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        responsable2: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      }
    });

    // Invalider le cache (ne pas faire échouer la requête si cela échoue)
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

    if (error.code === 'P2002') {
      // Vérifier quel champ est en conflit
      const target = error.meta?.target;
      let message = 'Une session avec ce nom existe déjà';
      
      if (target && target.includes('responsable1_id')) {
        message = 'Ce responsable est déjà responsable d\'une session ou d\'un réseau';
      } else if (target && target.includes('responsable2_id')) {
        message = 'Ce responsable 2 est déjà responsable d\'une session ou d\'un réseau';
      }
      
      return res.status(400).json({
        success: false,
        message
      });
    }

    const { status, message } = handleError(error, 'la création de la session');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour une session
exports.updateSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { nom, responsable1_id, responsable2_id, active } = req.body;

    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        ...(nom && { nom }),
        ...(responsable1_id && { responsable1_id }),
        ...(responsable2_id !== undefined && { responsable2_id }),
        ...(active !== undefined && { active })
      },
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable1: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        responsable2: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      }
    });

    // Invalider le cache (ne pas faire échouer la requête si cela échoue)
    try {
      cache.flushByPattern('sessions');
    } catch (cacheError) {
      logger.error('Session - updateSession - Erreur cache', cacheError);
    }

    res.status(200).json({
      success: true,
      message: 'Session mise à jour avec succès',
      data: updatedSession
    });
  } catch (error) {
    logger.error('Session - updateSession - Erreur complète', error);

    const { status, message } = handleError(error, 'la mise à jour de la session');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer une session
exports.deleteSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si la session existe
    const existingSession = await prisma.session.findUnique({
      where: { id }
    });

    if (!existingSession) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    // Supprimer la session dans une transaction
    await prisma.$transaction(async (tx) => {
      logger.info('deleteSession - Début de la suppression en cascade', { session_id: id });

      // 1. Supprimer d'abord toutes les unités de la session (et leurs membres)
      const units = await tx.unit.findMany({
        where: { session_id: id }
      });

      logger.info('deleteSession - Unités trouvées', { count: units.length });

      for (const unit of units) {
        // Supprimer les membres de l'unité
        const deletedMembers = await tx.unitMember.deleteMany({
          where: { unit_id: unit.id }
        });

        logger.info('deleteSession - Unité supprimée', { 
          unit_id: unit.id, 
          unit_name: unit.nom,
          members_deleted: deletedMembers.count
        });
      }

      // Supprimer toutes les unités de la session
      const deletedUnits = await tx.unit.deleteMany({
        where: { session_id: id }
      });

      logger.info('deleteSession - Unités supprimées', { count: deletedUnits.count });

      // 2. Nettoyer les qualifications des responsables avant de supprimer la session
      const QualificationService = require('../services/qualificationService');
      const qualificationService = new QualificationService(tx);
      await qualificationService.cleanupSessionQualification(id);

      // 3. Supprimer la session
      await tx.session.delete({
        where: { id }
      });

      logger.info('deleteSession - Session supprimée avec succès', { session_id: id });
    });

    res.json({
      success: true,
      message: 'Session supprimée avec succès'
    });
  } catch (error) {
    logger.error('Session - deleteSession - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression de la session');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer les statistiques d'une session
// Récupérer toutes les stats des sessions d'une église en une seule requête
exports.getSessionsStats = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage par église si spécifié
    if (req.query.churchId) {
      where.church_id = req.query.churchId;
    } else if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Filtrage automatique pour les managers seulement si pas d'église spécifiée
      where.church_id = req.user.eglise_locale_id;
    } else {
      // Si aucune église n'est spécifiée et que l'utilisateur n'est pas un manager, retourner une erreur
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis pour récupérer les statistiques des sessions'
      });
    }

    logger.info('getSessionsStats - req.query', req.query);
    logger.info('getSessionsStats - Filtres appliqués', where);

    // Récupérer toutes les sessions avec leurs unités, membres et responsables
    const sessions = await prisma.session.findMany({
      where,
      include: {
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
        },
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

    logger.info('getSessionsStats - Sessions trouvées', { count: sessions.length });

    // Si aucune session n'est trouvée, retourner un tableau vide
    if (sessions.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Aucune session trouvée pour cette église'
      });
    }

    // Calculer les statistiques pour chaque session (même format que getSessionStatsById)
    const sessionsWithStats = sessions.map(session => {
      const memberIds = new Set();
      const userQualifications = new Map(); // Map pour éviter les doublons par utilisateur
      const unitResponsables = new Set();

      // Traiter les unités
      session.units.forEach(unit => {
        // Ajouter les membres de l'unité
        unit.members.forEach(member => {
          if (member.user) {
            memberIds.add(member.user.id);
            // Ne pas ajouter de doublons pour le même utilisateur
            if (!userQualifications.has(member.user.id)) {
              userQualifications.set(member.user.id, member.user.qualification);
            }
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
      if (session.responsable1) {
        memberIds.add(session.responsable1.id);
        if (!userQualifications.has(session.responsable1.id)) {
          userQualifications.set(session.responsable1.id, session.responsable1.qualification);
        }
      }
      if (session.responsable2) {
        memberIds.add(session.responsable2.id);
        if (!userQualifications.has(session.responsable2.id)) {
          userQualifications.set(session.responsable2.id, session.responsable2.qualification);
        }
      }

      // Compter uniquement les qualifications session/unité
      const qualificationsArray = Array.from(userQualifications.values());
      const stats = {
        totalUnits: session.units.length,
        'RESPONSABLE_UNITE': qualificationsArray.filter(q => q === 'RESPONSABLE_UNITE').length,
        'Membre simple': qualificationsArray.filter(q => q === 'MEMBRE_SESSION').length,
        totalMembers: memberIds.size
      };

      return {
        id: session.id,
        nom: session.nom,
        stats
      };
    });

    logger.info('getSessionsStats - Statistiques calculées', sessionsWithStats.map(s => ({
      nom: s.nom,
      totalMembers: s.stats.totalMembers,
      totalUnits: s.stats.totalUnits
    })));

    res.json({
      success: true,
      data: sessionsWithStats
    });
  } catch (error) {
    logger.error('Session - getSessionsStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques des sessions');

    res.status(status).json({
      success: false,
      message
    });
  }
};

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

    // Calculer les statistiques par qualification (même logique que networkController)
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
      'RESPONSABLE_UNITE': qualificationsArray.filter(q => q === 'RESPONSABLE_UNITE').length,
      'Membre simple': qualificationsArray.filter(q => q === 'MEMBRE_SESSION').length,
      totalMembers: memberIds.size
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Session - getSessionStatsById - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des statistiques de la session');
    res.status(status).json({
      success: false,
      message
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
        responsable1: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true
          }
        },
        superieur_hierarchique: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                pseudo: true,
                qualification: true,
                image: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: units
    });
  } catch (error) {
    logger.error('Session - getSessionUnits - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des unités');
    res.status(status).json({
      success: false,
      message
    });
  }
};
