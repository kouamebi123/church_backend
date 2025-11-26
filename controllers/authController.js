const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const csrfProtection = require('../middlewares/csrfProtection');
const tokenService = require('../services/tokenService');
const redisService = require('../services/redisService');
const emailService = require('../utils/emailService');
const { createActivityLog } = require('./activityController');

const signToken = (user) => {
  return jwt.sign({ 
    id: user.id,
    pseudo: user.pseudo,
    role: user.role
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h' // Expiration sécurisée de 24h
  });
};

const sendTokenResponse = async (user, statusCode, res) => {
  // Réinitialiser current_role à null à chaque connexion
  // L'utilisateur utilisera toujours son rôle principal par défaut
  const activeRole = user.role; // Toujours utiliser le rôle principal
  
  const token = signToken({
    ...user,
    role: activeRole
  });

  // Log de l'activité de connexion
  try {
    await createActivityLog(prisma, user.id, 'LOGIN', 'USER', user.id, user.username, `Connexion de l'utilisateur: ${user.username}`, res.req);
  } catch (logError) {
    logger.error('Erreur lors du logging de connexion:', logError);
  }

  // Générer un token CSRF pour l'utilisateur
  const csrfToken = csrfProtection.generateToken(user.id);

  // Ajouter le token CSRF aux headers de réponse
  res.setHeader('X-CSRF-Token', csrfToken);

  // Extraire les rôles disponibles
  const availableRoles = user.role_assignments?.map(assignment => assignment.role) || [user.role];

  res.status(statusCode).json({
    success: true,
    token,
    csrfToken, // Ajouter aussi dans le body pour le frontend
    user: {
      id: user.id,
      username: user.username,
      role: activeRole,
      current_role: null, // Toujours null à la connexion
      available_roles: availableRoles,
      qualification: user.qualification,
      eglise_locale: user.eglise_locale,
      eglise_locale_id: user.eglise_locale_id,
      departement: user.departement,
      departement_id: user.departement_id
    }
  });
};

exports.register = async (req, res) => {
  try {
    logger.info('Register - Tentative d\'inscription', { 
      body: req.body,
      hasUsername: !!req.body.username,
      hasPseudo: !!req.body.pseudo,
      hasEmail: !!req.body.email,
      hasPassword: !!req.body.password,
      hasGenre: !!req.body.genre,
      hasTrancheAge: !!req.body.tranche_age,
      hasProfession: !!req.body.profession,
      hasVilleResidence: !!req.body.ville_residence,
      hasOrigine: !!req.body.origine,
      hasSituationMatrimoniale: !!req.body.situation_matrimoniale,
      hasNiveauEducation: !!req.body.niveau_education,
      hasEgliseLocaleId: !!req.body.eglise_locale_id,
      hasDepartementId: !!req.body.departement_id,
      hasQualification: !!req.body.qualification
    });

    const {
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
      eglise_locale_id,
      departement_id,
      qualification,
      group_id
    } = req.body;

    // Validation des champs obligatoires
    if (!eglise_locale_id) {
      return res.status(400).json({
        success: false,
        message: 'L\'église locale est obligatoire'
      });
    }

    // Vérifier que l'église existe
    const church = await prisma.church.findUnique({
      where: { id: eglise_locale_id }
    });

    if (!church) {
      return res.status(400).json({
        success: false,
        message: 'Église locale non trouvée'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    logger.info('Register - Données utilisateur à créer', {
      username,
      pseudo,
      hasPassword: !!hashedPassword,
      email,
      telephone,
      genre,
      tranche_age,
      profession,
      ville_residence,
      origine,
      situation_matrimoniale,
      niveau_education,
      eglise_locale_id,
      departement_id,
      role: 'MEMBRE',
      qualification: qualification || 'EN_INTEGRATION'
    });

    // Gestion de l'image de profil si elle existe
    let imagePath = null;
    if (req.file) {
      const timestamp = Date.now();
      const fileName = `profile_${timestamp}_${req.file.originalname}`;
      imagePath = `uploads/profiles/${fileName}`;
      
      // Le fichier est déjà sauvegardé par multer, nous utilisons juste le chemin
      logger.info('Register - Image de profil uploadée', { imagePath });
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        pseudo,
        password: hashedPassword,
        email,
        telephone,
        genre,
        tranche_age,
        profession: profession || '',
        situation_professionnelle: situation_professionnelle || null,
        ville_residence,
        origine,
        situation_matrimoniale,
        niveau_education,
        eglise_locale_id,
        departement_id: (departement_id && departement_id.trim() !== '') ? departement_id : null,
        role: 'MEMBRE',
        qualification: qualification || 'EN_INTEGRATION',
        image: imagePath
      },
      select: {
        id: true,
        username: true,
        role: true,
        qualification: true,
        eglise_locale_id: true,
        image: true
      }
    });

    // Ajouter l'utilisateur au groupe si group_id est fourni
    if (group_id) {
      try {
        // Vérifier que le groupe existe et appartient à la même église
        const group = await prisma.group.findUnique({
          where: { id: group_id },
          include: {
            network: {
              select: {
                church_id: true
              }
            }
          }
        });

        if (!group) {
          logger.warn('Register - Groupe non trouvé', { group_id });
        } else if (group.network?.church_id !== eglise_locale_id) {
          logger.warn('Register - Le groupe n\'appartient pas à la même église', { 
            group_id, 
            group_church_id: group.network?.church_id,
            user_church_id: eglise_locale_id
          });
        } else {
          // Vérifier si l'utilisateur n'est pas déjà membre du groupe
          const existingMember = await prisma.groupMember.findUnique({
            where: {
              group_id_user_id: {
                group_id: group_id,
                user_id: newUser.id
              }
            }
          });

          if (!existingMember) {
            // Ajouter le membre au groupe
            await prisma.groupMember.create({
              data: {
                group_id: group_id,
                user_id: newUser.id
              }
            });

            // Enregistrer dans l'historique
            await prisma.groupMemberHistory.create({
              data: {
                group_id: group_id,
                user_id: newUser.id,
                action: 'JOINED'
              }
            });

            logger.info('Register - Utilisateur ajouté au groupe', { 
              userId: newUser.id, 
              groupId: group_id 
            });
          } else {
            logger.info('Register - Utilisateur déjà membre du groupe', { 
              userId: newUser.id, 
              groupId: group_id 
            });
          }
        }
      } catch (groupError) {
        // Ne pas bloquer l'inscription si l'ajout au groupe échoue
        logger.error('Register - Erreur lors de l\'ajout au groupe', {
          error: groupError,
          userId: newUser.id,
          groupId: group_id
        });
      }
    }

    await sendTokenResponse(newUser, 201, res);
  } catch (error) {
    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'l\'inscription');
    res.status(status).json({
      success: false,
      message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, pseudo, password } = req.body;

    logger.info('Login - Tentative de connexion', { username, pseudo, hasPassword: !!password });

    // Valider les champs
    if (!password || (!username && !pseudo)) {
      logger.warn('Login - Champs manquants');
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom d\'utilisateur (username ou pseudo) et un mot de passe'
      });
    }

    // Utiliser username ou pseudo selon ce qui est fourni
    const loginField = username || pseudo;
    logger.info('Login - Champ de connexion utilisé', { loginField });

    logger.info('Login - Recherche utilisateur avec', { loginField });

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: loginField },
          { pseudo: loginField }
        ]
      },
      include: {
        eglise_locale: {
          select: { id: true, nom: true }
        },
        departement: {
          select: { id: true, nom: true }
        },
        role_assignments: {
          where: { is_active: true },
          select: { role: true }
        }
      }
    });

    logger.info('Login - Utilisateur trouvé', user ? { id: user.id, username: user.username, hasChurch: !!user.eglise_locale_id } : 'Aucun');

    if (!user) {
      logger.warn('Login - Utilisateur non trouvé');
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Vérifier si l'utilisateur a une église locale assignée
    if (!user.eglise_locale_id) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Vous devez être assigné à une église pour accéder au système. Veuillez contacter un administrateur.',
        code: 'NO_CHURCH_ASSIGNMENT',
        requiresAction: true
      });
    }

    // Vérifier si l'utilisateur a le rôle MEMBRE (accès refusé)
    if (user.role === 'MEMBRE') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé : Les membres n\'ont pas accès au système. Veuillez contacter un administrateur pour obtenir les permissions appropriées.',
        code: 'MEMBER_ACCESS_DENIED'
      });
    }

    // Vérifier si l'utilisateur a un mot de passe
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Vous n\'avez pas accès au système. Veuillez contacter un administrateur.'
      });
    }

    logger.info('Login - Vérification du mot de passe');
    const isMatch = await bcrypt.compare(password, user.password);
    logger.info('Login - Mot de passe correct', { isMatch });

    if (!isMatch) {
      logger.warn('Login - Mot de passe incorrect');
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Réinitialiser current_role à null dans la base de données
    await prisma.user.update({
      where: { id: user.id },
      data: { current_role: null }
    });

    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        role: true,
        current_role: true,
        qualification: true,
        eglise_locale_id: true,
        role_assignments: {
          where: { is_active: true },
          select: { role: true }
        }
      }
    });

    await sendTokenResponse(safeUser, 200, res);
  } catch (error) {
    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la connexion');
    res.status(status).json({
      success: false,
      message
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        eglise_locale: {
          select: { id: true, nom: true }
        },
        departement: {
          select: { id: true, nom: true }
        },
        role_assignments: {
          where: { is_active: true },
          select: { role: true }
        }
      }
    });

    // Régénérer le token CSRF pour l'utilisateur
    const csrfToken = csrfProtection.generateToken(user.id);

    // Ajouter le token CSRF aux headers de réponse
    res.setHeader('X-CSRF-Token', csrfToken);

    // Préparer les données utilisateur avec les rôles multiples
    const userData = {
      ...user,
      available_roles: user.role_assignments?.map(assignment => assignment.role) || [user.role],
      current_role: user.current_role || user.role
    };

    res.status(200).json({
      success: true,
      data: userData,
      csrfToken // Ajouter aussi dans le body
    });
  } catch (error) {
    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération du profil');
    res.status(status).json({
      success: false,
      message
    });
  }
};

exports.updateDetails = async (req, res) => {
  try {
    const fieldsToUpdate = {
      username: req.body.username,
      email: req.body.email,
      telephone: req.body.telephone,
      ville_residence: req.body.ville_residence,
      profession: req.body.profession,
      situation_matrimoniale: req.body.situation_matrimoniale,
      niveau_education: req.body.niveau_education
    };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: fieldsToUpdate
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true }
    });

    const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(req.body.newPassword, salt);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed }
    });

    const safeUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        role: true,
        qualification: true,
        eglise_locale_id: true
      }
    });

    await sendTokenResponse(safeUser, 200, res);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Demander une réinitialisation de mot de passe
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    logger.info('ForgotPassword - Demande de réinitialisation', { email });

    // Valider que l'email est fourni
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir votre email'
      });
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
    }

    // Rechercher l'utilisateur par email uniquement
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    if (!user) {
      logger.warn('ForgotPassword - Utilisateur non trouvé avec cet email');
      // Pour des raisons de sécurité, ne pas révéler si l'email existe ou non
      return res.status(200).json({
        success: true,
        message: 'Si cet email existe dans notre base, vous recevrez les instructions de réinitialisation'
      });
    }

    logger.info('ForgotPassword - Utilisateur trouvé', { id: user.id, username: user.username });

    // Générer un token de réinitialisation (valide 10 minutes)
    const resetToken = jwt.sign(
      { 
        id: user.id, 
        type: 'password_reset',
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' } // 10 minutes
    );

    // Créer un lien de réinitialisation sécurisé
    const resetLink = `${process.env.FRONTEND_URL || 'https://multitudeszno.up.railway.app'}/reset-password?token=${resetToken}`;

    // Toujours essayer d'envoyer l'email
    try {
      // Forcer l'initialisation du service email
      await emailService.initializeTransporter();
      
      // Envoyer l'email de réinitialisation
      await emailService.sendPasswordResetEmail(user.email, resetLink, user.username);
      
      res.status(200).json({
        success: true,
        message: 'Instructions de réinitialisation envoyées à votre email'
      });
    } catch (emailError) {
      logger.error('❌ Erreur lors de l\'envoi de l\'email:', emailError);
      
      // En cas d'erreur d'email, retourner une erreur claire
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.'
      });
    }

  } catch (error) {
    logger.error('❌ ForgotPassword - Erreur:', error);
    const { status, message } = handleError(error, 'la demande de réinitialisation');
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Réinitialiser le mot de passe avec le token
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    logger.info('ResetPasswordWithToken - Tentative de réinitialisation');

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation et nouveau mot de passe requis'
      });
    }

    // Valider le token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.warn('ResetPasswordWithToken - Token invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Lien de réinitialisation invalide ou expiré. Veuillez demander un nouveau lien.'
      });
    }

    // Vérifier que c'est un token de réinitialisation
    if (decoded.type !== 'password_reset') {
      logger.warn('ResetPasswordWithToken - Type de token incorrect');
      return res.status(400).json({
        success: false,
        message: 'Lien de réinitialisation invalide'
      });
    }

    // Vérifier que l'utilisateur existe et que l'email correspond
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.id,
        email: decoded.email // Vérification supplémentaire de sécurité
      },
      select: { 
        id: true, 
        username: true,
        email: true,
        password: true
      }
    });

    if (!user) {
      logger.warn('ResetPasswordWithToken - Utilisateur non trouvé ou email ne correspond pas');
      return res.status(400).json({
        success: false,
        message: 'Lien de réinitialisation invalide'
      });
    }

    // Validation du nouveau mot de passe
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit être différent de l\'ancien'
      });
    }

    // Hash du nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    logger.info('ResetPasswordWithToken - Mot de passe mis à jour pour', { username: user.username });

    res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'
    });

  } catch (error) {
    logger.error('❌ ResetPasswordWithToken - Erreur:', error);
    const { status, message } = handleError(error, 'la réinitialisation du mot de passe');
    res.status(status).json({
      success: false,
      message
    });
  }
};


