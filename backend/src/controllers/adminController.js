const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const auditService = require('../services/auditService');

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (role) { where = 'WHERE role = $1'; params.push(role); }

    const result = await query(
      `SELECT id, email, name, role, is_active, created_at FROM users ${where}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch users', 500);
  }
};

const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return sendError(res, 'Cannot suspend yourself', 400);

    await query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
    await auditService.log({
      userId: req.user.id,
      action: 'user_suspended',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, {}, 'User suspended');
  } catch (err) {
    return sendError(res, 'Failed to suspend user', 500);
  }
};

const activateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await query('UPDATE users SET is_active = true WHERE id = $1', [userId]);
    return sendSuccess(res, {}, 'User activated');
  } catch (err) {
    return sendError(res, 'Failed to activate user', 500);
  }
};

const promoteToOrganizer = async (req, res) => {
  try {
    const { userId } = req.params;
    await query("UPDATE users SET role = 'organizer' WHERE id = $1", [userId]);
    return sendSuccess(res, {}, 'User promoted to organizer');
  } catch (err) {
    return sendError(res, 'Failed to promote user', 500);
  }
};

const getAllAuctions = async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, u.name AS organizer_name,
       (SELECT COUNT(*) FROM teams WHERE auction_id = a.id) AS team_count,
       (SELECT COUNT(*) FROM players WHERE auction_id = a.id) AS player_count
       FROM auctions a
       JOIN users u ON a.organizer_id = u.id
       ORDER BY a.created_at DESC`
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch auctions', 500);
  }
};

const getPlatformStats = async (req, res) => {
  try {
    const [users, auctions, bids, sales] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT status, COUNT(*) FROM auctions GROUP BY status'),
      query('SELECT COUNT(*) FROM bids WHERE status = $1', ['accepted']),
      query('SELECT COUNT(*), SUM(final_price) FROM player_sales'),
    ]);

    return sendSuccess(res, {
      totalUsers: parseInt(users.rows[0].count),
      auctionsByStatus: auctions.rows,
      totalBids: parseInt(bids.rows[0].count),
      totalSales: parseInt(sales.rows[0].count),
      totalRevenue: parseInt(sales.rows[0].sum) || 0,
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch stats', 500);
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const { auctionId, page = 1, limit = 50 } = req.query;
    const { logs, total } = await auditService.getAuctionLogs(auctionId, page, limit);
    return sendSuccess(res, { logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return sendError(res, 'Failed to fetch audit logs', 500);
  }
};

module.exports = { getAllUsers, suspendUser, activateUser, promoteToOrganizer, getAllAuctions, getPlatformStats, getAuditLogs };
