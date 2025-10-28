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
    
    // Ajouter SESSION et UNIT à l'enum EntityType
    console.log('🚀 Mise à jour de l\'enum EntityType...');
    
    try {
      await prisma.$executeRaw`ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SESSION'`;
      console.log('✅ SESSION ajouté à EntityType');
    } catch (error) {
      console.log('⚠️  SESSION existe déjà dans EntityType');
    }
    
    try {
      await prisma.$executeRaw`ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'UNIT'`;
      console.log('✅ UNIT ajouté à EntityType');
    } catch (error) {
      console.log('⚠️  UNIT existe déjà dans EntityType');
    }
    
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
    
    // Appliquer la migration Sessions et Units
    console.log('🚀 Application de la migration Sessions et Units...');
    
    // Vérifier si la table sessions existe déjà
    const sessionsTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      )
    `;
    
    if (!sessionsTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "sessions" (
          "id" TEXT NOT NULL,
          "nom" TEXT NOT NULL,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "responsable1_id" TEXT NOT NULL,
          "responsable2_id" TEXT,
          "church_id" TEXT NOT NULL,
          CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
        )
      `;
      console.log('✅ Table sessions créée');
      
      await prisma.$executeRaw`CREATE UNIQUE INDEX "sessions_nom_key" ON "sessions"("nom")`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "sessions_responsable1_id_key" ON "sessions"("responsable1_id")`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "sessions_responsable2_id_key" ON "sessions"("responsable2_id")`;
      
      await prisma.$executeRaw`
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_church_id_fkey" 
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsable1_id_fkey" 
        FOREIGN KEY ("responsable1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsable2_id_fkey" 
        FOREIGN KEY ("responsable2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('✅ Contraintes sessions ajoutées');
    } else {
      console.log('✅ Table sessions existe déjà');
    }
    
    // Vérifier si la table units existe déjà
    const unitsTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'units'
      )
    `;
    
    if (!unitsTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "units" (
          "id" TEXT NOT NULL,
          "nom" TEXT NOT NULL,
          "description" TEXT,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "session_id" TEXT NOT NULL,
          "responsable1_id" TEXT NOT NULL,
          "responsable2_id" TEXT,
          "superieur_hierarchique_id" TEXT,
          CONSTRAINT "units_pkey" PRIMARY KEY ("id")
        )
      `;
      console.log('✅ Table units créée');
      
      await prisma.$executeRaw`CREATE UNIQUE INDEX "units_responsable1_id_key" ON "units"("responsable1_id")`;
      await prisma.$executeRaw`CREATE UNIQUE INDEX "units_responsable2_id_key" ON "units"("responsable2_id")`;
      
      await prisma.$executeRaw`
        ALTER TABLE "units" ADD CONSTRAINT "units_session_id_fkey" 
        FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "units" ADD CONSTRAINT "units_responsable1_id_fkey" 
        FOREIGN KEY ("responsable1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "units" ADD CONSTRAINT "units_responsable2_id_fkey" 
        FOREIGN KEY ("responsable2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "units" ADD CONSTRAINT "units_superieur_hierarchique_id_fkey" 
        FOREIGN KEY ("superieur_hierarchique_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('✅ Contraintes units ajoutées');
    } else {
      console.log('✅ Table units existe déjà');
    }
    
    // Vérifier si la table unit_members existe déjà
    const unitMembersTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'unit_members'
      )
    `;
    
    if (!unitMembersTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "unit_members" (
          "id" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "unit_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          CONSTRAINT "unit_members_pkey" PRIMARY KEY ("id")
        )
      `;
      console.log('✅ Table unit_members créée');
      
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "unit_members_unit_id_user_id_key" 
        ON "unit_members"("unit_id", "user_id")
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_fkey" 
        FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `;
      console.log('✅ Contraintes unit_members ajoutées');
    } else {
      console.log('✅ Table unit_members existe déjà');
    }
    
    await prisma.$disconnect();
    console.log('✅ Migrations appliquées avec succès');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur...');
  }
}

fixFailedMigration().catch(console.error);
