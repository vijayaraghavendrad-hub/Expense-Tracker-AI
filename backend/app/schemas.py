from datetime import date, datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ----------------- Auth & User -----------------
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    currency: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    currency: Optional[str] = "USD"
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None


# ----------------- Category -----------------
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    type: str = Field("expense", pattern="^(expense|income)$")
    icon: Optional[str] = "tag"
    color: Optional[str] = "#6b7280"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(expense|income)$")
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    is_default: bool


# ----------------- Transaction -----------------
class TransactionBase(BaseModel):
    amount: float = Field(..., gt=0)
    type: str = Field("expense", pattern="^(expense|income)$")
    category_id: Optional[int] = None
    payment_method: Optional[str] = "Debit Card"
    currency: Optional[str] = "USD"
    description: str = Field(..., min_length=1, max_length=255)
    transaction_date: date = Field(default_factory=date.today)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[str] = Field(None, pattern="^(expense|income)$")
    category_id: Optional[int] = None
    payment_method: Optional[str] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    transaction_date: Optional[date] = None


class TransactionResponse(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    is_anomaly: bool
    anomaly_reason: Optional[str] = None
    created_at: datetime
    category: Optional[CategoryResponse] = None


class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[TransactionResponse]


# ----------------- Budget -----------------
class BudgetBase(BaseModel):
    category_id: int
    amount: float = Field(..., gt=0)
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    amount: float = Field(..., gt=0)


class BudgetResponse(BudgetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category: Optional[CategoryResponse] = None
    created_at: datetime


class BudgetProgressResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    category_color: str
    budget_amount: float
    spent_amount: float
    remaining_amount: float
    percentage_used: float
    is_exceeded: bool
    month: int
    year: int


# ----------------- Recurring Expense -----------------
class RecurringExpenseBase(BaseModel):
    category_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    frequency: str = Field("monthly", pattern="^(daily|weekly|monthly|yearly)$")
    next_date: date
    description: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    amount: Optional[float] = Field(None, gt=0)
    frequency: Optional[str] = None
    next_date: Optional[date] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RecurringExpenseResponse(RecurringExpenseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    category: Optional[CategoryResponse] = None


# ----------------- AI / ML Layer -----------------
class CategorizeRequest(BaseModel):
    description: str
    amount: Optional[float] = None


class CategorizeResponse(BaseModel):
    predicted_category: str
    confidence: float
    category_id: Optional[int] = None
    top_candidates: List[dict] = []


class MLFeedbackRequest(BaseModel):
    description: str
    predicted_category: str
    actual_category: str
    confidence: Optional[float] = 0.0
    transaction_id: Optional[int] = None


class AnomalyItem(BaseModel):
    transaction_id: int
    description: str
    amount: float
    category_name: str
    transaction_date: date
    reason: str
    score: float


class ForecastPoint(BaseModel):
    month_label: str
    predicted_expense: float
    lower_bound: float
    upper_bound: float
    is_projected: bool


class ForecastResponse(BaseModel):
    next_month_estimate: float
    lower_bound: float
    upper_bound: float
    confidence_level: str
    historical_points: List[ForecastPoint]
    projected_points: List[ForecastPoint]


class InsightItem(BaseModel):
    id: str
    type: str  # 'warning', 'positive', 'neutral', 'tip'
    title: str
    description: str
    metric: Optional[str] = None


class SpendingInsightsResponse(BaseModel):
    insights: List[InsightItem]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------- Analytics -----------------
class MonthlyTrendItem(BaseModel):
    month: str
    month_name: str
    income: float
    expenses: float
    savings: float
    savings_rate: float


class DailyExpenseItem(BaseModel):
    date: str
    day_name: str
    day_number: int
    total_expense: float
    transaction_count: int
    top_transaction: Optional[str] = None
    is_above_average: bool = False


class CategorySpendItem(BaseModel):
    category_id: Optional[int]
    category_name: str
    color: str
    icon: Optional[str] = "tag"
    total_amount: float
    percentage: float
    transaction_count: int
    avg_transaction_amount: Optional[float] = 0.0
    max_transaction_amount: Optional[float] = 0.0


class AnalyticsSummaryResponse(BaseModel):
    total_balance: float
    total_income: float
    total_expenses: float
    savings_rate: float
    avg_daily_spend: float
    top_category: Optional[str]
    top_category_amount: float
    highest_spend_day: Optional[str]
    highest_spend_day_amount: float
    transaction_count: int
    mom_expense_growth_rate: Optional[float]

