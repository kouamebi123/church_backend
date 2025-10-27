const { execSync } = require('child_process');

async function fixFailedMigration() {
  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('🔧 Connexion à la base de données pour nettoyer les migrations échouées...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Supprimer TOUTES les migrations échouées ou en attente
    console.log('🧹 Suppression des migrations en échec...');
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE finished_at IS NULL OR (started_at IS NOT NULL AND finished_at IS NULL)
    `;
    
    console.log(`✅ ${result} migrations échouées supprimées`);
    
    await prisma.$disconnect();
    
    console.log('🚀 Application des migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la résolution de la migration:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur de migration...');
  }
}

fixFailedMigration().catch(console.error);
