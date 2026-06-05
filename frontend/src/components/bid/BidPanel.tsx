import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { TrendingUp, Zap } from 'lucide-react';
import clsx from 'clsx';
import Button from '../shared/Button';
import { formatCurrency, shortCurrency } from '../../utils/format';
import api from '../../services/api';
import { Auction, AuctionItem, Team } from '../../types';

interface BidPanelProps {
  auction: Auction;
  liveItem: AuctionItem;
  myTeam: Team | null;
  disabled?: boolean;
}

const BidPanel: React.FC<BidPanelProps> = ({ auction, liveItem, myTeam, disabled }) => {
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const currentPrice = liveItem.current_price || 0;
  const minBid = currentPrice + auction.bid_increment;
  const isLeader = myTeam?.id === liveItem.current_leader_team_id;
  const canBid = !disabled && myTeam && !isLeader && (myTeam.remaining_budget >= minBid);

  const quickAmounts = [
    minBid,
    minBid + auction.bid_increment,
    minBid + auction.bid_increment * 2,
    minBid + auction.bid_increment * 4,
  ].filter((a) => !auction.bid_cap_enabled || a <= (auction.bid_cap_amount || Infinity))
   .filter((a) => a <= (myTeam?.remaining_budget || 0));

  const handleBid = async (amount: number) => {
    if (!myTeam || !canBid) return;
    setLoading(true);
    try {
      await api.post(`/auctions/${auction.id}/bids`, {
        auctionItemId: liveItem.id,
        teamId: myTeam.id,
        amount,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bid failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomBid = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(customAmount.replace(/[^0-9]/g, ''), 10);
    if (!amount || amount < minBid) {
      toast.error(`Minimum bid is ${formatCurrency(minBid, auction.currency)}`);
      return;
    }
    await handleBid(amount);
    setCustomAmount('');
  };

  if (!myTeam) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-center text-gray-400 text-sm">
        You are watching as a viewer.
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" /> Place Bid
        </h3>
        <div className="text-right">
          <p className="text-xs text-gray-400">Budget left</p>
          <p className="text-sm font-bold text-green-400">
            {formatCurrency(myTeam.remaining_budget, auction.currency)}
          </p>
        </div>
      </div>

      {isLeader && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-2 text-center">
          <p className="text-green-400 text-sm font-medium">🏆 Your team leads!</p>
        </div>
      )}

      {!isLeader && !canBid && myTeam.remaining_budget < minBid && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-2 text-center">
          <p className="text-red-400 text-sm">Insufficient budget</p>
        </div>
      )}

      {/* Quick bid buttons */}
      {canBid && quickAmounts.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => handleBid(amount)}
              disabled={loading || disabled}
              className={clsx(
                'py-2.5 px-3 rounded-lg text-sm font-semibold border transition-all',
                'bg-blue-600/20 border-blue-600/40 text-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {shortCurrency(amount)}
            </button>
          ))}
        </div>
      )}

      {/* Custom amount */}
      {canBid && (
        <form onSubmit={handleCustomBid} className="flex gap-2">
          <input
            type="number"
            placeholder={`Min: ${shortCurrency(minBid)}`}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            min={minBid}
            step={auction.bid_increment}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="submit" loading={loading} size="md">
            <TrendingUp size={16} className="mr-1" /> Bid
          </Button>
        </form>
      )}

      {auction.bid_cap_enabled && auction.bid_cap_amount && (
        <p className="text-xs text-gray-500 text-center">
          Cap: {formatCurrency(auction.bid_cap_amount, auction.currency)} — tie-break on cap
        </p>
      )}
    </div>
  );
};

export default BidPanel;
