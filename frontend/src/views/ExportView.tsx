import type React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Printer, FileSpreadsheet, FileText, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import type { AnalyticsSummary, CategorySpendItem, MonthlyTrendItem, User } from '../types';
import { getCurrencySymbol } from '../utils/currency';

interface ExportViewProps {
  user: User | null;
  summary: AnalyticsSummary | null;
  categorySpends: CategorySpendItem[];
  trends: MonthlyTrendItem[];
  currency: string;
  period?: string;
}

export const ExportView: React.FC<ExportViewProps> = ({
  user,
  summary,
  categorySpends,
  trends,
  currency,
  period = 'month',
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleDownloadCsv = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const today = new Date();
      let start_date: string | undefined;
      const end_date = today.toISOString().split('T')[0];
      if (period === 'week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        start_date = weekStart.toISOString().split('T')[0];
      } else if (period === 'month') {
        start_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      } else if (period === 'year') {
        start_date = `${today.getFullYear()}-01-01`;
      }
      await api.downloadTransactionsCsv({ currency, start_date, end_date });
      setDownloadSuccess(true);
      successTimerRef.current = setTimeout(() => setDownloadSuccess(false), 4000);
    } catch {
      setError('Failed to download CSV. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }), []);

  return (
    <div className="space-y-6 pb-12">
      {/* Action Cards (Hidden in print) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        {/* CSV Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Export Ledger as CSV</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Download your complete transaction ledger formatted with IDs, dates, categories, payment methods,
              and amounts in your chosen currency ({currency}).
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-mono">Currency: {currency} ({currencySymbol})</span>
              <button
                onClick={handleDownloadCsv}
                disabled={isDownloading}
                aria-label="Download transactions as CSV file"
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
              >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Preparing CSV...' : 'Download CSV'}</span>
            </button>
          </div>
        </div>

        {/* PDF / Print Report Card */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Print / PDF Executive Statement</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Generate a print-ready monthly summary document with cash flows, category allocations,
              and metrics.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-mono">Print to PDF / Paper</span>
              <button
                onClick={handlePrintPdf}
                aria-label="Print or save as PDF"
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-white border border-zinc-300 text-zinc-800 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
              >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 no-print">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>CSV download started successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl no-print">
          {error}
        </div>
      )}

      {/* Printable Report Document (Rendered for on-screen preview and clean @media print) */}
      <div className="bg-white p-8 rounded-2xl border border-zinc-200/90 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="border-b border-zinc-200 pb-6 mb-6 flex items-start justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold">
              Monthly Statement
            </span>
            <h2 className="text-2xl font-bold text-zinc-900 mt-1">Smart Expense Tracker</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Account Holder: <span className="font-semibold text-zinc-800">{user?.name}</span> ({user?.email})
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 font-mono">Date Generated:</span>
            <p className="text-xs font-semibold text-zinc-800 font-mono">{todayStr}</p>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block">
              Total Recorded Inflow
            </span>
            <div className="text-xl font-bold text-zinc-900 mt-1 font-mono">
              {currencySymbol}{summary?.total_income.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block">
              Total Recorded Outflow
            </span>
            <div className="text-xl font-bold text-zinc-900 mt-1 font-mono">
              {currencySymbol}{summary?.total_expenses.toFixed(2) || '0.00'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block">
              Net Savings Retained
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
              {currencySymbol}{summary?.total_balance.toFixed(2) || '0.00'}
              <span className="text-xs text-zinc-500 font-normal ml-1">({summary?.savings_rate}%)</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown Table */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            Category Spending Distribution
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-[11px] uppercase">
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Count</th>
                <th className="py-2 text-right">Total Amount</th>
                <th className="py-2 text-right">% of Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {categorySpends.map((cat) => (
                <tr key={cat.category_name} className="py-2">
                  <td className="py-2 font-sans font-medium text-zinc-800">{cat.category_name}</td>
                  <td className="py-2 text-right text-zinc-600">{cat.transaction_count}</td>
                  <td className="py-2 text-right text-zinc-900 font-semibold">
                    {currencySymbol}{cat.total_amount.toFixed(2)}
                  </td>
                  <td className="py-2 text-right text-zinc-600">{cat.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="border-t border-zinc-200 pt-4 text-[11px] text-zinc-400 flex items-center justify-between font-mono">
          <span>Smart Expense Tracker • AI-Powered Personal Finance System</span>
          <span>Confidential & Proprietary</span>
        </div>
      </div>
    </div>
  );
};
