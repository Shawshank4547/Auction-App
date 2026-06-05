import { useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import socketService from '../services/socketService';
import useAuctionStore from '../store/auctionStore';
import useAuthStore from '../store/authStore';
import { AuctionItem, ChatMessage } from '../types';

interface UsedAuctionSocketOptions {
  auctionId: string;
  myTeamId?: string | null;
}

export const useAuctionSocket = ({ auctionId, myTeamId }: UsedAuctionSocketOptions) => {
  const {
    setLiveItem,
    setTimeRemaining,
    updateLiveItemPrice,
    addBidFeed,
    setChatHistory,
    addChatMessage,
    setActiveTieBreak,
    setIsPaused,
    setCurrentAuction,
  } = useAuctionStore();

  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    // Ensure connected
    const socket = socketService.connect(accessToken);
    socketService.joinAuction(auctionId);

    // ── Auction events ──────────────────────────────────────
    const offStarted = socketService.on('auction:started', () => {
      toast.success('Auction has started!');
    });

    const offPaused = socketService.on('auction:paused', () => {
      setIsPaused(true);
      toast('Auction paused', { icon: '⏸️' });
    });

    const offResumed = socketService.on('auction:resumed', () => {
      setIsPaused(false);
      toast('Auction resumed', { icon: '▶️' });
    });

    // ── Player events ───────────────────────────────────────
    const offIntroduced = socketService.on<{
      auctionItemId: string;
      playerId: string;
      playerName: string;
      basePrice: number;
    }>('player:introduced', (data) => {
      setLiveItem({
        id: data.auctionItemId,
        auction_id: auctionId,
        player_id: data.playerId,
        player_name: data.playerName,
        round_number: 1,
        sequence_order: 0,
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
      const isMyTeam = data.teamId === myTeamId;
      if (isMyTeam) {
        toast.success(`🎉 ${data.playerName} sold to YOUR team for ₹${data.finalPrice.toLocaleString('en-IN')}!`);
      } else {
        toast(`${data.playerName} sold to ${data.teamName}`, { icon: '🔨' });
      }
    });

    const offUnsold = socketService.on<{ playerName: string }>('player:unsold', (data) => {
      setLiveItem(null);
      setTimeRemaining(null);
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

    // ── Timer events ─────────────────────────────────────────
    const offTimerTick = socketService.on<{
      auctionItemId: string;
      timeRemaining: number;
      status: string;
    }>('timer:tick', (data) => {
      setTimeRemaining(data.timeRemaining);
    });

    // ── Tie-break events ──────────────────────────────────────
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
        toast('🔒 Sealed bid tie-break! Submit your best offer.', { duration: 5000 });
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

    // ── Chat events ───────────────────────────────────────────
    const offChatHistory = socketService.on<ChatMessage[]>('chat:history', (msgs) => {
      setChatHistory(msgs);
    });

    const offChatMessage = socketService.on<ChatMessage>('chat:message', (msg) => {
      addChatMessage(msg);
    });

    return () => {
      socketService.leaveAuction(auctionId);
      offStarted();
      offPaused();
      offResumed();
      offIntroduced();
      offSold();
      offUnsold();
      offBidAccepted();
      offBidRejected();
      offTimerTick();
      offTieBreakStart();
      offTieBreakEnd();
      offTieBreakSubmitted();
      offChatHistory();
      offChatMessage();
    };
  }, [auctionId, accessToken, myTeamId]);
};
