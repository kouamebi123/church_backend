const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeAdminReadOnly,
  authorizeManagerNetworkAccess
} = require('../middlewares/auth');
const { requireChurchAssignment } = require('../middlewares/churchValidation');
const {
  getNetworks,
  getNetwork,
  createNetwork,
  updateNetwork,
  deleteNetwork,
  getNetworkStats,
  getNetworkStatsById,
  getNetworkGroups,
  getNetworkMembers,
  getNetworksQualificationStats,
  getNetworksDepartmentInvolvement,
  addCompanion,
  removeCompanion,
  getNetworkCompanions,
  getPublicNetworks,
  getPublicNetworkGroups
} = require('../controllers/networkController');

// Routes publiques pour l'inscription (avant le middleware protect)
router.get('/public', getPublicNetworks);
router.get('/public/:id/groups', getPublicNetworkGroups);

router.use(protect);



router.use(requireChurchAssignment);

router.route('/')
  .get(getNetworks)
  .post(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, createNetwork);

router.get('/stats', authorize('ADMIN', 'MANAGER'), getNetworkStats);
router.get('/qualification-stats', authorize('ADMIN', 'MANAGER'), getNetworksQualificationStats);
router.get('/department-involvement', authorize('ADMIN', 'MANAGER'), getNetworksDepartmentInvolvement);

router.get('/:id/stats', getNetworkStatsById);
router.get('/:id/grs', getNetworkGroups);
router.get('/:id/members', getNetworkMembers);
router.get('/:id/companions', getNetworkCompanions);

router.route('/:id/companions')
  .post(authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), authorizeManagerNetworkAccess, addCompanion);

router.route('/:id/companions/:companionId')
  .delete(authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), authorizeManagerNetworkAccess, removeCompanion);

router.route('/:id')
  .get(getNetwork)
  .put(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, updateNetwork)
  .delete(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, deleteNetwork);

module.exports = router;
