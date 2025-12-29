const express = require('express');
const router = express.Router();
const {
  protect,
  authorize
} = require('../middlewares/auth');

const {
  // Speakers
  getSpeakers,
  getSpeakersAll,
  getSpeaker,
  createSpeaker,
  updateSpeaker,
  deleteSpeaker,
  // ServiceTypes
  getServiceTypes,
  getServiceTypesAll,
  getServiceType,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  // TestimonyCategories
  getTestimonyCategories,
  getTestimonyCategoriesAll,
  getTestimonyCategory,
  createTestimonyCategory,
  updateTestimonyCategory,
  deleteTestimonyCategory,
  // EventTypes
  getEventTypes,
  getEventTypesAll,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType
} = require('../controllers/referenceDataController');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour les Orateurs (Speakers)
router.get('/speakers', getSpeakers); // Actifs uniquement
router.get('/speakers/all', authorize('SUPER_ADMIN', 'ADMIN'), getSpeakersAll); // Tous (admin)
router.get('/speakers/:id', getSpeaker);
router.post('/speakers', authorize('SUPER_ADMIN', 'ADMIN'), createSpeaker);
router.put('/speakers/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateSpeaker);
router.delete('/speakers/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteSpeaker);

// Routes pour les Types de Culte (ServiceTypes)
router.get('/service-types', getServiceTypes); // Actifs uniquement
router.get('/service-types/all', authorize('SUPER_ADMIN', 'ADMIN'), getServiceTypesAll); // Tous (admin)
router.get('/service-types/:id', getServiceType);
router.post('/service-types', authorize('SUPER_ADMIN', 'ADMIN'), createServiceType);
router.put('/service-types/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateServiceType);
router.delete('/service-types/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteServiceType);

// Routes pour les Catégories de Témoignage (TestimonyCategories)
router.get('/testimony-categories', getTestimonyCategories); // Actifs uniquement
router.get('/testimony-categories/all', authorize('SUPER_ADMIN', 'ADMIN'), getTestimonyCategoriesAll); // Tous (admin)
router.get('/testimony-categories/:id', getTestimonyCategory);
router.post('/testimony-categories', authorize('SUPER_ADMIN', 'ADMIN'), createTestimonyCategory);
router.put('/testimony-categories/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateTestimonyCategory);
router.delete('/testimony-categories/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteTestimonyCategory);

// Routes pour les Types d'Événement (EventTypes)
router.get('/event-types', getEventTypes); // Actifs uniquement
router.get('/event-types/all', authorize('SUPER_ADMIN', 'ADMIN'), getEventTypesAll); // Tous (admin)
router.get('/event-types/:id', getEventType);
router.post('/event-types', authorize('SUPER_ADMIN', 'ADMIN'), createEventType);
router.put('/event-types/:id', authorize('SUPER_ADMIN', 'ADMIN'), updateEventType);
router.delete('/event-types/:id', authorize('SUPER_ADMIN', 'ADMIN'), deleteEventType);

module.exports = router;

