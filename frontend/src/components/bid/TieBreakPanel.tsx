import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Lock, AlertTriangle } from 'lucide-react';
import Button from '../shared/Button';
import { formatCurrency } from '../../utils/format';
import api from '../../services/api';
import { Auction } from '../../types';
import useAuctionStore from '../../store/auctionStore';

interface TieBreakPanelProps {
  auction: Auction;
  myTeamId: string;
}

const TieBreakPanel: React.FC<TieBreakPanelProps> = ({ auction, myTeamId }) => {
  const { activeTieBreak } = useAuctionStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!activeTieBreak) return null;

  const isEligible = activeTieBreak.eligibleTeams.includes(myTeamId);
  const capAmount = activeTieBreak.capAmount || auction.bid_cap_amount || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bidAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!bidAmount || bidAmount < capAmount) {
      toast.error(`Bid must be at least ${formatCurrency(capAmount, auction.currency)}`);
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auctions/${auction.id}/bids/tiebreak`, {
        tieBreakRoundId: activeTieBreak.tieBreakRoundId,
        teamId: myTeamId,
        amount: bidAmount,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit tie-break bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-yellow-400">
        <Lock size={18} />
        <h3 className="font-bold text-base">Sealed Bid Tie-Break</h3>
        <span className="ml-auto text-xs bg-yellow-800/50 px-2 py-0.5 rounded-full">
          Round {activeTieBreak.roundNumber}
        </span>
      </div>

      {!isEligible ? (
        <p className="text-gray-400 text-sm">
          Your team is not eligible for this tie-break round. Waiting for result…
        </p>
      ) : activeTieBreak.submitted ? (
        <div className="text-center py-3">
          <p className="text-green-400 font-semibold">✓ Bid submitted</p>
          <p className="text-gray-400 text-xs mt-1">Waiting for other teams…</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900/50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-400">Your bid will be hidden from competitors.</p>
            <p className="text-gray-300">Minimum: <span className="text-yellow-400 font-semibold">{formatCurrency(capAmount, auction.currency)}</span></p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="number"
              placeholder={`Min ${(capAmount / 100000).toFixed(1)}L`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={capAmount}
              className="flex-1 bg-gray-800 border border-yellow-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <Button type="submit" loading={loading} variant="ghost" className="border-yellow-600 text-yellow-400 hover:bg-yellow-700 hover:text-white">
              Submit
            </Button>
          </form>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <AlertTriangle size={12} /> Once submitted, your bid cannot be changed.
          </p>
        </>
      )}
    </div>
  );
};

export default TieBreakPanel;
