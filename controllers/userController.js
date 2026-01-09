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

// Récupérer toutes les relations clés d'un utilisateur (diagnostic suppression)
exports.getUserRelations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID utilisateur requis' });
    }

    // Vérifier que l'utilisateur existe
    const user = await req.prisma.user.findUnique({ where: { id }, select: { id: true, username: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Collecte des relations
    const [
      groupMemberOf,
      groupsResponsible,
      networksResponsible,
      companionOf,
      sessionsResponsible,
      unitMemberOf,
      unitsResponsible,
      servicesLinkedCollect,
      servicesLinkedSuperv,
      messagesSentCount,
      messagesReceivedCount
    ] = await Promise.all([
      // Membre de GR
      req.prisma.groupMember.findMany({
        where: { user_id: id },
        include: { group: { select: { id: true, nom: true, network: { select: { id: true, nom: true } } } } }
      }),
      // Responsable de GR
      req.prisma.group.findMany({
        where: { OR: [{ responsable1_id: id }, { responsable2_id: id }] },
        select: { id: true, nom: true }
      }),
      // Responsable de réseau
      req.prisma.network.findMany({
        where: { OR: [{ responsable1_id: id }, { responsable2_id: id }] },
        select: { id: true, nom: true }
      }),
      // Compagnon d'œuvre
      req.prisma.networkCompanion.findMany({
        where: { user_id: id },
        include: { network: { select: { id: true, nom: true } } }
      }),
      // Responsable de session
      req.prisma.session.findMany({
        where: { OR: [{ responsable1_id: id }, { responsable2_id: id }] },
        select: { id: true, nom: true }
      }),
      // Membre d'unité
      req.prisma.unitMember.findMany({
        where: { user_id: id },
        include: { unit: { select: { id: true, nom: true, session: { select: { id: true, nom: true } } } } }
      }),
      // Responsable d'unité
      req.prisma.unit.findMany({
        where: { OR: [{ responsable1_id: id }, { responsable2_id: id }] },
        select: { id: true, nom: true }
      }),
      // Services liés - collecteur
      req.prisma.service.count({ where: { collecteur_culte_id: id } }),
      // Services liés - superviseur
      req.prisma.service.count({ where: { superviseur_id: id } }),
      // Messages
      req.prisma.message.count({ where: { sender_id: id } }),
      req.prisma.messageRecipient.count({ where: { recipient_id: id } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, username: user.username },
        groupMemberOf: groupMemberOf.map(gm => ({ id: gm.group.id, name: gm.group.nom, network: gm.group.network })),
        groupsResponsible,
        networksResponsible,
        companionOf: companionOf.map(c => ({ id: c.network.id, name: c.network.nom })),
        sessionsResponsible,
        unitMemberOf: unitMemberOf.map(um => ({ id: um.unit.id, name: um.unit.nom, session: um.unit.session })),
        unitsResponsible,
        services: { asCollector: servicesLinkedCollect, asSupervisor: servicesLinkedSuperv },
        messages: { sent: messagesSentCount, received: messagesReceivedCount }
      }
    });
  } catch (error) {
    logger.error('User - getUserRelations - Erreur:', error);
    const { status, message } = handleError(error, 'la récupération des relations utilisateur');
    res.status(status).json({ success: false, message });
  }
};

// Fonction pour récupérer les informations de réseau/GR d'un utilisateur
const getUserNetworkGroupInfo = async (prisma, userId) => {
  try {
    // Vérifier si l'utilisateur est membre d'un groupe (GR)
    const groupMember = await prisma.groupMember.findFirst({
      where: { user_id: userId },
      include: {
        group: {
          include: {
            network: {
              select: {
                id: true,
                nom: true
              }
            },
            responsable1: {
              select: {
                username: true
              }
            },
            responsable2: {
              select: {
                username: true
              }
            }
          }
        }
      }
    });

    if (groupMember) {
      const group = groupMember.group;
      const network = group.network;
      const responsable1Name = group.responsable1?.username?.split(' ')[0] || '';
      const responsable2Name = group.responsable2?.username?.split(' ')[0] || '';
      
      let groupName = '';
      if (responsable1Name && responsable2Name) {
        groupName = `GR ${responsable1Name} & ${responsable2Name}`;
      } else if (responsable1Name) {
        groupName = `GR ${responsable1Name}`;
      } else {
        groupName = 'Groupe de réveil';
      }

      return {
        type: 'groupe',
        groupName: groupName,
        networkName: network?.nom || 'Réseau inconnu',
        networkId: network?.id
      };
    }

    // Vérifier si l'utilisateur est responsable d'un réseau
    const networkAsResponsable = await prisma.network.findFirst({
      where: {
        OR: [
          { responsable1_id: userId },
          { responsable2_id: userId }
        ]
      },
      select: {
        id: true,
        nom: true
      }
    });

    if (networkAsResponsable) {
      return {
        type: 'responsable_reseau',
        networkName: networkAsResponsable.nom,
        networkId: networkAsResponsable.id
      };
    }

    // Vérifier si l'utilisateur est compagnon d'œuvre d'un réseau
    const networkCompanion = await prisma.networkCompanion.findFirst({
      where: { user_id: userId },
      include: {
        network: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    if (networkCompanion) {
      return {
        type: 'compagnon_oeuvre',
        networkName: networkCompanion.network?.nom || 'Réseau inconnu',
        networkId: networkCompanion.network?.id
      };
    }

    return null;
  } catch (error) {
    logger.error('Erreur lors de la récupération des informations réseau/GR:', error);
    return null;
  }
};

// Récupérer tous les utilisateurs avec filtrage automatique pour les managers
exports.getUsers = async (req, res) => {
  try {
    // Filtrer les paramètres de requête autorisés pour éviter l'injection
    // Note: departement_id retiré car le système utilise maintenant user_departments (départements multiples)
    const allowedFields = ['role', 'genre', 'qualification', 'eglise_locale_id', 'ville_residence', 'origine'];
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

    const users = await req.prisma.user.findMany({
      where,
      include: {
        eglise_locale: {
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
    const users = await req.prisma.user.findMany({
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
    const { id } = req.params;

    const user = await req.prisma.user.findUnique({
      where: { id },
      include: {
        eglise_locale: {
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
    let usersInGroups = [];
    const churchFilter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      churchFilter.eglise_locale_id = req.query.churchId;

      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await req.prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      const groupMembers = await req.prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    } else {
      const groupMembers = await req.prisma.groupMember.findMany({
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
        const networksInChurch = await req.prisma.network.findMany({
          where: { church_id: churchId },
          select: { id: true }
        });
        const networkIds = networksInChurch.map(n => n.id);
        const groupMembers = await req.prisma.groupMember.findMany({
          where: { group: { network_id: { in: networkIds } } },
          select: { user_id: true }
        });
        usersInGroups = groupMembers.map(gm => gm.user_id);
      }
    }

    const specialQualifications = ['RESPONSABLE_RESEAU', 'GOUVERNANCE', 'ECODIM', 'COMPAGNON_OEUVRE'];
    const users = await req.prisma.user.findMany({
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
    let usersInGroups = [];
    const churchFilter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      churchFilter.eglise_locale_id = req.query.churchId;

      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await req.prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      const groupMembers = await req.prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    } else {
      const groupMembers = await req.prisma.groupMember.findMany({
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
        const networksInChurch = await req.prisma.network.findMany({
          where: { church_id: churchId },
          select: { id: true }
        });
        const networkIds = networksInChurch.map(n => n.id);
        const groupMembers = await req.prisma.groupMember.findMany({
          where: { group: { network_id: { in: networkIds } } },
          select: { user_id: true }
        });
        usersInGroups = groupMembers.map(gm => gm.user_id);
      }
    }

    const specialQualifications = ['RESPONSABLE_RESEAU', 'GOUVERNANCE', 'ECODIM'];
    const users = await req.prisma.user.findMany({
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
    const userData = req.body;

    // Logs supprimés pour réduire le volume de logs

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
      // Log supprimé pour réduire le volume de logs
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

    // Vérifier que l'église existe
    const church = await req.prisma.church.findUnique({
      where: { id: egliseLocaleId }
      });

    if (!church) {
        return res.status(400).json({
          success: false,
        message: 'L\'église sélectionnée n\'existe pas'
        });
    }

    // Validation des départements multiples si fournis
    if (userData.departement_ids && Array.isArray(userData.departement_ids) && userData.departement_ids.length > 0) {
      const departments = await req.prisma.department.findMany({
        where: { id: { in: userData.departement_ids } }
      });

      if (departments.length !== userData.departement_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'Un ou plusieurs départements sélectionnés n\'existent pas'
        });
      }
    }

    // Vérification des doublons avant la création
    const orConditions = [];
    if (userData.email) {
      orConditions.push({ email: userData.email });
    }
    if (userData.pseudo) {
      orConditions.push({ pseudo: userData.pseudo });
    }

    if (orConditions.length > 0) {
      const existingUser = await req.prisma.user.findFirst({
        where: {
          OR: orConditions
        },
        select: {
          id: true,
          username: true,
          pseudo: true,
          email: true
        }
      });

      if (existingUser) {
        // Déterminer quel champ est en doublon
        let duplicateFields = [];
        const isEmailDuplicate = userData.email && existingUser.email && existingUser.email === userData.email;
        const isPseudoDuplicate = userData.pseudo && existingUser.pseudo && existingUser.pseudo === userData.pseudo;
        
        if (isEmailDuplicate) {
          duplicateFields.push('email');
        }
        if (isPseudoDuplicate) {
          duplicateFields.push('pseudo');
        }

        const duplicateFieldText = duplicateFields.length > 1 
          ? duplicateFields.join(' et ') 
          : duplicateFields[0] || 'champ';

        let errorMessage = `Un utilisateur avec ce ${duplicateFieldText} existe déjà`;
        
        // Récupérer les informations de réseau/GR seulement si l'email est en doublon
        if (isEmailDuplicate) {
          const networkGroupInfo = await getUserNetworkGroupInfo(req.prisma, existingUser.id);
          
          if (networkGroupInfo) {
            if (networkGroupInfo.type === 'groupe') {
              errorMessage += ` (${existingUser.username || existingUser.pseudo} - ${networkGroupInfo.groupName} du réseau "${networkGroupInfo.networkName}")`;
            } else if (networkGroupInfo.type === 'responsable_reseau') {
              errorMessage += ` (${existingUser.username || existingUser.pseudo} - Responsable du réseau "${networkGroupInfo.networkName}")`;
            } else if (networkGroupInfo.type === 'compagnon_oeuvre') {
              errorMessage += ` (${existingUser.username || existingUser.pseudo} - Compagnon d'œuvre du réseau "${networkGroupInfo.networkName}")`;
            } else {
              errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
            }
          } else {
            errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
          }
        } else {
          // Pour le pseudo, message simple sans détails réseau/GR
          errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
        }

        return res.status(409).json({
          success: false,
          message: errorMessage
        });
      }
    }

    // Log supprimé pour réduire le volume de logs

    // Préparer les données de création
    const userCreateData = {
      ...userData,
      password: hashedPassword
    };

    // Supprimer les champs qui ne doivent pas être dans les données de création
    delete userCreateData.departement_ids;
    delete userCreateData.eglise_locale; // Supprimer la relation si elle existe
    delete userCreateData.eglise_locale_id; // Supprimer l'ID direct, on utilisera la relation
    delete userCreateData.departement; // Supprimer l'ancien champ departement si présent
    
    // Gérer les champs non-nullables qui peuvent être null
    // profession, ville_residence, origine, situation_matrimoniale, niveau_education sont non-nullables dans le schéma
    const nonNullableStringFields = ['profession', 'ville_residence', 'origine', 'situation_matrimoniale', 'niveau_education'];
    nonNullableStringFields.forEach(field => {
      if (userCreateData[field] === null || userCreateData[field] === undefined || userCreateData[field] === '') {
        userCreateData[field] = ''; // Valeur par défaut pour les champs non-nullables
      }
    });
    
    // S'assurer que egliseLocaleId est bien défini et non null
    if (!egliseLocaleId) {
      return res.status(400).json({
        success: false,
        message: 'L\'église locale est obligatoire. Veuillez sélectionner une église.'
      });
    }

    // Création de l'utilisateur avec la relation eglise_locale explicitement connectée
    const newUser = await req.prisma.user.create({
      data: {
        ...userCreateData,
        eglise_locale: {
          connect: { id: egliseLocaleId }
          }
        },
      include: {
        eglise_locale: {
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
      await req.prisma.userDepartment.createMany({
        data: userData.departement_ids.map(departmentId => ({
          user_id: newUser.id,
          department_id: departmentId
        }))
      });

      // Recharger l'utilisateur avec les départements
      const updatedUser = await req.prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          eglise_locale: {
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
      await createActivityLog(req.prisma, req.user.id, 'CREATE', 'USER', updatedUser.id, updatedUser.username, `Utilisateur créé: ${updatedUser.username}`, req);

      return res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        data: updatedUser,
        ...(userData.password && { tempPassword: userData.password })
      });
    }

    // Log de l'activité
    await createActivityLog(req.prisma, req.user.id, 'CREATE', 'USER', newUser.id, newUser.username, `Utilisateur créé: ${newUser.username}`, req);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: newUser,
      ...(userData.password && { tempPassword: userData.password })
    });
  } catch (error) {
    logger.error('User - createUser - Erreur complète:', error);

    // Gestion spécifique de l'erreur P2002 (contrainte unique violée)
    if (error.code === 'P2002' && error.meta?.target) {
      const duplicateField = error.meta.target[0];
      const duplicateValue = req.body[duplicateField];

      if (duplicateValue) {
        try {
          // Trouver l'utilisateur existant avec ce champ
          const whereClause = { [duplicateField]: duplicateValue };
          const existingUser = await req.prisma.user.findFirst({
            where: whereClause,
            select: {
              id: true,
              username: true,
              pseudo: true,
              email: true
            }
          });

          if (existingUser) {
            let errorMessage = `Un utilisateur avec ce ${duplicateField} existe déjà`;
            
            // Récupérer les informations de réseau/GR seulement si l'email est en doublon
            if (duplicateField === 'email') {
              const networkGroupInfo = await getUserNetworkGroupInfo(req.prisma, existingUser.id);
              
              if (networkGroupInfo) {
                if (networkGroupInfo.type === 'groupe') {
                  errorMessage += ` (${existingUser.username || existingUser.pseudo} - ${networkGroupInfo.groupName} du réseau "${networkGroupInfo.networkName}")`;
                } else if (networkGroupInfo.type === 'responsable_reseau') {
                  errorMessage += ` (${existingUser.username || existingUser.pseudo} - Responsable du réseau "${networkGroupInfo.networkName}")`;
                } else if (networkGroupInfo.type === 'compagnon_oeuvre') {
                  errorMessage += ` (${existingUser.username || existingUser.pseudo} - Compagnon d'œuvre du réseau "${networkGroupInfo.networkName}")`;
                } else {
                  errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
                }
              } else {
                errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
              }
            } else {
              // Pour le pseudo, message simple sans détails réseau/GR
              errorMessage += ` (${existingUser.username || existingUser.pseudo})`;
            }

            return res.status(409).json({
              success: false,
              message: errorMessage
            });
          }
        } catch (lookupError) {
          logger.error('Erreur lors de la recherche de l\'utilisateur existant:', lookupError);
          // Continuer avec le gestionnaire d'erreurs standard
        }
      }
    }

    
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
    const { id } = req.params;
    const updateData = req.body;

    // Log pour débogage en cas d'erreur
    logger.info('User - updateUser - Début', { userId: id, updateDataKeys: Object.keys(updateData) });

    // Vérifier que l'utilisateur existe
    const existingUser = await req.prisma.user.findUnique({
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

    // Gérer les départements multiples
    let departementIds = null;
    if (mappedUpdateData.departement_ids !== undefined) {
      departementIds = mappedUpdateData.departement_ids;
      delete mappedUpdateData.departement_ids;
    }

    logger.info('User - updateUser - Données mappées', mappedUpdateData);

    // Mise à jour de l'utilisateur
    const updatedUser = await req.prisma.user.update({
      where: { id },
      data: mappedUpdateData,
      include: {
        eglise_locale: {
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
      await req.prisma.userDepartment.deleteMany({
        where: { user_id: id }
      });

      // Créer les nouvelles associations
      if (Array.isArray(departementIds) && departementIds.length > 0) {
        await req.prisma.userDepartment.createMany({
          data: departementIds.map(departmentId => ({
            user_id: id,
            department_id: departmentId
          }))
        });
      }

      // Recharger l'utilisateur avec les départements mis à jour
      const finalUser = await req.prisma.user.findUnique({
        where: { id },
        include: {
          eglise_locale: {
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
      await createActivityLog(req.prisma, req.user.id, 'UPDATE', 'USER', finalUser.id, finalUser.username, `Utilisateur modifié: ${finalUser.username}`, req);

      return res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: finalUser
      });
    }

    // Log de l'activité
    await createActivityLog(req.prisma, req.user.id, 'UPDATE', 'USER', updatedUser.id, updatedUser.username, `Utilisateur modifié: ${updatedUser.username}`, req);

    res.status(200).json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: updatedUser
    });
  } catch (error) {
    // Log détaillé de l'erreur pour débogage
    logger.error('User - updateUser - Erreur complète', {
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
      userId: req.params?.id,
      updateDataKeys: Object.keys(req.body || {})
    });
    
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
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const existingUser = await req.prisma.user.findUnique({
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
    const userAsGroupResponsible = await req.prisma.group.findFirst({
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
    const userAsNetworkResponsible = await req.prisma.network.findFirst({
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
    const userAsSessionResponsible = await req.prisma.session.findFirst({
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
    const userAsUnitResponsible = await req.prisma.unit.findFirst({
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

    // Vérifier si l'utilisateur est collecteur ou superviseur dans des services
    // (ces champs ne sont pas nullable, donc l'utilisateur doit être remplacé avant suppression)
    const servicesAsCollecteur = await req.prisma.service.count({
      where: { collecteur_culte_id: id }
    });
    
    const servicesAsSuperviseur = await req.prisma.service.count({
      where: { superviseur_id: id }
    });

    if (servicesAsCollecteur > 0 || servicesAsSuperviseur > 0) {
      const roles = [];
      if (servicesAsCollecteur > 0) {
        roles.push(`collecteur de culte (${servicesAsCollecteur} service${servicesAsCollecteur > 1 ? 's' : ''})`);
      }
      if (servicesAsSuperviseur > 0) {
        roles.push(`superviseur (${servicesAsSuperviseur} service${servicesAsSuperviseur > 1 ? 's' : ''})`);
      }
      
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cet utilisateur car il est ${roles.join(' et ')}. Veuillez d'abord remplacer cet utilisateur dans les services concernés avant de le supprimer.`
      });
    }

    // Nettoyage automatique de toutes les références dans une transaction
    try {
      await req.prisma.$transaction(async (tx) => {
        // Retirer l'utilisateur du groupe dont il est membre (un seul groupe possible)
        await tx.groupMember.deleteMany({
          where: { user_id: id }
        });

        // Retirer l'utilisateur de l'historique des groupes
        await tx.groupMemberHistory.deleteMany({
          where: { user_id: id }
        });

        // Retirer l'utilisateur des unités (en tant que membre)
        await tx.unitMember.deleteMany({
          where: { user_id: id }
        });

        // Retirer l'utilisateur des compagnons d'œuvre de réseaux
        await tx.networkCompanion.deleteMany({
          where: { user_id: id }
        });

        // IMPORTANT : Supprimer d'abord les MessageRecipient où l'utilisateur est destinataire
        // (avant de supprimer les messages, car MessageRecipient référence les messages)
        const deletedRecipients = await tx.messageRecipient.deleteMany({
          where: { recipient_id: id }
        });
        logger.info('MessageRecipient supprimés pour l\'utilisateur', { 
          userId: id, 
          count: deletedRecipients.count 
        });

        // Ensuite, supprimer les messages envoyés par l'utilisateur
        // (cela supprimera automatiquement les MessageRecipient associés grâce au onDelete: Cascade)
        const deletedMessages = await tx.message.deleteMany({
          where: { sender_id: id }
        });
        logger.info('Messages envoyés supprimés pour l\'utilisateur', { 
          userId: id, 
          count: deletedMessages.count 
        });
      });

      logger.info('Nettoyage automatique terminé pour l\'utilisateur', { id });
    } catch (cleanupError) {
      logger.error('Erreur lors du nettoyage automatique', {
        userId: id,
        error: cleanupError,
        errorCode: cleanupError.code,
        errorMessage: cleanupError.message
      });
      
      // Si l'erreur est liée aux messages, retourner un message explicite
      if (cleanupError.message && (cleanupError.message.includes('message') || cleanupError.message.includes('Message'))) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer cet utilisateur car il y a une erreur lors de la suppression de ses messages. Veuillez réessayer ou contacter l\'administrateur.'
        });
      }
      
      // Si c'est une contrainte de clé étrangère, essayer de continuer avec un nettoyage manuel
      if (cleanupError.code === 'P2003') {
        logger.warn('Tentative de nettoyage manuel après erreur de contrainte', { userId: id });
        
        // Essayer de supprimer les messages de manière non transactionnelle
        try {
          await req.prisma.messageRecipient.deleteMany({
            where: { recipient_id: id }
          });
          await req.prisma.message.deleteMany({
            where: { sender_id: id }
          });
          logger.info('Nettoyage manuel réussi pour les messages', { userId: id });
        } catch (manualCleanupError) {
          logger.error('Échec du nettoyage manuel des messages', {
            userId: id,
            error: manualCleanupError
          });
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il a des messages (envoyés ou reçus) qui ne peuvent pas être supprimés automatiquement. Veuillez contacter l\'administrateur pour résoudre ce problème.'
          });
        }
      } else {
        // Pour les autres erreurs de nettoyage, retourner une erreur
        return res.status(400).json({
          success: false,
          message: `Erreur lors du nettoyage des données de l'utilisateur: ${cleanupError.message || 'Erreur inconnue'}. Veuillez contacter l'administrateur.`
        });
      }
    }

    // Vérification finale : s'assurer qu'il ne reste plus de références aux messages
    const remainingMessageRecipients = await req.prisma.messageRecipient.count({
      where: { recipient_id: id }
    });
    
    const remainingMessages = await req.prisma.message.count({
      where: { sender_id: id }
    });

    if (remainingMessageRecipients > 0 || remainingMessages > 0) {
      logger.error('Il reste des références aux messages après le nettoyage', {
        userId: id,
        remainingRecipients: remainingMessageRecipients,
        remainingMessages: remainingMessages
      });
      
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer cet utilisateur car il reste ${remainingMessageRecipients + remainingMessages} référence(s) aux messages. Veuillez contacter l'administrateur.`
      });
    }

    // Log de l'activité avant suppression
    await createActivityLog(req.prisma, req.user.id, 'DELETE', 'USER', id, existingUser.username, `Utilisateur supprimé: ${existingUser.username}`, req);

    // Suppression de l'utilisateur
    try {
      await req.prisma.user.delete({
        where: { id }
      });

      res.status(200).json({
        success: true,
        message: `L'utilisateur "${existingUser.username || existingUser.pseudo || 'sans nom'}" a été supprimé avec succès.`,
        data: {}
      });
    } catch (deleteError) {
      // Gestion spécifique des erreurs de suppression
      logger.error('Erreur lors de la suppression de l\'utilisateur', {
        userId: id,
        error: deleteError,
        errorCode: deleteError.code,
        errorMessage: deleteError.message
      });

      // Vérifier les contraintes de clé étrangère spécifiques
      if (deleteError.code === 'P2003') {
        const errorMessage = deleteError.message || '';
        
        // Messages spécifiques selon la contrainte
        if (errorMessage.includes('sessions_responsable1_id_fkey') || errorMessage.includes('sessions_responsable2_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'une section. Veuillez d\'abord changer le responsable de la section ou supprimer la section.'
          });
        }

        if (errorMessage.includes('units_responsable1_id_fkey') || errorMessage.includes('units_responsable2_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'une unité. Veuillez d\'abord changer le responsable de l\'unité ou supprimer l\'unité.'
          });
        }

        if (errorMessage.includes('networks_responsable1_id_fkey') || errorMessage.includes('networks_responsable2_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un réseau. Veuillez d\'abord changer le responsable du réseau ou supprimer le réseau.'
          });
        }

        if (errorMessage.includes('groups_responsable1_id_fkey') || errorMessage.includes('groups_responsable2_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un groupe de réveil. Veuillez d\'abord changer le responsable du groupe ou supprimer le groupe.'
          });
        }

        if (errorMessage.includes('group_members_user_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est membre d\'un groupe de réveil. Veuillez d\'abord le retirer du groupe ou supprimer le groupe.'
          });
        }

        if (errorMessage.includes('unit_members_user_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est membre d\'une unité. Veuillez d\'abord le retirer de l\'unité ou supprimer l\'unité.'
          });
        }

        if (errorMessage.includes('network_companions_user_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est compagnon d\'œuvre d\'un réseau. Veuillez d\'abord le retirer du réseau.'
          });
        }

        if (errorMessage.includes('services_collecteur_culte_id_fkey') || errorMessage.includes('services_superviseur_id_fkey')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il est associé à un service (collecteur ou superviseur). Veuillez d\'abord modifier ou supprimer le service.'
          });
        }

        if (errorMessage.includes('messages_sender_id_fkey') || errorMessage.includes('MessageSender')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il a envoyé des messages. Le système n\'a pas pu supprimer ces messages automatiquement. Veuillez contacter l\'administrateur.'
          });
        }

        if (errorMessage.includes('message_recipients_recipient_id_fkey') || errorMessage.includes('MessageRecipient')) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de supprimer cet utilisateur car il a reçu des messages. Le système n\'a pas pu supprimer ces références automatiquement. Veuillez contacter l\'administrateur.'
          });
        }

        // Message générique pour les autres contraintes
        return res.status(400).json({
          success: false,
          message: `Impossible de supprimer cet utilisateur car il est référencé dans d'autres données du système. Détails techniques: ${errorMessage.substring(0, 200)}. Veuillez contacter l'administrateur.`
        });
      }

      // Autres erreurs Prisma
      if (deleteError.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'L\'utilisateur que vous tentez de supprimer n\'existe plus dans le système.'
        });
      }

      // Erreur générique avec contexte
      const { status, message } = handleError(deleteError, 'la suppression de l\'utilisateur');
      return res.status(status).json({
        success: false,
        message: message || `Impossible de supprimer l'utilisateur. ${deleteError.message || 'Une erreur inattendue s\'est produite.'}`
      });
    }
  } catch (error) {
    logger.error('Erreur générale lors de la suppression de l\'utilisateur', {
      userId: req.params.id,
      error: error,
      errorCode: error.code,
      errorMessage: error.message
    });

    const { status, message } = handleError(error, 'la suppression de l\'utilisateur');
    res.status(status).json({
      success: false,
      message: message || `Erreur lors de la suppression de l'utilisateur. ${error.message || 'Veuillez réessayer ou contacter l\'administrateur.'}`
    });
  }
};

// Récupérer les utilisateurs disponibles pour les groupes
exports.getAvailableUsers = async (req, res) => {
  try {
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
    const allUsers = await req.prisma.user.findMany({
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

    // Récupérer les IDs des utilisateurs qui sont déjà dans des groupes (filtrés par église si spécifié)
    const groupMemberWhere = {};
    if (where.eglise_locale_id) {
      // Filtrer les groupes par église via leurs réseaux
      groupMemberWhere.group = {
        network: {
          church_id: where.eglise_locale_id
        }
      };
    }
    const usersInGroups = await req.prisma.groupMember.findMany({
      where: groupMemberWhere,
      select: {
        user_id: true
      }
    });
    const userIdsInGroups = usersInGroups.map(member => member.user_id);

    // Récupérer les IDs des utilisateurs qui sont responsables de réseaux (filtrés par église si spécifié)
    const networkWhere = {};
    if (where.eglise_locale_id) {
      networkWhere.church_id = where.eglise_locale_id;
    }
    const allNetworks = await req.prisma.network.findMany({
      where: networkWhere,
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

    // Récupérer les IDs des utilisateurs qui sont déjà compagnons d'un réseau (filtrés par église si spécifié)
    const companionWhere = {};
    if (where.eglise_locale_id) {
      companionWhere.network = {
        church_id: where.eglise_locale_id
      };
    }
    const companionsInNetworks = await req.prisma.networkCompanion.findMany({
      where: companionWhere,
      select: {
        user_id: true
      }
    });
    const companionIdsInNetworks = companionsInNetworks.map(c => c.user_id);

    // Récupérer les IDs des utilisateurs qui sont membres de sessions (UnitMember) - filtrés par église si spécifié
    const unitMemberWhere = {};
    if (where.eglise_locale_id) {
      unitMemberWhere.unit = {
        session: {
          church_id: where.eglise_locale_id
        }
      };
    }
    const unitMembers = await req.prisma.unitMember.findMany({
      where: unitMemberWhere,
      select: {
        user_id: true
      }
    });
    const unitMemberIds = unitMembers.map(um => um.user_id);

    // Récupérer les IDs des utilisateurs qui sont responsables d'unités - filtrés par église si spécifié
    const unitWhere = {};
    if (where.eglise_locale_id) {
      unitWhere.session = {
        church_id: where.eglise_locale_id
      };
    }
    const allUnits = await req.prisma.unit.findMany({
      where: unitWhere,
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });
    const unitResponsableIds = allUnits.reduce((ids, unit) => {
      if (unit.responsable1_id) ids.push(unit.responsable1_id);
      if (unit.responsable2_id) ids.push(unit.responsable2_id);
      return ids;
    }, []);

    // Récupérer les IDs des utilisateurs qui sont responsables de sessions - filtrés par église si spécifié
    const sessionWhere = {};
    if (where.eglise_locale_id) {
      sessionWhere.church_id = where.eglise_locale_id;
    }
    const allSessions = await req.prisma.session.findMany({
      where: sessionWhere,
      select: {
        responsable1_id: true,
        responsable2_id: true
      }
    });
    const sessionResponsableIds = allSessions.reduce((ids, session) => {
      if (session.responsable1_id) ids.push(session.responsable1_id);
      if (session.responsable2_id) ids.push(session.responsable2_id);
      return ids;
    }, []);

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

      // Exclure les membres de sessions (UnitMember)
      if (unitMemberIds.includes(user.id)) {
        return false;
      }

      // Exclure les responsables d'unités
      if (unitResponsableIds.includes(user.id)) {
        return false;
      }

      // Exclure les responsables de sessions
      if (sessionResponsableIds.includes(user.id)) {
        return false;
      }

      // Exclure les utilisateurs de la gouvernance SAUF si c'est pour une session ou un réseau
      // (les membres de la gouvernance peuvent être responsables de réseaux/sessions)
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
      unitMembers: unitMemberIds.length,
      unitResponsables: unitResponsableIds.length,
      sessionResponsables: sessionResponsableIds.length,
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
    const { id } = req.params;
    const { qualification } = req.body;

    if (!qualification) {
      return res.status(400).json({
        success: false,
        message: 'Qualification requise'
      });
    }

    const updatedUser = await req.prisma.user.update({
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

    await req.prisma.user.update({
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
    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const users = await req.prisma.user.findMany({
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
    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const users = await req.prisma.user.findMany({
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
    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.eglise_locale_id = req.user.eglise_locale_id;
    }

    const stats = await req.prisma.user.groupBy({
      by: ['qualification'],
      where,
      _count: {
        qualification: true
      }
    });

    const totalUsers = await req.prisma.user.count({ where });

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


// Obtenir l'évolution des membres sur 12 mois
exports.getUsersEvolution = async (req, res) => {
  try {
    const { churchId } = req.query;

    const where = {};

    // Ajouter le filtre par église si spécifié
    if (churchId) {
      where.eglise_locale_id = churchId;
    }

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id && !churchId) {
      const managerChurchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;
      if (managerChurchId) {
        where.eglise_locale_id = managerChurchId;
      }
    }

    // Récupérer tous les utilisateurs avec leur date de création
    const users = await req.prisma.user.findMany({
      where,
      select: {
        createdAt: true
      }
    });

    // Préparer les 12 derniers mois (YYYY-MM), y compris le mois en cours
    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
      const month = d.toISOString().slice(0, 7);
      months.push(month);
    }

    // Calculer l'évolution : nombre total de membres à la fin de chaque mois
    const evolution = [];

    for (const month of months) {
      // Date de fin du mois (inclus)
      const [year, m] = month.split('-');
      const endOfMonth = new Date(Number(year), Number(m), 0, 23, 59, 59, 999);

      // Compter les utilisateurs créés jusqu'à la fin de ce mois
      const membersAtEndOfMonth = users.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate <= endOfMonth;
      }).length;

      // Nombre de nouveaux membres ce mois-ci
      const startOfMonth = new Date(Number(year), Number(m) - 1, 1);
      const newMembersThisMonth = users.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate >= startOfMonth && userDate <= endOfMonth;
      }).length;

      evolution.push({
        month: month,
        total: membersAtEndOfMonth,
        nouveaux: newMembersThisMonth
      });
    }

    res.status(200).json({
      success: true,
      count: evolution.length,
      data: evolution
    });

  } catch (error) {
    logger.error('User - getUsersEvolution - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération de l\'évolution des membres');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour son propre profil (pour les utilisateurs connectés)
exports.updateOwnProfile = async (req, res) => {
  try {
    // L'utilisateur ne peut modifier que son propre profil
    const userId = req.user.id;

    // Empêcher la modification de champs sensibles
    const updateData = { ...req.body };
    delete updateData.role; // Empêcher le changement de rôle
    delete updateData.eglise_locale_id; // Empêcher le changement d'église
    delete updateData.password; // Empêcher le changement de mot de passe via cette route

    // Gérer les départements multiples
    let departementIds = null;
    if (updateData.departement_ids !== undefined) {
      departementIds = updateData.departement_ids;
      delete updateData.departement_ids;
    }

    // Mise à jour de l'utilisateur
    const user = await req.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        eglise_locale: {
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

    // Mettre à jour les départements si fournis
    if (departementIds !== null) {
      // Supprimer les anciennes associations
      await req.prisma.userDepartment.deleteMany({
        where: { user_id: userId }
      });

      if (Array.isArray(departementIds) && departementIds.length > 0) {
        // Créer les nouvelles associations
        await req.prisma.userDepartment.createMany({
          data: departementIds.map(departmentId => ({
            user_id: userId,
            department_id: departmentId
          }))
        });
      }

      // Recharger l'utilisateur avec les départements mis à jour
      const finalUser = await req.prisma.user.findUnique({
        where: { id: userId },
      include: {
        eglise_locale: {
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

      return res.status(200).json({
        success: true,
        data: finalUser
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
    const leftMembers = await req.prisma.groupMemberHistory.findMany({
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

      // Vérifier si l'utilisateur est encore actif par l'une des conditions suivantes:
      // - encore dans un groupe
      // - compagnon d'oeuvre (lié via networkCompanion)
      // - responsable de réseau (assigné comme responsable1 ou responsable2)
      // - possède une qualification spéciale (GOUVERNANCE ou ECODIM)
      const userId = leftMember.user.id;

      const isStillInGroup = await req.prisma.groupMember.findFirst({
        where: { user_id: userId }
      });

      const isCompanion = await req.prisma.networkCompanion.findFirst({
        where: { user_id: userId }
      });

      const isNetworkResponsible = await req.prisma.network.findFirst({
        where: {
          OR: [
            { responsable1_id: userId },
            { responsable2_id: userId }
          ]
        }
      });

      const hasSpecialQualification = [
        'GOUVERNANCE',
        'ECODIM'
      ].includes(leftMember.user.qualification);

      // Si l'utilisateur n'est plus actif selon les critères ci-dessus, il est considéré comme retiré
      if (!isStillInGroup && !isCompanion && !isNetworkResponsible && !hasSpecialQualification) {
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
    const updatedUser = await req.prisma.user.update({
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
    // Récupérer l'utilisateur actuel
    const user = await req.prisma.user.findUnique({
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
    await req.prisma.user.update({
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
    const existingUser = await req.prisma.user.findUnique({
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
    const updatedUser = await req.prisma.user.update({
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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await req.prisma.user.findUnique({
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
    network = await req.prisma.network.findFirst({
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
      const groupMember = await req.prisma.groupMember.findFirst({
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
        const companion = await req.prisma.networkCompanion.findFirst({
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
      // Retourner 200 avec networkId: null au lieu de 404 pour éviter les erreurs dans la console
      // C'est un cas normal (un utilisateur peut ne pas être impliqué dans un réseau)
      return res.status(200).json({
        success: true,
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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await req.prisma.user.findUnique({
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
    session = await req.prisma.session.findFirst({
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
      const unitMember = await req.prisma.unitMember.findFirst({
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
        const unitResponsable = await req.prisma.unit.findFirst({
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
      // Retourner 200 avec sessionId: null au lieu de 404 pour éviter les erreurs dans la console
      // C'est un cas normal (un utilisateur peut ne pas être impliqué dans une session)
      return res.status(200).json({
        success: true,
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
