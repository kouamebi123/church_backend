const QualificationService = require('../services/qualificationService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');

// Fonction pour formater les noms selon la logique demandée
const formatResponsableName = (username) => {
  if (!username) return '';
  
  const statusPrefixes = ['Past.', 'MC.', 'PE.', 'CE.', 'Resp.'];
  const words = username.split(' ');
  
  // Vérifier si le premier mot est un préfixe de statut
  const firstWord = words[0];
  const isStatusPrefix = statusPrefixes.includes(firstWord);
  
  if (isStatusPrefix) {
    // Si préfixe existe, prendre le premier nom après le préfixe
    return words.length >= 2 ? words[1] : firstWord;
  } else {
    // Si préfixe n'existe pas, prendre le premier nom seulement
    return words[0];
  }
};

// Fonction utilitaire pour générer le nom automatique d'un groupe
const generateGroupName = async (prisma, responsable1Id, responsable2Id = null) => {
  try {
    let responsableName = '';

    if (responsable1Id) {
      const responsable1 = await prisma.user.findUnique({
        where: { id: responsable1Id },
        select: { username: true, pseudo: true }
      });

      if (responsable1) {
        // Utiliser la logique de formatage seulement pour username
        if (responsable1.username) {
          responsableName = formatResponsableName(responsable1.username);
        } else {
          // Si pas de username, utiliser pseudo tel quel
          responsableName = responsable1.pseudo || '';
        }
      }
    }

    // Si pas de responsable1, essayer responsable2
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

    // Si toujours pas de nom, utiliser "Sans_Responsable"
    if (!responsableName) {
      return 'GR_Sans_Responsable';
    }

    // Nettoyer le nom (enlever les espaces, caractères spéciaux)
    const cleanName = responsableName
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '') // Garder lettres, chiffres et espaces
      .replace(/\s+/g, '_') // Remplacer espaces par underscores
      .trim();

    return `GR_${cleanName}`;
  } catch (error) {
    logger.error('Erreur lors de la génération du nom du groupe', error);
    return 'GR_Sans_Responsable';
  }
};

// Fonction utilitaire pour ajouter un membre à un groupe
const addMemberToGroup = async (prisma, groupId, userId) => {
  try {
    // Ajouter le membre au groupe
    await prisma.groupMember.create({
      data: {
        group_id: groupId,
        user_id: userId
      }
    });

    // Enregistrer dans l'historique
    await prisma.groupMemberHistory.create({
      data: {
        group_id: groupId,
        user_id: userId,
        action: 'JOINED'
      }
    });

    return true;
  } catch (error) {
    logger.error('Erreur lors de l\'ajout du membre', error);
    return false;
  }
};

// Fonction utilitaire pour retirer un membre d'un groupe
const removeMemberFromGroup = async (prisma, groupId, userId) => {
  try {
    // Retirer le membre du groupe
    await prisma.groupMember.delete({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userId
        }
      }
    });

    // Enregistrer dans l'historique
    await prisma.groupMemberHistory.create({
      data: {
        group_id: groupId,
        user_id: userId,
        action: 'LEFT'
      }
    });

    // Mettre à jour la qualification de l'utilisateur à MEMBRE_IRREGULIER
    await prisma.user.update({
      where: { id: userId },
      data: { qualification: 'MEMBRE_IRREGULIER' }
    });

    logger.info('Group - removeMemberFromGroup - Utilisateur remis à MEMBRE_IRREGULIER', { userId });

    return true;
  } catch (error) {
    logger.error('Erreur lors du retrait du membre', error);
    return false;
  }
};

// Récupérer la liste des responsables disponibles pour le supérieur hiérarchique
exports.getAvailableResponsables = async (req, res) => {
  try {
    const { prisma } = req;
    const { network_id } = req.query;

    if (!network_id) {
      return res.status(400).json({
        success: false,
        message: 'ID du réseau requis'
      });
    }

    // Récupérer le réseau avec ses responsables
    const network = await prisma.network.findUnique({
      where: { id: network_id },
      include: {
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

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Récupérer tous les groupes du réseau avec leurs responsables
    const groups = await prisma.group.findMany({
      where: { network_id },
      include: {
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

    // Construire la liste des responsables disponibles
    const responsables = [];

    // Ajouter les responsables de réseau
    if (network.responsable1) {
      responsables.push({
        id: network.responsable1.id,
        username: network.responsable1.username,
        pseudo: network.responsable1.pseudo,
        qualification: network.responsable1.qualification,
        type: 'RESPONSABLE_RESEAU',
        niveau: getNiveauFromQualification('RESPONSABLE_RESEAU')
      });
    }

    if (network.responsable2) {
      responsables.push({
        id: network.responsable2.id,
        username: network.responsable2.username,
        pseudo: network.responsable2.pseudo,
        qualification: network.responsable2.qualification,
        type: 'RESPONSABLE_RESEAU',
        niveau: getNiveauFromQualification('RESPONSABLE_RESEAU')
      });
    }

    // Ajouter les responsables de groupes
    groups.forEach(group => {
      if (group.responsable1) {
        responsables.push({
          id: group.responsable1.id,
          username: group.responsable1.username,
          pseudo: group.responsable1.pseudo,
          qualification: group.responsable1.qualification,
          type: 'RESPONSABLE_GR', // Type pour identifier que c'est un responsable de groupe
          niveau: getNiveauFromQualification(group.responsable1.qualification),
          groupe: group.nom
        });
      }

      if (group.responsable2) {
        responsables.push({
          id: group.responsable2.id,
          username: group.responsable2.username,
          pseudo: group.responsable2.pseudo,
          qualification: group.responsable2.qualification,
          type: 'RESPONSABLE_GR', // Type pour identifier que c'est un responsable de groupe
          niveau: getNiveauFromQualification(group.responsable2.qualification),
          groupe: group.nom
        });
      }
    });

    // Trier par niveau hiérarchique
    responsables.sort((a, b) => a.niveau - b.niveau);

    res.status(200).json({
      success: true,
      data: responsables
    });
  } catch (error) {
    logger.error('Group - getAvailableResponsables - Erreur complète', error);

    const { status, message } = handleError(error, 'la récupération des responsables disponibles');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer tous les groupes avec filtrage automatique pour les managers
exports.getGroups = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      where.network_id = { in: networkIds };
    }

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Récupérer les réseaux de l'église du manager
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.user.eglise_locale_id },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      where.network_id = { in: networkIds };
    }

    const groups = await prisma.group.findMany({
      where,
      include: {
        network: {
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
          include: {
            user: {
              select: {
                id: true,
                username: true,
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
      count: groups.length,
      data: groups
    });
  } catch (error) {
    logger.error('Group - getGroups - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des groupes');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer un groupe par ID
exports.getGroup = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        network: {
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
          include: {
            user: {
              select: {
                id: true,
                username: true,
                qualification: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Groupe non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: group
    });
  } catch (error) {
    logger.error('Group - getGroup - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du groupe');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un nouveau groupe
exports.createGroup = async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, description, network_id, responsable1_id, responsable2_id, members, qualification, superieur_hierarchique_id } = req.body;

    if (!network_id) {
      return res.status(400).json({
        success: false,
        message: 'Le réseau est requis'
      });
    }

    if (!responsable1_id) {
      return res.status(400).json({
        success: false,
        message: 'Le responsable principal est obligatoire'
      });
    }

    if (!qualification) {
      return res.status(400).json({
        success: false,
        message: 'La qualification du groupe est requise'
      });
    }

    // Vérifier si le réseau existe
    const network = await prisma.network.findUnique({
      where: { id: network_id },
      include: {
        church: {
          select: {
            id: true
          }
        }
      }
    });

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Vérifier l'autorisation d'église si nécessaire
    if (req.requiresChurchCheck && req.user.eglise_locale) {
      const networkChurchId = network.church?.id;
      if (networkChurchId && networkChurchId.toString() !== req.user.eglise_locale.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez créer des groupes que dans les réseaux de votre église'
        });
      }
    }

    // Vérifier si le supérieur hiérarchique existe et est dans le bon réseau
    if (superieur_hierarchique_id) {
      const superieur = await prisma.user.findUnique({
        where: { id: superieur_hierarchique_id },
        include: {
          group_responsable1: {
            where: { network_id: network_id },
            include: { network: true }
          },
          network_responsable1: {
            where: { id: network_id }
          }
        }
      });

      if (!superieur) {
        return res.status(400).json({
          success: false,
          message: 'Supérieur hiérarchique non trouvé'
        });
      }

      // Vérifier que le supérieur est soit responsable de réseau, soit responsable de groupe dans le même réseau
      const isInSameNetwork = superieur.group_responsable1.length > 0 || superieur.network_responsable1.length > 0;
      if (!isInSameNetwork) {
        return res.status(400).json({
          success: false,
          message: 'Le supérieur hiérarchique doit être dans le même réseau'
        });
      }
    }

    // Déterminer le niveau selon la qualification
    const niveau = getNiveauFromQualification(qualification);
    
    if (niveau === 0) {
      return res.status(400).json({
        success: false,
        message: 'Qualification invalide pour un groupe'
      });
    }

    // Générer automatiquement le nom du groupe
    let groupName = nom;
    if (!groupName || groupName.trim() === '') {
      if (responsable1_id || responsable2_id) {
        groupName = await generateGroupName(prisma, responsable1_id, responsable2_id);
        logger.info('Nom de groupe généré automatiquement', { groupName });
      } else {
        groupName = 'GR_Sans_Responsable';
        logger.info('Nom de groupe par défaut', { groupName });
      }
    }

    // Créer le groupe dans une transaction
    const group = await prisma.$transaction(async (tx) => {
      // Créer le groupe (sans qualification stockée)
      const newGroup = await tx.group.create({
        data: {
          nom: groupName,
          description,
          network_id,
          responsable1_id,
          responsable2_id: responsable2_id || null,
          superieur_hierarchique_id: superieur_hierarchique_id || null
        },
        include: {
          network: {
            select: {
              id: true,
              nom: true,
              church: {
                select: {
                  id: true
                }
              }
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
          superieur_hierarchique: {
            select: {
              id: true,
              username: true,
              pseudo: true
            }
          }
        }
      });

      // Ajouter le responsable1 à la chaîne d'impact (upsert pour éviter les doublons)
      await tx.chaineImpact.upsert({
        where: {
          user_id_niveau_eglise_id: {
            user_id: responsable1_id,
            niveau: niveau,
            eglise_id: network.church.id
          }
        },
        update: {
          qualification,
          responsable_id: superieur_hierarchique_id,
          network_id: network_id,
          group_id: newGroup.id,
          position_x: 0,
          position_y: 0
        },
        create: {
          user_id: responsable1_id,
          niveau,
          qualification,
          responsable_id: superieur_hierarchique_id,
          eglise_id: network.church.id,
          network_id: network_id,
          group_id: newGroup.id,
          position_x: 0,
          position_y: 0
        }
      });

      // Si responsable2 existe, l'ajouter aussi (upsert pour éviter les doublons)
      if (responsable2_id) {
        await tx.chaineImpact.upsert({
          where: {
            user_id_niveau_eglise_id: {
              user_id: responsable2_id,
              niveau: niveau,
              eglise_id: network.church.id
            }
          },
          update: {
            qualification,
            responsable_id: superieur_hierarchique_id,
            network_id: network_id,
            group_id: newGroup.id,
            position_x: 1,
            position_y: 0
          },
          create: {
            user_id: responsable2_id,
            niveau,
            qualification,
            responsable_id: superieur_hierarchique_id,
            eglise_id: network.church.id,
            network_id: network_id,
            group_id: newGroup.id,
            position_x: 1,
            position_y: 0
          }
        });
      }

      logger.info('createGroup - Responsables ajoutés à la chaîne d\'impact', {
        responsable1_id,
        responsable2_id,
        niveau,
        qualification,
        eglise_id: network.church.id,
        network_id,
        group_id: newGroup.id
      });

      return newGroup;
    });

    // Mettre à jour les qualifications des responsables selon la qualification du groupe
    if (responsable1_id) {
      await prisma.user.update({
        where: { id: responsable1_id },
        data: { qualification }
      });
    }

    if (responsable2_id) {
      await prisma.user.update({
        where: { id: responsable2_id },
        data: { qualification }
      });
    }

    // Ajouter automatiquement les responsables comme membres du groupe
    const responsablesToAdd = [];
    if (responsable1_id) {
      responsablesToAdd.push(responsable1_id);
    }
    if (responsable2_id) {
      responsablesToAdd.push(responsable2_id);
    }

    // Ajouter les responsables comme membres du groupe
    for (const responsableId of responsablesToAdd) {
      try {
        await prisma.groupMember.create({
          data: {
            group_id: group.id,
            user_id: responsableId
          }
        });
        logger.info('Responsable ajouté comme membre du groupe', { responsableId, groupId: group.id });
      } catch (error) {
        // Ignorer l'erreur si le responsable est déjà membre (contrainte unique)
        if (error.code !== 'P2002') {
          logger.error('Erreur lors de l\'ajout du responsable comme membre', { responsableId, error });
        }
      }
    }

    // Ajouter les autres membres au groupe si spécifiés
    if (members && members.length > 0) {
      const membersToAdd = members.filter(Boolean);
      for (const memberId of membersToAdd) {
        // Éviter de dupliquer les responsables
        if (!responsablesToAdd.includes(memberId)) {
          try {
            await prisma.groupMember.create({
              data: {
                group_id: group.id,
                user_id: memberId
              }
            });
          } catch (error) {
            // Ignorer l'erreur si le membre est déjà dans le groupe
            if (error.code !== 'P2002') {
              logger.error('Erreur lors de l\'ajout du membre', { memberId, error });
            }
          }
        }
      }
    }

    // Récupérer le groupe avec tous les détails
    const populatedGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        network: {
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
          include: {
            user: {
              select: {
                id: true,
                username: true,
                qualification: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: populatedGroup
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Mettre à jour un groupe
exports.updateGroup = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier si le groupe existe
    const existingGroup = await prisma.group.findUnique({
      where: { id }
    });

    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        message: 'Groupe non trouvé'
      });
    }

    // Vérifier si le nom est unique dans ce réseau (sauf pour ce groupe)
    if (updateData.nom && updateData.nom !== existingGroup.nom) {
      const duplicateGroup = await prisma.group.findFirst({
        where: {
          nom: updateData.nom,
          network_id: updateData.network_id || existingGroup.network_id,
          id: {
            not: id
          }
        }
      });

      if (duplicateGroup) {
        return res.status(400).json({
          success: false,
          message: 'Un groupe avec ce nom existe déjà dans ce réseau'
        });
      }
    }

    // Mettre à jour automatiquement le nom du groupe si les responsables changent
    if (updateData.responsable1_id !== undefined || updateData.responsable2_id !== undefined) {
      logger.debug('DEBUG updateGroup - Changement de responsables', {
        groupeExistant: existingGroup,
        donneesMiseAJour: updateData,
        ancienResponsable1: existingGroup.responsable1_id,
        ancienResponsable2: existingGroup.responsable2_id,
        nouveauResponsable1: updateData.responsable1_id,
        nouveauResponsable2: updateData.responsable2_id
      });

      // Mettre à jour automatiquement le nom du groupe si les responsables changent
      const newResponsable1Id = updateData.responsable1_id !== undefined ? updateData.responsable1_id : existingGroup.responsable1_id;
      const newResponsable2Id = updateData.responsable2_id !== undefined ? updateData.responsable2_id : existingGroup.responsable2_id;

      if (newResponsable1Id || newResponsable2Id) {
        const newGroupName = await generateGroupName(prisma, newResponsable1Id, newResponsable2Id);
        updateData.nom = newGroupName;
        logger.info('Nom de groupe mis à jour automatiquement', { newGroupName });
      }
    }

    // Mettre à jour le groupe
    const updatedGroup = await prisma.group.update({
      where: { id },
      data: updateData,
      include: {
        network: {
          select: {
            id: true,
            nom: true,
            church: {
              select: {
                id: true,
                nom: true
              }
            }
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

    // Gérer les changements de responsables et mettre à jour les qualifications
    if (updateData.responsable1_id || updateData.responsable2_id) {

      try {
        const qualificationService = new QualificationService(prisma);

        // Mettre à jour les qualifications des responsables
        logger.info('Appel du service de qualification');
        await qualificationService.updateGroupResponsablesQualification(
          id,
          existingGroup.responsable1_id,
          existingGroup.responsable2_id,
          updateData.responsable1_id,
          updateData.responsable2_id
        );
        logger.info('Service de qualification exécuté avec succès');
      } catch (error) {
        logger.error('Erreur lors de la mise à jour des qualifications', error);
        // Ne pas faire échouer la mise à jour du groupe à cause des qualifications
      }

      const newResponsables = [];
      if (updateData.responsable1_id) {
        newResponsables.push(updateData.responsable1_id);
      }
      if (updateData.responsable2_id) {
        newResponsables.push(updateData.responsable2_id);
      }

      // Ajouter les nouveaux responsables comme membres du groupe
      for (const responsableId of newResponsables) {
        if (responsableId) {
          try {
            await prisma.groupMember.create({
              data: {
                group_id: id,
                user_id: responsableId
              }
            });
            logger.info('Nouveau responsable ajouté comme membre du groupe', { responsableId, groupId: id });
          } catch (error) {
            // Ignorer l'erreur si le responsable est déjà membre
            if (error.code !== 'P2002') {
              logger.error('Erreur lors de l\'ajout du responsable comme membre', { responsableId, error });
            }
          }
        }
      }
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    logger.error('Group - updateGroup - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour du groupe');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un groupe
exports.deleteGroup = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    logger.info(`Tentative de suppression du groupe ${id}`);

    // Vérifier si le groupe existe
    const existingGroup = await prisma.group.findUnique({
      where: { id }
    });

    if (!existingGroup) {
      logger.warn(`Groupe ${id} non trouvé`);
      return res.status(404).json({
        success: false,
        message: 'Groupe non trouvé'
      });
    }

    logger.info(`Groupe trouvé: ${existingGroup.nom}, suppression des membres...`);

    // Supprimer d'abord les membres du groupe
    const deletedMembers = await prisma.groupMember.deleteMany({
      where: { group_id: id }
    });
    logger.info(`${deletedMembers.count} membres supprimés du groupe`);

    // Supprimer l'historique des membres du groupe
    const deletedHistory = await prisma.groupMemberHistory.deleteMany({
      where: { group_id: id }
    });
    logger.info(`${deletedHistory.count} entrées d'historique supprimées`);

    // Supprimer les entrées de chaîne d'impact liées au groupe
    const deletedChaineImpact = await prisma.chaineImpact.deleteMany({
      where: { group_id: id }
    });
    logger.info(`${deletedChaineImpact.count} entrées de chaîne d'impact supprimées`);

    // Nettoyer les qualifications des responsables avant de supprimer le groupe
    logger.info('Nettoyage des qualifications des responsables...');
    const qualificationService = new QualificationService(prisma);
    await qualificationService.cleanupGroupQualification(id);
    logger.info('Qualifications nettoyées avec succès');

    // Supprimer le groupe
    logger.info('Suppression du groupe...');
    await prisma.group.delete({
      where: { id }
    });
    logger.info(`Groupe ${id} supprimé avec succès`);

    res.json({
      success: true,
      message: 'Groupe supprimé avec succès'
    });
  } catch (error) {
    logger.error('Group - deleteGroup - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression du groupe');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Ajouter un membre à un groupe
exports.addMember = async (req, res) => {
  try {
    const { prisma } = req;
    const { id: groupId } = req.params;

    logger.debug('DEBUG addMember', {
      params: req.params,
      body: req.body,
      userId: req.body.user_id,
      userIdType: typeof req.body.user_id
    });

    const { user_id } = req.body;

    if (!user_id) {
      logger.warn('user_id manquant dans req.body');
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'utilisateur est requis'
      });
    }

    // Vérifier si le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        network: {
          select: {
            church_id: true
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Groupe non trouvé'
      });
    }

    // Vérifier l'autorisation d'église si nécessaire
    if (req.requiresChurchCheck && req.user.eglise_locale) {
      const groupChurchId = group.network?.church_id;
      if (groupChurchId && groupChurchId.toString() !== req.user.eglise_locale.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez accéder qu\'aux groupes de votre église'
        });
      }
    }

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur est déjà membre du groupe
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id
      }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur est déjà membre de ce groupe'
      });
    }

    // Vérifier si l'utilisateur est déjà membre d'un autre groupe
    const userInOtherGroups = await prisma.groupMember.findFirst({
      where: {
        user_id,
        group_id: { not: groupId }
      }
    });

    if (userInOtherGroups) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur est déjà membre d\'un autre groupe'
      });
    }

    // Vérifier si l'utilisateur est responsable d'un réseau
    const userIsNetworkResponsable = await prisma.network.findFirst({
      where: {
        OR: [
          { responsable1_id: user_id },
          { responsable2_id: user_id }
        ]
      }
    });

    if (userIsNetworkResponsable) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur est responsable d\'un réseau et ne peut pas être ajouté à un groupe'
      });
    }

    // Vérifier si l'utilisateur a une qualification qui l\'empêche d\'être dans un groupe
    const excludedQualifications = [
      'GOUVERNANCE',
      'RESPONSABLE_RESEAU',
      'ECODIM',
      'RESPONSABLE_ECODIM'
    ];

    if (excludedQualifications.includes(user.qualification)) {
      return res.status(400).json({
        success: false,
        message: `L'utilisateur a la qualification '${user.qualification}' et ne peut pas être ajouté à un groupe`
      });
    }

    logger.info('Vérifications passées, ajout du membre autorisé');

    // Ajouter le membre
    const success = await addMemberToGroup(prisma, groupId, user_id);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout du membre'
      });
    }

    // Récupérer le membre ajouté pour la réponse
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            role: true,
            qualification: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: groupMember
    });
  } catch (error) {
    logger.error('Group - addMember - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'l\'ajout du membre');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Retirer un membre d'un groupe
exports.removeMember = async (req, res) => {
  try {
    const { prisma } = req;
    const { id: groupId, userId } = req.params;

    // Vérifier si le membre existe
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        user_id: userId
      }
    });

    if (!existingMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre non trouvé dans ce groupe'
      });
    }

    // Vérifier si l'utilisateur est un responsable du groupe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        network: {
          select: {
            church_id: true
          }
        }
      }
    });

    // Vérifier l'autorisation d'église si nécessaire
    if (req.requiresChurchCheck && req.user.eglise_locale) {
      const groupChurchId = group.network?.church_id;
      if (groupChurchId && groupChurchId.toString() !== req.user.eglise_locale.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez accéder qu\'aux groupes de votre église'
        });
      }
    }

    if (group && (group.responsable1_id === userId || group.responsable2_id === userId)) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de retirer un responsable de son groupe. Modifiez d\'abord le responsable du groupe.'
      });
    }

    // Retirer le membre
    const success = await removeMemberFromGroup(prisma, groupId, userId);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors du retrait du membre'
      });
    }

    res.json({
      success: true,
      message: 'Membre retiré du groupe avec succès'
    });
  } catch (error) {
    logger.error('Group - removeMember - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'le retrait du membre');

    res.status(status).json({
      success: false,
      message
    });
  }
};
