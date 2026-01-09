const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  getChaineImpact,
  updateChaineImpact,
  getChaineImpactByUser,
  deleteChaineImpact
} = require('../controllers/chaineImpactController');

// Routes protégées
router.use(protect);

// Récupérer la chaine d'impact d'une église
router.get('/',
  authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  getChaineImpact
);

// Mettre à jour la chaine d'impact automatiquement
router.post('/update',
  authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  updateChaineImpact
);

// Récupérer la chaine d'impact d'un utilisateur spécifique
router.get('/user/:user_id',
  authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'),
  getChaineImpactByUser
);

// Supprimer la chaine d'impact d'une église
router.delete('/:church_id',
  authorize('ADMIN', 'SUPER_ADMIN'),
  deleteChaineImpact
);

module.exports = router;
