const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

// Fonction utilitaire pour vérifier les doublons par semaine et type de culte
const checkDuplicatePrevisionnel = async (network_id, date, type_culte, excludeId = null) => {
  try {
    // Calculer le début et la fin de la semaine (lundi à dimanche)
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = dimanche, 1 = lundi
    
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Vérifier s'il existe déjà un previsionnel pour cette semaine et ce type de culte
    const existingPrevisionnel = await prisma.previsionnel.findFirst({
      where: {
        network_id,
        type_culte,
        date: {
          gte: monday,
          lte: sunday
        },
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    
    return existingPrevisionnel;
  } catch (error) {
    logger.error('❌ Erreur lors de la vérification des doublons:', error);
    throw error;
  }
};

// Créer un nouveau prévisionnel
const createPrevisionnel = async (req, res) => {
  try {
    logger.info('🔍 Création prévisionnel - Données reçues:', { body: req.body });
    const { date, type_culte, total_prevu, invites, network_id, church_id, groupes_previsions, responsables_reseau, compagnons_oeuvre } = req.body;
    const created_by_id = req.user.id;

    logger.info('🔍 Vérification réseau:', { network_id, created_by_id });
    
    // Vérifier que le réseau existe
    const network = await prisma.network.findUnique({
      where: { id: network_id }
    });

    if (!network) {
      logger.error('❌ Réseau non trouvé:', { network_id });
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }
    
    logger.info('✅ Réseau trouvé:', { network_id: network.id, church_id: church_id });

    // Vérifier que l'utilisateur a accès à ce réseau
    if (req.user.role !== 'SUPER_ADMIN' && req.user.eglise_locale_id !== church_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce réseau'
      });
    }

    // Vérifier s'il n'y a pas déjà un previsionnel pour cette semaine et ce type de culte
    const duplicatePrevisionnel = await checkDuplicatePrevisionnel(network_id, date, type_culte);
    if (duplicatePrevisionnel) {
      logger.warn('⚠️ Tentative de création d\'un previsionnel en doublon:', {
        network_id,
        date,
        type_culte,
        existing_id: duplicatePrevisionnel.id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà un prévisionnel pour la semaine du ${new Date(date).toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Créer le prévisionnel avec ses groupes
    const previsionnel = await prisma.$transaction(async (tx) => {
      // 1. Créer le prévisionnel principal
      const newPrevisionnel = await tx.previsionnel.create({
        data: {
          date: new Date(date),
          type_culte,
          total_prevu,
          invites: invites || 0,
          responsables_reseau: responsables_reseau || 0,
          compagnons_oeuvre: compagnons_oeuvre || 0,
          network_id,
          church_id,
          created_by_id
        }
      });

      // 2. Créer les prévisions pour chaque groupe
      const groupesPrevisions = await Promise.all(
        groupes_previsions.map(async (groupe) => {
          return await tx.groupePrevision.create({
            data: {
              previsionnel_id: newPrevisionnel.id,
              group_id: groupe.group_id,
              effectif_actuel: groupe.effectif_actuel,
              valeur_previsionnelle: groupe.valeur_previsionnelle
            }
          });
        })
      );

      return {
        ...newPrevisionnel,
        groupes_previsions: groupesPrevisions
      };
    });

    logger.info(`✅ Prévisionnel créé avec succès: ${previsionnel.id} pour le réseau ${network_id}`);

    res.status(201).json({
      success: true,
      message: 'Prévisionnel créé avec succès',
      data: previsionnel
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la création du prévisionnel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du prévisionnel',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer tous les prévisionnels d'un réseau
const getPrevisionnelsByNetwork = async (req, res) => {
  try {
    const { networkId } = req.params;
    const { page = 1, limit = 10, type_culte, date_from, date_to } = req.query;

    // Vérifier que le réseau existe
    const network = await prisma.network.findUnique({
      where: { id: networkId },
      include: { church: true }
    });

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.eglise_locale_id !== network.church_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce réseau'
      });
    }

    // Construire les filtres
    const where = { network_id: networkId };
    
    if (type_culte && type_culte !== 'Tous') {
      where.type_culte = type_culte;
    }
    
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    // Récupérer les prévisionnels avec pagination
    const [previsionnels, total] = await Promise.all([
      prisma.previsionnel.findMany({
        where,
        include: {
          groupes_previsions: {
            include: {
              group: {
                select: {
                  id: true,
                  nom: true,
                  responsable1: { select: { username: true } },
                  responsable2: { select: { username: true } }
                }
              }
            }
          },
          created_by: { select: { username: true, pseudo: true } }
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit)
      }),
      prisma.previsionnel.count({ where })
    ]);

    res.json({
      success: true,
      data: previsionnels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des prévisionnels:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prévisionnels',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer un prévisionnel par ID
const getPrevisionnelById = async (req, res) => {
  try {
    const { id } = req.params;

    const previsionnel = await prisma.previsionnel.findUnique({
      where: { id },
      include: {
        network: { select: { nom: true, church: { select: { nom: true } } } },
        groupes_previsions: {
          include: {
            group: {
              select: {
                id: true,
                nom: true,
                responsable1: { select: { username: true } },
                responsable2: { select: { username: true } }
              }
            }
          }
        },
        created_by: { select: { username: true, pseudo: true } }
      }
    });

    if (!previsionnel) {
      return res.status(404).json({
        success: false,
        message: 'Prévisionnel non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.eglise_locale_id !== previsionnel.church_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce prévisionnel'
      });
    }

    res.json({
      success: true,
      data: previsionnel
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération du prévisionnel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du prévisionnel',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Mettre à jour un prévisionnel
const updatePrevisionnel = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type_culte, total_prevu, invites, groupes_previsions, responsables_reseau, compagnons_oeuvre } = req.body;

    // Vérifier que le prévisionnel existe
    const existingPrevisionnel = await prisma.previsionnel.findUnique({
      where: { id },
      include: { network: true }
    });

    if (!existingPrevisionnel) {
      return res.status(404).json({
        success: false,
        message: 'Prévisionnel non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.eglise_locale_id !== existingPrevisionnel.church_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce prévisionnel'
      });
    }

    // Vérifier s'il n'y a pas déjà un previsionnel pour cette semaine et ce type de culte (en excluant l'actuel)
    const duplicatePrevisionnel = await checkDuplicatePrevisionnel(
      existingPrevisionnel.network_id, 
      date, 
      type_culte, 
      id
    );
    if (duplicatePrevisionnel) {
      logger.warn('⚠️ Tentative de mise à jour vers un previsionnel en doublon:', {
        network_id: existingPrevisionnel.network_id,
        date,
        type_culte,
        existing_id: duplicatePrevisionnel.id,
        updating_id: id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà un prévisionnel pour la semaine du ${new Date(date).toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Mettre à jour le prévisionnel
    const updatedPrevisionnel = await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le prévisionnel principal
      const updated = await tx.previsionnel.update({
        where: { id },
        data: {
          date: new Date(date),
          type_culte,
          total_prevu,
          invites: invites || 0,
          responsables_reseau: responsables_reseau || 0,
          compagnons_oeuvre: compagnons_oeuvre || 0
        }
      });

      // 2. Supprimer les anciennes prévisions de groupes
      await tx.groupePrevision.deleteMany({
        where: { previsionnel_id: id }
      });

      // 3. Créer les nouvelles prévisions de groupes
      const groupesPrevisions = await Promise.all(
        groupes_previsions.map(async (groupe) => {
          return await tx.groupePrevision.create({
            data: {
              previsionnel_id: id,
              group_id: groupe.group_id,
              effectif_actuel: groupe.effectif_actuel,
              valeur_previsionnelle: groupe.valeur_previsionnelle
            }
          });
        })
      );

      return {
        ...updated,
        groupes_previsions: groupesPrevisions
      };
    });

    logger.info(`✅ Prévisionnel mis à jour avec succès: ${id}`);

    res.json({
      success: true,
      message: 'Prévisionnel mis à jour avec succès',
      data: updatedPrevisionnel
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la mise à jour du prévisionnel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du prévisionnel',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Supprimer un prévisionnel
const deletePrevisionnel = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le prévisionnel existe
    const previsionnel = await prisma.previsionnel.findUnique({
      where: { id },
      include: { network: true }
    });

    if (!previsionnel) {
      return res.status(404).json({
        success: false,
        message: 'Prévisionnel non trouvé'
      });
    }

    // Vérifier les permissions
    if (req.user.role !== 'SUPER_ADMIN' && req.user.eglise_locale_id !== previsionnel.church_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce prévisionnel'
      });
    }

    // Supprimer le prévisionnel (les groupes_previsions seront supprimés automatiquement via CASCADE)
    await prisma.previsionnel.delete({
      where: { id }
    });

    logger.info(`✅ Prévisionnel supprimé avec succès: ${id}`);

    res.json({
      success: true,
      message: 'Prévisionnel supprimé avec succès'
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la suppression du prévisionnel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du prévisionnel',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les statistiques de prévisionnels pour le dashboard
const getPrevisionnelStats = async (req, res) => {
  try {
    const { church_id, network_id, type_culte, date_from, date_to } = req.query;

    // Construire les filtres
    const where = {};
    
    if (church_id) where.church_id = church_id;
    if (network_id) where.network_id = network_id;
    if (type_culte && type_culte !== 'Tous') where.type_culte = type_culte;
    
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    // Récupérer les prévisionnels avec leurs statistiques
    const previsionnels = await prisma.previsionnel.findMany({
      where,
      include: {
        network: { select: { nom: true } },
        groupes_previsions: true
      },
      orderBy: { date: 'desc' }
    });

    // Calculer les statistiques
    const stats = previsionnels.map(previsionnel => {
      const totalPrevu = previsionnel.total_prevu || 0;
      const totalReel = previsionnel.groupes_previsions.reduce((sum, gp) => sum + (gp.effectif_actuel || 0), 0);
      
      return {
        id: previsionnel.id,
        date: previsionnel.date,
        type_culte: previsionnel.type_culte,
        network_nom: previsionnel.network.nom,
        total_prevu: totalPrevu,
        total_reel: totalReel,
        difference: totalPrevu - totalReel,
        precision: totalReel > 0 ? ((totalPrevu - totalReel) / totalReel * 100).toFixed(1) : 0
      };
    });

    // Transformer les données pour correspondre à la structure attendue par le frontend
    const transformedStats = {
      total_effectif: stats.reduce((sum, stat) => sum + stat.total_reel, 0),
      total_previsionnel: stats.reduce((sum, stat) => sum + stat.total_prevu, 0),
      precision: stats.length > 0 ? 
        (stats.reduce((sum, stat) => sum + parseFloat(stat.precision), 0) / stats.length).toFixed(1) : 0,
      chart_data: stats.map(stat => ({
        date: stat.date.toISOString().split('T')[0],
        effectif_reel: stat.total_reel,
        previsionnel: stat.total_prevu
      })),
      details: stats.map(stat => ({
        id: stat.id,
        network_name: stat.network_nom,
        type_culte: stat.type_culte,
        date: stat.date,
        effectif_reel: stat.total_reel,
        previsionnel: stat.total_prevu,
        difference: stat.difference,
        precision: parseFloat(stat.precision)
      }))
    };

    res.json({
      success: true,
      data: transformedStats
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des statistiques de prévisionnels:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  createPrevisionnel,
  getPrevisionnelsByNetwork,
  getPrevisionnelById,
  updatePrevisionnel,
  deletePrevisionnel,
  getPrevisionnelStats
};
