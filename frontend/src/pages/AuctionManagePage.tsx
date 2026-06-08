import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, Users, List, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Auction, Team, Player } from '../types';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';
import Modal from '../components/shared/Modal';
import Spinner from '../components/shared/Spinner';
import Badge from '../components/shared/Badge';
import UserSearchPicker from '../components/shared/UserSearchPicker';
import { formatCurrency, shortCurrency } from '../utils/format';

type Tab = 'settings' | 'teams' | 'players';

interface TeamFormOwner {
  id: string;
  name: string;
  email: string;
}

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
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', totalBudget: '', maxPlayers: '25' });
  const [teamOwner, setTeamOwner] = useState<TeamFormOwner | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  // Player form
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
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

  // FIX: canEditAuction gates ALL mutations (add + delete + edit), not just delete
  const canEditAuction = auction?.status === 'draft' || auction?.status === 'scheduled';

  const openAddTeam = () => {
    setEditingTeam(null);
    setTeamForm({ name: '', totalBudget: '', maxPlayers: '25' });
    setTeamOwner(null);
    setShowTeamModal(true);
  };

  const openEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      totalBudget: String(team.total_budget),
      maxPlayers: String(team.max_players),
    });
    setTeamOwner(
      team.owner_id && team.owner_name
        ? { id: team.owner_id, name: team.owner_name, email: (team as any).owner_email || '' }
        : null
    );
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setTeamLoading(true);
    try {
      if (editingTeam) {
        const res = await api.patch(`/auctions/${id}/teams/${editingTeam.id}`, {
          name: teamForm.name,
          ownerId: teamOwner?.id || undefined,
          maxPlayers: parseInt(teamForm.maxPlayers) || 25,
        });
        setTeams((prev) => prev.map((t) => t.id === editingTeam.id ? {
          ...res.data.data,
          owner_name: teamOwner?.name,
          owner_email: teamOwner?.email,
        } : t));
        toast.success('Team updated');
      } else {
        const res = await api.post(`/auctions/${id}/teams`, {
          name: teamForm.name,
          totalBudget: parseInt(teamForm.totalBudget),
          ownerId: teamOwner?.id || undefined,
          maxPlayers: parseInt(teamForm.maxPlayers) || 25,
        });
        setTeams((prev) => [...prev, {
          ...res.data.data,
          owner_name: teamOwner?.name,
          owner_email: teamOwner?.email,
        }]);
        toast.success('Team created');
      }
      setShowTeamModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save team');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!id || !window.confirm('Delete this team? This cannot be undone.')) return;
    try {
      await api.delete(`/auctions/${id}/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      toast.success('Team deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Cannot delete — auction may already be live');
    }
  };

  const openAddPlayer = () => {
    setEditingPlayer(null);
    setPlayerForm({ name: '', category: '', role: '', basePrice: '', description: '' });
    setPhotoFile(null);
    setShowPlayerModal(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({
      name: player.name,
      category: player.category || '',
      role: player.role || '',
      basePrice: String(player.base_price || ''),
      description: (player as any).description || '',
    });
    setPhotoFile(null);
    setShowPlayerModal(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!playerForm.name.trim()) {
      toast.error('Player name is required');
      return;
    }
    const basePriceVal = parseInt(playerForm.basePrice);
    if (isNaN(basePriceVal) || basePriceVal < 0) {
      toast.error('Please enter a valid base price');
      return;
    }

    setPlayerLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', playerForm.name.trim());
      fd.append('basePrice', String(basePriceVal));
      if (playerForm.category) fd.append('category', playerForm.category);
      if (playerForm.role) fd.append('role', playerForm.role);
      if (playerForm.description) fd.append('description', playerForm.description);
      if (photoFile) fd.append('photo', photoFile);

      if (editingPlayer) {
        const res = await api.patch(`/auctions/${id}/players/${editingPlayer.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPlayers((prev) => prev.map((p) => p.id === editingPlayer.id ? res.data.data : p));
        toast.success('Player updated');
      } else {
        const res = await api.post(`/auctions/${id}/players`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPlayers((prev) => [...prev, res.data.data]);
        toast.success('Player created');
      }
      setShowPlayerModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save player');
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
            {/* FIX: only show Add Team button when auction is editable */}
            {canEditAuction && (
              <Button size="sm" onClick={openAddTeam}>
                <Plus size={14} className="mr-1" /> Add Team
              </Button>
            )}
          </div>

          {/* FIX: show read-only notice when auction is live/completed */}
          {!canEditAuction && (
            <p className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-3 py-2">
              Auction is {auction.status.replace(/_/g, ' ')} — teams cannot be added or deleted. You can still reassign owners.
            </p>
          )}

          {teams.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm bg-gray-900 rounded-xl border border-gray-800">
              No teams yet. Add your first team above.
            </div>
          )}
          {teams.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {t.owner_name
                    ? <span className="text-blue-400">{t.owner_name}</span>
                    : <span className="italic">No owner assigned</span>
                  }
                  {' · '}{t.squad_size} players
                </p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-semibold">{shortCurrency(t.remaining_budget)}</p>
                <p className="text-xs text-gray-500">of {shortCurrency(t.total_budget)}</p>
              </div>
              <button
                onClick={() => openEditTeam(t)}
                className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="Edit team"
              >
                <Edit2 size={15} />
              </button>
              {/* FIX: delete only when editable */}
              {canEditAuction && (
                <button
                  onClick={() => handleDeleteTeam(t.id)}
                  className="p-2 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                  title="Delete team"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Players Tab */}
      {tab === 'players' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-white">Players ({players.length})</h2>
            {/* FIX: only show Add Player button when auction is editable */}
            {canEditAuction && (
              <Button size="sm" onClick={openAddPlayer}>
                <Plus size={14} className="mr-1" /> Add Player
              </Button>
            )}
          </div>

          {/* FIX: show read-only notice when live/completed */}
          {!canEditAuction && (
            <p className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-3 py-2">
              Auction is {auction.status.replace(/_/g, ' ')} — new players cannot be added.
            </p>
          )}

          {players.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm bg-gray-900 rounded-xl border border-gray-800">
              No players yet.
            </div>
          )}
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
                  <p className="text-xs text-gray-500">{p.category || '—'} · {p.role || '—'} · Base: {p.base_price ? shortCurrency(p.base_price) : '—'}</p>
                </div>
                <Badge variant={p.status === 'sold' ? 'success' : p.status === 'available' ? 'info' : 'default'} size="sm">
                  {p.status}
                </Badge>
                {p.status === 'draft' && canEditAuction && (
                  <Button size="sm" variant="ghost" onClick={() => handleSchedulePlayer(p.id)}>Schedule</Button>
                )}
                {['draft', 'available', 'unsold'].includes(p.status) && (
                  <button
                    onClick={() => openEditPlayer(p)}
                    className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    title="Edit player"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {/* FIX: delete only when editable */}
                {canEditAuction && (p.status === 'draft' || p.status === 'available') && (
                  <button
                    onClick={() => handleDeletePlayer(p.id)}
                    className="p-1.5 rounded hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                    title="Delete player"
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
          {!canEditAuction && (
            <p className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-3 py-2">
              This auction is live or completed. Settings are read-only.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              ['Bid Increment', formatCurrency(auction.bid_increment, auction.currency)],
              ['Timer', `${auction.timer_duration}s`],
              ['Anti-sniping', auction.anti_sniping_enabled ? `${auction.anti_sniping_trigger_window}s window, +${auction.anti_sniping_extension}s` : 'Off'],
              ['Max Extensions', String(auction.anti_sniping_max_extensions || 'Unlimited')],
              ['Bid Cap', auction.bid_cap_enabled && auction.bid_cap_amount ? formatCurrency(auction.bid_cap_amount, auction.currency) : 'Off'],
              ['Round 2', auction.enable_round2 ? 'On' : 'Off'],
              ['Round 3', auction.enable_round3 ? 'On' : 'Off'],
              ['Tie-break', auction.tie_break_mode.replace(/_/g, ' ')],
              ['Order', auction.auction_order_mode],
              ['Allow Pause', auction.allow_pause ? 'Yes' : 'No'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400">{k}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Team Modal */}
      <Modal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        title={editingTeam ? 'Edit Team' : 'Add Team'}
      >
        <form onSubmit={handleSaveTeam} className="space-y-4">
          <Input
            label="Team Name"
            value={teamForm.name}
            onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
            required
          />

          {!editingTeam && (
            <Input
              label="Total Budget"
              type="number"
              value={teamForm.totalBudget}
              onChange={(e) => setTeamForm({ ...teamForm, totalBudget: e.target.value })}
              placeholder="e.g. 10000000"
              required
            />
          )}
          {editingTeam && (
            <p className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2">
              Budget cannot be changed after team creation (current: {shortCurrency(editingTeam.total_budget)}).
            </p>
          )}

          <Input
            label="Max Players"
            type="number"
            value={teamForm.maxPlayers}
            onChange={(e) => setTeamForm({ ...teamForm, maxPlayers: e.target.value })}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">
              Team Owner / Manager
              <span className="text-gray-500 font-normal ml-1">(optional)</span>
            </label>
            {id && (
              <UserSearchPicker
                auctionId={id}
                value={teamOwner}
                onChange={setTeamOwner}
              />
            )}
            <p className="text-xs text-gray-500">
              The assigned bidder can place bids for this team in the live auction.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setShowTeamModal(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={teamLoading}>
              {editingTeam ? 'Save Changes' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Player Modal */}
      <Modal
        isOpen={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        title={editingPlayer ? 'Edit Player' : 'Add Player'}
      >
        <form onSubmit={handleSavePlayer} className="space-y-3">
          <Input
            label="Player Name *"
            value={playerForm.name}
            onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Category"
              value={playerForm.category}
              onChange={(e) => setPlayerForm({ ...playerForm, category: e.target.value })}
              placeholder="Batsman, Bowler…"
            />
            <Input
              label="Role"
              value={playerForm.role}
              onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })}
              placeholder="Opening, Pace…"
            />
          </div>
          <Input
            label="Base Price *"
            type="number"
            value={playerForm.basePrice}
            onChange={(e) => setPlayerForm({ ...playerForm, basePrice: e.target.value })}
            placeholder="e.g. 500000"
            required
            min="0"
          />
          <Input
            label="Description"
            value={playerForm.description}
            onChange={(e) => setPlayerForm({ ...playerForm, description: e.target.value })}
          />
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1">
              Photo {editingPlayer?.photo_url ? '(leave blank to keep existing)' : ''}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            {editingPlayer?.photo_url && !photoFile && (
              <p className="text-xs text-gray-500 mt-1">Current photo will be kept.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={() => setShowPlayerModal(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={playerLoading}>
              {editingPlayer ? 'Save Changes' : 'Create Player'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AuctionManagePage;