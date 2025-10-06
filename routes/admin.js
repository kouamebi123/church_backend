const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { invalidateCache, cache } = require('../middlewares/cache');


// Appliquer protect à toutes les routes
router.use(protect);



router.use(authorize('ADMIN', 'SUPER_ADMIN')); // Seuls les admins et super-admins peuvent accéder

// Route pour nettoyer le cache
router.post('/clear-cache', (req, res) => {
  try {
    const { pattern } = req.body;

    if (pattern) {
      invalidateCache(pattern);
      res.json({
        success: true,
        message: `Cache nettoyé pour le pattern: ${pattern}`,
        clearedKeys: Array.from(cache.keys()).filter(key => key.includes(pattern)).length
      });
    } else {
      // Nettoyer tout le cache
      const cacheSize = cache.size;
      cache.clear();
      res.json({
        success: true,
        message: 'Tout le cache a été nettoyé',
        clearedKeys: cacheSize
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du nettoyage du cache',
      error: error.message
    });
  }
});

// Route pour voir l'état du cache
router.get('/cache-status', (req, res) => {
  try {
    const cacheEntries = Array.from(cache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
      dataSize: JSON.stringify(value.data).length
    }));

    res.json({
      success: true,
      cacheSize: cache.size,
      entries: cacheEntries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut du cache',
      error: error.message
    });
  }
});

module.exports = router;
