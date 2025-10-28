-- Migration pour ajouter les modèles Session, Unit et UnitMember
-- À exécuter après la migration Prisma

-- 1. Créer la table sessions
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responsable1_id" TEXT NOT NULL,
    "responsable2_id" TEXT,
    "church_id" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- 2. Créer la table units
CREATE TABLE IF NOT EXISTS "units" (
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
);

-- 3. Créer la table unit_members
CREATE TABLE IF NOT EXISTS "unit_members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "unit_members_pkey" PRIMARY KEY ("id")
);

-- 4. Créer les index uniques
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_nom_key" ON "sessions"("nom");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_responsable1_id_key" ON "sessions"("responsable1_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_responsable2_id_key" ON "sessions"("responsable2_id");
CREATE UNIQUE INDEX IF NOT EXISTS "units_responsable1_id_key" ON "units"("responsable1_id");
CREATE UNIQUE INDEX IF NOT EXISTS "units_responsable2_id_key" ON "units"("responsable2_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unit_members_unit_id_user_id_key" ON "unit_members"("unit_id", "user_id");

-- 5. Ajouter les contraintes de clés étrangères pour sessions
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsable1_id_fkey" FOREIGN KEY ("responsable1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsable2_id_fkey" FOREIGN KEY ("responsable2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Ajouter les contraintes de clés étrangères pour units
ALTER TABLE "units" ADD CONSTRAINT "units_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_responsable1_id_fkey" FOREIGN KEY ("responsable1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_responsable2_id_fkey" FOREIGN KEY ("responsable2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "units" ADD CONSTRAINT "units_superieur_hierarchique_id_fkey" FOREIGN KEY ("superieur_hierarchique_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Ajouter les contraintes de clés étrangères pour unit_members
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

