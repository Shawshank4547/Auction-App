const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const auditService = require('../services/auditService');

const register = async (req, res) => {
  try {
    const { email, password, name, role = 'bidder' } = req.body;

    // Only super_admin can create organizers or admins
    const allowedRoles = ['bidder', 'viewer'];
    const actualRole = allowedRoles.includes(role) ? role : 'bidder';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return sendError(res, 'Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), passwordHash, name, actualRole]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    await auditService.log({
      userId: user.id,
      action: 'register',
      ipAddress: req.ip,
    });

    return sendSuccess(res, { user, accessToken, refreshToken }, 'Registered successfully', 201);
  } catch (err) {
    return sendError(res, 'Registration failed', 500);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!result.rows.length) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return sendError(res, 'Account suspended', 403);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const accessToken = generateAccessToken({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    await auditService.log({
      userId: user.id,
      action: 'login',
      ipAddress: req.ip,
    });

    const { password_hash, ...safeUser } = user;
    return sendSuccess(res, { user: safeUser, accessToken, refreshToken }, 'Login successful');
  } catch (err) {
    return sendError(res, 'Login failed', 500);
  }
};

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

module.exports = { register, login, refresh, logout, getMe };
