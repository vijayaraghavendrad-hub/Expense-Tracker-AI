from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Transaction, Category, User
from ..schemas import (
    AnalyticsSummaryResponse,
    MonthlyTrendItem,
    CategorySpendItem,
    DailyExpenseItem,
)
from ..auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_period_dates(period: str, start_date: Optional[date] = None, end_date: Optional[date] = None):
    today = date.today()
    if start_date and end_date:
        return start_date, end_date

    p = (period or "month").lower()
    if p == "week":
        start = today - timedelta(days=today.weekday())  # Monday of current week
        end = today
    elif p == "year":
        start = date(today.year, 1, 1)
        end = today
    elif p == "all":
        start = date(2000, 1, 1)
        end = today
    else:  # "month" default
        start = date(today.year, today.month, 1)
        end = today

    return start, end


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    period: str = Query("month", pattern="^(week|month|year|all|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, end = get_period_dates(period, start_date, end_date)

    # Base queries within period
    base_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start,
        Transaction.transaction_date <= end,
    )

    total_income = (
        base_query.filter(Transaction.type == "income")
        .with_entities(func.sum(Transaction.amount))
        .scalar()
        or 0.0
    )

    total_expenses = (
        base_query.filter(Transaction.type == "expense")
        .with_entities(func.sum(Transaction.amount))
        .scalar()
        or 0.0
    )

    total_balance = total_income - total_expenses
    savings_rate = ((total_income - total_expenses) / total_income * 100) if total_income > 0 else 0.0

    tx_count = base_query.count()

    # Average daily spend
    day_diff = max(1, (end - start).days + 1)
    avg_daily_spend = total_expenses / day_diff

    # Top spending category
    top_cat = (
        db.query(Category.name, func.sum(Transaction.amount).label("cat_total"))
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .first()
    )

    top_cat_name = top_cat[0] if top_cat else None
    top_cat_amt = float(top_cat[1]) if top_cat else 0.0

    # Highest spending day
    highest_day = (
        db.query(Transaction.transaction_date, func.sum(Transaction.amount).label("day_total"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by(Transaction.transaction_date)
        .order_by(func.sum(Transaction.amount).desc())
        .first()
    )

    highest_day_str = highest_day[0].strftime("%b %d, %Y") if highest_day else None
    highest_day_amt = float(highest_day[1]) if highest_day else 0.0

    # Month over month expense growth using database-agnostic year/month extract
    today = date.today()
    prev_month = today.month - 1 if today.month > 1 else 12
    prev_year = today.year if today.month > 1 else today.year - 1

    curr_month_exp = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            func.extract("year", Transaction.transaction_date) == today.year,
            func.extract("month", Transaction.transaction_date) == today.month,
        )
        .scalar()
        or 0.0
    )

    prev_month_exp = (
        db.query(func.sum(Transaction.amount))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            func.extract("year", Transaction.transaction_date) == prev_year,
            func.extract("month", Transaction.transaction_date) == prev_month,
        )
        .scalar()
        or 0.0
    )

    mom_growth = None
    if prev_month_exp > 0:
        mom_growth = round(((curr_month_exp - prev_month_exp) / prev_month_exp) * 100, 1)

    return AnalyticsSummaryResponse(
        total_balance=round(total_balance, 2),
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        savings_rate=round(savings_rate, 1),
        avg_daily_spend=round(avg_daily_spend, 2),
        top_category=top_cat_name,
        top_category_amount=round(top_cat_amt, 2),
        highest_spend_day=highest_day_str,
        highest_spend_day_amount=round(highest_day_amt, 2),
        transaction_count=tx_count,
        mom_expense_growth_rate=mom_growth,
    )


@router.get("/monthly", response_model=List[MonthlyTrendItem])
def get_monthly_trends(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch distinct months sorted ascending using extract for universal PostgreSQL & SQLite support
    inc_query = (
        db.query(
            func.extract("year", Transaction.transaction_date).label("y"),
            func.extract("month", Transaction.transaction_date).label("m"),
            func.sum(Transaction.amount),
        )
        .filter(Transaction.user_id == current_user.id, Transaction.type == "income")
        .group_by("y", "m")
        .all()
    )
    raw_income = {f"{int(r[0])}-{int(r[1]):02d}": float(r[2]) for r in inc_query}

    exp_query = (
        db.query(
            func.extract("year", Transaction.transaction_date).label("y"),
            func.extract("month", Transaction.transaction_date).label("m"),
            func.sum(Transaction.amount),
        )
        .filter(Transaction.user_id == current_user.id, Transaction.type == "expense")
        .group_by("y", "m")
        .all()
    )
    raw_expense = {f"{int(r[0])}-{int(r[1]):02d}": float(r[2]) for r in exp_query}

    all_months = sorted(list(set(raw_income.keys()) | set(raw_expense.keys())))
    # Keep last N months
    selected_months = all_months[-months:] if len(all_months) > months else all_months

    trends: List[MonthlyTrendItem] = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    for m in selected_months:
        inc = float(raw_income.get(m, 0.0))
        exp = float(raw_expense.get(m, 0.0))
        sav = inc - exp
        sav_rate = (sav / inc * 100) if inc > 0 else 0.0

        parts = m.split("-")
        m_num = int(parts[1])
        m_label = f"{month_names[m_num - 1]} '{parts[0][-2:]}"

        trends.append(
            MonthlyTrendItem(
                month=m,
                month_name=m_label,
                income=round(inc, 2),
                expenses=round(exp, 2),
                savings=round(sav, 2),
                savings_rate=round(sav_rate, 1),
            )
        )

    return trends


@router.get("/trajectory", response_model=List[MonthlyTrendItem])
def get_income_expense_trajectory(
    period: str = Query("month", pattern="^(week|month|year|all|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns Income vs. Expense cash flow trajectory synchronized with the
    timeframe selected in the Per-Day Expense Trackdown (daily for week/month, monthly for year/all).
    """
    start, end = get_period_dates(period, start_date, end_date)
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    if period in ("week", "month", "custom") and (end - start).days <= 62:
        # Day-by-day cash flow trajectory matching the daily trackdown
        inc_res = (
            db.query(
                Transaction.transaction_date,
                func.sum(Transaction.amount),
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "income",
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
            .group_by(Transaction.transaction_date)
            .all()
        )
        inc_map = {r[0]: float(r[1]) for r in inc_res}

        exp_res = (
            db.query(
                Transaction.transaction_date,
                func.sum(Transaction.amount),
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "expense",
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
            .group_by(Transaction.transaction_date)
            .all()
        )
        exp_map = {r[0]: float(r[1]) for r in exp_res}

        items: List[MonthlyTrendItem] = []
        curr = start
        while curr <= end:
            inc = inc_map.get(curr, 0.0)
            exp = exp_map.get(curr, 0.0)
            sav = inc - exp
            sav_rate = (sav / inc * 100) if inc > 0 else 0.0
            label = curr.strftime("%a %d") if period == "week" else curr.strftime("%b %d")

            items.append(
                MonthlyTrendItem(
                    month=curr.isoformat(),
                    month_name=label,
                    income=round(inc, 2),
                    expenses=round(exp, 2),
                    savings=round(sav, 2),
                    savings_rate=round(sav_rate, 1),
                )
            )
            curr += timedelta(days=1)
        return items
    else:
        # Monthly cash flow trajectory for year/all
        inc_query = (
            db.query(
                func.extract("year", Transaction.transaction_date).label("y"),
                func.extract("month", Transaction.transaction_date).label("m"),
                func.sum(Transaction.amount),
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "income",
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
            .group_by("y", "m")
            .all()
        )
        raw_income = {f"{int(r[0])}-{int(r[1]):02d}": float(r[2]) for r in inc_query}

        exp_query = (
            db.query(
                func.extract("year", Transaction.transaction_date).label("y"),
                func.extract("month", Transaction.transaction_date).label("m"),
                func.sum(Transaction.amount),
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.type == "expense",
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
            .group_by("y", "m")
            .all()
        )
        raw_expense = {f"{int(r[0])}-{int(r[1]):02d}": float(r[2]) for r in exp_query}

        months_in_range = []
        c_year, c_month = start.year, start.month
        while (c_year < end.year) or (c_year == end.year and c_month <= end.month):
            months_in_range.append(f"{c_year}-{c_month:02d}")
            if c_month == 12:
                c_year += 1
                c_month = 1
            else:
                c_month += 1

        items = []
        for m in months_in_range:
            inc = float(raw_income.get(m, 0.0))
            exp = float(raw_expense.get(m, 0.0))
            sav = inc - exp
            sav_rate = (sav / inc * 100) if inc > 0 else 0.0
            parts = m.split("-")
            m_num = int(parts[1])
            m_label = month_names[m_num - 1] if period == "year" else f"{month_names[m_num - 1]} '{parts[0][-2:]}"

            items.append(
                MonthlyTrendItem(
                    month=m,
                    month_name=m_label,
                    income=round(inc, 2),
                    expenses=round(exp, 2),
                    savings=round(sav, 2),
                    savings_rate=round(sav_rate, 1),
                )
            )
        return items


@router.get("/daily", response_model=List[DailyExpenseItem])
def get_daily_expenses(
    period: str = Query("month", pattern="^(week|month|year|all|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns day-by-day expense trackdown for the financial overview."""
    start, end = get_period_dates(period, start_date, end_date)

    # Fetch daily aggregated expenses
    daily_results = (
        db.query(
            Transaction.transaction_date,
            func.sum(Transaction.amount).label("daily_total"),
            func.count(Transaction.id).label("tx_count"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by(Transaction.transaction_date)
        .order_by(Transaction.transaction_date.asc())
        .all()
    )

    day_map = {
        r[0]: {"total": float(r[1]), "count": int(r[2])}
        for r in daily_results
    }

    # Also find the highest transaction for each day
    top_tx_query = (
        db.query(Transaction.transaction_date, Transaction.description, Transaction.amount)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .order_by(Transaction.transaction_date.asc(), Transaction.amount.desc())
        .all()
    )

    top_desc_map = {}
    for d, desc, _ in top_tx_query:
        if d not in top_desc_map:
            top_desc_map[d] = desc

    # Total days and average
    total_spent = sum(v["total"] for v in day_map.values())
    day_diff = max(1, (end - start).days + 1)
    avg_per_day = total_spent / day_diff if day_diff > 0 else 0.0

    items: List[DailyExpenseItem] = []
    curr = start
    while curr <= end:
        info = day_map.get(curr, {"total": 0.0, "count": 0})
        day_total = info["total"]
        items.append(
            DailyExpenseItem(
                date=curr.isoformat(),
                day_name=curr.strftime("%a"),
                day_number=curr.day,
                total_expense=round(day_total, 2),
                transaction_count=info["count"],
                top_transaction=top_desc_map.get(curr),
                is_above_average=day_total > avg_per_day if day_total > 0 else False,
            )
        )
        curr += timedelta(days=1)

    return items


@router.get("/categories", response_model=List[CategorySpendItem])
def get_category_breakdown(
    period: str = Query("month", pattern="^(week|month|year|all|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, end = get_period_dates(period, start_date, end_date)

    query_results = (
        db.query(
            Category.id,
            Category.name,
            Category.color,
            Category.icon,
            func.sum(Transaction.amount).label("total_amount"),
            func.count(Transaction.id).label("tx_count"),
            func.max(Transaction.amount).label("max_amount"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by(Category.id, Category.name, Category.color, Category.icon)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )

    grand_total = sum(float(r[4]) for r in query_results) or 1.0

    items: List[CategorySpendItem] = []
    for row in query_results:
        amt = float(row[4])
        pct = (amt / grand_total) * 100
        tx_count = int(row[5])
        avg_amt = (amt / tx_count) if tx_count > 0 else 0.0
        max_amt = float(row[6]) if row[6] is not None else 0.0

        items.append(
            CategorySpendItem(
                category_id=row[0],
                category_name=row[1],
                color=row[2] or "#6b7280",
                icon=row[3] or "tag",
                total_amount=round(amt, 2),
                percentage=round(pct, 1),
                transaction_count=tx_count,
                avg_transaction_amount=round(avg_amt, 2),
                max_transaction_amount=round(max_amt, 2),
            )
        )

    return items

