#!/bin/bash

# Script pour appliquer la migration des données de référence sur Railway
# Usage: ./scripts/apply-reference-data-migration.sh

echo "🚀 Application de la migration des données de référence..."

# Vérifier que DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erreur: DATABASE_URL n'est pas défini"
    exit 1
fi

# Appliquer la migration
echo "📋 Application de la migration Prisma..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration appliquée avec succès"
    
    # Exécuter le script de migration des données
    echo "📊 Migration des données de référence..."
    node scripts/migrateReferenceData.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Données migrées avec succès"
        echo "🎉 Migration complète terminée !"
    else
        echo "⚠️  Erreur lors de la migration des données, mais les tables sont créées"
        exit 1
    fi
else
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi

