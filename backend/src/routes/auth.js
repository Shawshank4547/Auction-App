const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
  ],
  validate,
  authController.register
);

router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  authController.login
);

router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  authController.refresh
);

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
