#!/usr/bin/env node

/**
 * Script de nettoyage automatique des logs d'activité
 * Supprime les logs d'activité de plus de 1 mois
 * Exécuté quotidiennement à 2h du matin via cron
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function cleanupActivityLogs() {
  try {
    logger.info('🧹 [CLEANUP] Début du nettoyage des logs d\'activité...');
    
    // Calculer la date d'il y a 1 mois
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    logger.info(`🗓️ [CLEANUP] Suppression des logs antérieurs au ${oneMonthAgo.toISOString()}`);
    
    // Compter les logs à supprimer
    const logsToDelete = await prisma.activityLog.count({
      where: {
        created_at: {
          lt: oneMonthAgo
        }
      }
    });
    
    if (logsToDelete === 0) {
      logger.info('✅ [CLEANUP] Aucun log à supprimer');
      return;
    }
    
    logger.info(`📊 [CLEANUP] ${logsToDelete} logs d'activité à supprimer`);
    
    // Supprimer les logs anciens
    const deleteResult = await prisma.activityLog.deleteMany({
      where: {
        created_at: {
          lt: oneMonthAgo
        }
      }
    });
    
    logger.info(`✅ [CLEANUP] ${deleteResult.count} logs d'activité supprimés avec succès`);
    
    // Nettoyer aussi les logs d'erreur et de sécurité anciens
    await cleanupOldLogFiles();
    
    logger.info('🎉 [CLEANUP] Nettoyage terminé avec succès');
    
  } catch (error) {
    logger.error('❌ [CLEANUP] Erreur lors du nettoyage des logs d\'activité:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupOldLogFiles() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const logsDir = path.join(__dirname, '..', 'logs');
    
    // Vérifier si le dossier logs existe
    try {
      await fs.access(logsDir);
    } catch {
      logger.info('📁 [CLEANUP] Dossier logs non trouvé, ignoré');
      return;
    }
    
    const files = await fs.readdir(logsDir);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    let deletedFiles = 0;
    
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);
      
      // Supprimer les fichiers de logs de plus d'1 mois
      if (stats.mtime < oneMonthAgo && file.endsWith('.log')) {
        await fs.unlink(filePath);
        deletedFiles++;
        logger.info(`🗑️ [CLEANUP] Fichier de log supprimé: ${file}`);
      }
    }
    
    if (deletedFiles > 0) {
      logger.info(`📁 [CLEANUP] ${deletedFiles} fichiers de logs supprimés`);
    } else {
      logger.info('📁 [CLEANUP] Aucun fichier de log à supprimer');
    }
    
  } catch (error) {
    logger.error('❌ [CLEANUP] Erreur lors du nettoyage des fichiers de logs:', error);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  cleanupActivityLogs()
    .then(() => {
      logger.info('✅ [CLEANUP] Script de nettoyage terminé');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ [CLEANUP] Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { cleanupActivityLogs };
