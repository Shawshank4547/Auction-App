import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Play, Users, List, Settings,
  Gavel, Trophy, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Auction, Team, Player } from '../types';
import Badge from '../components/shared/Badge';
import Button from '../components/shared/Button';
import Spinner from '../components/shared/Spinner';
import { formatCurrency, shortCurrency } from '../utils/format';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  live: 'success', round2_live: 'success', round3_live: 'success',
  scheduled: 'info', draft: 'default', completed: 'warning', archived: 'default',
};

type Tab = 'overview' | 'teams' | 'players' | 'results';

const AuctionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    try {
      const [aRes, tRes, pRes] = await Promise.all([
        api.get(`/auctions/${id}`),
        api.get(`/auctions/${id}/teams`),
        api.get(`/auctions/${id}/players?limit=100`),
      ]);
      setAuction(aRes.data.data);
      setTeams(tRes.data.data);
      setPlayers(pRes.data.data);
    } catch {
      toast.error('Failed to load auction');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const isOrganizer = auction?.organizer_id === user?.id || user?.role === 'super_admin';

  const handleStart = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.post(`/auctions/${id}/start`);
      toast.success('Auction started!');
      navigate(`/auctions/${id}/live`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!auction) return <div className="text-center text-gray-400 py-20">Auction not found</div>;

  const isLive = auction.status.includes('live');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header — FIX: navigate to /auctions instead of -1 so completed auctions
          don't loop back to the live page in browser history */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 mt-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{auction.name}</h1>
            <Badge variant={statusVariant[auction.status] || 'default'}>
              {auction.status.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {auction.organizer_name} · Round {auction.current_round}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isOrganizer && (
            <>
              {isLive ? (
                <Link to={`/auctions/${id}/live`}>
                  <Button variant="success"><Play size={16} className="mr-1" /> Go Live</Button>
                </Link>
              ) : (auction.status === 'draft' || auction.status === 'scheduled') ? (
                <Button variant="success" loading={actionLoading} onClick={handleStart}>
                  <Play size={16} className="mr-1" /> Start
                </Button>
              ) : null}
              <Link to={`/auctions/${id}/manage`}>
                <Button variant="secondary"><Settings size={16} className="mr-1" /> Manage</Button>
              </Link>
            </>
          )}
          {isLive && !isOrganizer && (
            <Link to={`/auctions/${id}/live`}>
              <Button variant="success"><Play size={16} className="mr-1" /> Join Live</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        {(['overview', 'teams', 'players', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Gavel size={16} className="text-blue-400" /> Auction Config</h3>
            {[
              ['Currency', auction.currency],
              ['Bid Increment', formatCurrency(auction.bid_increment, auction.currency)],
              ['Timer', `${auction.timer_duration}s`],
              ['Anti-sniping', auction.anti_sniping_enabled ? `${auction.anti_sniping_trigger_window}s window` : 'Off'],
              ['Bid Cap', auction.bid_cap_enabled && auction.bid_cap_amount ? formatCurrency(auction.bid_cap_amount, auction.currency) : 'None'],
              ['Tie-break', auction.tie_break_mode.replace(/_/g, ' ')],
              ['Round 2', auction.enable_round2 ? 'Enabled' : 'Disabled'],
              ['Round 3', auction.enable_round3 ? 'Enabled' : 'Disabled'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-white font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Users size={16} className="text-blue-400" /> Teams ({teams.length})</h3>
              {teams.slice(0, 5).map((t) => (
                <div key={t.id} className="flex justify-between text-sm py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{t.name}</span>
                  <span className="text-green-400">{shortCurrency(t.remaining_budget)}</span>
                </div>
              ))}
              {teams.length > 5 && (
                <p className="text-xs text-gray-500 mt-2 text-center">+{teams.length - 5} more</p>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2"><List size={16} className="text-blue-400" /> Players ({players.length})</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {['available', 'sold', 'unsold'].map((s) => (
                  <div key={s} className="bg-gray-800 rounded-lg p-2">
                    <p className="text-lg font-bold text-white">{players.filter((p) => p.status === s).length}</p>
                    <p className="text-xs text-gray-400 capitalize">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <div className="space-y-3">
          {isOrganizer && (
            <Link to={`/auctions/${id}/manage?tab=teams`}>
              <Button variant="ghost" size="sm"><Users size={14} className="mr-1" /> Manage Teams</Button>
            </Link>
          )}
          {teams.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              {t.logo_url ? (
                <img src={t.logo_url} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold text-white">
                  {t.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.owner_name || 'No owner'} · {t.squad_size} players</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-semibold text-sm">{shortCurrency(t.remaining_budget)}</p>
                <p className="text-xs text-gray-500">of {shortCurrency(t.total_budget)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Players tab */}
      {tab === 'players' && (
        <div className="space-y-3">
          {isOrganizer && (
            <Link to={`/auctions/${id}/manage?tab=players`}>
              <Button variant="ghost" size="sm"><List size={14} className="mr-1" /> Manage Players</Button>
            </Link>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-700 flex items-center justify-center text-xs text-gray-400">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.category} · {p.role}</p>
                </div>
                <div className="text-right">
                  <Badge variant={p.status === 'sold' ? 'success' : p.status === 'unsold' ? 'danger' : p.status === 'live' ? 'warning' : 'default'} size="sm">
                    {p.status}
                  </Badge>
                  {p.status === 'sold' && p.final_price && (
                    <p className="text-xs text-green-400 mt-0.5">{shortCurrency(p.final_price)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results tab */}
      {tab === 'results' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /> Sold Players</h3>
          {players.filter((p) => p.status === 'sold').map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-white">{p.name}</p>
                <p className="text-xs text-gray-500">{p.sold_to_team}</p>
              </div>
              <p className="text-green-400 font-bold">{p.final_price ? formatCurrency(p.final_price, auction.currency) : '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionDetailPage;