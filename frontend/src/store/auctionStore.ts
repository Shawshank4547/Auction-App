import { create } from 'zustand';
import { Auction, AuctionItem, Team, ChatMessage } from '../types';

interface TieBreakState {
  tieBreakRoundId: string;
  auctionItemId: string;
  roundNumber: number;
  eligibleTeams: string[];
  capAmount?: number;
  submitted: boolean;
}

// FIX: track the last sold player so the UI can show a summary card
export interface LastSoldInfo {
  auctionItemId: string;
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  teamId: string;
  teamName: string;
  finalPrice: number;
}

interface AuctionStore {
  currentAuction: Auction | null;
  teams: Team[];
  liveItem: AuctionItem | null;
  timeRemaining: number | null;
  auctionItems: AuctionItem[];
  recentBids: Array<{ teamId: string; teamName: string; amount: number; timestamp: string }>;
  chatMessages: ChatMessage[];
  activeTieBreak: TieBreakState | null;
  isPaused: boolean;
  auctionEnded: boolean;
  lastSold: LastSoldInfo | null;   // NEW

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
  setAuctionEnded: (v: boolean) => void;
  setLastSold: (info: LastSoldInfo | null) => void;  // NEW
  updateTeamBudget: (teamId: string, finalPrice: number) => void;
  updateLiveItemPrice: (price: number, teamId: string, teamName: string, timeRemaining?: number) => void;
  markAuctionItemSold: (auctionItemId: string) => void;
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
  auctionEnded: false,
  lastSold: null,

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
  setAuctionEnded: (auctionEnded) => set({ auctionEnded }),
  setLastSold: (lastSold) => set({ lastSold }),

  updateTeamBudget: (teamId, finalPrice) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? { ...t, remaining_budget: t.remaining_budget - finalPrice, squad_size: t.squad_size + 1 }
          : t
      ),
    })),

  updateLiveItemPrice: (price, teamId, teamName, timeRemaining) =>
    set((state) => ({
      liveItem: state.liveItem
        ? { ...state.liveItem, current_price: price, current_leader_team_id: teamId, leader_team_name: teamName }
        : null,
      timeRemaining: timeRemaining !== undefined ? timeRemaining : state.timeRemaining,
    })),

  markAuctionItemSold: (auctionItemId) =>
    set((state) => ({
      auctionItems: state.auctionItems.filter((i) => i.id !== auctionItemId),
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
      auctionEnded: false,
      lastSold: null,
    }),
}));

export default useAuctionStore;