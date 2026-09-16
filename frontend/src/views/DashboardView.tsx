import type React from 'react';
import { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from 'recharts';
import { getCurrencySymbol } from '../utils/currency';
import type {
  AnalyticsSummary,
  MonthlyTrendItem,
  CategorySpendItem,
  InsightItem,
  BudgetProgress,
  Transaction,
  DailyExpenseItem,
} from '../types';

interface DashboardViewProps {
  summary: AnalyticsSummary | null;
  trends: MonthlyTrendItem[];
  categorySpends: CategorySpendItem[];
  dailyExpenses: DailyExpenseItem[];
  insights: InsightItem[];
  budgetProgress: BudgetProgress[];
  recentTransactions: Transaction[];
  currency: string;
  isLoading?: boolean;
  period?: string;
  onPeriodChange?: (period: string) => void;
  onNavigateTransactions: () => void;
  onNavigateBudgets: () => void;
}

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-zinc-200 rounded ${className}`} />
);

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  trends,
  categorySpends,
  dailyExpenses,
  insights,
  budgetProgress,
  recentTransactions,
  currency,
  isLoading = false,
  period = 'month',
  onPeriodChange,
  onNavigateTransactions,
  onNavigateBudgets,
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const exceededBudgets = budgetProgress.filter((b) => b.is_exceeded);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Active days with spend
  const activeSpendDays = dailyExpenses.filter((d) => d.total_expense > 0);
  const avgDailySpend = summary?.avg_daily_spend || 0;

  const displayedCategories = showAllCategories ? categorySpends : categorySpends.slice(0, 6);

  return (
    <div className="space-y-6 pb-12">
      {isLoading && !summary && (
        <>
          {/* Stat Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-sm">
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          {/* Chart Skeleton */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm">
            <Skeleton className="h-4 w-48 mb-4" />
            <Skeleton className="h-56 w-full" />
          </div>
          {/* Insights Skeleton */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-5">
            <Skeleton className="h-4 w-40 bg-zinc-700 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-zinc-800/80 rounded-xl p-3.5">
                  <Skeleton className="h-3 w-28 bg-zinc-700 mb-2" />
                  <Skeleton className="h-3 w-full bg-zinc-700" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!isLoading && (
        <>
          {/* Exceeded Budget Alert Banner */}
          {exceededBudgets.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-rose-900">
                    Budget Limit Exceeded in {exceededBudgets.length} {exceededBudgets.length === 1 ? 'Category' : 'Categories'}
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    {exceededBudgets.map((b) => `${b.category_name} (${b.percentage_used}% used)`).join(', ')}.
                  </p>
                </div>
              </div>
              <button
                onClick={onNavigateBudgets}
                className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline px-2 py-1"
              >
                Adjust Limits
              </button>
            </div>
          )}

          {/* Top Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Balance */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Net Cash Flow</span>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                {currencySymbol}{summary?.total_balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500 flex items-center space-x-1">
                <span>Savings rate:</span>
                <span className={`font-semibold ${summary && summary.savings_rate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {summary ? `${summary.savings_rate}%` : '0%'}
                </span>
              </div>
            </div>

            {/* Total Income */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Income</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                {currencySymbol}{summary?.total_income.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 flex items-center space-x-1">
                <ArrowUpRight className="w-3 h-3" />
                <span>Active revenue inflows</span>
              </div>
            </div>

            {/* Total Expenses */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Expenses</span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                {currencySymbol}{summary?.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500 flex items-center space-x-1">
                {summary?.mom_expense_growth_rate !== null && summary?.mom_expense_growth_rate !== undefined ? (
                  <>
                    <span className={summary.mom_expense_growth_rate > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600 font-medium'}>
                      {summary.mom_expense_growth_rate > 0 ? `+${summary.mom_expense_growth_rate}%` : `${summary.mom_expense_growth_rate}%`}
                    </span>
                    <span>vs last month</span>
                  </>
                ) : (
                  <span>Tracking monthly burn</span>
                )}
              </div>
            </div>

            {/* Daily Spend Pace */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200/90 shadow-sm">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Daily Burn Velocity</span>
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <PiggyBank className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 tracking-tight">
                {currencySymbol}{(summary?.avg_daily_spend ?? 0).toFixed(2)}
                <span className="text-xs text-zinc-400 font-normal"> / day</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500 truncate">
                Top: <span className="font-medium text-zinc-800">{summary?.top_category || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Per-Day Expense Trackdown (Financial Overview) */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-zinc-900">Per-Day Expense Trackdown</h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Day-by-day expenditure timeline across the active billing cycle
                </p>
              </div>

              {/* Timeframe Selector Pills (Controls Trackdown + Income/Expense Trajectory) */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200/80">
                  <span className="text-[10px] font-semibold uppercase text-zinc-400 px-2 tracking-wider">
                    Timeframe:
                  </span>
                  {[
                    { id: 'week', label: '7D Week' },
                    { id: 'month', label: '30D Month' },
                    { id: 'year', label: 'Year' },
                    { id: 'all', label: 'All' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onPeriodChange && onPeriodChange(t.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${period === t.id
                          ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                          : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1.5 text-zinc-600">
                    <span className="w-2.5 h-2.5 rounded-sm bg-zinc-900"></span>
                    <span>Daily Spend</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-zinc-500">
                    <span className="w-3 border-t border-dashed border-emerald-500"></span>
                    <span>Avg ({currencySymbol}{avgDailySpend.toFixed(0)})</span>
                  </div>
                  <span className="font-mono text-zinc-400">
                    {activeSpendDays.length} active spend days
                  </span>
                </div>
              </div>
            </div>

            {/* Daily Bar Chart */}
            <div className="h-56 w-full pt-4">
              {dailyExpenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyExpenses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="day_number"
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={{ stroke: '#e4e4e7' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as DailyExpenseItem;
                          return (
                            <div className="bg-zinc-900 text-white p-2.5 rounded-lg shadow-xl text-xs space-y-1 border border-zinc-800">
                              <div className="font-semibold text-zinc-200">
                                {item.date} ({item.day_name})
                              </div>
                              <div className="text-emerald-400 font-medium">
                                Total Spent: {currencySymbol}{item.total_expense.toFixed(2)}
                              </div>
                              <div className="text-zinc-400 text-[11px]">
                                Transactions: {item.transaction_count}
                              </div>
                              {item.top_transaction && (
                                <div className="text-zinc-400 text-[11px] truncate max-w-xs">
                                  Top: {item.top_transaction}
                                </div>
                              )}
                              <div className="text-[10px] text-zinc-500">
                                {item.is_above_average ? '▲ Above daily average' : '▼ Below daily average'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {avgDailySpend > 0 && (
                      <ReferenceLine
                        y={avgDailySpend}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                      />
                    )}
                    <Bar
                      dataKey="total_expense"
                      fill="#18181b"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-400">
                  No expense data available for this period
                </div>
              )}
            </div>
          </div>

          {/* AI Spending Advisory Row */}
          {insights.length > 0 && (
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-5 text-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold tracking-wide uppercase text-zinc-200">
                    Explainable AI Financial Advisory & Suggestions
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Currency: {currency} ({currencySymbol})
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">Real-Time Pacing Engine</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insights.slice(0, 3).map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-zinc-800/80 border border-zinc-700/60 rounded-xl p-3.5 hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-zinc-100">{insight.title}</span>
                      {insight.metric && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-700/80 text-emerald-400">
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Area Chart (Span 2) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-zinc-900">Income vs. Expense History Trajectory</h3>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                      Synced: {period === 'week' ? '7-Day Week' : period === 'month' ? '30-Day Month' : period === 'year' ? 'Current Year' : 'All Time'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {period === 'week' && 'Day-by-day cash flow trajectory across the current week'}
                    {period === 'month' && 'Day-by-day cash flow trajectory across the active billing month'}
                    {period === 'year' && 'Monthly cash flow trajectory across the active year'}
                    {period === 'all' && 'Long-term historical cash flow trajectory'}
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                    <span className="text-zinc-600">Income</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-zinc-800"></span>
                    <span className="text-zinc-600">Expenses</span>
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month_name"
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={{ stroke: '#e4e4e7' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#71717a' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-zinc-900 text-white p-2.5 rounded-lg shadow-xl text-xs space-y-1 border border-zinc-800">
                              <p className="font-semibold text-zinc-300">{label}</p>
                              <p className="text-emerald-400">
                                Income: {currencySymbol}{Number(payload[0]?.value || 0).toLocaleString()}
                              </p>
                              <p className="text-zinc-300">
                                Expenses: {currencySymbol}{Number(payload[1]?.value || 0).toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#18181b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#expenseGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Breakdown Donut with Full Details */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Category Distribution</h3>
                  <p className="text-xs text-zinc-400">Complete breakdown by category</p>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">{categorySpends.length} Active</span>
              </div>

              <div className="h-44 w-full relative flex items-center justify-center">
                {categorySpends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySpends}
                        dataKey="total_amount"
                        nameKey="category_name"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {categorySpends.map((entry) => (
                          <Cell key={`cell-${entry.category_name}`} fill={entry.color || '#71717a'} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as CategorySpendItem;
                            return (
                              <div className="bg-zinc-900 text-white p-2 rounded-lg text-xs shadow-lg space-y-0.5">
                                <p className="font-semibold text-zinc-200">{data.category_name}</p>
                                <p className="text-emerald-400 font-medium">
                                  {currencySymbol}{data.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({data.percentage}%)
                                </p>
                                <p className="text-zinc-400 text-[10px]">
                                  {data.transaction_count} purchases • Avg: {currencySymbol}{data.avg_transaction_amount?.toFixed(2) || '0.00'}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-zinc-400">No category records</div>
                )}
              </div>

              {/* Detailed Categories List */}
              <div className="mt-auto space-y-2 pt-2 border-t border-zinc-100 max-h-52 overflow-y-auto pr-1">
                {displayedCategories.map((cat) => (
                  <div key={cat.category_name} className="p-1.5 rounded-lg hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-zinc-800 font-medium truncate">{cat.category_name}</span>
                        <span className="text-[10px] text-zinc-400">({cat.transaction_count} tx)</span>
                      </div>
                      <div className="font-semibold text-zinc-900 shrink-0 text-right">
                        {currencySymbol}{cat.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-emerald-600 text-[11px] font-normal">({cat.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, cat.percentage)}%`,
                          backgroundColor: cat.color || '#10b981',
                        }}
                      />
                    </div>
                  </div>
                ))}

                {categorySpends.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="w-full text-center py-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 flex items-center justify-center space-x-1"
                  >
                    <span>{showAllCategories ? 'Show Less' : `View All ${categorySpends.length} Categories`}</span>
                    {showAllCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Recent Transactions</h3>
                <p className="text-xs text-zinc-400">Latest recorded ledger movements</p>
              </div>
              <button
                onClick={onNavigateTransactions}
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 hover:bg-zinc-50/80 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${tx.category?.color || '#71717a'}18`,
                        color: tx.category?.color || '#71717a',
                      }}
                    >
                      {tx.type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-zinc-900">{tx.description}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center space-x-2">
                        <span>{tx.transaction_date}</span>
                        <span>•</span>
                        <span>{tx.category?.name || 'Uncategorized'}</span>
                        <span>•</span>
                        <span>{tx.payment_method}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-xs font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-900'
                      }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {currencySymbol}
                    {tx.amount.toFixed(2)}
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-400">
                  No transactions recorded yet. Click "Add Transaction" to start tracking.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
