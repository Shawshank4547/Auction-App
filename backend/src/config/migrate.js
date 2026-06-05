require('dotenv').config();
const { pool } = require('./database');

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'bidder' CHECK (role IN ('super_admin', 'organizer', 'bidder', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  avatar_url TEXT,
  refresh_token TEXT,
  google_id VARCHAR(255) UNIQUE,
  auth_provider VARCHAR(50) DEFAULT 'local',
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  currency VARCHAR(10) DEFAULT 'INR',
  timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'round1_complete', 'round2_live', 'round2_complete', 'round3_live', 'completed', 'archived')),
  current_round INTEGER DEFAULT 1,
  
  -- Bidding config
  starting_bid BIGINT DEFAULT 100000,
  bid_increment BIGINT DEFAULT 100000,
  timer_duration INTEGER DEFAULT 60,
  
  -- Anti-sniping
  anti_sniping_enabled BOOLEAN DEFAULT true,
  anti_sniping_trigger_window INTEGER DEFAULT 30,
  anti_sniping_extension INTEGER DEFAULT 30,
  anti_sniping_max_extensions INTEGER DEFAULT 5,
  
  -- Pause settings
  allow_pause BOOLEAN DEFAULT true,
  max_pause_length INTEGER DEFAULT 300,
  max_pause_count INTEGER DEFAULT 10,
  
  -- Unsold settings
  enable_round2 BOOLEAN DEFAULT true,
  enable_round3 BOOLEAN DEFAULT false,
  round2_base_price_type VARCHAR(50) DEFAULT 'original' CHECK (round2_base_price_type IN ('original', 'reduced', 'custom')),
  round2_base_price_reduction DECIMAL(5,2) DEFAULT 0,
  round3_base_price_type VARCHAR(50) DEFAULT 'original' CHECK (round3_base_price_type IN ('original', 'reduced', 'custom')),
  round3_base_price_reduction DECIMAL(5,2) DEFAULT 0,
  
  -- Bid cap
  bid_cap_enabled BOOLEAN DEFAULT false,
  bid_cap_amount BIGINT,
  
  -- Tie-break
  tie_break_mode VARCHAR(50) DEFAULT 'sealed_bid' CHECK (tie_break_mode IN ('sealed_bid', 'lucky_draw', 'organizer_decision')),
  max_tie_break_rounds INTEGER DEFAULT 0,
  
  -- Auction order
  auction_order_mode VARCHAR(50) DEFAULT 'manual' CHECK (auction_order_mode IN ('manual', 'random', 'category')),
  
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  total_budget BIGINT NOT NULL,
  remaining_budget BIGINT NOT NULL,
  min_players INTEGER DEFAULT 0,
  max_players INTEGER DEFAULT 25,
  squad_size INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, name)
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  photo_url TEXT,
  category VARCHAR(100),
  role VARCHAR(100),
  base_price BIGINT NOT NULL,
  description TEXT,
  statistics JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'live', 'sold', 'unsold', 'withdrawn')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auction rounds table
CREATE TABLE IF NOT EXISTS auction_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'complete')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, round_number)
);

-- Auction items (players being auctioned in sequence)
CREATE TABLE IF NOT EXISTS auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  round_number INTEGER NOT NULL,
  sequence_order INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'sold', 'unsold', 'skipped')),
  current_price BIGINT,
  current_leader_team_id UUID REFERENCES teams(id),
  timer_start TIMESTAMPTZ,
  timer_duration INTEGER,
  extensions_used INTEGER DEFAULT 0,
  pause_count INTEGER DEFAULT 0,
  paused_at TIMESTAMPTZ,
  paused_time_remaining INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, player_id, round_number)
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  auction_item_id UUID NOT NULL REFERENCES auction_items(id),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  bidder_id UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  rejection_reason TEXT,
  round_number INTEGER NOT NULL,
  is_tie_break_bid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tie break rounds
CREATE TABLE IF NOT EXISTS tie_break_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_item_id UUID NOT NULL REFERENCES auction_items(id),
  round_number INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  winner_team_id UUID REFERENCES teams(id),
  winning_amount BIGINT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tie break bids (sealed)
CREATE TABLE IF NOT EXISTS tie_break_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tie_break_round_id UUID NOT NULL REFERENCES tie_break_rounds(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  bidder_id UUID NOT NULL REFERENCES users(id),
  amount BIGINT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tie_break_round_id, team_id)
);

-- Player sales
CREATE TABLE IF NOT EXISTS player_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id),
  player_id UUID NOT NULL REFERENCES players(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  auction_item_id UUID NOT NULL REFERENCES auction_items(id),
  final_price BIGINT NOT NULL,
  round_number INTEGER NOT NULL,
  is_tie_break_sale BOOLEAN DEFAULT false,
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES auctions(id),
  user_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES auctions(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auction participants (bidders allowed in an auction)
CREATE TABLE IF NOT EXISTS auction_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  role VARCHAR(50) DEFAULT 'bidder' CHECK (role IN ('bidder', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auction_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bids_auction_item ON bids(auction_item_id);
CREATE INDEX IF NOT EXISTS idx_bids_team ON bids(team_id);
CREATE INDEX IF NOT EXISTS idx_bids_created ON bids(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_auction ON players(auction_id);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_auction_items_auction ON auction_items(auction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_auction ON audit_logs(auction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_auction ON notifications(auction_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(migrations);
    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
