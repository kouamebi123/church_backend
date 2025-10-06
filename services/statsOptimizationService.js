const redisService = require('./redisService');
//const logger = require('../utils/logger');

class StatsOptimizationService {
  constructor() {
    this.cachePrefix = 'stats_optimized';
    this.defaultTTL = 600; // 10 minutes
  }

  /**
   * Récupère les statistiques avec cache intelligent
   */
  async getCachedStats(churchId, statsType, fetchFunction, ttl = this.defaultTTL) {
    const cacheKey = `${this.cachePrefix}:${churchId}:${statsType}`;
    
    try {
      // Essayer de récupérer depuis le cache
      const cachedData = await redisService.getCachedData(cacheKey);
      
      if (cachedData) {
        //logger.debug(`Stats cache hit for ${statsType} in church ${churchId}`);
        return {
          ...cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      // Si pas de cache, exécuter la fonction de récupération
      const data = await fetchFunction();
      
      // Mettre en cache le résultat
      await redisService.cacheData(cacheKey, data, ttl);
      
      //logger.debug(`Stats cached for ${statsType} in church ${churchId}`);
      
      return {
        ...data,
        cached: false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      //logger.error(`Error getting cached stats for ${statsType}:`, error);
      throw error;
    }
  }

  /**
   * Invalide le cache des statistiques
   */
  async invalidateStatsCache(churchId, statsType = null) {
    try {
      const pattern = statsType 
        ? `${this.cachePrefix}:${churchId}:${statsType}`
        : `${this.cachePrefix}:${churchId}:*`;
      
      await redisService.invalidateData(pattern);
      //logger.info(`Stats cache invalidated for church ${churchId}, type: ${statsType || 'all'}`);
    } catch (error) {
      //logger.error('Error invalidating stats cache:', error);
    }
  }

  /**
   * Récupère les statistiques en batch pour optimiser les requêtes
   */
  async getBatchStats(churchId, statsTypes, prisma) {
    const cacheKey = `${this.cachePrefix}:${churchId}:batch`;
    
    try {
      // Vérifier le cache batch
      const cachedData = await redisService.getCachedData(cacheKey);
      
      if (cachedData) {
        //logger.debug(`Batch stats cache hit for church ${churchId}`);
        return {
          ...cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      // Exécuter toutes les requêtes en parallèle
      const statsPromises = statsTypes.map(async (type) => {
        switch (type) {
          case 'users':
            return this.getUsersStats(churchId, prisma);
          case 'networks':
            return this.getNetworksStats(churchId, prisma);
          case 'services':
            return this.getServicesStats(churchId, prisma);
          case 'assistance':
            return this.getAssistanceStats(churchId, prisma);
          case 'previsionnel':
            return this.getPrevisionnelStats(churchId, prisma);
          default:
            return { [type]: null };
        }
      });

      const results = await Promise.all(statsPromises);
      
      // Combiner les résultats
      const combinedStats = results.reduce((acc, result) => {
        return { ...acc, ...result };
      }, {});

      // Mettre en cache le résultat combiné
      await redisService.cacheData(cacheKey, combinedStats, this.defaultTTL);
      
      //logger.debug(`Batch stats cached for church ${churchId}`);
      
      return {
        ...combinedStats,
        cached: false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      //logger.error(`Error getting batch stats for church ${churchId}:`, error);
      throw error;
    }
  }

  /**
   * Statistiques des utilisateurs optimisées
   */
  async getUsersStats(churchId, prisma) {
    const whereClause = churchId ? { eglise_locale_id: churchId } : {};
    
    const [
      totalUsers,
      activeUsers,
      roleDistribution,
      qualificationDistribution,
      genreDistribution
    ] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.count({ 
        where: { 
          ...whereClause,
          qualification: { not: 'RETIRE' }
        } 
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: whereClause,
        _count: { role: true }
      }),
      prisma.user.groupBy({
        by: ['qualification'],
        where: whereClause,
        _count: { qualification: true }
      }),
      prisma.user.groupBy({
        by: ['genre'],
        where: whereClause,
        _count: { genre: true }
      })
    ]);

    return {
      totalUsers,
      activeUsers,
      roleDistribution: roleDistribution.reduce((acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {}),
      qualificationDistribution: qualificationDistribution.reduce((acc, item) => {
        acc[item.qualification] = item._count.qualification;
        return acc;
      }, {}),
      genreDistribution: genreDistribution.reduce((acc, item) => {
        acc[item.genre] = item._count.genre;
        return acc;
      }, {})
    };
  }

  /**
   * Statistiques des réseaux optimisées
   */
  async getNetworksStats(churchId, prisma) {
    const whereClause = churchId ? { church_id: churchId } : {};
    
    const [
      totalNetworks,
      activeNetworks,
      networksWithMembers
    ] = await Promise.all([
      prisma.network.count({ where: whereClause }),
      prisma.network.count({ 
        where: { 
          ...whereClause,
          active: true 
        } 
      }),
      prisma.network.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { groups: true }
          }
        }
      })
    ]);

    return {
      totalNetworks,
      activeNetworks,
      networksWithMembers: networksWithMembers.filter(n => n._count.groups > 0).length
    };
  }

  /**
   * Statistiques des services optimisées
   */
  async getServicesStats(churchId, prisma) {
    const whereClause = churchId ? { church_id: churchId } : {};
    
    const [
      totalServices,
      servicesThisMonth,
      servicesByType
    ] = await Promise.all([
      prisma.service.count({ where: whereClause }),
      prisma.service.count({
        where: {
          ...whereClause,
          date_service: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.service.groupBy({
        by: ['type_service'],
        where: whereClause,
        _count: { type_service: true }
      })
    ]);

    return {
      totalServices,
      servicesThisMonth,
      servicesByType: servicesByType.reduce((acc, item) => {
        acc[item.type_service] = item._count.type_service;
        return acc;
      }, {})
    };
  }

  /**
   * Statistiques d'assistance optimisées
   */
  async getAssistanceStats(churchId, prisma) {
    const whereClause = churchId ? { church_id: churchId } : {};
    
    const [
      totalAssistance,
      assistanceThisMonth,
      assistanceByType
    ] = await Promise.all([
      prisma.assistance.count({ where: whereClause }),
      prisma.assistance.count({
        where: {
          ...whereClause,
          date_assistance: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.assistance.groupBy({
        by: ['type_assistance'],
        where: whereClause,
        _count: { type_assistance: true }
      })
    ]);

    return {
      totalAssistance,
      assistanceThisMonth,
      assistanceByType: assistanceByType.reduce((acc, item) => {
        acc[item.type_assistance] = item._count.type_assistance;
        return acc;
      }, {})
    };
  }

  /**
   * Statistiques prévisionnelles optimisées
   */
  async getPrevisionnelStats(churchId, prisma) {
    const whereClause = churchId ? { church_id: churchId } : {};
    
    const [
      totalPrevisionnels,
      previsionsThisYear,
      previsionsByStatus
    ] = await Promise.all([
      prisma.previsionnel.count({ where: whereClause }),
      prisma.previsionnel.count({
        where: {
          ...whereClause,
          annee: new Date().getFullYear()
        }
      }),
      prisma.previsionnel.groupBy({
        by: ['statut'],
        where: whereClause,
        _count: { statut: true }
      })
    ]);

    return {
      totalPrevisionnels,
      previsionsThisYear,
      previsionsByStatus: previsionsByStatus.reduce((acc, item) => {
        acc[item.statut] = item._count.statut;
        return acc;
      }, {})
    };
  }

  /**
   * Préchauffe le cache avec les statistiques les plus utilisées
   */
  async warmupCache(churchId, prisma) {
    try {
      const statsTypes = ['users', 'networks', 'services', 'assistance', 'previsionnel'];
      await this.getBatchStats(churchId, statsTypes, prisma);
      //logger.info(`Cache warmed up for church ${churchId}`);
    } catch (error) {
      //logger.error(`Error warming up cache for church ${churchId}:`, error);
    }
  }
}

// Instance singleton
const statsOptimizationService = new StatsOptimizationService();

module.exports = statsOptimizationService;
