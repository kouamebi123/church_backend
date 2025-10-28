const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeManagerNetworkAccess
} = require('../middlewares/auth');
const { requireChurchAssignment } = require('../middlewares/churchValidation');
const {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  addMember,
  removeMember
} = require('../controllers/unitController');

router.use(protect);
router.use(requireChurchAssignment);

router.route('/')
  .get(getUnits)
  .post(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, createUnit);

router.post('/:id/members', authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, addMember);
router.delete('/:id/members/:memberId', authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, removeMember);

router.route('/:id')
  .get(getUnit)
  .put(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, updateUnit)
  .delete(authorize('ADMIN', 'MANAGER'), authorizeManagerNetworkAccess, deleteUnit);

module.exports = router;
