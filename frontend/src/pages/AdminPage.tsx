import React, { useEffect, useState } from 'react';
import { ShieldCheck, Users, Gavel, BarChart2, Ban, CheckCircle, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { User } from '../types';
import Badge from '../components/shared/Badge';
import Button from '../components/shared/Button';
import Spinner from '../components/shared/Spinner';

type Tab = 'stats' | 'users' | 'auctions' | 'logs';

const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [sRes, uRes, aRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/auctions'),
      ]);
      setStats(sRes.data.data);
      setUsers(uRes.data.data);
      setAuctions(aRes.data.data);
    } catch { toast.error('Failed to load admin data'); }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs?limit=50');
      setLogs(res.data.data.logs);
    } catch { toast.error('Failed to load logs'); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { if (tab === 'logs') fetchLogs(); }, [tab]);

  const handleSuspend = async (userId: string, active: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/${active ? 'suspend' : 'activate'}`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !active } : u));
      toast.success(active ? 'User suspended' : 'User activated');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePromote = async (userId: string) => {
    if (!window.confirm('Promote this user to Organizer?')) return;
    try {
      await api.patch(`/admin/users/${userId}/promote-organizer`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: 'organizer' } : u));
      toast.success('User promoted to organizer');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={24} className="text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800 w-fit">
        {(['stats', 'users', 'auctions', 'logs'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Stats */}
      {tab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Total Bids', value: stats.totalBids, icon: TrendingUp, color: 'text-green-400' },
              { label: 'Total Sales', value: stats.totalSales, icon: Gavel, color: 'text-purple-400' },
              { label: 'Revenue', value: `₹${(stats.totalRevenue / 100000).toFixed(1)}L`, icon: BarChart2, color: 'text-yellow-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm">{label}</p>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-bold text-white mt-2">{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3">Auctions by Status</h3>
            <div className="space-y-2">
              {stats.auctionsByStatus?.map((s: any) => (
                <div key={s.status} className="flex justify-between text-sm">
                  <span className="text-gray-400 capitalize">{s.status?.replace(/_/g, ' ')}</span>
                  <span className="text-white font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{u.name}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
              <Badge variant={u.role === 'super_admin' ? 'danger' : u.role === 'organizer' ? 'info' : 'default'} size="sm">
                {u.role}
              </Badge>
              <Badge variant={u.is_active ? 'success' : 'danger'} size="sm">
                {u.is_active ? 'Active' : 'Suspended'}
              </Badge>
              <div className="flex gap-2">
                {u.role === 'bidder' && (
                  <Button size="sm" variant="ghost" onClick={() => handlePromote(u.id)}>Promote</Button>
                )}
                <button
                  onClick={() => handleSuspend(u.id, u.is_active)}
                  className={`p-1.5 rounded transition-colors ${u.is_active ? 'hover:bg-red-900/40 text-gray-400 hover:text-red-400' : 'hover:bg-green-900/40 text-gray-400 hover:text-green-400'}`}
                >
                  {u.is_active ? <Ban size={16} /> : <CheckCircle size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auctions */}
      {tab === 'auctions' && (
        <div className="space-y-2">
          {auctions.map((a) => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{a.name}</p>
                <p className="text-xs text-gray-500">{a.organizer_name} · {a.team_count} teams · {a.player_count} players</p>
              </div>
              <Badge variant={a.status.includes('live') ? 'success' : a.status === 'draft' ? 'default' : 'warning'} size="sm">
                {a.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Audit Logs */}
      {tab === 'logs' && (
        <div className="space-y-1">
          {logs.map((l) => (
            <div key={l.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-3 text-sm">
              <span className="text-gray-500 text-xs w-36 shrink-0">{new Date(l.created_at).toLocaleString()}</span>
              <span className="text-blue-400 font-medium w-32 shrink-0">{l.action}</span>
              <span className="text-gray-300">{l.user_name || 'system'}</span>
              {l.details && Object.keys(l.details).length > 0 && (
                <span className="text-gray-600 text-xs truncate">{JSON.stringify(l.details)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
