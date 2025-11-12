const express = require('express');
const router = express.Router();
const appSettingsController = require('../controllers/appSettingsController');
const { protect } = require('../middlewares/auth');

// Route publique pour récupérer les paramètres
router.get('/', appSettingsController.getAppSettings);

// Route protégée pour mettre à jour les paramètres (admin seulement)
router.put('/', protect, appSettingsController.updateAppSettings);

module.exports = router;

