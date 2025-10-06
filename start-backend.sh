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

echo "Démarrage du serveur backend..."
exec node server.js
