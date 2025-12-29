const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIGRATION_TESTIMONIES_ACTIVITY = '20250115000001_add_testimonies_and_activity_logs';
const MIGRATION_TESTIMONIES_FILES = '20250115000001_add_testimonies_and_files';
const MIGRATION_CONTACT_MODEL = '20251112151048_add_contact_model';
const MIGRATION_APP_SETTINGS = '20251112152000_add_app_settings';

const migrationExists = (migrationName) => {
  const migrationsPath = path.join(__dirname, '..', 'prisma', 'migrations');
  const migrationPath = path.join(migrationsPath, migrationName);
  return fs.existsSync(migrationPath);
};

const runPrismaResolve = (migrationName, asRolledBack = false) => {
  // Vérifier si la migration existe avant d'essayer de la résoudre
  const exists = migrationExists(migrationName);
  
  if (!exists && !asRolledBack) {
    // Si la migration n'existe pas, on la marque comme rolled-back
    console.log(`ℹ️  Migration ${migrationName} n'existe pas, marquage comme rolled-back...`);
    try {
      const rollbackCommand = `npx prisma migrate resolve --rolled-back ${migrationName}`;
      execSync(rollbackCommand, { stdio: 'inherit', timeout: 30000 });
      console.log(`✅ Migration ${migrationName} marquée comme rolled-back`);
      return;
    } catch (rollbackError) {
      console.log(`⚠️  Impossible de marquer ${migrationName} comme rolled-back:`, rollbackError.message);
      return;
    }
  }

  const command = asRolledBack 
    ? `npx prisma migrate resolve --rolled-back ${migrationName}`
    : `npx prisma migrate resolve --applied ${migrationName}`;
  try {
    execSync(command, { stdio: 'inherit', timeout: 30000 });
    console.log(`✅ Migration ${migrationName} marquée comme ${asRolledBack ? 'rolled-back' : 'applied'}`);
  } catch (resolveError) {
    const output = `${resolveError?.stdout?.toString() || ''}${resolveError?.stderr?.toString() || ''}`;
    if (
      output.includes('already recorded as applied') ||
      output.includes('P3008') ||
      output.includes('could not be found') ||
      output.includes('P3017')
    ) {
      if (!asRolledBack && (output.includes('could not be found') || output.includes('P3017'))) {
        // Si la migration n'existe pas, essayer de la marquer comme rolled-back
        console.log(`🔄 Tentative de marquage comme rolled-back...`);
        runPrismaResolve(migrationName, true);
      } else {
        console.log(`ℹ️  Migration ${migrationName} est déjà enregistrée comme appliquée ou n'existe pas`);
      }
      return;
    }
    // Ne pas throw l'erreur, juste logger
    console.log(`⚠️  Erreur lors de la résolution de ${migrationName}: ${output}`);
  }
};

// Fonction pour extraire le nom de la migration depuis un message d'erreur P3009
const extractFailedMigrationName = (errorMessage) => {
  // Format: "The `20250115000001_add_testimonies_and_files` migration started at ... failed"
  const match = errorMessage.match(/The `([^`]+)` migration/);
  return match ? match[1] : null;
};

async function fixFailedMigration() {
  // Timeout de 5 minutes pour éviter que le script bloque indéfiniment
  const timeout = setTimeout(() => {
    console.error('❌ Timeout: Le script de migration prend trop de temps');
    process.exit(1);
  }, 5 * 60 * 1000); // 5 minutes

  try {
    console.log('🔧 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit', timeout: 60000 }); // 1 minute max pour generate
    
    console.log('🔧 Connexion à la base de données...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    let incompleteMigrations = [];
    let failedMigrations = [];
    try {
      // Récupérer toutes les migrations incomplètes/échouées
      const allProblematicMigrations = await prisma.$queryRaw`
        SELECT migration_name, started_at, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL
      `;
      
      incompleteMigrations = allProblematicMigrations;
      failedMigrations = allProblematicMigrations.filter((m) => m.started_at && !m.rolled_back_at);
      
      if (allProblematicMigrations.length > 0) {
        console.log('⚠️  Migrations problématiques détectées:', allProblematicMigrations.map((row) => row.migration_name));
        
        // Résoudre automatiquement TOUTES les migrations échouées/incomplètes
        console.log('🔧 Nettoyage automatique des migrations problématiques...');
        for (const migration of allProblematicMigrations) {
          const migrationName = migration.migration_name;
          
          // Si la migration n'existe pas dans le dossier, la marquer comme rolled-back
          if (!migrationExists(migrationName)) {
            console.log(`  → ${migrationName} n'existe pas → rolled-back`);
            // Utiliser directement la commande Prisma pour marquer comme rolled-back
            runPrismaResolve(migrationName, true);
          } else {
            console.log(`  → ${migrationName} existe → applied`);
            runPrismaResolve(migrationName, false);
          }
        }
        console.log('✅ Nettoyage des migrations problématiques terminé\n');
      }
    } catch (error) {
      console.log('⚠️  Impossible de lister les migrations incomplètes/échouées:', error.message);
    }
    
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
      await prisma.$executeRaw`
        ALTER TABLE "calendar_events"
        ADD COLUMN IF NOT EXISTS "is_zone_event" BOOLEAN DEFAULT false;
      `;
      await prisma.$executeRaw`
        UPDATE "calendar_events"
        SET "is_zone_event" = false
        WHERE "is_zone_event" IS NULL;
      `;
      await prisma.$executeRaw`
        ALTER TABLE "calendar_events"
        ALTER COLUMN "is_zone_event" SET NOT NULL;
      `;
      console.log('✅ Colonne is_zone_event vérifiée sur calendar_events');
    } catch (error) {
      console.log('⚠️  Impossible d’ajouter la colonne is_zone_event:', error.message);
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

    // Vérification table contacts
    console.log('🚀 Vérification de la table contacts...');
    const contactsTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts'
      )
    `;

    let createdContactsTable = false;
    if (!contactsTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "contacts" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "read" BOOLEAN NOT NULL DEFAULT false,
          "read_at" TIMESTAMP(3),
          CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
        )
      `;
      console.log('✅ Table contacts créée');
      createdContactsTable = true;
    } else {
      console.log('✅ Table contacts existe déjà');
    }

    // Vérification table app_settings
    console.log('🚀 Vérification de la table app_settings...');
    const appSettingsTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_settings'
      )
    `;

    let createdAppSettingsTable = false;
    if (!appSettingsTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "app_settings" (
          "id" TEXT NOT NULL,
          "contact_email" TEXT,
          "contact_phone" TEXT,
          "contact_location" TEXT,
          "updated_at" TIMESTAMP(3) NOT NULL,
          "updated_by_id" TEXT,
          CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
        )
      `;
      await prisma.$executeRaw`
        ALTER TABLE "app_settings" 
        ADD CONSTRAINT "app_settings_updated_by_id_fkey" 
        FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('✅ Table app_settings créée');
      createdAppSettingsTable = true;
    } else {
      console.log('✅ Table app_settings existe déjà');
    }

    // Vérification table network_objectives
    console.log('🚀 Vérification de la table network_objectives...');
    const networkObjectivesTableCheck = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'network_objectives'
      )
    `;

    if (!networkObjectivesTableCheck[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "network_objectives" (
          "id" TEXT NOT NULL,
          "network_id" TEXT NOT NULL,
          "objectif" INTEGER NOT NULL,
          "date_fin" TIMESTAMP(3) NOT NULL,
          "description" TEXT,
          "active" BOOLEAN NOT NULL DEFAULT true,
          "is_main" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "network_objectives_pkey" PRIMARY KEY ("id")
        )
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "network_objectives" 
        ADD CONSTRAINT "network_objectives_network_id_fkey" 
        FOREIGN KEY ("network_id") REFERENCES "networks"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE
      `;
      
      console.log('✅ Table network_objectives créée avec is_main');
    } else {
      // Vérifier si la colonne is_main existe
      const isMainColumnCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'network_objectives'
          AND column_name = 'is_main'
        )
      `;
      
      if (!isMainColumnCheck[0].exists) {
        await prisma.$executeRaw`
          ALTER TABLE "network_objectives" ADD COLUMN "is_main" BOOLEAN NOT NULL DEFAULT false
        `;
        console.log('✅ Colonne is_main ajoutée à network_objectives');
      } else {
        console.log('✅ Colonne is_main existe déjà dans network_objectives');
      }
      
      // Vérifier si la contrainte de clé étrangère existe déjà
      const fkCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE table_schema = 'public' 
          AND table_name = 'network_objectives'
          AND constraint_name = 'network_objectives_network_id_fkey'
        )
      `;
      
      if (!fkCheck[0].exists) {
        await prisma.$executeRaw`
          ALTER TABLE "network_objectives" 
          ADD CONSTRAINT "network_objectives_network_id_fkey" 
          FOREIGN KEY ("network_id") REFERENCES "networks"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE
        `;
        console.log('✅ Contrainte de clé étrangère ajoutée à network_objectives');
      }
    }

    // Résoudre toutes les migrations échouées AVANT de continuer
    const allFailedMigrations = [...incompleteMigrations, ...failedMigrations];
    const uniqueFailedMigrations = [...new Set(allFailedMigrations.map((row) => row.migration_name))];
    
    if (uniqueFailedMigrations.length > 0) {
      console.log('🔧 Nettoyage des migrations échouées avant de continuer...');
      for (const migrationName of uniqueFailedMigrations) {
        if (!migrationExists(migrationName)) {
          console.log(`  → Marquage ${migrationName} comme rolled-back (n'existe pas)`);
          runPrismaResolve(migrationName, true);
        } else {
          // Vérifier si c'est une migration qui crée une table qui existe déjà
          // Dans ce cas, on la marque comme applied car la table existe déjà
          console.log(`  → Marquage ${migrationName} comme applied (existe)`);
          runPrismaResolve(migrationName, false);
        }
      }
      console.log('✅ Nettoyage des migrations échouées terminé\n');
    }
    
    // Vérifier spécifiquement les migrations network_objectives qui peuvent échouer si la table existe déjà
    const networkObjectivesMigrations = [
      '20250102000000_add_network_objectives',
      '20251204161607_add_network_objectives'
    ];
    
    for (const migrationName of networkObjectivesMigrations) {
      if (migrationExists(migrationName)) {
        try {
          const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'network_objectives'
            )
          `;
          
          if (tableExists[0].exists) {
            // Vérifier si la migration est marquée comme échouée ou incomplète
            const migrationStatus = await prisma.$queryRaw`
              SELECT finished_at, rolled_back_at
              FROM "_prisma_migrations"
              WHERE migration_name = ${migrationName}
            `;
            
            if (migrationStatus.length > 0 && !migrationStatus[0].finished_at && !migrationStatus[0].rolled_back_at) {
              console.log(`🔧 Migration ${migrationName} : la table existe déjà, marquage comme applied...`);
              runPrismaResolve(migrationName, false);
            }
          }
        } catch (error) {
          console.log(`⚠️  Erreur lors de la vérification de ${migrationName}:`, error.message);
        }
      }
    }
    
    // Vérifier spécifiquement la migration calendar_is_zone_event qui peut échouer si la colonne existe déjà
    const calendarIsZoneEventMigration = '20251112160000_add_calendar_is_zone_event';
    if (migrationExists(calendarIsZoneEventMigration)) {
      try {
        const columnExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'calendar_events'
            AND column_name = 'is_zone_event'
          )
        `;
        
        if (columnExists[0].exists) {
          // Vérifier si la migration est marquée comme échouée ou incomplète
          const migrationStatus = await prisma.$queryRaw`
            SELECT finished_at, rolled_back_at
            FROM "_prisma_migrations"
            WHERE migration_name = '20251112160000_add_calendar_is_zone_event'
          `;
          
          if (migrationStatus.length > 0 && !migrationStatus[0].finished_at && !migrationStatus[0].rolled_back_at) {
            console.log(`🔧 Migration ${calendarIsZoneEventMigration} : la colonne existe déjà, marquage comme applied...`);
            runPrismaResolve(calendarIsZoneEventMigration, false);
          }
        }
      } catch (error) {
        console.log(`⚠️  Erreur lors de la vérification de ${calendarIsZoneEventMigration}:`, error.message);
      }
    }

    const incompleteMigrationNames = incompleteMigrations.map((row) => row.migration_name);
    const migrationsToResolve = new Set();

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
      if (markTestimonyMigrationAsApplied && migrationExists(MIGRATION_TESTIMONIES_ACTIVITY)) {
        console.log('⚠️  Enum TestimonyCategory déjà présent dans la base');
        migrationsToResolve.add(MIGRATION_TESTIMONIES_ACTIVITY);
      }
    } catch (error) {
      console.log('⚠️  Impossible de vérifier la présence de TestimonyCategory:', error.message);
    }

    if (incompleteMigrationNames.includes(MIGRATION_TESTIMONIES_ACTIVITY) && migrationExists(MIGRATION_TESTIMONIES_ACTIVITY)) {
      migrationsToResolve.add(MIGRATION_TESTIMONIES_ACTIVITY);
    }
    if (incompleteMigrationNames.includes(MIGRATION_TESTIMONIES_FILES) && migrationExists(MIGRATION_TESTIMONIES_FILES)) {
      migrationsToResolve.add(MIGRATION_TESTIMONIES_FILES);
    }
    if ((createdContactsTable || incompleteMigrationNames.includes(MIGRATION_CONTACT_MODEL)) && migrationExists(MIGRATION_CONTACT_MODEL)) {
      migrationsToResolve.add(MIGRATION_CONTACT_MODEL);
    }
    if ((createdAppSettingsTable || incompleteMigrationNames.includes(MIGRATION_APP_SETTINGS)) && migrationExists(MIGRATION_APP_SETTINGS)) {
      migrationsToResolve.add(MIGRATION_APP_SETTINGS);
    }

    await prisma.$disconnect();
    console.log('✅ Connexion Prisma nettoyée');

    if (migrationsToResolve.size > 0) {
      migrationsToResolve.forEach((migrationName) => {
        runPrismaResolve(migrationName);
      });
    }

    console.log('🚀 Application des migrations Prisma officielles...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 120000 }); // 2 minutes max
      console.log('✅ Migrations Prisma synchronisées');
      
      // Migrer les données de référence après les migrations
      console.log('📊 Migration des données de référence...');
      try {
        const migrateScriptPath = path.join(__dirname, 'migrateReferenceData.js');
        if (fs.existsSync(migrateScriptPath)) {
          execSync(`node ${migrateScriptPath}`, { stdio: 'inherit', timeout: 60000 }); // 1 minute max
          console.log('✅ Données de référence migrées');
        } else {
          console.log('⚠️  Script de migration des données de référence non trouvé, ignoré');
        }
      } catch (migrateDataError) {
        console.log('⚠️  Erreur lors de la migration des données de référence (non bloquant):', migrateDataError.message);
        // Ne pas bloquer le démarrage si la migration des données échoue
      }
      
      // Vérifier que les tables ne sont pas vides et les remplir si nécessaire
      try {
        const { PrismaClient } = require('@prisma/client');
        const checkPrisma = new PrismaClient();
        
        const serviceTypesCount = await checkPrisma.serviceType.count();
        const testimonyCategoriesCount = await checkPrisma.testimonyCategoryConfig.count();
        const eventTypesCount = await checkPrisma.eventTypeConfig.count();
        
        if (serviceTypesCount === 0 || testimonyCategoriesCount === 0 || eventTypesCount === 0) {
          console.log('⚠️  Certaines tables de référence sont vides, remplissage...');
          const migrateScriptPath = path.join(__dirname, 'migrateReferenceData.js');
          if (fs.existsSync(migrateScriptPath)) {
            execSync(`node ${migrateScriptPath}`, { stdio: 'inherit', timeout: 60000 });
            console.log('✅ Tables de référence remplies');
          }
        }
        
        await checkPrisma.$disconnect();
      } catch (checkError) {
        console.log('⚠️  Erreur lors de la vérification des tables de référence:', checkError.message);
      }
    } catch (migrateError) {
      const stderr = migrateError?.stderr?.toString() || '';
      const stdout = migrateError?.stdout?.toString() || '';
      const combined = `${stdout}\n${stderr}`;
      if (combined.includes('type "TestimonyCategory" already exists')) {
        console.log('⚠️  Migration testimonies déjà appliquée. Marquage manuel comme appliquée...');
        if (migrationExists(MIGRATION_TESTIMONIES_ACTIVITY)) {
          runPrismaResolve(MIGRATION_TESTIMONIES_ACTIVITY);
        }
        try {
          execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 120000 });
          console.log('✅ Migrations Prisma synchronisées (après résolution de TestimonyCategory)');
        } catch (retryError) {
          console.log('⚠️  Erreur lors de la réapplication des migrations:', retryError.message);
        }
        return;
      }
      // Gestion de l'erreur P3018 (migration échouée avec table/relation/colonne déjà existante)
      if (combined.includes('P3018') || (combined.includes('already exists') && combined.includes('Migration name:'))) {
        console.log('⚠️  Détection d\'une migration échouée (P3018 - relation/colonne déjà existante)...');
        
        // Extraire le nom de la migration depuis le message d'erreur
        let failedMigrationName = null;
        const migrationNameMatch = combined.match(/Migration name:\s*([^\s\n]+)/);
        if (migrationNameMatch) {
          failedMigrationName = migrationNameMatch[1];
        } else {
          // Essayer avec extractFailedMigrationName pour P3009
          failedMigrationName = extractFailedMigrationName(combined);
        }
        
        if (failedMigrationName) {
          console.log(`🔧 Migration ${failedMigrationName} échouée car la table/relation/colonne existe déjà`);
          console.log(`   → Marquage comme applied (la structure existe déjà, donc la migration est effectivement appliquée)`);
          
          // Si la structure existe déjà, la migration est effectivement appliquée, on la marque comme applied
          runPrismaResolve(failedMigrationName, false);
          
          // Réessayer les migrations
          try {
            execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 120000 });
            console.log('✅ Migrations Prisma synchronisées (après résolution de migration avec structure existante)');
            
            // Migrer les données de référence
            try {
              const migrateScriptPath = path.join(__dirname, 'migrateReferenceData.js');
              if (fs.existsSync(migrateScriptPath)) {
                execSync(`node ${migrateScriptPath}`, { stdio: 'inherit', timeout: 60000 });
                console.log('✅ Données de référence migrées');
              }
            } catch (migrateDataError) {
              console.log('⚠️  Erreur lors de la migration des données (non bloquant):', migrateDataError.message);
            }
          } catch (retryError) {
            console.log('⚠️  Erreur lors de la réapplication des migrations:', retryError.message);
            // Ne pas retourner, continuer pour essayer d'autres solutions
          }
        } else {
          console.log('⚠️  Impossible d\'extraire le nom de la migration échouée depuis le message d\'erreur');
        }
        return;
      }
      
      // Gestion générique des erreurs P3009 (migrations échouées)
      if (combined.includes('P3009')) {
        console.log('⚠️  Détection d\'une migration échouée (P3009)...');
        const failedMigrationName = extractFailedMigrationName(combined);
        
        if (failedMigrationName) {
          console.log(`🔧 Tentative de résolution de la migration échouée: ${failedMigrationName}`);
          // Si la migration existe, on la marque comme applied, sinon comme rolled-back
          const exists = migrationExists(failedMigrationName);
          runPrismaResolve(failedMigrationName, !exists);
          
          // Réessayer les migrations
          try {
            execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 120000 });
            console.log('✅ Migrations Prisma synchronisées (après résolution de migration échouée)');
            
            // Migrer les données de référence
            try {
              const migrateScriptPath = path.join(__dirname, 'migrateReferenceData.js');
              if (fs.existsSync(migrateScriptPath)) {
                execSync(`node ${migrateScriptPath}`, { stdio: 'inherit', timeout: 60000 });
                console.log('✅ Données de référence migrées');
              }
            } catch (migrateDataError) {
              console.log('⚠️  Erreur lors de la migration des données (non bloquant):', migrateDataError.message);
            }
          } catch (retryError) {
            console.log('⚠️  Erreur lors de la réapplication des migrations:', retryError.message);
            // Ne pas retourner, continuer pour essayer d'autres solutions
          }
        } else {
          console.log('⚠️  Impossible d\'extraire le nom de la migration échouée depuis le message d\'erreur');
        }
        // Ne pas retourner immédiatement, continuer pour vérifier d'autres cas
      }
      // Si c'est juste une migration qui existe déjà, ne pas bloquer
      if (combined.includes('already applied') || combined.includes('P3008')) {
        console.log('⚠️  Certaines migrations sont déjà appliquées, continuons...');
        return;
      }
      // Pour les autres erreurs, logger mais ne pas bloquer
      console.log('⚠️  Erreur lors de l\'application des migrations:', migrateError.message);
      console.log('⚠️  Continuons le démarrage du serveur...');
    }
    
    // Vérification finale : s'assurer que les tables de référence sont remplies
    console.log('🔍 Vérification finale des tables de référence...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const finalCheckPrisma = new PrismaClient();
      
      const speakersCount = await finalCheckPrisma.speaker.count();
      const serviceTypesCount = await finalCheckPrisma.serviceType.count();
      const testimonyCategoriesCount = await finalCheckPrisma.testimonyCategoryConfig.count();
      const eventTypesCount = await finalCheckPrisma.eventTypeConfig.count();
      
      console.log(`📊 État actuel: Speakers=${speakersCount}, ServiceTypes=${serviceTypesCount}, TestimonyCategories=${testimonyCategoriesCount}, EventTypes=${eventTypesCount}`);
      
      // Toujours exécuter le script si les orateurs sont vides ou insuffisants
      if (speakersCount === 0 || speakersCount < 20 || serviceTypesCount === 0 || serviceTypesCount < 10 || testimonyCategoriesCount === 0 || eventTypesCount === 0) {
        console.log('⚠️  Certaines tables de référence sont vides ou incomplètes, remplissage automatique...');
        const migrateScriptPath = path.join(__dirname, 'migrateReferenceData.js');
        if (fs.existsSync(migrateScriptPath)) {
          execSync(`node ${migrateScriptPath}`, { stdio: 'inherit', timeout: 60000 });
          console.log('✅ Tables de référence remplies avec succès');
          
          // Vérifier à nouveau après migration
          const speakersCountAfter = await finalCheckPrisma.speaker.count();
          const serviceTypesCountAfter = await finalCheckPrisma.serviceType.count();
          console.log(`📊 État après migration: Speakers=${speakersCountAfter}, ServiceTypes=${serviceTypesCountAfter}`);
        } else {
          console.log('❌ Script de migration des données de référence non trouvé');
        }
      } else {
        console.log('✅ Toutes les tables de référence contiennent des données');
      }
      
      await finalCheckPrisma.$disconnect();
    } catch (finalCheckError) {
      console.log('⚠️  Erreur lors de la vérification finale des tables:', finalCheckError.message);
    }
    
  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Erreur dans fix-migration:', error.message);
    if (error.stack) {
      console.error('❌ Stack:', error.stack);
    }
    console.log('⚠️  Démarrant le serveur malgré l\'erreur...');
    // Ne pas bloquer le démarrage du serveur - laisser le processus continuer
    process.exitCode = 0;
  } finally {
    clearTimeout(timeout);
  }
}

fixFailedMigration().catch(console.error);
