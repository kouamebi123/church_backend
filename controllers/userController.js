const bcrypt = require('bcryptjs');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { createUserRoleAssignment } = require('../utils/roleAssignment');
const { createActivityLog } = require('./activityController');

// Fonction utilitaire pour extraire l'ID de l'église
const extractChurchId = (egliseLocale) => {
  if (!egliseLocale) return null;
  if (typeof egliseLocale === 'object' && egliseLocale.id) {
    return egliseLocale.id;
  } else if (typeof egliseLocale === 'string') {
    return egliseLocale;
  }
  return null;
};

// Récupérer tous les utilisateurs avec filtrage automatique pour les managers
exports.getUsers = async (req, res) => {
  try {
    const { prisma } = req;

    // Filtrer les paramètres de requête autorisés pour éviter l'injection
    const allowedFields = ['role', 'genre', 'qualification', 'eglise_locale_id', 'departement_id', 'ville_residence', 'origine'];
    const where = {};

    Object.keys(req.query).forEach(key => {
      if (allowedFields.includes(key)) {
        where[key] = req.query[key];
      }
    });

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      where.eglise_locale_id = req.query.churchId;
    }

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        where.eglise_locale_id = churchId;
      }
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        },
        user_departments: {
          include: {
            department: {
              select: {
                id: true,
                nom: true
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
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
};

// Récupérer tous les utilisateurs GOUVERNANCE (pour la gestion des églises)
exports.getGovernanceUsers = async (req, res) => {
  try {
    const { prisma } = req;

    const users = await prisma.user.findMany({
      where: {
        qualification: 'GOUVERNANCE'
      },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        },
        user_departments: {
          include: {
            department: {
              select: {
                id: true,
                nom: true
              }
            }
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs GOUVERNANCE'
    });
  }
};

// Récupérer un utilisateur par ID
exports.getUser = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtenir les membres isolés
exports.getIsoles = async (req, res) => {
  try {
    const { prisma } = req;

    let usersInGroups = [];
    const churchFilter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      churchFilter.eglise_locale_id = req.query.churchId;

      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      const groupMembers = await prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    } else {
      const groupMembers = await prisma.groupMember.findMany({
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    }

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        churchFilter.eglise_locale_id = churchId;

        // Récupérer les réseaux de l'église du manager
        const networksInChurch = await prisma.network.findMany({
          where: { church_id: churchId },
          select: { id: true }
        });
        const networkIds = networksInChurch.map(n => n.id);
        const groupMembers = await prisma.groupMember.findMany({
          where: { group: { network_id: { in: networkIds } } },
          select: { user_id: true }
        });
        usersInGroups = groupMembers.map(gm => gm.user_id);
      }
    }

    const specialQualifications = ['RESPONSABLE_RESEAU', 'GOUVERNANCE', 'ECODIM'];
    const users = await prisma.user.findMany({
      where: {
        id: { notIn: usersInGroups },
        qualification: { notIn: specialQualifications },
        ...churchFilter
      },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Obtenir les membres non isolés
exports.getNonIsoles = async (req, res) => {
  try {
    const { prisma } = req;

    let usersInGroups = [];
    const churchFilter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      churchFilter.eglise_locale_id = req.query.churchId;

      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      const groupMembers = await prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    } else {
      const groupMembers = await prisma.groupMember.findMany({
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    }

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        churchFilter.eglise_locale_id = churchId;

        // Récupérer les réseaux de l'église du manager
        const networksInChurch = await prisma.network.findMany({
          where: { church_id: churchId },
          select: { id: true }
        });
        const networkIds = networksInChurch.map(n => n.id);
        const groupMembers = await prisma.groupMember.findMany({
          where: { group: { network_id: { in: networkIds } } },
          select: { user_id: true }
        });
        usersInGroups = groupMembers.map(gm => gm.user_id);
      }
    }

    const specialQualifications = ['RESPONSABLE_RESEAU', 'GOUVERNANCE', 'ECODIM'];
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: usersInGroups } },
          { qualification: { in: specialQualifications } }
        ],
        ...churchFilter
      },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Créer un nouvel utilisateur
exports.createUser = async (req, res) => {
  try {
    const { prisma } = req;
    const userData = req.body;

    logger.info('User - createUser - userData', userData);
    logger.info('User - createUser - req.user', req.user);

    // Validation des données
    if (!userData.username || !userData.pseudo) {
      return res.status(400).json({
        success: false,
        message: 'Username et pseudo sont requis'
      });
    }

    // Générer un mot de passe temporaire si aucun n'est fourni
    if (!userData.password) {
      // Générer un mot de passe temporaire robuste (10 caractères alphanumériques)
      userData.password = Array.from({length: 10}, () => Math.random().toString(36)[2]).join('');
      logger.info('User - createUser - Mot de passe temporaire généré', { password: userData.password });
    }

    // Vérification des restrictions pour les managers
    if (req.user && req.user.role === 'MANAGER') {
      // Empêcher l'attribution de rôles privilégiés
      if (userData.role && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(userData.role)) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas attribuer ce rôle'
        });
      }

      // Pour les managers, forcer l'église et le rôle
      userData.role = 'MEMBRE'; // Le manager ne peut attribuer que le rôle membre
      // L'église sera automatiquement assignée plus bas
    }

    // Hash du mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // S'assurer que eglise_locale_id est toujours défini
    let egliseLocaleId = userData.eglise_locale_id;

    if (!egliseLocaleId) {
      // Priorité 1: Église de l'utilisateur connecté
      if (req.user && req.user.eglise_locale_id) {
        egliseLocaleId = typeof req.user.eglise_locale_id === 'object'
          ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
          : req.user.eglise_locale_id;
      }

      // Si toujours pas d'église, utiliser une église par défaut ou générer une erreur
      if (!egliseLocaleId) {
        return res.status(400).json({
          success: false,
          message: 'L\'église locale est obligatoire. Veuillez sélectionner une église.'
        });
      }
    }

    // Validation du département si fourni (pour compatibilité)
    if (userData.departement_id) {
      const department = await prisma.department.findUnique({
        where: { id: userData.departement_id }
      });

      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Le département sélectionné n\'existe pas'
        });
      }
    }

    // Validation des départements multiples si fournis
    if (userData.departement_ids && Array.isArray(userData.departement_ids) && userData.departement_ids.length > 0) {
      const departments = await prisma.department.findMany({
        where: { id: { in: userData.departement_ids } }
      });

      if (departments.length !== userData.departement_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'Un ou plusieurs départements sélectionnés n\'existent pas'
        });
      }
    }

    // Log des données finales avant création
    logger.info('User - createUser - Données finales', {
      ...userData,
      password: '[HASHED]',
      eglise_locale_id: egliseLocaleId
    });

    // Préparer les données de création
    const userCreateData = {
      ...userData,
      password: hashedPassword,
      eglise_locale_id: egliseLocaleId
    };

    // Supprimer departement_ids des données de création (géré séparément)
    delete userCreateData.departement_ids;

    // Création de l'utilisateur
    const newUser = await prisma.user.create({
      data: userCreateData,
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        },
        user_departments: {
          include: {
            department: {
              select: {
                id: true,
                nom: true
              }
            }
          }
        }
      }
    });

    // Créer l'assignation de rôle si nécessaire
    if (newUser.role && newUser.role !== 'MEMBRE') {
      try {
        await createUserRoleAssignment(newUser.id, newUser.role);
        logger.info('User - createUser - Assignation de rôle créée', { userId: newUser.id, role: newUser.role });
      } catch (roleError) {
        logger.error('User - createUser - Erreur lors de la création de l\'assignation de rôle:', roleError);
        // Ne pas faire échouer la création de l'utilisateur pour cette erreur
      }
    }

    // Créer les associations avec les départements multiples
    if (userData.departement_ids && Array.isArray(userData.departement_ids) && userData.departement_ids.length > 0) {
      await prisma.userDepartment.createMany({
        data: userData.departement_ids.map(departmentId => ({
          user_id: newUser.id,
          department_id: departmentId
        }))
      });

      // Recharger l'utilisateur avec les départements
      const updatedUser = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          eglise_locale: {
            select: {
              id: true,
              nom: true
            }
          },
          departement: {
            select: {
              id: true,
              nom: true
            }
          },
          user_departments: {
            include: {
              department: {
                select: {
                  id: true,
                  nom: true
                }
              }
            }
          }
        }
      });

      // Log de l'activité
      await createActivityLog(prisma, req.user.id, 'CREATE', 'USER', updatedUser.id, updatedUser.username, `Utilisateur créé: ${updatedUser.username}`, req);

      return res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        data: updatedUser,
        ...(userData.password && { tempPassword: userData.password })
      });
    }

    // Log de l'activité
    await createActivityLog(prisma, req.user.id, 'CREATE', 'USER', newUser.id, newUser.username, `Utilisateur créé: ${newUser.username}`, req);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: newUser,
      ...(userData.password && { tempPassword: userData.password })
    });
  } catch (error) {
    logger.error('User - createUser - Erreur complète:', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la création de l\'utilisateur');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour un utilisateur
exports.updateUser = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    logger.info('User - updateUser - ID', { id });
    logger.info('User - updateUser - updateData', updateData);
    logger.info('User - updateUser - req.user', req.user);
    logger.info('User - updateUser - updateData.eglise_locale_id', { eglise_locale_id: updateData.eglise_locale_id });
    logger.info('User - updateUser - updateData.departement', { departement: updateData.departement });

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    logger.info('User - updateUser - existingUser', existingUser);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifications spécifiques pour le manager
    if (req.user && req.user.role === 'MANAGER') {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const userChurchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (existingUser.eglise_locale_id !== userChurchId) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez modifier que les utilisateurs de votre église'
        });
      }

      // Le manager ne peut pas attribuer de rôles privilégiés
      if (updateData.role && ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(updateData.role)) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas attribuer ce rôle'
        });
      }

      // Empêcher la modification de l'église pour les managers
      delete updateData.eglise_locale_id;
    }

    // Hash du mot de passe si fourni
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    // Mapping des champs frontend vers backend
    const mappedUpdateData = { ...updateData };

    // Mapper eglise_locale vers eglise_locale_id
    if (mappedUpdateData.eglise_locale !== undefined) {
      mappedUpdateData.eglise_locale_id = mappedUpdateData.eglise_locale;
      delete mappedUpdateData.eglise_locale;
    }

    // Mapper departement vers departement_id
    if (mappedUpdateData.departement !== undefined) {
      mappedUpdateData.departement_id = mappedUpdateData.departement;
      delete mappedUpdateData.departement;
    }

    // Gérer les départements multiples
    let departementIds = null;
    if (mappedUpdateData.departement_ids !== undefined) {
      departementIds = mappedUpdateData.departement_ids;
      delete mappedUpdateData.departement_ids;
    }

    logger.info('User - updateUser - Données mappées', mappedUpdateData);

    // Mise à jour de l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id },
      data: mappedUpdateData,
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        },
        user_departments: {
          include: {
            department: {
              select: {
                id: true,
                nom: true
              }
            }
          }
        }
      }
    });

    // Mettre à jour les départements multiples si fournis
    if (departementIds !== null) {
      // Supprimer les associations existantes
      await prisma.userDepartment.deleteMany({
        where: { user_id: id }
      });

      // Créer les nouvelles associations
      if (Array.isArray(departementIds) && departementIds.length > 0) {
        await prisma.userDepartment.createMany({
          data: departementIds.map(departmentId => ({
            user_id: id,
            department_id: departmentId
          }))
        });
      }

      // Recharger l'utilisateur avec les départements mis à jour
      const finalUser = await prisma.user.findUnique({
        where: { id },
        include: {
          eglise_locale: {
            select: {
              id: true,
              nom: true
            }
          },
          departement: {
            select: {
              id: true,
              nom: true
            }
          },
          user_departments: {
            include: {
              department: {
                select: {
                  id: true,
                  nom: true
                }
              }
            }
          }
        }
      });

      // Log de l'activité
      await createActivityLog(prisma, req.user.id, 'UPDATE', 'USER', finalUser.id, finalUser.username, `Utilisateur modifié: ${finalUser.username}`, req);

      return res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: finalUser
      });
    }

    // Log de l'activité
    await createActivityLog(prisma, req.user.id, 'UPDATE', 'USER', updatedUser.id, updatedUser.username, `Utilisateur modifié: ${updatedUser.username}`, req);

    res.status(200).json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: updatedUser
    });
  } catch (error) {
    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour de l\'utilisateur');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un utilisateur
exports.deleteUser = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifications spécifiques pour le manager
    if (req.user && req.user.role === 'MANAGER') {
      if (existingUser.eglise_locale_id !== req.user.eglise_locale_id) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez supprimer que les utilisateurs de votre église'
        });
      }
    }

    // Vérifier si l'utilisateur est responsable d'un groupe
    const userAsGroupResponsible = await prisma.group.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ]
      }
    });

    if (userAsGroupResponsible) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un groupe. Veuillez d\'abord changer le responsable ou supprimer le groupe.'
      });
    }

    // Vérifier si l'utilisateur est responsable d'un réseau
    const userAsNetworkResponsible = await prisma.network.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ]
      }
    });

    if (userAsNetworkResponsible) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un réseau. Veuillez d\'abord changer le responsable ou supprimer le réseau.'
      });
    }

    // Vérifier si l'utilisateur est responsable d'une session
    const userAsSessionResponsible = await prisma.session.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ]
      }
    });

    if (userAsSessionResponsible) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cet utilisateur car il est responsable d\'une session. Veuillez d\'abord changer le responsable ou supprimer la session.'
      });
    }

    // Vérifier si l'utilisateur est responsable d'une unité
    const userAsUnitResponsible = await prisma.unit.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ]
      }
    });

    if (userAsUnitResponsible) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cet utilisateur car il est responsable d\'une unité. Veuillez d\'abord changer le responsable ou supprimer l\'unité.'
      });
    }

    // Nettoyage automatique de toutes les références
    try {
      // Retirer l'utilisateur du groupe dont il est membre (un seul groupe possible)
      await prisma.groupMember.deleteMany({
        where: { user_id: id }
      });

      // Retirer l'utilisateur de l'historique des groupes
      await prisma.groupMemberHistory.deleteMany({
        where: { user_id: id }
      });

      // Retirer l'utilisateur des unités (en tant que membre)
      await prisma.unitMember.deleteMany({
        where: { user_id: id }
      });

      // Retirer l'utilisateur des compagnons d'œuvre de réseaux
      await prisma.networkCompanion.deleteMany({
        where: { user_id: id }
      });

      // Retirer l'utilisateur des services (collecteur ou superviseur)
      await prisma.service.updateMany({
        where: {
          OR: [
            { collecteur_culte_id: id },
            { superviseur_id: id }
          ]
        },
        data: {
          collecteur_culte_id: null,
          superviseur_id: null
        }
      });

      // Supprimer les messages envoyés par l'utilisateur
      await prisma.message.deleteMany({
        where: { sender_id: id }
      });

      // Supprimer les MessageRecipient où l'utilisateur est destinataire
      await prisma.messageRecipient.deleteMany({
        where: { recipient_id: id }
      });


      logger.info('Nettoyage automatique terminé pour l\'utilisateur', { id });
    } catch (cleanupError) {
      logger.error('Erreur lors du nettoyage automatique', cleanupError);
      // Continuer avec la suppression même si le nettoyage échoue
    }

    // Log de l'activité avant suppression
    await createActivityLog(prisma, req.user.id, 'DELETE', 'USER', id, existingUser.username, `Utilisateur supprimé: ${existingUser.username}`, req);

    // Suppression de l'utilisateur
    await prisma.user.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    const { status, message } = handleError(error, 'la suppression de l\'utilisateur');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer les utilisateurs disponibles pour les groupes
exports.getAvailableUsers = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId, forSession, forNetwork } = req.query;

    const where = {};

    // Filtrage par église si spécifié
    if (churchId) {
      where.eglise_locale_id = churchId;
    }

    // Filtrage automatique pour les managers (si pas d'église spécifiée)
    if (!churchId && req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    // Pour les super admins sans église spécifiée, on peut voir tous les utilisateurs
    // (pas de filtre d'église appliqué)

    // Récupérer tous les utilisateurs qui correspondent aux critères de base
    const allUsers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        pseudo: true,
        qualification: true,
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        pseudo: 'asc'
      }
    });

    // Récupérer les IDs des utilisateurs qui sont déjà dans des groupes
    const usersInGroups = await prisma.groupMember.findMany({
      select: {
        user_id: true
      }
    });
    const userIdsInGroups = usersInGroups.map(member => member.user_id);

    // Récupérer les IDs des utilisateurs qui sont responsables de réseaux
    const allNetworks = await prisma.network.findMany({
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });

    const networkResponsableIds = allNetworks.reduce((ids, network) => {
      if (network.responsable1_id) ids.push(network.responsable1_id);
      if (network.responsable2_id) ids.push(network.responsable2_id);
      return ids;
    }, []);

    // Récupérer les IDs des utilisateurs qui sont déjà compagnons d'un réseau
    const companionsInNetworks = await prisma.networkCompanion.findMany({
      select: {
        user_id: true
      }
    });
    const companionIdsInNetworks = companionsInNetworks.map(c => c.user_id);

    // Filtrer les utilisateurs disponibles
    const availableUsers = allUsers.filter(user => {
      // Exclure les utilisateurs déjà dans des groupes
      if (userIdsInGroups.includes(user.id)) {
        return false;
      }

      // Exclure les responsables de réseaux
      if (networkResponsableIds.includes(user.id)) {
        return false;
      }

      // Exclure les compagnons d'œuvre qui sont déjà dans un réseau
      if (companionIdsInNetworks.includes(user.id)) {
        return false;
      }

      // Exclure les utilisateurs de la gouvernance SAUF si c'est pour une session ou un réseau
      // (comme pour les églises, exception pour les sessions et réseaux)
      if (user.qualification === 'GOUVERNANCE' && forSession !== 'true' && forNetwork !== 'true') {
        return false;
      }

      // Exclure UNIQUEMENT les qualifications qui empêchent d'être dans des groupes
      // Note: LEADER est autorisé car c'est la qualification des responsables de groupes
      const excludedQualifications = [
        'RESPONSABLE_RESEAU',  // Responsables de réseaux (pas de groupes)
        'ECODIM'               // Membres Ecodim (pas de groupes)
      ];
      if (excludedQualifications.includes(user.qualification)) {
        return false;
      }

      return true;
    });

    logger.info('getAvailableUsers - Filtrage appliqué', {
      totalUsers: allUsers.length,
      usersInGroups: userIdsInGroups.length,
      networkResponsables: networkResponsableIds.length,
      companionsInNetworks: companionIdsInNetworks.length,
      availableUsers: availableUsers.length
    });

    res.status(200).json({
      success: true,
      data: availableUsers
    });
  } catch (error) {
    logger.error('Erreur getAvailableUsers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mettre à jour la qualification d'un utilisateur
exports.updateQualification = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { qualification } = req.body;

    if (!qualification) {
      return res.status(400).json({
        success: false,
        message: 'Qualification requise'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { qualification },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Qualification mise à jour avec succès',
      data: updatedUser
    });
  } catch (error) {
    logger.error('Erreur updateQualification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la qualification',
      error: error.message
    });
  }
};

// Réinitialiser le mot de passe d'un utilisateur
exports.resetPassword = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Nouveau mot de passe requis'
      });
    }

    // Hash du nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    });
  } catch (error) {
    logger.error('Erreur resetPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe',
      error: error.message
    });
  }
};

// Récupérer les utilisateurs non isolés
exports.getNonIsoles = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const users = await prisma.user.findMany({
      where: {
        ...where,
        // Logique pour les utilisateurs non isolés (à adapter selon vos besoins)
        NOT: {
          qualification: 'EN_INTEGRATION'
        }
      },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        pseudo: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Récupérer les utilisateurs en intégration
exports.getUsersEnIntegration = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const users = await prisma.user.findMany({
      where: {
        ...where,
        qualification: 'EN_INTEGRATION'
      },
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        pseudo: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Récupérer les statistiques des utilisateurs
exports.getUserStats = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const stats = await prisma.user.groupBy({
      by: ['qualification'],
      where,
      _count: {
        qualification: true
      }
    });

    const totalUsers = await prisma.user.count({ where });

    res.status(200).json({
      success: true,
      data: {
        stats,
        total: totalUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mettre à jour son propre profil (pour les utilisateurs connectés)
exports.updateOwnProfile = async (req, res) => {
  try {
    const { prisma } = req;

    // L'utilisateur ne peut modifier que son propre profil
    const userId = req.user.id;

    // Empêcher la modification de champs sensibles
    const updateData = { ...req.body };
    delete updateData.role; // Empêcher le changement de rôle
    delete updateData.eglise_locale_id; // Empêcher le changement d'église
    delete updateData.password; // Empêcher le changement de mot de passe via cette route

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        },
        departement: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour du profil');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// @desc    Récupérer les utilisateurs retirés (qui ont été dans un groupe mais n'y sont plus)
// @route   GET /api/users/retired
// @access  Private/Admin
exports.getRetiredUsers = async (req, res) => {
  try {
    const { prisma } = req;
    const churchFilter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      churchFilter.eglise_locale_id = req.query.churchId;
    }

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Extraire l'ID de l'église (peut être un objet ou une chaîne)
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        churchFilter.eglise_locale_id = churchId;
      }
    }

    // Récupérer l'historique des membres qui ont quitté des groupes
    const leftMembers = await prisma.groupMemberHistory.findMany({
      where: {
        action: 'LEFT'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            email: true,
            role: true,
            qualification: true,
            eglise_locale_id: true,
            createdAt: true
          }
        },
        group: {
          include: {
            network: {
              select: {
                id: true,
                nom: true,
                church_id: true
              }
            },
            responsable1: {
              select: {
                id: true,
                username: true
              }
            },
            responsable2: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Filtrer les utilisateurs par église après la requête
    const filteredLeftMembers = leftMembers.filter(member => {
      if (!member.user) return false;

      // Si un filtre d'église est spécifié, l'appliquer
      if (Object.keys(churchFilter).length > 0) {
        if (churchFilter.eglise_locale_id && member.user.eglise_locale_id !== churchFilter.eglise_locale_id) {
          return false;
        }
      }

      return true;
    });

    // Filtrer les utilisateurs qui ne sont plus dans aucun groupe actuellement
    const retiredUsers = [];
    const processedUserIds = new Set();

    for (const leftMember of filteredLeftMembers) {
      if (!leftMember.user || processedUserIds.has(leftMember.user.id)) {
        continue;
      }

      // Vérifier si l'utilisateur est encore dans un groupe
      const isStillInGroup = await prisma.groupMember.findFirst({
        where: {
          user_id: leftMember.user.id
        }
      });

      // Si l'utilisateur n'est plus dans aucun groupe, il est retiré
      if (!isStillInGroup) {
        retiredUsers.push({
          user: leftMember.user,
          leftAt: leftMember.createdAt,
          group: {
            id: leftMember.group.id,
            nom: leftMember.group.responsable1 ? (
              leftMember.group.responsable2
                ? `GR ${leftMember.group.responsable1.username.split(' ')[0]} & ${leftMember.group.responsable2.username.split(' ')[0]}`
                : `GR ${leftMember.group.responsable1.username.split(' ')[0]}`
            ) : 'Groupe sans responsable'
          },
          network: {
            id: leftMember.group.network.id,
            nom: leftMember.group.network.nom
          }
        });

        processedUserIds.add(leftMember.user.id);
      }
    }

    res.status(200).json({
      success: true,
      data: retiredUsers
    });

  } catch (error) {
    logger.error('User - getRetiredUsers - Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload d'image de profil
exports.uploadProfileImage = async (req, res) => {
  try {
    const { prisma } = req;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    // Vérifier le type de fichier
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier doit être une image'
      });
    }

    // Vérifier la taille (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'L\'image est trop volumineuse (maximum 5MB)'
      });
    }

    // Le fichier est déjà sauvegardé par multer
    const uploadPath = `uploads/profiles/${req.file.filename}`;

    // Mettre à jour l'utilisateur avec le chemin de l'image
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { image: uploadPath },
      select: {
        id: true,
        username: true,
        image: true
      }
    });

    logger.info(`User - uploadProfileImage - Image uploadée pour l'utilisateur ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'Image de profil mise à jour avec succès',
      data: {
        image: updatedUser.image
      }
    });

  } catch (error) {
    logger.error('User - uploadProfileImage - Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'image de profil'
    });
  }
};

// Suppression d'image de profil
exports.removeProfileImage = async (req, res) => {
  try {
    const { prisma } = req;

    // Récupérer l'utilisateur actuel
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { image: true }
    });

    if (user && user.image) {
      // Supprimer le fichier physique s'il existe
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', user.image);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Mettre à jour l'utilisateur pour supprimer le chemin de l'image
    await prisma.user.update({
      where: { id: req.user.id },
      data: { image: '' }
    });

    logger.info(`User - removeProfileImage - Image supprimée pour l'utilisateur ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: 'Image de profil supprimée avec succès'
    });

  } catch (error) {
    logger.error('User - removeProfileImage - Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'image de profil'
    });
  }
};

// Uploader l'image d'un utilisateur spécifique
exports.uploadUserImage = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    // Vérifier le type de fichier
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier doit être une image'
      });
    }

    // Vérifier la taille (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'L\'image est trop volumineuse (maximum 5MB)'
      });
    }

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Le fichier est déjà sauvegardé par multer
    const uploadPath = `uploads/profiles/${req.file.filename}`;

    // Mettre à jour l'utilisateur avec le chemin de l'image
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { image: uploadPath },
      select: {
        id: true,
        username: true,
        image: true
      }
    });

    logger.info(`User - uploadUserImage - Image uploadée pour l'utilisateur ${id}`);

    res.status(200).json({
      success: true,
      message: 'Image de profil mise à jour avec succès',
      data: {
        image: updatedUser.image
      }
    });
  } catch (error) {
    logger.error('User - uploadUserImage - Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'image'
    });
  }
};

// Récupérer le réseau d'un utilisateur
exports.getUserNetwork = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        pseudo: true,
        role: true,
        current_role: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Chercher le réseau où cet utilisateur est impliqué (responsable, membre d'un GR, ou compagnon d'œuvre)
    let network = null;
    let relationType = null;

    // Cas 1: Responsable du réseau (responsable1 ou responsable2)
    network = await prisma.network.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ],
        active: true
      },
      select: {
        id: true,
        nom: true,
        church_id: true,
        responsable1_id: true,
        responsable2_id: true,
        church: {
          select: {
            id: true,
            nom: true,
            ville: true
          }
        }
      }
    });

    if (network) {
      relationType = 'responsable';
    } else {
      // Cas 2: Membre d'un GR (groupe) du réseau
      const groupMember = await prisma.groupMember.findFirst({
        where: { user_id: id },
        include: {
          group: {
            include: {
              network: {
                select: {
                  id: true,
                  nom: true,
                  church_id: true,
                  active: true,
                  responsable1_id: true,
                  responsable2_id: true,
                  church: {
                    select: {
                      id: true,
                      nom: true,
                      ville: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (groupMember?.group?.network && groupMember.group.network.active) {
        network = groupMember.group.network;
        relationType = 'membre_gr';
      } else {
        // Cas 3: Compagnon d'œuvre du réseau
        const companion = await prisma.networkCompanion.findFirst({
          where: { user_id: id },
          include: {
            network: {
              select: {
                id: true,
                nom: true,
                church_id: true,
                active: true,
                responsable1_id: true,
                responsable2_id: true,
                church: {
                  select: {
                    id: true,
                    nom: true,
                    ville: true
                  }
                }
              }
            }
          }
        });

        if (companion?.network && companion.network.active) {
          network = companion.network;
          relationType = 'compagnon_oeuvre';
        }
      }
    }

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Aucun réseau trouvé pour cet utilisateur',
        data: {
          networkId: null,
          networkName: null,
          churchId: null,
          churchName: null
        }
      });
    }

    logger.info('Réseau trouvé pour utilisateur:', {
      userId: id,
      networkId: network.id,
      networkName: network.nom,
      churchId: network.church_id,
      relationType: relationType
    });

    res.status(200).json({
      success: true,
      data: {
        networkId: network.id,
        networkName: network.nom,
        churchId: network.church_id,
        churchName: network.church.nom,
        churchCity: network.church.ville,
        isResponsable1: network.responsable1_id === id,
        isResponsable2: network.responsable2_id === id,
        relationType: relationType // 'responsable', 'membre_gr', ou 'compagnon_oeuvre'
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération du réseau utilisateur:', error);
    const { status, message } = handleError(error, 'la récupération du réseau utilisateur');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer la session d'un utilisateur
exports.getUserSession = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        pseudo: true,
        role: true,
        current_role: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Chercher la session où cet utilisateur est impliqué (responsable, membre d'une unité, ou responsable d'une unité)
    let session = null;
    let relationType = null;

    // Cas 1: Responsable de la session (responsable1 ou responsable2)
    session = await prisma.session.findFirst({
      where: {
        OR: [
          { responsable1_id: id },
          { responsable2_id: id }
        ],
        active: true
      },
      select: {
        id: true,
        nom: true,
        church_id: true,
        responsable1_id: true,
        responsable2_id: true,
        church: {
          select: {
            id: true,
            nom: true,
            ville: true
          }
        }
      }
    });

    if (session) {
      relationType = 'responsable';
    } else {
      // Cas 2: Membre d'une unité de la session
      const unitMember = await prisma.unitMember.findFirst({
        where: { user_id: id },
        include: {
          unit: {
            include: {
              session: {
                select: {
                  id: true,
                  nom: true,
                  church_id: true,
                  active: true,
                  responsable1_id: true,
                  responsable2_id: true,
                  church: {
                    select: {
                      id: true,
                      nom: true,
                      ville: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (unitMember?.unit?.session && unitMember.unit.session.active) {
        session = unitMember.unit.session;
        relationType = 'membre_unite';
      } else {
        // Cas 3: Responsable d'une unité de la session
        const unitResponsable = await prisma.unit.findFirst({
          where: {
            OR: [
              { responsable1_id: id },
              { responsable2_id: id }
            ],
            active: true
          },
          include: {
            session: {
              select: {
                id: true,
                nom: true,
                church_id: true,
                active: true,
                responsable1_id: true,
                responsable2_id: true,
                church: {
                  select: {
                    id: true,
                    nom: true,
                    ville: true
                  }
                }
              }
            }
          }
        });

        if (unitResponsable?.session && unitResponsable.session.active) {
          session = unitResponsable.session;
          relationType = 'responsable_unite';
        }
      }
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Aucune session trouvée pour cet utilisateur',
        data: {
          sessionId: null,
          sessionName: null,
          churchId: null,
          churchName: null
        }
      });
    }

    logger.info('Session trouvée pour utilisateur:', {
      userId: id,
      sessionId: session.id,
      sessionName: session.nom,
      churchId: session.church_id,
      relationType: relationType
    });

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionName: session.nom,
        churchId: session.church_id,
        churchName: session.church.nom,
        churchCity: session.church.ville,
        isResponsable1: session.responsable1_id === id,
        isResponsable2: session.responsable2_id === id,
        relationType: relationType // 'responsable', 'membre_unite', ou 'responsable_unite'
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération de la session utilisateur:', error);
    const { status, message } = handleError(error, 'la récupération de la session utilisateur');
    res.status(status).json({
      success: false,
      message
    });
  }
};
