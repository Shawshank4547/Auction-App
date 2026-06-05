import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pause, Play, SkipForward, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useAuctionStore from '../store/auctionStore';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import { Auction, AuctionItem, Team } from '../types';
import AuctionTimer from '../components/auction/AuctionTimer';
import LivePlayerCard from '../components/auction/LivePlayerCard';
import BidPanel from '../components/bid/BidPanel';
import TieBreakPanel from '../components/bid/TieBreakPanel';
import BidFeed from '../components/auction/BidFeed';
import ChatBox from '../components/auction/ChatBox';
import TeamBudgetBar from '../components/team/TeamBudgetBar';
import Button from '../components/shared/Button';
import Spinner from '../components/shared/Spinner';
import Badge from '../components/shared/Badge';

const LiveAuctionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const {
    currentAuction, teams, liveItem, timeRemaining, auctionItems,
    isPaused, activeTieBreak, reset,
    setCurrentAuction, setTeams, setLiveItem, setTimeRemaining, setAuctionItems,
  } = useAuctionStore();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/auctions/${id}/state`);
      const { auction, teams: t, liveItem: li, timeRemaining: tr } = res.data.data;
      setCurrentAuction(auction);
      setTeams(t);
      setLiveItem(li);
      setTimeRemaining(tr);

      // Find my team
      const participantRes = await api.get('/users/my-auctions');
      const myEntry = participantRes.data.data?.find((a: any) => a.id === id);
      if (myEntry?.team_id) {
        const found = t.find((tm: Team) => tm.id === myEntry.team_id);
        setMyTeam(found || null);
      }

      // Fetch auction items queue
      const itemsRes = await api.get(`/auctions/${id}/items?round=${auction.current_round}`);
      setAuctionItems(itemsRes.data.data);
    } catch {
      toast.error('Failed to load auction state');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reset();
    fetchState();
    return () => { reset(); };
  }, [id]);

  // Connect to socket and listen to events
  useAuctionSocket({ auctionId: id!, myTeamId: myTeam?.id });

  const isOrganizer = currentAuction?.organizer_id === user?.id || user?.role === 'super_admin';

  const handlePause = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post(`/auctions/${id}/${isPaused ? 'resume' : 'pause'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextPlayer = async (auctionItemId: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post(`/auctions/${id}/next-player`, { auctionItemId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to introduce player');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!currentAuction) return <div className="text-center py-20 text-gray-400">Auction not found</div>;

  const pendingItems = auctionItems.filter((i) => i.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(`/auctions/${id}`)} className="p-1.5 rounded hover:bg-gray-800 text-gray-400">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{currentAuction.name}</p>
          <p className="text-xs text-gray-400">Round {currentAuction.current_round}</p>
        </div>
        <Badge variant={isPaused ? 'warning' : 'success'} size="sm">
          {isPaused ? 'PAUSED' : 'LIVE'}
        </Badge>
        {isOrganizer && (
          <div className="flex gap-2">
            <Button
              variant={isPaused ? 'success' : 'secondary'}
              size="sm"
              loading={actionLoading}
              onClick={handlePause}
            >
              {isPaused ? <Play size={14} className="mr-1" /> : <Pause size={14} className="mr-1" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQueue(!showQueue)}
            >
              <ChevronRight size={14} className="mr-1" />
              Queue ({pendingItems.length})
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: Player + Timer */}
          <div className="lg:col-span-2 space-y-4">
            {liveItem ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LivePlayerCard item={liveItem} currency={currentAuction.currency} />
                  <div className="flex flex-col items-center justify-center space-y-4 bg-gray-800 rounded-xl p-4">
                    <AuctionTimer
                      timeRemaining={timeRemaining}
                      isPaused={isPaused}
                      totalTime={currentAuction.timer_duration}
                    />
                    {activeTieBreak && myTeam && (
                      <TieBreakPanel auction={currentAuction} myTeamId={myTeam.id} />
                    )}
                    {!activeTieBreak && (
                      <BidPanel
                        auction={currentAuction}
                        liveItem={liveItem}
                        myTeam={myTeam}
                        disabled={isPaused}
                      />
                    )}
                  </div>
                </div>
                <BidFeed currency={currentAuction.currency} />
              </>
            ) : (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">🏏</div>
                <h2 className="text-xl font-semibold text-white">Waiting for next player…</h2>
                {isOrganizer && pendingItems.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-gray-400 text-sm">Select a player to introduce:</p>
                    {pendingItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-gray-700 rounded-lg p-3">
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-white">{item.player_name}</p>
                          <p className="text-xs text-gray-400">#{item.sequence_order}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={actionLoading}
                          onClick={() => handleNextPlayer(item.id)}
                        >
                          <SkipForward size={14} className="mr-1" /> Introduce
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Teams + Chat */}
          <div className="space-y-4">
            {/* Team budgets */}
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3 text-sm">Team Budgets</h3>
              <div className="space-y-3">
                {teams.map((t) => (
                  <TeamBudgetBar key={t.id} team={t} currency={currentAuction.currency} compact />
                ))}
              </div>
            </div>
            <ChatBox auctionId={id!} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveAuctionPage;
