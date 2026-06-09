import React from 'react';
import { User, Trophy } from 'lucide-react';
import Badge from '../shared/Badge';
import { formatCurrency } from '../../utils/format';
import { AuctionItem } from '../../types';
import clsx from 'clsx';

interface LivePlayerCardProps {
  item: AuctionItem;
  currency?: string;
  // FIX: accept a sold summary so we can display it after the timer ends
  soldSummary?: {
    playerName: string;
    teamName: string;
    finalPrice: number;
  } | null;
}

const BACKEND_URL = (process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '');

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_URL}${url}`;
}

const LivePlayerCard: React.FC<LivePlayerCardProps> = ({ item, currency = 'INR', soldSummary }) => {
  const hasLeader = item.current_leader_team_id && item.current_price;
  const photoUrl = resolveImageUrl(item.photo_url);

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 flex flex-col">
      {/* Photo — fixed height, fully clipped */}
      <div className="relative h-52 bg-gradient-to-br from-blue-900/40 to-purple-900/40 overflow-hidden flex-shrink-0">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={item.player_name}
            className="absolute inset-0 w-full h-full object-cover object-center"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {!photoUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <User size={64} className="text-gray-600" />
          </div>
        )}

        {/* LIVE badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse shadow">
            LIVE
          </span>
        </div>

        {item.category && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="info">{item.category}</Badge>
          </div>
        )}

        {/* Dark gradient at bottom so text overlaid is readable */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-800/80 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-4 space-y-3 flex-1">
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">{item.player_name}</h2>
          {item.role && <p className="text-sm text-gray-400 mt-0.5">{item.role}</p>}
        </div>

        {/* Current bid / base price */}
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