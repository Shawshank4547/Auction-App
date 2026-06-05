import { create } from 'zustand';
import { Auction, AuctionItem, Team, ChatMessage, TieBreakRound } from '../types';

interface TieBreakState {
  tieBreakRoundId: string;
  auctionItemId: string;
  roundNumber: number;
  eligibleTeams: string[];
  capAmount?: number;
  submitted: boolean;
}

interface AuctionStore {
  // Current auction data
  currentAuction: Auction | null;
  teams: Team[];
  liveItem: AuctionItem | null;
  timeRemaining: number | null;
  auctionItems: AuctionItem[];

  // Real-time feed
  recentBids: Array<{ teamId: string; teamName: string; amount: number; timestamp: string }>;
  chatMessages: ChatMessage[];

  // Tie-break
  activeTieBreak: TieBreakState | null;

  // UI state
  isPaused: boolean;

  // Actions
  setCurrentAuction: (auction: Auction) => void;
  setTeams: (teams: Team[]) => void;
  setLiveItem: (item: AuctionItem | null) => void;
  setTimeRemaining: (t: number | null) => void;
  setAuctionItems: (items: AuctionItem[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: (msgs: ChatMessage[]) => void;
  addBidFeed: (entry: { teamId: string; teamName: string; amount: number }) => void;
  setActiveTieBreak: (tb: TieBreakState | null) => void;
  setIsPaused: (v: boolean) => void;
  updateTeamBudget: (teamId: string, remaining: number) => void;
  updateLiveItemPrice: (price: number, teamId: string, teamName: string, timeRemaining?: number) => void;
  reset: () => void;
}

const useAuctionStore = create<AuctionStore>((set) => ({
  currentAuction: null,
  teams: [],
  liveItem: null,
  timeRemaining: null,
  auctionItems: [],
  recentBids: [],
  chatMessages: [],
  activeTieBreak: null,
  isPaused: false,

  setCurrentAuction: (auction) => set({ currentAuction: auction }),
  setTeams: (teams) => set({ teams }),
  setLiveItem: (liveItem) => set({ liveItem }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  setAuctionItems: (auctionItems) => set({ auctionItems }),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-99), msg],
    })),

  setChatHistory: (msgs) => set({ chatMessages: msgs }),

  addBidFeed: (entry) =>
    set((state) => ({
      recentBids: [
        { ...entry, timestamp: new Date().toISOString() },
        ...state.recentBids.slice(0, 19),
      ],
    })),

  setActiveTieBreak: (activeTieBreak) => set({ activeTieBreak }),
  setIsPaused: (isPaused) => set({ isPaused }),

  updateTeamBudget: (teamId, remaining) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, remaining_budget: remaining } : t
      ),
    })),

  updateLiveItemPrice: (price, teamId, teamName, timeRemaining) =>
    set((state) => ({
      liveItem: state.liveItem
        ? { ...state.liveItem, current_price: price, current_leader_team_id: teamId, leader_team_name: teamName }
        : null,
      timeRemaining: timeRemaining !== undefined ? timeRemaining : state.timeRemaining,
    })),

  reset: () =>
    set({
      currentAuction: null,
      teams: [],
      liveItem: null,
      timeRemaining: null,
      auctionItems: [],
      recentBids: [],
      chatMessages: [],
      activeTieBreak: null,
      isPaused: false,
    }),
}));

export default useAuctionStore;
