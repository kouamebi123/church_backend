const { execSync } = require('child_process');

async function fixFailedMigration() {
  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('🔧 Nettoyage des migrations échouées...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Vérifier et supprimer la migration échouée
    const failedMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs' 
      AND finished_at IS NULL
    `;
    
    if (failedMigration && failedMigration.length > 0) {
      console.log('⚠️  Migration échouée détectée, suppression...');
      
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs' 
        AND finished_at IS NULL
      `;
      
      console.log('✅ Migration échouée supprimée');
    } else {
      console.log('✅ Aucune migration échouée détectée');
    }
    
    await prisma.$disconnect();
    
    console.log('🚀 Application des migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la résolution de la migration:', error.message);
    // Ne pas faire échouer le démarrage du serveur
    console.log('⚠️  Démarrant le serveur malgré l\'erreur de migration...');
  }
}

fixFailedMigration().catch(console.error);

