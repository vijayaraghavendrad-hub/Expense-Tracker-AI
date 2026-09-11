import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  PieChart,
  Target,
  Repeat,
  Download,
  Sparkles,
  LogOut,
  Power,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import type { User } from '../types';
import { api } from '../api/client';

export type NavTab = 'dashboard' | 'transactions' | 'budgets' | 'analytics' | 'recurring' | 'export';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: User | null;
  onLogout: () => void;
  onResetData: () => void;
  isResetting: boolean;
  anomalyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onResetData,
  isResetting,
  anomalyCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: <ReceiptText className="w-4 h-4" />,
      badge: anomalyCount > 0 ? anomalyCount : undefined,
    },
    { id: 'budgets', label: 'Budgets', icon: <Target className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics & AI', icon: <PieChart className="w-4 h-4" /> },
    { id: 'recurring', label: 'Recurring', icon: <Repeat className="w-4 h-4" /> },
    { id: 'export', label: 'Report & Export', icon: <Download className="w-4 h-4" /> },
  ];

  const handleShutdownApp = async () => {
    if (confirm('Stop all servers and shut down Smart Expense Tracker?')) {
      try {
        await api.shutdownSystem();
      } catch (err) {
        console.warn('Shutdown request failed (server may already be stopping):', err);
      }
      window.location.href = 'about:blank';
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 h-screen fixed left-0 top-0 flex flex-col justify-between select-none z-10">
      {/* Brand Header */}
      <div>
        <div className="p-6 border-b border-zinc-100 flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 block leading-tight">
              Smart Expense
            </span>
            <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase block">
              OS v1.0
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 py-1 mb-1">
            Workspace
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white font-medium'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={isActive ? 'text-white' : 'text-zinc-500'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    title={`${item.badge} Anomalies Flagged`}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div>
        {/* Demo Seed Controls */}
        <div className="p-3 mx-3 mb-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-zinc-700 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Live Portfolio Demo</span>
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
            Pre-seeded with 6 months of transactions, ML anomalies, and forecasts.
          </p>
          <button
            onClick={onResetData}
            disabled={isResetting}
            className="w-full flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 text-[11px] font-medium transition-all shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin text-emerald-600' : 'text-zinc-500'}`} />
            <span>{isResetting ? 'Reloading...' : 'Reload Sample Data'}</span>
          </button>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-700 text-xs font-semibold shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-zinc-800 truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleShutdownApp}
              title="Stop server & exit app"
              aria-label="Stop server and exit application"
              className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
