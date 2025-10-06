/**
 * Gestionnaire centralisé des erreurs pour éviter l'exposition d'informations sensibles.
 */

// Codes d'erreur Prisma courants
const PRISMA_ERROR_CODES = {
  P2002: 'CONSTRAINT_VIOLATION', // Contrainte unique violée
  P2003: 'FOREIGN_KEY_CONSTRAINT', // Contrainte de clé étrangère violée
  P2025: 'RECORD_NOT_FOUND', // Enregistrement non trouvé
  P2021: 'TABLE_NOT_FOUND', // Table non trouvée
  P2022: 'COLUMN_NOT_FOUND', // Colonne non trouvée
  P2014: 'RELATION_VIOLATION', // Violation de relation
  P2018: 'CONNECTED_RECORD_NOT_FOUND', // Enregistrement connecté non trouvé
  P2019: 'INPUT_ERROR', // Erreur d'entrée
  P2020: 'VALUE_OUT_OF_RANGE', // Valeur hors limites
  P2023: 'COLUMN_DATA_TYPE_MISMATCH', // Incompatibilité de type de données
  P2024: 'CONNECTION_TIMEOUT', // Timeout de connexion
  P2026: 'CURRENT_DATABASE_PROVIDER_NOT_SUPPORTED', // Fournisseur de base de données non supporté
  P2027: 'MULTIPLE_ERRORS', // Erreurs multiples
  P2034: 'TRANSACTION_FAILED', // Transaction échouée
  P2037: 'MANY_RELATIONS_NOT_CONNECTED' // Relations multiples non connectées
};

/**
 * Gère les erreurs Prisma et retourne des messages utilisateur appropriés.
 * @param error
 * @param context
 * @example
 */
const handlePrismaError = (error, context = 'opération') => {
  // Erreur Prisma dans ${context} - Supprimé pour la production
  // Métadonnées Prisma - Supprimé pour la production

  // Gestion des erreurs HTTP spécifiques
  if (error.response?.status) {
    switch (error.response.status) {
      case 429:
        return {
          status: 429,
          message: 'Trop de requêtes effectuées. Veuillez ralentir et réessayer dans quelques minutes.'
        };
      case 401:
        return {
          status: 401,
          message: 'Authentification requise. Veuillez vous connecter.'
        };
      case 403:
        return {
          status: 403,
          message: 'Accès interdit. Vous n\'avez pas les permissions nécessaires.'
        };
      case 404:
        return {
          status: 404,
          message: 'Ressource non trouvée.'
        };
      case 500:
        return {
          status: 500,
          message: 'Erreur interne du serveur. Veuillez réessayer plus tard.'
        };
    }
  }

  // Gestion des codes d'erreur Prisma
  if (error.code && PRISMA_ERROR_CODES[error.code]) {
    switch (error.code) {
      case 'P2002':
        const field = error.meta?.target?.[0] || 'champ';
        return {
          status: 409,
          message: `Un enregistrement avec ce ${field} existe déjà. Veuillez choisir une valeur différente.`
        };

      case 'P2003':
        // Gestion spécifique des contraintes de clé étrangère
        const errorMessage = error.message || '';

        // Vérifier les contraintes spécifiques dans le message d'erreur
        if (errorMessage.includes('networks_responsable1_id_fkey') || errorMessage.includes('networks_responsable2_id_fkey')) {
          return {
            status: 400,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un réseau. Veuillez d\'abord modifier ou supprimer le réseau.'
          };
        }

        if (errorMessage.includes('group_members_user_id_fkey')) {
          return {
            status: 400,
            message: 'Impossible de supprimer cet utilisateur car il est membre d\'un groupe. Veuillez d\'abord le retirer du groupe ou supprimer le groupe.'
          };
        }

        if (errorMessage.includes('groups_responsable1_id_fkey') || errorMessage.includes('groups_responsable2_id_fkey')) {
          return {
            status: 400,
            message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un groupe. Veuillez d\'abord changer le responsable ou supprimer le groupe.'
          };
        }

        // Gestion par champs de métadonnées (fallback)
        if (error.meta?.field_name) {
          const fieldName = error.meta.field_name;
          if (fieldName.includes('responsable1_id') || fieldName.includes('responsable2_id')) {
            return {
              status: 400,
              message: 'Impossible de supprimer cet utilisateur car il est responsable d\'un élément. Veuillez d\'abord modifier ou supprimer cet élément.'
            };
          }
          if (fieldName.includes('eglise_locale_id')) {
            return {
              status: 400,
              message: 'Impossible de supprimer cet utilisateur car il est associé à une église. Veuillez d\'abord modifier ou supprimer l\'association.'
            };
          }
          if (fieldName.includes('user_id')) {
            return {
              status: 400,
              message: 'Impossible de supprimer cet utilisateur car il est référencé dans d\'autres données. Veuillez d\'abord supprimer ces références.'
            };
          }
        }

        // Si on arrive ici, c'est une contrainte de clé étrangère non gérée
        // Contrainte de clé étrangère non gérée - Supprimé pour la production
        return {
          status: 400,
          message: 'Impossible de supprimer cet utilisateur car il a des références actives. Le système va tenter de les nettoyer automatiquement.'
        };

      case 'P2025':
        return {
          status: 404,
          message: 'Ressource non trouvée.'
        };

      case 'P2021':
        return {
          status: 500,
          message: 'Erreur de configuration de la base de données.'
        };

      case 'P2022':
        return {
          status: 500,
          message: 'Erreur de configuration de la base de données.'
        };

      case 'P2014':
        return {
          status: 400,
          message: 'Relation invalide. Vérifiez les données.'
        };

      case 'P2018':
        return {
          status: 400,
          message: 'Données de référence manquantes.'
        };

      case 'P2019':
        return {
          status: 400,
          message: 'Données d\'entrée invalides.'
        };

      case 'P2020':
        return {
          status: 400,
          message: 'Valeur hors des limites autorisées.'
        };

      case 'P2023':
        return {
          status: 400,
          message: 'Format de données invalide.'
        };

      case 'P2024':
        return {
          status: 500,
          message: 'Erreur de connexion à la base de données. Veuillez réessayer.'
        };

      case 'P2026':
        return {
          status: 500,
          message: 'Erreur de configuration de la base de données.'
        };

      case 'P2027':
        return {
          status: 500,
          message: 'Erreurs multiples détectées. Veuillez réessayer.'
        };

      case 'P2034':
        return {
          status: 500,
          message: 'Erreur de transaction. Veuillez réessayer.'
        };

      case 'P2037':
        return {
          status: 400,
          message: 'Relations invalides. Vérifiez les données.'
        };

      default:
        return {
          status: 500,
          message: `Erreur de base de données: ${error.code}`
        };
    }
  }

  // Gestion des erreurs de validation Prisma
  if (error.message && error.message.includes('Invalid value')) {
    return {
      status: 400,
      message: 'Données invalides. Vérifiez le format des informations.'
    };
  }

  if (error.message && error.message.includes('constraint')) {
    return {
      status: 400,
      message: 'Données invalides. Certaines contraintes ne sont pas respectées.'
    };
  }

  if (error.message && error.message.includes('Unknown field')) {
    return {
      status: 400,
      message: 'Champ inconnu dans la requête.'
    };
  }

  // Erreur générique
  return {
    status: 500,
    message: `Erreur lors de ${context}. Veuillez réessayer.`
  };
};

/**
 * Gère les erreurs générales et retourne des messages appropriés.
 * @param error
 * @param context
 * @example
 */
const handleGeneralError = (error, context = 'opération') => {
  // Erreur générale dans ${context} - Supprimé pour la production

  // Gestion des erreurs de validation
  if (error.name === 'ValidationError') {
    return {
      status: 400,
      message: 'Données invalides. Vérifiez les informations saisies.'
    };
  }

  // Gestion des erreurs d'authentification
  if (error.name === 'JsonWebTokenError') {
    return {
      status: 401,
      message: 'Token d\'authentification invalide.'
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      status: 401,
      message: 'Session expirée. Veuillez vous reconnecter.'
    };
  }

  // Gestion des erreurs de permissions
  if (error.message && error.message.includes('permission')) {
    return {
      status: 403,
      message: 'Vous n\'avez pas les permissions nécessaires pour cette action.'
    };
  }

  // Gestion des erreurs de réseau
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return {
      status: 500,
      message: 'Erreur de connexion. Veuillez réessayer plus tard.'
    };
  }

  // Erreur générique
  return {
    status: 500,
    message: `Erreur lors de ${context}. Veuillez réessayer.`
  };
};

/**
 * Fonction principale pour gérer toutes les erreurs.
 * @param error
 * @param context
 * @example
 */
const handleError = (error, context = 'opération') => {
  // Gestion des erreurs Prisma
  if (error.code && PRISMA_ERROR_CODES[error.code]) {
    return handlePrismaError(error, context);
  }

  // Gestion des erreurs générales
  return handleGeneralError(error, context);
};

module.exports = {
  handleError,
  handlePrismaError,
  handleGeneralError,
  PRISMA_ERROR_CODES
};
