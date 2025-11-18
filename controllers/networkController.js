const QualificationService = require('../services/qualificationService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');
const { rebuildChaineImpact } = require('../utils/chaineImpactService');

// Récupérer tous les réseaux avec filtrage automatique pour les managers
exports.getNetworks = async (req, res) => {
  try {
    const { prisma } = req;

    const filter = {};

    // Si l'utilisateur est un manager, filtrer automatiquement par son église
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;

      if (churchId) {
        filter.church_id = churchId;
      }
    } else {
      if (req.query.churchId) {
        filter.church_id = req.query.churchId;
      }
    }

    // Générer une clé de cache unique
    const cacheKey = cache.generateKey('networks', {
      ...filter,
      role: req.user?.role,
      userId: req.user?.id
    });

    // TEMPORAIREMENT DÉSACTIVÉ POUR DIAGNOSTIC - Vérifier le cache d'abord
    // const cachedData = cache.get(cacheKey);
    // if (cachedData) {
    //   return res.status(200).json(cachedData);
    // }

    const networks = await prisma.network.findMany({
      where: filter,
      include: {
        church: {
          select: {
            id: true,
            nom: true,
            adresse: true
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
        createdAt: 'desc'
      }
    });

    const response = {
      success: true,
      count: networks.length,
      data: networks
    };

    // TEMPORAIREMENT DÉSACTIVÉ POUR DIAGNOSTIC - Mettre en cache pour 2 minutes (données qui changent peu)
    // cache.set(cacheKey, response, 120000);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Network - getNetworks - Erreur complète', error);

    const { status, message } = handleError(error, 'la récupération des réseaux');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer un réseau par ID
exports.getNetwork = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const network = await prisma.network.findUnique({
      where: { id },
      include: {
        church: {
          select: {
            id: true,
            nom: true,
            adresse: true
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
        groups: {
          include: {
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
        }
      }
    });

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Obtenir les statistiques (à implémenter selon vos besoins)
    const stats = {}; // Placeholder pour les statistiques

    res.status(200).json({
      success: true,
      data: { ...network, stats }
    });
  } catch (error) {
    logger.error('Network - getNetwork - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du réseau');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un nouveau réseau
exports.createNetwork = async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  try {
    // Logs supprimés pour réduire le volume de logs
    
    const { prisma } = req;
    const { nom, responsable1, responsable2, church, active } = req.body;

    if (!nom || !responsable1) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et le responsable principal sont requis'
      });
    }

    // Vérifications spécifiques pour le manager
    if (req.user && req.user.role === 'MANAGER') {
      // Le manager ne peut créer des réseaux que dans son église
      if (church && church !== req.user.eglise_locale_id) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez créer des réseaux que dans votre église'
        });
      }

      // Forcer l'église à celle du manager si non spécifiée
      if (!church) {
        req.body.church = req.user.eglise_locale_id;
      }
    }

    // Vérifier si l'église existe
    if (church) {
      const churchExists = await prisma.church.findUnique({
        where: { id: church }
      });

      if (!churchExists) {
        return res.status(400).json({
          success: false,
          message: 'Église non trouvée'
        });
      }
    }

    // Vérifier si le responsable1 existe
    const responsable1Exists = await prisma.user.findUnique({
      where: { id: responsable1 }
    });

    if (!responsable1Exists) {
      return res.status(400).json({
        success: false,
        message: 'Responsable principal non trouvé'
      });
    }

    // Vérifier si le responsable2 existe (optionnel)
    if (responsable2) {
      const responsable2Exists = await prisma.user.findUnique({
        where: { id: responsable2 }
      });

      if (!responsable2Exists) {
        return res.status(400).json({
          success: false,
          message: 'Responsable secondaire non trouvé'
        });
      }
    }

    // Log supprimé pour réduire le volume de logs

    // Créer le réseau dans une transaction
    const network = await prisma.$transaction(async (tx) => {
      // Créer le réseau
      const newNetwork = await tx.network.create({
        data: {
          nom,
          church_id: church,
          responsable1_id: responsable1,
          responsable2_id: responsable2 || null,
          active: active !== undefined ? active : true
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

      // Récupérer le responsable de l'église pour la chaîne d'impact
      const churchData = await tx.church.findUnique({
        where: { id: church },
        include: { responsable: true }
      });

      if (churchData?.responsable) {
        // Ajouter le responsable1 du réseau à la chaîne d'impact (niveau 1)
        await tx.chaineImpact.create({
          data: {
            user_id: responsable1,
            niveau: getNiveauFromQualification('RESPONSABLE_RESEAU'), // Utilise la fonction utilitaire
            qualification: 'RESPONSABLE_RESEAU',
            responsable_id: churchData.responsable.id, // Supérieur hiérarchique = responsable d'église
            eglise_id: church,
            network_id: newNetwork.id,
            group_id: null,
            position_x: 0,
            position_y: 1
          }
        });

        // Log supprimé pour réduire le volume de logs

        // Si responsable2 existe, l'ajouter aussi
        if (responsable2) {
          await tx.chaineImpact.create({
            data: {
              user_id: responsable2,
              niveau: getNiveauFromQualification('RESPONSABLE_RESEAU'), // Utilise la fonction utilitaire
              qualification: 'RESPONSABLE_RESEAU',
              responsable_id: churchData.responsable.id, // Supérieur hiérarchique = responsable d'église
              eglise_id: church,
              network_id: newNetwork.id,
              group_id: null,
              position_x: 1,
              position_y: 1
            }
          });

          // Log supprimé pour réduire le volume de logs
        }
      }

      return newNetwork;
    });

    const duration = Date.now() - startTime;
    
    // Log supprimé pour réduire le volume de logs
    
    // Log des performances
    logger.performance('createNetwork', duration, {
      requestId,
      networkId: network.id,
      networkName: network.nom,
      churchId: network.church_id
    });

    // Mettre à jour la qualification des responsables
    const responsables = [];
    if (network.responsable1_id) responsables.push(network.responsable1_id);
    if (network.responsable2_id) responsables.push(network.responsable2_id);

    if (responsables.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsables } },
        data: { qualification: 'RESPONSABLE_RESEAU' }
      });
    }

    // Reconstruire la chaîne d'impact pour l'église concernée
    try {
      await rebuildChaineImpact(prisma, church_id);
    } catch (error) {
      logger.error('Erreur lors de la reconstruction de la chaîne d\'impact après création du réseau:', error);
      // Ne pas faire échouer la création du réseau
    }

    res.status(201).json({
      success: true,
      data: network
    });
  } catch (error) {
    logger.error('Network - createNetwork - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la création du réseau');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour un réseau
exports.updateNetwork = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { nom, responsable1, responsable2, church, active } = req.body;

    // Logs supprimés pour réduire le volume de logs

    // Vérifier si le réseau existe
    const existingNetwork = await prisma.network.findUnique({
      where: { id }
    });

    if (!existingNetwork) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Vérifier si le nom est unique dans cette église (sauf pour ce réseau)
    if (nom && nom !== existingNetwork.nom) {
      const duplicateNetwork = await prisma.network.findFirst({
        where: {
          nom,
          church_id: church || existingNetwork.church_id,
          id: {
            not: id
          }
        }
      });

      if (duplicateNetwork) {
        return res.status(400).json({
          success: false,
          message: 'Un réseau avec ce nom existe déjà dans cette église'
        });
      }
    }

    // Vérifier si l'église existe (si modifiée)
    if (church && church !== existingNetwork.church_id) {
      const churchExists = await prisma.church.findUnique({
        where: { id: church }
      });

      if (!churchExists) {
        return res.status(400).json({
          success: false,
          message: 'Église non trouvée'
        });
      }
    }

    // Vérifier si le responsable1 existe (si modifié)
    if (responsable1 && responsable1 !== existingNetwork.responsable1_id) {
      const responsable1Exists = await prisma.user.findUnique({
        where: { id: responsable1 }
      });

      if (!responsable1Exists) {
        return res.status(400).json({
          success: false,
          message: 'Responsable principal non trouvé'
        });
      }
    }

    // Vérifier si le responsable2 existe (si modifié)
    if (responsable2 && responsable2 !== existingNetwork.responsable2_id) {
      const responsable2Exists = await prisma.user.findUnique({
        where: { id: responsable2 }
      });

      if (!responsable2Exists) {
        return res.status(400).json({
          success: false,
          message: 'Responsable secondaire non trouvé'
        });
      }
    }

    // Préparer les données de mise à jour
    const updateData = {
      ...(nom && { nom }),
      ...(church && { church_id: church }),
      ...(responsable1 && { responsable1_id: responsable1 }),
      ...(responsable2 !== undefined && { responsable2_id: responsable2 }),
      ...(active !== undefined && { active })
    };

    // Log supprimé pour réduire le volume de logs

    // Mettre à jour les qualifications des responsables si ils ont changé
    if (responsable1 || responsable2 !== undefined) {
      const qualificationService = new QualificationService(prisma);

      await qualificationService.updateNetworkResponsablesQualification(
        id,
        existingNetwork.responsable1_id,
        existingNetwork.responsable2_id,
        responsable1 || existingNetwork.responsable1_id,
        responsable2 !== undefined ? responsable2 : existingNetwork.responsable2_id
      );
    }

    // Mettre à jour le réseau dans une transaction
    const updatedNetwork = await prisma.$transaction(async (tx) => {
      // Mettre à jour le réseau
      const network = await tx.network.update({
        where: { id },
        data: updateData,
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

      // Gérer les changements de responsables dans la chaîne d'impact
      if (responsable1 || responsable2 !== undefined) {
        // Récupérer le responsable de l'église
        const churchData = await tx.church.findUnique({
          where: { id: network.church_id },
          include: { responsable: true }
        });

        if (churchData?.responsable) {
          // Gérer le responsable1
          if (responsable1 && responsable1 !== existingNetwork.responsable1_id) {
            // Supprimer l'ancien responsable1 de la chaîne d'impact
            if (existingNetwork.responsable1_id) {
              await tx.chaineImpact.deleteMany({
                where: {
                  user_id: existingNetwork.responsable1_id,
                  network_id: id,
                  niveau: 2
                }
              });
            }

            // Ajouter le nouveau responsable1
            await tx.chaineImpact.create({
              data: {
                user_id: responsable1,
                niveau: 2,
                qualification: 'RESPONSABLE_RESEAU',
                responsable_id: churchData.responsable.id,
                eglise_id: network.church_id,
                network_id: id,
                group_id: null,
                position_x: 0,
                position_y: 0
              }
            });
          }

          // Gérer le responsable2
          if (responsable2 !== undefined && responsable2 !== existingNetwork.responsable2_id) {
            // Supprimer l'ancien responsable2 de la chaîne d'impact
            if (existingNetwork.responsable2_id) {
              await tx.chaineImpact.deleteMany({
                where: {
                  user_id: existingNetwork.responsable2_id,
                  network_id: id,
                  niveau: 2
                }
              });
            }

            // Ajouter le nouveau responsable2 s'il existe
            if (responsable2) {
              await tx.chaineImpact.create({
                data: {
                  user_id: responsable2,
                  niveau: 2,
                  qualification: 'RESPONSABLE_RESEAU',
                  responsable_id: churchData.responsable.id,
                  eglise_id: network.church_id,
                  network_id: id,
                  group_id: null,
                  position_x: 1,
                  position_y: 0
                }
              });
            }
          }
        }
      }

      return network;
    });

    // Log supprimé pour réduire le volume de logs

    // Mettre à jour la qualification des responsables si modifiés
    const responsables = [];
    if (updatedNetwork.responsable1_id) responsables.push(updatedNetwork.responsable1_id);
    if (updatedNetwork.responsable2_id) responsables.push(updatedNetwork.responsable2_id);

    if (responsables.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: responsables } },
        data: { qualification: 'RESPONSABLE_RESEAU' }
      });
    }

    // Reconstruire la chaîne d'impact pour l'église concernée
    try {
      const churchId = updatedNetwork.church_id;
      if (churchId) {
        await rebuildChaineImpact(prisma, churchId);
      }
    } catch (error) {
      logger.error('Erreur lors de la reconstruction de la chaîne d\'impact après mise à jour du réseau:', error);
      // Ne pas faire échouer la mise à jour du réseau
    }

    res.json({
      success: true,
      data: updatedNetwork
    });
  } catch (error) {
    logger.error('updateNetwork - Erreur complète', error);
    logger.error('updateNetwork - Stack trace', { stack: error.stack });

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour du réseau');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un réseau
exports.deleteNetwork = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si le réseau existe
    const existingNetwork = await prisma.network.findUnique({
      where: { id }
    });

    if (!existingNetwork) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Récupérer l'ID de l'église AVANT la suppression pour reconstruire la chaîne d'impact
    const churchId = existingNetwork.church_id;

    // Supprimer le réseau dans une transaction
    await prisma.$transaction(async (tx) => {
      logger.info('deleteNetwork - Début de la suppression en cascade', { network_id: id });

      // 1. Supprimer d'abord tous les groupes du réseau (et leurs membres)
      const groups = await tx.group.findMany({
        where: { network_id: id }
      });

      logger.info('deleteNetwork - Groupes trouvés', { count: groups.length });

      for (const group of groups) {
        // Supprimer les membres du groupe
        const deletedMembers = await tx.groupMember.deleteMany({
          where: { group_id: group.id }
        });

        // Supprimer les entrées de chaîne d'impact liées au groupe
        const deletedChaineImpact = await tx.chaineImpact.deleteMany({
          where: { group_id: group.id }
        });

        logger.info('deleteNetwork - Groupe supprimé', { 
          group_id: group.id, 
          group_name: group.nom,
          members_deleted: deletedMembers.count,
          chaine_impact_deleted: deletedChaineImpact.count
        });
      }

      // Supprimer tous les groupes du réseau
      const deletedGroups = await tx.group.deleteMany({
        where: { network_id: id }
      });

      logger.info('deleteNetwork - Groupes supprimés', { count: deletedGroups.count });

      // 2. Supprimer toute la chaîne d'impact liée à ce réseau
      const deletedChaineImpact = await tx.chaineImpact.deleteMany({
        where: { network_id: id }
      });

      logger.info('deleteNetwork - Chaîne d\'impact supprimée', { 
        network_id: id, 
        count: deletedChaineImpact.count 
      });

      // 3. Nettoyer les qualifications des responsables avant de supprimer le réseau
      const qualificationService = new QualificationService(tx);
      await qualificationService.cleanupNetworkQualification(id);

      // 4. Supprimer le réseau
      await tx.network.delete({
        where: { id }
      });

      logger.info('deleteNetwork - Réseau supprimé avec succès', { network_id: id });
    });

    // Reconstruire la chaîne d'impact pour l'église concernée
    if (churchId) {
      try {
        await rebuildChaineImpact(prisma, churchId);
      } catch (error) {
        logger.error('Erreur lors de la reconstruction de la chaîne d\'impact après suppression du réseau:', error);
        // Ne pas faire échouer la suppression du réseau
      }
    }

    res.json({
      success: true,
      message: 'Réseau supprimé avec succès'
    });
  } catch (error) {
    logger.error('Network - deleteNetwork - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression du réseau');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les statistiques des réseaux
exports.getNetworkStats = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage par église si spécifié
    if (req.query.churchId) {
      where.church_id = req.query.churchId;
    } else if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      // Filtrage automatique pour les managers seulement si pas d'église spécifiée
      where.church_id = req.user.eglise_locale_id;
    } else {
      // Si aucune église n'est spécifiée et que l'utilisateur n'est pas un manager, retourner une erreur
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis pour récupérer les statistiques des réseaux'
      });
    }

    logger.info('getNetworkStats - req.query', req.query);
    logger.info('getNetworkStats - req.user', req.user);
    logger.info('getNetworkStats - Filtres appliqués', where);

    // Récupérer tous les réseaux avec leurs groupes et membres
    const networks = await prisma.network.findMany({
      where,
      include: {
        responsable1: {
          select: {
            id: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            qualification: true
          }
        },
        groups: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    qualification: true
                  }
                }
              }
            },
            responsable1: {
              select: {
                id: true,
                qualification: true
              }
            },
            responsable2: {
              select: {
                id: true,
                qualification: true
              }
            }
          }
        }
      }
    });

    logger.info('getNetworkStats - Réseaux trouvés', { count: networks.length });

    // Si aucun réseau n'est trouvé, retourner un tableau vide
    if (networks.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Aucun réseau trouvé pour cette église'
      });
    }

    // Calculer les statistiques pour chaque réseau
    const networksWithStats = networks.map(network => {
      // Extraire toutes les qualifications des membres
      const qualifications = [];
      const allMemberIds = new Set(); // Pour éviter les doublons

      // Ajouter les responsables du réseau
      if (network.responsable1) {
        qualifications.push(network.responsable1.qualification);
        allMemberIds.add(network.responsable1.id);
      }
      if (network.responsable2) {
        qualifications.push(network.responsable2.qualification);
        allMemberIds.add(network.responsable2.id);
      }

      // Ajouter les membres des groupes
      network.groups.forEach(group => {
        group.members.forEach(member => {
          if (member.user && member.user.qualification) {
            qualifications.push(member.user.qualification);
            allMemberIds.add(member.user.id);
          }
        });
      });

      // Compter les responsables de groupes
      const groupResponsablesIds = new Set();
      network.groups.forEach(group => {
        if (group.responsable1) {
          groupResponsablesIds.add(group.responsable1.id);
          // Ajouter aussi leurs qualifications si pas déjà comptées
          if (!allMemberIds.has(group.responsable1.id)) {
            qualifications.push(group.responsable1.qualification);
            allMemberIds.add(group.responsable1.id);
          }
        }
        if (group.responsable2) {
          groupResponsablesIds.add(group.responsable2.id);
          // Ajouter aussi leurs qualifications si pas déjà comptées
          if (!allMemberIds.has(group.responsable2.id)) {
            qualifications.push(group.responsable2.qualification);
            allMemberIds.add(group.responsable2.id);
          }
        }
      });

      // Calculer l'effectif total (membres des groupes + responsables du réseau)
      const memberCount = allMemberIds.size;

      logger.info(`Réseau ${network.nom}: Effectif total calculé`, {
        nom: network.nom,
        memberCount,
        membresGroupes: network.groups.reduce((total, group) => total + group.members.length, 0),
        responsables: [network.responsable1, network.responsable2].filter(Boolean).length
      });

      return {
        id: network.id,
        nom: network.nom,
        memberCount,
        qualifications,
        groupCount: network.groups.length,
        groupResponsablesCount: groupResponsablesIds.size
      };
    });

    logger.info('getNetworkStats - Statistiques calculées', networksWithStats.map(n => ({
      nom: n.nom,
      memberCount: n.memberCount,
      qualificationsCount: n.qualifications.length,
      groupCount: n.groupCount,
      groupResponsablesCount: n.groupResponsablesCount
    })));

    res.json({
      success: true,
      data: networksWithStats
    });
  } catch (error) {
    logger.error('Network - getNetworkStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques des réseaux');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les statistiques d'un réseau par ID
exports.getNetworkStatsById = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const network = await prisma.network.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            groups: true
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

    // Récupérer tous les groupes du réseau avec leurs membres
    const groups = await prisma.group.findMany({
      where: { network_id: id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                qualification: true
              }
            }
          }
        },
        responsable1: {
          select: {
            id: true,
            qualification: true
          }
        },
        responsable2: {
          select: {
            id: true,
            qualification: true
          }
        }
      }
    });

    // Récupérer les compagnons d'œuvre du réseau
    const companions = await prisma.networkCompanion.findMany({
      where: { network_id: id },
      include: {
        user: {
          select: {
            id: true,
            qualification: true
          }
        }
      }
    });

    // Calculer les statistiques par qualification
    const memberIds = new Set();
    const userQualifications = new Map(); // Map pour éviter les doublons par utilisateur
    const groupResponsables = new Set();

    groups.forEach((group, index) => {
      logger.debug(`Groupe ${index + 1}`, {
        groupeIndex: index + 1,
        membres: group.members.map(member => ({
          id: member.user.id,
          qualification: member.user.qualification
        }))
      });
      group.members.forEach(member => {
        memberIds.add(member.user.id);
        // Ne pas ajouter de doublons pour le même utilisateur
        if (!userQualifications.has(member.user.id)) {
          userQualifications.set(member.user.id, member.user.qualification);
        }
      });

      logger.debug('Responsables du groupe', {
        groupeIndex: index + 1,
        responsable1: group.responsable1 ? { id: group.responsable1.id, qualification: group.responsable1.qualification } : null,
        responsable2: group.responsable2 ? { id: group.responsable2.id, qualification: group.responsable2.qualification } : null
      });
      if (group.responsable1) {
        groupResponsables.add(group.responsable1.id);
        // Ajouter la qualification du responsable seulement s'il n'est pas déjà compté
        if (!userQualifications.has(group.responsable1.id)) {
          userQualifications.set(group.responsable1.id, group.responsable1.qualification);
        }
      }
      if (group.responsable2) {
        groupResponsables.add(group.responsable2.id);
        // Ajouter la qualification du responsable seulement s'il n'est pas déjà compté
        if (!userQualifications.has(group.responsable2.id)) {
          userQualifications.set(group.responsable2.id, group.responsable2.qualification);
        }
      }
    });

    // Ajouter les compagnons d'œuvre aux statistiques
    companions.forEach(companion => {
      const companionUserId = companion.user?.id || companion.user_id;
      if (companionUserId) {
        memberIds.add(companionUserId);
        if (!userQualifications.has(companionUserId)) {
          userQualifications.set(companionUserId, companion.user?.qualification || 'COMPAGNON_OEUVRE');
        }
      }
    });

    logger.debug('Résumé des données', {
      membresUniques: Array.from(memberIds),
      qualificationsUniques: Object.fromEntries(userQualifications),
      responsablesGroupes: Array.from(groupResponsables)
    });

    // Ajouter les responsables du réseau
    const networkResponsables = await prisma.user.findMany({
      where: {
        OR: [
          { network_responsable1: { some: { id } } },
          { network_responsable2: { some: { id } } }
        ]
      },
      select: {
        id: true,
        qualification: true
      }
    });

    networkResponsables.forEach(resp => {
      memberIds.add(resp.id);
      // Ajouter la qualification seulement si l'utilisateur n'est pas déjà compté
      if (!userQualifications.has(resp.id)) {
        userQualifications.set(resp.id, resp.qualification);
      }
    });

    // Compter les qualifications
    const qualificationsArray = Array.from(userQualifications.values());
    const stats = {
      '12': qualificationsArray.filter(q => q === 'QUALIFICATION_12').length,
      '144': qualificationsArray.filter(q => q === 'QUALIFICATION_144').length,
      '1728': qualificationsArray.filter(q => q === 'QUALIFICATION_1728').length,
      totalGroups: groups.length,
      'Responsables de GR': groupResponsables.size,
      'Compagnon d\'œuvre': companions.length,
      'Leader': qualificationsArray.filter(q => q === 'LEADER').length,
      'Leader (Tous)': qualificationsArray.filter(q =>
        ['LEADER', 'RESPONSABLE_RESEAU', 'QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'COMPAGNON_OEUVRE'].includes(q)
      ).length,
      'Membre simple': qualificationsArray.filter(q =>
        !['QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'LEADER', 'RESPONSABLE_RESEAU', 'COMPAGNON_OEUVRE'].includes(q)
      ).length,
      totalMembers: memberIds.size
    };

    logger.debug('Statistiques finales', {
      qualificationsComptees: qualificationsArray,
      stats
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Erreur getNetworkStatsById', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques du réseau',
      error: error.message
    });
  }
};

// Obtenir les groupes d'un réseau
exports.getNetworkGroups = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const groups = await prisma.group.findMany({
      where: { network_id: id },
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
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                pseudo: true,
                role: true,
                qualification: true,
                genre: true,
                tranche_age: true,
                profession: true,
                ville_residence: true,
                origine: true,
                situation_matrimoniale: true,
                niveau_education: true,
                email: true,
                telephone: true,
                adresse: true,
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
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    logger.error('Erreur getNetworkGroups', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des groupes du réseau',
      error: error.message
    });
  }
};

// Obtenir les membres d'un réseau
exports.getNetworkMembers = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const members = await prisma.groupMember.findMany({
      where: {
        group: {
          network_id: id
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            role: true,
            qualification: true,
            genre: true,
            tranche_age: true,
            profession: true,
            ville_residence: true,
            origine: true,
            situation_matrimoniale: true,
            niveau_education: true,
            email: true,
            telephone: true,
            adresse: true,
            image: true,
            eglise_locale: {
              select: {
                id: true,
                nom: true
              }
            },
            user_departments: {
              select: {
                department_id: true,
                department: {
                  select: {
                    id: true,
                    nom: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Dédupliquer les utilisateurs (un utilisateur peut être dans plusieurs groupes du même réseau)
    const uniqueMembers = members.reduce((acc, member) => {
      if (!acc.find(m => m.user.id === member.user.id)) {
        acc.push(member);
      }
      return acc;
    }, []);

    res.json({
      success: true,
      data: uniqueMembers
    });
  } catch (error) {
    logger.error('Erreur getNetworkMembers', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des membres du réseau',
      error: error.message
    });
  }
};

// Obtenir les statistiques de qualification des réseaux
exports.getNetworksQualificationStats = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.query;

    logger.info('Network - getNetworksQualificationStats - Début de la fonction');
    logger.info('Network - getNetworksQualificationStats - churchId:', churchId);

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'église est requis'
      });
    }

    // Récupérer tous les réseaux de l'église avec leurs groupes et membres
    const networks = await prisma.network.findMany({
      where: {
        church_id: churchId
      },
      include: {
        groups: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    qualification: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculer les statistiques par réseau
    const stats = networks.map(network => {
      const totalMembers = network.groups.reduce((total, group) => {
        return total + group.members.length;
      }, 0);

      // Compter les qualifications
      const qualifications = {};
      network.groups.forEach(group => {
        group.members.forEach(member => {
          const qual = member.user.qualification || 'Non spécifiée';
          qualifications[qual] = (qualifications[qual] || 0) + 1;
        });
      });

      return {
        networkId: network.id,
        networkName: network.nom,
        totalMembers,
        qualifications
      };
    });

    logger.info('Network - getNetworksQualificationStats - Statistiques calculées:', stats.length, 'réseaux');

    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats
    });

  } catch (error) {
    logger.error('Network - getNetworksQualificationStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques de qualification des réseaux');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir le taux d'implication des réseaux dans les départements
exports.getNetworksDepartmentInvolvement = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.query;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'église est requis'
      });
    }

    // Récupérer tous les réseaux de l'église avec leurs groupes, membres, responsables et compagnons
    const networks = await prisma.network.findMany({
      where: {
        church_id: churchId
      },
      include: {
        groups: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        },
        responsable1: {
          select: {
            id: true
          }
        },
        responsable2: {
          select: {
            id: true
          }
        },
        companions: {
          include: {
            user: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    // Récupérer tous les utilisateurs qui servent dans des départements
    const usersInDepartments = await prisma.userDepartment.findMany({
      select: {
        user_id: true
      }
    });

    const usersInDepartmentsSet = new Set(
      usersInDepartments.map(ud => ud.user_id)
    );

    // Calculer le taux d'implication pour chaque réseau
    const stats = networks.map(network => {
      // 1. Collecter tous les membres des groupes du réseau
      const groupMemberIds = new Set();
      network.groups.forEach(group => {
        group.members.forEach(member => {
          groupMemberIds.add(member.user.id);
        });
      });

      // 2. Ajouter les responsables du réseau
      if (network.responsable1?.id) {
        groupMemberIds.add(network.responsable1.id);
      }
      if (network.responsable2?.id) {
        groupMemberIds.add(network.responsable2.id);
      }

      // 3. Ajouter les compagnons d'œuvre
      network.companions.forEach(companion => {
        if (companion.user?.id) {
          groupMemberIds.add(companion.user.id);
        }
      });

      // 4. Calculer le nombre total de personnes dans le réseau
      const totalNetworkMembers = groupMemberIds.size;

      // 5. Compter combien servent dans des départements
      const membersInDepartments = Array.from(groupMemberIds).filter(userId =>
        usersInDepartmentsSet.has(userId)
      ).length;

      // 6. Calculer le taux d'implication (en pourcentage)
      const involvementRate = totalNetworkMembers > 0
        ? Math.round((membersInDepartments / totalNetworkMembers) * 100 * 100) / 100 // Arrondir à 2 décimales
        : 0;

      return {
        networkId: network.id,
        networkName: network.nom,
        totalMembers: totalNetworkMembers,
        membersInDepartments: membersInDepartments,
        involvementRate: involvementRate
      };
    });

    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats
    });

  } catch (error) {
    logger.error('Network - getNetworksDepartmentInvolvement - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du taux d\'implication des réseaux dans les départements');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Ajouter un compagnon d'œuvre à un réseau
exports.addCompanion = async (req, res) => {
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

    // Vérifier que le réseau existe
    const network = await prisma.network.findUnique({
      where: { id }
    });

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Réseau non trouvé'
      });
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Contrainte 1: Vérifier que l'utilisateur n'est pas déjà compagnon d'un autre réseau
    const existingCompanionInOtherNetwork = await prisma.networkCompanion.findFirst({
      where: {
        user_id: user_id,
        network_id: { not: id }
      }
    });

    if (existingCompanionInOtherNetwork) {
      return res.status(400).json({
        success: false,
        message: 'Cet utilisateur appartient déjà à un autre réseau en tant que compagnon d\'œuvre'
      });
    }

    // Contrainte 2: Vérifier que l'utilisateur n'est pas membre d'un GR
    const isMemberOfGroup = await prisma.groupMember.findFirst({
      where: { user_id: user_id }
    });

    if (isMemberOfGroup) {
      return res.status(400).json({
        success: false,
        message: 'Cet utilisateur est déjà membre d\'un groupe de réveil. Un compagnon d\'œuvre ne peut pas être membre d\'un GR'
      });
    }

    // Contrainte 3: Vérifier si le compagnon d'œuvre n'est pas déjà ajouté à CE réseau
    const existingCompanion = await prisma.networkCompanion.findUnique({
      where: {
        network_id_user_id: {
          network_id: id,
          user_id: user_id
        }
      }
    });

    if (existingCompanion) {
      return res.status(400).json({
        success: false,
        message: 'Ce compagnon d\'œuvre est déjà ajouté à ce réseau'
      });
    }

    // Créer le compagnon d'œuvre
    const companion = await prisma.networkCompanion.create({
      data: {
        network_id: id,
        user_id: user_id
      },
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
    });

    logger.info(`Network - addCompanion - Compagnon d'œuvre ajouté au réseau ${id}`);

    res.status(201).json({
      success: true,
      data: companion
    });

  } catch (error) {
    logger.error('Network - addCompanion - Erreur complète', error);
    const { status, message } = handleError(error, 'l\'ajout du compagnon d\'œuvre');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un compagnon d'œuvre d'un réseau
exports.removeCompanion = async (req, res) => {
  try {
    const { prisma } = req;
    const { id, companionId } = req.params;

    // Vérifier que le compagnon d'œuvre existe
    const companion = await prisma.networkCompanion.findUnique({
      where: { id: companionId },
      include: {
        network: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    if (!companion) {
      return res.status(404).json({
        success: false,
        message: 'Compagnon d\'œuvre non trouvé'
      });
    }

    // Vérifier que le compagnon appartient bien au réseau
    if (companion.network_id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Ce compagnon d\'œuvre n\'appartient pas à ce réseau'
      });
    }

    // Supprimer le compagnon d'œuvre
    await prisma.networkCompanion.delete({
      where: { id: companionId }
    });

    logger.info(`Network - removeCompanion - Compagnon d'œuvre supprimé du réseau ${id}`);

    res.status(200).json({
      success: true,
      message: 'Compagnon d\'œuvre supprimé avec succès'
    });

  } catch (error) {
    logger.error('Network - removeCompanion - Erreur complète', error);
    const { status, message } = handleError(error, 'la suppression du compagnon d\'œuvre');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer tous les compagnons d'œuvre d'un réseau
// Fonctions publiques pour l'inscription (sans authentification requise)
// Récupérer les réseaux d'une église pour l'inscription publique
exports.getPublicNetworks = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.query;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'église est requis'
      });
    }

    const networks = await prisma.network.findMany({
      where: {
        church_id: churchId
      },
      select: {
        id: true,
        nom: true,
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

    res.status(200).json({
      success: true,
      count: networks.length,
      data: networks
    });
  } catch (error) {
    logger.error('Network - getPublicNetworks - Erreur', error);
    const { status, message } = handleError(error, 'la récupération des réseaux');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer les groupes d'un réseau pour l'inscription publique
exports.getPublicNetworkGroups = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID du réseau est requis'
      });
    }

    const groups = await prisma.group.findMany({
      where: { network_id: id },
      select: {
        id: true,
        nom: true,
        network: {
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

    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    logger.error('Network - getPublicNetworkGroups - Erreur', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des groupes du réseau',
      error: error.message
    });
  }
};

exports.getNetworkCompanions = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const companions = await prisma.networkCompanion.findMany({
      where: {
        network_id: id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            qualification: true,
            email: true,
            telephone: true,
            genre: true,
            tranche_age: true,
            image: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      count: companions.length,
      data: companions
    });

  } catch (error) {
    logger.error('Network - getNetworkCompanions - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des compagnons d\'œuvre');
    res.status(status).json({
      success: false,
      message
    });
  }
};
