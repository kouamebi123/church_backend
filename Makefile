# Makefile pour le projet Church
# Usage: make [target]

.PHONY: help build up down restart logs clean test backup monitor deploy

# Variables
COMPOSE_FILE = docker-compose.prod.simple.yml
COMPOSE_DEV = docker-compose.prod.simple.yml
COMPOSE_PROD = docker-compose.prod.simple.yml

# Couleurs
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m

help: ## Afficher l'aide
	@echo "$(GREEN)Commandes disponibles:$(NC)"
	@echo ""
	@echo "$(YELLOW)Développement:$(NC)"
	@echo "  dev          Démarrer en mode développement"
	@echo "  dev-build    Construire et démarrer en mode développement"
	@echo "  dev-logs     Voir les logs du mode développement"
	@echo "  dev-stop     Arrêter le mode développement"
	@echo ""
	@echo "$(YELLOW)Production:$(NC)"
	@echo "  prod         Démarrer en mode production"
	@echo "  prod-build   Construire et démarrer en mode production"
	@echo "  prod-logs    Voir les logs du mode production"
	@echo "  prod-stop    Arrêter le mode production"
	@echo ""
	@echo "$(YELLOW)Général:$(NC)"
	@echo "  build        Construire toutes les images"
	@echo "  up           Démarrer tous les services"
	@echo "  down         Arrêter tous les services"
	@echo "  restart      Redémarrer tous les services"
	@echo "  logs         Voir les logs de tous les services"
	@echo "  clean        Nettoyer les conteneurs et images"
	@echo "  test         Exécuter les tests Docker"
	@echo ""
	@echo "$(YELLOW)Utilitaires:$(NC)"
	@echo "  backup       Créer une sauvegarde"
	@echo "  monitor      Démarrer le monitoring"
	@echo "  deploy       Déployer en production"
	@echo "  shell-backend Accéder au shell du backend"
	@echo "  shell-db     Accéder à la base de données"
	@echo "  migrate      Exécuter les migrations"
	@echo "  seed         Peupler la base de données"
	@echo "  fix-perms    Corriger les permissions des fichiers"

# Développement (utilise la configuration production simple)
dev: ## Démarrer en mode développement
	@echo "$(GREEN)Démarrage en mode développement...$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod up -d

dev-build: ## Construire et démarrer en mode développement
	@echo "$(GREEN)Construction et démarrage en mode développement...$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod up -d --build

dev-logs: ## Voir les logs du mode développement
	@echo "$(GREEN)Logs du mode développement:$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod logs -f

dev-stop: ## Arrêter le mode développement
	@echo "$(GREEN)Arrêt du mode développement...$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod down

# Production
prod: ## Démarrer en mode production
	@echo "$(GREEN)Démarrage en mode production...$(NC)"
	docker-compose -f $(COMPOSE_PROD) --env-file .env.prod up -d

prod-build: ## Construire et démarrer en mode production
	@echo "$(GREEN)Construction et démarrage en mode production...$(NC)"
	docker-compose -f $(COMPOSE_PROD) --env-file .env.prod up -d --build

prod-logs: ## Voir les logs du mode production
	@echo "$(GREEN)Logs du mode production:$(NC)"
	docker-compose -f $(COMPOSE_PROD) --env-file .env.prod logs -f

prod-stop: ## Arrêter le mode production
	@echo "$(GREEN)Arrêt du mode production...$(NC)"
	docker-compose -f $(COMPOSE_PROD) --env-file .env.prod down

# Général
build: ## Construire toutes les images
	@echo "$(GREEN)Construction des images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod build

up: ## Démarrer tous les services
	@echo "$(GREEN)Démarrage des services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod up -d

down: ## Arrêter tous les services
	@echo "$(GREEN)Arrêt des services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod down

restart: ## Redémarrer tous les services
	@echo "$(GREEN)Redémarrage des services...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod restart

logs: ## Voir les logs de tous les services
	@echo "$(GREEN)Logs des services:$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod logs -f

clean: ## Nettoyer les conteneurs et images
	@echo "$(GREEN)Nettoyage...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod down -v
	docker system prune -f
	docker volume prune -f

test: ## Exécuter les tests Docker
	@echo "$(GREEN)Exécution des tests Docker...$(NC)"
	./scripts/test-docker.sh

# Utilitaires
backup: ## Créer une sauvegarde
	@echo "$(GREEN)Création de la sauvegarde...$(NC)"
	./scripts/backup.sh

monitor: ## Démarrer le monitoring
	@echo "$(GREEN)Démarrage du monitoring...$(NC)"
	./scripts/monitor.sh --continuous

deploy: ## Déployer en production
	@echo "$(GREEN)Déploiement en production...$(NC)"
	./scripts/deploy-production.sh

shell-backend: ## Accéder au shell du backend
	@echo "$(GREEN)Accès au shell du backend...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod exec backend sh

shell-db: ## Accéder à la base de données
	@echo "$(GREEN)Accès à la base de données...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod exec postgres psql -U church_user_prod -d church_db_prod

migrate: ## Exécuter les migrations
	@echo "$(GREEN)Exécution des migrations...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod exec backend npx prisma migrate deploy

seed: ## Peupler la base de données
	@echo "$(GREEN)Peuplement de la base de données...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod exec backend node create-test-user.js

fix-perms: ## Corriger les permissions des fichiers
	@echo "$(GREEN)Correction des permissions...$(NC)"
	./scripts/fix-permissions.sh

# Commandes de développement avancées
dev-install: ## Installer les dépendances en mode développement
	@echo "$(GREEN)Installation des dépendances...$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod exec backend npm install
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod exec frontend npm install

dev-rebuild: ## Reconstruire complètement en mode développement
	@echo "$(GREEN)Reconstruction complète en mode développement...$(NC)"
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod down -v
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod build --no-cache
	docker-compose -f $(COMPOSE_DEV) --env-file .env.prod up -d

# Commandes de production avancées
prod-ssl: ## Configurer SSL en production
	@echo "$(GREEN)Configuration SSL...$(NC)"
	./scripts/deploy-production.sh

prod-backup: ## Créer une sauvegarde de production
	@echo "$(GREEN)Sauvegarde de production...$(NC)"
	docker-compose -f $(COMPOSE_PROD) --env-file .env.prod exec postgres pg_dump -U church_user_prod church_db_prod > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Commandes de maintenance
status: ## Afficher le statut des services
	@echo "$(GREEN)Statut des services:$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod ps

health: ## Vérifier la santé des services
	@echo "$(GREEN)Vérification de la santé des services:$(NC)"
	./scripts/monitor.sh --once

update: ## Mettre à jour les images
	@echo "$(GREEN)Mise à jour des images...$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod pull
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod up -d

# Commandes de debugging
debug-backend: ## Debug du backend
	@echo "$(GREEN)Debug du backend:$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod logs backend

debug-frontend: ## Debug du frontend
	@echo "$(GREEN)Debug du frontend:$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod logs frontend

debug-db: ## Debug de la base de données
	@echo "$(GREEN)Debug de la base de données:$(NC)"
	docker-compose -f $(COMPOSE_FILE) --env-file .env.prod logs postgres
