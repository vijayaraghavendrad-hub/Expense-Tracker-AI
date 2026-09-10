export interface User {
  id: number;
  name: string;
  email: string;
  currency?: string;
  created_at: string;
}

export interface Category {
  id: number;
  user_id?: number;
  name: string;
  type: 'expense' | 'income';
  icon?: string;
  color?: string;
  is_default: boolean;
}

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'expense' | 'income';
  category_id?: number;
  payment_method: string;
  currency?: string;
  description: string;
  transaction_date: string;
  is_anomaly: boolean;
  anomaly_reason?: string;
  created_at: string;
  category?: Category;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Transaction[];
}

export interface BudgetProgress {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  budget_amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
  is_exceeded: boolean;
  month: number;
  year: number;
}

export interface RecurringExpense {
  id: number;
  user_id: number;
  category_id?: number;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_date: string;
  description: string;
  is_active: boolean;
  created_at: string;
  category?: Category;
}

export interface CategorizeCandidate {
  category: string;
  confidence: number;
}

export interface CategorizeResult {
  predicted_category: string;
  confidence: number;
  category_id?: number;
  top_candidates: CategorizeCandidate[];
}

export interface InsightItem {
  id: string;
  type: 'warning' | 'positive' | 'neutral' | 'tip';
  title: string;
  description: string;
  metric?: string;
}

export interface AnomalyItem {
  transaction_id: number;
  description: string;
  amount: number;
  category_name: string;
  transaction_date: string;
  reason: string;
  score: number;
}

export interface ForecastPoint {
  month_label: string;
  predicted_expense: number;
  lower_bound: number;
  upper_bound: number;
  is_projected: boolean;
}

export interface ForecastResponse {
  next_month_estimate: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: 'High' | 'Moderate' | 'Preliminary';
  historical_points: ForecastPoint[];
  projected_points: ForecastPoint[];
}

export interface MonthlyTrendItem {
  month: string;
  month_name: string;
  income: number;
  expenses: number;
  savings: number;
  savings_rate: number;
}

export interface DailyExpenseItem {
  date: string;
  day_name: string;
  day_number: number;
  total_expense: number;
  transaction_count: number;
  top_transaction?: string;
  is_above_average: boolean;
}

export interface CategorySpendItem {
  category_id?: number;
  category_name: string;
  color: string;
  icon?: string;
  total_amount: number;
  percentage: number;
  transaction_count: number;
  avg_transaction_amount?: number;
  max_transaction_amount?: number;
}

export interface AnalyticsSummary {
  total_balance: number;
  total_income: number;
  total_expenses: number;
  savings_rate: number;
  avg_daily_spend: number;
  top_category?: string;
  top_category_amount: number;
  highest_spend_day?: string;
  highest_spend_day_amount: number;
  transaction_count: number;
  mom_expense_growth_rate?: number;
}

