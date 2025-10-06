#!/bin/bash

# Script de déploiement en production avec Docker
# Usage: ./scripts/deploy-production.sh [domain] [email]

set -e

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Vérifier les paramètres
DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}

print_header "DÉPLOIEMENT PRODUCTION - CHURCH PROJECT"
print_message "Domaine: $DOMAIN"
print_message "Email: $EMAIL"

# Vérifier que Docker est installé
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker n'est pas installé"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose n'est pas installé"
        exit 1
    fi
    
    print_message "Docker et Docker Compose sont installés ✅"
}

# Créer le fichier .env de production
create_prod_env() {
    print_message "Création du fichier .env de production..."
    
    cat > .env.prod << EOF
# Configuration de production
NODE_ENV=production

# Base de données PostgreSQL
POSTGRES_DB=church_prod
POSTGRES_USER=church_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DATABASE_URL=postgresql://church_user:$(openssl rand -base64 32)@postgres:5432/church_prod?schema=public

# Cache Redis
REDIS_URL=redis://:$(openssl rand -base64 32)@redis:6379
REDIS_PASSWORD=$(openssl rand -base64 32)

# JWT
JWT_SECRET=$(openssl rand -base64 64)

# Email SMTP (à configurer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Application
APP_NAME=Système de Gestion d'Église
APP_URL=https://$DOMAIN
USE_POSTGRES=true
EOF

    print_message "Fichier .env.prod créé ✅"
    print_warning "Veuillez configurer les paramètres SMTP dans .env.prod"
}

# Configurer Nginx pour le domaine
configure_nginx() {
    print_message "Configuration de Nginx pour le domaine $DOMAIN..."
    
    # Remplacer le nom de domaine dans la configuration Nginx
    sed -i.bak "s/your-domain.com/$DOMAIN/g" nginx/nginx.prod.conf
    
    print_message "Configuration Nginx mise à jour ✅"
}

# Générer les certificats SSL avec Let's Encrypt
setup_ssl() {
    print_message "Configuration SSL avec Let's Encrypt..."
    
    # Créer le répertoire pour les certificats
    mkdir -p nginx/ssl
    
    # Installer certbot si pas déjà installé
    if ! command -v certbot &> /dev/null; then
        print_message "Installation de certbot..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            brew install certbot
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            sudo apt-get update
            sudo apt-get install -y certbot
        fi
    fi
    
    # Générer les certificats
    print_message "Génération des certificats SSL..."
    sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive
    
    # Copier les certificats
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
    sudo chown $USER:$USER nginx/ssl/*.pem
    
    print_message "Certificats SSL générés ✅"
}

# Démarrer les services de production
start_production() {
    print_message "Démarrage des services de production..."
    
    # Arrêter les services existants
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    
    # Démarrer les services
    docker-compose -f docker-compose.prod.yml up -d --build
    
    print_message "Services de production démarrés ✅"
}

# Vérifier le déploiement
verify_deployment() {
    print_message "Vérification du déploiement..."
    
    # Attendre que les services soient prêts
    sleep 30
    
    # Vérifier les services
    print_message "Statut des conteneurs:"
    docker-compose -f docker-compose.prod.yml ps
    
    # Test de connectivité
    print_message "Test de connectivité..."
    
    if curl -f https://$DOMAIN > /dev/null 2>&1; then
        print_message "✅ Site accessible via HTTPS"
    else
        print_warning "Site non accessible via HTTPS"
    fi
    
    if curl -f https://$DOMAIN/api/health > /dev/null 2>&1; then
        print_message "✅ API accessible"
    else
        print_warning "API non accessible"
    fi
}

# Afficher les informations de déploiement
show_deployment_info() {
    print_header "DÉPLOIEMENT TERMINÉ"
    echo "🌐 Site web: https://$DOMAIN"
    echo "🔧 API: https://$DOMAIN/api"
    echo "📊 Monitoring: docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "📋 Commandes utiles:"
    echo "  - Voir les logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  - Redémarrer: docker-compose -f docker-compose.prod.yml restart"
    echo "  - Arrêter: docker-compose -f docker-compose.prod.yml down"
    echo "  - Mise à jour: ./scripts/deploy-production.sh $DOMAIN $EMAIL"
    echo ""
    echo "🔐 Configuration SSL:"
    echo "  - Renouvellement automatique: sudo certbot renew"
    echo "  - Vérifier l'expiration: sudo certbot certificates"
}

# Fonction principale
main() {
    check_docker
    create_prod_env
    configure_nginx
    
    # Demander confirmation avant de continuer
    read -p "Voulez-vous continuer avec la configuration SSL ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_ssl
    else
        print_warning "Configuration SSL ignorée. Vous devrez configurer SSL manuellement."
    fi
    
    start_production
    verify_deployment
    show_deployment_info
    
    print_message "Déploiement terminé! 🎉"
}

# Exécuter le script
main "$@"