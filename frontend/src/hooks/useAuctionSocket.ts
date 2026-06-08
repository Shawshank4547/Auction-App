import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import socketService from '../services/socketService';
import useAuctionStore from '../store/auctionStore';
import useAuthStore from '../store/authStore';
import { AuctionItem, ChatMessage } from '../types';

interface UseAuctionSocketOptions {
  auctionId: string;
  myTeamId?: string | null;
}

export const useAuctionSocket = ({ auctionId, myTeamId }: UseAuctionSocketOptions) => {
  const {
    setLiveItem,
    setTimeRemaining,
    updateLiveItemPrice,
    addBidFeed,
    setChatHistory,
    addChatMessage,
    setActiveTieBreak,
    setIsPaused,
    updateTeamBudget,
    markAuctionItemSold,
  } = useAuctionStore();

  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    const socket = socketService.connect(accessToken);
    socketService.joinAuction(auctionId);

    // ── Auction lifecycle ───────────────────────────────────
    const offStarted = socketService.on('auction:started', () => {
      toast.success('Auction has started!');
    });

    const offPaused = socketService.on('auction:paused', () => {
      setIsPaused(true);
      toast('Auction paused', { icon: '⏸️' });
    });

    const offResumed = socketService.on('auction:resumed', () => {
      setIsPaused(false);
      toast.success('Auction resumed');
    });

    const offEnded = socketService.on('auction:ended', () => {
      setLiveItem(null);
      setTimeRemaining(null);
      toast('Auction has ended', { icon: '🏁', duration: 6000 });
    });

    // ── Player events ───────────────────────────────────────
    const offIntroduced = socketService.on<{
      auctionItemId: string;
      playerId: string;
      playerName: string;
      photoUrl: string | null;
      category: string | null;
      role: string | null;
      description: string | null;
      statistics: Record<string, unknown>;
      basePrice: number;
      roundNumber: number;
      sequenceOrder: number;
    }>('player:introduced', (data) => {
      // Build a complete AuctionItem from the full event data
      setLiveItem({
        id: data.auctionItemId,
        auction_id: auctionId,
        player_id: data.playerId,
        player_name: data.playerName,
        photo_url: data.photoUrl || null,
        category: data.category || null,
        role: data.role || null,
        statistics: data.statistics || {},
        base_price: data.basePrice,
        round_number: data.roundNumber,
        sequence_order: data.sequenceOrder,
        status: 'live',
        current_price: null,
        current_leader_team_id: null,
        leader_team_name: null,
        timer_duration: null,
        extensions_used: 0,
        paused_at: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      } as AuctionItem);
      // Reset tie-break state for new player
      setActiveTieBreak(null);
      toast(`🏏 Now auctioning: ${data.playerName}`);
    });

    const offSold = socketService.on<{
      auctionItemId: string;
      playerId: string;
      playerName: string;
      teamId: string;
      teamName: string;
      finalPrice: number;
    }>('player:sold', (data) => {
      setLiveItem(null);
      setTimeRemaining(null);
      setActiveTieBreak(null);
      // Update team budget in store so TeamBudgetBar reflects immediately
      updateTeamBudget(data.teamId, data.finalPrice);
      // Remove from queue
      markAuctionItemSold(data.auctionItemId);
      const isMyTeam = data.teamId === myTeamId;
      if (isMyTeam) {
        toast.success(`🎉 ${data.playerName} sold to YOUR team for ₹${data.finalPrice.toLocaleString('en-IN')}!`, { duration: 5000 });
      } else {
        toast(`${data.playerName} → ${data.teamName} for ₹${data.finalPrice.toLocaleString('en-IN')}`, { icon: '🔨', duration: 4000 });
      }
    });

    const offUnsold = socketService.on<{ auctionItemId: string; playerName: string }>('player:unsold', (data) => {
      setLiveItem(null);
      setTimeRemaining(null);
      markAuctionItemSold(data.auctionItemId);
      toast(`${data.playerName} went unsold`, { icon: '📋' });
    });

    // ── Bid events ──────────────────────────────────────────
    const offBidAccepted = socketService.on<{
      auctionItemId: string;
      teamId: string;
      amount: number;
      timeRemaining?: number;
      bid: { team_name?: string };
    }>('bid:accepted', (data) => {
      updateLiveItemPrice(data.amount, data.teamId, data.bid?.team_name || '', data.timeRemaining);
      addBidFeed({ teamId: data.teamId, teamName: data.bid?.team_name || '', amount: data.amount });
    });

    const offBidRejected = socketService.on<{ reason: string }>('bid:rejected', (data) => {
      toast.error(`Bid rejected: ${data.reason}`);
    });

    // ── Timer ────────────────────────────────────────────────
    const offTimerTick = socketService.on<{
      auctionItemId: string;
      timeRemaining: number;
      status: string;
    }>('timer:tick', (data) => {
      setTimeRemaining(data.timeRemaining);
    });

    // ── Tie-break ─────────────────────────────────────────────
    const offTieBreakStart = socketService.on<{
      auctionItemId: string;
      tieBreakRoundId: string;
      roundNumber: number;
      eligibleTeams: string[];
      capAmount?: number;
    }>('tiebreak:start', (data) => {
      const isEligible = myTeamId && data.eligibleTeams.includes(myTeamId);
      setActiveTieBreak({
        tieBreakRoundId: data.tieBreakRoundId,
        auctionItemId: data.auctionItemId,
        roundNumber: data.roundNumber,
        eligibleTeams: data.eligibleTeams,
        capAmount: data.capAmount,
        submitted: false,
      });
      if (isEligible) {
        toast('🔒 Sealed bid tie-break! Submit your best offer.', { duration: 6000 });
      } else {
        toast('Tie-break round started', { icon: '⚖️' });
      }
    });

    const offTieBreakEnd = socketService.on<{
      winnerId: string;
      amount: number;
      method?: string;
    }>('tiebreak:end', (data) => {
      setActiveTieBreak(null);
      toast(`Tie-break resolved! Winner bid ₹${data.amount.toLocaleString('en-IN')}`, { icon: '🏆' });
    });

    const offTieBreakSubmitted = socketService.on('tiebreak:bid_submitted', () => {
      useAuctionStore.setState((s) =>
        s.activeTieBreak ? { activeTieBreak: { ...s.activeTieBreak, submitted: true } } : s
      );
      toast.success('Sealed bid submitted!');
    });

    // ── Chat ──────────────────────────────────────────────────
    const offChatHistory = socketService.on<ChatMessage[]>('chat:history', (msgs) => {
      setChatHistory(msgs);
    });

    const offChatMessage = socketService.on<ChatMessage>('chat:message', (msg) => {
      addChatMessage(msg);
    });

    return () => {
      socketService.leaveAuction(auctionId);
      offStarted(); offPaused(); offResumed(); offEnded();
      offIntroduced(); offSold(); offUnsold();
      offBidAccepted(); offBidRejected();
      offTimerTick();
      offTieBreakStart(); offTieBreakEnd(); offTieBreakSubmitted();
      offChatHistory(); offChatMessage();
    };
  }, [auctionId, accessToken, myTeamId]);
};