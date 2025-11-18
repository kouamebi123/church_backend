const bcrypt = require('bcryptjs');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');
const { rebuildChaineImpact } = require('../utils/chaineImpactService');

// Récupérer toutes les églises avec filtrage automatique pour les managers
exports.getChurches = async (req, res) => {
  try {
    const { prisma } = req;

    const where = {};

    // Filtrage automatique pour les managers
    if (req.user && req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      where.id = req.user.eglise_locale_id;
    }

    const churches = await prisma.church.findMany({
      where,
      include: {
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: {
        nom: 'asc'
      }
    });

    // Formater la réponse pour correspondre à l'API MongoDB
    const formattedChurches = churches.map(church => ({
      ...church,
      nombre_membres: church._count.members
    }));

    res.status(200).json({
      success: true,
      count: formattedChurches.length,
      data: formattedChurches
    });
  } catch (error) {
    logger.error('Church - getChurches - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des églises');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer une église par ID
exports.getChurch = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const church = await prisma.church.findUnique({
      where: { id },
      include: {
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        },
        _count: {
          select: {
            members: true,
            networks: true,
            services: true
          }
        }
      }
    });

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Formater la réponse
    const formattedChurch = {
      ...church,
      nombre_membres: church._count.members
    };

    res.status(200).json({
      success: true,
      data: formattedChurch
    });
  } catch (error) {
    logger.error('Church - getChurch - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération de l\'église');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer une nouvelle église (super-admin seulement)
exports.createChurch = async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, adresse, ville, latitude, longitude, population, description, type, responsable_id } = req.body;

    // Traiter l'image uploadée
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/churches/${req.file.filename}`;
      logger.info('createChurch - Image uploadée', { filename: req.file.filename });
    }

    logger.info('createChurch - Données reçues', { nom, adresse, ville, latitude, longitude, population, description, type, responsable_id });
    logger.info('createChurch - Utilisateur connecté', { id: req.user.id, role: req.user.role, username: req.user.username });

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de l\'église est requis'
      });
    }

    // Vérifier si l'église existe déjà
    const existingChurch = await prisma.church.findUnique({
      where: { nom }
    });

    if (existingChurch) {
      return res.status(400).json({
        success: false,
        message: 'Une église avec ce nom existe déjà'
      });
    }

    // Vérifier si l'utilisateur responsable existe et n'est pas déjà responsable d'une autre église
    if (responsable_id) {
      const existingResponsable = await prisma.church.findUnique({
        where: { responsable_id }
      });

      if (existingResponsable) {
        return res.status(400).json({
          success: false,
          message: 'Cet utilisateur est déjà responsable d\'une autre église'
        });
      }

      // Vérifier que l'utilisateur existe
      const user = await prisma.user.findUnique({
        where: { id: responsable_id }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'L\'utilisateur responsable n\'existe pas'
        });
      }
    }

    // Préparer les données pour la création
    const churchData = {
      nom,
      adresse: adresse || null,
      ville: ville || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      population: population ? parseInt(population) : null,
      description: description || null,
      type: type || 'EGLISE',
      responsable_id: responsable_id || null,
      image: imagePath // Utiliser le chemin de l'image uploadée
    };

    logger.info('createChurch - Données à insérer', churchData);

    // Créer l'église dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'église
      const church = await tx.church.create({
        data: churchData,
        include: {
          responsable: {
            select: {
              id: true,
              username: true,
              pseudo: true
            }
          }
        }
      });

      // Si un responsable est assigné, l'ajouter à la chaîne d'impact
      if (responsable_id) {
        await tx.chaineImpact.create({
          data: {
            user_id: responsable_id,
            niveau: getNiveauFromQualification('RESPONSABLE_EGLISE'), // Utilise la fonction utilitaire
            qualification: 'RESPONSABLE_EGLISE', // Qualification appropriée
            responsable_id: null, // Pas de supérieur hiérarchique
            eglise_id: church.id,
            network_id: null,
            group_id: null,
            position_x: 0,
            position_y: 0
          }
        });

        logger.info('createChurch - Responsable ajouté à la chaîne d\'impact', { 
          user_id: responsable_id, 
          niveau: 0, 
          eglise_id: church.id 
        });
      }

      return church;
    });

    logger.info('createChurch - Église créée avec succès', result);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Church - createChurch - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la création de l\'église');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour une église (super-admin seulement)
exports.updateChurch = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Traiter l'image uploadée
    if (req.file) {
      updateData.image = `/uploads/churches/${req.file.filename}`;
      logger.info('updateChurch - Nouvelle image uploadée', { filename: req.file.filename });
    }

    // Vérifier si l'église existe
    const existingChurch = await prisma.church.findUnique({
      where: { id }
    });

    if (!existingChurch) {
      return res.status(404).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Vérifier si le nom est unique (sauf pour cette église)
    if (updateData.nom && updateData.nom !== existingChurch.nom) {
      const duplicateChurch = await prisma.church.findUnique({
        where: { nom: updateData.nom }
      });

      if (duplicateChurch) {
        return res.status(400).json({
          success: false,
          message: 'Une église avec ce nom existe déjà'
        });
      }
    }

    // Vérifier que le responsable existe si fourni
    if (updateData.responsable_id) {
      const responsable = await prisma.user.findUnique({
        where: { id: updateData.responsable_id },
        select: { id: true, username: true, pseudo: true }
      });

      if (!responsable) {
        return res.status(400).json({
          success: false,
          message: 'Le responsable spécifié n\'existe pas'
        });
      }
    }

    // Mettre à jour l'église dans une transaction
    const updatedChurch = await prisma.$transaction(async (tx) => {
      // Mettre à jour l'église
      const church = await tx.church.update({
        where: { id },
        data: {
          ...updateData,
          latitude: updateData.latitude ? parseFloat(updateData.latitude) : null,
          longitude: updateData.longitude ? parseFloat(updateData.longitude) : null,
          population: updateData.population ? parseInt(updateData.population) : null
        },
        include: {
          responsable: {
            select: {
              id: true,
              username: true,
              pseudo: true
            }
          }
        }
      });

      // Gérer le changement de responsable d'église dans la chaîne d'impact
      if (updateData.responsable_id !== undefined && updateData.responsable_id !== existingChurch.responsable_id) {
        // Supprimer l'ancien responsable de la chaîne d'impact
        if (existingChurch.responsable_id) {
          await tx.chaineImpact.deleteMany({
            where: {
              user_id: existingChurch.responsable_id,
              eglise_id: id,
              niveau: 1
            }
          });

          logger.info('updateChurch - Ancien responsable supprimé de la chaîne d\'impact', {
            user_id: existingChurch.responsable_id,
            eglise_id: id
          });
        }

        // Ajouter le nouveau responsable à la chaîne d'impact
        if (updateData.responsable_id) {
          await tx.chaineImpact.create({
            data: {
              user_id: updateData.responsable_id,
              niveau: 0, // Premier niveau (Responsable d'église)
              qualification: 'RESPONSABLE_EGLISE',
              responsable_id: null, // Pas de supérieur hiérarchique
              eglise_id: id,
              network_id: null,
              group_id: null,
              position_x: 0,
              position_y: 0
            }
          });

          logger.info('updateChurch - Nouveau responsable ajouté à la chaîne d\'impact', {
            user_id: updateData.responsable_id,
            eglise_id: id,
            niveau: 0
          });
        }
      }

      return church;
    });

    // Reconstruire la chaîne d'impact pour l'église concernée
    try {
      await rebuildChaineImpact(prisma, id);
    } catch (error) {
      logger.error('Erreur lors de la reconstruction de la chaîne d\'impact après mise à jour de l\'église:', error);
      // Ne pas faire échouer la mise à jour de l'église
    }

    res.json({
      success: true,
      data: updatedChurch
    });
  } catch (error) {
    logger.error('Church - updateChurch - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour de l\'église');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer une église (super-admin seulement)
exports.deleteChurch = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si l'église existe
    const existingChurch = await prisma.church.findUnique({
      where: { id }
    });

    if (!existingChurch) {
      return res.status(404).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Vérifier s'il y a des membres associés
    const memberCount = await prisma.user.count({
      where: { eglise_locale_id: id }
    });

    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer l'église. Elle a ${memberCount} membre(s) associé(s).`
      });
    }

    // Supprimer l'église dans une transaction
    await prisma.$transaction(async (tx) => {
      logger.info('deleteChurch - Début de la suppression en cascade', { eglise_id: id });

      // 1. Supprimer d'abord tous les réseaux de cette église (et leurs groupes/membres)
      const networks = await tx.network.findMany({
        where: { church_id: id }
      });

      logger.info('deleteChurch - Réseaux trouvés', { count: networks.length });

      for (const network of networks) {
        // Supprimer tous les groupes de ce réseau
        const groups = await tx.group.findMany({
          where: { network_id: network.id }
        });

        logger.info('deleteChurch - Groupes trouvés pour le réseau', { 
          network_id: network.id, 
          network_name: network.nom, 
          count: groups.length 
        });

        for (const group of groups) {
          // Supprimer les membres du groupe
          const deletedMembers = await tx.groupMember.deleteMany({
            where: { group_id: group.id }
          });

          // Supprimer les entrées de chaîne d'impact liées au groupe
          const deletedChaineImpact = await tx.chaineImpact.deleteMany({
            where: { group_id: group.id }
          });

          logger.info('deleteChurch - Groupe supprimé', { 
            group_id: group.id, 
            group_name: group.nom,
            members_deleted: deletedMembers.count,
            chaine_impact_deleted: deletedChaineImpact.count
          });
        }

        // Supprimer tous les groupes du réseau
        const deletedGroups = await tx.group.deleteMany({
          where: { network_id: network.id }
        });

        logger.info('deleteChurch - Groupes supprimés pour le réseau', { 
          network_id: network.id, 
          count: deletedGroups.count 
        });

        // Supprimer les entrées de chaîne d'impact liées au réseau
        const deletedChaineImpact = await tx.chaineImpact.deleteMany({
          where: { network_id: network.id }
        });

        logger.info('deleteChurch - Chaîne d\'impact supprimée pour le réseau', { 
          network_id: network.id, 
          count: deletedChaineImpact.count 
        });
      }

      // Supprimer tous les réseaux de l'église
      const deletedNetworks = await tx.network.deleteMany({
        where: { church_id: id }
      });

      logger.info('deleteChurch - Réseaux supprimés', { count: deletedNetworks.count });

      // 2. Supprimer toute la chaîne d'impact de cette église
      const deletedChaineImpact = await tx.chaineImpact.deleteMany({
        where: { eglise_id: id }
      });

      logger.info('deleteChurch - Chaîne d\'impact supprimée', { 
        eglise_id: id, 
        count: deletedChaineImpact.count 
      });

      // 3. Supprimer l'église
      await tx.church.delete({
        where: { id }
      });

      logger.info('deleteChurch - Église supprimée avec succès', { eglise_id: id });
    });

    res.json({
      success: true,
      message: 'Église supprimée avec succès'
    });
  } catch (error) {
    logger.error('Church - deleteChurch - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression de l\'église');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les statistiques des églises
exports.getChurchStats = async (req, res) => {
  try {
    const { prisma } = req;

    const stats = await prisma.church.aggregate({
      _count: {
        id: true
      },
      _sum: {
        nombre_membres: true
      }
    });

    // Compter le nombre total de membres
    const totalMembers = await prisma.user.count({
      where: {
        eglise_locale_id: {
          not: null
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalChurches: stats._count.id,
        totalMembers,
        averageMembersPerChurch: stats._count.id > 0 ? Math.round(totalMembers / stats._count.id) : 0
      }
    });
  } catch (error) {
    logger.error('Church - getChurchStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques des églises');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir les informations d'une ville
exports.getCityInfo = async (req, res) => {
  try {
    const { prisma } = req;
    const { cityName } = req.params;

    const churches = await prisma.church.findMany({
      where: {
        ville: {
          contains: cityName,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        nom: true,
        adresse: true,
        ville: true,
        latitude: true,
        longitude: true,
        nombre_membres: true
      }
    });

    res.json({
      success: true,
      data: churches
    });
  } catch (error) {
    logger.error('Church - getCityInfo - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des informations de la ville');

    res.status(status).json({
      success: false,
      message
    });
  }
};
