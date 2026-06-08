import React from 'react';
import clsx from 'clsx';
import { formatCurrency, shortCurrency } from '../../utils/format';
import { Team } from '../../types';

interface TeamBudgetBarProps {
  team: Team;
  currency?: string;
  compact?: boolean;
}

const TeamBudgetBar: React.FC<TeamBudgetBarProps> = ({ team, currency = 'INR', compact = false }) => {
  const pctUsed = team.total_budget > 0
    ? ((team.total_budget - team.remaining_budget) / team.total_budget) * 100
    : 0;

  const barColor = pctUsed >= 90 ? 'bg-red-500' : pctUsed >= 70 ? 'bg-yellow-500' : 'bg-green-500';

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{team.name}</span>
          <span className="text-green-400 font-medium">{shortCurrency(team.remaining_budget, currency)}</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${100 - pctUsed}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {team.logo_url ? (
            <img src={team.logo_url} alt={team.name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white">
              {team.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-white">{team.name}</span>
        </div>
        <span className="text-xs text-gray-500">{team.squad_size} players</span>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Remaining</span>
          <span className="text-green-400 font-semibold">{formatCurrency(team.remaining_budget, currency)}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${100 - pctUsed}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>Spent: {formatCurrency(team.total_budget - team.remaining_budget, currency)}</span>
          <span>Total: {shortCurrency(team.total_budget, currency)}</span>
        </div>
      </div>
    </div>
  );
};

export default TeamBudgetBar;