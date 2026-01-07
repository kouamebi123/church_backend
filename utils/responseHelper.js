/**
 * Helper pour standardiser les réponses API
 * Permet d'uniformiser le format des réponses dans tous les contrôleurs
 */

/**
 * Envoie une réponse de succès
 * @param {Object} res - Objet response Express
 * @param {*} data - Données à retourner
 * @param {number} statusCode - Code de statut HTTP (défaut: 200)
 * @param {string} message - Message optionnel
 * @returns {Object} Réponse Express
 */
exports.success = (res, data, statusCode = 200, message = null) => {
  const response = { success: true };
  if (data !== undefined) {
    response.data = data;
  }
  if (message) {
    response.message = message;
  }
  return res.status(statusCode).json(response);
};

/**
 * Envoie une réponse d'erreur
 * @param {Object} res - Objet response Express
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code de statut HTTP (défaut: 400)
 * @param {Array} errors - Tableau d'erreurs détaillées (optionnel)
 * @param {string} code - Code d'erreur personnalisé (optionnel)
 * @returns {Object} Réponse Express
 */
exports.error = (res, message, statusCode = 400, errors = null, code = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  if (code) {
    response.code = code;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Envoie une réponse 404 (Not Found)
 * @param {Object} res - Objet response Express
 * @param {string} resource - Nom de la ressource non trouvée (optionnel)
 * @returns {Object} Réponse Express
 */
exports.notFound = (res, resource = 'Ressource') => {
  return exports.error(res, `${resource} non trouvé(e)`, 404);
};

/**
 * Envoie une réponse 403 (Forbidden)
 * @param {Object} res - Objet response Express
 * @param {string} message - Message d'erreur (optionnel)
 * @returns {Object} Réponse Express
 */
exports.forbidden = (res, message = 'Accès interdit') => {
  return exports.error(res, message, 403, null, 'FORBIDDEN');
};

/**
 * Envoie une réponse 401 (Unauthorized)
 * @param {Object} res - Objet response Express
 * @param {string} message - Message d'erreur (optionnel)
 * @returns {Object} Réponse Express
 */
exports.unauthorized = (res, message = 'Non autorisé') => {
  return exports.error(res, message, 401, null, 'UNAUTHORIZED');
};

/**
 * Envoie une réponse 500 (Internal Server Error)
 * @param {Object} res - Objet response Express
 * @param {string} message - Message d'erreur (optionnel)
 * @param {Error} error - Erreur originale (optionnel, pour logging)
 * @returns {Object} Réponse Express
 */
exports.serverError = (res, message = 'Erreur interne du serveur', error = null) => {
  // Logger l'erreur si fournie
  if (error) {
    const logger = require('./logger');
    logger.error('Erreur serveur:', {
      message: error.message,
      stack: error.stack
    });
  }
  
  return exports.error(
    res,
    process.env.NODE_ENV === 'production' ? message : (error?.message || message),
    500,
    null,
    'INTERNAL_SERVER_ERROR'
  );
};

