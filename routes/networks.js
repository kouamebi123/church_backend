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
  getPublicNetworkGroups,
  getPublicNetworkDetails
} = require('../controllers/networkController');
const {
  getNetworkObjective,
  getNetworkObjectives,
  createNetworkObjective,
  updateNetworkObjective,
  deleteNetworkObjective
} = require('../controllers/objectiveController');

// Routes publiques pour l'inscription (avant le middleware protect)
router.get('/public', getPublicNetworks);
router.get('/public/:id/groups', getPublicNetworkGroups);
router.get('/public/:id/details', getPublicNetworkDetails);

router.use(protect);



router.use(requireChurchAssignment);

router.route('/')
  .get(getNetworks)
  .post(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, createNetwork);

router.get('/stats', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getNetworkStats);
router.get('/qualification-stats', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getNetworksQualificationStats);
router.get('/department-involvement', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getNetworksDepartmentInvolvement);

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

// Routes pour les objectifs de réseau
router.get('/:id/objectives', protect, authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getNetworkObjectives);
router.get('/:id/objective', protect, authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), getNetworkObjective);
router.post('/:id/objectives', protect, authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), createNetworkObjective);
router.put('/objectives/:objectiveId', protect, authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), updateNetworkObjective);
router.delete('/objectives/:objectiveId', protect, authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), deleteNetworkObjective);

module.exports = router;
