#!/bin/bash

# Script pour résoudre les migrations échouées sur Railway
echo "🔧 Résolution des migrations échouées sur Railway"
echo ""

# Marquer la migration échouée comme résolue
echo "📝 Tentative 1: Marquer la migration comme résolue"
npx prisma migrate resolve --applied 20250115000001_add_testimonies_and_activity_logs

if [ $? -eq 0 ]; then
    echo "✅ Migration marquée comme résolue"
    exit 0
fi

echo ""
echo "📝 Tentative 2: Rollback de la migration échouée"
npx prisma migrate resolve --rolled-back 20250115000001_add_testimonies_and_activity_logs

if [ $? -eq 0 ]; then
    echo "✅ Migration marquée comme rollback"
    exit 0
fi

echo ""
echo "❌ Impossible de résoudre automatiquement la migration"
echo "💡 Options manuelles:"
echo "   1. Accéder à la base Railway manuellement"
echo "   2. Exécuter: DELETE FROM _prisma_migrations WHERE migration_name = '20250115000001_add_testimonies_and_activity_logs'"
echo "   3. Re-déployer"

