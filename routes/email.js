const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { protect } = require('../middlewares/auth');

// Appliquer l'authentification à toutes les routes
router.use(protect);

// Envoyer un email de test
router.post('/test', emailController.sendTestEmail);

// Vérifier la configuration email
router.get('/config', emailController.checkEmailConfig);

module.exports = router;
