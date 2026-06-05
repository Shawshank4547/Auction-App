import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, timeAgo } from '../../utils/format';
import useAuctionStore from '../../store/auctionStore';

interface BidFeedProps {
  currency?: string;
}

const BidFeed: React.FC<BidFeedProps> = ({ currency = 'INR' }) => {
  const { recentBids } = useAuctionStore();

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <TrendingUp size={16} className="text-blue-400" /> Bid Feed
      </h3>
      {recentBids.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No bids yet</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentBids.map((bid, i) => (
            <div
              key={`${bid.teamId}-${bid.timestamp}`}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm
                ${i === 0 ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-gray-700/30'}`}
            >
              <div className="flex items-center gap-2">
                {i === 0 && <span className="text-xs text-blue-400 font-bold">NEW</span>}
                <span className="text-gray-300 font-medium">{bid.teamName}</span>
              </div>
              <div className="text-right">
                <span className="text-green-400 font-semibold">{formatCurrency(bid.amount, currency)}</span>
                <span className="text-gray-500 text-xs ml-2">{timeAgo(bid.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BidFeed;
