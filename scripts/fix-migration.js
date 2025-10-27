const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function fixFailedMigration() {
  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('🔧 Connexion à la base de données...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Supprimer toutes les migrations échouées ou en attente
      console.log('🧹 Nettoyage des migrations échouées...');
      const deleteResult = await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE (started_at IS NOT NULL AND finished_at IS NULL)
      `;
      console.log(`✅ ${deleteResult} migrations supprimées`);
    } catch (error) {
      console.log('⚠️  Pas de migration en attente à nettoyer');
    }
    
    // Appliquer manuellement la migration COMPAGNON_OEUVRE
    console.log('🚀 Application de la migration COMPAGNON_OEUVRE...');
    
    await prisma.$executeRaw`ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'COMPAGNON_OEUVRE'`;
    console.log('✅ Enum Qualification mis à jour');
    
    // Vérifier si la table existe déjà
    const tableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'network_companions'
      )
    `;
    
    if (!tableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "network_companions" (
          "id" TEXT NOT NULL,
          "network_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "network_companions_pkey" PRIMARY KEY ("id")
        )
      `;
      console.log('✅ Table network_companions créée');
      
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "network_companions_network_id_user_id_key" 
        ON "network_companions"("network_id", "user_id")
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "network_companions" 
        ADD CONSTRAINT "network_companions_network_id_fkey" 
        FOREIGN KEY ("network_id") REFERENCES "networks"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "network_companions" 
        ADD CONSTRAINT "network_companions_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `;
      console.log('✅ Contraintes ajoutées');
    } else {
      console.log('✅ Table network_companions existe déjà');
    }
    
    await prisma.$disconnect();
    console.log('✅ Migration COMPAGNON_OEUVRE appliquée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur...');
  }
}

fixFailedMigration().catch(console.error);
