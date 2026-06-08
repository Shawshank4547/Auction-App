const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');
const auditService = require('./auditService');

// In-memory store for active timers
// { auctionItemId: { intervalId, timeRemaining, auctionId, extensionsUsed } }
const activeTimers = new Map();

let ioInstance = null;

const setIO = (io) => {
  ioInstance = io;
};

/**
 * Broadcast current timer state to auction room
 */
const broadcastTimer = (auctionId, auctionItemId, timeRemaining, status = 'ticking') => {
  if (ioInstance) {
    ioInstance.to(`auction:${auctionId}`).emit('timer:tick', {
      auctionItemId,
      timeRemaining,
      status,
    });
  }
};

/**
 * Handle player sold event
 */
const handlePlayerSold = async (auctionId, auctionItemId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const itemResult = await client.query(
      `SELECT ai.*, p.name AS player_name, t.name AS team_name
       FROM auction_items ai
       JOIN players p ON ai.player_id = p.id
       LEFT JOIN teams t ON ai.current_leader_team_id = t.id
       WHERE ai.id = $1`,
      [auctionItemId]
    );

    const item = itemResult.rows[0];
    if (!item) throw new Error('Auction item not found');

    if (item.current_leader_team_id && item.current_price) {
      // Mark item as sold
      await client.query(
        `UPDATE auction_items SET status = 'sold', completed_at = NOW() WHERE id = $1`,
        [auctionItemId]
      );

      // Create player sale record
      await client.query(
        `INSERT INTO player_sales (auction_id, player_id, team_id, auction_item_id, final_price, round_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [auctionId, item.player_id, item.current_leader_team_id, auctionItemId, item.current_price, item.round_number]
      );

      // Update player status
      await client.query(
        `UPDATE players SET status = 'sold' WHERE id = $1`,
        [item.player_id]
      );

      // Deduct from team budget
      await client.query(
        `UPDATE teams SET remaining_budget = remaining_budget - $1, squad_size = squad_size + 1
         WHERE id = $2`,
        [item.current_price, item.current_leader_team_id]
      );

      // Supersede all other bids
      await client.query(
        `UPDATE bids SET status = 'superseded'
         WHERE auction_item_id = $1 AND status = 'pending'`,
        [auctionItemId]
      );

      await client.query('COMMIT');

      if (ioInstance) {
        ioInstance.to(`auction:${auctionId}`).emit('player:sold', {
          auctionItemId,
          playerId: item.player_id,
          playerName: item.player_name,
          teamId: item.current_leader_team_id,
          teamName: item.team_name,
          finalPrice: item.current_price,
        });
      }

      await auditService.log({
        auctionId,
        action: 'player_sold',
        entityType: 'player',
        entityId: item.player_id,
        details: {
          teamId: item.current_leader_team_id,
          price: item.current_price,
          round: item.round_number,
        },
      });
    } else {
      // Player unsold
      await client.query(
        `UPDATE auction_items SET status = 'unsold', completed_at = NOW() WHERE id = $1`,
        [auctionItemId]
      );
      await client.query(
        `UPDATE players SET status = 'unsold' WHERE id = $1`,
        [item.player_id]
      );
      await client.query('COMMIT');

      if (ioInstance) {
        ioInstance.to(`auction:${auctionId}`).emit('player:unsold', {
          auctionItemId,
          playerId: item.player_id,
          playerName: item.player_name,
        });
      }

      await auditService.log({
        auctionId,
        action: 'player_unsold',
        entityType: 'player',
        entityId: item.player_id,
        details: { round: item.round_number },
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('handlePlayerSold error:', err);
  } finally {
    client.release();
  }
};

/**
 * Internal: create and register an interval for an auction item timer
 */
const _createInterval = (auctionId, auctionItemId, initialTime, extensionsUsed) => {
  let timeRemaining = initialTime;

  const intervalId = setInterval(async () => {
    timeRemaining--;
    broadcastTimer(auctionId, auctionItemId, timeRemaining);

    if (timeRemaining <= 0) {
      stopTimer(auctionItemId);
      await handlePlayerSold(auctionId, auctionItemId);
    }
  }, 1000);

  activeTimers.set(auctionItemId, {
    intervalId,
    timeRemaining,
    auctionId,
    extensionsUsed: extensionsUsed || 0,
  });

  return intervalId;
};

/**
 * Start a countdown timer for an auction item
 */
const startTimer = async (auctionId, auctionItemId, durationSeconds) => {
  // Clear any existing timer
  stopTimer(auctionItemId);

  // Update DB
  await query(
    `UPDATE auction_items SET timer_start = NOW(), timer_duration = $1, status = 'live', started_at = COALESCE(started_at, NOW())
     WHERE id = $2`,
    [durationSeconds, auctionItemId]
  );

  _createInterval(auctionId, auctionItemId, durationSeconds, 0);

  // Broadcast immediately so clients see the correct starting time before first tick
  broadcastTimer(auctionId, auctionItemId, durationSeconds, 'started');
};

/**
 * Stop and clear a timer
 */
const stopTimer = (auctionItemId) => {
  const timer = activeTimers.get(auctionItemId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(auctionItemId);
  }
};

/**
 * Extend timer (anti-sniping)
 * @returns {boolean} Whether extension was applied
 */
const extendTimer = async (auctionId, auctionItemId, extensionSeconds, maxExtensions) => {
  const timer = activeTimers.get(auctionItemId);
  if (!timer) return false;

  if (maxExtensions > 0 && timer.extensionsUsed >= maxExtensions) {
    return false;
  }

  timer.timeRemaining += extensionSeconds;
  timer.extensionsUsed++;

  // Update DB extensions count
  await query(
    `UPDATE auction_items SET extensions_used = $1 WHERE id = $2`,
    [timer.extensionsUsed, auctionItemId]
  );

  broadcastTimer(auctionId, auctionItemId, timer.timeRemaining, 'extended');
  return true;
};

/**
 * Pause timer — snapshot current timeRemaining to DB BEFORE stopping interval
 */
const pauseTimer = async (auctionId, auctionItemId) => {
  const timer = activeTimers.get(auctionItemId);
  if (!timer) return null;

  // Capture remaining time BEFORE stopping
  const remaining = timer.timeRemaining;
  const extensionsUsed = timer.extensionsUsed;

  // Stop the interval
  clearInterval(timer.intervalId);
  activeTimers.delete(auctionItemId);

  // Persist to DB so resume can restore it
  await query(
    `UPDATE auction_items SET paused_at = NOW(), paused_time_remaining = $1
     WHERE id = $2`,
    [remaining, auctionItemId]
  );

  broadcastTimer(auctionId, auctionItemId, remaining, 'paused');
  return remaining;
};

/**
 * Resume timer from paused state — restores exact remaining time and extensions
 */
const resumeTimer = async (auctionId, auctionItemId) => {
  const itemResult = await query(
    `SELECT paused_time_remaining, extensions_used FROM auction_items WHERE id = $1`,
    [auctionItemId]
  );
  if (!itemResult.rows.length) return;

  const { paused_time_remaining, extensions_used } = itemResult.rows[0];
  if (paused_time_remaining == null) return;

  // Clear pause flags in DB
  await query(
    `UPDATE auction_items SET paused_at = NULL, paused_time_remaining = NULL WHERE id = $1`,
    [auctionItemId]
  );

  // Recreate interval with saved state
  _createInterval(auctionId, auctionItemId, paused_time_remaining, extensions_used || 0);

  // Broadcast immediately so clients see correct time
  broadcastTimer(auctionId, auctionItemId, paused_time_remaining, 'resumed');
};

/**
 * Get remaining time for an item
 */
const getTimeRemaining = (auctionItemId) => {
  const timer = activeTimers.get(auctionItemId);
  return timer ? timer.timeRemaining : null;
};

module.exports = {
  setIO,
  startTimer,
  stopTimer,
  extendTimer,
  pauseTimer,
  resumeTimer,
  getTimeRemaining,
  handlePlayerSold,
};