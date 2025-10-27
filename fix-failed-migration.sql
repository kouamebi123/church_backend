-- Script pour résoudre les migrations échouées
-- À exécuter via Railway CLI ou directement sur la base de données

-- Supprimer l'entrée de migration échouée
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs' 
AND finished_at IS NULL;

-- Vérifier que la suppression a bien eu lieu
SELECT migration_name, finished_at 
FROM "_prisma_migrations" 
WHERE migration_name LIKE '20250115000001%';

