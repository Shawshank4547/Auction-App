const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const bidService = require('../services/bidService');
const timerService = require('../services/timerService');
const auditService = require('../services/auditService');

const placeBid = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { auctionItemId, teamId, amount } = req.body;

    const result = await bidService.processBid({
      auctionId,
      auctionItemId,
      teamId,
      bidderId: req.user.id,
      amount: parseInt(amount),
      ipAddress: req.ip,
    });

    if (!result.success) {
      await auditService.log({
        auctionId,
        userId: req.user.id,
        action: 'bid_rejected',
        details: { reason: result.reason, amount, teamId, auctionItemId },
        ipAddress: req.ip,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(req.user.id).emit('bid:rejected', { auctionItemId, reason: result.reason });
      }
      return sendError(res, result.reason, 400);
    }

    // FIX: Fetch team name to include in socket event so LivePlayerCard shows "by TeamName"
    const teamRes = await query('SELECT name FROM teams WHERE id = $1', [teamId]);
    const teamName = teamRes.rows[0]?.name || '';

    const io = req.app.get('io');
    if (io) {
      io.to(`auction:${auctionId}`).emit('bid:accepted', {
        bid: { ...result.bid, team_name: teamName }, // FIX: include team_name
        auctionItemId,
        teamId,
        amount: parseInt(amount),
        timeRemaining: result.timeRemaining,
      });

      // If cap reached, stop timer and start tie-break
      if (result.capReached) {
        timerService.stopTimer(auctionItemId);

        const newRound = await query(
          `INSERT INTO tie_break_rounds (auction_item_id, round_number)
           VALUES ($1, 1)
           RETURNING *`,
          [auctionItemId]
        );

        // Get all teams that bid at cap
        const eligibleTeams = await query(
          `SELECT DISTINCT team_id FROM bids
           WHERE auction_item_id = $1 AND amount = $2 AND status = 'accepted'`,
          [auctionItemId, parseInt(amount)]
        );

        io.to(`auction:${auctionId}`).emit('tiebreak:start', {
          auctionItemId,
          tieBreakRoundId: newRound.rows[0].id,
          roundNumber: 1,
          eligibleTeams: eligibleTeams.rows.map((r) => r.team_id),
          capAmount: parseInt(amount),
        });
      }
    }

    return sendSuccess(res, { bid: result.bid, timeRemaining: result.timeRemaining });
  } catch (err) {
    return sendError(res, 'Failed to place bid', 500);
  }
};

const submitTieBreakBid = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { tieBreakRoundId, teamId, amount } = req.body;

    const result = await bidService.submitTieBreakBid({
      tieBreakRoundId,
      teamId,
      bidderId: req.user.id,
      amount: parseInt(amount),
    });

    if (!result.success) return sendError(res, result.reason, 400);

    // Confirm to bidder only (hidden from others)
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${teamId}`).emit('tiebreak:bid_submitted', { tieBreakRoundId });
    }

    return sendSuccess(res, {}, 'Tie-break bid submitted');
  } catch (err) {
    return sendError(res, 'Failed to submit tie-break bid', 500);
  }
};

const closeTieBreakRound = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { tieBreakRoundId, auctionItemId } = req.body;

    // Only organizer can close
    const auctionCheck = await query(
      'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
      [auctionId, req.user.id]
    );
    if (!auctionCheck.rows.length) return sendError(res, 'Unauthorized', 403);

    const io = req.app.get('io');
    const result = await bidService.resolveTieBreakRound(tieBreakRoundId, auctionItemId, io);

    if (result.resolved) {
      if (io) {
        io.to(`auction:${auctionId}`).emit('tiebreak:end', {
          tieBreakRoundId,
          auctionItemId,
          winnerId: result.winnerId,
          amount: result.amount,
          method: result.method || 'sealed_bid',
        });
      }
      return sendSuccess(res, result, 'Tie-break resolved');
    }

    return sendSuccess(res, result, result.nextRoundId ? 'New tie-break round opened' : result.reason);
  } catch (err) {
    return sendError(res, 'Failed to close tie-break round', 500);
  }
};

const getBidHistory = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { auctionItemId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const params = [auctionId];
    let where = 'WHERE b.auction_id = $1';

    if (auctionItemId) {
      where += ` AND b.auction_item_id = $${params.length + 1}`;
      params.push(auctionItemId);
    }

    const result = await query(
      `SELECT b.*, t.name AS team_name, u.name AS bidder_name, p.name AS player_name
       FROM bids b
       JOIN teams t ON b.team_id = t.id
       JOIN users u ON b.bidder_id = u.id
       JOIN players p ON b.player_id = p.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return sendSuccess(res, result.rows);
  } catch (err) {
    return sendError(res, 'Failed to fetch bid history', 500);
  }
};

module.exports = { placeBid, submitTieBreakBid, closeTieBreakRound, getBidHistory };