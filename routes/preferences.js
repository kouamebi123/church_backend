const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferencesController');
const { protect } = require('../middlewares/auth');

// Appliquer l'authentification à toutes les routes
router.use(protect);

// Récupérer les préférences de l'utilisateur connecté
router.get('/', preferencesController.getPreferences);

// Mettre à jour toutes les préférences
router.put('/', preferencesController.updatePreferences);

// Mettre à jour uniquement les préférences email
router.put('/email', preferencesController.updateEmailPreferences);

module.exports = router;

