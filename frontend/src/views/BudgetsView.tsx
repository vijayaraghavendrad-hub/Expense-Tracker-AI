import type React from 'react';
import { useState } from 'react';
import { Plus, Target, AlertTriangle, Trash2, X } from 'lucide-react';
import type { BudgetProgress, Category } from '../types';
import { api } from '../api/client';
import { getCurrencySymbol } from '../utils/currency';

interface BudgetsViewProps {
  budgetProgress: BudgetProgress[];
  categories: Category[];
  currency: string;
  onRefresh: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgetProgress,
  categories,
  currency,
  onRefresh,
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const resetForm = () => {
    setSelectedCategoryId(null);
    setAmount('');
    setError(null);
  };

  const handleCreateOrUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid monthly budget limit.');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }

    setIsSaving(true);
    try {
      const today = new Date();
      await api.createBudget({
        category_id: Number(selectedCategoryId),
        amount: parsed,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
      });
      setIsModalOpen(false);
      setSelectedCategoryId(null);
      setAmount('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save budget.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Are you sure you want to remove this budget limit?')) return;
    try {
      await api.deleteBudget(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete budget.');
    }
  };

  const totalBudgeted = budgetProgress.reduce((acc, b) => acc + b.budget_amount, 0);
  const totalSpent = budgetProgress.reduce((acc, b) => acc + b.spent_amount, 0);
  const overallPercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Top Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">
            <Target className="w-4 h-4 text-emerald-600" />
            <span>Active Monthly Budget Allocation</span>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-bold text-zinc-900 tracking-tight">
              {currencySymbol}{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-zinc-500 font-medium">
              of {currencySymbol}{totalBudgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })} cap
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {overallPercentage}% overall budget utilized for the current calendar month.
          </p>
        </div>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setError(null);
          }}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Set Category Budget</span>
        </button>
      </div>

      {/* Budget Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgetProgress.map((item) => {
          let barColor = 'bg-emerald-500';
          let textColor = 'text-emerald-700';
          let borderColor = 'border-zinc-200/90';

          if (item.percentage_used >= 100) {
            barColor = 'bg-rose-500';
            textColor = 'text-rose-700';
            borderColor = 'border-rose-200 bg-rose-50/20';
          } else if (item.percentage_used >= 80) {
            barColor = 'bg-amber-500';
            textColor = 'text-amber-700';
          }

          return (
            <div
              key={item.id}
              className={`bg-white p-5 rounded-2xl border ${borderColor} shadow-sm flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.category_color || '#71717a' }}
                    />
                    <h4 className="text-sm font-semibold text-zinc-900">{item.category_name}</h4>
                  </div>
                  <button
                    onClick={() => handleDeleteBudget(item.id)}
                    title="Remove Budget"
                    aria-label={`Remove budget for ${item.category_name}`}
                    className="text-zinc-400 hover:text-rose-600 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="font-semibold text-zinc-900 text-base">
                    {currencySymbol}{item.spent_amount.toFixed(2)}
                  </span>
                  <span className="text-zinc-500 font-medium">Limit: {currencySymbol}{item.budget_amount.toFixed(2)}</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, item.percentage_used)}%` }}
                  />
                </div>
              </div>

              {/* Status footer */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                <span className={`font-semibold ${textColor}`}>{item.percentage_used}% used</span>
                {item.is_exceeded ? (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-rose-700">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Over by {currencySymbol}{(item.spent_amount - item.budget_amount).toFixed(2)}</span>
                  </span>
                ) : (
                  <span className="text-zinc-500 text-[11px]">
                    {currencySymbol}{item.remaining_amount.toFixed(2)} remaining
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {budgetProgress.length === 0 && (
          <div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-zinc-300 text-center">
            <Target className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-800">No category budgets defined</p>
            <p className="text-xs text-zinc-500 mt-1 mb-4">
              Set monthly spending caps on categories to prevent overspending and receive proactive alerts.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
            >
              Add First Budget Limit
            </button>
          </div>
        )}
      </div>

      {/* Set Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Set Monthly Budget</h3>
              <button
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                aria-label="Close budget modal"
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2.5 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateBudget} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Expense Category</label>
                <select
                  required
                  value={selectedCategoryId ?? ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                  aria-label="Select expense category for budget"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Monthly Limit Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500"
                  aria-label="Monthly budget limit amount"
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
