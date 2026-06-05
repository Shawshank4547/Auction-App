import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Users, TrendingUp, Clock, PlusCircle } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Auction } from '../types';
import Badge from '../components/shared/Badge';
import Spinner from '../components/shared/Spinner';
import Button from '../components/shared/Button';
import { formatCurrency, timeAgo } from '../utils/format';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  live: 'success',
  round2_live: 'success',
  round3_live: 'success',
  scheduled: 'info',
  draft: 'default',
  completed: 'warning',
  archived: 'default',
};

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/auctions?limit=10');
        setAuctions(res.data.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const liveAuctions = auctions.filter((a) => a.status.includes('live'));
  const draftAuctions = auctions.filter((a) => a.status === 'draft' || a.status === 'scheduled');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-gray-400 text-sm mt-1">Here's your auction overview</p>
        </div>
        {(user?.role === 'organizer' || user?.role === 'super_admin') && (
          <Link to="/auctions/new">
            <Button variant="primary" size="md">
              <PlusCircle size={16} className="mr-1.5" /> New Auction
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Auctions', value: auctions.length, icon: Gavel, color: 'text-blue-400' },
          { label: 'Live Now', value: liveAuctions.length, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Drafts', value: draftAuctions.length, icon: Clock, color: 'text-yellow-400' },
          { label: 'Completed', value: auctions.filter((a) => a.status === 'completed').length, icon: Users, color: 'text-purple-400' },
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

      {/* Live auctions highlight */}
      {liveAuctions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Auctions
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {liveAuctions.map((a) => (
              <Link key={a.id} to={`/auctions/${a.id}/live`}>
                <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4 hover:border-green-600 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{a.name}</h3>
                      <p className="text-sm text-gray-400 mt-0.5">by {a.organizer_name}</p>
                    </div>
                    <Badge variant="success">LIVE</Badge>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>{a.team_count} teams</span>
                    <span>{a.player_count} players</span>
                    <span>Round {a.current_round}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All auctions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">All Auctions</h2>
          <Link to="/auctions" className="text-blue-400 text-sm hover:text-blue-300">View all →</Link>
        </div>
        {loading ? (
          <Spinner className="py-12" />
        ) : auctions.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-xl border border-gray-800">
            <Gavel size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No auctions yet</p>
            {(user?.role === 'organizer' || user?.role === 'super_admin') && (
              <Link to="/auctions/new">
                <Button variant="primary" size="sm" className="mt-4">Create your first auction</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {auctions.map((a) => (
              <Link key={a.id} to={a.status.includes('live') ? `/auctions/${a.id}/live` : `/auctions/${a.id}`}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors flex items-center gap-4">
                  <div className="bg-blue-900/30 rounded-lg p-2.5">
                    <Gavel size={20} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">{timeAgo(a.created_at)} · {a.team_count} teams · {a.player_count} players</p>
                  </div>
                  <Badge variant={statusVariant[a.status] || 'default'}>
                    {a.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
