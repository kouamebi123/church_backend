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

    const cacheKey = cache.generateKey('sessions', {
      ...filter,
      role: req.user?.role,
      userId: req.user?.id
    });

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

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

    const response = {
      success: true,
      count: sessions.length,
      data: sessions
    };

    cache.set(cacheKey, response, 120000);

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

    res.status(201).json({
      success: true,
      message: 'Session créée avec succès',
      data: session
    });
  } catch (error) {
    logger.error('Session - createSession - Erreur complète', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Une session avec ce nom existe déjà'
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

    await prisma.session.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Session supprimée avec succès'
    });
  } catch (error) {
    logger.error('Session - deleteSession - Erreur complète', error);

    const { status, message } = handleError(error, 'la suppression de la session');
    res.status(status).json({
      success: false,
      message
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

    const memberIds = new Set();
    const userQualifications = new Map();

    session.units.forEach(unit => {
      unit.members.forEach(member => {
        const userId = member.user?.id || member.user_id;
        if (userId) {
          memberIds.add(userId);
          if (!userQualifications.has(userId)) {
            userQualifications.set(userId, member.user.qualification);
          }
        }
      });
    });

    const qualificationsArray = Array.from(userQualifications.values());
    const stats = {};

    qualificationsArray.forEach(q => {
      stats[q] = (stats[q] || 0) + 1;
    });

    const totalUnits = session.units.length;
    const totalMembers = memberIds.size;

    res.status(200).json({
      success: true,
      data: {
        totalUnits,
        totalMembers,
        stats
      }
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
