const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const auth = require('../middlewares/auth');

// Récupérer l'historique des activités
router.get('/history', auth.protect, activityController.getActivityHistory);

// Récupérer les statistiques des activités
router.get('/stats', auth.protect, activityController.getActivityStats);

// Enregistrer une activité
router.post('/log', auth.protect, activityController.logActivity);

module.exports = router;
