const crypto = require('crypto');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const QualificationService = require('../services/qualificationService');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');
const { rebuildChaineImpact } = require('../utils/chaineImpactService');

// Générer un lien temporaire pour la création de réseau (admin seulement)
exports.generateInvitationLink = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.body;

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'L\'ID de l\'église est requis'
      });
    }

    // Vérifier que l'église existe
    const church = await prisma.church.findUnique({
      where: { id: churchId }
    });

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Église non trouvée'
      });
    }

    // Générer un token unique
    const token = crypto.randomBytes(32).toString('hex');

    // Date d'expiration : 3 jours à partir de maintenant
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    // Créer le lien d'invitation
    const invitationLink = await prisma.networkInvitationLink.create({
      data: {
        token,
        church_id: churchId,
        created_by_id: req.user.id,
        expires_at: expiresAt
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

    // Générer l'URL complète
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/register-network/${token}`;

    logger.info('Lien d\'invitation réseau généré', {
      linkId: invitationLink.id,
      churchId,
      createdBy: req.user.id,
      expiresAt
    });

    res.status(201).json({
      success: true,
      data: {
        id: invitationLink.id,
        token: invitationLink.token,
        url: invitationUrl,
        expires_at: invitationLink.expires_at,
        church: invitationLink.church
      }
    });
  } catch (error) {
    logger.error('NetworkInvitation - generateInvitationLink - Erreur complète', error);
    const { status, message } = handleError(error, 'la génération du lien d\'invitation');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Vérifier la validité d'un lien d'invitation
exports.validateInvitationLink = async (req, res) => {
  try {
    const { prisma } = req;
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token requis'
      });
    }

    const invitationLink = await prisma.networkInvitationLink.findUnique({
      where: { token },
      include: {
        church: {
          select: {
            id: true,
            nom: true,
            adresse: true
          }
        }
      }
    });

    if (!invitationLink) {
      return res.status(404).json({
        success: false,
        message: 'Lien d\'invitation non trouvé'
      });
    }

    if (invitationLink.used) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien a déjà été utilisé'
      });
    }

    if (new Date() > invitationLink.expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien a expiré'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        church: invitationLink.church,
        expires_at: invitationLink.expires_at
      }
    });
  } catch (error) {
    logger.error('NetworkInvitation - validateInvitationLink - Erreur complète', error);
    const { status, message } = handleError(error, 'la validation du lien d\'invitation');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un réseau et son responsable via un lien d'invitation
exports.registerNetworkViaLink = async (req, res) => {
  try {
    const { prisma } = req;
    const { token } = req.params;
    const {
      // Données du responsable
      username,
      pseudo,
      password,
      email,
      telephone,
      genre,
      tranche_age,
      profession,
      situation_professionnelle,
      ville_residence,
      origine,
      situation_matrimoniale,
      niveau_education,
      adresse,
      image,
      // Données du réseau
      network_name
    } = req.body;

    // Vérifier que le token est valide
    const invitationLink = await prisma.networkInvitationLink.findUnique({
      where: { token },
      include: {
        church: {
          include: {
            responsable: true
          }
        }
      }
    });

    if (!invitationLink) {
      return res.status(404).json({
        success: false,
        message: 'Lien d\'invitation non trouvé'
      });
    }

    if (invitationLink.used) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien a déjà été utilisé'
      });
    }

    if (new Date() > invitationLink.expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Ce lien a expiré'
      });
    }

    // Validation des champs obligatoires
    if (!username || !pseudo || !email || !network_name) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Vérifier que le pseudo n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { pseudo }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ce pseudo est déjà utilisé'
      });
    }

    // Vérifier que l'email n'existe pas déjà
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }
    }

    // Vérifier que le nom du réseau n'existe pas déjà
    const existingNetwork = await prisma.network.findUnique({
      where: { nom: network_name }
    });

    if (existingNetwork) {
      return res.status(400).json({
        success: false,
        message: 'Un réseau avec ce nom existe déjà'
      });
    }

    // Générer un mot de passe par défaut si aucun n'est fourni
    const bcrypt = require('bcryptjs');
    let passwordToHash = password;
    if (!passwordToHash) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      passwordToHash = '';
      for (let i = 0; i < 16; i++) {
        passwordToHash += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordToHash, salt);

    // Créer l'utilisateur responsable et le réseau dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'utilisateur responsable
      const newUser = await tx.user.create({
        data: {
          username,
          pseudo,
          password: hashedPassword,
          email: email || null,
          telephone: telephone || null,
          genre,
          tranche_age,
          profession: profession || '',
          situation_professionnelle: situation_professionnelle || null,
          ville_residence,
          origine,
          situation_matrimoniale,
          niveau_education,
          adresse: adresse || null,
          eglise_locale_id: invitationLink.church_id,
          qualification: 'RESPONSABLE_RESEAU',
          role: 'MEMBRE', // Le rôle sera géré par les admins
          image: image || ''
        }
      });

      // Créer le réseau
      const newNetwork = await tx.network.create({
        data: {
          nom: network_name,
          church_id: invitationLink.church_id,
          responsable1_id: newUser.id,
          responsable2_id: null,
          active: true
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
          }
        }
      });

      // Ajouter le responsable à la chaîne d'impact si l'église a un responsable
      if (invitationLink.church.responsable) {
        await tx.chaineImpact.create({
          data: {
            user_id: newUser.id,
            niveau: getNiveauFromQualification('RESPONSABLE_RESEAU'),
            qualification: 'RESPONSABLE_RESEAU',
            responsable_id: invitationLink.church.responsable.id,
            eglise_id: invitationLink.church_id,
            network_id: newNetwork.id,
            group_id: null,
            position_x: 0,
            position_y: 1
          }
        });
      }

      // Marquer le lien comme utilisé
      await tx.networkInvitationLink.update({
        where: { id: invitationLink.id },
        data: {
          used: true,
          used_at: new Date()
        }
      });

      return { user: newUser, network: newNetwork };
    });

    // Reconstruire la chaîne d'impact pour l'église
    try {
      await rebuildChaineImpact(prisma, invitationLink.church_id);
    } catch (error) {
      logger.error('Erreur lors de la reconstruction de la chaîne d\'impact après création du réseau:', error);
    }

    logger.info('Réseau et responsable créés via lien d\'invitation', {
      networkId: result.network.id,
      userId: result.user.id,
      linkId: invitationLink.id
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          username: result.user.username,
          pseudo: result.user.pseudo,
          email: result.user.email
        },
        network: result.network
      }
    });
  } catch (error) {
    logger.error('NetworkInvitation - registerNetworkViaLink - Erreur complète', error);
    const { status, message } = handleError(error, 'la création du réseau via lien d\'invitation');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Lister les liens d'invitation (admin seulement)
exports.listInvitationLinks = async (req, res) => {
  try {
    const { prisma } = req;
    const { churchId } = req.query;

    const where = {};
    if (churchId) {
      where.church_id = churchId;
    }

    // Si l'utilisateur est un manager, filtrer par son église
    if (req.user.role === 'MANAGER' && req.user.eglise_locale_id) {
      const churchId = typeof req.user.eglise_locale_id === 'object'
        ? req.user.eglise_locale_id.id || req.user.eglise_locale_id._id
        : req.user.eglise_locale_id;
      where.church_id = churchId;
    }

    const links = await prisma.networkInvitationLink.findMany({
      where,
      include: {
        church: {
          select: {
            id: true,
            nom: true
          }
        },
        created_by: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const linksWithUrl = links.map(link => ({
      ...link,
      url: `${baseUrl}/register-network/${link.token}`
    }));

    res.status(200).json({
      success: true,
      data: linksWithUrl
    });
  } catch (error) {
    logger.error('NetworkInvitation - listInvitationLinks - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des liens d\'invitation');
    res.status(status).json({
      success: false,
      message
    });
  }
};
