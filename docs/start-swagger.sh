#!/bin/bash

# 🏛️ Church Management System - Démarrage Documentation Swagger
# Ce script démarre un serveur local pour visualiser la documentation Swagger

echo "🏛️ Church Management System - Documentation Swagger"
echo "=================================================="
echo ""

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    echo "   https://nodejs.org/"
    exit 1
fi

# Charger les variables d'environnement
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# URL du backend depuis les variables d'environnement
BACKEND_URL=${APP_BACKEND_URL:-http://localhost:5001}

# Vérifier si le serveur principal est en cours d'exécution
echo "🔍 Vérification du serveur principal..."
if curl -s ${BACKEND_URL}/api/health > /dev/null 2>&1; then
    echo "✅ Serveur principal détecté sur ${BACKEND_URL}"
else
    echo "⚠️  Serveur principal non détecté sur ${BACKEND_URL}"
    echo "   Démarrage du serveur de documentation uniquement..."
    echo "   Pour tester les APIs, démarrez d'abord le serveur principal avec 'npm start'"
    echo ""
fi

# Démarrer le serveur de documentation
echo "🚀 Démarrage du serveur de documentation Swagger..."
echo "📖 Documentation disponible sur: http://localhost:8080"
echo "🔗 Interface Swagger UI: http://localhost:8080/swagger-ui.html"
echo "📁 Fichier YAML: http://localhost:8080/swagger.yaml"
echo ""
echo "💡 Utilisation:"
echo "   1. Ouvrez http://localhost:8080/swagger-ui.html dans votre navigateur"
echo "   2. Testez les APIs directement depuis l'interface"
echo "   3. Utilisez Ctrl+C pour arrêter le serveur"
echo ""

# Démarrer le serveur HTTP simple
cd "$(dirname "$0")"
python3 -m http.server 8080 2>/dev/null || python -m http.server 8080 2>/dev/null || node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './swagger-ui.html';
    }
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.yaml':
        case '.yml':
            contentType = 'text/yaml';
            break;
        case '.json':
            contentType = 'application/json';
            break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Fichier non trouvé');
            } else {
                res.writeHead(500);
                res.end('Erreur serveur: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(8080, () => {
    console.log('✅ Serveur de documentation démarré sur http://localhost:8080');
    console.log('📖 Ouvrez http://localhost:8080/swagger-ui.html dans votre navigateur');
    console.log('');
    console.log('🔒 Fonctionnalités incluses:');
    console.log('   - Interface Swagger UI interactive');
    console.log('   - Tests d\'APIs en direct');
    console.log('   - Gestion automatique des tokens CSRF');
    console.log('   - Documentation complète des endpoints');
    console.log('');
    console.log('⏹️  Appuyez sur Ctrl+C pour arrêter le serveur');
});

process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur de documentation...');
    server.close(() => {
        console.log('✅ Serveur arrêté');
        process.exit(0);
    });
});
"
