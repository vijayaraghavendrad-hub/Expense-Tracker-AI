import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Check, ArrowRight, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { Category, Transaction } from '../types';
import { CURRENCIES, getCurrencySymbol } from '../utils/currency';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  initialTransaction?: Transaction | null;
  defaultCurrency?: string;
  onCurrencyChange?: (currency: string) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
  initialTransaction,
  defaultCurrency = 'USD',
  onCurrencyChange,
}) => {
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string>('Debit Card');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Inline Quick Add Category
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>('#10b981');
  const [isCreatingCat, setIsCreatingCat] = useState<boolean>(false);

  // AI Categorization states
  const [aiSuggestion, setAiSuggestion] = useState<{
    categoryName: string;
    confidence: number;
    matchedCategoryId?: number;
  } | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [acceptedAiCat, setAcceptedAiCat] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    if (initialTransaction) {
      setAmount(initialTransaction.amount.toString());
      setCurrency(initialTransaction.currency || 'USD');
      setType(initialTransaction.type);
      setDescription(initialTransaction.description);
      setCategoryId(initialTransaction.category_id);
      setPaymentMethod(initialTransaction.payment_method);
      setTransactionDate(initialTransaction.transaction_date);
    } else {
      setAmount('');
      setCurrency(defaultCurrency || 'USD');
      setType('expense');
      setDescription('');
      setCategoryId(undefined);
      setPaymentMethod('Debit Card');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setAiSuggestion(null);
      setAcceptedAiCat(null);
      setShowAddCategory(false);
      setNewCatName('');
    }
    setError(null);
  }, [initialTransaction, isOpen, defaultCurrency]);

  // Debounced AI category prediction as user types description or amount (FR8.1)
  const categoryIdRef = useRef(categoryId);
  useEffect(() => {
    categoryIdRef.current = categoryId;
  }, [categoryId]);

  const localCategoriesRef = useRef(localCategories);
  useEffect(() => {
    localCategoriesRef.current = localCategories;
  }, [localCategories]);

  useEffect(() => {
    if (!description || description.trim().length < 2 || initialTransaction) {
      setAiSuggestion(null);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setIsPredicting(true);
        const parsedAmount = parseFloat(amount) || undefined;
        const res = await api.categorize(description, parsedAmount);

        if (controller.signal.aborted) return;

        // Find matching category ID in available categories
        const cats = localCategoriesRef.current;
        const matched = cats.find(
          (c) =>
            c.name.toLowerCase().includes(res.predicted_category.toLowerCase()) ||
            res.predicted_category.toLowerCase().includes(c.name.toLowerCase())
        );

        setAiSuggestion({
          categoryName: res.predicted_category,
          confidence: res.confidence,
          matchedCategoryId: matched?.id,
        });

        // Auto-select if category hasn't been set yet and confidence is high (> 65%)
        if (!categoryIdRef.current && matched && res.confidence >= 0.65) {
          setCategoryId(matched.id);
          setAcceptedAiCat(res.predicted_category);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('AI categorization error', err);
        }
      } finally {
        setIsPredicting(false);
      }
    }, 380);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [description, amount, initialTransaction]);


  if (!isOpen) return null;

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.matchedCategoryId) {
      setCategoryId(aiSuggestion.matchedCategoryId);
      setAcceptedAiCat(aiSuggestion.categoryName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialTransaction) {
        await api.updateTransaction(initialTransaction.id, {
          amount: parsedAmount,
          type,
          category_id: categoryId,
          payment_method: paymentMethod,
          currency: currency || 'USD',
          description: description.trim(),
          transaction_date: transactionDate,
        });
      } else {
        const created = await api.createTransaction({
          amount: parsedAmount,
          type,
          category_id: categoryId,
          payment_method: paymentMethod,
          currency: currency || 'USD',
          description: description.trim(),
          transaction_date: transactionDate,
        });

        // Feedback loop: If AI predicted something different from final chosen category, log feedback (FR8.3)
        if (aiSuggestion && categoryId) {
          const selectedCat = categories.find((c) => c.id === categoryId);
          if (
            selectedCat &&
            selectedCat.name.toLowerCase() !== aiSuggestion.categoryName.toLowerCase()
          ) {
            api.submitFeedback({
              description: description.trim(),
              predicted_category: aiSuggestion.categoryName,
              actual_category: selectedCat.name,
              confidence: aiSuggestion.confidence,
              transaction_id: created.id,
            }).catch(() => {});
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setIsCreatingCat(true);
    setError(null);
    try {
      const created = await api.createCategory({
        name: newCatName.trim(),
        type,
        color: newCatColor,
      });
      setLocalCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName('');
      setShowAddCategory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setIsCreatingCat(false);
    }
  };

  const filteredCategories = localCategories.filter((c) => c.type === type);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {initialTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
            <p className="text-xs text-zinc-500">
              {initialTransaction ? 'Update financial ledger entry' : 'Log an expense or income item'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategoryId(undefined);
                setAiSuggestion(null);
                setAcceptedAiCat(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                type === 'expense'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategoryId(undefined);
                setAiSuggestion(null);
                setAcceptedAiCat(null);
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                type === 'income'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Income
            </button>
          </div>

          {/* Currency & Amount */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => {
                  const val = e.target.value;
                  setCurrency(val);
                  onCurrencyChange?.(val);
                }}
                aria-label="Transaction currency"
                className="w-full px-2.5 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 font-medium"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Amount ({getCurrencySymbol(currency)})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-zinc-400 text-sm font-medium">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  aria-label="Transaction amount"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Description with live AI badge */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-700">Description</label>
              {isPredicting && (
                <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 animate-pulse text-emerald-500" />
                  <span>AI predicting...</span>
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Starbucks cold brew, Whole Foods groceries"
              aria-label="Transaction description"
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
            />

            {/* AI Auto-Categorization Suggestion Banner */}
            {aiSuggestion && type === 'expense' && (
              <div className="mt-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <span className="text-zinc-600 font-normal">AI predicted: </span>
                    <span className="font-semibold text-emerald-800">{aiSuggestion.categoryName}</span>
                    <span className="text-zinc-400 text-[11px] ml-1">
                      ({Math.round(aiSuggestion.confidence * 100)}%)
                    </span>
                  </div>
                </div>
                {aiSuggestion.matchedCategoryId && categoryId !== aiSuggestion.matchedCategoryId && (
                  <button
                    type="button"
                    onClick={handleApplyAiSuggestion}
                    className="text-[11px] px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition-colors flex items-center space-x-1"
                  >
                    <span>Apply</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                )}
                {categoryId === aiSuggestion.matchedCategoryId && (
                  <span className="text-[11px] text-emerald-700 font-medium flex items-center space-x-0.5">
                    <Check className="w-3 h-3" />
                    <span>Applied</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Category Dropdown & Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-700">Category</label>
              <button
                type="button"
                onClick={() => setShowAddCategory(!showAddCategory)}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>{showAddCategory ? 'Cancel' : '+ New Category'}</span>
              </button>
            </div>

            {showAddCategory && (
              <div className="mb-2 p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="text-[11px] font-semibold text-zinc-700">Add New Category</div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g., Coffee, Pet Care, Gadgets"
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-zinc-300 cursor-pointer p-0.5"
                    aria-label="Category color"
                    title="Choose color"
                  />
                  <button
                    type="button"
                    disabled={isCreatingCat || !newCatName.trim()}
                    onClick={handleCreateCategory}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isCreatingCat ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              aria-label="Transaction category"
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
            >
              <option value="">Select a category</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                aria-label="Transaction date"
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                aria-label="Payment method"
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors shadow-sm disabled:opacity-60"
            >
              {isSubmitting
                ? 'Saving...'
                : initialTransaction
                ? 'Save Changes'
                : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
