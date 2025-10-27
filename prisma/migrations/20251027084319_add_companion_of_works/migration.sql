-- CreateEnum pour ajouter COMPAGNON_OEUVRE
ALTER TYPE "Qualification" ADD VALUE IF NOT EXISTS 'COMPAGNON_OEUVRE';

-- CreateTable pour NetworkCompanion
CREATE TABLE IF NOT EXISTS "network_companions" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_companions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "network_companions_network_id_user_id_key" ON "network_companions"("network_id", "user_id");

-- AddForeignKey
ALTER TABLE "network_companions" ADD CONSTRAINT "network_companions_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_companions" ADD CONSTRAINT "network_companions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

