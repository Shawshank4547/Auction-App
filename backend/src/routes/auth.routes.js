const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Stricter rate limit for auth applied in index.js

// ── Password auth ─────────────────────────────────────────────────────────────
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

// ── OTP verification ──────────────────────────────────────────────────────────
router.post('/verify-otp',
  [body('userId').notEmpty(), body('otp').isLength({ min: 6, max: 6 })],
  validate,
  authController.verifyOTP
);

router.post('/resend-otp',
  [body('userId').notEmpty()],
  validate,
  authController.resendOTP
);

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Frontend sends the Google ID token obtained from Google Sign-In
router.post('/google',
  [body('idToken').notEmpty()],
  validate,
  authController.googleAuth
);

// Verify OTP after Google login (2FA step)
router.post('/google/verify-otp',
  [body('userId').notEmpty(), body('otp').isLength({ min: 6, max: 6 })],
  validate,
  authController.googleVerifyOTP
);

// ── Token management ──────────────────────────────────────────────────────────
router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  authController.refresh
);

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;