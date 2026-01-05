const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeManagerNetworkAccess
} = require('../middlewares/auth');
const { requireChurchAssignment } = require('../middlewares/churchValidation');
const {
  getSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getSessionsStats,
  getSessionStatsById,
  getSessionUnits
} = require('../controllers/sessionController');

router.use(protect);
router.use(requireChurchAssignment);

router.route('/')
  .get(getSessions)
  .post(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, createSession);

// Route pour récupérer toutes les stats des sessions d'une église
router.get('/stats', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getSessionsStats);

// Routes spécifiques AVANT la route générique pour éviter les conflits
router.get('/:id/stats', getSessionStatsById);
router.get('/:id/units', getSessionUnits);

router.route('/:id')
  .get(getSession)
  .put(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, updateSession)
  .delete(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, deleteSession);

module.exports = router;
