const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { query } = require('../config/database');

/**
 * Verify JWT access token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Verify user still exists and is active
    const result = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return sendError(res, 'User not found or inactive', 401);
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token expired', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token', 401);
    }
    return sendError(res, 'Authentication failed', 401);
  }
};

/**
 * Require specific roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

/**
 * Optional authentication - attaches user if token present but doesn't fail
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const result = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    if (result.rows.length && result.rows[0].is_active) {
      req.user = result.rows[0];
    }
  } catch (_) {
    // Ignore auth errors for optional auth
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
