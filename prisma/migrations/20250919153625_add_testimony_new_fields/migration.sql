-- CreateEnum
CREATE TYPE "public"."TestimonyType" AS ENUM ('GOUVERNANCE', 'ECODIM', 'SECTION', 'VISITOR', 'NETWORK_MEMBER');

-- AlterTable
ALTER TABLE "public"."testimonies" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "testimonyType" "public"."TestimonyType",
ADD COLUMN     "section" TEXT,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "wantsToTestify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isConfirmedToTestify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasTestified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "testifiedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedBy" TEXT;

-- AddForeignKey
ALTER TABLE "public"."testimonies" ADD CONSTRAINT "testimonies_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
