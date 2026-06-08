import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import api from '../../services/api';

interface UserResult {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

interface UserSearchPickerProps {
  auctionId: string;
  value: { id: string; name: string; email: string } | null;
  onChange: (user: { id: string; name: string; email: string } | null) => void;
  placeholder?: string;
}

const UserSearchPicker: React.FC<UserSearchPickerProps> = ({
  auctionId,
  value,
  onChange,
  placeholder = 'Search by name or email…',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const res = await api.get(
          `/auctions/${auctionId}/eligible-users?search=${encodeURIComponent(term)}`
        );
        setResults(res.data.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [auctionId]
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    search('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (user: UserResult) => {
    onChange({ id: user.id, name: user.name, email: user.email });
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Selected state display
  if (value && !open) {
    return (
      <div
        onClick={handleOpen}
        className="flex items-center gap-3 w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-500 transition-colors group"
      >
        <div className="h-7 w-7 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {value.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{value.name}</p>
          <p className="text-xs text-gray-400 truncate">{value.email}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-gray-600 text-gray-500 hover:text-red-400 transition-colors"
            title="Remove owner"
          >
            <X size={14} />
          </button>
          <ChevronDown size={14} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / search input */}
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-2 w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-400 hover:border-blue-500 hover:text-gray-200 transition-colors text-left"
        >
          <Search size={14} />
          <span>{placeholder}</span>
          <ChevronDown size={14} className="ml-auto shrink-0" />
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-gray-800 border border-blue-500 rounded-lg px-3 py-2 ring-1 ring-blue-500/30">
          <Search size={14} className="text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {loading && (
            <svg className="animate-spin h-3.5 w-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {!loading && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded hover:bg-gray-600 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center py-6 text-gray-500">
              <User size={24} className="mb-2 opacity-40" />
              <p className="text-xs">
                {query ? `No bidders matching "${query}"` : 'No bidders found'}
              </p>
            </div>
          )}
          {results.length > 0 && (
            <ul className="max-h-52 overflow-y-auto py-1">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left'
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0 capitalize">{user.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length === 20 && (
            <p className="text-xs text-gray-600 text-center py-2 border-t border-gray-700">
              Showing first 20 — type to narrow results
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearchPicker;