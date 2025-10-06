const express = require('express');
const { createEmergencySuperAdmin } = require('../controllers/emergencyController');

const router = express.Router();

// Endpoint d'urgence pour créer un super admin
// Ne fonctionne que si aucun super admin n'existe
router.post('/create-super-admin', createEmergencySuperAdmin);

module.exports = router;
