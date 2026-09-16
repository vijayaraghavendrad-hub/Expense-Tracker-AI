import calendar
from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import RecurringExpense, Transaction, Category, User
from ..schemas import (
    RecurringExpenseCreate,
    RecurringExpenseUpdate,
    RecurringExpenseResponse,
)
from ..auth import get_current_user
from ..ml.anomaly import check_transaction_anomaly

router = APIRouter(prefix="/recurring", tags=["Recurring Expenses"])


def advance_next_date(current_date: date, frequency: str) -> date:
    freq = frequency.lower()
    if freq == "daily":
        return current_date + timedelta(days=1)
    elif freq == "weekly":
        return current_date + timedelta(weeks=1)
    elif freq == "yearly":
        try:
            return current_date.replace(year=current_date.year + 1)
        except ValueError:
            return current_date.replace(year=current_date.year + 1, day=28)
    else:  # monthly
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        _, last_day = calendar.monthrange(year, month)
        day = min(current_date.day, last_day)
        return date(year, month, day)


@router.get("/", response_model=List[RecurringExpenseResponse])
def get_recurring_expenses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    items = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.user_id == current_user.id)
        .order_by(RecurringExpense.next_date.asc())
        .all()
    )
    return items


@router.post("/", response_model=RecurringExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_expense(
    payload: RecurringExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.category_id:
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

    rec = RecurringExpense(
        user_id=current_user.id,
        category_id=payload.category_id,
        amount=payload.amount,
        frequency=payload.frequency,
        next_date=payload.next_date,
        description=payload.description.strip(),
        is_active=payload.is_active,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.put("/{recurring_id}", response_model=RecurringExpenseResponse)
def update_recurring_expense(
    recurring_id: int,
    payload: RecurringExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.id == recurring_id, RecurringExpense.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring expense not found.")

    if payload.category_id is not None:
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
        rec.category_id = payload.category_id
    if payload.amount is not None:
        rec.amount = payload.amount
    if payload.frequency is not None:
        rec.frequency = payload.frequency
    if payload.next_date is not None:
        rec.next_date = payload.next_date
    if payload.description is not None:
        rec.description = payload.description.strip()
    if payload.is_active is not None:
        rec.is_active = payload.is_active

    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{recurring_id}")
def delete_recurring_expense(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.id == recurring_id, RecurringExpense.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring expense not found.")

    db.delete(rec)
    db.commit()
    return {"message": "Recurring expense deleted successfully"}


@router.post("/process-due")
def process_due_recurring_expenses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Scans for active recurring expenses due on or before today,
    generates corresponding transaction entries, and advances next_date.
    """
    today = date.today()
    due_items = (
        db.query(RecurringExpense)
        .filter(
            RecurringExpense.user_id == current_user.id,
            RecurringExpense.is_active == True,
            RecurringExpense.next_date <= today,
        )
        .with_for_update()
        .all()
    )

    created_count = 0
    for item in due_items:
        # Check anomaly
        is_anomaly, reason, _ = check_transaction_anomaly(
            user_id=current_user.id,
            amount=item.amount,
            category_id=item.category_id,
            db=db,
        )

        tx = Transaction(
            user_id=current_user.id,
            amount=item.amount,
            type="expense",
            category_id=item.category_id,
            payment_method="Auto-Debit",
            description=f"{item.description} (Recurring)",
            transaction_date=item.next_date,
            is_anomaly=is_anomaly,
            anomaly_reason=reason,
        )
        db.add(tx)
        created_count += 1

        # Advance next_date
        item.next_date = advance_next_date(item.next_date, item.frequency)

    db.commit()
    return {
        "message": f"Processed {created_count} recurring items into transactions.",
        "processed_count": created_count,
    }
