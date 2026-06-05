import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm' }) => {
  const variants = {
    default: 'bg-gray-700 text-gray-300',
    success: 'bg-green-900/50 text-green-400 border border-green-800',
    warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    danger: 'bg-red-900/50 text-red-400 border border-red-800',
    info: 'bg-blue-900/50 text-blue-400 border border-blue-800',
    purple: 'bg-purple-900/50 text-purple-400 border border-purple-800',
  };
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };

  return (
    <span className={clsx('inline-flex items-center font-medium rounded-full', variants[variant], sizes[size])}>
      {children}
    </span>
  );
};

export default Badge;
