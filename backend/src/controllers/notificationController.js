const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const notificationService = require('../services/notificationService');

const getNotifications = async (req, res) => {
  try {
    const { auctionId, page = 1, limit = 20 } = req.query;
    const notifications = await notificationService.getUserNotifications(
      req.user.id, auctionId || null, parseInt(page), parseInt(limit)
    );
    return sendSuccess(res, notifications);
  } catch (err) {
    return sendError(res, 'Failed to fetch notifications', 500);
  }
};

const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markRead(id, req.user.id);
    return sendSuccess(res, {}, 'Notification marked as read');
  } catch (err) {
    return sendError(res, 'Failed to mark notification', 500);
  }
};

const markAllRead = async (req, res) => {
  try {
    const { auctionId } = req.query;
    let q = `UPDATE notifications SET is_read = true WHERE (user_id = $1 OR team_id IN (
      SELECT team_id FROM auction_participants WHERE user_id = $1
    ))`;
    const params = [req.user.id];
    if (auctionId) {
      q += ` AND auction_id = $2`;
      params.push(auctionId);
    }
    await query(q, params);
    return sendSuccess(res, {}, 'All notifications marked as read');
  } catch (err) {
    return sendError(res, 'Failed to mark notifications', 500);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) FROM notifications
       WHERE is_read = false AND (user_id = $1 OR team_id IN (
         SELECT team_id FROM auction_participants WHERE user_id = $1
       ))`,
      [req.user.id]
    );
    return sendSuccess(res, { count: parseInt(result.rows[0].count) });
  } catch (err) {
    return sendError(res, 'Failed to get unread count', 500);
  }
};

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount };
