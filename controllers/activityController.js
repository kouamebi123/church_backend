const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Récupérer l'historique des activités
exports.getActivityHistory = async (req, res) => {
  try {
    const { prisma } = req;
    const { 
      page = 1, 
      limit = 50, 
      action, 
      entity_type, 
      user_id,
      start_date,
      end_date 
    } = req.query;

    // Construire les filtres
    const where = {};
    
    if (action) {
      where.action = action;
    }
    
    if (entity_type) {
      where.entity_type = entity_type;
    }
    
    if (user_id) {
      where.user_id = user_id;
    }
    
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date);
      }
    }

    // Calculer l'offset pour la pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les activités avec l'utilisateur
    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: offset,
      take: parseInt(limit)
    });

    // Compter le total pour la pagination
    const total = await prisma.activityLog.count({ where });

    // Formater les données pour le frontend
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      user: activity.user.username || activity.user.pseudo,
      action: activity.action,
      entityType: activity.entity_type,
      entityName: activity.entity_name,
      details: activity.details,
      timestamp: activity.created_at,
      ipAddress: activity.ip_address,
      userAgent: activity.user_agent
    }));

    res.json({
      success: true,
      data: formattedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Erreur getActivityHistory', error);
    handleError(res, error, 'Erreur lors de la récupération de l\'historique des activités');
  }
};

// Récupérer les statistiques des activités
exports.getActivityStats = async (req, res) => {
  try {
    const { prisma } = req;
    const { start_date, end_date } = req.query;

    // Construire les filtres de date
    const where = {};
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date);
      }
    }

    // Statistiques par action
    const actionStats = await prisma.activityLog.groupBy({
      by: ['action'],
      where,
      _count: {
        action: true
      }
    });

    // Statistiques par entité
    const entityStats = await prisma.activityLog.groupBy({
      by: ['entity_type'],
      where,
      _count: {
        entity_type: true
      }
    });

    // Statistiques par utilisateur (top 10)
    const userStats = await prisma.activityLog.groupBy({
      by: ['user_id'],
      where,
      _count: {
        user_id: true
      },
      orderBy: {
        _count: {
          user_id: 'desc'
        }
      },
      take: 10
    });

    // Récupérer les noms des utilisateurs
    const userIds = userStats.map(stat => stat.user_id);
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        username: true,
        pseudo: true
      }
    });

    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user.username || user.pseudo;
      return acc;
    }, {});

    const formattedUserStats = userStats.map(stat => ({
      userId: stat.user_id,
      userName: userMap[stat.user_id] || 'Utilisateur inconnu',
      count: stat._count.user_id
    }));

    res.json({
      success: true,
      data: {
        actionStats: actionStats.map(stat => ({
          action: stat.action,
          count: stat._count.action
        })),
        entityStats: entityStats.map(stat => ({
          entityType: stat.entity_type,
          count: stat._count.entity_type
        })),
        userStats: formattedUserStats,
        total: await prisma.activityLog.count({ where })
      }
    });

  } catch (error) {
    logger.error('Erreur getActivityStats', error);
    handleError(res, error, 'Erreur lors de la récupération des statistiques des activités');
  }
};

// Créer une entrée d'historique (utilisé par d'autres contrôleurs)
exports.createActivityLog = async (prisma, userId, action, entityType, entityId = null, entityName = null, details = null, req = null) => {
  try {
    const activityData = {
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details
    };

    // Ajouter les informations de requête si disponibles
    if (req) {
      activityData.ip_address = req.ip || req.connection?.remoteAddress;
      activityData.user_agent = req.get('User-Agent');
    }

    await prisma.activityLog.create({
      data: activityData
    });

    logger.info('Activity log created', {
      userId,
      action,
      entityType,
      entityId,
      entityName
    });

  } catch (error) {
    logger.error('Erreur createActivityLog', error);
    // Ne pas faire échouer l'opération principale si l'historique échoue
  }
};

// Enregistrer une activité (endpoint public)
exports.logActivity = async (req, res) => {
  try {
    const { prisma } = req;
    const { action, entity_type, entity_id, entity_name, details } = req.body;
    const userId = req.user.id;

    // Validation des données
    if (!action || !entity_type) {
      return res.status(400).json({
        success: false,
        message: 'Action et entity_type sont requis'
      });
    }

    // Enregistrer l'activité
    await exports.createActivityLog(prisma, userId, action, entity_type, entity_id, entity_name, details, req);

    res.status(201).json({
      success: true,
      message: 'Activité enregistrée avec succès'
    });
  } catch (error) {
    logger.error('Erreur lors de l\'enregistrement de l\'activité:', error);
    handleError(res, error, 'Erreur lors de l\'enregistrement de l\'activité');
  }
};
