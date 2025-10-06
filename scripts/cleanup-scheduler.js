#!/usr/bin/env node

/**
 * Planificateur de nettoyage des logs d'activité
 * Exécute le nettoyage tous les jours à 2h du matin
 * Alternative à cron pour les conteneurs Docker
 */

const { cleanupActivityLogs } = require('./cleanup-activity-logs');
const logger = require('../utils/logger');

class CleanupScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  start() {
    if (this.isRunning) {
      logger.warn('⚠️ [SCHEDULER] Le planificateur est déjà en cours d\'exécution');
      return;
    }

    logger.info('🚀 [SCHEDULER] Démarrage du planificateur de nettoyage');
    
    // Vérifier toutes les minutes si c'est l'heure du nettoyage
    this.intervalId = setInterval(() => {
      this.checkAndRunCleanup();
    }, 60000); // Vérifier toutes les minutes

    this.isRunning = true;
    logger.info('✅ [SCHEDULER] Planificateur démarré - vérification toutes les minutes');
  }

  stop() {
    if (!this.isRunning) {
      logger.warn('⚠️ [SCHEDULER] Le planificateur n\'est pas en cours d\'exécution');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('🛑 [SCHEDULER] Planificateur arrêté');
  }

  checkAndRunCleanup() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Exécuter le nettoyage à 2h du matin (2:00)
    if (hour === 2 && minute === 0) {
      logger.info('⏰ [SCHEDULER] Heure du nettoyage atteinte - exécution du nettoyage');
      this.runCleanup();
    }
  }

  async runCleanup() {
    try {
      logger.info('🧹 [SCHEDULER] Début du nettoyage programmé');
      await cleanupActivityLogs();
      logger.info('✅ [SCHEDULER] Nettoyage programmé terminé avec succès');
    } catch (error) {
      logger.error('❌ [SCHEDULER] Erreur lors du nettoyage programmé:', error);
    }
  }

  // Méthode pour tester le nettoyage immédiatement
  async testCleanup() {
    logger.info('🧪 [SCHEDULER] Test du nettoyage immédiat');
    await this.runCleanup();
  }
}

// Créer une instance globale
const scheduler = new CleanupScheduler();

// Démarrer le planificateur si le script est exécuté directement
if (require.main === module) {
  logger.info('🚀 [SCHEDULER] Démarrage du planificateur de nettoyage autonome');
  
  // Démarrer le planificateur
  scheduler.start();
  
  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    logger.info('🛑 [SCHEDULER] Arrêt du planificateur...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('🛑 [SCHEDULER] Arrêt du planificateur...');
    scheduler.stop();
    process.exit(0);
  });

  // Garder le processus en vie
  setInterval(() => {
    // Vérifier que le planificateur fonctionne toujours
    if (!scheduler.isRunning) {
      logger.error('❌ [SCHEDULER] Le planificateur s\'est arrêté inattenduement');
      process.exit(1);
    }
  }, 300000); // Vérifier toutes les 5 minutes
}

module.exports = { CleanupScheduler, scheduler };
