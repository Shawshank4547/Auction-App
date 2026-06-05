const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const auditService = require('../services/auditService');
const { generateOTP, sendOTPEmail } = require('../services/otpService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helper: issue tokens and return user ─────────────────────────────────────
const issueTokens = async (user) => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });
  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);
  return { accessToken, refreshToken };
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: Password register (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return sendError(res, 'Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { code, expiresAt } = generateOTP();

    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, auth_provider, otp_code, otp_expires_at, is_verified)
       VALUES ($1, $2, $3, 'bidder', 'local', $4, $5, false)
       RETURNING id, email, name, role`,
      [email.toLowerCase(), passwordHash, name, code, expiresAt]
    );

    const user = result.rows[0];

    // Send OTP email
    const sent = await sendOTPEmail(email, name, code);
    if (!sent) {
      // Don't block registration if email fails — just log
      console.error('OTP email failed for', email);
    }

    await auditService.log({ userId: user.id, action: 'register', ipAddress: req.ip });

    return sendSuccess(
      res,
      { userId: user.id, email: user.email, requiresOtp: true },
      'Registration successful. Please verify your email with the OTP sent.',
      201
    );
  } catch (err) {
    return sendError(res, 'Registration failed', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: Password login (now also checks is_verified)
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, name, role, password_hash, is_active, is_verified, auth_provider FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) return sendError(res, 'Invalid credentials', 401);

    const user = result.rows[0];

    if (!user.is_active) return sendError(res, 'Account suspended', 403);

    if (user.auth_provider === 'google') {
      return sendError(res, 'This account uses Google login. Please sign in with Google.', 400);
    }

    if (!user.password_hash) return sendError(res, 'Invalid credentials', 401);

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return sendError(res, 'Invalid credentials', 401);

    // If email not verified, send a fresh OTP and ask them to verify
    if (!user.is_verified) {
      const { code, expiresAt } = generateOTP();
      await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
      await sendOTPEmail(user.email, user.name, code);
      return sendError(res, 'Email not verified. A new OTP has been sent to your email.', 403);
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    await auditService.log({ userId: user.id, action: 'login', ipAddress: req.ip });

    const { password_hash, ...safeUser } = user;
    return sendSuccess(res, { user: safeUser, accessToken, refreshToken }, 'Login successful');
  } catch (err) {
    return sendError(res, 'Login failed', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Verify OTP (for password-registered users)
// ─────────────────────────────────────────────────────────────────────────────
const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const result = await query(
      'SELECT id, email, name, role, is_active, otp_code, otp_expires_at, is_verified FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) return sendError(res, 'User not found', 404);

    const user = result.rows[0];

    if (user.is_verified) {
      // Already verified — just log them in
      const { accessToken, refreshToken } = await issueTokens(user);
      return sendSuccess(res, { user, accessToken, refreshToken }, 'Already verified');
    }

    if (!user.otp_code || !user.otp_expires_at) {
      return sendError(res, 'No OTP found. Please request a new one.', 400);
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return sendError(res, 'OTP has expired. Please request a new one.', 400);
    }

    if (user.otp_code !== otp.trim()) {
      return sendError(res, 'Invalid OTP', 400);
    }

    // Mark verified, clear OTP
    await query(
      'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    const { accessToken, refreshToken } = await issueTokens(user);
    await auditService.log({ userId: user.id, action: 'email_verified', ipAddress: req.ip });

    return sendSuccess(res, { user, accessToken, refreshToken }, 'Email verified successfully');
  } catch (err) {
    return sendError(res, 'OTP verification failed', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Resend OTP
// ─────────────────────────────────────────────────────────────────────────────
const resendOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    const result = await query(
      'SELECT id, email, name, is_verified FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) return sendError(res, 'User not found', 404);

    const user = result.rows[0];
    if (user.is_verified) return sendError(res, 'Email already verified', 400);

    const { code, expiresAt } = generateOTP();
    await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);
    await sendOTPEmail(user.email, user.name, code);

    return sendSuccess(res, {}, 'OTP resent successfully');
  } catch (err) {
    return sendError(res, 'Failed to resend OTP', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Google OAuth — verify ID token from frontend, login or register user,
//      then send OTP to their Gmail for 2FA
// ─────────────────────────────────────────────────────────────────────────────
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return sendError(res, 'Google ID token required', 400);

    // Verify token with Google
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return sendError(res, 'Invalid Google token', 401);
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find existing user by google_id or email
    let userResult = await query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2 LIMIT 1',
      [googleId, email.toLowerCase()]
    );

    let user;

    if (userResult.rows.length) {
      user = userResult.rows[0];

      // If found by email but not yet linked to Google, link now
      if (!user.google_id) {
        await query(
          'UPDATE users SET google_id = $1, auth_provider = $2, avatar_url = COALESCE(avatar_url, $3) WHERE id = $4',
          [googleId, 'google', picture, user.id]
        );
        user.google_id = googleId;
      }

      if (!user.is_active) return sendError(res, 'Account suspended', 403);
    } else {
      // New user — create account
      const newUser = await query(
        `INSERT INTO users (email, name, google_id, avatar_url, role, auth_provider, is_verified, password_hash)
         VALUES ($1, $2, $3, $4, 'bidder', 'google', false, NULL)
         RETURNING *`,
        [email.toLowerCase(), name, googleId, picture]
      );
      user = newUser.rows[0];
      await auditService.log({ userId: user.id, action: 'register', ipAddress: req.ip });
    }

    // Send OTP to their Gmail for 2FA
    const { code, expiresAt } = generateOTP();
    await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [code, expiresAt, user.id]);

    const sent = await sendOTPEmail(user.email, user.name, code);
    if (!sent) {
      return sendError(res, 'Failed to send verification email. Please try again.', 500);
    }

    return sendSuccess(
      res,
      { userId: user.id, email: user.email, name: user.name, requiresOtp: true },
      'OTP sent to your Gmail. Please verify to continue.'
    );
  } catch (err) {
    console.error('googleAuth error:', err);
    return sendError(res, 'Google authentication failed', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Verify OTP after Google login (marks verified + issues tokens)
// ─────────────────────────────────────────────────────────────────────────────
const googleVerifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const result = await query(
      'SELECT id, email, name, role, is_active, otp_code, otp_expires_at FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) return sendError(res, 'User not found', 404);

    const user = result.rows[0];
    if (!user.is_active) return sendError(res, 'Account suspended', 403);

    if (!user.otp_code || !user.otp_expires_at) {
      return sendError(res, 'No OTP found. Please restart the login process.', 400);
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return sendError(res, 'OTP has expired. Please sign in with Google again.', 400);
    }

    if (user.otp_code !== otp.trim()) {
      return sendError(res, 'Invalid OTP', 400);
    }

    // Mark verified, clear OTP
    await query(
      'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    const { accessToken, refreshToken } = await issueTokens(user);
    await auditService.log({ userId: user.id, action: 'login', ipAddress: req.ip });

    // Fetch full safe user
    const fullUser = await query(
      'SELECT id, email, name, role, avatar_url, is_active, created_at FROM users WHERE id = $1',
      [user.id]
    );

    return sendSuccess(
      res,
      { user: fullUser.rows[0], accessToken, refreshToken },
      'Login successful'
    );
  } catch (err) {
    return sendError(res, 'OTP verification failed', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: refresh, logout, getMe (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return sendError(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(refreshToken);
    const result = await query(
      'SELECT id, email, name, role, is_active, refresh_token FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || result.rows[0].refresh_token !== refreshToken) {
      return sendError(res, 'Invalid refresh token', 401);
    }

    const user = result.rows[0];
    if (!user.is_active) return sendError(res, 'Account suspended', 403);

    const newAccessToken = generateAccessToken({ id: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ id: user.id });
    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    return sendSuccess(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
};

const logout = async (req, res) => {
  try {
    await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
    await auditService.log({ userId: req.user.id, action: 'logout', ipAddress: req.ip });
    return sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) {
    return sendError(res, 'Logout failed', 500);
  }
};

const getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to get user', 500);
  }
};

module.exports = {
  register,
  login,
  verifyOTP,
  resendOTP,
  googleAuth,
  googleVerifyOTP,
  refresh,
  logout,
  getMe,
};