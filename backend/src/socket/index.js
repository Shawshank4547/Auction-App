const { verifyAccessToken } = require('../utils/jwt');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// In-memory chat store per auction (last 100 messages)
const chatStore = new Map();

const setupSocket = (io) => {

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(token);
      const result = await query(
        'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );
      if (!result.rows.length || !result.rows[0].is_active) {
        return next(new Error('User not found'));
      }
      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user=${socket.user.id}`);
    socket.join(socket.user.id);

    socket.on('auction:join', async ({ auctionId }) => {
      try {
        const access = await query(
          `SELECT ap.team_id FROM auction_participants ap
           WHERE ap.auction_id = $1 AND ap.user_id = $2
           UNION
           SELECT NULL AS team_id FROM auctions WHERE id = $1 AND organizer_id = $2`,
          [auctionId, socket.user.id]
        );

        if (!access.rows.length) {
          socket.emit('error', { message: 'Not authorized to join this auction' });
          return;
        }

        socket.join(`auction:${auctionId}`);
        socket.auctionId = auctionId;

        const teamRow = access.rows.find((r) => r.team_id);
        if (teamRow?.team_id) {
          socket.join(`team:${teamRow.team_id}`);
          socket.teamId = teamRow.team_id;
        }

        const history = (chatStore.get(auctionId) || []).slice(-50);
        socket.emit('chat:history', history);

        socket.to(`auction:${auctionId}`).emit('user:joined', {
          userId: socket.user.id,
          name: socket.user.name,
        });
      } catch (err) {
        logger.error('auction:join error', err);
        socket.emit('error', { message: 'Failed to join auction' });
      }
    });

    socket.on('auction:leave', ({ auctionId }) => {
      socket.leave(`auction:${auctionId}`);
      socket.to(`auction:${auctionId}`).emit('user:left', {
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    socket.on('chat:send', ({ auctionId, message }) => {
      try {
        if (!message || typeof message !== 'string') return;
        const trimmed = message.trim().slice(0, 500);
        if (!trimmed) return;

        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(`auction:${auctionId}`)) return;

        const chatMsg = {
          id: `${Date.now()}-${socket.user.id}`,
          userId: socket.user.id,
          userName: socket.user.name,
          message: trimmed,
          timestamp: new Date().toISOString(),
        };

        if (!chatStore.has(auctionId)) chatStore.set(auctionId, []);
        const msgs = chatStore.get(auctionId);
        msgs.push(chatMsg);
        if (msgs.length > 100) msgs.shift();

        io.to(`auction:${auctionId}`).emit('chat:message', chatMsg);
      } catch (err) {
        logger.error('chat:send error', err);
      }
    });

    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} reason=${reason}`);
    });
  });
};

module.exports = setupSocket;
