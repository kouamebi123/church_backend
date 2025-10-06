#!/bin/bash

# Script de démarrage avec planificateur de nettoyage automatique

echo "🚀 [STARTUP] Démarrage du serveur avec planificateur de nettoyage..."

# Démarrer le planificateur de nettoyage en arrière-plan
echo "⏰ [STARTUP] Démarrage du planificateur de nettoyage..."
node scripts/cleanup-scheduler.js &
SCHEDULER_PID=$!

# Attendre un peu que le planificateur démarre
sleep 2

# Vérifier que le planificateur fonctionne
if ps -p $SCHEDULER_PID > /dev/null; then
    echo "✅ [STARTUP] Planificateur démarré avec succès (PID: $SCHEDULER_PID)"
else
    echo "❌ [STARTUP] Erreur: Le planificateur n'a pas démarré"
    exit 1
fi

# Afficher les informations du planificateur
echo "📋 [STARTUP] Planificateur configuré:"
echo "   • Nettoyage automatique: Tous les jours à 2h du matin"
echo "   • Durée de rétention: 1 mois"
echo "   • Vérification: Toutes les minutes"

# Démarrer le serveur Node.js
echo "🌐 [STARTUP] Démarrage du serveur Node.js..."
exec node server.js
