-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "calendar_events" ADD COLUMN "recurrence_type" "RecurrenceType";
ALTER TABLE "calendar_events" ADD COLUMN "recurrence_interval" INTEGER DEFAULT 1;
ALTER TABLE "calendar_events" ADD COLUMN "recurrence_days" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "recurrence_end_date" TIMESTAMP(3);
