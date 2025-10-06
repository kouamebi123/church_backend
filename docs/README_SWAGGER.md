# 📚 Documentation Swagger - Church Management System

## 🎯 Vue d'ensemble

Cette documentation Swagger fournit une interface interactive et complète pour explorer et tester toutes les APIs du système Church Management System.

## 📁 Fichiers de documentation

- **`swagger.yaml`** - Spécification OpenAPI 3.0 complète
- **`swagger-ui.html`** - Interface Swagger UI personnalisée
- **`README_SWAGGER.md`** - Ce guide d'utilisation

## 🚀 Comment utiliser la documentation

### **1. Ouvrir l'interface Swagger UI**

```bash
# Depuis le dossier docs/
open swagger-ui.html

# Ou ouvrir directement dans le navigateur
# docs/swagger-ui.html
```

### **2. Navigation dans l'interface**

- **🔍 Barre de recherche** : Filtrer les endpoints par nom
- **📋 Tags** : Regrouper les endpoints par catégorie
- **📖 Documentation** : Voir les détails de chaque endpoint
- **🧪 Try it out** : Tester les APIs directement depuis l'interface

### **3. Catégories d'endpoints**

#### **🔐 Authentication** (7 endpoints)
- `POST /auth/login` - Connexion utilisateur
- `GET /auth/me` - Profil utilisateur
- `POST /auth/register` - Inscription utilisateur
- `POST /auth/forgot-password` - Demande de réinitialisation
- `POST /auth/reset-password` - Réinitialisation mot de passe
- `PUT /auth/updatedetails` - Mise à jour profil
- `PUT /auth/updatepassword` - Mise à jour mot de passe

#### **👥 Users** (17 endpoints)
- `GET /users` - Liste des utilisateurs
- `POST /users` - Créer un utilisateur
- `GET /users/{id}` - Détails utilisateur
- `PUT /users/{id}` - Modifier un utilisateur
- `DELETE /users/{id}` - Supprimer un utilisateur
- `PUT /users/profile` - Modifier son propre profil
- `POST /users/profile/image` - Upload image de profil
- `DELETE /users/profile/image` - Supprimer image de profil
- `GET /users/available` - Utilisateurs disponibles
- `GET /users/governance` - Utilisateurs GOUVERNANCE
- `GET /users/non-isoles` - Utilisateurs non isolés
- `GET /users/isoles` - Utilisateurs isolés
- `GET /users/retired` - Utilisateurs retraités
- `GET /users/stats` - Statistiques utilisateurs
- `GET /users/{id}/network` - Réseau d'un utilisateur
- `PUT /users/{id}/qualification` - Mettre à jour qualification
- `POST /users/{id}/reset-password` - Réinitialiser mot de passe

#### **⛪ Churches** (8 endpoints)
- `GET /churches` - Liste des églises
- `POST /churches` - Créer une église
- `GET /churches/city-info/{cityName}` - Informations ville
- `GET /churches/stats` - Statistiques églises
- `GET /churches/{id}` - Détails église
- `PUT /churches/{id}` - Modifier église
- `PATCH /churches/{id}` - Mise à jour partielle église
- `DELETE /churches/{id}` - Supprimer église

#### **🌐 Networks** (10 endpoints)
- `GET /networks` - Liste des réseaux
- `POST /networks` - Créer un réseau
- `GET /networks/stats` - Statistiques réseaux
- `GET /networks/qualification-stats` - Statistiques qualification
- `GET /networks/{id}` - Détails réseau
- `PUT /networks/{id}` - Modifier réseau
- `DELETE /networks/{id}` - Supprimer réseau
- `GET /networks/{id}/stats` - Statistiques d'un réseau
- `GET /networks/{id}/grs` - Groupes d'un réseau
- `GET /networks/{id}/members` - Membres d'un réseau

#### **👥 Groups** (8 endpoints)
- `GET /groups` - Liste des groupes
- `POST /groups` - Créer groupe
- `GET /groups/available-responsables` - Responsables disponibles
- `GET /groups/{id}` - Détails groupe
- `PUT /groups/{id}` - Modifier groupe
- `DELETE /groups/{id}` - Supprimer groupe
- `POST /groups/{id}/members` - Ajouter membre
- `DELETE /groups/{id}/members/{userId}` - Retirer membre

#### **🏢 Departments** (7 endpoints)
- `GET /departments` - Liste des départements
- `POST /departments` - Créer département
- `GET /departments/stats` - Statistiques départements
- `GET /departments/{id}` - Détails département
- `PUT /departments/{id}` - Modifier département
- `DELETE /departments/{id}` - Supprimer département
- `GET /departments/{id}/members` - Membres d'un département

#### **🎵 Services** (7 endpoints)
- `GET /services` - Liste des services
- `POST /services` - Créer service
- `GET /services/stats` - Statistiques services
- `GET /services/period` - Services par période
- `GET /services/{id}` - Détails service
- `PUT /services/{id}` - Modifier service
- `DELETE /services/{id}` - Supprimer service

#### **📊 Statistics** (3 endpoints)
- `GET /stats` - Statistiques globales
- `GET /stats/networks/evolution` - Évolution des réseaux
- `GET /stats/networks/evolution/compare` - Comparaison années

#### **🎠 Carousel** (3 endpoints)
- `GET /carousel` - Images du carousel
- `POST /carousel` - Ajouter image
- `DELETE /carousel/{id}` - Supprimer image

#### **💰 Previsionnels** (6 endpoints)
- `POST /previsionnels` - Créer prévisionnel
- `GET /previsionnels/network/{networkId}` - Prévisionnels d'un réseau
- `GET /previsionnels/stats` - Statistiques prévisionnels
- `GET /previsionnels/{id}` - Détails prévisionnel
- `PUT /previsionnels/{id}` - Modifier prévisionnel
- `DELETE /previsionnels/{id}` - Supprimer prévisionnel

#### **🤝 Assistance** (5 endpoints)
- `POST /assistance` - Créer assistance
- `GET /assistance/stats` - Statistiques assistance
- `GET /assistance/{id}` - Détails assistance
- `PUT /assistance/{id}` - Modifier assistance
- `DELETE /assistance/{id}` - Supprimer assistance

#### **💬 Messages** (11 endpoints)
- `POST /messages/send` - Envoyer message
- `GET /messages/received` - Messages reçus
- `GET /messages/sent` - Messages envoyés
- `GET /messages/conversations` - Conversations
- `PUT /messages/{id}/read` - Marquer comme lu
- `PUT /messages/mark-multiple-read` - Marquer plusieurs comme lus
- `PUT /messages/{id}/acknowledge` - Accuser réception
- `GET /messages/stats` - Statistiques messages
- `GET /messages/users` - Utilisateurs pour messagerie
- `GET /messages/conversation/{userId}` - Historique conversation
- `GET /messages/{messageId}/read-status` - Statut de lecture

#### **🚨 Emergency** (1 endpoint)
- `POST /emergency/create-super-admin` - Créer super admin d'urgence

#### **🔑 Roles** (7 endpoints)
- `POST /roles/change-role` - Changer de rôle
- `GET /roles/available-roles` - Rôles disponibles
- `POST /roles/assign` - Assigner rôle
- `DELETE /roles/remove` - Retirer rôle
- `POST /roles/assign-multiple` - Assigner plusieurs rôles
- `GET /roles/user/{userId}` - Rôles d'un utilisateur

#### **⚙️ Preferences** (3 endpoints)
- `GET /preferences` - Préférences utilisateur
- `PUT /preferences` - Mettre à jour préférences
- `PUT /preferences/email` - Mettre à jour préférences email

#### **🙏 Testimonies** (10 endpoints)
- `GET /testimonies/churches` - Églises pour témoignages
- `GET /testimonies/networks/{churchId}` - Réseaux d'une église
- `GET /testimonies/categories` - Catégories témoignages
- `GET /testimonies/approved` - Témoignages approuvés
- `GET /testimonies/admin/all` - Tous les témoignages (Admin)
- `POST /testimonies` - Créer témoignage
- `GET /testimonies/{id}` - Détails témoignage
- `DELETE /testimonies/{id}` - Supprimer témoignage
- `PUT /testimonies/{id}/mark-read` - Marquer comme lu
- `PUT /testimonies/{id}/note` - Ajouter note

#### **📈 Activities** (3 endpoints)
- `GET /activities/history` - Historique des activités
- `GET /activities/stats` - Statistiques des activités
- `POST /activities/log` - Enregistrer activité

#### **🔒 Security** (1 endpoint)
- `GET /security/stats` - Statistiques de sécurité

#### **⚙️ Admin** (2 endpoints)
- `GET /admin/clear-cache` - Nettoyer le cache
- `GET /admin/cache-status` - État du cache

## 🔒 Authentification et Sécurité

### **Système CSRF Automatique**

La documentation Swagger inclut automatiquement la gestion des tokens CSRF :

1. **Connexion** : Récupère automatiquement le token CSRF
2. **Requêtes** : Ajoute automatiquement le header `X-CSRF-Token`
3. **Validation** : Gère automatiquement l'expiration des tokens

### **Configuration de l'authentification**

1. **Cliquer sur "Authorize"** en haut de l'interface
2. **Saisir le JWT token** obtenu lors de la connexion
3. **Le token CSRF est géré automatiquement**

```http
Authorization: Bearer <jwt_token>
X-CSRF-Token: <csrf_token_automatique>
```

## 🧪 Tester les APIs

### **1. Test de connexion**

```bash
# 1. Ouvrir l'endpoint POST /auth/login
# 2. Cliquer sur "Try it out"
# 3. Saisir les identifiants :
{
  "pseudo": "manu99",
  "password": "Mon06745091?"
}
# 4. Cliquer sur "Execute"
# 5. Copier le token JWT de la réponse
```

### **2. Test d'un endpoint protégé**

```bash
# 1. Cliquer sur "Authorize" et saisir le JWT token
# 2. Ouvrir l'endpoint GET /users
# 3. Cliquer sur "Try it out"
# 4. Cliquer sur "Execute"
# 5. Vérifier que la requête inclut automatiquement le CSRF token
```

### **3. Test de création d'utilisateur**

```bash
# 1. Ouvrir l'endpoint POST /users
# 2. Cliquer sur "Try it out"
# 3. Saisir les données utilisateur :
{
  "username": "Nouveau Utilisateur",
  "pseudo": "nouveau.user",
  "password": "motdepasse123",
  "role": "MEMBRE",
  "genre": "HOMME",
  "qualification": "EN_INTEGRATION"
}
# 4. Cliquer sur "Execute"
```

## 📊 Schémas de données

### **Modèle User**

```yaml
User:
  required:
    - username, pseudo, password, role, genre, qualification
  properties:
    id: string (UUID)
    username: string
    pseudo: string (unique)
    password: string (min 6 caractères)
    role: enum [SUPER_ADMIN, ADMIN, MANAGER, COLLECTEUR_RESEAUX, COLLECTEUR_CULTE, MEMBRE]
    genre: enum [HOMME, FEMME]
    qualification: enum [EN_INTEGRATION, QUALIFICATION_12, QUALIFICATION_144, QUALIFICATION_1728, GOUVERNANCE]
    # ... autres propriétés
```

### **Modèle Church**

```yaml
Church:
  required:
    - nom, adresse, ville
  properties:
    id: string (UUID)
    nom: string
    adresse: string
    ville: string
    latitude: number (GPS)
    longitude: number (GPS)
    type: enum [PRINCIPALE, FILIALE, MISSION]
    # ... autres propriétés
```

## 🚨 Codes d'erreur

### **Codes HTTP**

- **200** - Succès
- **201** - Création réussie
- **400** - Données invalides
- **401** - Non authentifié
- **403** - Non autorisé (permissions ou CSRF)
- **404** - Ressource non trouvée
- **408** - Timeout (statistiques)
- **500** - Erreur serveur

### **Codes d'erreur spécifiques**

```json
// Erreur CSRF
{
  "success": false,
  "message": "Token CSRF manquant",
  "code": "CSRF_TOKEN_MISSING"
}

// Erreur de permissions
{
  "success": false,
  "message": "Accès refusé : permissions insuffisantes",
  "code": "INSUFFICIENT_PERMISSIONS"
}

// Erreur de validation
{
  "success": false,
  "message": "Données invalides",
  "errors": ["Le nom d'utilisateur est requis"]
}
```

## 🔧 Configuration avancée

### **Variables d'environnement**

```bash
# Serveur de développement
http://localhost:5001/api

# Serveur de production
http://localhost:5001/api
```

### **Headers personnalisés**

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-CSRF-Token: <csrf_token_automatique>
```

## 📱 Fonctionnalités mobiles

- **Interface responsive** : Optimisée pour tous les écrans
- **Navigation tactile** : Support des gestes mobiles
- **Performance** : Chargement rapide sur connexions lentes

## 🎨 Personnalisation

### **Couleurs et thème**

L'interface utilise un thème personnalisé avec :
- **Couleur principale** : #667eea (bleu)
- **Accents** : Gradients et ombres modernes
- **Typographie** : Police système optimisée

### **Fonctionnalités ajoutées**

- **Intercepteurs automatiques** pour CSRF
- **Gestion des erreurs** personnalisée
- **Informations contextuelles** sur la sécurité

## 🚀 Déploiement

### **Serveur local**

```bash
# Démarrer le serveur
npm start

# Ouvrir la documentation
open docs/swagger-ui.html
```

### **Serveur de production**

```bash
# Copier les fichiers de documentation
cp -r docs/ /var/www/html/

# Configurer le serveur web pour servir les fichiers statiques
```


## 📚 Ressources additionnelles

- **[Guide CSRF Automatique](../CSRF_SYSTEM_GUIDE.md)** - Détails du système de sécurité
- **[Documentation API](../API_DOCUMENTATION.md)** - Guide textuel complet
- **[README principal](../README.md)** - Vue d'ensemble du projet

## 🤝 Contribution

Pour améliorer la documentation Swagger :

1. **Modifier `swagger.yaml`** pour ajouter/modifier des endpoints
2. **Personnaliser `swagger-ui.html`** pour l'interface
3. **Mettre à jour ce README** pour refléter les changements

## 📄 Licence

Cette documentation est sous licence MIT, comme le projet principal.

---

**🏛️ Church Management System** - Documentation API interactive et complète
