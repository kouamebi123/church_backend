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
      },
      orderBy: {
        nom: 'asc'
      }
    });

    // Pour chaque département, compter les membres associés
    const departmentsWithMembers = await Promise.all(
      departments.map(async (dep) => {
        let memberCount;
        // Compter les membres via user_departments
        if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
          // Compter seulement les membres de l'église du manager
          memberCount = await prisma.userDepartment.count({
            where: {
              department_id: dep.id,
              user: {
                eglise_locale_id: req.user.eglise_locale_id
              }
            }
          });
        } else {
          memberCount = await prisma.userDepartment.count({
            where: { department_id: dep.id }
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
    const { nom, description, responsable1_id, responsable2_id } = req.body;

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

    // Vérifier que les responsables existent et appartiennent à la même église
    const responsableIds = [responsable1_id, responsable2_id].filter(Boolean);
    if (responsableIds.length > 0) {
      const responsables = await prisma.user.findMany({
        where: {
          id: { in: responsableIds },
          eglise_locale_id: church_id
        }
      });

      if (responsables.length !== responsableIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Un ou plusieurs responsables ne sont pas valides ou n\'appartiennent pas à cette église'
        });
      }
    }

    // Créer le département avec les responsables
    const department = await prisma.department.create({
      data: {
        nom,
        description,
        church_id,
        responsable1_id: responsable1_id || null,
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

    // S'assurer que les responsables sont membres du département
    if (responsableIds.length > 0) {
      await Promise.all(
        responsableIds.map(async (userId) => {
          // Vérifier si l'utilisateur est déjà membre
          const existingMember = await prisma.userDepartment.findUnique({
            where: {
              user_id_department_id: {
                user_id: userId,
                department_id: department.id
              }
            }
          });

          // Si pas déjà membre, l'ajouter
          if (!existingMember) {
            await prisma.userDepartment.create({
              data: {
                user_id: userId,
                department_id: department.id
              }
            });
          }
        })
      );
    }

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
    const { responsable1_id, responsable2_id, ...updateData } = req.body;

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

    // Vérifier que les responsables existent et appartiennent à la même église
    const responsableIds = [responsable1_id, responsable2_id].filter(Boolean);
    if (responsableIds.length > 0) {
      const churchId = existingDepartment.church_id;
      const responsables = await prisma.user.findMany({
        where: {
          id: { in: responsableIds },
          eglise_locale_id: churchId
        }
      });

      if (responsables.length !== responsableIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Un ou plusieurs responsables ne sont pas valides ou n\'appartiennent pas à cette église'
        });
      }
    }

    // Préparer les données de mise à jour
    const finalUpdateData = {
      ...updateData,
      responsable1_id: responsable1_id || null,
      responsable2_id: responsable2_id || null
    };

    // Mettre à jour le département
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: finalUpdateData,
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

    // S'assurer que les responsables sont membres du département
    if (responsableIds.length > 0) {
      await Promise.all(
        responsableIds.map(async (userId) => {
          // Vérifier si l'utilisateur est déjà membre
          const existingMember = await prisma.userDepartment.findUnique({
            where: {
              user_id_department_id: {
                user_id: userId,
                department_id: id
              }
            }
          });

          // Si pas déjà membre, l'ajouter
          if (!existingMember) {
            await prisma.userDepartment.create({
              data: {
                user_id: userId,
                department_id: id
              }
            });
          }
        })
      );
    }

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

    // Vérifier s'il y a des membres associés via user_departments
    const memberCount = await prisma.userDepartment.count({
      where: { department_id: id }
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

    // Récupérer les membres via user_departments (relation many-to-many)
    const userDepartments = await prisma.userDepartment.findMany({
      where: {
        department_id: id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            role: true,
            qualification: true,
            email: true,
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

    // Extraire les utilisateurs
    const members = userDepartments.map(ud => ud.user);

    // Filtrage automatique pour les managers
    let filteredMembers = members;
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;
      
      filteredMembers = members.filter(member => {
        const memberChurchId = member.eglise_locale?.id || member.eglise_locale?._id || member.eglise_locale;
        return memberChurchId === churchId;
      });
    }

    // Trier par username
    filteredMembers.sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    res.json({
      success: true,
      count: filteredMembers.length,
      data: filteredMembers
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

    // Compter les membres via user_departments
    let where = { department_id: id };

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where = {
        department_id: id,
        user: {
          eglise_locale_id: req.user.eglise_locale_id
        }
      };
    }

    // Compter les membres
    const memberCount = await prisma.userDepartment.count({ where });

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
