const prisma = require('../config/dbPostgres');
const logger = require('../utils/logger');

// Obtenir les événements publics
const getPublicEvents = async (req, res) => {
  try {
    const { church_id, month, year } = req.query;
    
    let whereClause = {
      is_public: true
    };
    
    if (church_id) {
      whereClause.church_id = church_id;
    }
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      whereClause.start_date = {
        gte: startDate,
        lte: endDate
      };
    }
    
    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        },
        created_by: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
    }
    });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des événements publics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Obtenir les événements par mois (public)
const getEventsByMonth = async (req, res) => {
  try {
    const { church_id, month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Mois et année requis'
      });
    }
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    let whereClause = {
      is_public: true,
      start_date: {
        gte: startDate,
        lte: endDate
      }
    };
    
    if (church_id) {
      whereClause.church_id = church_id;
    }
    
    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des événements par mois:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Obtenir un événement par ID (public)
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        },
        created_by: {
          select: {
            id: true,
            firstName: true,
            lastName: true
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
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'événement'
    });
  }
};

// Obtenir tous les événements (admin)
const getAllEvents = async (req, res) => {
  try {
    const { church_id } = req.query;
    
    let whereClause = {};
    
    if (church_id) {
      whereClause.church_id = church_id;
    }
    
    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        },
        created_by: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        start_date: 'asc'
      }
    });
    
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des événements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des événements'
    });
  }
};

// Créer un événement (admin)
const createEvent = async (req, res) => {
  try {
    const { title, description, start_date, end_date, location, event_type, is_public, church_id } = req.body;
    
    if (!title || !start_date || !church_id) {
      return res.status(400).json({
        success: false,
        message: 'Titre, date de début et église requis'
      });
    }
    
    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        location,
        event_type: event_type || 'GENERAL',
        is_public: is_public !== false,
        church_id,
        created_by_id: req.user.id
      },
      include: {
        church: {
          select: {
            id: true,
            name: true
          }
        },
        created_by: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      data: event,
      message: 'Événement créé avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la création de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'événement'
    });
  }
};

// Mettre à jour un événement (admin)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_date, end_date, location, event_type, is_public } = req.body;
    
    const event = await prisma.calendarEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }
    
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
            id: true,
            name: true
          }
        },
        created_by: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: updatedEvent,
      message: 'Événement mis à jour avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'événement'
    });
  }
};

// Supprimer un événement (admin)
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.calendarEvent.findUnique({
      where: { id }
    });
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Événement non trouvé'
      });
    }
    
    await prisma.calendarEvent.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Événement supprimé avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de la suppression de l\'événement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'événement'
    });
  }
};

module.exports = {
  getPublicEvents,
  getEventsByMonth,
  getEventById,
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent
};