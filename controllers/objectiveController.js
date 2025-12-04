const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');

/**
 * Récupérer l'objectif actif d'un réseau
 */
exports.getNetworkObjective = async (req, res) => {
  try {
    const networkId = req.params.id || req.params.networkId;

    // Récupérer l'objectif principal (is_main = true) ou le plus récent actif
    const objective = await req.prisma.networkObjective.findFirst({
      where: {
        network_id: networkId,
        active: true,
        is_main: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        network: {
          select: {
            id: true,
            nom: true,
            groups: {
              include: {
                members: {
                  select: {
                    user_id: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!objective) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Aucun objectif actif pour ce réseau'
      });
    }

    // Calculer l'effectif actuel du réseau
    const currentMembers = new Set();
    objective.network.groups.forEach(group => {
      group.members.forEach(member => {
        currentMembers.add(member.user_id);
      });
    });

    const currentCount = currentMembers.size;
    const progress = objective.objectif > 0 
      ? Math.min((currentCount / objective.objectif) * 100, 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        ...objective,
        currentCount,
        progress: Math.round(progress),
        daysRemaining: Math.max(0, Math.ceil((new Date(objective.date_fin) - new Date()) / (1000 * 60 * 60 * 24)))
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'objectif', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'objectif',
      error: error.message
    });
  }
};

/**
 * Récupérer tous les objectifs d'un réseau
 */
exports.getNetworkObjectives = async (req, res) => {
  try {
    const networkId = req.params.id || req.params.networkId;

    const objectives = await req.prisma.networkObjective.findMany({
      where: {
        network_id: networkId
      },
      orderBy: [
        { is_main: 'desc' }, // Objectifs principaux en premier
        { createdAt: 'desc' }
      ]
    });

    res.status(200).json({
      success: true,
      data: objectives
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des objectifs', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des objectifs',
      error: error.message
    });
  }
};

/**
 * Créer un objectif pour un réseau
 */
exports.createNetworkObjective = async (req, res) => {
  try {
    const networkId = req.params.id || req.params.networkId;
    
    if (!networkId) {
      return res.status(400).json({
        success: false,
        message: 'ID du réseau requis'
      });
    }
    
    const { objectif, date_fin, description, is_main } = req.body;

    // Validation
    if (!objectif || !date_fin) {
      return res.status(400).json({
        success: false,
        message: 'L\'objectif et la date de fin sont requis'
      });
    }

    if (objectif <= 0) {
      return res.status(400).json({
        success: false,
        message: 'L\'objectif doit être supérieur à 0'
      });
    }

    const dateFin = new Date(date_fin);
    if (isNaN(dateFin.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Date de fin invalide'
      });
    }

    if (dateFin <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être dans le futur'
      });
    }

    // Vérifier que le réseau existe
    const network = await req.prisma.network.findUnique({
      where: { id: networkId }
    });

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    const isMainObjective = is_main === true || is_main === 'true';
    
    // Si c'est un objectif principal, désactiver uniquement les anciens objectifs principaux actifs
    // Les objectifs à court terme ne sont pas affectés - on peut en avoir plusieurs actifs
    if (isMainObjective) {
      await req.prisma.networkObjective.updateMany({
        where: {
          network_id: networkId,
          active: true,
          is_main: true
        },
        data: {
          active: false
        }
      });
    }
    // Si c'est un objectif à court terme, on ne désactive rien - on peut en avoir plusieurs actifs

    // Créer le nouvel objectif
    const objective = await req.prisma.networkObjective.create({
      data: {
        network_id: networkId,
        objectif: parseInt(objectif),
        date_fin: dateFin,
        description: description || null,
        active: true,
        is_main: isMainObjective
      }
    });

    res.status(201).json({
      success: true,
      data: objective,
      message: 'Objectif créé avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la création de l\'objectif', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'objectif',
      error: error.message
    });
  }
};

/**
 * Mettre à jour un objectif
 */
exports.updateNetworkObjective = async (req, res) => {
  try {
    const { objectiveId } = req.params;
    const { objectif, date_fin, description, active, is_main } = req.body;

    const objective = await req.prisma.networkObjective.findUnique({
      where: { id: objectiveId }
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Objectif non trouvé'
      });
    }

    const updateData = {};
    if (objectif !== undefined) {
      if (objectif <= 0) {
        return res.status(400).json({
          success: false,
          message: 'L\'objectif doit être supérieur à 0'
        });
      }
      updateData.objectif = parseInt(objectif);
    }

    if (date_fin !== undefined) {
      const dateFin = new Date(date_fin);
      if (isNaN(dateFin.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Date de fin invalide'
        });
      }
      updateData.date_fin = dateFin;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (active !== undefined) {
      updateData.active = active;
    }

    const updatedObjective = await req.prisma.networkObjective.update({
      where: { id: objectiveId },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: updatedObjective,
      message: 'Objectif mis à jour avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'objectif', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'objectif',
      error: error.message
    });
  }
};

/**
 * Supprimer un objectif
 */
exports.deleteNetworkObjective = async (req, res) => {
  try {
    const { objectiveId } = req.params;

    const objective = await req.prisma.networkObjective.findUnique({
      where: { id: objectiveId }
    });

    if (!objective) {
      return res.status(404).json({
        success: false,
        message: 'Objectif non trouvé'
      });
    }

    await req.prisma.networkObjective.delete({
      where: { id: objectiveId }
    });

    res.status(200).json({
      success: true,
      message: 'Objectif supprimé avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la suppression de l\'objectif', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'objectif',
      error: error.message
    });
  }
};


