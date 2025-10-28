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
  getSessionStatsById,
  getSessionUnits
} = require('../controllers/sessionController');

router.use(protect);
router.use(requireChurchAssignment);

router.route('/')
  .get(getSessions)
  .post(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, createSession);

// Routes spécifiques AVANT la route générique pour éviter les conflits
router.get('/:id/stats', getSessionStatsById);
router.get('/:id/units', getSessionUnits);

router.route('/:id')
  .get(getSession)
  .put(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, updateSession)
  .delete(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, deleteSession);

module.exports = router;
