-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MEMBRE');

-- CreateEnum
CREATE TYPE "public"."Genre" AS ENUM ('HOMME', 'FEMME', 'ENFANT');

-- CreateEnum
CREATE TYPE "public"."Qualification" AS ENUM ('QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'LEADER', 'RESPONSABLE_RESEAU', 'RESPONSABLE_DEPARTEMENT', 'REGULIER', 'IRREGULIER', 'EN_INTEGRATION', 'GOUVERNANCE', 'ECODIM', 'RESPONSABLE_ECODIM', 'QUALIFICATION_20738', 'QUALIFICATION_248832', 'RESPONSABLE_EGLISE');

-- CreateEnum
CREATE TYPE "public"."ChurchType" AS ENUM ('EGLISE', 'MISSION');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBRE',
    "current_role" "public"."UserRole",
    "genre" "public"."Genre" NOT NULL,
    "tranche_age" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "ville_residence" TEXT NOT NULL,
    "origine" TEXT NOT NULL,
    "situation_matrimoniale" TEXT NOT NULL,
    "niveau_education" TEXT NOT NULL,
    "qualification" "public"."Qualification" NOT NULL DEFAULT 'EN_INTEGRATION',
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eglise_locale_id" TEXT NOT NULL,
    "departement_id" TEXT,
    "image" TEXT DEFAULT '',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."churches" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "population" INTEGER,
    "nombre_membres" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "type" "public"."ChurchType" NOT NULL DEFAULT 'EGLISE',
    "image" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responsable_id" TEXT,

    CONSTRAINT "churches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."networks" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "responsable1_id" TEXT NOT NULL,
    "responsable2_id" TEXT,
    "church_id" TEXT NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "network_id" TEXT NOT NULL,
    "responsable1_id" TEXT NOT NULL,
    "responsable2_id" TEXT,
    "superieur_hierarchique_id" TEXT,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_member_history" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "group_member_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."departments" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "church_id" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_departments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "culte" TEXT NOT NULL,
    "orateur" TEXT NOT NULL,
    "theme" TEXT,
    "nombre_present" INTEGER,
    "total_adultes" INTEGER NOT NULL DEFAULT 0,
    "total_enfants" INTEGER NOT NULL DEFAULT 0,
    "total_chantres" INTEGER NOT NULL DEFAULT 0,
    "total_protocoles" INTEGER NOT NULL DEFAULT 0,
    "total_multimedia" INTEGER NOT NULL DEFAULT 0,
    "total_respo_ecodim" INTEGER NOT NULL DEFAULT 0,
    "total_animateurs_ecodim" INTEGER NOT NULL DEFAULT 0,
    "total_enfants_ecodim" INTEGER NOT NULL DEFAULT 0,
    "collecteur_culte_id" TEXT NOT NULL,
    "superviseur_id" TEXT NOT NULL,
    "invitationYoutube" INTEGER NOT NULL DEFAULT 0,
    "invitationTiktok" INTEGER NOT NULL DEFAULT 0,
    "invitationInstagram" INTEGER NOT NULL DEFAULT 0,
    "invitationPhysique" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eglise_id" TEXT NOT NULL,
    "responsable_id" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carousel_images" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carousel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."previsionnels" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type_culte" TEXT NOT NULL,
    "total_prevu" INTEGER NOT NULL DEFAULT 0,
    "invites" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "network_id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "previsionnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groupes_previsions" (
    "id" TEXT NOT NULL,
    "effectif_actuel" INTEGER NOT NULL DEFAULT 0,
    "valeur_previsionnelle" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "previsionnel_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "groupes_previsions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assistance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type_culte" TEXT NOT NULL,
    "total_presents" INTEGER NOT NULL DEFAULT 0,
    "network_id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invites" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assistance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groupe_assistance" (
    "id" TEXT NOT NULL,
    "assistance_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "effectif_actuel" INTEGER NOT NULL,
    "nombre_presents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groupe_assistance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chaine_impact" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "niveau" INTEGER NOT NULL,
    "qualification" TEXT NOT NULL,
    "responsable_id" TEXT,
    "eglise_id" TEXT NOT NULL,
    "network_id" TEXT,
    "group_id" TEXT,
    "position_x" INTEGER NOT NULL,
    "position_y" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chaine_impact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sender_id" TEXT NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_recipients" (
    "id" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,

    CONSTRAINT "message_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_pseudo_key" ON "public"."users"("pseudo");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "churches_nom_key" ON "public"."churches"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "churches_responsable_id_key" ON "public"."churches"("responsable_id");

-- CreateIndex
CREATE UNIQUE INDEX "networks_nom_key" ON "public"."networks"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "public"."group_members"("group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_nom_key" ON "public"."departments"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_user_id_department_id_key" ON "public"."user_departments"("user_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "groupes_previsions_previsionnel_id_group_id_key" ON "public"."groupes_previsions"("previsionnel_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "groupe_assistance_assistance_id_group_id_key" ON "public"."groupe_assistance"("assistance_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "chaine_impact_user_id_niveau_eglise_id_key" ON "public"."chaine_impact"("user_id", "niveau", "eglise_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_recipients_message_id_recipient_id_key" ON "public"."message_recipients"("message_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_key" ON "public"."user_role_assignments"("user_id", "role");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_departement_id_fkey" FOREIGN KEY ("departement_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_eglise_locale_id_fkey" FOREIGN KEY ("eglise_locale_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."churches" ADD CONSTRAINT "churches_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."networks" ADD CONSTRAINT "networks_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."networks" ADD CONSTRAINT "networks_responsable1_id_fkey" FOREIGN KEY ("responsable1_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."networks" ADD CONSTRAINT "networks_responsable2_id_fkey" FOREIGN KEY ("responsable2_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_responsable1_id_fkey" FOREIGN KEY ("responsable1_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_responsable2_id_fkey" FOREIGN KEY ("responsable2_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groups" ADD CONSTRAINT "groups_superieur_hierarchique_id_fkey" FOREIGN KEY ("superieur_hierarchique_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_member_history" ADD CONSTRAINT "group_member_history_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_member_history" ADD CONSTRAINT "group_member_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_departments" ADD CONSTRAINT "user_departments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_departments" ADD CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_collecteur_culte_id_fkey" FOREIGN KEY ("collecteur_culte_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_eglise_id_fkey" FOREIGN KEY ("eglise_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_superviseur_id_fkey" FOREIGN KEY ("superviseur_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."previsionnels" ADD CONSTRAINT "previsionnels_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."previsionnels" ADD CONSTRAINT "previsionnels_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."previsionnels" ADD CONSTRAINT "previsionnels_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupes_previsions" ADD CONSTRAINT "groupes_previsions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupes_previsions" ADD CONSTRAINT "groupes_previsions_previsionnel_id_fkey" FOREIGN KEY ("previsionnel_id") REFERENCES "public"."previsionnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistance" ADD CONSTRAINT "assistance_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistance" ADD CONSTRAINT "assistance_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assistance" ADD CONSTRAINT "assistance_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupe_assistance" ADD CONSTRAINT "groupe_assistance_assistance_id_fkey" FOREIGN KEY ("assistance_id") REFERENCES "public"."assistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupe_assistance" ADD CONSTRAINT "groupe_assistance_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chaine_impact" ADD CONSTRAINT "chaine_impact_eglise_id_fkey" FOREIGN KEY ("eglise_id") REFERENCES "public"."churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chaine_impact" ADD CONSTRAINT "chaine_impact_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chaine_impact" ADD CONSTRAINT "chaine_impact_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "public"."networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chaine_impact" ADD CONSTRAINT "chaine_impact_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chaine_impact" ADD CONSTRAINT "chaine_impact_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_recipients" ADD CONSTRAINT "message_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_recipients" ADD CONSTRAINT "message_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
