const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeManagerServiceAccess
} = require('../middlewares/auth');

const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getServiceStats,
  getServicesByPeriod
} = require('../controllers/serviceController');

router.use(protect);



router.route('/')
  .get(getServices)
  .post(authorize('admin', 'collecteur_culte', 'manager', 'superviseur'), authorizeManagerServiceAccess, createService);

router.get('/stats', authorize('admin', 'manager'), getServiceStats);
router.get('/period', getServicesByPeriod);

router.route('/:id')
  .get(getService)
  .put(authorize('admin', 'collecteur_culte', 'manager', 'superviseur'), authorizeManagerServiceAccess, updateService)
  .delete(authorize('admin', 'manager', 'superviseur'), authorizeManagerServiceAccess, deleteService);

module.exports = router;
