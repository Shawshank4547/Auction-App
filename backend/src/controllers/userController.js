const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { uploadFile, deleteFile } = require('../utils/storage');

const getProfile = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to fetch profile', 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    let avatarUrl = existing.rows[0].avatar_url;

    if (req.file) {
      if (avatarUrl) await deleteFile(avatarUrl).catch(() => {});
      avatarUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'avatars');
    }

    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), avatar_url = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, email, name, role, avatar_url, created_at`,
      [name, avatarUrl, req.user.id]
    );
    return sendSuccess(res, result.rows[0], 'Profile updated');
  } catch (err) {
    return sendError(res, 'Failed to update profile', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return sendError(res, 'Current password is incorrect', 400);
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    return sendError(res, 'Failed to change password', 500);
  }
};

const getMyAuctions = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'organizer' || req.user.role === 'super_admin') {
      result = await query(
        `SELECT a.*, (SELECT COUNT(*) FROM teams WHERE auction_id = a.id) AS team_count
         FROM auctions a WHERE a.organizer_id = $1 ORDER BY a.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await query(
        `SELECT a.*, ap.team_id, t.name AS team_name,
         (SELECT COUNT(*) FROM teams WHERE auction_id = a.id) AS team_count
         FROM auction_participants ap
         JOIN auctions a ON ap.auction_id = a.id
         LEFT JOIN teams t ON ap.team_id = t.id
         WHERE ap.user_id = $1 ORDER BY a.created_at DESC`,
        [req.user.id]
      );
    }
    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch auctions', 500);
  }
};

module.exports = { getProfile, updateProfile, changePassword, getMyAuctions };
