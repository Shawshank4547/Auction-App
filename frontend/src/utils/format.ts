/**
 * Format a number as currency (e.g., ₹10,00,000)
 */
export const formatCurrency = (amount: number, currency = 'INR'): string => {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format number with Indian comma style (e.g., 10,00,000)
 */
export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('en-IN').format(n);

/**
 * Format seconds as MM:SS
 */
export const formatTimer = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
};

/**
 * Get timer colour class based on remaining time
 */
export const getTimerClass = (seconds: number): string => {
  if (seconds <= 10) return 'text-red-500';
  if (seconds <= 30) return 'text-yellow-500';
  return 'text-green-500';
};

/**
 * Relative time (e.g., "2 minutes ago")
 */
export const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
};

/**
 * Short currency format with symbol — always shows the currency sign.
 * e.g. ₹10L, ₹1Cr, ₹500, $1.5M
 */
export const shortCurrency = (amount: number, currency = 'INR'): string => {
  const symbol = currency === 'INR' ? '₹'
    : currency === 'USD' ? '$'
    : currency === 'GBP' ? '£'
    : currency === 'EUR' ? '€'
    : currency;

  if (currency === 'INR') {
    if (amount >= 10_000_000) return `${symbol}${(amount / 10_000_000).toFixed(1)}Cr`;
    if (amount >= 100_000) return `${symbol}${(amount / 100_000).toFixed(1)}L`;
    if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(0)}K`;
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }

  // Non-INR
  if (amount >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(0)}K`;
  return `${symbol}${amount.toLocaleString()}`;
};

/**
 * Resolve an image URL — handles both absolute (http/https) and relative (/uploads/...) paths.
 * For relative paths, prepends the backend base URL so images work cross-origin.
 */
const BACKEND_BASE = (process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001').replace(/\/$/, '');

export const resolveImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE}${url}`;
};