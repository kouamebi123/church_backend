# 🧪 Tests Backend - Application Church

## 📁 Structure des Tests

```
tests/
├── 📋 jest.config.js          # Configuration Jest
├── 🌍 env.js                  # Variables d'environnement de test
├── ⚙️ setup.js                # Setup global des tests
├── 📚 README.md               # Ce fichier
├── 🧪 unit/                   # Tests unitaires
├── 🔗 integration/            # Tests d'intégration
├── 🌐 e2e/                    # Tests end-to-end
├── 🎭 fixtures/               # Données de test
├── 🛠️ utils/                  # Utilitaires de test
│   └── testHelpers.js         # Helpers pour les tests
├── 🎮 controllers/            # Tests des contrôleurs
│   ├── authController.test.js # Tests d'authentification
│   ├── userController.test.js # Tests des utilisateurs
│   ├── churchController.test.js # Tests des églises
│   └── ...
├── 🚧 middlewares/            # Tests des middlewares
│   ├── auth.test.js           # Tests d'authentification
│   ├── validation.test.js     # Tests de validation
│   └── cache.test.js          # Tests de cache
├── 🔧 services/               # Tests des services
│   ├── geoService.test.js     # Tests du service géo
│   └── ...
└── 📊 models/                 # Tests des modèles
    ├── User.test.js           # Tests du modèle User
    ├── Church.test.js         # Tests du modèle Church
    └── ...
```

## 🚀 Installation et Configuration

### 1. Installer les dépendances de test
```bash
cd tests
npm install
```

### 2. Configurer l'environnement de test
- Copier `.env.example` vers `.env.test`
- Configurer la base de données de test
- Configurer les variables d'environnement

### 3. Lancer les tests
```bash
# Tous les tests
npm test

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:coverage

# Tests spécifiques
npm run test:controllers
npm run test:middlewares
npm run test:unit
```

## 🧪 Types de Tests

### **Tests Unitaires** (`unit/`)
- Testent une fonction/méthode isolément
- Utilisent des mocks pour les dépendances
- Rapides et fiables
- Exemple : `userController.createUser()`

### **Tests d'Intégration** (`integration/`)
- Testent l'interaction entre composants
- Utilisent une base de données de test
- Plus lents mais plus réalistes
- Exemple : `auth flow complet`

### **Tests End-to-End** (`e2e/`)
- Testent l'application complète
- Simulent des actions utilisateur réelles
- Les plus lents mais les plus complets
- Exemple : `création d'église → ajout de membre`

## 🎭 Mocks et Fixtures

### **Mocks Principaux**
- **Prisma** : Base de données
- **bcrypt** : Hachage des mots de passe
- **JWT** : Tokens d'authentification
- **Logger** : Système de logs

### **Fixtures**
- Données de test réutilisables
- Modèles d'utilisateurs, églises, groupes
- Scénarios de test prédéfinis

## 📊 Couverture de Code

### **Objectifs de Couverture**
- **Branches** : 70%
- **Fonctions** : 70%
- **Lignes** : 70%
- **Statements** : 70%

### **Génération des Rapports**
```bash
npm run test:coverage
```
- Rapport HTML dans `tests/coverage/`
- Rapport console avec détails
- Rapport LCOV pour CI/CD

## 🔧 Utilitaires de Test

### **Helpers Principaux**
```javascript
const {
  createTestUser,        // Créer un utilisateur de test
  createTestRequest,     // Créer une requête de test
  createTestResponse,    // Créer une réponse de test
  expectSuccessResponse, // Vérifier une réponse de succès
  expectErrorResponse,   // Vérifier une réponse d'erreur
  mockPrismaWithData     // Mock Prisma avec des données
} = require('./utils/testHelpers');
```

### **Exemple d'Utilisation**
```javascript
describe('User Controller', () => {
  it('devrait créer un utilisateur', async () => {
    // Arrange
    const req = createTestRequest({ username: 'test' });
    const res = createTestResponse();
    
    // Act
    await userController.createUser(req, res);
    
    // Assert
    expectSuccessResponse(res, 201);
  });
});
```

## 🚨 Bonnes Pratiques

### **1. Nommage des Tests**
```javascript
describe('UserController', () => {
  describe('POST /users', () => {
    it('devrait créer un utilisateur avec des données valides', async () => {
      // Test ici
    });
    
    it('devrait retourner une erreur avec des données invalides', async () => {
      // Test ici
    });
  });
});
```

### **2. Structure AAA (Arrange-Act-Assert)**
```javascript
it('devrait faire quelque chose', async () => {
  // Arrange - Préparer les données
  const req = createTestRequest(data);
  const res = createTestResponse();
  
  // Act - Exécuter l'action
  await controller.method(req, res);
  
  // Assert - Vérifier le résultat
  expectSuccessResponse(res);
});
```

### **3. Mocks et Isolation**
- Un test ne doit pas dépendre d'un autre
- Utiliser `beforeEach` pour réinitialiser l'état
- Mocker toutes les dépendances externes

## 🔍 Débogage des Tests

### **Mode Debug**
```bash
npm run test:debug
```

### **Tests en Mode Watch**
```bash
npm run test:watch
```

### **Logs Détaillés**
```bash
npm test -- --verbose
```

## 📈 Intégration Continue

### **Script CI**
```bash
npm run test:ci
```

### **Variables d'Environnement CI**
- `NODE_ENV=test`
- `CI=true`
- Base de données de test dédiée

## 🎯 Prochaines Étapes

1. **Compléter les tests des contrôleurs** existants
2. **Ajouter des tests d'intégration** pour les workflows complets
3. **Créer des tests E2E** pour les scénarios critiques
4. **Améliorer la couverture** de code
5. **Automatiser les tests** dans le pipeline CI/CD

## 📞 Support

Pour toute question sur les tests :
- Consulter la documentation Jest
- Vérifier les exemples dans `tests/`
- Utiliser les helpers dans `tests/utils/`
