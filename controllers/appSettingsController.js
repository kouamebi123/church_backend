const logger = require('../utils/logger');

/**
 * Contrôleur pour la gestion des paramètres de l'application
 */


// Récupérer les paramètres de l'application (publique)
const getAppSettings = async (req, res) => {
  try {
    // Récupérer ou créer les paramètres par défaut
    let settings = await req.prisma.appSettings.findFirst({
      orderBy: {
        updated_at: 'desc'
      }
    });

    res.json({
      success: true,
      data: {
        contact_email: settings?.contact_email || '',
        contact_phone: settings?.contact_phone || '',
        contact_location: settings?.contact_location || ''
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des paramètres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paramètres',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Mettre à jour les paramètres de l'application (admin seulement)
const updateAppSettings = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé : Seuls les administrateurs peuvent modifier les paramètres'
      });
    }

    const { contact_email, contact_phone, contact_location } = req.body;

    // Récupérer les paramètres existants ou créer s'ils n'existent pas
    let settings = await req.prisma.appSettings.findFirst({
      orderBy: {
        updated_at: 'desc'
      }
    });

    const updateData = {
      updated_by_id: req.user.id
    };

    if (contact_email !== undefined) {
      updateData.contact_email = contact_email || null;
    }
    if (contact_phone !== undefined) {
      updateData.contact_phone = contact_phone || null;
    }
    if (contact_location !== undefined) {
      updateData.contact_location = contact_location || null;
    }

    if (settings) {
      // Mettre à jour les paramètres existants
      settings = await req.prisma.appSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    } else {
      // Créer de nouveaux paramètres
      settings = await req.prisma.appSettings.create({
        data: {
          contact_email: contact_email || null,
          contact_phone: contact_phone || null,
          contact_location: contact_location || null,
          updated_by_id: req.user.id
        }
      });
    }

    logger.info(`✅ Paramètres de l'application mis à jour par ${req.user.pseudo}`, {
      updated_by: req.user.id,
      settings: {
        contact_email: settings.contact_email,
        contact_phone: settings.contact_phone,
        contact_location: settings.contact_location
      }
    });

    res.json({
      success: true,
      message: 'Paramètres mis à jour avec succès',
      data: {
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        contact_location: settings.contact_location || ''
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la mise à jour des paramètres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  getAppSettings,
  updateAppSettings
};

