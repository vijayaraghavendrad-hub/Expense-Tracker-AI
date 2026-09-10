import calendar
from datetime import date, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Transaction, Category, Budget
from ..schemas import InsightItem


CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "INR": "₹",
    "JPY": "¥",
    "CAD": "CA$",
    "AUD": "AU$",
    "CNY": "¥",
    "CHF": "CHF ",
    "SGD": "S$",
}


def _month_range(year: int, month: int):
    """Return (start_date, end_date) for a given month — compatible with SQLite and PostgreSQL."""
    _, last_day = calendar.monthrange(year, month)
    return date(year, month, 1), date(year, month, last_day)


def generate_spending_insights(user_id: int, db: Session, currency: str = "USD") -> List[InsightItem]:
    """
    Generates explainable, real-time AI spending suggestions and financial advice
    anchored to real calendar progress, user criteria, and active user currency.
    Universal PostgreSQL and SQLite compatibility.
    """
    insights: List[InsightItem] = []
    today = date.today()
    sym = CURRENCY_SYMBOLS.get((currency or "USD").upper(), f"{currency} ")

    # Real-time calendar metrics
    _, total_days_in_month = calendar.monthrange(today.year, today.month)
    days_elapsed = max(1, today.day)
    days_remaining = max(1, total_days_in_month - days_elapsed)
    month_progress_pct = (days_elapsed / total_days_in_month) * 100

    # Boundaries for current & previous month
    prev_month = today.month - 1 if today.month > 1 else 12
    prev_year = today.year if today.month > 1 else today.year - 1

    # 1. Total income and expenses this month — use date range for SQLite + PostgreSQL compatibility
    curr_start, curr_end = _month_range(today.year, today.month)
    prev_start, prev_end = _month_range(prev_year, prev_month)

    curr_expenses = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.transaction_date >= curr_start,
            Transaction.transaction_date <= curr_end,
        )
        .scalar()
        or 0.0
    )

    curr_income = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "income",
            Transaction.transaction_date >= curr_start,
            Transaction.transaction_date <= curr_end,
        )
        .scalar()
        or 0.0
    )

    prev_expenses = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.transaction_date >= prev_start,
            Transaction.transaction_date <= prev_end,
        )
        .scalar()
        or 0.0
    )

    # 2. Real-Time Budget Pacing & Safe Daily Allowance
    budgets = (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.month == today.month,
            Budget.year == today.year,
        )
        .all()
    )

    total_budget_limit = sum(b.amount for b in budgets) if budgets else 0.0

    if total_budget_limit > 0:
        budget_used_pct = (curr_expenses / total_budget_limit) * 100
        remaining_budget = max(0.0, total_budget_limit - curr_expenses)
        safe_daily_spend = remaining_budget / days_remaining

        if budget_used_pct > month_progress_pct + 15:
            insights.append(
                InsightItem(
                    id="pacing_ahead_warning",
                    type="warning",
                    title="High Spend Pacing Alert",
                    description=f"Day {days_elapsed} of {total_days_in_month} ({month_progress_pct:.0f}% of month): You have utilized {budget_used_pct:.1f}% of your monthly budget. Recommended cap: {sym}{safe_daily_spend:.2f}/day for the remaining {days_remaining} days.",
                    metric=f"{sym}{safe_daily_spend:.0f}/day cap",
                )
            )
        elif budget_used_pct < month_progress_pct - 10:
            insights.append(
                InsightItem(
                    id="pacing_on_track",
                    type="positive",
                    title="Disciplined Monthly Pacing",
                    description=f"Spending is tracking {abs(month_progress_pct - budget_used_pct):.0f}% below calendar pace. Available safe spend: {sym}{safe_daily_spend:.2f}/day for remaining {days_remaining} days.",
                    metric=f"{sym}{remaining_budget:,.0f} left",
                )
            )

    # 3. Savings Rate Benchmark
    if curr_income > 0:
        savings_amount = curr_income - curr_expenses
        savings_rate = (savings_amount / curr_income) * 100
        if savings_rate >= 20:
            insights.append(
                InsightItem(
                    id="savings_rate_healthy",
                    type="positive",
                    title="Healthy 20%+ Savings Margin",
                    description=f"Retaining {savings_rate:.1f}% of your earnings ({sym}{savings_amount:,.2f}) this month, surpassing the recommended 50/30/20 target in {currency}.",
                    metric=f"{savings_rate:.0f}% retained",
                )
            )
        elif savings_rate > 0:
            insights.append(
                InsightItem(
                    id="savings_rate_moderate",
                    type="neutral",
                    title="Moderate Monthly Net Margin",
                    description=f"Current savings rate is {savings_rate:.1f}%. Trimming discretionary expenses could boost retention toward 20% in {currency}.",
                    metric=f"{savings_rate:.0f}%",
                )
            )
        else:
            insights.append(
                InsightItem(
                    id="savings_rate_negative",
                    type="warning",
                    title="Deficit Cash Flow Warning",
                    description=f"Current month outflows ({sym}{curr_expenses:,.2f}) exceed logged income ({sym}{curr_income:,.2f}) by {sym}{abs(savings_amount):,.2f}.",
                    metric=f"-{sym}{abs(savings_amount):,.0f}",
                )
            )

    # 4. Top Category Concentration & Rebalancing Advice
    category_spends = (
        db.query(
            Category.name,
            func.sum(Transaction.amount).label("cat_total"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.transaction_date >= curr_start,
            Transaction.transaction_date <= curr_end,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )

    if category_spends and curr_expenses > 0:
        top_cat_name, top_cat_total = category_spends[0]
        cat_share = (top_cat_total / curr_expenses) * 100
        if cat_share > 35:
            insights.append(
                InsightItem(
                    id="top_category_concentration",
                    type="neutral",
                    title=f"Concentration: {top_cat_name}",
                    description=f"{top_cat_name} represents {cat_share:.1f}% ({sym}{top_cat_total:,.2f}) of your total expenses this month. Consider setting a target ceiling in {currency}.",
                    metric=f"{cat_share:.0f}% share",
                )
            )

    # 5. Month-over-Month Velocity Comparison
    if prev_expenses > 0 and curr_expenses > 0:
        # Scale current expense to full month projection for fair comparison
        projected_month_total = (curr_expenses / days_elapsed) * total_days_in_month
        pct_projected_change = ((projected_month_total - prev_expenses) / prev_expenses) * 100

        if pct_projected_change < -8:
            insights.append(
                InsightItem(
                    id="velocity_favorable",
                    type="positive",
                    title="Favorable Burn Velocity",
                    description=f"Projected month-end spending ({sym}{projected_month_total:,.0f}) is trending {abs(pct_projected_change):.1f}% lower than last month's total ({sym}{prev_expenses:,.0f}).",
                    metric=f"-{abs(pct_projected_change):.0f}% burn",
                )
            )
        elif pct_projected_change > 15:
            insights.append(
                InsightItem(
                    id="velocity_elevated",
                    type="warning",
                    title="Accelerated Expense Velocity",
                    description=f"At the current pace, month-end expenses are projected to reach {sym}{projected_month_total:,.0f} (+{pct_projected_change:.1f}% vs last month).",
                    metric=f"+{pct_projected_change:.0f}% pace",
                )
            )

    # 6. Real-time Daily Average Spend Metric
    avg_daily = curr_expenses / days_elapsed
    insights.append(
        InsightItem(
            id="daily_pace_realtime",
            type="tip",
            title=f"Real-Time Daily Spend Velocity ({currency})",
            description=f"Averaging {sym}{avg_daily:.2f}/day across {days_elapsed} days elapsed in {today.strftime('%B %Y')}.",
            metric=f"{sym}{avg_daily:.0f}/day",
        )
    )

    return insights

