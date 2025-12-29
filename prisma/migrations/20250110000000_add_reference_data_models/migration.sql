-- CreateTable
CREATE TABLE "speakers" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimony_category_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimony_category_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "speakers_nom_key" ON "speakers"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "service_types_nom_key" ON "service_types"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "testimony_category_configs_code_key" ON "testimony_category_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "testimony_category_configs_nom_key" ON "testimony_category_configs"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "event_type_configs_code_key" ON "event_type_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "event_type_configs_nom_key" ON "event_type_configs"("nom");

-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'service_type_id') THEN
        ALTER TABLE "services" ADD COLUMN "service_type_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'speaker_id') THEN
        ALTER TABLE "services" ADD COLUMN "speaker_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'previsionnels' AND column_name = 'service_type_id') THEN
        ALTER TABLE "previsionnels" ADD COLUMN "service_type_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assistance' AND column_name = 'service_type_id') THEN
        ALTER TABLE "assistance" ADD COLUMN "service_type_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'testimonies' AND column_name = 'category_config_id') THEN
        ALTER TABLE "testimonies" ADD COLUMN "category_config_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'event_type_config_id') THEN
        ALTER TABLE "calendar_events" ADD COLUMN "event_type_config_id" TEXT;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'services_service_type_id_fkey' AND table_name = 'services'
    ) THEN
        ALTER TABLE "services" ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'services_speaker_id_fkey' AND table_name = 'services'
    ) THEN
        ALTER TABLE "services" ADD CONSTRAINT "services_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'previsionnels_service_type_id_fkey' AND table_name = 'previsionnels'
    ) THEN
        ALTER TABLE "previsionnels" ADD CONSTRAINT "previsionnels_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'assistance_service_type_id_fkey' AND table_name = 'assistance'
    ) THEN
        ALTER TABLE "assistance" ADD CONSTRAINT "assistance_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'testimonies_category_config_id_fkey' AND table_name = 'testimonies'
    ) THEN
        ALTER TABLE "testimonies" ADD CONSTRAINT "testimonies_category_config_id_fkey" FOREIGN KEY ("category_config_id") REFERENCES "testimony_category_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calendar_events_event_type_config_id_fkey' AND table_name = 'calendar_events'
    ) THEN
        ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_event_type_config_id_fkey" FOREIGN KEY ("event_type_config_id") REFERENCES "event_type_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

