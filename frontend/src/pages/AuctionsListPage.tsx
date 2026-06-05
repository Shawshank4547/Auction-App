import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Gavel, Search } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Auction } from '../types';
import Badge from '../components/shared/Badge';
import Spinner from '../components/shared/Spinner';
import Button from '../components/shared/Button';
import { timeAgo } from '../utils/format';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  live: 'success', round2_live: 'success', round3_live: 'success',
  scheduled: 'info', draft: 'default', completed: 'warning', archived: 'default',
};

const AuctionsListPage: React.FC = () => {
  const { user } = useAuthStore();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/auctions?limit=100').then((res) => {
      setAuctions(res.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = auctions.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate = user?.role === 'organizer' || user?.role === 'super_admin';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Auctions</h1>
        {canCreate && (
          <Link to="/auctions/new">
            <Button variant="primary"><PlusCircle size={16} className="mr-1.5" /> New Auction</Button>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search auctions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <Spinner className="py-20" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
          <Gavel size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">{search ? 'No auctions match your search' : 'No auctions yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to={a.status.includes('live') ? `/auctions/${a.id}/live` : `/auctions/${a.id}`}
            >
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors flex items-center gap-4">
                <div className="hidden sm:flex bg-blue-900/30 rounded-lg p-3">
                  <Gavel size={22} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{a.name}</p>
                    <Badge variant={statusVariant[a.status] || 'default'} size="sm">
                      {a.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    by {a.organizer_name} · {a.team_count} teams · {a.player_count} players · {timeAgo(a.created_at)}
                  </p>
                </div>
                <span className="text-gray-500 text-sm hidden md:block">Round {a.current_round}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionsListPage;
