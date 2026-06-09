import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import clsx from 'clsx';

interface SoldSummaryProps {
  playerName: string;
  teamName: string;
  finalPrice: number;
  currency?: string;
  photoUrl?: string | null;
  isMyTeam?: boolean;
  onDismiss: () => void;
}

/**
 * Full-width banner shown briefly after a player is sold.
 * Auto-dismisses after 6 seconds, or user can close it manually.
 */
const SoldSummary: React.FC<SoldSummaryProps> = ({
  playerName,
  teamName,
  finalPrice,
  currency = 'INR',
  photoUrl,
  isMyTeam = false,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Auto-dismiss after 7s
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={clsx(
        'relative rounded-xl overflow-hidden border transition-all duration-500',
        isMyTeam
          ? 'bg-gradient-to-br from-yellow-900/40 to-green-900/40 border-yellow-600'
          : 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors z-10"
      >
        <X size={16} />
      </button>

      <div className="p-5 flex items-center gap-5">
        {/* Photo or trophy icon */}
        <div className="relative shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={playerName}
              className="h-20 w-20 rounded-xl object-cover object-center border-2 border-gray-600"
            />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-gray-700 flex items-center justify-center">
              <Trophy size={32} className={isMyTeam ? 'text-yellow-400' : 'text-gray-400'} />
            </div>
          )}
          {/* Sold stamp */}
          <div className="absolute -top-2 -right-2 bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow">
            SOLD
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          {isMyTeam && (
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide mb-1">
              🎉 Your team won!
            </p>
          )}
          <h3 className="text-xl font-bold text-white truncate">{playerName}</h3>
          <p className="text-gray-400 text-sm mt-0.5">
            Sold to <span className={clsx('font-semibold', isMyTeam ? 'text-yellow-300' : 'text-white')}>{teamName}</span>
          </p>
          <p className={clsx(
            'text-2xl font-bold mt-2',
            isMyTeam ? 'text-yellow-400' : 'text-green-400'
          )}>
            {formatCurrency(finalPrice, currency)}
          </p>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 bg-gray-700">
        <div
          className={clsx(
            'h-full transition-all ease-linear',
            isMyTeam ? 'bg-yellow-500' : 'bg-green-500'
          )}
          style={{
            width: visible ? '0%' : '100%',
            transitionDuration: '7000ms',
          }}
        />
      </div>
    </div>
  );
};

export default SoldSummary;