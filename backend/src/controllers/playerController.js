const { query } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { uploadFile, deleteFile } = require('../utils/storage');
const auditService = require('../services/auditService');

const createPlayer = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { name, category, role, basePrice, description, statistics } = req.body;

    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'players');
    }

    const sortRes = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM players WHERE auction_id = $1',
      [auctionId]
    );

    const result = await query(
      `INSERT INTO players (auction_id, name, photo_url, category, role, base_price, description, statistics, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        auctionId, name, photoUrl, category, role,
        parseInt(basePrice), description,
        statistics ? JSON.stringify(statistics) : '{}',
        sortRes.rows[0].next,
      ]
    );

    await auditService.log({
      auctionId,
      userId: req.user.id,
      action: 'player_created',
      entityType: 'player',
      entityId: result.rows[0].id,
    });

    return sendSuccess(res, result.rows[0], 'Player created', 201);
  } catch (err) {
    return sendError(res, 'Failed to create player', 500);
  }
};

const getPlayers = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { status, category, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const params = [auctionId];
    let where = 'WHERE p.auction_id = $1';

    if (status) {
      where += ` AND p.status = $${params.length + 1}`;
      params.push(status);
    }
    if (category) {
      where += ` AND p.category = $${params.length + 1}`;
      params.push(category);
    }

    const result = await query(
      `SELECT p.*, ps.team_id AS sold_to_team_id, t.name AS sold_to_team
       FROM players p
       LEFT JOIN player_sales ps ON ps.player_id = p.id
       LEFT JOIN teams t ON ps.team_id = t.id
       ${where}
       ORDER BY p.sort_order ASC, p.created_at ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM players p ${where}`,
      params
    );

    return sendPaginated(res, result.rows, parseInt(countResult.rows[0].count), page, limit);
  } catch (err) {
    return sendError(res, 'Failed to fetch players', 500);
  }
};

const getPlayer = async (req, res) => {
  try {
    const { auctionId, playerId } = req.params;
    const result = await query(
      `SELECT p.*, ps.final_price, ps.team_id AS sold_to_team_id, t.name AS sold_to_team
       FROM players p
       LEFT JOIN player_sales ps ON ps.player_id = p.id
       LEFT JOIN teams t ON ps.team_id = t.id
       WHERE p.id = $1 AND p.auction_id = $2`,
      [playerId, auctionId]
    );
    if (!result.rows.length) return sendError(res, 'Player not found', 404);
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to fetch player', 500);
  }
};

const updatePlayer = async (req, res) => {
  try {
    const { auctionId, playerId } = req.params;

    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    const existing = await query(
      'SELECT * FROM players WHERE id = $1 AND auction_id = $2',
      [playerId, auctionId]
    );
    if (!existing.rows.length) return sendError(res, 'Player not found', 404);

    const { name, category, role, basePrice, description, statistics, status } = req.body;
    let photoUrl = existing.rows[0].photo_url;

    if (req.file) {
      if (photoUrl) await deleteFile(photoUrl).catch(() => {});
      photoUrl = await uploadFile(req.file.buffer, req.file.mimetype, 'players');
    }

    const result = await query(
      `UPDATE players SET
        name = COALESCE($1, name),
        photo_url = $2,
        category = COALESCE($3, category),
        role = COALESCE($4, role),
        base_price = COALESCE($5, base_price),
        description = COALESCE($6, description),
        statistics = COALESCE($7, statistics),
        status = COALESCE($8, status),
        updated_at = NOW()
       WHERE id = $9 AND auction_id = $10
       RETURNING *`,
      [
        name, photoUrl, category, role,
        basePrice ? parseInt(basePrice) : null,
        description,
        statistics ? JSON.stringify(statistics) : null,
        status, playerId, auctionId,
      ]
    );

    return sendSuccess(res, result.rows[0], 'Player updated');
  } catch (err) {
    return sendError(res, 'Failed to update player', 500);
  }
};

const deletePlayer = async (req, res) => {
  try {
    const { auctionId, playerId } = req.params;

    // Verify organizer owns this auction
    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    // Only allow deleting players that haven't been sold / are not currently live
    const player = await query(
      "SELECT * FROM players WHERE id = $1 AND auction_id = $2 AND status IN ('draft', 'available', 'unsold')",
      [playerId, auctionId]
    );
    if (!player.rows.length) {
      return sendError(res, 'Player not found or cannot be deleted (sold or currently live)', 404);
    }

    // Delete auction_items rows referencing this player first (FK constraint)
    await query(
      "DELETE FROM auction_items WHERE player_id = $1 AND auction_id = $2 AND status IN ('pending', 'unsold', 'skipped')",
      [playerId, auctionId]
    );

    // Delete the player
    await query('DELETE FROM players WHERE id = $1', [playerId]);

    // Clean up photo from storage
    if (player.rows[0].photo_url) {
      await deleteFile(player.rows[0].photo_url).catch(() => {});
    }

    return sendSuccess(res, {}, 'Player deleted');
  } catch (err) {
    return sendError(res, 'Failed to delete player', 500);
  }
};

const bulkCreatePlayers = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { players } = req.body;

    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    const sortRes = await query(
      'SELECT COALESCE(MAX(sort_order), 0) AS max FROM players WHERE auction_id = $1',
      [auctionId]
    );
    let sortOrder = parseInt(sortRes.rows[0].max);

    const created = [];
    for (const p of players) {
      sortOrder++;
      const result = await query(
        `INSERT INTO players (auction_id, name, category, role, base_price, description, statistics, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [auctionId, p.name, p.category, p.role, parseInt(p.basePrice), p.description, JSON.stringify(p.statistics || {}), sortOrder]
      );
      created.push(result.rows[0]);
    }

    return sendSuccess(res, created, `${created.length} players created`, 201);
  } catch (err) {
    return sendError(res, 'Failed to bulk create players', 500);
  }
};

const schedulePlayersForAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { playerIds, roundNumber = 1 } = req.body;

    const auctionCheck = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Auction not found', 404);

    const seqRes = await query(
      'SELECT COALESCE(MAX(sequence_order), 0) AS max FROM auction_items WHERE auction_id = $1 AND round_number = $2',
      [auctionId, roundNumber]
    );
    let seq = parseInt(seqRes.rows[0].max);

    const items = [];
    for (const playerId of playerIds) {
      seq++;
      const result = await query(
        `INSERT INTO auction_items (auction_id, player_id, round_number, sequence_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (auction_id, player_id, round_number) DO NOTHING
         RETURNING *`,
        [auctionId, playerId, roundNumber, seq]
      );
      if (result.rows.length) {
        items.push(result.rows[0]);
        await query("UPDATE players SET status = 'available' WHERE id = $1 AND status = 'draft'", [playerId]);
      }
    }

    return sendSuccess(res, items, 'Players scheduled for auction');
  } catch (err) {
    return sendError(res, 'Failed to schedule players', 500);
  }
};

module.exports = {
  createPlayer, getPlayers, getPlayer, updatePlayer,
  deletePlayer, bulkCreatePlayers, schedulePlayersForAuction,
};