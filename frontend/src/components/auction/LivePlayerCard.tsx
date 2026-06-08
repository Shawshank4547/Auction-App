import React from 'react';
import { User } from 'lucide-react';
import Badge from '../shared/Badge';
import { formatCurrency } from '../../utils/format';
import { AuctionItem } from '../../types';
import clsx from 'clsx';

interface LivePlayerCardProps {
  item: AuctionItem;
  currency?: string;
}

// Resolve image URL — handles both absolute (http/https) and relative (/uploads/...) paths.
// For relative paths, prepend the backend origin so images work cross-origin.
const BACKEND_URL = (process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '');

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — prepend backend base
  return `${BACKEND_URL}${url}`;
}

const LivePlayerCard: React.FC<LivePlayerCardProps> = ({ item, currency = 'INR' }) => {
  const hasLeader = item.current_leader_team_id && item.current_price;
  const photoUrl = resolveImageUrl(item.photo_url);

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      {/* Player photo */}
      <div className="relative h-48 bg-gradient-to-br from-blue-900/40 to-purple-900/40 flex items-center justify-center">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={item.player_name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // If image fails to load, hide it and show the fallback icon
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) {
                const fallback = parent.querySelector('[data-fallback]') as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}
        {/* Fallback icon — shown when no photo or photo fails */}
        <div
          data-fallback
          className="absolute inset-0 flex items-center justify-center"
          style={{ display: photoUrl ? 'none' : 'flex' }}
        >
          <User size={64} className="text-gray-600" />
        </div>

        <div className="absolute top-3 left-3">
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
            LIVE
          </span>
        </div>
        {item.category && (
          <div className="absolute top-3 right-3">
            <Badge variant="info">{item.category}</Badge>
          </div>
        )}
      </div>

      {/* Player info */}
      <div className="p-4 space-y-3">
        <div>
          <h2 className="text-xl font-bold text-white">{item.player_name}</h2>
          {item.role && <p className="text-sm text-gray-400">{item.role}</p>}
        </div>

        {/* Current bid */}
        <div className={clsx(
          'rounded-lg p-3 border',
          hasLeader ? 'bg-green-900/20 border-green-800' : 'bg-gray-700/50 border-gray-600'
        )}>
          {hasLeader ? (
            <>
              <p className="text-xs text-gray-400 mb-1">Current bid</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(item.current_price!, currency)}
              </p>
              {item.leader_team_name && (
                <p className="text-xs text-gray-300 mt-1">
                  by <span className="font-semibold text-white">{item.leader_team_name}</span>
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-1">Base price</p>
              <p className="text-xl font-bold text-gray-300">
                {item.base_price ? formatCurrency(item.base_price, currency) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">No bids yet</p>
            </>
          )}
        </div>

        {/* Stats preview */}
        {item.statistics && Object.keys(item.statistics).length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(item.statistics).slice(0, 3).map(([key, val]) => (
              <div key={key} className="bg-gray-700/50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500 truncate">{key}</p>
                <p className="text-sm font-semibold text-white">{String(val)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePlayerCard;