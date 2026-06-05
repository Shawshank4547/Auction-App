const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Record an audit log entry
 */
const log = async ({
  auctionId = null,
  userId = null,
  action,
  entityType = null,
  entityId = null,
  details = {},
  ipAddress = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs (auction_id, user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [auctionId, userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    logger.error('Failed to write audit log:', err);
  }
};

/**
 * Get audit logs for an auction with pagination
 */
const getAuctionLogs = async (auctionId, page = 1, limit = 50) => {
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT al.*, u.name AS user_name, u.email AS user_email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.auction_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    [auctionId, limit, offset]
  );
  const countResult = await query(
    'SELECT COUNT(*) FROM audit_logs WHERE auction_id = $1',
    [auctionId]
  );
  return { logs: result.rows, total: parseInt(countResult.rows[0].count) };
};

module.exports = { log, getAuctionLogs };
