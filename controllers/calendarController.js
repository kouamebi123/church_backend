const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Récupérer tous les événements publics (pour la page publique)
const getPublicEvents = async (req, res) => {
  try {
    const { church_id } = req.query;

    if (!church_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de l\'église requis' 
      });
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        church_id,
        is_public: true
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });

    logger.info('✅ Événements publics récupérés avec succès');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des événements publics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Récupérer tous les événements (pour le dashboard admin)
const getAllEvents = async (req, res) => {
  try {
    const { church_id } = req.query;
    const user_id = req.user.id;

    if (!church_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de l\'église requis' 
      });
    }

    // Vérifier les permissions
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      include: { eglise_locale: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Seuls les admins et super-admins peuvent voir tous les événements
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        church_id
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        created_by: {
          select: {
            pseudo: true,
            username: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });

    logger.info('✅ Tous les événements récupérés avec succès');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des événements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Récupérer un événement par ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        church: {
          select: {
            nom: true,
            ville: true,
            adresse: true
          }
        },
        created_by: {
          select: {
            pseudo: true,
            username: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }

    logger.info('✅ Événement récupéré avec succès');

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la récupération de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'événement'
    });
  }
};

// Créer un nouvel événement
const createEvent = async (req, res) => {
  try {
    logger.info('🔍 Création événement - Données reçues:', { body: req.body });
    
    const { 
      title, 
      description, 
      start_date, 
      end_date, 
      location, 
      event_type, 
      is_public, 
      church_id 
    } = req.body;
    const created_by_id = req.user.id;

    // Vérifier les permissions
    const user = await prisma.user.findUnique({
      where: { id: created_by_id },
      include: { eglise_locale: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Seuls les admins et super-admins peuvent créer des événements
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier que l'église existe
    const church = await prisma.church.findUnique({
      where: { id: church_id }
    });

    if (!church) {
      return res.status(404).json({ message: 'Église non trouvée' });
    }

    // Créer l'événement
    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        location,
        event_type: event_type || 'GENERAL',
        is_public: is_public !== undefined ? is_public : true,
        church_id,
        created_by_id
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        created_by: {
          select: {
            pseudo: true,
            username: true
          }
        }
      }
    });

    logger.info('✅ Événement créé avec succès:', { eventId: event.id });

    res.status(201).json({
      success: true,
      data: event,
      message: 'Événement créé avec succès'
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la création de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'événement'
    });
  }
};

// Mettre à jour un événement
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      start_date, 
      end_date, 
      location, 
      event_type, 
      is_public 
    } = req.body;
    const user_id = req.user.id;

    // Vérifier que l'événement existe
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: { created_by: true }
    });

    if (!existingEvent) {
      return res.status(404).json({ message: 'Événement non trouvé' });
    }

    // Vérifier les permissions
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Seuls les admins, super-admins ou le créateur peuvent modifier
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && existingEvent.created_by_id !== user_id) {
      return res.status(403).json({ message: 'Non autorisé à modifier cet événement' });
    }

    // Mettre à jour l'événement
    const updatedEvent = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title,
        description,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        location,
        event_type,
        is_public
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        },
        created_by: {
          select: {
            pseudo: true,
            username: true
          }
        }
      }
    });

    logger.info('✅ Événement mis à jour avec succès:', { eventId: id });

    res.json({
      success: true,
      data: updatedEvent,
      message: 'Événement mis à jour avec succès'
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la mise à jour de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'événement'
    });
  }
};

// Supprimer un événement
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Vérifier que l'événement existe
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id },
      include: { created_by: true }
    });

    if (!existingEvent) {
      return res.status(404).json({ message: 'Événement non trouvé' });
    }

    // Vérifier les permissions
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Seuls les admins, super-admins ou le créateur peuvent supprimer
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && existingEvent.created_by_id !== user_id) {
      return res.status(403).json({ message: 'Non autorisé à supprimer cet événement' });
    }

    // Supprimer l'événement
    await prisma.calendarEvent.delete({
      where: { id }
    });

    logger.info('✅ Événement supprimé avec succès:', { eventId: id });

    res.json({
      success: true,
      message: 'Événement supprimé avec succès'
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la suppression de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'événement'
    });
  }
};

// Récupérer les événements par mois (pour le calendrier)
const getEventsByMonth = async (req, res) => {
  try {
    const { church_id, year, month } = req.query;

    if (!church_id || !year || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de l\'église, année et mois requis' 
      });
    }

    // Calculer le début et la fin du mois
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const events = await prisma.calendarEvent.findMany({
      where: {
        church_id,
        is_public: true,
        start_date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        church: {
          select: {
            nom: true,
            ville: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });

    logger.info('✅ Événements du mois récupérés avec succès');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des événements du mois:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements du mois'
    });
  }
};

module.exports = {
  getPublicEvents,
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByMonth
};
