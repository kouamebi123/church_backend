const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Récupérer tous les services avec filtrage automatique pour les managers
exports.getServices = async (req, res) => {
  try {
    logger.info('Service - getServices - Début de la fonction');
    logger.info('Service - getServices - req.query', req.query);
    logger.info('Service - getServices - req.user', req.user);

    const { prisma } = req;

    const where = {};

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        where.eglise_id = churchId;
      }
    } else {
      // Pour les autres rôles, utiliser le filtre par église si spécifié
      if (req.query.churchId) {
        where.eglise_id = req.query.churchId;
      } else if (req.user && req.user.eglise_locale_id) {
        // Si pas de filtre spécifique, filtrer par l'église de l'utilisateur connecté
        const userChurchId = typeof req.user.eglise_locale_id === 'object'
          ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
          : req.user.eglise_locale_id;

        if (userChurchId) {
          where.eglise_id = userChurchId;
        }
      }
    }

    logger.info('Service - getServices - Filtre final where', where);

    // Support de la pagination
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const skip = req.query.skip ? parseInt(req.query.skip, 10) : undefined;

    // Compter le total des services (pour la pagination)
    const totalCount = await prisma.service.count({ where });

    // Construire les options de requête
    const queryOptions = {
      where,
      include: {
        eglise: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        collecteur_culte: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        superviseur: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    };

    // Ajouter pagination si spécifiée
    if (limit !== undefined) {
      queryOptions.take = limit;
    }
    if (skip !== undefined) {
      queryOptions.skip = skip;
    }

    const services = await prisma.service.findMany(queryOptions);

    res.status(200).json({
      success: true,
      count: services.length,
      total: totalCount,
      limit: limit,
      skip: skip,
      hasMore: limit && skip !== undefined ? (skip + limit < totalCount) : false,
      data: services
    });
  } catch (error) {
    logger.error('Service - getServices - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des services');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer un service par ID
exports.getService = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        eglise: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        collecteur_culte: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        superviseur: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Vérifier que l'utilisateur peut accéder à ce service
    if (req.user && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const userChurchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (service.eglise_id !== userChurchId) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez accéder qu\'aux services de votre église'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Service - getService - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du service');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un nouveau service
exports.createService = async (req, res) => {
  try {
    const { prisma } = req;
    const {
      date, culte, orateur, eglise_id, description, nombre_present, responsable_id,
      total_adultes, total_enfants, total_chantres, total_protocoles, total_multimedia,
      total_respo_ecodim, total_animateurs_ecodim, total_enfants_ecodim, nouvelle_naissance,
      adultes_restants, enfants_restants, chantres_restants, protocoles_restants,
      multimedia_restants, respo_ecodim_restants, animateurs_ecodim_restants, enfants_ecodim_restants,
      collecteur_culte_id, superviseur_id,
      invitationYoutube, invitationTiktok, invitationInstagram, invitationPhysique
    } = req.body;

    if (!date || !culte || !orateur || !eglise_id || !collecteur_culte_id || !superviseur_id) {
      return res.status(400).json({
        success: false,
        message: 'La date, le culte, l\'orateur, l\'église, le collecteur culte et le superviseur sont requis'
      });
    }

    // Vérifier si l'église existe
    const church = await prisma.church.findUnique({
      where: { id: eglise_id }
    });

    if (!church) {
      return res.status(400).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Vérifier si le responsable existe (si fourni)
    if (responsable_id) {
      const responsable = await prisma.user.findUnique({
        where: { id: responsable_id }
      });

      if (!responsable) {
        return res.status(400).json({
          success: false,
          message: 'Responsable non trouvé'
        });
      }
    }

    // Vérifier si le collecteur culte existe
    const collecteurCulte = await prisma.user.findUnique({
      where: { id: collecteur_culte_id }
    });

    if (!collecteurCulte) {
      return res.status(400).json({
        success: false,
        message: 'Collecteur culte non trouvé'
      });
    }

    // Vérifier si le superviseur existe
    const superviseur = await prisma.user.findUnique({
      where: { id: superviseur_id }
    });

    if (!superviseur) {
      return res.status(400).json({
        success: false,
        message: 'Superviseur non trouvé'
      });
    }

    // Créer le service
    const service = await prisma.service.create({
      data: {
        date: new Date(date),
        culte,
        orateur,
        eglise_id,
        description,
        nombre_present: nombre_present ? parseInt(nombre_present) : null,
        responsable_id: responsable_id || null,
        total_adultes: total_adultes ? parseInt(total_adultes) : 0,
        total_enfants: total_enfants ? parseInt(total_enfants) : 0,
        total_chantres: total_chantres ? parseInt(total_chantres) : 0,
        total_protocoles: total_protocoles ? parseInt(total_protocoles) : 0,
        total_multimedia: total_multimedia ? parseInt(total_multimedia) : 0,
        total_respo_ecodim: total_respo_ecodim ? parseInt(total_respo_ecodim) : 0,
        total_animateurs_ecodim: total_animateurs_ecodim ? parseInt(total_animateurs_ecodim) : 0,
        total_enfants_ecodim: total_enfants_ecodim ? parseInt(total_enfants_ecodim) : 0,
        nouvelle_naissance: nouvelle_naissance ? parseInt(nouvelle_naissance) : 0,
        adultes_restants: adultes_restants ? parseInt(adultes_restants) : 0,
        enfants_restants: enfants_restants ? parseInt(enfants_restants) : 0,
        chantres_restants: chantres_restants ? parseInt(chantres_restants) : 0,
        protocoles_restants: protocoles_restants ? parseInt(protocoles_restants) : 0,
        multimedia_restants: multimedia_restants ? parseInt(multimedia_restants) : 0,
        respo_ecodim_restants: respo_ecodim_restants ? parseInt(respo_ecodim_restants) : 0,
        animateurs_ecodim_restants: animateurs_ecodim_restants ? parseInt(animateurs_ecodim_restants) : 0,
        enfants_ecodim_restants: enfants_ecodim_restants ? parseInt(enfants_ecodim_restants) : 0,
        collecteur_culte_id,
        superviseur_id,
        invitationYoutube: invitationYoutube ? parseInt(invitationYoutube) : 0,
        invitationTiktok: invitationTiktok ? parseInt(invitationTiktok) : 0,
        invitationInstagram: invitationInstagram ? parseInt(invitationInstagram) : 0,
        invitationPhysique: invitationPhysique ? parseInt(invitationPhysique) : 0
      },
      include: {
        eglise: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        collecteur_culte: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        superviseur: {
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
      data: service
    });
  } catch (error) {
    logger.error('Service - createService - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la création du service');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour un service
exports.updateService = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    logger.info('updateService - Début de la fonction');
    logger.info('updateService - ID du service', { id });
    logger.info('updateService - Données reçues', updateData);

    // Vérifier si le service existe
    const existingService = await prisma.service.findUnique({
      where: { id }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Nettoyer et préparer les données de mise à jour
    const cleanUpdateData = {};

    // Champs de base
    if (updateData.culte !== undefined) cleanUpdateData.culte = updateData.culte;
    if (updateData.orateur !== undefined) cleanUpdateData.orateur = updateData.orateur;
    if (updateData.date !== undefined) cleanUpdateData.date = new Date(updateData.date);
    if (updateData.theme !== undefined) cleanUpdateData.theme = updateData.theme;

    // Champs numériques avec validation
    if (updateData.total_adultes !== undefined) cleanUpdateData.total_adultes = parseInt(updateData.total_adultes) || 0;
    if (updateData.total_enfants !== undefined) cleanUpdateData.total_enfants = parseInt(updateData.total_enfants) || 0;
    if (updateData.total_chantres !== undefined) cleanUpdateData.total_chantres = parseInt(updateData.total_chantres) || 0;
    if (updateData.total_protocoles !== undefined) cleanUpdateData.total_protocoles = parseInt(updateData.total_protocoles) || 0;
    if (updateData.total_multimedia !== undefined) cleanUpdateData.total_multimedia = parseInt(updateData.total_multimedia) || 0;
    if (updateData.total_respo_ecodim !== undefined) cleanUpdateData.total_respo_ecodim = parseInt(updateData.total_respo_ecodim) || 0;
    if (updateData.total_animateurs_ecodim !== undefined) cleanUpdateData.total_animateurs_ecodim = parseInt(updateData.total_animateurs_ecodim) || 0;
    if (updateData.total_enfants_ecodim !== undefined) cleanUpdateData.total_enfants_ecodim = parseInt(updateData.total_enfants_ecodim) || 0;
    if (updateData.nouvelle_naissance !== undefined) cleanUpdateData.nouvelle_naissance = parseInt(updateData.nouvelle_naissance) || 0;
    if (updateData.adultes_restants !== undefined) cleanUpdateData.adultes_restants = parseInt(updateData.adultes_restants) || 0;
    if (updateData.enfants_restants !== undefined) cleanUpdateData.enfants_restants = parseInt(updateData.enfants_restants) || 0;
    if (updateData.chantres_restants !== undefined) cleanUpdateData.chantres_restants = parseInt(updateData.chantres_restants) || 0;
    if (updateData.protocoles_restants !== undefined) cleanUpdateData.protocoles_restants = parseInt(updateData.protocoles_restants) || 0;
    if (updateData.multimedia_restants !== undefined) cleanUpdateData.multimedia_restants = parseInt(updateData.multimedia_restants) || 0;
    if (updateData.respo_ecodim_restants !== undefined) cleanUpdateData.respo_ecodim_restants = parseInt(updateData.respo_ecodim_restants) || 0;
    if (updateData.animateurs_ecodim_restants !== undefined) cleanUpdateData.animateurs_ecodim_restants = parseInt(updateData.animateurs_ecodim_restants) || 0;
    if (updateData.enfants_ecodim_restants !== undefined) cleanUpdateData.enfants_ecodim_restants = parseInt(updateData.enfants_ecodim_restants) || 0;

    // Champs d'invitation
    if (updateData.invitationYoutube !== undefined) cleanUpdateData.invitationYoutube = parseInt(updateData.invitationYoutube) || 0;
    if (updateData.invitationTiktok !== undefined) cleanUpdateData.invitationTiktok = parseInt(updateData.invitationTiktok) || 0;
    if (updateData.invitationInstagram !== undefined) cleanUpdateData.invitationInstagram = parseInt(updateData.invitationInstagram) || 0;
    if (updateData.invitationPhysique !== undefined) cleanUpdateData.invitationPhysique = parseInt(updateData.invitationPhysique) || 0;

    // Champs de relation (IDs)
    if (updateData.collecteur_culte_id !== undefined) cleanUpdateData.collecteur_culte_id = updateData.collecteur_culte_id;
    if (updateData.superviseur_id !== undefined) cleanUpdateData.superviseur_id = updateData.superviseur_id;
    if (updateData.responsable_id !== undefined) cleanUpdateData.responsable_id = updateData.responsable_id;

    logger.info('updateService - Données nettoyées', cleanUpdateData);

    // Mettre à jour le service
    const updatedService = await prisma.service.update({
      where: { id },
      data: cleanUpdateData,
      include: {
        eglise: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        collecteur_culte: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        superviseur: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      }
    });

    logger.info('updateService - Service mis à jour avec succès', updatedService);

    res.json({
      success: true,
      data: updatedService
    });
  } catch (error) {
    logger.error('Service - updateService - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour du service');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un service
exports.deleteService = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si le service existe
    const existingService = await prisma.service.findUnique({
      where: { id }
    });

    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service non trouvé'
      });
    }

    // Supprimer le service
    await prisma.service.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Service supprimé avec succès'
    });
  } catch (error) {
    logger.error('Service - deleteService - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression du service');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les statistiques des services
exports.getServiceStats = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_id = req.user.eglise_locale_id;
    }

    const stats = await prisma.service.aggregate({
      where,
      _count: {
        id: true
      },
      _sum: {
        nombre_present: true
      },
      _avg: {
        nombre_present: true
      }
    });

    // Obtenir les services par mois pour l'année en cours
    const currentYear = new Date().getFullYear();
    const monthlyStats = await prisma.service.groupBy({
      by: ['date'],
      where: {
        ...where,
        date: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1)
        }
      },
      _count: {
        id: true
      }
    });

    // Grouper par mois
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = monthlyStats.filter(s => {
        const serviceDate = new Date(s.date);
        return serviceDate.getMonth() === i;
      });
      return month.length;
    });

    res.json({
      success: true,
      data: {
        totalServices: stats._count.id,
        totalAttendance: stats._sum.nombre_present || 0,
        averageAttendance: Math.round(stats._avg.nombre_present || 0),
        monthlyDistribution: monthlyData
      }
    });
  } catch (error) {
    logger.error('Service - getServiceStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques des services');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les services par période
exports.getServicesByPeriod = async (req, res) => {
  try {
    const { prisma } = req;
    const { startDate, endDate } = req.query;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_id = req.user.eglise_locale_id;
    }

    // Filtrage par période si fournie
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        eglise: {
          select: {
            id: true,
            nom: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    logger.error('Service - getServicesByPeriod - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des services par période');

    res.status(status).json({
      success: false,
      message
    });
  }
};
