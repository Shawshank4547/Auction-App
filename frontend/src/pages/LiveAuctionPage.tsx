import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pause, Play, SkipForward, ArrowLeft, Flag, X, List, Trophy, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useAuctionStore from '../store/auctionStore';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import { Auction, AuctionItem, Team } from '../types';
import AuctionTimer from '../components/auction/AuctionTimer';
import LivePlayerCard from '../components/auction/LivePlayerCard';
import SoldSummary from '../components/auction/SoldSummary';
import BidPanel from '../components/bid/BidPanel';
import TieBreakPanel from '../components/bid/TieBreakPanel';
import BidFeed from '../components/auction/BidFeed';
import ChatBox from '../components/auction/ChatBox';
import TeamBudgetBar from '../components/team/TeamBudgetBar';
import Button from '../components/shared/Button';
import Spinner from '../components/shared/Spinner';
import Badge from '../components/shared/Badge';
import { formatCurrency, shortCurrency } from '../utils/format';

const LiveAuctionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const {
    currentAuction, teams, liveItem, timeRemaining, auctionItems,
    isPaused, activeTieBreak, auctionEnded, lastSold, soldPlayers, reset,
    setCurrentAuction, setTeams, setLiveItem, setTimeRemaining,
    setAuctionItems, setIsPaused, setLastSold,
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
      setIsPaused(!!(li && li.paused_at));

      if (user?.role === 'bidder' || user?.role === 'viewer') {
        try {
          const partRes = await api.get(`/auctions/${id}/my-participation`);
          if (partRes.data.data?.team) {
            const teamData = partRes.data.data.team;
            const found = t.find((tm: Team) => tm.id === teamData.id);
            setMyTeam(found || teamData);
          }
        } catch {
          setMyTeam(null);
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

  useEffect(() => {
    if (myTeam && teams.length > 0) {
      const updated = teams.find(t => t.id === myTeam.id);
      if (updated && updated.remaining_budget !== myTeam.remaining_budget) {
        setMyTeam(updated);
      }
    }
  }, [teams]);

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
      setShowQueue(false);
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
            <Button variant={isPaused ? 'success' : 'secondary'} size="sm" loading={actionLoading} onClick={handlePause}>
              {isPaused ? <Play size={14} className="mr-1" /> : <Pause size={14} className="mr-1" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowQueue(!showQueue)}
              className={showQueue ? 'bg-gray-700 border-gray-500' : ''}>
              <List size={14} className="mr-1" />
              Queue ({pendingItems.length})
            </Button>
            <Button variant="danger" size="sm" onClick={() => setShowEndConfirm(true)}>
              <Flag size={14} className="mr-1" /> End
            </Button>
          </div>
        )}
      </div>

      {/* Pause banner */}
      {isPaused && !auctionIsOver && (
        <div className="sticky top-[57px] z-20 bg-yellow-900/80 border-b border-yellow-700 px-4 py-2 flex items-center justify-center gap-3 backdrop-blur-sm">
          <span className="text-lg">⏸️</span>
          <span className="text-yellow-300 font-semibold text-sm">Auction Paused</span>
          {isOrganizer && (
            <Button size="sm" variant="success" loading={actionLoading} onClick={handlePause} className="ml-2">
              <Play size={12} className="mr-1" /> Resume
            </Button>
          )}
        </div>
      )}

      {/* Queue panel */}
      {showQueue && isOrganizer && (
        <div className="fixed inset-y-0 right-0 z-40 w-80 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <List size={16} className="text-blue-400" />
              Player Queue
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{pendingItems.length}</span>
            </h2>
            <button onClick={() => setShowQueue(false)} className="p-1.5 rounded hover:bg-gray-700 text-gray-400">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No players in queue</div>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-bold shrink-0">
                    #{item.sequence_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.player_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.category ? `${item.category}` : ''}
                      {item.base_price ? ` · Base: ₹${(Number(item.base_price) / 100000).toFixed(1)}L` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="primary" loading={actionLoading}
                    onClick={() => handleNextPlayer(item.id)} disabled={!!liveItem}>
                    <SkipForward size={13} className="mr-1" />
                    {liveItem ? 'Wait' : 'Go'}
                  </Button>
                </div>
              ))
            )}
          </div>
          {liveItem && (
            <div className="px-3 py-2 border-t border-gray-800 bg-yellow-900/20">
              <p className="text-xs text-yellow-400 text-center">
                Player currently being auctioned. Wait for them to finish.
              </p>
            </div>
          )}
        </div>
      )}

      {/* End confirm */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-red-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-white">End Auction?</h2>
            <p className="text-gray-400 text-sm">
              This will permanently end the auction. Any player currently being bid on will be marked unsold. This cannot be undone.
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
          <div className="space-y-6">
            <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
              <div className="text-5xl mb-4">🏁</div>
              <h2 className="text-2xl font-bold text-white mb-2">Auction Completed</h2>
              <p className="text-gray-400 mb-6">All bidding has ended.</p>
              <Button onClick={() => navigate(`/auctions/${id}`)}>View Results</Button>
            </div>
            {soldPlayers.length > 0 && (
              <SoldPlayersList soldPlayers={soldPlayers} currency={currentAuction.currency} myTeamId={myTeam?.id} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Left: Player + Timer */}
            <div className="lg:col-span-2 space-y-4">

              {/* Sold summary banner */}
              {!liveItem && lastSold && (
                <SoldSummary
                  playerName={lastSold.playerName}
                  teamName={lastSold.teamName}
                  finalPrice={lastSold.finalPrice}
                  currency={currentAuction.currency}
                  photoUrl={lastSold.photoUrl}
                  isMyTeam={lastSold.teamId === myTeam?.id}
                  onDismiss={() => setLastSold(null)}
                />
              )}

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
                /* Waiting state — no live player */
                <div className="space-y-4">
                  {!lastSold && (
                    <div className="bg-gray-800 rounded-xl p-8 text-center">
                      <div className="text-4xl mb-3">🏏</div>
                      <h2 className="text-xl font-semibold text-white mb-1">Waiting for next player…</h2>
                      <p className="text-gray-500 text-sm mb-4">
                        {pendingItems.length > 0
                          ? `${pendingItems.length} player${pendingItems.length > 1 ? 's' : ''} remaining in queue`
                          : 'No more players in queue'}
                      </p>
                      {isOrganizer && pendingItems.length > 0 && (
                        <Button variant="primary" onClick={() => setShowQueue(true)}>
                          <List size={15} className="mr-2" /> Open Queue to Introduce Players
                        </Button>
                      )}
                      {isOrganizer && pendingItems.length === 0 && (
                        <Button variant="danger" onClick={() => setShowEndConfirm(true)}>
                          <Flag size={14} className="mr-2" /> End Auction
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Sold players history — visible to ALL roles */}
                  {soldPlayers.length > 0 && (
                    <SoldPlayersList
                      soldPlayers={soldPlayers}
                      currency={currentAuction.currency}
                      myTeamId={myTeam?.id}
                    />
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
                    .sort((a, b) => Number(b.remaining_budget) - Number(a.remaining_budget))
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

// ── Sold Players List component ──────────────────────────────────────────────

interface SoldPlayersListProps {
  soldPlayers: import('../store/auctionStore').SoldPlayerEntry[];
  currency: string;
  myTeamId?: string | null;
}

const SoldPlayersList: React.FC<SoldPlayersListProps> = ({ soldPlayers, currency, myTeamId }) => {
  const soldCount = soldPlayers.filter(p => p.teamId).length;
  const unsoldCount = soldPlayers.filter(p => !p.teamId).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" />
          Players Sold This Session
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {soldCount > 0 && (
            <span className="bg-green-900/40 border border-green-800/50 text-green-400 px-2 py-0.5 rounded-full">
              {soldCount} sold
            </span>
          )}
          {unsoldCount > 0 && (
            <span className="bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              {unsoldCount} unsold
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-800/60 max-h-96 overflow-y-auto">
        {soldPlayers.map((entry, idx) => {
          const isSold = !!entry.teamId;
          const isMyTeam = entry.teamId === myTeamId;

          return (
            <div
              key={entry.auctionItemId}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isMyTeam ? 'bg-yellow-900/10' : ''
              }`}
            >
              {/* Rank / index */}
              <span className="text-xs text-gray-600 w-5 shrink-0 text-right">
                {soldPlayers.length - idx}
              </span>

              {/* Photo */}
              {entry.photoUrl ? (
                <img
                  src={entry.photoUrl}
                  alt={entry.playerName}
                  className="h-9 w-9 rounded-lg object-cover object-center shrink-0 border border-gray-700"
                />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500 font-bold shrink-0">
                  {entry.playerName.charAt(0)}
                </div>
              )}

              {/* Name + team */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{entry.playerName}</p>
                {isSold ? (
                  <p className="text-xs text-gray-400 truncate">
                    <span className={isMyTeam ? 'text-yellow-400 font-semibold' : 'text-gray-300'}>
                      {entry.teamName}
                    </span>
                    {isMyTeam && ' 🏆'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 italic">Unsold</p>
                )}
              </div>

              {/* Price / status */}
              <div className="shrink-0 text-right">
                {isSold ? (
                  <span className={`text-sm font-bold ${isMyTeam ? 'text-yellow-400' : 'text-green-400'}`}>
                    {shortCurrency(entry.finalPrice, currency)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                    Unsold
                  </span>
                )}
              </div>

              {/* Sold indicator */}
              {isSold && (
                <CheckCircle size={14} className={`shrink-0 ${isMyTeam ? 'text-yellow-400' : 'text-green-500'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveAuctionPage;