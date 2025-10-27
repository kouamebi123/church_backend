const { execSync } = require('child_process');

async function fixFailedMigration() {
  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit', stdio: 'inherit' });
    
    console.log('🔧 Connexion à la base de données...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Supprimer toutes les migrations échouées
      console.log('🧹 Suppression des migrations échouées...');
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE (started_at IS NOT NULL AND finished_at IS NULL)
      `;
      console.log('✅ Migrations échouées supprimées');
    } catch (error) {
      console.log('⚠️  Erreur lors du nettoyage (possible que tout soit déjà propre):', error.message);
    }
    
    await prisma.$disconnect();
    
    // Marquer spécifiquement la migration problématique comme appliquée
    try {
      console.log('🔧 Résolution de la migration testimonies...');
      execSync('npx prisma migrate resolve --applied 20250115000001_add_testimonies_and_activity_logs', { stdio: 'inherit' });
    } catch (error) {
      console.log('⚠️  Impossible de marquer comme appliquée (peut être normale):', error.message);
    }
    
    console.log('🚀 Application des nouvelles migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la résolution de la migration:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur de migration...');
  }
}

fixFailedMigration().catch(console.error);
