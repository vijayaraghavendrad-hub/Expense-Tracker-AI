import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import type { NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { TransactionModal } from './components/TransactionModal';
import { DashboardView } from './views/DashboardView';
import { TransactionsView } from './views/TransactionsView';
import { BudgetsView } from './views/BudgetsView';
import { AnalyticsView } from './views/AnalyticsView';
import { RecurringView } from './views/RecurringView';
import { ExportView } from './views/ExportView';
import { AuthView } from './views/AuthView';
import { api, authStorage } from './api/client';
import type {
  User,
  Category,
  Transaction,
  AnalyticsSummary,
  MonthlyTrendItem,
  CategorySpendItem,
  DailyExpenseItem,
  InsightItem,
  BudgetProgress,
  RecurringExpense,
  AnomalyItem,
  ForecastResponse,
} from './types';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [period, setPeriod] = useState<string>('month');
  const [currentCurrency, setCurrentCurrency] = useState<string>(
    () => localStorage.getItem('smart_expense_currency') || 'USD'
  );

  const handleCurrencyChange = (newCurr: string) => {
    setCurrentCurrency(newCurr);
    localStorage.setItem('smart_expense_currency', newCurr);
    api.updateProfile({ currency: newCurr }).catch((err) => {
      console.warn('Failed to persist currency preference:', err);
    });
  };

  // Shared application state
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<string>('');
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<MonthlyTrendItem[]>([]);
  const [categorySpends, setCategorySpends] = useState<CategorySpendItem[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);

  // Error state for data fetching
  const [dataError, setDataError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setUser(profile);
        if (profile.currency) {
          setCurrentCurrency(profile.currency);
          localStorage.setItem('smart_expense_currency', profile.currency);
        }
      } catch {
        authStorage.removeToken();
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();

    const handleAuthChange = () => {
      if (!authStorage.getToken()) {
        setUser(null);
        setCategories([]);
        setTransactions([]);
        setTotalTransactions(0);
        setSummary(null);
        setTrends([]);
        setCategorySpends([]);
        setDailyExpenses([]);
        setInsights([]);
        setBudgetProgress([]);
        setRecurringExpenses([]);
        setAnomalies([]);
        setForecast(null);
        setDataError(null);
      }
    };
    window.addEventListener('auth_state_changed', handleAuthChange);
    return () => window.removeEventListener('auth_state_changed', handleAuthChange);
  }, []);

  // Auto-shutdown heartbeat loop — only when authenticated
  useEffect(() => {
    if (!user) return;

    api.sendHeartbeat().catch(() => {});

    const interval = setInterval(() => {
      api.sendHeartbeat().catch(() => {});
    }, 30000);

    const handleUnload = () => {
      try {
        const beaconUrl = '/api/system/leave';
        if (navigator.sendBeacon) {
          navigator.sendBeacon(beaconUrl);
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user]);

  // Fetch Core Data when user or period changes — with AbortController for race condition prevention
  const loadCoreData = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setIsDataLoading(true);
    try {
      const results = await Promise.allSettled([
        api.getCategories(),
        api.getSummary(period),
        api.getTrajectory(period),
        api.getCategoryBreakdown(period),
        api.getDailyExpenses(period),
        api.getInsights(currentCurrency),
        api.getBudgetsProgress(),
        api.getRecurring(),
        api.getAnomalies(),
        api.getForecast(),
      ]);

      if (signal?.aborted) return;

      const [catsResult, summaryResult, trendsResult, catSpendsResult, dailyExpensesResult, insightsResult, budgetsResult, recurringResult, anomaliesResult, forecastResult] = results;

      if (catsResult.status === 'fulfilled') setCategories(catsResult.value);
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      if (trendsResult.status === 'fulfilled') setTrends(trendsResult.value);
      if (catSpendsResult.status === 'fulfilled') setCategorySpends(catSpendsResult.value);
      if (dailyExpensesResult.status === 'fulfilled') setDailyExpenses(dailyExpensesResult.value);
      if (insightsResult.status === 'fulfilled') setInsights(insightsResult.value.insights);
      if (budgetsResult.status === 'fulfilled') setBudgetProgress(budgetsResult.value);
      if (recurringResult.status === 'fulfilled') setRecurringExpenses(recurringResult.value);
      if (anomaliesResult.status === 'fulfilled') setAnomalies(anomaliesResult.value);
      if (forecastResult.status === 'fulfilled') setForecast(forecastResult.value);

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount === results.length) {
        setDataError('Failed to load dashboard data. Please try again.');
      } else if (failedCount > 0) {
        setDataError(`Some data failed to load (${failedCount}/${results.length} endpoints). Partial data shown.`);
      } else {
        setDataError(null);
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Error fetching core dashboard data:', err);
        setDataError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setIsDataLoading(false);
    }
  }, [user, period, currentCurrency]);

  // Fetch Transactions (paginated & filtered) — with AbortController
  const loadTransactions = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    try {
      const res = await api.getTransactions({
        page,
        page_size: 12,
        search,
        category_id: selectedCategory,
        type: selectedType || undefined,
        is_anomaly: onlyAnomalies ? true : undefined,
        sort_by: 'date',
        sort_dir: 'desc',
      });

      if (signal?.aborted) return;

      setTransactions(res.items);
      setTotalTransactions(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Error fetching transactions:', err);
      }
    }
  }, [user, page, search, selectedCategory, selectedType, onlyAnomalies]);

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      loadCoreData(controller.signal);
      return () => controller.abort();
    }
  }, [user, loadCoreData]);

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      loadTransactions(controller.signal);
      return () => controller.abort();
    }
  }, [user, loadTransactions]);

  const refreshControllerRef = useRef<AbortController | null>(null);

  const handleRefreshAll = useCallback(() => {
    if (refreshControllerRef.current) {
      refreshControllerRef.current.abort();
    }
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    loadCoreData(controller.signal);
    loadTransactions(controller.signal);
  }, [loadCoreData, loadTransactions]);

  const handleResetDemoData = async () => {
    setIsResetting(true);
    try {
      await api.resetDemoData();
      handleRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to reset demo data.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      handleRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction.');
    }
  };

  const handleViewAnomalies = () => {
    setActiveTab('transactions');
    setOnlyAnomalies(true);
    setPage(1);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-zinc-500 text-xs font-mono">
          <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin"></div>
          <span>Initializing Smart Expense OS...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onAuthSuccess={(newUser) => setUser(newUser)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={() => api.logout()}
        onResetData={handleResetDemoData}
        isResetting={isResetting}
        anomalyCount={anomalies.length}
      />

      {/* Main Workspace Area (offset by 256px sidebar) */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          period={period}
          setPeriod={setPeriod}
          currency={currentCurrency}
          onCurrencyChange={handleCurrencyChange}
          onOpenAddModal={handleOpenAdd}
          anomalyCount={anomalies.length}
          onViewAnomalies={handleViewAnomalies}
        />

        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">
          {dataError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
              <span>{dataError}</span>
              <button onClick={() => { setDataError(null); handleRefreshAll(); }} className="text-rose-800 font-semibold underline">
                Retry
              </button>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <DashboardView
              summary={summary}
              trends={trends}
              categorySpends={categorySpends}
              dailyExpenses={dailyExpenses}
              insights={insights}
              budgetProgress={budgetProgress}
              recentTransactions={transactions}
              currency={currentCurrency}
              isLoading={isDataLoading}
              period={period}
              onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
              onNavigateTransactions={() => setActiveTab('transactions')}
              onNavigateBudgets={() => setActiveTab('budgets')}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              totalTransactions={totalTransactions}
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              categories={categories}
              search={search}
              setSearch={setSearch}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              onlyAnomalies={onlyAnomalies}
              setOnlyAnomalies={setOnlyAnomalies}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenAddModal={handleOpenAdd}
              currency={currentCurrency}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsView
              budgetProgress={budgetProgress}
              categories={categories}
              currency={currentCurrency}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              summary={summary}
              trends={trends}
              categorySpends={categorySpends}
              forecast={forecast}
              currency={currentCurrency}
            />
          )}

          {activeTab === 'recurring' && (
            <RecurringView
              recurringExpenses={recurringExpenses}
              categories={categories}
              currency={currentCurrency}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'export' && (
            <ExportView
              user={user}
              summary={summary}
              categorySpends={categorySpends}
              trends={trends}
              currency={currentCurrency}
              period={period}
            />
          )}
        </main>
      </div>

      {/* Transaction Add/Edit Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleRefreshAll}
        categories={categories}
        initialTransaction={editingTransaction}
        defaultCurrency={currentCurrency}
        onCurrencyChange={handleCurrencyChange}
      />
    </div>
  );
}

export default App;
