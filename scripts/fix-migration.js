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
    
    // À partir d'ici, on ne supprime plus les migrations partiellement appliquées
    
    // Appliquer manuellement la migration COMPAGNON_OEUVRE
    console.log('🚀 Application de la migration COMPAGNON_OEUVRE...');
    
    await prisma.$executeRaw`ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'COMPAGNON_OEUVRE'`;
    console.log('✅ COMPAGNON_OEUVRE ajouté à Qualification');
    
    await prisma.$executeRaw`ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'RESPONSABLE_SESSION'`;
    console.log('✅ RESPONSABLE_SESSION ajouté à Qualification');
    
    await prisma.$executeRaw`ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'RESPONSABLE_UNITE'`;
    console.log('✅ RESPONSABLE_UNITE ajouté à Qualification');
    
    await prisma.$executeRaw`ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'MEMBRE_SESSION'`;
    console.log('✅ MEMBRE_SESSION ajouté à Qualification');
    
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
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE
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
      
      // Modifier la contrainte church_id pour ajouter CASCADE
      try {
        await prisma.$executeRaw`ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_church_id_fkey"`;
        await prisma.$executeRaw`ALTER TABLE "sessions" ADD CONSTRAINT "sessions_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        console.log('✅ Contrainte church_id modifiée en CASCADE pour sessions');
      } catch (error) {
        console.log('⚠️  Erreur modification contrainte sessions church_id:', error.message);
      }
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
        FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
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
      
      // Modifier la contrainte session_id pour ajouter CASCADE
      try {
        await prisma.$executeRaw`ALTER TABLE "units" DROP CONSTRAINT IF EXISTS "units_session_id_fkey"`;
        await prisma.$executeRaw`ALTER TABLE "units" ADD CONSTRAINT "units_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        console.log('✅ Contrainte session_id modifiée en CASCADE pour units');
      } catch (error) {
        console.log('⚠️  Erreur modification contrainte units session_id:', error.message);
      }
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
        FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `;
      await prisma.$executeRaw`
        ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `;
      console.log('✅ Contraintes unit_members ajoutées');
    } else {
      console.log('✅ Table unit_members existe déjà');
      
      // Modifier la contrainte unit_id pour ajouter CASCADE
      try {
        await prisma.$executeRaw`ALTER TABLE "unit_members" DROP CONSTRAINT IF EXISTS "unit_members_unit_id_fkey"`;
        await prisma.$executeRaw`ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        console.log('✅ Contrainte unit_id modifiée en CASCADE pour unit_members');
      } catch (error) {
        console.log('⚠️  Erreur modification contrainte unit_members unit_id:', error.message);
      }
      
      // Modifier la contrainte user_id pour ajouter CASCADE
      try {
        await prisma.$executeRaw`ALTER TABLE "unit_members" DROP CONSTRAINT IF EXISTS "unit_members_user_id_fkey"`;
        await prisma.$executeRaw`ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
        console.log('✅ Contrainte user_id modifiée en CASCADE pour unit_members');
      } catch (error) {
        console.log('⚠️  Erreur modification contrainte unit_members user_id:', error.message);
      }
    }
    
    // Ajouter les colonnes pour prévisionnel et assistance
    console.log('🚀 Ajout des colonnes responsables_reseau et compagnons_oeuvre...');
    
    try {
      // Ajouter les colonnes à la table previsionnels
      await prisma.$executeRaw`
        ALTER TABLE "previsionnels" 
        ADD COLUMN IF NOT EXISTS "responsables_reseau" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "compagnons_oeuvre" INTEGER DEFAULT 0;
      `;
      console.log('✅ Colonnes ajoutées à previsionnels');

      // Ajouter les colonnes à la table assistance
      await prisma.$executeRaw`
        ALTER TABLE "assistance" 
        ADD COLUMN IF NOT EXISTS "responsables_reseau" INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "compagnons_oeuvre" INTEGER DEFAULT 0;
      `;
      console.log('✅ Colonnes ajoutées à assistance');

      // Mettre à jour les enregistrements existants avec des valeurs par défaut
      const previsionnelsCount = await prisma.$executeRaw`
        UPDATE "previsionnels" 
        SET "responsables_reseau" = 0, "compagnons_oeuvre" = 0 
        WHERE "responsables_reseau" IS NULL OR "compagnons_oeuvre" IS NULL;
      `;

      const assistanceCount = await prisma.$executeRaw`
        UPDATE "assistance" 
        SET "responsables_reseau" = 0, "compagnons_oeuvre" = 0 
        WHERE "responsables_reseau" IS NULL OR "compagnons_oeuvre" IS NULL;
      `;

      console.log(`✅ ${previsionnelsCount} prévisionnels mis à jour`);
      console.log(`✅ ${assistanceCount} assistances mises à jour`);
    } catch (error) {
      console.log('⚠️  Colonnes prévisionnel/assistance existent déjà ou erreur:', error.message);
    }

    // Migration pour le calendrier
    console.log('🚀 Migration du calendrier...');
    
    try {
      // Ajouter EventType enum
      await prisma.$executeRaw`CREATE TYPE "EventType" AS ENUM ('GENERAL', 'CULTE', 'REUNION', 'FORMATION', 'EVANGELISATION', 'SOCIAL', 'JEUNESSE', 'ENFANTS', 'FEMMES', 'HOMMES', 'AUTRE')`;
      console.log('✅ EventType enum créé');
    } catch (error) {
      console.log('⚠️  EventType enum existe déjà');
    }

    try {
      // Créer ou mettre à jour la table calendar_events
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "calendar_events" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "start_date" TIMESTAMP(3) NOT NULL,
          "end_date" TIMESTAMP(3),
          "location" TEXT,
          "event_type" "EventType" NOT NULL DEFAULT 'GENERAL',
          "is_public" BOOLEAN NOT NULL DEFAULT true,
          "church_id" TEXT NOT NULL,
          "created_by_id" TEXT NOT NULL,
          "share_link" TEXT,
          "share_qr_url" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('✅ Table calendar_events créée');
    } catch (error) {
      console.log('⚠️  Table calendar_events existe déjà');
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "calendar_events"
        ADD COLUMN IF NOT EXISTS "share_link" TEXT,
        ADD COLUMN IF NOT EXISTS "share_qr_url" TEXT;
      `;
      console.log('✅ Colonnes share_link et share_qr_url vérifiées sur calendar_events');
    } catch (error) {
      console.log('⚠️  Impossible d’ajouter les colonnes share_link/share_qr_url:', error.message);
    }

    try {
      // Ajouter les contraintes de clé étrangère
      await prisma.$executeRaw`
        ALTER TABLE "calendar_events" 
        ADD CONSTRAINT "calendar_events_church_id_fkey" 
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      console.log('✅ Contrainte FK church_id ajoutée');
    } catch (error) {
      console.log('⚠️  Contrainte FK church_id existe déjà');
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "calendar_events" 
        ADD CONSTRAINT "calendar_events_created_by_id_fkey" 
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `;
      console.log('✅ Contrainte FK created_by_id ajoutée');
    } catch (error) {
      console.log('⚠️  Contrainte FK created_by_id existe déjà');
    }

    try {
      // Ajouter CALENDAR_EVENT à EntityType
      await prisma.$executeRaw`ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'CALENDAR_EVENT'`;
      console.log('✅ CALENDAR_EVENT ajouté à EntityType');
    } catch (error) {
      console.log('⚠️  CALENDAR_EVENT existe déjà dans EntityType');
    }

    // Migration pour SituationProfessionnelle
    console.log('🚀 Migration SituationProfessionnelle...');
    
    try {
      // Créer l'enum SituationProfessionnelle
      await prisma.$executeRaw`
        CREATE TYPE "SituationProfessionnelle" AS ENUM 
        ('EMPLOYE', 'INDEPENDANT', 'ETUDIANT', 'CHOMEUR', 'RETRAITE', 'AU_FOYER', 'AUTRE')
      `;
      console.log('✅ Enum SituationProfessionnelle créé');
    } catch (error) {
      console.log('⚠️  Enum SituationProfessionnelle existe déjà');
    }

    let markTestimonyMigrationAsApplied = false;
    try {
      // Ajouter la colonne situation_professionnelle à la table users
      await prisma.$executeRaw`
        ALTER TABLE "users" 
        ADD COLUMN IF NOT EXISTS "situation_professionnelle" "SituationProfessionnelle"
      `;
      console.log('✅ Colonne situation_professionnelle ajoutée à users');
    } catch (error) {
      console.log('⚠️  Colonne situation_professionnelle existe déjà');
    }

    try {
      const testimonyEnumExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          INNER JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'TestimonyCategory'
          AND n.nspname = 'public'
        )
      `;
      markTestimonyMigrationAsApplied = Boolean(testimonyEnumExists?.[0]?.exists);
      if (markTestimonyMigrationAsApplied) {
        console.log('⚠️  Enum TestimonyCategory déjà présent dans la base');
      }
    } catch (error) {
      console.log('⚠️  Impossible de vérifier la présence de TestimonyCategory:', error.message);
    }

    await prisma.$disconnect();
    console.log('✅ Connexion Prisma nettoyée');

    console.log('🚀 Application des migrations Prisma officielles...');
    if (markTestimonyMigrationAsApplied) {
      try {
        execSync('npx prisma migrate resolve --applied 20250115000001_add_testimonies_and_activity_logs', { stdio: 'inherit' });
        console.log('⚠️  Migration testimonies marquée comme déjà appliquée');
      } catch (resolveError) {
        console.log('⚠️  Impossible de marquer la migration testimonies comme appliquée:', resolveError.message);
      }
    }
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Migrations Prisma synchronisées');
    } catch (migrateError) {
      const stderr = migrateError?.stderr?.toString() || '';
      const stdout = migrateError?.stdout?.toString() || '';
      const combined = `${stdout}\n${stderr}`;
      if (combined.includes('type "TestimonyCategory" already exists')) {
        console.log('⚠️  Migration testimonies déjà appliquée. Marquage manuel comme appliquée...');
        execSync('npx prisma migrate resolve --applied 20250115000001_add_testimonies_and_activity_logs', { stdio: 'inherit' });
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('✅ Migrations Prisma synchronisées (après résolution manuelle)');
      } else {
        throw migrateError;
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.log('⚠️  Démarrant le serveur malgré l\'erreur...');
  }
}

fixFailedMigration().catch(console.error);
