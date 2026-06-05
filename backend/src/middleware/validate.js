const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Run express-validator checks and return 400 on failure
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  next();
};

module.exports = { validate };
