const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, notificationController.getNotifications);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.patch('/:id/read', authenticate, notificationController.markRead);
router.post('/mark-all-read', authenticate, notificationController.markAllRead);

module.exports = router;
