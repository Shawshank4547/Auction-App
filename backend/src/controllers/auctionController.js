const { query, getClient } = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const timerService = require('../services/timerService');
const auditService = require('../services/auditService');

const createAuction = async (req, res) => {
  try {
    const {
      name, description, currency, timezone,
      startingBid, bidIncrement, timerDuration,
      antiSnipingEnabled, antiSnipingTriggerWindow, antiSnipingExtension, antiSnipingMaxExtensions,
      allowPause, maxPauseLength, maxPauseCount,
      enableRound2, enableRound3, round2BasePriceType, round2BasePriceReduction,
      round3BasePriceType, round3BasePriceReduction,
      bidCapEnabled, bidCapAmount,
      tieBreakMode, maxTieBreakRounds,
      auctionOrderMode, scheduledAt,
    } = req.body;

    const result = await query(
      `INSERT INTO auctions (
        organizer_id, name, description, currency, timezone,
        starting_bid, bid_increment, timer_duration,
        anti_sniping_enabled, anti_sniping_trigger_window, anti_sniping_extension, anti_sniping_max_extensions,
        allow_pause, max_pause_length, max_pause_count,
        enable_round2, enable_round3, round2_base_price_type, round2_base_price_reduction,
        round3_base_price_type, round3_base_price_reduction,
        bid_cap_enabled, bid_cap_amount,
        tie_break_mode, max_tie_break_rounds,
        auction_order_mode, scheduled_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING *`,
      [
        req.user.id, name, description, currency || 'INR', timezone || 'Asia/Kolkata',
        startingBid || 100000, bidIncrement || 100000, timerDuration || 60,
        antiSnipingEnabled !== false, antiSnipingTriggerWindow || 30, antiSnipingExtension || 30, antiSnipingMaxExtensions || 5,
        allowPause !== false, maxPauseLength || 300, maxPauseCount || 10,
        enableRound2 !== false, enableRound3 || false, round2BasePriceType || 'original', round2BasePriceReduction || 0,
        round3BasePriceType || 'original', round3BasePriceReduction || 0,
        bidCapEnabled || false, bidCapAmount || null,
        tieBreakMode || 'sealed_bid', maxTieBreakRounds || 0,
        auctionOrderMode || 'manual', scheduledAt || null,
      ]
    );

    await auditService.log({
      auctionId: result.rows[0].id,
      userId: req.user.id,
      action: 'auction_created',
      entityType: 'auction',
      entityId: result.rows[0].id,
      ipAddress: req.ip,
    });

    return sendSuccess(res, result.rows[0], 'Auction created', 201);
  } catch (err) {
    return sendError(res, 'Failed to create auction', 500);
  }
};

const getAuctions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';

    // Organizers see their own; admins see all; bidders see auctions they participate in
    if (req.user.role === 'organizer') {
      where = `WHERE a.organizer_id = $${params.length + 1}`;
      params.push(req.user.id);
    } else if (req.user.role === 'bidder' || req.user.role === 'viewer') {
      where = `WHERE a.id IN (SELECT auction_id FROM auction_participants WHERE user_id = $${params.length + 1})`;
      params.push(req.user.id);
    }

    if (status) {
      where += where ? ' AND' : 'WHERE';
      where += ` a.status = $${params.length + 1}`;
      params.push(status);
    }

    const result = await query(
      `SELECT a.*, u.name AS organizer_name,
       (SELECT COUNT(*) FROM teams WHERE auction_id = a.id) AS team_count,
       (SELECT COUNT(*) FROM players WHERE auction_id = a.id) AS player_count
       FROM auctions a
       JOIN users u ON a.organizer_id = u.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM auctions a ${where}`,
      params
    );

    return sendPaginated(res, result.rows, parseInt(countResult.rows[0].count), page, limit);
  } catch (err) {
    return sendError(res, 'Failed to fetch auctions', 500);
  }
};

const getAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, u.name AS organizer_name
       FROM auctions a
       JOIN users u ON a.organizer_id = u.id
       WHERE a.id = $1`,
      [id]
    );

    if (!result.rows.length) return sendError(res, 'Auction not found', 404);
    return sendSuccess(res, result.rows[0]);
  } catch (err) {
    return sendError(res, 'Failed to fetch auction', 500);
  }
};

const updateAuction = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [id, req.user.id]
    );

    if (!existing.rows.length) return sendError(res, 'Auction not found', 404);
    if (!['draft', 'scheduled'].includes(existing.rows[0].status)) {
      return sendError(res, 'Cannot edit a live or completed auction', 400);
    }

    const {
      name, description, currency, timezone,
      startingBid, bidIncrement, timerDuration,
      antiSnipingEnabled, antiSnipingTriggerWindow, antiSnipingExtension, antiSnipingMaxExtensions,
      allowPause, maxPauseLength, maxPauseCount,
      enableRound2, enableRound3, round2BasePriceType, round2BasePriceReduction,
      round3BasePriceType, round3BasePriceReduction,
      bidCapEnabled, bidCapAmount, tieBreakMode, maxTieBreakRounds, auctionOrderMode, scheduledAt,
    } = req.body;

    const result = await query(
      `UPDATE auctions SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        currency = COALESCE($3, currency),
        timezone = COALESCE($4, timezone),
        starting_bid = COALESCE($5, starting_bid),
        bid_increment = COALESCE($6, bid_increment),
        timer_duration = COALESCE($7, timer_duration),
        anti_sniping_enabled = COALESCE($8, anti_sniping_enabled),
        anti_sniping_trigger_window = COALESCE($9, anti_sniping_trigger_window),
        anti_sniping_extension = COALESCE($10, anti_sniping_extension),
        anti_sniping_max_extensions = COALESCE($11, anti_sniping_max_extensions),
        allow_pause = COALESCE($12, allow_pause),
        max_pause_length = COALESCE($13, max_pause_length),
        max_pause_count = COALESCE($14, max_pause_count),
        enable_round2 = COALESCE($15, enable_round2),
        enable_round3 = COALESCE($16, enable_round3),
        round2_base_price_type = COALESCE($17, round2_base_price_type),
        round2_base_price_reduction = COALESCE($18, round2_base_price_reduction),
        round3_base_price_type = COALESCE($19, round3_base_price_type),
        round3_base_price_reduction = COALESCE($20, round3_base_price_reduction),
        bid_cap_enabled = COALESCE($21, bid_cap_enabled),
        bid_cap_amount = COALESCE($22, bid_cap_amount),
        tie_break_mode = COALESCE($23, tie_break_mode),
        max_tie_break_rounds = COALESCE($24, max_tie_break_rounds),
        auction_order_mode = COALESCE($25, auction_order_mode),
        scheduled_at = COALESCE($26, scheduled_at),
        updated_at = NOW()
      WHERE id = $27
      RETURNING *`,
      [
        name, description, currency, timezone,
        startingBid, bidIncrement, timerDuration,
        antiSnipingEnabled, antiSnipingTriggerWindow, antiSnipingExtension, antiSnipingMaxExtensions,
        allowPause, maxPauseLength, maxPauseCount,
        enableRound2, enableRound3, round2BasePriceType, round2BasePriceReduction,
        round3BasePriceType, round3BasePriceReduction,
        bidCapEnabled, bidCapAmount, tieBreakMode, maxTieBreakRounds, auctionOrderMode, scheduledAt,
        id,
      ]
    );

    return sendSuccess(res, result.rows[0], 'Auction updated');
  } catch (err) {
    return sendError(res, 'Failed to update auction', 500);
  }
};

const startAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [id, req.user.id]
    );

    if (!auction.rows.length) return sendError(res, 'Auction not found', 404);
    if (!['draft', 'scheduled'].includes(auction.rows[0].status)) {
      return sendError(res, 'Auction already started', 400);
    }

    await query(
      `UPDATE auctions SET status = 'live', started_at = NOW(), current_round = 1, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await auditService.log({
      auctionId: id,
      userId: req.user.id,
      action: 'auction_started',
      entityType: 'auction',
      entityId: id,
      ipAddress: req.ip,
    });

    // Notify all connected clients
    const io = req.app.get('io');
    if (io) {
      io.to(`auction:${id}`).emit('auction:started', { auctionId: id });
    }

    return sendSuccess(res, {}, 'Auction started');
  } catch (err) {
    return sendError(res, 'Failed to start auction', 500);
  }
};

const pauseAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [id, req.user.id]
    );

    if (!auction.rows.length) return sendError(res, 'Auction not found', 404);

    const a = auction.rows[0];
    if (!a.allow_pause) return sendError(res, 'Pause not allowed for this auction', 400);

    // Find current live item
    const liveItem = await query(
      `SELECT id FROM auction_items WHERE auction_id = $1 AND status = 'live' LIMIT 1`,
      [id]
    );

    if (liveItem.rows.length) {
      await timerService.pauseTimer(id, liveItem.rows[0].id);
    }

    await auditService.log({
      auctionId: id,
      userId: req.user.id,
      action: 'auction_paused',
      entityType: 'auction',
      entityId: id,
      ipAddress: req.ip,
    });

    const io = req.app.get('io');
    if (io) io.to(`auction:${id}`).emit('auction:paused', { auctionId: id });

    return sendSuccess(res, {}, 'Auction paused');
  } catch (err) {
    return sendError(res, 'Failed to pause auction', 500);
  }
};

const resumeAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const auction = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [id, req.user.id]
    );

    if (!auction.rows.length) return sendError(res, 'Auction not found', 404);

    const liveItem = await query(
      `SELECT id FROM auction_items WHERE auction_id = $1 AND status = 'live' AND paused_at IS NOT NULL LIMIT 1`,
      [id]
    );

    if (liveItem.rows.length) {
      await timerService.resumeTimer(id, liveItem.rows[0].id);
    }

    await auditService.log({
      auctionId: id,
      userId: req.user.id,
      action: 'auction_resumed',
      entityType: 'auction',
      entityId: id,
      ipAddress: req.ip,
    });

    const io = req.app.get('io');
    if (io) io.to(`auction:${id}`).emit('auction:resumed', { auctionId: id });

    return sendSuccess(res, {}, 'Auction resumed');
  } catch (err) {
    return sendError(res, 'Failed to resume auction', 500);
  }
};

/**
 * Introduce next player to auction
 */
const nextPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { auctionItemId } = req.body;

    const auction = await query(
      'SELECT * FROM auctions WHERE id = $1 AND organizer_id = $2',
      [id, req.user.id]
    );

    if (!auction.rows.length) return sendError(res, 'Auction not found', 404);

    // Check no other item is live
    const currentLive = await query(
      `SELECT id FROM auction_items WHERE auction_id = $1 AND status = 'live'`,
      [id]
    );

    if (currentLive.rows.length) {
      return sendError(res, 'Another player is currently being auctioned', 400);
    }

    // Get the item to start
    const itemResult = await query(
      `SELECT ai.*, p.name AS player_name, p.base_price, a.timer_duration, a.starting_bid
       FROM auction_items ai
       JOIN players p ON ai.player_id = p.id
       JOIN auctions a ON ai.auction_id = a.id
       WHERE ai.id = $1 AND ai.auction_id = $2 AND ai.status = 'pending'`,
      [auctionItemId, id]
    );

    if (!itemResult.rows.length) return sendError(res, 'Auction item not found or not pending', 404);

    const item = itemResult.rows[0];

    // Set base price
    const basePrice = item.base_price || item.starting_bid;

    await query(
      `UPDATE auction_items SET status = 'live', current_price = NULL, started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [auctionItemId]
    );

    await query(
      `UPDATE players SET status = 'live' WHERE id = $1`,
      [item.player_id]
    );

    // Emit player introduced event
    const io = req.app.get('io');
    if (io) {
      io.to(`auction:${id}`).emit('player:introduced', {
        auctionItemId,
        playerId: item.player_id,
        playerName: item.player_name,
        basePrice,
      });
    }

    // Start timer
    await timerService.startTimer(id, auctionItemId, item.timer_duration);

    return sendSuccess(res, { auctionItemId, playerName: item.player_name }, 'Player introduced');
  } catch (err) {
    return sendError(res, 'Failed to introduce player', 500);
  }
};

const getAuctionState = async (req, res) => {
  try {
    const { id } = req.params;

    const [auctionRes, teamsRes, liveItemRes] = await Promise.all([
      query('SELECT * FROM auctions WHERE id = $1', [id]),
      query(
        `SELECT t.*, u.name AS owner_name FROM teams t
         LEFT JOIN users u ON t.owner_id = u.id
         WHERE t.auction_id = $1 ORDER BY t.name`,
        [id]
      ),
      query(
        `SELECT ai.*, p.name AS player_name, p.photo_url, p.category, p.role, p.statistics,
                t.name AS leader_team_name
         FROM auction_items ai
         JOIN players p ON ai.player_id = p.id
         LEFT JOIN teams t ON ai.current_leader_team_id = t.id
         WHERE ai.auction_id = $1 AND ai.status = 'live'
         LIMIT 1`,
        [id]
      ),
    ]);

    if (!auctionRes.rows.length) return sendError(res, 'Auction not found', 404);

    const state = {
      auction: auctionRes.rows[0],
      teams: teamsRes.rows,
      liveItem: liveItemRes.rows[0] || null,
      timeRemaining: liveItemRes.rows[0]
        ? timerService.getTimeRemaining(liveItemRes.rows[0].id)
        : null,
    };

    return sendSuccess(res, state);
  } catch (err) {
    return sendError(res, 'Failed to fetch auction state', 500);
  }
};

const getAuctionItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { round = 1 } = req.query;

    const result = await query(
      `SELECT ai.*, p.name AS player_name, p.photo_url, p.category, p.role, p.base_price,
              t.name AS leader_team_name
       FROM auction_items ai
       JOIN players p ON ai.player_id = p.id
       LEFT JOIN teams t ON ai.current_leader_team_id = t.id
       WHERE ai.auction_id = $1 AND ai.round_number = $2
       ORDER BY ai.sequence_order ASC`,
      [id, round]
    );

    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch auction items', 500);
  }
};

const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, teamId, role = 'bidder' } = req.body;

    await query(
      `INSERT INTO auction_participants (auction_id, user_id, team_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (auction_id, user_id) DO UPDATE SET team_id = $3, role = $4`,
      [id, userId, teamId, role]
    );

    return sendSuccess(res, {}, 'Participant added');
  } catch (err) {
    return sendError(res, 'Failed to add participant', 500);
  }
};

module.exports = {
  createAuction,
  getAuctions,
  getAuction,
  updateAuction,
  startAuction,
  pauseAuction,
  resumeAuction,
  nextPlayer,
  getAuctionState,
  getAuctionItems,
  addParticipant,
};
