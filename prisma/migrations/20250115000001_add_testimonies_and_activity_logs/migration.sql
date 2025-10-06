-- CreateEnum
CREATE TYPE "public"."TestimonyCategory" AS ENUM ('INTIMACY', 'LEADERSHIP', 'HEALING', 'PROFESSIONAL', 'BUSINESS', 'FINANCES', 'DELIVERANCE', 'FAMILY');

-- CreateEnum
CREATE TYPE "public"."ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "public"."EntityType" AS ENUM ('USER', 'NETWORK', 'GROUP', 'SERVICE', 'CHURCH', 'DEPARTMENT', 'TESTIMONY', 'CAROUSEL', 'PREVISIONNEL', 'ASSISTANCE', 'MESSAGE');

-- CreateTable
CREATE TABLE "public"."testimonies" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "networkId" TEXT,
    "category" "public"."TestimonyCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."testimony_files" (
    "id" TEXT NOT NULL,
    "testimonyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimony_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "public"."ActivityAction" NOT NULL,
    "entity_type" "public"."EntityType" NOT NULL,
    "entity_id" TEXT,
    "entity_name" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."testimonies" ADD CONSTRAINT "testimonies_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimonies" ADD CONSTRAINT "testimonies_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "public"."networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimonies" ADD CONSTRAINT "testimonies_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."testimony_files" ADD CONSTRAINT "testimony_files_testimonyId_fkey" FOREIGN KEY ("testimonyId") REFERENCES "public"."testimonies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
