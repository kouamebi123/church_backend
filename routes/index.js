const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Middleware de logging pour toutes les requêtes
router.use((req, res, next) => {
  logger.info(`📡 ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Importer les routes
const authRoutes = require('./auth');
const userRoutes = require('./users');
const networkRoutes = require('./networks');
const groupRoutes = require('./groups');
const churchRoutes = require('./churches');
const departmentRoutes = require('./departments');
const serviceRoutes = require('./services');
const carouselRoutes = require('./carouselRoutes');
const statsRoutes = require('./stats');
const adminRoutes = require('./admin');
const previsionnelRoutes = require('./previsionnelRoutes');
const assistanceRoutes = require('./assistanceRoutes');
const chaineImpactRoutes = require('./chaineImpactRoutes');
const messageRoutes = require('./messageRoutes');
const emergencyRoutes = require('./emergency');
const roleRoutes = require('./roles');
const preferencesRoutes = require('./preferences');
const testimonyRoutes = require('./testimonyRoutes');
const activityRoutes = require('./activity');
const sessionRoutes = require('./sessions');
const unitRoutes = require('./units');
const calendarRoutes = require('./calendar');
const contactRoutes = require('./contact');
const appSettingsRoutes = require('./appSettings');
const referenceDataRoutes = require('./referenceData');

// Endpoint de sécurité
const securityLogger = require('../utils/securityLogger');


// Monter les routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/networks', networkRoutes);
router.use('/groups', groupRoutes);
router.use('/churches', churchRoutes);
router.use('/departments', departmentRoutes);
router.use('/services', serviceRoutes);
router.use('/carousel', carouselRoutes);
router.use('/stats', statsRoutes);
router.use('/admin', adminRoutes);
router.use('/previsionnels', previsionnelRoutes);
router.use('/assistance', assistanceRoutes);
router.use('/chaine-impact', chaineImpactRoutes);
router.use('/messages', messageRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/roles', roleRoutes);
router.use('/preferences', preferencesRoutes);
router.use('/testimonies', testimonyRoutes);
router.use('/activities', activityRoutes);
router.use('/sessions', sessionRoutes);
router.use('/units', unitRoutes);
router.use('/calendar', calendarRoutes);
router.use('/contact', contactRoutes);
router.use('/app-settings', appSettingsRoutes);
router.use('/reference-data', referenceDataRoutes);

// Endpoint de sécurité
router.get('/security/stats', (req, res) => {
  try {
    const securityStats = securityLogger.getSecurityStats();
    res.json({
      success: true,
      message: '🔒 Statistiques de sécurité',
      data: {
        security: securityStats,
        csrf: 'Supprimé',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Erreur lors de la récupération des statistiques de sécurité'
    });
  }
});

module.exports = router;
