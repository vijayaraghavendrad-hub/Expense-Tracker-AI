from datetime import date
import calendar
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from ..database import get_db
from ..models import Budget, Category, Transaction, User
from ..schemas import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetProgressResponse
from ..auth import get_current_user

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get("/progress", response_model=List[BudgetProgressResponse])
def get_budgets_progress(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    target_month = month or today.month
    target_year = year or today.year
    month_str = f"{target_year}-{target_month:02d}"

    budgets = (
        db.query(Budget)
        .filter(
            Budget.user_id == current_user.id,
            Budget.month == target_month,
            Budget.year == target_year,
        )
        .options(joinedload(Budget.category))
        .all()
    )

    _, month_last_day = calendar.monthrange(target_year, target_month)
    month_start = date(target_year, target_month, 1)
    month_end = date(target_year, target_month, month_last_day)

    results = []
    for b in budgets:

        spent = (
            db.query(func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.category_id == b.category_id,
                Transaction.type == "expense",
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= month_end,
            )
            .scalar()
            or 0.0
        )

        category = b.category
        category_name = category.name if category else "Unknown Category"
        category_color = category.color if category else "#6b7280"

        pct_used = (spent / b.amount) * 100 if b.amount > 0 else 0.0
        remaining = max(0.0, b.amount - spent)

        results.append(
            BudgetProgressResponse(
                id=b.id,
                category_id=b.category_id,
                category_name=category_name,
                category_color=category_color,
                budget_amount=round(b.amount, 2),
                spent_amount=round(spent, 2),
                remaining_amount=round(remaining, 2),
                percentage_used=round(pct_used, 1),
                is_exceeded=spent > b.amount,
                month=target_month,
                year=target_year,
            )
        )

    # Sort so exceeded or highest usage come first
    results.sort(key=lambda x: x.percentage_used, reverse=True)
    return results


@router.get("/", response_model=List[BudgetResponse])
def get_budgets(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Budget).filter(Budget.user_id == current_user.id)
    if month:
        query = query.filter(Budget.month == month)
    if year:
        query = query.filter(Budget.year == year)
    return query.all()


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify category exists (include system categories)
    from sqlalchemy import or_
    cat = (
        db.query(Category)
        .filter(
            Category.id == payload.category_id,
            or_(Category.user_id == current_user.id, Category.user_id.is_(None)),
        )
        .first()
    )
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category ID.")

    # Check if a budget already exists for this category/month/year
    existing = (
        db.query(Budget)
        .filter(
            Budget.user_id == current_user.id,
            Budget.category_id == payload.category_id,
            Budget.month == payload.month,
            Budget.year == payload.year,
        )
        .first()
    )
    if existing:
        # Update existing instead of erroring
        existing.amount = payload.amount
        db.commit()
        db.refresh(existing)
        return existing

    budget = Budget(
        user_id=current_user.id,
        category_id=payload.category_id,
        amount=payload.amount,
        month=payload.month,
        year=payload.year,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found.")

    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.user_id == current_user.id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found.")

    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted successfully"}
