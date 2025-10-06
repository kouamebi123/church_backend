const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Récupérer tous les départements
exports.getDepartments = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Pour les départements, on peut les laisser visibles mais on peut filtrer les utilisateurs par église
      // Cette logique sera appliquée dans getDepartmentMembers
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        nom: 'asc'
      }
    });

    // Pour chaque département, compter les membres associés
    const departmentsWithMembers = await Promise.all(
      departments.map(async (dep) => {
        let memberCount;
        if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
          // Compter seulement les membres de l'église du manager
          memberCount = await prisma.user.count({
            where: {
              departement_id: dep.id,
              eglise_locale_id: req.user.eglise_locale_id
            }
          });
        } else {
          memberCount = await prisma.user.count({
            where: { departement_id: dep.id }
          });
        }
        return {
          ...dep,
          memberCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departmentsWithMembers
    });
  } catch (error) {
    logger.error('Department - getDepartments - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des départements');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer un département par ID
exports.getDepartment = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        },
        members: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            role: true,
            qualification: true,
            eglise_locale: {
              select: {
                id: true,
                nom: true
              }
            }
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Département non trouvé'
      });
    }

    // Formater la réponse
    const formattedDepartment = {
      ...department,
      nombre_membres: department.members.length
    };

    res.status(200).json({
      success: true,
      data: formattedDepartment
    });
  } catch (error) {
    logger.error('Department - getDepartment - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un nouveau département (super-admin seulement)
exports.createDepartment = async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, description } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom du département est requis'
      });
    }

    // Déterminer l'église pour le département
    let church_id;

    if (req.user.role === 'SUPER_ADMIN') {
      // Pour les super-admin, utiliser l'église de l'utilisateur ou la première église disponible
      if (req.user.eglise_locale_id) {
        church_id = req.user.eglise_locale_id;
      } else {
        // Prendre la première église disponible
        const firstChurch = await prisma.church.findFirst({
          select: { id: true }
        });
        if (!firstChurch) {
          return res.status(400).json({
            success: false,
            message: 'Aucune église disponible pour créer un département'
          });
        }
        church_id = firstChurch.id;
      }
    } else if (req.user.role === 'MANAGER') {
      // Pour les managers, utiliser leur église locale
      church_id = req.user.eglise_locale_id;
      if (!church_id) {
        return res.status(400).json({
          success: false,
          message: 'Vous devez être assigné à une église pour créer un département'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas les permissions pour créer un département'
      });
    }

    // Vérifier si l'église existe
    const church = await prisma.church.findUnique({
      where: { id: church_id }
    });

    if (!church) {
      return res.status(400).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Vérifier si le département existe déjà dans cette église
    const existingDepartment = await prisma.department.findFirst({
      where: {
        nom,
        church_id
      }
    });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message: 'Un département avec ce nom existe déjà dans cette église'
      });
    }

    // Créer le département
    const department = await prisma.department.create({
      data: {
        nom,
        description,
        church_id
      },
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error('Department - createDepartment - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la création du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour un département (super-admin seulement)
exports.updateDepartment = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier si le département existe
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    });

    if (!existingDepartment) {
      return res.status(404).json({
        success: false,
        message: 'Département non trouvé'
      });
    }

    // Vérifier si le nom est unique dans cette église (sauf pour ce département)
    if (updateData.nom && updateData.nom !== existingDepartment.nom) {
      const duplicateDepartment = await prisma.department.findFirst({
        where: {
          nom: updateData.nom,
          church_id: updateData.church_id || existingDepartment.church_id,
          id: {
            not: id
          }
        }
      });

      if (duplicateDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Un département avec ce nom existe déjà dans cette église'
        });
      }
    }

    // Mettre à jour le département
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedDepartment
    });
  } catch (error) {
    logger.error('Department - updateDepartment - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un département (super-admin seulement)
exports.deleteDepartment = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si le département existe
    const existingDepartment = await prisma.department.findUnique({
      where: { id }
    });

    if (!existingDepartment) {
      return res.status(404).json({
        success: false,
        message: 'Département non trouvé'
      });
    }

    // Vérifier s'il y a des membres associés
    const memberCount = await prisma.user.count({
      where: { departement_id: id }
    });

    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer le département. Il a ${memberCount} membre(s) associé(s).`
      });
    }

    // Supprimer le département
    await prisma.department.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Département supprimé avec succès'
    });
  } catch (error) {
    logger.error('Department - deleteDepartment - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les membres d'un département
exports.getDepartmentMembers = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const where = { departement_id: id };

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const members = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        pseudo: true,
        role: true,
        qualification: true,
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    logger.error('Department - getDepartmentMembers - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des membres du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les statistiques d'un département
exports.getDepartmentStats = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si le département existe
    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Département non trouvé'
      });
    }

    const where = { departement_id: id };

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    // Compter les membres
    const memberCount = await prisma.user.count({ where });

    // Statistiques par qualification
    const qualificationStats = await prisma.user.groupBy({
      by: ['qualification'],
      where,
      _count: {
        qualification: true
      }
    });

    // Statistiques par rôle
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where,
      _count: {
        role: true
      }
    });

    res.json({
      success: true,
      data: {
        departmentId: department.id,
        departmentName: department.nom,
        totalMembers: memberCount,
        qualificationDistribution: qualificationStats.map(stat => ({
          qualification: stat.qualification,
          count: stat._count.qualification
        })),
        roleDistribution: roleStats.map(stat => ({
          role: stat.role,
          count: stat._count.role
        }))
      }
    });
  } catch (error) {
    logger.error('Department - getDepartmentStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques du département');

    res.status(status).json({
      success: false,
      message
    });
  }
};
