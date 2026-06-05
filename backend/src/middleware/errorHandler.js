const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id,
  });

  if (err.name === 'ValidationError') {
    return sendError(res, err.message, 400);
  }

  if (err.code === '23505') {
    return sendError(res, 'Duplicate entry - resource already exists', 409);
  }

  if (err.code === '23503') {
    return sendError(res, 'Referenced resource not found', 404);
  }

  return sendError(res, 'Internal server error', 500);
};

/**
 * 404 handler
 */
const notFound = (req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFound };
