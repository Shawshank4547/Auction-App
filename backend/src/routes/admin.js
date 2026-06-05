const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('super_admin'));
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/suspend', adminController.suspendUser);
router.patch('/users/:userId/activate', adminController.activateUser);
router.patch('/users/:userId/promote-organizer', adminController.promoteToOrganizer);
router.get('/auctions', adminController.getAllAuctions);
router.get('/stats', adminController.getPlatformStats);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
