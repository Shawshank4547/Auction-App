const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a notification for a user or team
 */
const createNotification = async ({
  auctionId = null,
  userId = null,
  teamId = null,
  type,
  title,
  message,
  data = {},
}) => {
  try {
    const result = await query(
      `INSERT INTO notifications (auction_id, user_id, team_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [auctionId, userId, teamId, type, title, message, JSON.stringify(data)]
    );
    return result.rows[0];
  } catch (err) {
    logger.error('Failed to create notification:', err);
    return null;
  }
};

/**
 * Broadcast a notification to all team members in an auction
 */
const notifyTeam = async (io, auctionId, teamId, notification) => {
  const notif = await createNotification({ auctionId, teamId, ...notification });
  if (notif) {
    io.to(`team:${teamId}`).emit('notification', notif);
  }
};

/**
 * Broadcast to all auction participants
 */
const notifyAuction = async (io, auctionId, notification) => {
  const notif = await createNotification({ auctionId, ...notification });
  if (notif) {
    io.to(`auction:${auctionId}`).emit('notification', notif);
  }
};

/**
 * Get user notifications
 */
const getUserNotifications = async (userId, auctionId = null, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let queryText = `
    SELECT * FROM notifications
    WHERE user_id = $1 OR team_id IN (
      SELECT team_id FROM auction_participants WHERE user_id = $1 AND auction_id = $2
    )
  `;
  const params = [userId, auctionId];
  if (auctionId) {
    queryText += ` AND auction_id = $2`;
  }
  queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(queryText, params);
  return result.rows;
};

/**
 * Mark notification as read
 */
const markRead = async (notificationId, userId) => {
  await query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND (user_id = $2 OR team_id IN (
      SELECT team_id FROM auction_participants WHERE user_id = $2
    ))`,
    [notificationId, userId]
  );
};

module.exports = { createNotification, notifyTeam, notifyAuction, getUserNotifications, markRead };
