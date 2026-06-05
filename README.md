# AuctionPro — Real-time Player Auction Platform

A full-stack, server-authoritative auction platform for cricket/sports tournaments.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, Socket.IO Client |
| Backend | Node.js, Express.js, Socket.IO |
| Database | PostgreSQL 16 |
| Storage | Cloudflare R2 (S3-compatible) |
| Auth | JWT Access + Refresh Tokens |
| Deploy | Docker Compose |

## Quick Start (Docker)

```bash
# 1. Copy environment file
cp .env.example .env
# Edit .env with your secrets

# 2. Start all services
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# API docs: http://localhost:3001/health
```

## Local Development

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with DB credentials

# Run PostgreSQL locally then:
node src/config/migrate.js   # run migrations
npm run dev                   # start with nodemon
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env
npm start
```

## Project Structure

```
auction-platform/
├── backend/
│   └── src/
│       ├── config/         # DB connection, migrations
│       ├── controllers/    # Route handlers (thin, delegate to services)
│       ├── middleware/     # auth, validate, upload, error handler
│       ├── routes/         # Express routers
│       ├── services/       # Business logic (bid, timer, audit, notify)
│       ├── socket/         # Socket.IO handler
│       └── utils/          # logger, jwt, response, storage
└── frontend/
    └── src/
        ├── components/     # Reusable UI (shared, auction, bid, team, player)
        ├── hooks/          # useAuctionSocket
        ├── pages/          # Route-level components
        ├── services/       # api.ts (axios), socketService.ts
        ├── store/          # Zustand stores (auth, auction)
        ├── types/          # TypeScript interfaces
        └── utils/          # format helpers
```

## User Roles

| Role | Capabilities |
|------|-------------|
| `super_admin` | Everything + user management |
| `organizer` | Create/manage auctions, teams, players |
| `bidder` | Join auctions, place bids |
| `viewer` | Watch auctions (no bidding) |

## Key Features

- ✅ Server-authoritative bidding with full validation
- ✅ Anti-sniping (timer extension on late bids)
- ✅ Bid cap with recursive sealed-bid tie-breaks
- ✅ Lucky draw / organizer-decision fallback
- ✅ Multi-round auction (Round 1, 2, 3)
- ✅ Auction pause/resume with timer freeze
- ✅ Real-time bid feed, timer sync, team budgets
- ✅ Public auction chat
- ✅ Full audit logging
- ✅ Cloudflare R2 image storage
- ✅ JWT auth with refresh token rotation
- ✅ Mobile-responsive UI

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/auctions
POST   /api/auctions
GET    /api/auctions/:id
PATCH  /api/auctions/:id
GET    /api/auctions/:id/state
POST   /api/auctions/:id/start
POST   /api/auctions/:id/pause
POST   /api/auctions/:id/resume
POST   /api/auctions/:id/next-player
POST   /api/auctions/:id/participants

GET    /api/auctions/:auctionId/teams
POST   /api/auctions/:auctionId/teams
GET    /api/auctions/:auctionId/teams/:teamId
PATCH  /api/auctions/:auctionId/teams/:teamId
DELETE /api/auctions/:auctionId/teams/:teamId

GET    /api/auctions/:auctionId/players
POST   /api/auctions/:auctionId/players
POST   /api/auctions/:auctionId/players/bulk
POST   /api/auctions/:auctionId/players/schedule
GET    /api/auctions/:auctionId/players/:playerId
PATCH  /api/auctions/:auctionId/players/:playerId
DELETE /api/auctions/:auctionId/players/:playerId

POST   /api/auctions/:auctionId/bids
POST   /api/auctions/:auctionId/bids/tiebreak
POST   /api/auctions/:auctionId/bids/tiebreak/close
GET    /api/auctions/:auctionId/bids

GET    /api/notifications
GET    /api/notifications/unread-count
PATCH  /api/notifications/:id/read
POST   /api/notifications/mark-all-read

GET    /api/admin/users
PATCH  /api/admin/users/:id/suspend
PATCH  /api/admin/users/:id/activate
PATCH  /api/admin/users/:id/promote-organizer
GET    /api/admin/auctions
GET    /api/admin/stats
GET    /api/admin/audit-logs
```

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `auction:join` | Client → Server | Join auction room |
| `auction:leave` | Client → Server | Leave auction room |
| `auction:started` | Server → Client | Auction went live |
| `auction:paused` | Server → Client | Auction paused |
| `auction:resumed` | Server → Client | Auction resumed |
| `player:introduced` | Server → Client | New player up for auction |
| `player:sold` | Server → Client | Player sold result |
| `player:unsold` | Server → Client | Player unsold result |
| `bid:accepted` | Server → Client | Bid accepted, price updated |
| `bid:rejected` | Server → Client | Bid rejected with reason |
| `timer:tick` | Server → Client | Timer countdown (1/sec) |
| `tiebreak:start` | Server → Client | Tie-break round opened |
| `tiebreak:end` | Server → Client | Tie-break resolved |
| `chat:send` | Client → Server | Send chat message |
| `chat:message` | Server → Client | Broadcast chat message |
| `chat:history` | Server → Client | Last 50 messages on join |

## Production Notes

1. Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars)
2. Configure Cloudflare R2 credentials for image uploads
3. Use HTTPS in production (CORS_ORIGIN should be your domain)
4. Run behind a reverse proxy (nginx/caddy) for SSL termination
5. For horizontal scaling, replace in-memory timers with Redis
