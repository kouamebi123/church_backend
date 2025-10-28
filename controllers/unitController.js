const QualificationService = require('../services/qualificationService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');

// Fonction utilitaire pour générer le nom automatique d'une unité
const generateUnitName = async (prisma, sessionId) => {
  try {
    // Compter le nombre d'unités existantes dans la session
    const unitCount = await prisma.unit.count({
      where: { session_id: sessionId }
    });

    // Générer une lettre de l'alphabet pour l'unité
    const letter = String.fromCharCode(97 + unitCount); // 97 = 'a' en ASCII
    const letterUpper = letter.toUpperCase();

    return `Unité ${letterUpper}`;
  } catch (error) {
    logger.error('Erreur lors de la génération du nom de l\'unité', error);
    return 'Unité A';
  }
};

// Récupérer toutes les unités
exports.getUnits = async (req, res) => {
  try {
    const { prisma } = req;
    const { session_id } = req.query;

    const filter = {};
    if (session_id) {
      filter.session_id = session_id;
    }

    const units = await prisma.unit.findMany({
      where: filter,
      include: {
        session: {
          select: {
            id: true,
            nom: true
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
                qualification: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      count: units.length,
      data: units
    });
  } catch (error) {
    logger.error('Unit - getUnits - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des unités');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer une unité par ID
exports.getUnit = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        session: {
          select: {
            id: true,
            nom: true
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

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Unité introuvable'
      });
    }

    res.status(200).json({
      success: true,
      data: unit
    });
  } catch (error) {
    logger.error('Unit - getUnit - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération de l\'unité');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer une nouvelle unité
exports.createUnit = async (req, res) => {
  try {
    const { prisma } = req;
    const { session_id, responsable1_id, responsable2_id, superieur_hierarchique_id } = req.body;

    if (!session_id || !responsable1_id) {
      return res.status(400).json({
        success: false,
        message: 'Session et responsable 1 sont requis'
      });
    }

    // Générer le nom automatiquement
    const nom = await generateUnitName(prisma, session_id);

    const unit = await prisma.unit.create({
      data: {
        nom,
        session_id,
        responsable1_id,
        responsable2_id: responsable2_id || null,
        superieur_hierarchique_id: superieur_hierarchique_id || null
      },
      include: {
        session: {
          select: {
            id: true,
            nom: true
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
        }
      }
    });

    // Ajouter automatiquement les responsables comme membres de l'unité
    const responsablesToAdd = [];
    if (responsable1_id) {
      responsablesToAdd.push(responsable1_id);
    }
    if (responsable2_id) {
      responsablesToAdd.push(responsable2_id);
    }

    // Ajouter les responsables comme membres de l'unité
    for (const responsableId of responsablesToAdd) {
      try {
        await prisma.unitMember.create({
          data: {
            unit_id: unit.id,
            user_id: responsableId
          }
        });
        logger.info('Responsable ajouté comme membre de l\'unité', { responsableId, unitId: unit.id });
      } catch (error) {
        // Ignorer l'erreur si le responsable est déjà membre (contrainte unique)
        if (error.code !== 'P2002') {
          logger.error('Erreur lors de l\'ajout du responsable comme membre', { responsableId, error });
        }
      }
    }

    // Mettre à jour la qualification des responsables
    if (responsablesToAdd.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsablesToAdd } },
        data: { qualification: 'RESPONSABLE_UNITE' }
      });
      logger.info('Unit createUnit - Qualifications mises à jour pour les responsables', { responsables: responsablesToAdd });
    }

    res.status(201).json({
      success: true,
      message: 'Unité créée avec succès',
      data: unit
    });
  } catch (error) {
    logger.error('Unit - createUnit - Erreur complète', error);

    const { status, message } = handleError(error, 'la création de l\'unité');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour une unité
exports.updateUnit = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { nom, responsable1_id, responsable2_id, superieur_hierarchique_id, active } = req.body;

    // Récupérer l'unité actuelle pour connaître les anciens responsables
    const currentUnit = await prisma.unit.findUnique({
      where: { id },
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });

    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: {
        ...(nom && { nom }),
        ...(responsable1_id && { responsable1_id }),
        ...(responsable2_id !== undefined && { responsable2_id }),
        ...(superieur_hierarchique_id !== undefined && { superieur_hierarchique_id }),
        ...(active !== undefined && { active })
      },
      include: {
        session: {
          select: {
            id: true,
            nom: true
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
        }
      }
    });

    // Ajouter les nouveaux responsables comme membres s'ils ont changé
    const responsablesToAdd = [];
    
    // Vérifier si responsable1 a changé
    if (responsable1_id && responsable1_id !== currentUnit.responsable1_id) {
      responsablesToAdd.push(responsable1_id);
    }
    
    // Vérifier si responsable2 a changé
    if (responsable2_id && responsable2_id !== currentUnit.responsable2_id) {
      responsablesToAdd.push(responsable2_id);
    }

    // Ajouter les nouveaux responsables comme membres de l'unité
    for (const responsableId of responsablesToAdd) {
      try {
        await prisma.unitMember.create({
          data: {
            unit_id: updatedUnit.id,
            user_id: responsableId
          }
        });
        logger.info('Nouveau responsable ajouté comme membre de l\'unité', { responsableId, unitId: updatedUnit.id });
      } catch (error) {
        // Ignorer l'erreur si le responsable est déjà membre (contrainte unique)
        if (error.code !== 'P2002') {
          logger.error('Erreur lors de l\'ajout du responsable comme membre', { responsableId, error });
        }
      }
    }

    // Mettre à jour la qualification des responsables (anciens et nouveaux)
    const responsablesToUpdate = [];
    if (updatedUnit.responsable1_id) responsablesToUpdate.push(updatedUnit.responsable1_id);
    if (updatedUnit.responsable2_id) responsablesToUpdate.push(updatedUnit.responsable2_id);

    if (responsablesToUpdate.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsablesToUpdate } },
        data: { qualification: 'RESPONSABLE_UNITE' }
      });
      logger.info('Unit updateUnit - Qualifications mises à jour pour les responsables', { responsables: responsablesToUpdate });
    }

    res.status(200).json({
      success: true,
      message: 'Unité mise à jour avec succès',
      data: updatedUnit
    });
  } catch (error) {
    logger.error('Unit - updateUnit - Erreur complète', error);
    const { status, message } = handleError(error, 'la mise à jour de l\'unité');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer une unité
exports.deleteUnit = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    logger.info('Unit deleteUnit - Starting deletion for unit:', id);

    // Vérifier que l'unité existe et récupérer les membres et responsables
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        responsable1_id: true,
        responsable2_id: true,
        members: {
          select: { user_id: true }
        }
      }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Unité introuvable'
      });
    }

    // Collecter tous les utilisateurs à mettre à jour (membres + responsables)
    const allUserIds = new Set();
    
    // Ajouter les membres
    unit.members.forEach(member => {
      allUserIds.add(member.user_id);
    });
    
    // Ajouter les responsables
    if (unit.responsable1_id) allUserIds.add(unit.responsable1_id);
    if (unit.responsable2_id) allUserIds.add(unit.responsable2_id);

    // Mettre à jour la qualification de tous les utilisateurs à MEMBRE_IRREGULIER
    if (allUserIds.size > 0) {
      await prisma.user.updateMany({
        where: { id: { in: Array.from(allUserIds) } },
        data: { qualification: 'MEMBRE_IRREGULIER' }
      });
      logger.info('Unit deleteUnit - Utilisateurs remis à MEMBRE_IRREGULIER', { userIds: Array.from(allUserIds) });
    }

    // Supprimer tous les membres de l'unité
    await prisma.unitMember.deleteMany({
      where: {
        unit_id: id
      }
    });
    logger.info('Unit deleteUnit - Deleted all members');

    // Supprimer l'unité
    await prisma.unit.delete({
      where: { id }
    });
    logger.info('Unit deleteUnit - Deleted unit');

    res.status(200).json({
      success: true,
      message: 'Unité supprimée avec succès'
    });
  } catch (error) {
    logger.error('Unit - deleteUnit - Erreur complète', error);

    // Message d'erreur plus informatif
    let errorMessage = 'Erreur lors de la suppression de l\'unité';
    let statusCode = 500;
    
    if (error.code === 'P2003') {
      errorMessage = 'Impossible de supprimer cette unité. Il y a encore des références actives.';
      statusCode = 400;
    } else if (error.code === 'P2025') {
      errorMessage = 'Unité introuvable';
      statusCode = 404;
    } else if (error.code === 'P2002') {
      errorMessage = 'Contrainte de clé unique violée lors de la suppression';
      statusCode = 400;
    } else if (error.meta && error.meta.cause) {
      errorMessage = error.meta.cause;
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Ajouter un membre à une unité
exports.addMember = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id est requis'
      });
    }

    await prisma.unitMember.create({
      data: {
        unit_id: id,
        user_id
      }
    });

    // Mettre à jour la qualification du membre
    await prisma.user.update({
      where: { id: user_id },
      data: { qualification: 'MEMBRE_SESSION' }
    });

    res.status(200).json({
      success: true,
      message: 'Membre ajouté à l\'unité avec succès'
    });
  } catch (error) {
    logger.error('Unit - addMember - Erreur complète', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Ce membre est déjà dans cette unité'
      });
    }

    const { status, message } = handleError(error, 'l\'ajout du membre à l\'unité');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un membre d'une unité
exports.removeMember = async (req, res) => {
  try {
    const { prisma } = req;
    const { id, memberId } = req.params;

    // Vérifier si l'utilisateur est responsable de cette unité
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Unité introuvable'
      });
    }

    // Empêcher la suppression d'un responsable de sa propre unité
    if (unit.responsable1_id === memberId || unit.responsable2_id === memberId) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un responsable de sa propre unité. Pour supprimer un responsable, vous devez d\'abord changer le responsable de l\'unité ou supprimer l\'unité entière.'
      });
    }

    // Vérifier si le membre existe dans l'unité
    const existingMember = await prisma.unitMember.findUnique({
      where: {
        unit_id_user_id: {
          unit_id: id,
          user_id: memberId
        }
      }
    });

    if (!existingMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre introuvable dans cette unité'
      });
    }

    // Supprimer le membre de l'unité
    await prisma.unitMember.delete({
      where: {
        unit_id_user_id: {
          unit_id: id,
          user_id: memberId
        }
      }
    });

    // Mettre à jour la qualification de l'utilisateur à MEMBRE_IRREGULIER
    await prisma.user.update({
      where: { id: memberId },
      data: { qualification: 'MEMBRE_IRREGULIER' }
    });

    logger.info('Unit - removeMember - Utilisateur remis à MEMBRE_IRREGULIER', { memberId });

    res.status(200).json({
      success: true,
      message: 'Membre supprimé de l\'unité avec succès'
    });
  } catch (error) {
    logger.error('Unit - removeMember - Erreur complète', error);
    const { status, message } = handleError(error, 'la suppression du membre de l\'unité');
    res.status(status).json({
      success: false,
      message
    });
  }
};
