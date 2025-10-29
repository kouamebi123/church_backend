const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Contrôleur pour la gestion des préférences utilisateur
 */

// Récupérer les préférences de l'utilisateur connecté
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email_notifications: true,
        language: true,
        theme: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        email_notifications: user.email_notifications,
        language: user.language || 'fr',
        theme: user.theme || 'light'
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des préférences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des préférences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Mettre à jour les préférences de l'utilisateur
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_notifications, language, theme } = req.body;

    // Validation des données
    const updateData = {};
    
    if (typeof email_notifications === 'boolean') {
      updateData.email_notifications = email_notifications;
    }
    
    if (language && ['fr', 'en'].includes(language)) {
      updateData.language = language;
    }
    
    if (theme && ['light', 'dark'].includes(theme)) {
      updateData.theme = theme;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée valide à mettre à jour'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email_notifications: true,
        language: true,
        theme: true
      }
    });

    logger.info(`Préférences mises à jour pour l'utilisateur ${userId}`, updateData);

    res.json({
      success: true,
      message: 'Préférences mises à jour avec succès',
      data: {
        email_notifications: updatedUser.email_notifications,
        language: updatedUser.language || 'fr',
        theme: updatedUser.theme || 'light'
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la mise à jour des préférences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des préférences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Mettre à jour uniquement les préférences email
const updateEmailPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_notifications } = req.body;

    if (typeof email_notifications !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'email_notifications doit être un booléen'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email_notifications },
      select: {
        id: true,
        email_notifications: true
      }
    });

    logger.info(`Préférences email mises à jour pour l'utilisateur ${userId}`, { email_notifications });

    res.json({
      success: true,
      message: 'Préférences email mises à jour avec succès',
      data: {
        email_notifications: updatedUser.email_notifications
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la mise à jour des préférences email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des préférences email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

exports.getPreferences = getPreferences;
exports.updatePreferences = updatePreferences;
exports.updateEmailPreferences = updateEmailPreferences;

