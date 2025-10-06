const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getReceivedMessages,
  getSentMessages,
  getConversations,
  markAsRead,
  markMultipleAsRead,
  acknowledgeMessage,
  getMessageStats,
  getUsersForMessaging,
  getConversationHistory,
  getMessageReadStatus
} = require('../controllers/messageController');
const { protect } = require('../middlewares/auth');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour les messages
router.post('/send', sendMessage);
router.get('/received', getReceivedMessages);
router.get('/sent', getSentMessages);
router.get('/conversations', getConversations);
router.put('/:id/read', markAsRead);
router.put('/mark-multiple-read', markMultipleAsRead);
router.put('/:id/acknowledge', acknowledgeMessage);
router.get('/stats', getMessageStats);
router.get('/users', getUsersForMessaging);
router.get('/conversation/:userId', getConversationHistory);
router.get('/:messageId/read-status', getMessageReadStatus);

module.exports = router;
