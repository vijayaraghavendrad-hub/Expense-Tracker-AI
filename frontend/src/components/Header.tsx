import React from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import type { NavTab } from './Sidebar';
import { CURRENCIES } from '../utils/currency';

interface HeaderProps {
  activeTab: NavTab;
  period: string;
  setPeriod: (period: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  onOpenAddModal: () => void;
  anomalyCount: number;
  onViewAnomalies: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  period,
  setPeriod,
  currency,
  onCurrencyChange,
  onOpenAddModal,
  anomalyCount,
  onViewAnomalies,
}) => {
  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Financial Overview',
      subtitle: 'Real-time cash flow, category distributions, and proactive AI spend insights.',
    },
    transactions: {
      title: 'Transactions',
      subtitle: 'Complete searchable ledger with automatic ML categorization and anomaly flags.',
    },
    budgets: {
      title: 'Category Budgets',
      subtitle: 'Track spending limits, burn rates, and pacing alerts in real time.',
    },
    analytics: {
      title: 'Analytics & Intelligence',
      subtitle: 'Multi-month trends, MoM variance analysis, and statistical spend forecasting.',
    },
    recurring: {
      title: 'Recurring Commitments',
      subtitle: 'Automated repeat transactions for rent, utilities, and digital subscriptions.',
    },
    export: {
      title: 'Reports & Export',
      subtitle: 'Export clean CSV datasets or generate print-ready executive summaries.',
    },
  };

  const currentMeta = titles[activeTab] || { title: 'Dashboard', subtitle: '' };

  return (
    <header className="bg-white border-b border-zinc-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{currentMeta.title}</h1>
        <p className="text-xs text-zinc-500 mt-0.5">{currentMeta.subtitle}</p>
      </div>

      <div className="flex items-center space-x-3">
        {/* Time Period Filter (Visible on Dashboard and Analytics) */}
        {(activeTab === 'dashboard' || activeTab === 'analytics') && (
          <div className="flex items-center bg-zinc-100 rounded-lg p-1 border border-zinc-200/80">
            <button
              onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'month'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'week'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'year'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              This Year
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                period === 'all'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Time
            </button>
          </div>
        )}

        {/* Global Currency Selector */}
        <div className="flex items-center space-x-1 bg-zinc-100 rounded-lg p-1 border border-zinc-200/80">
          <span className="text-[11px] font-semibold text-zinc-500 pl-2 pr-1">Currency:</span>
          <select
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="bg-white text-zinc-900 font-semibold text-xs rounded-md px-2 py-1 border border-zinc-200 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* Anomaly quick flag button */}
        {anomalyCount > 0 && (
          <button
            onClick={onViewAnomalies}
            title={`${anomalyCount} unusual transactions flagged by AI`}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{anomalyCount} {anomalyCount === 1 ? 'Anomaly' : 'Anomalies'}</span>
          </button>
        )}

        {/* Primary CTA: Add Transaction */}
        <button
          onClick={onOpenAddModal}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </button>
      </div>
    </header>
  );
};
