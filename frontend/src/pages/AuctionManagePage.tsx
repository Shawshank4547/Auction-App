import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, Users, List, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Auction, Team, Player } from '../types';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import Modal from '../components/shared/Modal';
import Spinner from '../components/shared/Spinner';
import Badge from '../components/shared/Badge';
import { formatCurrency, shortCurrency } from '../utils/format';

type Tab = 'settings' | 'teams' | 'players';

const AuctionManagePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'settings');

  // Team form
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', totalBudget: '', ownerId: '', maxPlayers: '25' });
  const [teamLoading, setTeamLoading] = useState(false);

  // Player form
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerForm, setPlayerForm] = useState({ name: '', category: '', role: '', basePrice: '', description: '' });
  const [playerLoading, setPlayerLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/auctions/${id}`),
      api.get(`/auctions/${id}/teams`),
      api.get(`/auctions/${id}/players?limit=200`),
    ]).then(([aRes, tRes, pRes]) => {
      setAuction(aRes.data.data);
      setTeams(tRes.data.data);
      setPlayers(pRes.data.data);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setTeamLoading(true);
    try {
      const res = await api.post(`/auctions/${id}/teams`, {
        name: teamForm.name,
        totalBudget: parseInt(teamForm.totalBudget),
        ownerId: teamForm.ownerId || undefined,
        maxPlayers: parseInt(teamForm.maxPlayers) || 25,
      });
      setTeams((prev) => [...prev, res.data.data]);
      setShowTeamModal(false);
      setTeamForm({ name: '', totalBudget: '', ownerId: '', maxPlayers: '25' });
      toast.success('Team created');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create team');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!id || !window.confirm('Delete this team?')) return;
    try {
      await api.delete(`/auctions/${id}/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      toast.success('Team deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cannot delete');
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setPlayerLoading(true);
    try {
      const fd = new FormData();
      Object.entries(playerForm).forEach(([k, v]) => v && fd.append(k, v));
      if (photoFile) fd.append('photo', photoFile);
      const res = await api.post(`/auctions/${id}/players`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPlayers((prev) => [...prev, res.data.data]);
      setShowPlayerModal(false);
      setPlayerForm({ name: '', category: '', role: '', basePrice: '', description: '' });
      setPhotoFile(null);
      toast.success('Player created');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create player');
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleSchedulePlayer = async (playerId: string) => {
    if (!id) return;
    try {
      await api.post(`/auctions/${id}/players/schedule`, {
        playerIds: [playerId],
        roundNumber: auction?.current_round || 1,
      });
      setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, status: 'available' as const } : p));
      toast.success('Player scheduled');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!id || !window.confirm('Delete this player?')) return;
    try {
      await api.delete(`/auctions/${id}/players/${playerId}`);
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      toast.success('Player deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cannot delete');
    }
  };

  if (loading) return <Spinner className="py-20" />;
  if (!auction) return <div className="text-center py-20 text-gray-400">Auction not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/auctions/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Manage: {auction.name}</h1>
          <p className="text-xs text-gray-400">Organizer panel</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        {([['settings', Settings], ['teams', Users], ['players', List]] as [Tab, any][]).map(([t, Icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={14} />{t}
          </button>
        ))}
      </div>

      {/* Teams Tab */}
      {tab === 'teams' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-white">Teams ({teams.length})</h2>
            <Button size="sm" onClick={() => setShowTeamModal(true)}>
              <Plus size={14} className="mr-1" /> Add Team
            </Button>
          </div>
          {teams.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">{t.owner_name || 'No owner assigned'} · {t.squad_size} players</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-semibold">{shortCurrency(t.remaining_budget)}</p>
                <p className="text-xs text-gray-500">of {shortCurrency(t.total_budget)}</p>
              </div>
              <button
                onClick={() => handleDeleteTeam(t.id)}
                className="p-2 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Players Tab */}
      {tab === 'players' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-white">Players ({players.length})</h2>
            <Button size="sm" onClick={() => setShowPlayerModal(true)}>
              <Plus size={14} className="mr-1" /> Add Player
            </Button>
          </div>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center gap-3">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-bold">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.category} · {p.role} · Base: {p.base_price ? shortCurrency(p.base_price) : '—'}</p>
                </div>
                <Badge variant={p.status === 'sold' ? 'success' : p.status === 'available' ? 'info' : 'default'} size="sm">
                  {p.status}
                </Badge>
                {p.status === 'draft' && (
                  <Button size="sm" variant="ghost" onClick={() => handleSchedulePlayer(p.id)}>Schedule</Button>
                )}
                {(p.status === 'draft' || p.status === 'available') && (
                  <button
                    onClick={() => handleDeletePlayer(p.id)}
                    className="p-1.5 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-white">Auction Configuration</h2>
          <p className="text-gray-400 text-sm">Edit via the auction settings form. (Coming soon in v2)</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              ['Bid Increment', formatCurrency(auction.bid_increment, auction.currency)],
              ['Timer', `${auction.timer_duration}s`],
              ['Anti-sniping', auction.anti_sniping_enabled ? 'On' : 'Off'],
              ['Bid Cap', auction.bid_cap_enabled ? 'On' : 'Off'],
              ['Round 2', auction.enable_round2 ? 'On' : 'Off'],
              ['Round 3', auction.enable_round3 ? 'On' : 'Off'],
              ['Tie-break', auction.tie_break_mode.replace(/_/g, ' ')],
              ['Order', auction.auction_order_mode],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400">{k}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      <Modal isOpen={showTeamModal} onClose={() => setShowTeamModal(false)} title="Add Team">
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <Input label="Team Name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required />
          <Input label="Total Budget" type="number" value={teamForm.totalBudget} onChange={(e) => setTeamForm({ ...teamForm, totalBudget: e.target.value })} placeholder="e.g. 10000000" required />
          <Input label="Max Players" type="number" value={teamForm.maxPlayers} onChange={(e) => setTeamForm({ ...teamForm, maxPlayers: e.target.value })} />
          <Input label="Owner User ID (optional)" value={teamForm.ownerId} onChange={(e) => setTeamForm({ ...teamForm, ownerId: e.target.value })} placeholder="UUID of the bidder" />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setShowTeamModal(false)}>Cancel</Button>
            <Button type="submit" fullWidth loading={teamLoading}>Create Team</Button>
          </div>
        </form>
      </Modal>

      {/* Add Player Modal */}
      <Modal isOpen={showPlayerModal} onClose={() => setShowPlayerModal(false)} title="Add Player">
        <form onSubmit={handleCreatePlayer} className="space-y-3">
          <Input label="Player Name" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Category" value={playerForm.category} onChange={(e) => setPlayerForm({ ...playerForm, category: e.target.value })} placeholder="Batsman, Bowler…" />
            <Input label="Role" value={playerForm.role} onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })} placeholder="Opening, Pace…" />
          </div>
          <Input label="Base Price" type="number" value={playerForm.basePrice} onChange={(e) => setPlayerForm({ ...playerForm, basePrice: e.target.value })} placeholder="e.g. 500000" required />
          <Input label="Description" value={playerForm.description} onChange={(e) => setPlayerForm({ ...playerForm, description: e.target.value })} />
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1">Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setShowPlayerModal(false)}>Cancel</Button>
            <Button type="submit" fullWidth loading={playerLoading}>Create Player</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AuctionManagePage;
