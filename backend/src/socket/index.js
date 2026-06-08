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
    // Always join a personal room for direct messages (bid:rejected etc.)
    socket.join(socket.user.id);

    // Helper to join an auction room — used on initial join AND on reconnect
    const joinAuctionRoom = async (auctionId) => {
      try {
        // super_admin and organizer can always join
        if (socket.user.role === 'super_admin') {
          socket.join(`auction:${auctionId}`);
          socket.auctionId = auctionId;
          const history = (chatStore.get(auctionId) || []).slice(-50);
          socket.emit('chat:history', history);
          return true;
        }

        // Check if organizer of this auction
        const organizerCheck = await query(
          'SELECT id FROM auctions WHERE id = $1 AND organizer_id = $2',
          [auctionId, socket.user.id]
        );
        if (organizerCheck.rows.length) {
          socket.join(`auction:${auctionId}`);
          socket.auctionId = auctionId;
          const history = (chatStore.get(auctionId) || []).slice(-50);
          socket.emit('chat:history', history);
          return true;
        }

        // Check auction_participants (bidders AND viewers)
        const participantCheck = await query(
          `SELECT ap.team_id, ap.role FROM auction_participants ap
           WHERE ap.auction_id = $1 AND ap.user_id = $2`,
          [auctionId, socket.user.id]
        );

        if (!participantCheck.rows.length) {
          socket.emit('error', { message: 'Not authorized to join this auction' });
          return false;
        }

        socket.join(`auction:${auctionId}`);
        socket.auctionId = auctionId;

        // Join team room if assigned
        const teamRow = participantCheck.rows.find((r) => r.team_id);
        if (teamRow?.team_id) {
          socket.join(`team:${teamRow.team_id}`);
          socket.teamId = teamRow.team_id;
        }

        const history = (chatStore.get(auctionId) || []).slice(-50);
        socket.emit('chat:history', history);
        return true;
      } catch (err) {
        logger.error('joinAuctionRoom error', err);
        socket.emit('error', { message: 'Failed to join auction' });
        return false;
      }
    };

    socket.on('auction:join', async ({ auctionId }) => {
      const joined = await joinAuctionRoom(auctionId);
      if (joined) {
        socket.to(`auction:${auctionId}`).emit('user:joined', {
          userId: socket.user.id,
          name: socket.user.name,
        });
      }
    });

    socket.on('auction:leave', ({ auctionId }) => {
      socket.leave(`auction:${auctionId}`);
      socket.auctionId = null;
      socket.to(`auction:${auctionId}`).emit('user:left', {
        userId: socket.user.id,
        name: socket.user.name,
      });
    });

    // Client requests re-join after reconnect (frontend sends this on socket reconnect event)
    socket.on('auction:rejoin', async ({ auctionId }) => {
      await joinAuctionRoom(auctionId);
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