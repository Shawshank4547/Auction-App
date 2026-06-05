const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { uploadFile, deleteFile } = require('../utils/storage');

const createTeam = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { name, ownerId, totalBudget, minPlayers, maxPlayers } = req.body;

    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'teams');
    }

    const budget = parseInt(totalBudget);
    const result = await query(
      `INSERT INTO teams (auction_id, owner_id, name, logo_url, total_budget, remaining_budget, min_players, max_players)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
       RETURNING *`,
      [auctionId, ownerId || null, name, logoUrl, budget, parseInt(minPlayers) || 0, parseInt(maxPlayers) || 25]
    );

    // If owner provided, add them as participant
    if (ownerId) {
      await query(
        `INSERT INTO auction_participants (auction_id, user_id, team_id, role)
         VALUES ($1, $2, $3, 'bidder')
         ON CONFLICT (auction_id, user_id) DO UPDATE SET team_id = $3`,
        [auctionId, ownerId, result.rows[0].id]
      );
    }

    return sendSuccess(res, result.rows[0], 'Team created', 201);
  } catch (err) {
    if (err.code === '23505') return sendError(res, 'Team name already exists in this auction', 409);
    return sendError(res, 'Failed to create team', 500);
  }
};

const getTeams = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const result = await query(
      `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
       (SELECT COUNT(*) FROM player_sales ps WHERE ps.team_id = t.id AND ps.auction_id = $1) AS players_bought
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.auction_id = $1
       ORDER BY t.name`,
      [auctionId]
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch teams', 500);
  }
};

const getTeam = async (req, res) => {
  try {
    const { auctionId, teamId } = req.params;
    const teamResult = await query(
      `SELECT t.*, u.name AS owner_name FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.id = $1 AND t.auction_id = $2`,
      [teamId, auctionId]
    );
    if (!teamResult.rows.length) return sendError(res, 'Team not found', 404);

    const playersResult = await query(
      `SELECT p.*, ps.final_price FROM player_sales ps
       JOIN players p ON ps.player_id = p.id
       WHERE ps.team_id = $1 AND ps.auction_id = $2`,
      [teamId, auctionId]
    );

    return sendSuccess(res, { ...teamResult.rows[0], players: playersResult.rows });
  } catch (err) {
    return sendError(res, 'Failed to fetch team', 500);
  }
};

const updateTeam = async (req, res) => {
  try {
    const { auctionId, teamId } = req.params;

    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    const existing = await query(
      'SELECT * FROM teams WHERE id = $1 AND auction_id = $2',
      [teamId, auctionId]
    );
    if (!existing.rows.length) return sendError(res, 'Team not found', 404);

    const { name, ownerId, minPlayers, maxPlayers, isActive } = req.body;
    let logoUrl = existing.rows[0].logo_url;

    if (req.file) {
      if (logoUrl) await deleteFile(logoUrl).catch(() => {});
      logoUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'teams');
    }

    const result = await query(
      `UPDATE teams SET
        name = COALESCE($1, name),
        logo_url = $2,
        owner_id = COALESCE($3, owner_id),
        min_players = COALESCE($4, min_players),
        max_players = COALESCE($5, max_players),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
       WHERE id = $7 AND auction_id = $8
       RETURNING *`,
      [name, logoUrl, ownerId, minPlayers ? parseInt(minPlayers) : null,
       maxPlayers ? parseInt(maxPlayers) : null, isActive, teamId, auctionId]
    );

    return sendSuccess(res, result.rows[0], 'Team updated');
  } catch (err) {
    return sendError(res, 'Failed to update team', 500);
  }
};

const deleteTeam = async (req, res) => {
  try {
    const { auctionId, teamId } = req.params;

    const auctionCheck = await query(
      "SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2 AND status IN ('draft', 'scheduled')",
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Cannot delete team from a live auction', 400);

    const team = await query('SELECT * FROM teams WHERE id = $1 AND auction_id = $2', [teamId, auctionId]);
    if (!team.rows.length) return sendError(res, 'Team not found', 404);

    if (team.rows[0].logo_url) await deleteFile(team.rows[0].logo_url).catch(() => {});
    await query('DELETE FROM teams WHERE id = $1', [teamId]);
    return sendSuccess(res, {}, 'Team deleted');
  } catch (err) {
    return sendError(res, 'Failed to delete team', 500);
  }
};

const getTeamBids = async (req, res) => {
  try {
    const { auctionId, teamId } = req.params;
    const result = await query(
      `SELECT b.*, p.name AS player_name FROM bids b
       JOIN players p ON b.player_id = p.id
       WHERE b.team_id = $1 AND b.auction_id = $2 AND b.status = 'accepted'
       ORDER BY b.created_at DESC`,
      [teamId, auctionId]
    );
    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch team bids', 500);
  }
};

module.exports = { createTeam, getTeams, getTeam, updateTeam, deleteTeam, getTeamBids };
