const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('🔧 Vérification des migrations échouées...');
    
    // Vérifier si la migration a échoué
    const failedMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs' 
      AND finished_at IS NULL
    `;
    
    if (failedMigration && failedMigration.length > 0) {
      console.log('⚠️  Migration échouée détectée, suppression...');
      
      // Supprimer la migration échouée
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs' 
        AND finished_at IS NULL
      `;
      
      console.log('✅ Migration échouée supprimée');
    } else {
      console.log('✅ Aucune migration échouée détectée');
    }
    
    console.log('🚀 Application des nouvelles migrations...');
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la résolution de la migration:', error);
    // Ne pas faire échouer le démarrage du serveur
    console.log('⚠️  Continuer malgré l\'erreur...');
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration().catch(console.error);

