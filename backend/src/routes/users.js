const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

router.get('/profile', authenticate, userController.getProfile);
router.patch('/profile', authenticate, upload.single('avatar'), handleUploadError, userController.updateProfile);
router.post('/change-password', authenticate, userController.changePassword);
router.get('/my-auctions', authenticate, userController.getMyAuctions);

module.exports = router;
