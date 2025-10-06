const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeChurchAccess
} = require('../middlewares/auth');

const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  getDepartmentStats
} = require('../controllers/departmentController');

// Routes accessibles sans authentification (pour l'inscription)
router.get('/', getDepartments);

router.use(protect);



// Routes accessibles à tous les utilisateurs connectés (lecture)
router.get('/:id', getDepartment);
router.get('/:id/members', getDepartmentMembers);

// Routes accessibles uniquement aux super-admins (création, modification, suppression)
router.post('/', authorize('SUPER_ADMIN'), createDepartment);
router.get('/stats', authorize('SUPER_ADMIN'), getDepartmentStats);

router.route('/:id')
  .put(authorize('SUPER_ADMIN'), updateDepartment)
  .delete(authorize('SUPER_ADMIN'), deleteDepartment);

module.exports = router;
