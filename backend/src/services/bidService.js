const { query, getClient } = require('../config/database');
const timerService = require('./timerService');
const auditService = require('./auditService');
const logger = require('../utils/logger');

/**
 * Validate and process a bid — server-authoritative
 */
const processBid = async ({ auctionId, auctionItemId, teamId, bidderId, amount, ipAddress }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock auction item row for update
    const itemResult = await client.query(
      `SELECT ai.*, a.bid_increment, a.starting_bid, a.bid_cap_enabled, a.bid_cap_amount,
              a.anti_sniping_enabled, a.anti_sniping_trigger_window, a.anti_sniping_extension,
              a.anti_sniping_max_extensions, a.status AS auction_status
       FROM auction_items ai
       JOIN auctions a ON ai.auction_id = a.id
       WHERE ai.id = $1 AND ai.auction_id = $2
       FOR UPDATE`,
      [auctionItemId, auctionId]
    );

    if (!itemResult.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Auction item not found' };
    }

    const item = itemResult.rows[0];

    // 2. Check auction is live
    if (!['live', 'round2_live', 'round3_live'].includes(item.auction_status)) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Auction is not live' };
    }

    // 3. Check item is live
    if (item.status !== 'live') {
      await client.query('ROLLBACK');
      return { success: false, reason: 'This player is not currently being auctioned' };
    }

    // 4. Check item is not paused
    if (item.paused_at) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Auction is paused' };
    }

    // 5. Verify team is valid and active
    const teamResult = await client.query(
      `SELECT t.*, ap.user_id FROM teams t
       JOIN auction_participants ap ON ap.team_id = t.id AND ap.auction_id = $1
       WHERE t.id = $2 AND t.auction_id = $1 AND t.is_active = true`,
      [auctionId, teamId]
    );

    if (!teamResult.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Team not found or inactive' };
    }

    const team = teamResult.rows[0];

    // 6. Verify bidder belongs to this team
    const participantResult = await client.query(
      `SELECT * FROM auction_participants WHERE auction_id = $1 AND user_id = $2 AND team_id = $3`,
      [auctionId, bidderId, teamId]
    );

    if (!participantResult.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'You are not authorized to bid for this team' };
    }

    // 7. Cannot outbid yourself
    if (item.current_leader_team_id === teamId) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Your team is already the highest bidder' };
    }

    // 8. Validate bid amount
    // FIX: First bid must be >= base_price (or starting_bid), not just bid_increment
    let minBid;
    if (item.current_price && item.current_price > 0) {
      // There are existing bids — must beat current price by at least one increment
      minBid = item.current_price + item.bid_increment;
    } else {
      // First bid — must meet the base price of the player (or auction starting_bid)
      const basePrice = item.base_price || item.starting_bid || item.bid_increment;
      minBid = basePrice;
    }

    if (amount < minBid) {
      await client.query('ROLLBACK');
      return { success: false, reason: `Minimum bid is ${minBid.toLocaleString('en-IN')}` };
    }

    // 9. Check bid cap
    if (item.bid_cap_enabled && item.bid_cap_amount && amount > item.bid_cap_amount) {
      await client.query('ROLLBACK');
      return { success: false, reason: `Bid exceeds maximum cap of ${item.bid_cap_amount}` };
    }

    // 10. Check team budget
    if (amount > team.remaining_budget) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Insufficient budget' };
    }

    // 11. Accept bid — update auction item
    await client.query(
      `UPDATE auction_items SET current_price = $1, current_leader_team_id = $2, updated_at = NOW() WHERE id = $3`,
      [amount, teamId, auctionItemId]
    );

    // 12. Insert bid record
    const bidResult = await client.query(
      `INSERT INTO bids (auction_id, auction_item_id, player_id, team_id, bidder_id, amount, status, round_number)
       VALUES ($1, $2, $3, $4, $5, $6, 'accepted', $7)
       RETURNING *`,
      [auctionId, auctionItemId, item.player_id, teamId, bidderId, amount, item.round_number]
    );

    await client.query('COMMIT');

    const bid = bidResult.rows[0];

    // 13. Anti-sniping check (after commit, non-blocking)
    const timeRemaining = timerService.getTimeRemaining(auctionItemId);
    if (
      item.anti_sniping_enabled &&
      timeRemaining !== null &&
      timeRemaining <= item.anti_sniping_trigger_window
    ) {
      await timerService.extendTimer(
        auctionId, auctionItemId,
        item.anti_sniping_extension,
        item.anti_sniping_max_extensions
      );
    }

    // 14. Check if bid cap reached
    const capReached = item.bid_cap_enabled && item.bid_cap_amount && amount >= item.bid_cap_amount;

    await auditService.log({
      auctionId,
      userId: bidderId,
      action: 'bid_placed',
      entityType: 'bid',
      entityId: bid.id,
      details: { amount, teamId, playerId: item.player_id, capReached: !!capReached },
      ipAddress,
    });

    return {
      success: true,
      bid,
      capReached: !!capReached,
      timeRemaining: timerService.getTimeRemaining(auctionItemId),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('processBid error:', err);
    return { success: false, reason: 'Server error processing bid' };
  } finally {
    client.release();
  }
};

/**
 * Submit a sealed tie-break bid
 */
const submitTieBreakBid = async ({ tieBreakRoundId, teamId, bidderId, amount }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const roundResult = await client.query(
      `SELECT tbr.*, ai.auction_id, a.bid_cap_amount
       FROM tie_break_rounds tbr
       JOIN auction_items ai ON tbr.auction_item_id = ai.id
       JOIN auctions a ON ai.auction_id = a.id
       WHERE tbr.id = $1 AND tbr.status = 'open'
       FOR UPDATE`,
      [tieBreakRoundId]
    );

    if (!roundResult.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Tie-break round not found or closed' };
    }

    const round = roundResult.rows[0];

    const teamResult = await client.query(`SELECT remaining_budget FROM teams WHERE id = $1`, [teamId]);
    if (!teamResult.rows.length || amount > teamResult.rows[0].remaining_budget) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Insufficient budget for tie-break bid' };
    }

    if (round.bid_cap_amount && amount < round.bid_cap_amount) {
      await client.query('ROLLBACK');
      return { success: false, reason: 'Tie-break bid must be at or above the cap amount' };
    }

    await client.query(
      `INSERT INTO tie_break_bids (tie_break_round_id, team_id, bidder_id, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tie_break_round_id, team_id)
       DO UPDATE SET amount = $4, submitted_at = NOW()`,
      [tieBreakRoundId, teamId, bidderId, amount]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('submitTieBreakBid error:', err);
    return { success: false, reason: 'Server error submitting tie-break bid' };
  } finally {
    client.release();
  }
};

/**
 * Resolve a tie-break round
 */
const resolveTieBreakRound = async (tieBreakRoundId, auctionItemId, io) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const bidsResult = await client.query(
      `SELECT tbb.*, t.name AS team_name
       FROM tie_break_bids tbb
       JOIN teams t ON tbb.team_id = t.id
       WHERE tbb.tie_break_round_id = $1
       ORDER BY tbb.amount DESC`,
      [tieBreakRoundId]
    );

    const bids = bidsResult.rows;
    if (!bids.length) {
      await client.query('ROLLBACK');
      return { resolved: false, reason: 'No bids submitted' };
    }

    const topAmount = bids[0].amount;
    const topBids = bids.filter((b) => b.amount === topAmount);

    const roundInfoResult = await client.query(
      `SELECT tbr.round_number, a.max_tie_break_rounds, a.tie_break_mode, ai.auction_id
       FROM tie_break_rounds tbr
       JOIN auction_items ai ON tbr.auction_item_id = ai.id
       JOIN auctions a ON ai.auction_id = a.id
       WHERE tbr.id = $1`,
      [tieBreakRoundId]
    );

    const roundInfo = roundInfoResult.rows[0];
    const maxRounds = roundInfo.max_tie_break_rounds;
    const currentRound = roundInfo.round_number;

    if (topBids.length === 1) {
      const winner = topBids[0];
      await client.query(
        `UPDATE tie_break_rounds SET status = 'resolved', winner_team_id = $1, winning_amount = $2, closed_at = NOW() WHERE id = $3`,
        [winner.team_id, topAmount, tieBreakRoundId]
      );
      await client.query(
        `UPDATE auction_items SET current_leader_team_id = $1, current_price = $2 WHERE id = $3`,
        [winner.team_id, topAmount, auctionItemId]
      );
      await client.query('COMMIT');

      await timerService.handlePlayerSold(roundInfo.auction_id, auctionItemId);
      await auditService.log({
        auctionId: roundInfo.auction_id,
        action: 'tie_break_resolved',
        entityType: 'tie_break_round',
        entityId: tieBreakRoundId,
        details: { winnerId: winner.team_id, amount: topAmount, round: currentRound },
      });

      return { resolved: true, winnerId: winner.team_id, amount: topAmount };
    }

    const canContinue = maxRounds === 0 || currentRound < maxRounds;
    if (!canContinue) {
      await client.query(`UPDATE tie_break_rounds SET status = 'closed', closed_at = NOW() WHERE id = $1`, [tieBreakRoundId]);
      await client.query('COMMIT');

      if (roundInfo.tie_break_mode === 'lucky_draw') {
        const lucky = topBids[Math.floor(Math.random() * topBids.length)];
        await client.query(`UPDATE auction_items SET current_leader_team_id = $1, current_price = $2 WHERE id = $3`, [lucky.team_id, topAmount, auctionItemId]);
        await timerService.handlePlayerSold(roundInfo.auction_id, auctionItemId);
        return { resolved: true, winnerId: lucky.team_id, amount: topAmount, method: 'lucky_draw' };
      }

      if (io) {
        io.to(`auction:${roundInfo.auction_id}`).emit('tiebreak:organizer_decision_needed', {
          auctionItemId, tieBreakRoundId,
          tiedTeams: topBids.map((b) => ({ teamId: b.team_id, teamName: b.team_name })),
        });
      }
      return { resolved: false, reason: 'organizer_decision', tiedTeams: topBids };
    }

    await client.query(`UPDATE tie_break_rounds SET status = 'closed', closed_at = NOW() WHERE id = $1`, [tieBreakRoundId]);
    const nextRoundResult = await client.query(
      `INSERT INTO tie_break_rounds (auction_item_id, round_number) VALUES ($1, $2) RETURNING *`,
      [auctionItemId, currentRound + 1]
    );
    await client.query('COMMIT');

    const nextRound = nextRoundResult.rows[0];
    const tiedTeamIds = topBids.map((b) => b.team_id);

    if (io) {
      io.to(`auction:${roundInfo.auction_id}`).emit('tiebreak:start', {
        auctionItemId,
        tieBreakRoundId: nextRound.id,
        roundNumber: nextRound.round_number,
        eligibleTeams: tiedTeamIds,
        previousRound: { bids: bids.map(b => ({ teamId: b.team_id, amount: b.amount })) },
      });
    }

    return { resolved: false, nextRoundId: nextRound.id, tiedTeams: tiedTeamIds };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('resolveTieBreakRound error:', err);
    return { resolved: false, reason: 'Server error resolving tie-break' };
  } finally {
    client.release();
  }
};

module.exports = { processBid, submitTieBreakBid, resolveTieBreakRound };