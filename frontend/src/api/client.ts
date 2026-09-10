import type {
  User,
  Category,
  Transaction,
  TransactionListResponse,
  BudgetProgress,
  RecurringExpense,
  CategorizeResult,
  InsightItem,
  AnomalyItem,
  ForecastResponse,
  MonthlyTrendItem,
  CategorySpendItem,
  AnalyticsSummary,
  DailyExpenseItem,
} from '../types';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:8000/api'
    : '/api');

const TOKEN_KEY = 'smart_expense_jwt';

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.removeToken();
    window.dispatchEvent(new Event('auth_state_changed'));
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const data = await apiRequest<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    authStorage.setToken(data.access_token);
    return data;
  },

  register: async (name: string, email: string, password: string) => {
    const data = await apiRequest<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    authStorage.setToken(data.access_token);
    return data;
  },

  demoLogin: async () => {
    const data = await apiRequest<{ access_token: string; user: User }>('/auth/demo-login', {
      method: 'POST',
    });
    authStorage.setToken(data.access_token);
    return data;
  },

  getProfile: () => apiRequest<User>('/auth/me'),

  updateProfile: (data: { name?: string; email?: string; currency?: string }) =>
    apiRequest<User>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  logout: () => {
    authStorage.removeToken();
    window.dispatchEvent(new Event('auth_state_changed'));
  },

  // Categories
  getCategories: () => apiRequest<Category[]>('/categories/'),

  createCategory: (data: { name: string; type: 'expense' | 'income'; icon?: string; color?: string }) =>
    apiRequest<Category>('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: number) =>
    apiRequest<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Transactions
  getTransactions: (params: {
    page?: number;
    page_size?: number;
    search?: string;
    category_id?: number;
    payment_method?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    is_anomaly?: boolean;
    sort_by?: 'date' | 'amount';
    sort_dir?: 'asc' | 'desc';
  }) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());
    if (params.search) query.append('search', params.search);
    if (params.category_id) query.append('category_id', params.category_id.toString());
    if (params.payment_method) query.append('payment_method', params.payment_method);
    if (params.type) query.append('type', params.type);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.is_anomaly !== undefined) query.append('is_anomaly', params.is_anomaly.toString());
    if (params.sort_by) query.append('sort_by', params.sort_by);
    if (params.sort_dir) query.append('sort_dir', params.sort_dir);

    return apiRequest<TransactionListResponse>(`/transactions/?${query.toString()}`);
  },

  createTransaction: (data: {
    amount: number;
    type: 'expense' | 'income';
    category_id?: number;
    payment_method?: string;
    currency?: string;
    description: string;
    transaction_date: string;
  }) =>
    apiRequest<Transaction>('/transactions/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransaction: (
    id: number,
    data: {
      amount?: number;
      type?: 'expense' | 'income';
      category_id?: number;
      payment_method?: string;
      currency?: string;
      description?: string;
      transaction_date?: string;
    }
  ) =>
    apiRequest<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTransaction: (id: number) =>
    apiRequest<{ message: string }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  getExportCsvUrl: (params?: { category_id?: number; type?: string; currency?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.category_id) query.append('category_id', params.category_id.toString());
    if (params?.type) query.append('type', params.type);
    if (params?.currency) query.append('currency', params.currency);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const token = authStorage.getToken();
    if (token) query.append('token', token);
    return `${API_BASE}/transactions/export/csv?${query.toString()}`;
  },

  downloadTransactionsCsv: async (params?: { category_id?: number; type?: string; currency?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.category_id) query.append('category_id', params.category_id.toString());
    if (params?.type) query.append('type', params.type);
    if (params?.currency) query.append('currency', params.currency);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const token = authStorage.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/transactions/export/csv?${query.toString()}`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to download CSV: HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const today = new Date().toISOString().split('T')[0];
    a.download = `transactions_ledger_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  // Budgets
  getBudgetsProgress: (month?: number, year?: number) => {
    const query = new URLSearchParams();
    if (month) query.append('month', month.toString());
    if (year) query.append('year', year.toString());
    return apiRequest<BudgetProgress[]>(`/budgets/progress?${query.toString()}`);
  },

  createBudget: (data: { category_id: number; amount: number; month: number; year: number }) =>
    apiRequest('/budgets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteBudget: (id: number) =>
    apiRequest<{ message: string }>(`/budgets/${id}`, {
      method: 'DELETE',
    }),

  // Recurring
  getRecurring: () => apiRequest<RecurringExpense[]>('/recurring/'),

  createRecurring: (data: {
    category_id?: number;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_date: string;
    description: string;
    is_active?: boolean;
  }) =>
    apiRequest<RecurringExpense>('/recurring/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecurring: (id: number, data: Partial<RecurringExpense>) =>
    apiRequest<RecurringExpense>(`/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRecurring: (id: number) =>
    apiRequest<{ message: string }>(`/recurring/${id}`, {
      method: 'DELETE',
    }),

  processDueRecurring: () =>
    apiRequest<{ message: string; processed_count: number }>('/recurring/process-due', {
      method: 'POST',
    }),

  // Analytics
  getSummary: (period: string = 'month', start_date?: string, end_date?: string) => {
    const query = new URLSearchParams({ period });
    if (start_date) query.append('start_date', start_date);
    if (end_date) query.append('end_date', end_date);
    return apiRequest<AnalyticsSummary>(`/analytics/summary?${query.toString()}`);
  },

  getMonthlyTrends: (months: number = 6) =>
    apiRequest<MonthlyTrendItem[]>(`/analytics/monthly?months=${months}`),

  getTrajectory: (period: string = 'month') =>
    apiRequest<MonthlyTrendItem[]>(`/analytics/trajectory?period=${encodeURIComponent(period)}`),

  getCategoryBreakdown: (period: string = 'month') =>
    apiRequest<CategorySpendItem[]>(`/analytics/categories?period=${period}`),

  getDailyExpenses: (period: string = 'month') =>
    apiRequest<DailyExpenseItem[]>(`/analytics/daily?period=${period}`),


  // AI & ML
  categorize: (description: string, amount?: number) =>
    apiRequest<CategorizeResult>('/ai/categorize', {
      method: 'POST',
      body: JSON.stringify({ description, amount }),
    }),

  submitFeedback: (data: {
    description: string;
    predicted_category: string;
    actual_category: string;
    confidence?: number;
    transaction_id?: number;
  }) =>
    apiRequest<{ message: string }>('/ai/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInsights: (currency: string = 'USD') =>
    apiRequest<{ insights: InsightItem[] }>(`/ai/insights?currency=${encodeURIComponent(currency)}`),

  getAnomalies: () => apiRequest<AnomalyItem[]>('/ai/anomalies'),

  getForecast: () => apiRequest<ForecastResponse>('/ai/forecast'),

  // Seed / Demo Data Reset
  resetDemoData: () =>
    apiRequest<{ message: string }>('/demo/seed', {
      method: 'POST',
    }),

  // System Lifecycle & Auto-Shutdown
  sendHeartbeat: () =>
    apiRequest<{ status: string }>('/system/heartbeat', {
      method: 'POST',
    }),

  shutdownSystem: () =>
    apiRequest<{ message: string }>('/system/shutdown', {
      method: 'POST',
    }),
};
