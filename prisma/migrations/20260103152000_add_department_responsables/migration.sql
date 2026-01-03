-- AlterTable
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "responsable1_id" TEXT,
ADD COLUMN IF NOT EXISTS "responsable2_id" TEXT;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'departments_responsable1_id_fkey'
    ) THEN
        ALTER TABLE "departments" ADD CONSTRAINT "departments_responsable1_id_fkey" 
        FOREIGN KEY ("responsable1_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'departments_responsable2_id_fkey'
    ) THEN
        ALTER TABLE "departments" ADD CONSTRAINT "departments_responsable2_id_fkey" 
        FOREIGN KEY ("responsable2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

