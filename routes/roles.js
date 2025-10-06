const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const roleController = require('../controllers/roleController');

// Routes pour les utilisateurs authentifiés
router.use(protect);

// Changer de rôle (pour tous les utilisateurs authentifiés)
router.post('/change-role', roleController.changeRole);

// Obtenir les rôles disponibles (pour tous les utilisateurs authentifiés)
router.get('/available-roles', roleController.getAvailableRoles);

// Routes pour les administrateurs uniquement
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Assigner un rôle à un utilisateur
router.post('/assign', roleController.assignRole);

// Retirer un rôle d'un utilisateur
router.delete('/remove', roleController.removeRole);

// Assigner plusieurs rôles à un utilisateur
router.post('/assign-multiple', roleController.assignMultipleRoles);

// Obtenir les rôles d'un utilisateur spécifique
router.get('/user/:userId', roleController.getUserRoles);

module.exports = router;
