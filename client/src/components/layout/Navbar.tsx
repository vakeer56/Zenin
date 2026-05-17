import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Timer, BarChart2, CheckSquare, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/timer', icon: Timer, label: 'Timer' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const Navbar: React.FC = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 glass border-r border-white/8 z-40 p-6 gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gradient">Zenin</span>
        </div>

        {/* Nav Links */}
        <ul className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  pathname.startsWith(to)
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={24} />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* User & Logout */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/8">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-primary-500/30"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary-500/30 flex items-center justify-center text-primary-300 font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/8 z-40 px-2 py-2">
        <ul className="flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium transition-all',
                  pathname.startsWith(to)
                    ? 'text-primary-400'
                    : 'text-white/40 hover:text-white'
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};
