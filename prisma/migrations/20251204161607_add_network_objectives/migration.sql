-- CreateTable
CREATE TABLE "network_objectives" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "objectif" INTEGER NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_objectives_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "network_objectives" ADD CONSTRAINT "network_objectives_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

