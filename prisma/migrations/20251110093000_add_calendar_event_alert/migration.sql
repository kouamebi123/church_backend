-- Ajoute la gestion des alertes aux événements du calendrier
ALTER TABLE "calendar_events"
ADD COLUMN "alert_offset_minutes" INTEGER;

