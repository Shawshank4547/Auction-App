import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { formatTimer } from '../../utils/format';

interface AuctionTimerProps {
  timeRemaining: number | null;
  isPaused?: boolean;
  totalTime?: number;
}

const AuctionTimer: React.FC<AuctionTimerProps> = ({ timeRemaining, isPaused, totalTime = 60 }) => {
  const t = timeRemaining ?? 0;
  const progress = totalTime > 0 ? Math.min((t / totalTime) * 100, 100) : 0;

  const colorClass = t <= 10 ? 'text-red-400' : t <= 30 ? 'text-yellow-400' : 'text-green-400';
  const ringColor = t <= 10 ? '#f87171' : t <= 30 ? '#facc15' : '#4ade80';

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  if (timeRemaining === null) {
    return (
      <div className="flex flex-col items-center justify-center w-36 h-36">
        <div className="w-28 h-28 rounded-full border-4 border-gray-700 flex items-center justify-center">
          <span className="text-gray-500 text-xs">Waiting</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        {isPaused ? (
          <>
            <span className="text-2xl">⏸️</span>
            <span className="text-xs text-gray-400 mt-1">Paused</span>
          </>
        ) : (
          <>
            <span className={clsx('text-3xl font-bold font-mono tabular-nums', colorClass)}>
              {formatTimer(t)}
            </span>
            <span className="text-xs text-gray-400 mt-0.5">remaining</span>
          </>
        )}
      </div>
    </div>
  );
};

export default AuctionTimer;
