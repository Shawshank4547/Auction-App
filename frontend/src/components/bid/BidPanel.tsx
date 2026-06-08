import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { TrendingUp, Zap, Wallet, AlertCircle } from 'lucide-react';
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

function getQuickAmounts(
  minBid: number,
  bidIncrement: number,
  remainingBudget: number,
  bidCapAmount: number | null
): number[] {
  const cap = bidCapAmount ?? Infinity;
  const budget = remainingBudget;

  let step = bidIncrement;
  if (step > budget * 0.5) {
    step = Math.max(1, Math.floor(budget / 5));
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    step = Math.round(step / magnitude) * magnitude || 1;
  }

  const amounts: number[] = [];
  const candidates = [
    minBid,
    minBid + step,
    minBid + step * 2,
    minBid + step * 4,
    minBid + step * 9,
  ];

  for (const a of candidates) {
    if (a <= budget && a <= cap && !amounts.includes(a)) {
      amounts.push(a);
    }
    if (amounts.length >= 4) break;
  }

  return amounts;
}

const BidPanel: React.FC<BidPanelProps> = ({ auction, liveItem, myTeam, disabled }) => {
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const currentPrice = liveItem.current_price || 0;
  const basePrice = liveItem.base_price || auction.starting_bid || auction.bid_increment;

  // First bid must meet base price; subsequent bids must beat current by increment
  const minBid = currentPrice > 0
    ? currentPrice + auction.bid_increment
    : Math.max(basePrice, auction.starting_bid || 0);

  const isLeader = myTeam?.id === liveItem.current_leader_team_id;
  const hasEnoughBudget = myTeam ? myTeam.remaining_budget >= minBid : false;
  const canBid = !disabled && myTeam && !isLeader && hasEnoughBudget;

  // FIX: surface a clear reason why bidding is blocked
  const blockReason: string | null = (() => {
    if (!myTeam) return null;
    if (isLeader) return null; // shown separately
    if (disabled) return 'paused';
    if (!hasEnoughBudget) {
      // Distinguish: budget is simply less than minBid vs less than base price
      if (myTeam.remaining_budget < basePrice) {
        return `Your budget (${formatCurrency(myTeam.remaining_budget, auction.currency)}) is below the base price of ${formatCurrency(basePrice, auction.currency)}`;
      }
      return `You need ${formatCurrency(minBid, auction.currency)} to bid but only have ${formatCurrency(myTeam.remaining_budget, auction.currency)}`;
    }
    return null;
  })();

  const quickAmounts = myTeam
    ? getQuickAmounts(
        minBid,
        auction.bid_increment,
        myTeam.remaining_budget,
        auction.bid_cap_enabled ? auction.bid_cap_amount : null
      )
    : [];

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
    <div className="bg-gray-800 rounded-xl p-4 space-y-4 w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white flex items-center gap-2 shrink-0">
          <Zap size={16} className="text-yellow-400" />
          Place Bid
        </h3>
        <div className="flex items-center gap-1.5 bg-gray-700/60 rounded-lg px-3 py-1.5 min-w-0">
          <Wallet size={13} className="text-green-400 shrink-0" />
          <span className="text-xs text-gray-400 shrink-0">Budget</span>
          <span className="text-sm font-bold text-green-400 truncate">
            {formatCurrency(myTeam.remaining_budget, auction.currency)}
          </span>
        </div>
      </div>

      {isLeader && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-2 text-center">
          <p className="text-green-400 text-sm font-medium">🏆 Your team leads!</p>
        </div>
      )}

      {/* FIX: show specific reason instead of generic "Insufficient budget" */}
      {!isLeader && blockReason && blockReason !== 'paused' && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-400 text-xs leading-relaxed">{blockReason}</p>
          </div>
          <p className="text-gray-500 text-xs mt-1.5 ml-5">
            Minimum required: <span className="text-gray-300 font-medium">{formatCurrency(minBid, auction.currency)}</span>
          </p>
        </div>
      )}

      {disabled && !isLeader && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-2 text-center">
          <p className="text-yellow-400 text-sm">Auction is paused</p>
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
              {formatCurrency(amount, auction.currency)}
            </button>
          ))}
        </div>
      )}

      {/* Custom amount */}
      {canBid && (
        <form onSubmit={handleCustomBid} className="flex gap-2">
          <input
            type="number"
            placeholder={`Min: ${formatCurrency(minBid, auction.currency)}`}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            min={minBid}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
          />
          <Button type="submit" loading={loading} size="md" className="shrink-0">
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