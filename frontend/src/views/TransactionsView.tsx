import React, { useRef, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Transaction, Category } from '../types';
import { api } from '../api/client';
import { getCurrencySymbol } from '../utils/currency';

interface TransactionsViewProps {
  transactions: Transaction[];
  totalTransactions: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  categories: Category[];
  search: string;
  setSearch: (search: string) => void;
  selectedCategory: number | undefined;
  setSelectedCategory: (id: number | undefined) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  onlyAnomalies: boolean;
  setOnlyAnomalies: (val: boolean) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: number) => void;
  onOpenAddModal: () => void;
  currency?: string;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  totalTransactions,
  page,
  totalPages,
  setPage,
  categories,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  selectedType,
  setSelectedType,
  onlyAnomalies,
  setOnlyAnomalies,
  onEditTransaction,
  onDeleteTransaction,
  onOpenAddModal,
  currency = 'USD',
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const [isExporting, setIsExporting] = React.useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const debouncedSetSearch = useCallback((value: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  }, [setSearch, setPage]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    const today = new Date();
    const end_date = today.toISOString().split('T')[0];
    const start_date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    try {
      await api.downloadTransactionsCsv({
        category_id: selectedCategory,
        type: selectedType || undefined,
        currency,
        start_date,
        end_date,
      });
    } catch {
      try {
        await api.downloadTransactionsCsv({
          category_id: selectedCategory,
          type: selectedType || undefined,
          currency,
          start_date,
          end_date,
        });
      } catch {
        // CSV download failed
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            defaultValue={search}
            onChange={(e) => {
              debouncedSetSearch(e.target.value);
            }}
            placeholder="Search by description..."
            aria-label="Search transactions by description"
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
          />
        </div>

        {/* Dropdowns & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Ledger Currency Indicator */}
          <div className="text-xs bg-zinc-100 border border-zinc-200 rounded-lg px-2.5 py-1.5 flex items-center space-x-1.5 font-medium text-zinc-700">
            <span className="text-zinc-400 text-[10px] uppercase font-semibold">Currency:</span>
            <span className="font-bold text-zinc-900">{currency} ({currencySymbol})</span>
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by transaction type"
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => {
              setSelectedCategory(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Export CSV CTA */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            aria-label="Export transactions as CSV"
            className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
            title="Download complete transaction ledger as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount ({currencySymbol})</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs text-zinc-700">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-50/70 transition-colors">
                  {/* Date */}
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                    {tx.transaction_date}
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4 font-medium text-zinc-900 max-w-xs truncate">
                    {tx.description}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {tx.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          backgroundColor: `${tx.category.color || '#71717a'}15`,
                          color: tx.category.color || '#71717a',
                        }}
                      >
                        {tx.category.name}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* Payment Method */}
                  <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                    {tx.payment_method}
                  </td>

                  {/* Amount */}
                  <td
                    className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                      tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'
                    }`}
                  >
                    <span>
                      {tx.type === 'income' ? '+' : '-'}
                      {currencySymbol}
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* Type Badge */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        tx.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => onEditTransaction(tx)}
                        title="Edit"
                        className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        title="Delete"
                        className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    No transactions match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing <span className="font-semibold text-zinc-800">{transactions.length}</span> of{' '}
            <span className="font-semibold text-zinc-800">{totalTransactions}</span> transactions
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-zinc-700">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
