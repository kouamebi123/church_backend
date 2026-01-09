const express = require('express');
const router = express.Router();
const { getGlobalStats, getNetworksEvolution, compareNetworksByYear } = require('../controllers/statsController');
const { protect, authorize } = require('../middlewares/auth');
const { statsCache } = require('../middlewares/smartCache');
const { cacheMiddleware } = require('../middlewares/cache');


// Appliquer protect à toutes les routes
router.use(protect);



// Routes avec cache pour améliorer les performances
// Accessibles à tous les utilisateurs authentifiés (avec filtrage par église dans le contrôleur)
router.get('/', cacheMiddleware(2 * 60 * 1000), getGlobalStats); // 2 minutes
router.get('/networks/evolution', authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), cacheMiddleware(5 * 60 * 1000), getNetworksEvolution); // 5 minutes
router.get('/networks/evolution/compare', authorize('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), cacheMiddleware(5 * 60 * 1000), compareNetworksByYear); // 5 minutes

module.exports = router;
