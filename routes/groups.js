const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeManagerGroupAccess
} = require('../middlewares/auth');

const {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getAvailableResponsables
} = require('../controllers/groupController');

router.use(protect);



// Middleware de log pour déboguer - Supprimé pour la production
router.use('/:id/members', (req, res, next) => {
  next();
});

router.route('/')
  .get(getGroups)
  .post(authorize('admin', 'manager', 'collecteur_reseaux'), authorizeManagerGroupAccess, createGroup);

// Route pour récupérer les responsables disponibles pour le supérieur hiérarchique
router.get('/available-responsables', getAvailableResponsables);

router.route('/:id')
  .get(getGroup)
  .put(authorize('admin', 'manager', 'collecteur_reseaux'), authorizeManagerGroupAccess, updateGroup)
  .delete(authorize('admin', 'manager', 'collecteur_reseaux'), authorizeManagerGroupAccess, deleteGroup);

router.route('/:id/members')
  .post(authorize('admin', 'collecteur_reseaux', 'manager'), authorizeManagerGroupAccess, addMember);

router.route('/:id/members/:userId')
  .delete(authorize('admin', 'collecteur_reseaux', 'manager'), authorizeManagerGroupAccess, removeMember);

module.exports = router;
