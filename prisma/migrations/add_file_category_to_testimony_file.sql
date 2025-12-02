-- Migration: Add fileCategory field to testimony_files table
-- This field distinguishes between ILLUSTRATION and AUDIO files

ALTER TABLE "testimony_files" 
ADD COLUMN IF NOT EXISTS "fileCategory" TEXT DEFAULT 'ILLUSTRATION';

-- Update existing records to have ILLUSTRATION as default
UPDATE "testimony_files" 
SET "fileCategory" = 'ILLUSTRATION' 
WHERE "fileCategory" IS NULL;

