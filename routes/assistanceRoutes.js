const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  createAssistance,
  getAssistanceStats,
  getAssistanceById,
  updateAssistance,
  deleteAssistance
} = require('../controllers/assistanceController');

// Protéger toutes les routes
router.use(protect);

// Routes pour l'assistance
router.post('/',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MANAGER'),
  createAssistance
);

router.get('/stats',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MANAGER'),
  getAssistanceStats
);

router.get('/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MANAGER'),
  getAssistanceById
);

router.put('/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MANAGER'),
  updateAssistance
);

router.delete('/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MANAGER'),
  deleteAssistance
);

module.exports = router;
