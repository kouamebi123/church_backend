// 🏛️ Church Management System - Configuration Swagger
// Ce fichier contient la configuration pour générer et maintenir la documentation Swagger

module.exports = {
  // Informations de base de l'API
  info: {
    title: 'Church Management System API',
    version: '2.0.0',
    description: 'API complète pour la gestion d\'église moderne et sécurisée',
    contact: {
      name: 'Church Management System',
      email: 'contact@church-system.local'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },

  // Serveurs disponibles
  servers: [
    {
      url: `${process.env.APP_BACKEND_URL || 'http://localhost:5001'}/api`,
      description: 'Serveur de développement'
    },
    {
      url: `${process.env.APP_BACKEND_URL || 'http://localhost:5001'}/api`,
      description: 'Serveur de production'
    }
  ],

  // Configuration des tags pour organiser les endpoints
  tags: [
    {
      name: 'Authentication',
      description: 'Endpoints d\'authentification et gestion des sessions'
    },
    {
      name: 'Users',
      description: 'Gestion des utilisateurs et membres'
    },
    {
      name: 'Churches',
      description: 'Gestion des églises et implantations'
    },
    {
      name: 'Networks',
      description: 'Gestion des réseaux et groupes'
    },
    {
      name: 'Services',
      description: 'Gestion des services et cultes'
    },
    {
      name: 'Statistics',
      description: 'Statistiques et tableaux de bord'
    },
    {
      name: 'Admin',
      description: 'Fonctionnalités d\'administration'
    }
  ],

  // Configuration de sécurité
  security: {
    BearerAuth: [],
    CSRFProtection: []
  },

  // Schémas de sécurité
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT token obtenu lors de la connexion'
    },
    CSRFProtection: {
      type: 'apiKey',
      in: 'header',
      name: 'X-CSRF-Token',
      description: 'Token CSRF généré automatiquement'
    }
  },

  // Configuration des réponses d'erreur communes
  commonResponses: {
    UnauthorizedError: {
      description: 'Token d\'authentification manquant ou invalide',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse'
          }
        }
      }
    },
    ForbiddenError: {
      description: 'Permissions insuffisantes pour accéder à la ressource',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse'
          }
        }
      }
    },
    CSRFError: {
      description: 'Erreur de validation CSRF',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse'
          }
        }
      }
    },
    ValidationError: {
      description: 'Erreur de validation des données',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/ErrorResponse'
          }
        }
      }
    }
  },

  // Configuration des modèles de données
  models: {
    User: {
      required: ['username', 'pseudo', 'password', 'role', 'genre', 'qualification'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string', description: 'Nom complet de l\'utilisateur' },
        pseudo: { type: 'string', description: 'Pseudo unique pour la connexion' },
        password: { type: 'string', format: 'password', minLength: 6 },
        role: {
          type: 'string',
          enum: ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MEMBRE']
        },
        genre: { type: 'string', enum: ['HOMME', 'FEMME', 'ENFANT'] },
        qualification: {
          type: 'string',
          enum: ['QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'LEADER', 'RESPONSABLE_RESEAU', 'RESPONSABLE_DEPARTEMENT', 'REGULIER', 'IRREGULIER', 'EN_INTEGRATION', 'GOUVERNANCE', 'ECODIM', 'RESPONSABLE_ECODIM', 'QUALIFICATION_20738', 'QUALIFICATION_248832', 'RESPONSABLE_EGLISE']
        }
      }
    },
    Church: {
      required: ['nom', 'adresse', 'ville'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        nom: { type: 'string', description: 'Nom de l\'église' },
        adresse: { type: 'string', description: 'Adresse complète' },
        ville: { type: 'string', description: 'Ville de l\'église' },
        latitude: { type: 'number', format: 'double' },
        longitude: { type: 'number', format: 'double' },
        type: {
          type: 'string',
          enum: ['EGLISE', 'MISSION']
        }
      }
    }
  },

  // Configuration des endpoints
  endpoints: {
    auth: {
      login: {
        method: 'POST',
        path: '/auth/login',
        summary: 'Connexion utilisateur',
        description: 'Authentifie un utilisateur et génère automatiquement un token CSRF'
      },
      me: {
        method: 'GET',
        path: '/auth/me',
        summary: 'Récupérer le profil utilisateur',
        description: 'Récupère le profil et régénère automatiquement le token CSRF'
      }
    },
    users: {
      list: {
        method: 'GET',
        path: '/users',
        summary: 'Récupérer tous les utilisateurs',
        description: 'Liste avec filtrage automatique par église selon le rôle'
      },
      create: {
        method: 'POST',
        path: '/users',
        summary: 'Créer un nouvel utilisateur',
        description: 'Création avec validation automatique des permissions'
      },
      update: {
        method: 'PUT',
        path: '/users/{id}',
        summary: 'Mettre à jour un utilisateur',
        description: 'Modification avec validation des permissions'
      },
      delete: {
        method: 'DELETE',
        path: '/users/{id}',
        summary: 'Supprimer un utilisateur',
        description: 'Suppression avec validation des permissions'
      }
    }
  },

  // Configuration des tests
  testing: {
    baseUrl: `${process.env.APP_BACKEND_URL || 'http://localhost:5001'}/api`,
    authEndpoint: '/auth/login',
    testCredentials: {
      pseudo: process.env.SUPER_ADMIN_PSEUDO || 'emmanuel.k',
      password: process.env.SUPER_ADMIN_PASSWORD || 'motdepasse123'
    },
    testData: {
      user: {
        username: 'Utilisateur Test',
        pseudo: 'test.user',
        password: 'testpass123',
        role: 'MEMBRE',
        genre: 'HOMME',
        qualification: 'EN_INTEGRATION'
      }
    }
  },

  // Configuration de génération
  generation: {
    outputDir: './docs',
    fileName: 'swagger.yaml',
    format: 'yaml',
    includeExamples: true,
    includeResponses: true,
    includeSecurity: true
  },

  // Configuration de validation
  validation: {
    strict: true,
    validateExamples: true,
    validateResponses: true,
    validateSecurity: true
  }
};
