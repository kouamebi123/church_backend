-- Add email_notifications column to users table
ALTER TABLE "public"."users" ADD COLUMN "email_notifications" BOOLEAN NOT NULL DEFAULT true;
