-- Script d'initialisation de la base de données
-- Ce script s'exécute automatiquement lors du premier démarrage de PostgreSQL

-- Créer la base de données si elle n'existe pas
SELECT 'CREATE DATABASE church_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'church_db')\gexec

-- Se connecter à la base de données
\c church_db;

-- Créer l'utilisateur si il n'existe pas
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'church_user') THEN

      CREATE ROLE church_user LOGIN PASSWORD 'church_password';
   END IF;
END
$do$;

-- Donner les permissions
GRANT ALL PRIVILEGES ON DATABASE church_db TO church_user;
GRANT ALL ON SCHEMA public TO church_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO church_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO church_user;

-- Configurer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Message de confirmation
\echo 'Base de données church_db initialisée avec succès!'



