import React from 'react';
import {
  Sparkles,
  Activity,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type {
  AnalyticsSummary,
  MonthlyTrendItem,
  CategorySpendItem,
  ForecastResponse,
} from '../types';
import { getCurrencySymbol } from '../utils/currency';

interface AnalyticsViewProps {
  summary: AnalyticsSummary | null;
  trends: MonthlyTrendItem[];
  categorySpends: CategorySpendItem[];
  forecast: ForecastResponse | null;
  currency: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  summary,
  trends,
  categorySpends,
  forecast,
  currency,
}) => {
  const currencySymbol = getCurrencySymbol(currency);
  const histPoints = forecast?.historical_points || [];
  const projPoints = forecast?.projected_points || [];

  // Combine historical and projected data points for a smooth, unbroken trajectory curve
  const combinedForecastChartData = [
    ...histPoints.map((p, idx) => ({
      month: p.month_label,
      actual: p.predicted_expense,
      predicted: idx === histPoints.length - 1 ? p.predicted_expense : (null as number | null),
      lower: null as number | null,
      upper: null as number | null,
    })),
    ...projPoints.map((p) => ({
      month: `${p.month_label} (Proj)`,
      actual: null as number | null,
      predicted: p.predicted_expense,
      lower: p.lower_bound,
      upper: p.upper_bound,
    })),
  ];


  return (
    <div className="space-y-6 pb-12">
      {/* ML Forecast Highlight Card (FR11.1 / FR11.2) */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-2xl p-6 shadow-md border border-zinc-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-700/70 gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide">
                Machine Learning Next-Month Expense Forecast
              </h3>
              <p className="text-xs text-zinc-400">
                Linear Regression time-series extrapolation across historical monthly cohorts
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-400 font-medium">Model Confidence:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {forecast?.confidence_level || 'Moderate'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          {/* Estimated Spend */}
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-4 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider block mb-1">
              Projected Spend Next Month
            </span>
            <div className="text-3xl font-bold text-white tracking-tight">
              {currencySymbol}{forecast?.next_month_estimate.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Based on historical trends & recurring schedules
            </p>
          </div>

          {/* Expected Range */}
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-4 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider block mb-1">
              Estimated 90% Confidence Interval
            </span>
            <div className="text-xl font-bold text-zinc-100 tracking-tight">
              {currencySymbol}{forecast?.lower_bound.toFixed(0)} — {currencySymbol}{forecast?.upper_bound.toFixed(0)}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Statistical variance tolerance bounds
            </p>
          </div>

          {/* Momentum */}
          <div className="bg-zinc-800/60 border border-zinc-700/50 p-4 rounded-xl">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider block mb-1">
              Month-over-Month Growth
            </span>
            <div className="text-xl font-bold text-zinc-100 tracking-tight flex items-center space-x-1.5">
              {summary?.mom_expense_growth_rate !== null && summary?.mom_expense_growth_rate !== undefined ? (
                <>
                  <span className={summary.mom_expense_growth_rate > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {summary.mom_expense_growth_rate > 0 ? `+${summary.mom_expense_growth_rate}%` : `${summary.mom_expense_growth_rate}%`}
                  </span>
                  <span className="text-xs text-zinc-400 font-normal">delta</span>
                </>
              ) : (
                <span>Stable</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Trailing 30-day velocity shift
            </p>
          </div>
        </div>

        {/* Forecast Projection Chart */}
        {combinedForecastChartData.length > 1 && (
          <div className="mt-6 pt-4 border-t border-zinc-700/60">
            <div className="text-xs font-semibold text-zinc-300 mb-3 flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Historical Actuals & Extrapolated Projection</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedForecastChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#52525b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-zinc-950 text-white p-2.5 rounded-lg text-xs shadow-xl border border-zinc-800">
                            <p className="font-semibold text-zinc-400 mb-1">{label}</p>
                            {payload.map((entry, idx) => (
                              <p key={idx} style={{ color: entry.color }}>
                                {entry.name}: {currencySymbol}{Number(entry.value).toLocaleString()}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line type="monotone" dataKey="actual" name="Historical Actual" stroke="#ffffff" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="predicted" name="ML Projected" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 5, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Month Trend Comparison (FR7.1) */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Multi-Month Income vs. Expense Comparison</h3>
            <p className="text-xs text-zinc-400">Historical performance breakdown over the past 6 to 12 months</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month_name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-zinc-900 text-white p-2.5 rounded-lg text-xs shadow-xl border border-zinc-800 space-y-1">
                        <p className="font-semibold text-zinc-300">{label}</p>
                        <p className="text-emerald-400">Income: {currencySymbol}{Number(payload[0]?.value).toLocaleString()}</p>
                        <p className="text-zinc-400">Expenses: {currencySymbol}{Number(payload[1]?.value).toLocaleString()}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="income" name={`Income (${currencySymbol})`} fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name={`Expenses (${currencySymbol})`} fill="#18181b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Spend Distribution Table (FR7.2) */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-900">Category Expense Distribution</h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {categorySpends.length} Categories Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Transactions</th>
                <th className="py-3 px-4 text-right">Avg / Tx</th>
                <th className="py-3 px-4 text-right">Max Single</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4 text-right">Portfolio Share</th>
                <th className="py-3 px-4">Distribution Visual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {categorySpends.map((item) => (
                <tr key={item.category_name} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-zinc-900 flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.category_name}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-600">{item.transaction_count}</td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-600">
                    {currencySymbol}{((item.avg_transaction_amount || (item.total_amount / (item.transaction_count || 1)))).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-zinc-600">
                    {currencySymbol}{((item.max_transaction_amount || item.total_amount)).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-zinc-900">
                    {currencySymbol}{item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                    {item.percentage}%
                  </td>
                  <td className="py-3 px-4 w-44">
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color || '#10b981',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
