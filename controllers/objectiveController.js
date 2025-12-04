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

    // Désactiver les anciens objectifs actifs
    await req.prisma.networkObjective.updateMany({
      where: {
        network_id: networkId,
        active: true
      },
      data: {
        active: false
      }
    });

    // Créer le nouvel objectif
    const objective = await req.prisma.networkObjective.create({
      data: {
        network_id: networkId,
        objectif: parseInt(objectif),
        date_fin: dateFin,
        description: description || null,
        active: true
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

/**
 * Générer un message d'encouragement/félicitation/rappel basé sur l'objectif
 */
exports.getObjectiveMessage = async (req, res) => {
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
        data: {
          message: 'Aucun objectif défini pour ce réseau',
          type: 'info'
        }
      });
    }

    // Calculer l'effectif actuel
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
    const daysRemaining = Math.max(0, Math.ceil((new Date(objective.date_fin) - new Date()) / (1000 * 60 * 60 * 24)));
    const daysSinceCreation = Math.floor((new Date() - new Date(objective.createdAt)) / (1000 * 60 * 60 * 24));
    const monthsSinceCreation = Math.floor(daysSinceCreation / 30);

    // Générer le message selon la progression
    let message = '';
    let type = 'info';
    let color = '#662d91';

    if (progress >= 100) {
      // Objectif atteint
      message = `🎉 Félicitations ! Vous avez atteint votre objectif de ${objective.objectif} membres ! Continuez sur cette lancée !`;
      type = 'success';
      color = '#4caf50';
    } else if (progress >= 80) {
      // Très proche de l'objectif
      message = `🌟 Excellent travail ! Vous êtes à ${Math.round(progress)}% de votre objectif. Plus que ${objective.objectif - currentCount} membres pour y arriver !`;
      type = 'encouragement';
      color = '#8bc34a';
    } else if (progress >= 50) {
      // Bonne progression
      message = `💪 Vous êtes sur la bonne voie ! ${Math.round(progress)}% de l'objectif atteint. Il reste ${daysRemaining} jours pour atteindre ${objective.objectif} membres.`;
      type = 'encouragement';
      color = '#ff9800';
    } else if (progress >= 25) {
      // Progression moyenne
      message = `📈 Vous avez fait ${currentCount} membres sur ${objective.objectif}. Continuez vos efforts, il reste ${daysRemaining} jours !`;
      type = 'reminder';
      color = '#ff9800';
    } else {
      // Progression faible
      message = `🎯 Objectif : ${objective.objectif} membres. Actuellement : ${currentCount} membres. Il reste ${daysRemaining} jours. Ne lâchez rien !`;
      type = 'reminder';
      color = '#f44336';
    }

    // Ajouter un message de rappel si pas d'évolution depuis longtemps
    if (monthsSinceCreation >= 3 && progress < 50) {
      message += ` ⚠️ Attention : Cela fait ${monthsSinceCreation} mois que le réseau n'a pas beaucoup évolué. Il est temps de redoubler d'efforts !`;
      type = 'warning';
      color = '#f44336';
    } else if (monthsSinceCreation >= 2 && progress < 30) {
      message += ` ⚠️ Rappel : ${monthsSinceCreation} mois sans évolution significative. Mobilisez-vous !`;
      type = 'warning';
      color = '#ff9800';
    }

    res.status(200).json({
      success: true,
      data: {
        message,
        type,
        color,
        progress: Math.round(progress),
        currentCount,
        objective: objective.objectif,
        daysRemaining
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la génération du message', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du message',
      error: error.message
    });
  }
};

