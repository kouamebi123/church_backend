#!/bin/bash

echo "🚀 Déploiement Railway Backend"
echo "================================"

# Vérifier que nous sommes dans le bon dossier
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Vous devez être dans le dossier backend/"
    exit 1
fi

# Vérifier que Railway CLI est installé
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI n'est pas installé"
    echo "Installez-le avec: npm install -g @railway/cli"
    exit 1
fi

echo "📦 Installation des dépendances..."
npm install

echo "🔧 Exécution des migrations..."
npx prisma migrate deploy

echo "🌱 Exécution du seed..."
npx prisma db seed

echo "📊 Migration des données de référence..."
if [ -f "scripts/migrateReferenceData.js" ]; then
  node scripts/migrateReferenceData.js || echo "⚠️  Erreur lors de la migration des données de référence (non bloquant)"
else
  echo "⚠️  Script de migration des données de référence non trouvé, ignoré"
fi

echo "🚀 Déploiement sur Railway..."
railway up

echo "✅ Déploiement terminé!"
echo "🌐 Votre backend est disponible sur Railway"
