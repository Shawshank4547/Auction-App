export type UserRole = 'super_admin' | 'organizer' | 'bidder' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type AuctionStatus =
  | 'draft' | 'scheduled' | 'live' | 'round1_complete'
  | 'round2_live' | 'round2_complete' | 'round3_live'
  | 'completed' | 'archived';

export type TieBreakMode = 'sealed_bid' | 'lucky_draw' | 'organizer_decision';
export type AuctionOrderMode = 'manual' | 'random' | 'category';
export type BasePriceType = 'original' | 'reduced' | 'custom';

export interface Auction {
  id: string;
  organizer_id: string;
  organizer_name?: string;
  name: string;
  description: string | null;
  currency: string;
  timezone: string;
  status: AuctionStatus;
  current_round: number;
  starting_bid: number;
  bid_increment: number;
  timer_duration: number;
  anti_sniping_enabled: boolean;
  anti_sniping_trigger_window: number;
  anti_sniping_extension: number;
  anti_sniping_max_extensions: number;
  allow_pause: boolean;
  max_pause_length: number;
  max_pause_count: number;
  enable_round2: boolean;
  enable_round3: boolean;
  round2_base_price_type: BasePriceType;
  round2_base_price_reduction: number;
  round3_base_price_type: BasePriceType;
  round3_base_price_reduction: number;
  bid_cap_enabled: boolean;
  bid_cap_amount: number | null;
  tie_break_mode: TieBreakMode;
  max_tie_break_rounds: number;
  auction_order_mode: AuctionOrderMode;
  team_count?: number;
  player_count?: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  auction_id: string;
  owner_id: string | null;
  owner_name?: string;
  name: string;
  logo_url: string | null;
  total_budget: number;
  remaining_budget: number;
  min_players: number;
  max_players: number;
  squad_size: number;
  is_active: boolean;
  players?: Player[];
  players_bought?: number;
}

export type PlayerStatus = 'draft' | 'available' | 'live' | 'sold' | 'unsold' | 'withdrawn';

export interface Player {
  id: string;
  auction_id: string;
  name: string;
  photo_url: string | null;
  category: string | null;
  role: string | null;
  base_price: number;
  description: string | null;
  statistics: Record<string, unknown>;
  status: PlayerStatus;
  sort_order: number;
  sold_to_team_id?: string;
  sold_to_team?: string;
  final_price?: number;
  created_at: string;
}

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

export interface Bid {
  id: string;
  auction_id: string;
  auction_item_id: string;
  player_id: string;
  player_name?: string;
  team_id: string;
  team_name?: string;
  bidder_id: string;
  bidder_name?: string;
  amount: number;
  status: BidStatus;
  rejection_reason: string | null;
  round_number: number;
  created_at: string;
}

export type AuctionItemStatus = 'pending' | 'live' | 'sold' | 'unsold' | 'skipped';

export interface AuctionItem {
  id: string;
  auction_id: string;
  player_id: string;
  player_name?: string;
  photo_url?: string | null;
  category?: string | null;
  role?: string | null;
  base_price?: number;
  statistics?: Record<string, unknown>;
  round_number: number;
  sequence_order: number;
  status: AuctionItemStatus;
  current_price: number | null;
  current_leader_team_id: string | null;
  leader_team_name?: string | null;
  timer_duration: number | null;
  extensions_used: number;
  paused_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TieBreakRound {
  id: string;
  auction_item_id: string;
  round_number: number;
  status: 'open' | 'closed' | 'resolved';
  winner_team_id: string | null;
  winning_amount: number | null;
  opened_at: string;
  closed_at: string | null;
}

export interface Notification {
  id: string;
  auction_id: string | null;
  user_id: string | null;
  team_id: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AuctionState {
  auction: Auction;
  teams: Team[];
  liveItem: AuctionItem | null;
  timeRemaining: number | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
