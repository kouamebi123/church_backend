#!/bin/bash

# Script de configuration HTTPS avec Let's Encrypt
# Usage: ./scripts/setup-https.sh votre-domaine.com

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les arguments
if [ $# -eq 0 ]; then
    error "Usage: $0 <domaine>"
    echo "Exemple: $0 moneglise.com"
    exit 1
fi

DOMAIN=$1
EMAIL="admin@${DOMAIN}"

log "Configuration HTTPS pour le domaine: $DOMAIN"
log "Email de contact: $EMAIL"

# Vérifier si le script est exécuté en tant que root
if [ "$EUID" -ne 0 ]; then
    error "Ce script doit être exécuté en tant que root (utilisez sudo)"
    exit 1
fi

# Vérifier si Nginx est installé
if ! command -v nginx &> /dev/null; then
    log "Installation de Nginx..."
    apt update
    apt install -y nginx
fi

# Vérifier si Certbot est installé
if ! command -v certbot &> /dev/null; then
    log "Installation de Certbot..."
    apt install -y certbot python3-certbot-nginx
fi

# Créer la configuration Nginx temporaire
log "Création de la configuration Nginx temporaire..."
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Activer le site
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Tester la configuration Nginx
log "Test de la configuration Nginx..."
nginx -t

# Redémarrer Nginx
log "Redémarrage de Nginx..."
systemctl restart nginx
systemctl enable nginx

# Obtenir le certificat SSL
log "Obtention du certificat SSL avec Let's Encrypt..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --email ${EMAIL} --agree-tos --non-interactive

# Vérifier le renouvellement automatique
log "Configuration du renouvellement automatique..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Créer la configuration finale optimisée
log "Création de la configuration finale optimisée..."
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
# Configuration optimisée pour l'application Church
upstream church_backend {
    least_conn;
    server 127.0.0.1:5001 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};
    
    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Logs
    access_log /var/log/nginx/${DOMAIN}_access.log;
    error_log /var/log/nginx/${DOMAIN}_error.log;
    
    # Limite de taille des uploads
    client_max_body_size 10M;
    
    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    # Proxy vers l'application
    location / {
        proxy_pass http://church_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Buffering pour les performances
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://church_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Tester la configuration finale
log "Test de la configuration finale..."
nginx -t

# Redémarrer Nginx avec la nouvelle configuration
log "Redémarrage de Nginx avec la configuration optimisée..."
systemctl reload nginx

# Vérifier le statut
log "Vérification du statut..."
systemctl status nginx --no-pager

# Test de la configuration SSL
log "Test de la configuration SSL..."
if command -v openssl &> /dev/null; then
    echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -dates
fi

log "✅ Configuration HTTPS terminée avec succès !"
log "🌐 Votre site est maintenant accessible via: https://${DOMAIN}"
log "🔒 Le certificat SSL sera renouvelé automatiquement"
log "📊 Vous pouvez maintenant utiliser le monitoring et les backups"

# Afficher les prochaines étapes
echo ""
echo -e "${BLUE}📋 Prochaines étapes:${NC}"
echo "1. Mettre à jour les variables d'environnement:"
echo "   APP_URL=https://${DOMAIN}"
echo "   FRONTEND_URL=https://${DOMAIN}"
echo ""
echo "2. Démarrer le monitoring:"
echo "   node scripts/monitoring.js start"
echo ""
echo "3. Configurer les backups:"
echo "   node scripts/backup-database.js start"
echo ""
echo "4. Tester la charge:"
echo "   node scripts/test-load-300-users.js"
