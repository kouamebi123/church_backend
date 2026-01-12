-- CreateTable
CREATE TABLE IF NOT EXISTS "network_invitation_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_invitation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "network_invitation_links_token_key" ON "network_invitation_links"("token");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'network_invitation_links_church_id_fkey'
    ) THEN
        ALTER TABLE "network_invitation_links" ADD CONSTRAINT "network_invitation_links_church_id_fkey" 
        FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'network_invitation_links_created_by_id_fkey'
    ) THEN
        ALTER TABLE "network_invitation_links" ADD CONSTRAINT "network_invitation_links_created_by_id_fkey" 
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
