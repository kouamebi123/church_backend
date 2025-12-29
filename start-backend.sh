#!/bin/sh

echo "Attente de la base de données (10 secondes)..."
sleep 10

echo "Exécution des migrations..."
npx prisma migrate deploy

# Si les migrations échouent, forcer la création du schéma
if [ $? -ne 0 ]; then
  echo "Migrations échouées, création du schéma..."
  npx prisma db push
fi

echo "Exécution du seed..."
npx prisma db seed

echo "Migration des données de référence..."
if [ -f "scripts/migrateReferenceData.js" ]; then
  node scripts/migrateReferenceData.js || echo "⚠️  Erreur lors de la migration des données de référence (non bloquant)"
else
  echo "⚠️  Script de migration des données de référence non trouvé, ignoré"
fi

echo "Démarrage du serveur backend..."
exec node server.js
