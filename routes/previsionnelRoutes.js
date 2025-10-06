const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  createPrevisionnel,
  getPrevisionnelsByNetwork,
  getPrevisionnelById,
  updatePrevisionnel,
  deletePrevisionnel,
  getPrevisionnelStats
} = require('../controllers/previsionnelController');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour les prévisionnels
// POST /api/previsionnels - Créer un nouveau prévisionnel
router.post('/', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER'), 
  createPrevisionnel
);

// GET /api/previsionnels/network/:networkId - Récupérer les prévisionnels d'un réseau
router.get('/network/:networkId', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER', 'COLLECTEUR_CULTE'), 
  getPrevisionnelsByNetwork
);

// GET /api/previsionnels/stats - Récupérer les statistiques de prévisionnels
router.get('/stats', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER', 'COLLECTEUR_CULTE'), 
  getPrevisionnelStats
);

// GET /api/previsionnels/:id - Récupérer un prévisionnel par ID
router.get('/:id', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER', 'COLLECTEUR_CULTE'), 
  getPrevisionnelById
);

// PUT /api/previsionnels/:id - Mettre à jour un prévisionnel
router.put('/:id', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER'), 
  updatePrevisionnel
);

// DELETE /api/previsionnels/:id - Supprimer un prévisionnel
router.delete('/:id', 
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER'), 
  deletePrevisionnel
);

module.exports = router;
