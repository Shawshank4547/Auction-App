import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Gavel, Users, LogOut, Bell, Menu, X,
  ShieldCheck, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import useAuthStore from '../../store/authStore';
import Avatar from './Avatar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/auctions', label: 'Auctions', icon: Gavel },
    ...(user?.role === 'super_admin'
      ? [{ path: '/admin', label: 'Admin', icon: ShieldCheck }]
      : []),
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <div className="bg-blue-600 rounded-lg p-2">
            <Gavel size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg">AuctionPro</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive(path)
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar src={user?.avatar_url} name={user?.name || ''} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 shrink-0">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} className="text-gray-400" />
          </button>
          <div className="flex-1" />
          <button className="relative p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <Bell size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Avatar src={user?.avatar_url} name={user?.name || ''} size="sm" />
            <span className="hidden sm:block text-sm text-gray-300">{user?.name}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
