import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pause, Play, SkipForward, ArrowLeft, ChevronRight, Flag } from 'lucide-react';
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
    isPaused, activeTieBreak, auctionEnded, reset,
    setCurrentAuction, setTeams, setLiveItem, setTimeRemaining, setAuctionItems,
  } = useAuctionStore();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const fetchState = useCallback(async () => {
    if (!id) return;
    try {
      const [stateRes, itemsRes] = await Promise.all([
        api.get(`/auctions/${id}/state`),
        api.get(`/auctions/${id}/items?round=1`),
      ]);

      const { auction, teams: t, liveItem: li, timeRemaining: tr } = stateRes.data.data;
      setCurrentAuction(auction);
      setTeams(t);
      setLiveItem(li);
      setTimeRemaining(tr);
      setAuctionItems(itemsRes.data.data);

      // Find my team — bidder only (organizer has no team)
      if (user?.role === 'bidder' || user?.role === 'viewer') {
        const participantRes = await api.get('/users/my-auctions');
        const myEntry = participantRes.data.data?.find((a: any) => a.id === id);
        if (myEntry?.team_id) {
          const found = t.find((tm: Team) => tm.id === myEntry.team_id);
          setMyTeam(found || null);
        }
      }
    } catch {
      toast.error('Failed to load auction state');
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    reset();
    fetchState();
    return () => { reset(); };
  }, [id]);

  useAuctionSocket({ auctionId: id!, myTeamId: myTeam?.id });

  const isOrganizer = user?.role === 'super_admin' ||
    (currentAuction?.organizer_id === user?.id);

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

  const handleEndAuction = async () => {
    if (!id) return;
    setActionLoading(true);
    setShowEndConfirm(false);
    try {
      await api.post(`/auctions/${id}/end`);
      toast.success('Auction ended');
      navigate(`/auctions/${id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to end auction');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!currentAuction) return <div className="text-center py-20 text-gray-400">Auction not found</div>;

  const pendingItems = auctionItems.filter((i) => i.status === 'pending');

  const auctionIsOver = auctionEnded || currentAuction.status === 'completed';

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
        <Badge variant={auctionIsOver ? 'default' : isPaused ? 'warning' : 'success'} size="sm">
          {auctionIsOver ? 'ENDED' : isPaused ? 'PAUSED' : 'LIVE'}
        </Badge>
        {isOrganizer && !auctionIsOver && (
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
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowEndConfirm(true)}
            >
              <Flag size={14} className="mr-1" />
              End
            </Button>
          </div>
        )}
      </div>

      {/* End Auction confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-red-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-white">End Auction?</h2>
            <p className="text-gray-400 text-sm">
              This will permanently end the auction. Any player currently being bid on will be marked unsold.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setShowEndConfirm(false)}>Cancel</Button>
              <Button variant="danger" fullWidth loading={actionLoading} onClick={handleEndAuction}>
                Yes, End Auction
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 max-w-7xl mx-auto">
        {auctionIsOver ? (
          <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800">
            <div className="text-5xl mb-4">🏁</div>
            <h2 className="text-2xl font-bold text-white mb-2">Auction Completed</h2>
            <p className="text-gray-400 mb-6">All bidding has ended.</p>
            <Button onClick={() => navigate(`/auctions/${id}`)}>View Results</Button>
          </div>
        ) : (
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
                        <>
                          {isOrganizer ? (
                            <div className="w-full bg-gray-700/50 rounded-lg p-3 text-center text-sm text-gray-400">
                              👁 Organizer view — bidding controls visible to teams
                            </div>
                          ) : (
                            <BidPanel
                              auction={currentAuction}
                              liveItem={liveItem}
                              myTeam={myTeam}
                              disabled={isPaused}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <BidFeed currency={currentAuction.currency} />
                </>
              ) : (
                <div className="bg-gray-800 rounded-xl p-12 text-center">
                  <div className="text-4xl mb-3">🏏</div>
                  <h2 className="text-xl font-semibold text-white mb-1">Waiting for next player…</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    {pendingItems.length > 0
                      ? `${pendingItems.length} player${pendingItems.length > 1 ? 's' : ''} remaining in queue`
                      : 'No more players in queue'}
                  </p>
                  {isOrganizer && pendingItems.length > 0 && (
                    <div className="space-y-2 max-w-sm mx-auto">
                      <p className="text-gray-400 text-sm font-medium">Select a player to introduce:</p>
                      {pendingItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 bg-gray-700 rounded-lg p-3 text-left">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.player_name}</p>
                            <p className="text-xs text-gray-400">
                              #{item.sequence_order}
                              {item.category ? ` · ${item.category}` : ''}
                              {item.base_price ? ` · Base: ₹${(item.base_price / 100000).toFixed(1)}L` : ''}
                            </p>
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
                      {pendingItems.length > 8 && (
                        <p className="text-xs text-gray-500 text-center pt-1">+{pendingItems.length - 8} more in queue</p>
                      )}
                    </div>
                  )}
                  {isOrganizer && pendingItems.length === 0 && (
                    <Button variant="danger" onClick={() => setShowEndConfirm(true)}>
                      <Flag size={14} className="mr-2" /> End Auction
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Teams + Chat */}
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">Team Budgets</h3>
                <div className="space-y-3">
                  {teams
                    .slice()
                    .sort((a, b) => b.remaining_budget - a.remaining_budget)
                    .map((t) => (
                      <TeamBudgetBar key={t.id} team={t} currency={currentAuction.currency} compact />
                    ))}
                </div>
              </div>
              <ChatBox auctionId={id!} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAuctionPage;