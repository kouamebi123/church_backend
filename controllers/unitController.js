const QualificationService = require('../services/qualificationService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');

// Fonction pour formater les noms selon la logique demandée
const formatResponsableName = (username) => {
  if (!username) return '';
  
  const statusPrefixes = ['Past.', 'MC.', 'PE.', 'CE.', 'Resp.'];
  const words = username.split(' ');
  
  const firstWord = words[0];
  const isStatusPrefix = statusPrefixes.includes(firstWord);
  
  if (isStatusPrefix) {
    return words.length >= 2 ? words[1] : firstWord;
  } else {
    return words[0];
  }
};

// Fonction utilitaire pour générer le nom automatique d'une unité
const generateUnitName = async (prisma, responsable1Id, responsable2Id = null) => {
  try {
    let responsableName = '';

    if (responsable1Id) {
      const responsable1 = await prisma.user.findUnique({
        where: { id: responsable1Id },
        select: { username: true, pseudo: true }
      });

      if (responsable1) {
        if (responsable1.username) {
          responsableName = formatResponsableName(responsable1.username);
        } else {
          responsableName = responsable1.pseudo || '';
        }
      }
    }

    if (!responsableName && responsable2Id) {
      const responsable2 = await prisma.user.findUnique({
        where: { id: responsable2Id },
        select: { username: true, pseudo: true }
      });

      if (responsable2) {
        if (responsable2.username) {
          responsableName = formatResponsableName(responsable2.username);
        } else {
          responsableName = responsable2.pseudo || '';
        }
      }
    }

    if (!responsableName) {
      return 'Unité_Sans_Responsable';
    }

    const cleanName = responsableName
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    return `Unité_${cleanName}`;
  } catch (error) {
    logger.error('Erreur lors de la génération du nom de l\'unité', error);
    return 'Unité_Sans_Responsable';
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
    const nom = await generateUnitName(prisma, responsable1_id, responsable2_id);

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

    await prisma.unit.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Unité supprimée avec succès'
    });
  } catch (error) {
    logger.error('Unit - deleteUnit - Erreur complète', error);
    const { status, message } = handleError(error, 'la suppression de l\'unité');
    res.status(status).json({
      success: false,
      message
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

    await prisma.unitMember.delete({
      where: {
        unit_id_user_id: {
          unit_id: id,
          user_id: memberId
        }
      }
    });

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
