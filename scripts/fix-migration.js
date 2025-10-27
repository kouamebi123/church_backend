const { execSync } = require('child_process');

async function fixFailedMigration() {
  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('🔧 Connexion à la base de données pour nettoyer les migrations...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Supprimer toutes les migrations échouées ou en attente
    console.log('🧹 Suppression des migrations échouées ou en attente...');
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE (started_at IS NOT NULL AND finished_at IS NULL)
    `;
    console.log(`✅ ${deleteResult} migrations en attente supprimées`);
    
    await prisma.$disconnect();
    
    console.log('🚀 Application des nouvelles migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la résolution des migrations:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur de migration...');
    // Ne pas faire échouer le démarrage
  }
}

fixFailedMigration().catch(console.error);
