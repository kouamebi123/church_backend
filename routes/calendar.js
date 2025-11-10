const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const calendarController = require('../controllers/calendarController');

// Routes publiques
router.get('/public.ics', calendarController.exportPublicICS);
router.get('/public', calendarController.getPublicEvents);
router.get('/public/month', calendarController.getPublicEventsByMonth);
router.get('/public/:id', calendarController.getPublicEventById);

// Routes protégées (admin / super-admin)
router.get('/', protect, authorize('ADMIN'), calendarController.getEvents);
router.get('/:id', protect, authorize('ADMIN'), calendarController.getEventById);
router.post('/', protect, authorize('ADMIN'), calendarController.createEvent);
router.put('/:id', protect, authorize('ADMIN'), calendarController.updateEvent);
router.delete('/:id', protect, authorize('ADMIN'), calendarController.deleteEvent);

module.exports = router;

