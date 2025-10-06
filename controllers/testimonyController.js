const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Configuration multer pour les fichiers de témoignages
const testimonyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/testimonies');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `testimony_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const testimonyUpload = multer({
  storage: testimonyStorage,
  fileFilter: (req, file, cb) => {
    // Accepter images, vidéos et documents
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    // Vérifier l'extension OU le mimetype (plus permissif)
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls les images, vidéos et documents sont acceptés.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max par fichier
    files: 2 // Maximum 2 fichiers pour un total de 10MB
  }
});

// Middleware d'upload pour les témoignages
exports.uploadTestimonyFiles = testimonyUpload.array('illustrations', 2);

// Obtenir toutes les églises (pour le formulaire)
exports.getChurches = async (req, res) => {
  try {
    const { prisma } = req;
    const churches = await prisma.church.findMany({
      select: {
        id: true,
        nom: true,
        ville: true
      },
      orderBy: {
        nom: 'asc'
      }
    });

    res.json({
      success: true,
      data: churches
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des églises:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des églises'
    });
  }
};

// Obtenir les réseaux d'une église
exports.getNetworksByChurch = async (req, res) => {
  try {
    console.log('🔍 getNetworksByChurch appelé avec churchId:', req.params.churchId);
    const { prisma } = req;
    const { churchId } = req.params;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis'
      });
    }

    const networks = await prisma.network.findMany({
      where: {
        church_id: churchId,
        active: true
      },
      select: {
        id: true,
        nom: true
      },
      orderBy: {
        nom: 'asc'
      }
    });

    res.json({
      success: true,
      data: networks
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des réseaux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réseaux'
    });
  }
};

// Créer un nouveau témoignage
exports.createTestimony = async (req, res) => {
  try {
    const { prisma } = req;
    const {
      firstName,
      lastName,
      phone,
      email,
      churchId,
      networkId,
      testimonyType,
      section,
      unit,
      category,
      content,
      isAnonymous,
      wantsToTestify
    } = req.body;

    // Validation des champs requis
    if (!churchId || !category || !content) {
      return res.status(400).json({
        success: false,
        message: 'L\'église, la catégorie et le témoignage sont requis'
      });
    }

    // Validation conditionnelle des noms (seulement si pas anonyme)
    const isAnonymousBool = isAnonymous === 'true' || isAnonymous === true;
    const wantsToTestifyBool = wantsToTestify === 'true' || wantsToTestify === true;
    
    // Si veut témoigner, doit s'identifier
    if (wantsToTestifyBool && isAnonymousBool) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez vous identifier pour témoigner lors d\'un culte'
      });
    }
    
    // Si veut témoigner, doit avoir nom/prénom et contact
    if (wantsToTestifyBool && (!firstName || !lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Le prénom et le nom sont requis pour témoigner lors d\'un culte'
      });
    }
    
    if (wantsToTestifyBool && (!phone && !email)) {
      return res.status(400).json({
        success: false,
        message: 'Un numéro de téléphone ou un email est requis pour témoigner lors d\'un culte'
      });
    }
    
    if (!isAnonymousBool && (!firstName || !lastName)) {
      return res.status(400).json({
        success: false,
        message: 'Le prénom et le nom sont requis quand vous souhaitez vous identifier'
      });
    }

    // Vérifier que l'église existe
    const church = await prisma.church.findUnique({
      where: { id: churchId }
    });

    if (!church) {
      return res.status(400).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Convertir networkId vide ou "AUCUN_RESEAU" en null
    const finalNetworkId = (networkId && networkId.trim() !== '' && networkId !== 'AUCUN_RESEAU') ? networkId : null;

    // Déterminer le type de témoignage automatiquement
    let determinedTestimonyType = null;
    if (finalNetworkId) {
      determinedTestimonyType = 'NETWORK_MEMBER';
    } else if (testimonyType) {
      determinedTestimonyType = testimonyType.toUpperCase();
    } else {
      determinedTestimonyType = 'VISITOR';
    }

    // Vérifier que le réseau existe si fourni
    if (finalNetworkId) {
      const network = await prisma.network.findFirst({
        where: {
          id: finalNetworkId,
          church_id: churchId
        }
      });

      if (!network) {
        return res.status(400).json({
          success: false,
          message: 'Réseau non trouvé pour cette église'
        });
      }
    }

    // Créer le témoignage
    const testimony = await prisma.testimony.create({
      data: {
        firstName: isAnonymousBool ? 'Anonyme' : firstName,
        lastName: isAnonymousBool ? 'Anonyme' : lastName,
        phone: phone || null,
        email: email || null,
        churchId,
        networkId: finalNetworkId,
        testimonyType: determinedTestimonyType,
        section: section || null,
        unit: unit || null,
        category: category.toUpperCase(),
        content,
        isAnonymous: isAnonymousBool,
        wantsToTestify: wantsToTestifyBool
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        network: {
          select: {
            nom: true
          }
        }
      }
    });

    // Traiter les fichiers uploadés
    if (req.files && req.files.length > 0) {
      const filePromises = req.files.map(file => {
        return prisma.testimonyFile.create({
          data: {
            testimonyId: testimony.id,
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileType: file.mimetype,
            fileSize: file.size
          }
        });
      });

      await Promise.all(filePromises);
    }

    logger.info('Nouveau témoignage créé:', {
      id: testimony.id,
      church: church.nom,
      category: testimony.category,
      isAnonymous: testimony.isAnonymous
    });

    res.status(201).json({
      success: true,
      message: 'Témoignage transmis avec succès !',
      data: {
        id: testimony.id,
        isAnonymous: testimony.isAnonymous
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la création du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission du témoignage'
    });
  }
};

// Obtenir les témoignages approuvés (pour affichage public)
exports.getApprovedTestimonies = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, churchId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isApproved: true
    };

    if (category) {
      where.category = category.toUpperCase();
    }

    if (churchId) {
      where.churchId = churchId;
    }

    const [testimonies, total] = await Promise.all([
      prisma.testimony.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: true,
          content: true,
          isAnonymous: true,
          createdAt: true,
          church: {
            select: {
              nom: true,
              ville: true
            }
          },
          network: {
            select: {
              nom: true
            }
          },
          illustrations: {
            select: {
              id: true,
              fileName: true,
              originalName: true,
              fileType: true,
              fileSize: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.testimony.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        testimonies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des témoignages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des témoignages'
    });
  }
};

// Obtenir un témoignage par ID
exports.getTestimonyById = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const testimony = await prisma.testimony.findUnique({
      where: { id },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        network: {
          select: {
            nom: true
          }
        },
        illustrations: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            fileType: true,
            fileSize: true
          }
        }
      }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    res.json({
      success: true,
      data: testimony
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du témoignage'
    });
  }
};

// Obtenir tous les témoignages (pour l'admin)
exports.getAllTestimonies = async (req, res) => {
  try {
    const { prisma } = req;
    const { page = 1, limit = 10, churchId, category, search, isRead } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Construire les filtres
    const where = {};
    
    if (churchId) {
      where.churchId = churchId;
    }
    
    if (category) {
      // Valider que la catégorie existe dans l'enum
      const validCategories = ['INTIMACY', 'LEADERSHIP', 'HEALING', 'PROFESSIONAL', 'BUSINESS', 'FINANCES', 'DELIVERANCE', 'FAMILY'];
      if (validCategories.includes(category)) {
        where.category = category;
      } else {
        return res.status(400).json({
          success: false,
          message: `Catégorie invalide: ${category}. Catégories valides: ${validCategories.join(', ')}`
        });
      }
    }
    
    if (search) {
      where.content = {
        contains: search,
        mode: 'insensitive'
      };
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [testimonies, total] = await Promise.all([
      prisma.testimony.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          church: {
            select: { id: true, nom: true }
          },
          network: {
            select: { id: true, nom: true }
          },
          illustrations: {
            select: { id: true, fileName: true, originalName: true }
          }
        }
      }),
      prisma.testimony.count({ where })
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        testimonies,
        totalPages,
        totalItems: total,
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des témoignages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des témoignages'
    });
  }
};

// Supprimer un témoignage
exports.deleteTestimony = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si le témoignage existe
    const testimony = await prisma.testimony.findUnique({
      where: { id },
      include: { illustrations: true }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    // Supprimer les fichiers associés
    if (testimony.illustrations && testimony.illustrations.length > 0) {
      await prisma.testimonyFile.deleteMany({
        where: { testimonyId: id }
      });
    }

    // Supprimer le témoignage
    await prisma.testimony.delete({
      where: { id }
    });

    logger.info('Témoignage supprimé:', { id });

    res.json({
      success: true,
      message: 'Témoignage supprimé avec succès'
    });

  } catch (error) {
    logger.error('Erreur lors de la suppression du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du témoignage'
    });
  }
};

// Obtenir les catégories de témoignages
exports.getTestimonyCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'INTIMACY', label: 'Intimité avec Dieu' },
      { value: 'LEADERSHIP', label: 'Leadership' },
      { value: 'HEALING', label: 'Guérison/Santé' },
      { value: 'PROFESSIONAL', label: 'Professionnel' },
      { value: 'BUSINESS', label: 'Entreprises/Affaires' },
      { value: 'FINANCES', label: 'Finances' },
      { value: 'DELIVERANCE', label: 'Délivrance' },
      { value: 'FAMILY', label: 'Famille' }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories'
    });
  }
};

// Marquer un témoignage comme lu
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const testimony = await prisma.testimony.update({
      where: { id },
      data: { isRead: true }
    });

    logger.info('Témoignage marqué comme lu:', { id });

    res.json({
      success: true,
      message: 'Témoignage marqué comme lu'
    });

  } catch (error) {
    logger.error('Erreur lors du marquage comme lu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage comme lu'
    });
  }
};

// Obtenir les témoignages pour le culte (avec filtres)
exports.getTestimoniesForCulte = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.params;
    const { wantsToTestify, isConfirmed, hasTestified } = req.query;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis'
      });
    }

    // Construire les filtres
    const where = {
      churchId,
      isAnonymous: false // Seulement les témoignages identifiés
    };

    if (wantsToTestify !== undefined) {
      where.wantsToTestify = wantsToTestify === 'true';
    }

    if (isConfirmed !== undefined) {
      where.isConfirmedToTestify = isConfirmed === 'true';
    }

    if (hasTestified !== undefined) {
      where.hasTestified = hasTestified === 'true';
    }

    const testimonies = await prisma.testimony.findMany({
      where,
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        network: {
          select: {
            nom: true
          }
        },
        confirmer: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: testimonies
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des témoignages pour culte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des témoignages'
    });
  }
};

// Confirmer qu'une personne va témoigner lors du culte
exports.confirmTestimonyForCulte = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmed } = req.body;
    const confirmedBy = req.user.id;

    const testimony = await prisma.testimony.findUnique({
      where: { id }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    const updatedTestimony = await prisma.testimony.update({
      where: { id },
      data: {
        isConfirmedToTestify: confirmed === true,
        confirmedAt: confirmed === true ? new Date() : null,
        confirmedBy: confirmed === true ? confirmedBy : null,
        // Si on annule la confirmation, on remet aussi hasTestified à false
        hasTestified: confirmed === true ? testimony.hasTestified : false,
        testifiedAt: confirmed === true ? testimony.testifiedAt : null
      },
      include: {
        confirmer: {
          select: {
            username: true
          }
        }
      }
    });

    logger.info('Témoignage confirmé pour culte:', { 
      id, 
      confirmed, 
      confirmedBy,
      testimonyType: updatedTestimony.testimonyType
    });

    res.json({
      success: true,
      message: confirmed ? 'Témoignage confirmé pour le culte' : 'Confirmation annulée',
      data: updatedTestimony
    });

  } catch (error) {
    logger.error('Erreur lors de la confirmation du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du témoignage'
    });
  }
};

// Marquer qu'une personne a témoigné lors du culte
exports.markAsTestified = async (req, res) => {
  try {
    const { id } = req.params;

    const testimony = await prisma.testimony.findUnique({
      where: { id }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    const updatedTestimony = await prisma.testimony.update({
      where: { id },
      data: {
        hasTestified: true,
        testifiedAt: new Date()
      }
    });

    logger.info('Témoignage marqué comme témoigné:', { 
      id, 
      testifiedAt: updatedTestimony.testifiedAt
    });

    res.json({
      success: true,
      message: 'Témoignage marqué comme effectué',
      data: updatedTestimony
    });

  } catch (error) {
    logger.error('Erreur lors du marquage du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du témoignage'
    });
  }
};

// Ajouter ou modifier une note
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const testimony = await prisma.testimony.update({
      where: { id },
      data: { note: note || null }
    });

    logger.info('Note ajoutée au témoignage:', { id, hasNote: !!note });

    res.json({
      success: true,
      message: note ? 'Note ajoutée avec succès' : 'Note supprimée avec succès'
    });

  } catch (error) {
    logger.error('Erreur lors de l\'ajout de la note:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la note'
    });
  }
};
