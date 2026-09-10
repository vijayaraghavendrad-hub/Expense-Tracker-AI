import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Clock,
  X,
  Zap,
} from 'lucide-react';
import type { RecurringExpense, Category } from '../types';
import { api } from '../api/client';
import { getCurrencySymbol } from '../utils/currency';

interface RecurringViewProps {
  recurringExpenses: RecurringExpense[];
  categories: Category[];
  currency: string;
  onRefresh: () => void;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  recurringExpenses,
  categories,
  currency,
  onRefresh,
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0 || !description.trim()) return;

    try {
      await api.createRecurring({
        description: description.trim(),
        amount: parsed,
        category_id: categoryId,
        frequency,
        next_date: nextDate,
        is_active: true,
      });
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to create recurring expense.');
    }
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      await api.updateRecurring(item.id, { is_active: !item.is_active });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this recurring item?')) return;
    try {
      await api.deleteRecurring(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item.');
    }
  };

  const handleProcessDue = async () => {
    setIsProcessing(true);
    setProcessResult(null);
    try {
      const res = await api.processDueRecurring();
      setProcessResult(res.message);
      onRefresh();
    } catch (err: any) {
      setProcessResult(err.message || 'Failed to process recurring transactions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const monthlyCommitment = recurringExpenses
    .filter((r) => r.is_active)
    .reduce((acc, r) => {
      if (r.frequency === 'yearly') return acc + r.amount / 12;
      if (r.frequency === 'weekly') return acc + r.amount * 4.33;
      if (r.frequency === 'daily') return acc + r.amount * 30;
      return acc + r.amount;
    }, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Actions */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">
            <Repeat className="w-4 h-4 text-emerald-600" />
            <span>Recurring Obligations</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-zinc-900 tracking-tight">
              {currencySymbol}{monthlyCommitment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-zinc-500 font-medium">/ estimated monthly load</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {recurringExpenses.filter((r) => r.is_active).length} active scheduled subscriptions,
            leases, and recurring bills.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleProcessDue}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition-colors border border-zinc-200 disabled:opacity-60"
          >
            <Zap className={`w-3.5 h-3.5 ${isProcessing ? 'animate-bounce text-emerald-600' : 'text-zinc-600'}`} />
            <span>{isProcessing ? 'Processing...' : 'Run Due Schedules'}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recurring Item</span>
          </button>
        </div>
      </div>

      {processResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{processResult}</span>
          </div>
          <button onClick={() => setProcessResult(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recurring Items Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {recurringExpenses.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-zinc-900">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                        <Repeat className="w-3.5 h-3.5" />
                      </div>
                      <span>{item.description}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {item.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          backgroundColor: `${item.category.color || '#71717a'}15`,
                          color: item.category.color || '#71717a',
                        }}
                      >
                        {item.category.name}
                      </span>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">Unassigned</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono capitalize text-zinc-600">
                    {item.frequency}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-zinc-600">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{item.next_date}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right font-semibold text-zinc-900">
                    {currencySymbol}{item.amount.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                      }`}
                    >
                      {item.is_active ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5" />}
                      <span>{item.is_active ? 'Active' : 'Paused'}</span>
                    </button>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {recurringExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    No recurring expenses found. Add your monthly rent, streaming subs, or utility bills.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Add Recurring Commitment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Netflix 4K, Gym Membership, Rent"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                <select
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="yearly">Yearly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
