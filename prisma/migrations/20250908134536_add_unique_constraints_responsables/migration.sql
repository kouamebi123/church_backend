/*
  Warnings:

  - A unique constraint covering the columns `[responsable1_id]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[responsable2_id]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[responsable1_id]` on the table `networks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[responsable2_id]` on the table `networks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "groups_responsable1_id_key" ON "public"."groups"("responsable1_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_responsable2_id_key" ON "public"."groups"("responsable2_id");

-- CreateIndex
CREATE UNIQUE INDEX "networks_responsable1_id_key" ON "public"."networks"("responsable1_id");

-- CreateIndex
CREATE UNIQUE INDEX "networks_responsable2_id_key" ON "public"."networks"("responsable2_id");
