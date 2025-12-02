const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

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
    // Accepter images, vidéos, documents et fichiers audio
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|pdf|doc|docx|txt|mp3|wav|ogg|m4a|webm|aac/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    // Vérifier l'extension OU le mimetype (plus permissif)
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés : images, vidéos, documents et fichiers audio (mp3, wav, ogg, m4a, webm).'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max par fichier (augmenté pour les fichiers audio)
    files: 3 // Maximum 3 fichiers : 2 illustrations + 1 audio
  }
});

// Middleware d'upload pour les témoignages (illustrations + audio)
exports.uploadTestimonyFiles = (req, res, next) => {
  // Utiliser fields pour accepter plusieurs champs de fichiers
  const upload = multer({
    storage: testimonyStorage,
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|pdf|doc|docx|txt|mp3|wav|ogg|m4a|webm|aac/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      
      if (extname) {
        return cb(null, true);
      } else {
        cb(new Error('Type de fichier non autorisé. Formats acceptés : images, vidéos, documents et fichiers audio (mp3, wav, ogg, m4a, webm).'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max par fichier
      files: 3 // Maximum 3 fichiers : 2 illustrations + 1 audio
    }
  }).fields([
    { name: 'illustrations', maxCount: 2 },
    { name: 'audioFile', maxCount: 1 }
  ]);

  upload(req, res, next);
};

// Obtenir toutes les églises (pour le formulaire)
exports.getChurches = async (req, res) => {
  try {
    const churches = await req.prisma.church.findMany({
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
    const { churchId } = req.params;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis'
      });
    }

    const networks = await req.prisma.network.findMany({
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

// Obtenir les sections (sessions) d'une église
exports.getSectionsByChurch = async (req, res) => {
  try {
    const { churchId } = req.params;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis'
      });
    }

    // Récupérer les sessions (sections) de l'église
    const sections = await req.prisma.session.findMany({
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
      data: sections
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des sections:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sections'
    });
  }
};

// Créer un nouveau témoignage
exports.createTestimony = async (req, res) => {
  try {
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
    // Le témoignage peut être soit du texte (content) soit un fichier audio
    // Vérifier la structure de req.files (peut être un objet avec des arrays ou directement des arrays)
    let hasAudioFile = false;
    if (req.files) {
      if (req.files.audioFile) {
        if (Array.isArray(req.files.audioFile)) {
          hasAudioFile = req.files.audioFile.length > 0;
        } else {
          // Si c'est un seul fichier (pas un array)
          hasAudioFile = true;
        }
      }
    }
    // Vérifier si le contenu texte existe et n'est pas vide
    // Si content est une chaîne vide "", cela compte comme pas de contenu texte
    const hasTextContent = content && typeof content === 'string' && content.trim() !== '';
    
    if (!churchId || !category) {
      return res.status(400).json({
        success: false,
        message: 'L\'église et la catégorie sont requis'
      });
    }
    
    if (!hasTextContent && !hasAudioFile) {
      return res.status(400).json({
        success: false,
        message: 'Le témoignage est requis (texte ou enregistrement vocal)'
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
    const church = await req.prisma.church.findUnique({
      where: { id: churchId }
    });

    if (!church) {
      return res.status(400).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Convertir networkId vide ou "AUCUN_RESEAU" en null
    const finalNetworkId = (networkId && typeof networkId === 'string' && networkId.trim() !== '' && networkId !== 'AUCUN_RESEAU') ? networkId : null;
    
    // Convertir section vide en null
    const finalSection = (section && typeof section === 'string' && section.trim() !== '') ? section : null;

    // Déterminer le type de témoignage automatiquement
    let determinedTestimonyType = null;
    if (finalNetworkId) {
      determinedTestimonyType = 'NETWORK_MEMBER';
    } else if (finalSection) {
      // Si une section est sélectionnée (mais pas de réseau), c'est un membre de section
      determinedTestimonyType = 'SECTION';
    } else if (testimonyType) {
      determinedTestimonyType = testimonyType.toUpperCase();
    } else {
      determinedTestimonyType = 'VISITOR';
    }

    // Vérifier que le réseau existe si fourni
    if (finalNetworkId) {
      const network = await req.prisma.network.findFirst({
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

    // Vérifier que la section existe si fournie
    if (finalSection) {
      const session = await req.prisma.session.findFirst({
        where: {
          id: finalSection,
          church_id: churchId
        }
      });

      if (!session) {
        return res.status(400).json({
          success: false,
          message: 'Section non trouvée pour cette église'
        });
      }
    }

    // Déterminer le contenu : si audio fourni et pas de texte, mettre un placeholder
    // Si content est undefined ou null, utiliser une chaîne vide
    let finalContent = (content !== undefined && content !== null) ? content : '';
    if (hasAudioFile && !hasTextContent) {
      finalContent = '[Témoignage vocal]';
    }
    
    // S'assurer que finalContent n'est jamais null ou undefined
    if (!finalContent) {
      finalContent = '';
    }

    // Créer le témoignage
    const testimony = await req.prisma.testimony.create({
      data: {
        firstName: isAnonymousBool ? 'Anonyme' : firstName,
        lastName: isAnonymousBool ? 'Anonyme' : lastName,
        phone: phone || null,
        email: email || null,
        churchId,
        networkId: finalNetworkId,
        testimonyType: determinedTestimonyType,
        section: finalSection,
        unit: unit || null,
        category: category.toUpperCase(),
        content: finalContent,
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
    // req.files est maintenant un objet avec les clés 'illustrations' et 'audioFile'
    const allFiles = [];
    
    logger.info('Traitement des fichiers uploadés:', {
      hasFiles: !!req.files,
      filesKeys: req.files ? Object.keys(req.files) : [],
      filesStructure: req.files ? JSON.stringify(Object.keys(req.files)) : 'No files'
    });
    
    if (req.files) {
      // Ajouter les illustrations
      if (req.files.illustrations) {
        if (Array.isArray(req.files.illustrations)) {
          allFiles.push(...req.files.illustrations.map(f => ({ ...f, category: 'ILLUSTRATION' })));
        } else {
          // Si c'est un seul fichier (pas un array)
          allFiles.push({ ...req.files.illustrations, category: 'ILLUSTRATION' });
        }
      }
      
      // Ajouter le fichier audio
      if (req.files.audioFile) {
        if (Array.isArray(req.files.audioFile) && req.files.audioFile.length > 0) {
          allFiles.push({ ...req.files.audioFile[0], category: 'AUDIO' });
        } else if (!Array.isArray(req.files.audioFile)) {
          // Si c'est un seul fichier (pas un array)
          allFiles.push({ ...req.files.audioFile, category: 'AUDIO' });
        }
      }
    }
    
    logger.info(`Nombre de fichiers à traiter: ${allFiles.length}`);

    // Créer les fichiers en base de données
    if (allFiles.length > 0) {
      try {
        const filePromises = allFiles.map(file => {
          // Vérifier que le fichier a les propriétés nécessaires
          if (!file || !file.filename) {
            logger.error('Fichier invalide:', file);
            throw new Error('Fichier invalide: propriété filename manquante');
          }
          
          // Construire le chemin du fichier si nécessaire
          const filePath = file.path || path.join(__dirname, '../uploads/testimonies', file.filename);
          
          return req.prisma.testimonyFile.create({
            data: {
              testimonyId: testimony.id,
              fileName: file.filename,
              originalName: file.originalname || file.filename,
              filePath: filePath,
              fileType: file.mimetype || 'application/octet-stream',
              fileSize: file.size || 0,
              fileCategory: file.category || 'ILLUSTRATION'
            }
          });
        });

        await Promise.all(filePromises);
        logger.info(`✅ ${allFiles.length} fichier(s) créé(s) pour le témoignage ${testimony.id}`);
      } catch (fileError) {
        logger.error('Erreur lors de la création des fichiers:', fileError);
        logger.error('Stack trace fichiers:', fileError.stack);
        logger.error('Détails des fichiers qui ont échoué:', {
          allFilesCount: allFiles.length,
          filesInfo: allFiles.map(f => ({
            filename: f.filename,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            path: f.path,
            category: f.category
          }))
        });
        // Ne pas échouer complètement si les fichiers ne peuvent pas être créés
        // Le témoignage a déjà été créé
        logger.warn('Le témoignage a été créé mais les fichiers n\'ont pas pu être enregistrés');
        // Relancer l'erreur pour que l'utilisateur soit informé
        throw new Error(`Erreur lors de l'enregistrement des fichiers: ${fileError.message}`);
      }
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
    logger.error('Stack trace:', error.stack);
    logger.error('Request body:', JSON.stringify(req.body, null, 2));
    logger.error('Request files:', req.files ? Object.keys(req.files) : 'No files');
    if (req.files) {
      logger.error('Files details:', {
        illustrations: req.files.illustrations ? (Array.isArray(req.files.illustrations) ? req.files.illustrations.length : 1) : 0,
        audioFile: req.files.audioFile ? (Array.isArray(req.files.audioFile) ? req.files.audioFile.length : 1) : 0
      });
    }
    
    // Retourner plus de détails en développement
    const errorResponse = {
      success: false,
      message: 'Erreur lors de la soumission du témoignage',
    };
    
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      errorResponse.error = error.message;
      errorResponse.stack = error.stack;
      errorResponse.details = {
        hasFiles: !!req.files,
        filesKeys: req.files ? Object.keys(req.files) : [],
        bodyKeys: Object.keys(req.body || {}),
        hasAudioFile: req.files?.audioFile ? (Array.isArray(req.files.audioFile) ? req.files.audioFile.length > 0 : true) : false,
        hasIllustrations: req.files?.illustrations ? (Array.isArray(req.files.illustrations) ? req.files.illustrations.length > 0 : true) : false,
        content: req.body?.content || 'vide',
        hasTextContent: req.body?.content && req.body.content.trim() !== ''
      };
    }
    
    res.status(500).json(errorResponse);
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
      req.prisma.testimony.findMany({
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
      req.prisma.testimony.count({ where })
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
    const { id } = req.params;

    const testimony = await req.prisma.testimony.findUnique({
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
      req.prisma.testimony.findMany({
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
      req.prisma.testimony.count({ where })
    ]);

    // Enrichir les témoignages avec les informations de section (session) si disponible
    const enrichedTestimonies = await Promise.all(
      testimonies.map(async (testimony) => {
        if (testimony.section) {
          try {
            const session = await req.prisma.session.findUnique({
              where: { id: testimony.section },
              select: {
                id: true,
                nom: true
              }
            });
            return {
              ...testimony,
              session: session || null
            };
          } catch (error) {
            logger.error('Erreur lors de la récupération de la session:', error);
            return {
              ...testimony,
              session: null
            };
          }
        }
        return {
          ...testimony,
          session: null
        };
      })
    );

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        testimonies: enrichedTestimonies,
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
    const { id } = req.params;

    // Vérifier si le témoignage existe
    const testimony = await req.prisma.testimony.findUnique({
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
      await req.prisma.testimonyFile.deleteMany({
        where: { testimonyId: id }
      });
    }

    // Supprimer le témoignage
    await req.prisma.testimony.delete({
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

    const testimony = await req.prisma.testimony.update({
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

    const testimonies = await req.prisma.testimony.findMany({
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

    // Enrichir les témoignages avec les informations de section (session) si disponible
    const enrichedTestimonies = await Promise.all(
      testimonies.map(async (testimony) => {
        if (testimony.section) {
          try {
            const session = await req.prisma.session.findUnique({
              where: { id: testimony.section },
              select: {
                id: true,
                nom: true
              }
            });
            return {
              ...testimony,
              session: session || null
            };
          } catch (error) {
            logger.error('Erreur lors de la récupération de la session:', error);
            return {
              ...testimony,
              session: null
            };
          }
        }
        return {
          ...testimony,
          session: null
        };
      })
    );

    res.json({
      success: true,
      data: enrichedTestimonies
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

    const testimony = await req.prisma.testimony.findUnique({
      where: { id }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    const updatedTestimony = await req.prisma.testimony.update({
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

    const testimony = await req.prisma.testimony.findUnique({
      where: { id }
    });

    if (!testimony) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    const updatedTestimony = await req.prisma.testimony.update({
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

    const testimony = await req.prisma.testimony.update({
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
