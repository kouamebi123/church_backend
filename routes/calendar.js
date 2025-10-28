const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../middlewares/auth');

// Routes publiques (sans authentification)
router.get('/public', calendarController.getPublicEvents);
router.get('/public/month', calendarController.getEventsByMonth);
router.get('/public/:id', calendarController.getEventById);

// Routes protégées (avec authentification)
router.get('/', auth, calendarController.getAllEvents);
router.post('/', auth, calendarController.createEvent);
router.put('/:id', auth, calendarController.updateEvent);
router.delete('/:id', auth, calendarController.deleteEvent);
router.get('/:id', auth, calendarController.getEventById);

module.exports = router;
