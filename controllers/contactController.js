const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

/**
 * Contrôleur pour les messages de contact
 */

// Créer un nouveau message de contact
const createContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation des données
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Adresse email invalide'
      });
    }

    // Créer le message de contact
    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim()
      }
    });

    logger.info(`✅ Message de contact créé: ${contact.id}`, {
      contact_id: contact.id,
      email: contact.email,
      subject: contact.subject
    });

    // Envoyer une notification email aux administrateurs (en arrière-plan)
    setImmediate(async () => {
      try {
        // Récupérer les administrateurs avec notifications email activées
        const admins = await prisma.user.findMany({
          where: {
            role: { in: ['SUPER_ADMIN', 'ADMIN'] },
            email_notifications: true,
            email: { not: null }
          },
          select: {
            id: true,
            email: true,
            pseudo: true
          }
        });

        // Envoyer un email à chaque administrateur
        for (const admin of admins) {
          try {
            await emailService.sendContactNotification(
              admin.email,
              {
                name,
                email,
                subject,
                message,
                contact_id: contact.id,
                created_at: contact.created_at
              }
            );
            logger.info(`📧 Notification de contact envoyée à ${admin.email}`);
          } catch (emailError) {
            logger.error(`❌ Erreur envoi email à ${admin.email}:`, emailError);
            // Ne pas faire échouer la création du contact pour une erreur d'email
          }
        }
      } catch (error) {
        logger.error('❌ Erreur lors de l\'envoi des notifications email:', error);
        // Ne pas faire échouer la création du contact pour une erreur d'email
      }
    });

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: contact.id,
        created_at: contact.created_at
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la création du message de contact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer tous les messages de contact (admin seulement)
const getContacts = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent consulter les messages de contact'
      });
    }

    const { page = 1, limit = 20, read } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (read !== undefined) {
      where.read = read === 'true';
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.contact.count({ where });

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des messages de contact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Marquer un message comme lu (admin seulement)
const markAsRead = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent marquer les messages comme lus'
      });
    }

    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id }
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    if (!contact.read) {
      await prisma.contact.update({
        where: { id },
        data: {
          read: true,
          read_at: new Date()
        }
      });

      logger.info(`✅ Message de contact marqué comme lu: ${id}`, {
        contact_id: id,
        admin: req.user.pseudo
      });
    }

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });

  } catch (error) {
    logger.error('❌ Erreur lors du marquage du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Supprimer un message de contact (admin seulement)
const deleteContact = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent supprimer les messages de contact'
      });
    }

    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id }
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    await prisma.contact.delete({
      where: { id }
    });

    logger.info(`✅ Message de contact supprimé: ${id}`, {
      contact_id: id,
      admin: req.user.pseudo
    });

    res.json({
      success: true,
      message: 'Message supprimé avec succès'
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la suppression du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  createContact,
  getContacts,
  markAsRead,
  deleteContact
};

