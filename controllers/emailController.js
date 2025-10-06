const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Contrôleur pour les fonctionnalités email
 */

// Envoyer un email de test
const sendTestEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Adresse email requise'
      });
    }

    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent envoyer des emails de test'
      });
    }

    await emailService.sendTestEmail(email);
    
    logger.info(`Email de test envoyé à ${email} par ${req.user.pseudo}`);
    
    res.json({
      success: true,
      message: 'Email de test envoyé avec succès'
    });

  } catch (error) {
    logger.error('Erreur lors de l\'envoi de l\'email de test:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email de test',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Vérifier la configuration email
const checkEmailConfig = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent vérifier la configuration email'
      });
    }

    const config = {
      smtp_host: process.env.SMTP_HOST || 'Non configuré',
      smtp_port: process.env.SMTP_PORT || 'Non configuré',
      smtp_user: process.env.SMTP_USER || process.env.EMAIL_USER || 'Non configuré',
      app_name: process.env.APP_NAME || 'Non configuré',
      app_url: process.env.APP_URL || 'Non configuré',
      has_smtp_pass: !!(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD)
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Erreur lors de la vérification de la configuration email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la configuration email'
    });
  }
};

module.exports = {
  sendTestEmail,
  checkEmailConfig
};

