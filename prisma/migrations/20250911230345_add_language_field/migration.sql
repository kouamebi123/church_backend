-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "language" TEXT DEFAULT 'fr',
ADD COLUMN     "theme" TEXT DEFAULT 'light';
