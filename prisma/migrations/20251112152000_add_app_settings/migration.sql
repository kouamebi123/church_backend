-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_location" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

