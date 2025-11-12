const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { protect } = require('../middlewares/auth');

// Route publique pour créer un message de contact (sans authentification)
router.post('/', contactController.createContact);

// Routes protégées pour les administrateurs
router.use(protect);

// Récupérer tous les messages de contact
router.get('/', contactController.getContacts);

// Marquer un message comme lu
router.put('/:id/read', contactController.markAsRead);

// Supprimer un message de contact
router.delete('/:id', contactController.deleteContact);

module.exports = router;

