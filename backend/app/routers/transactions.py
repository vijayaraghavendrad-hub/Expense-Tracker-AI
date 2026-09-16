import csv
import io
import math
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, asc, func
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import Transaction, Category, User
from ..schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionListResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("/", response_model=TransactionListResponse)
def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    is_anomaly: Optional[bool] = None,
    sort_by: str = Query("date", pattern="^(date|amount)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id).options(joinedload(Transaction.category))

    if search and search.strip():
        escaped = search.strip().replace("%", "\\%").replace("_", "\\_")
        query = query.filter(Transaction.description.ilike(f"%{escaped}%", escape="\\"))
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if payment_method:
        query = query.filter(Transaction.payment_method == payment_method)
    if type:
        query = query.filter(Transaction.type == type)
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)
    if is_anomaly is not None:
        query = query.filter(Transaction.is_anomaly == is_anomaly)

    # Sorting
    if sort_by == "amount":
        order_col = Transaction.amount.desc() if sort_dir == "desc" else Transaction.amount.asc()
    else:
        order_col = (
            Transaction.transaction_date.desc()
            if sort_dir == "desc"
            else Transaction.transaction_date.asc()
        )

    # Secondary order by id
    query = query.order_by(order_col, Transaction.id.desc())

    # Count without joinedload to avoid inflated counts
    count_query = db.query(func.count(Transaction.id)).filter(Transaction.user_id == current_user.id)
    if search and search.strip():
        escaped = search.strip().replace("%", "\\%").replace("_", "\\_")
        count_query = count_query.filter(Transaction.description.ilike(f"%{escaped}%", escape="\\"))
    if category_id:
        count_query = count_query.filter(Transaction.category_id == category_id)
    if payment_method:
        count_query = count_query.filter(Transaction.payment_method == payment_method)
    if type:
        count_query = count_query.filter(Transaction.type == type)
    if start_date:
        count_query = count_query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        count_query = count_query.filter(Transaction.transaction_date <= end_date)
    if is_anomaly is not None:
        count_query = count_query.filter(Transaction.is_anomaly == is_anomaly)
    total = count_query.scalar() or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return TransactionListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify category ownership or system category
    if payload.category_id:
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

    # Anomaly suggestion removed in favor of accurate AI spending advisory
    is_anomaly = False
    anomaly_reason = None

    tx = Transaction(
        user_id=current_user.id,
        amount=payload.amount,
        type=payload.type,
        category_id=payload.category_id,
        payment_method=payload.payment_method or "Debit Card",
        currency=payload.currency or "USD",
        description=payload.description.strip(),
        transaction_date=payload.transaction_date,
        is_anomaly=is_anomaly,
        anomaly_reason=anomaly_reason,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.get("/export/csv")
def export_transactions_csv(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    type: Optional[str] = None,
    currency: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if search and search.strip():
        escaped = search.strip().replace("%", "\\%").replace("_", "\\_")
        query = query.filter(Transaction.description.ilike(f"%{escaped}%", escape="\\"))
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if payment_method:
        query = query.filter(Transaction.payment_method == payment_method)
    if type:
        query = query.filter(Transaction.type == type)
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    # Limit CSV export to 10000 rows to prevent memory exhaustion
    transactions = query.options(joinedload(Transaction.category)).order_by(Transaction.transaction_date.desc()).limit(10000).all()
    chosen_currency = currency or getattr(current_user, "currency", "USD") or "USD"

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Date",
            "Type",
            "Category",
            "Description",
            f"Amount ({chosen_currency})",
            "Currency",
            "Payment Method",
        ]
    )

    for tx in transactions:
        cat_name = tx.category.name if tx.category else "Uncategorized"
        tx_currency = tx.currency or chosen_currency
        writer.writerow(
            [
                tx.id,
                tx.transaction_date.isoformat(),
                tx.type,
                cat_name,
                tx.description,
                f"{tx.amount:.2f}",
                tx_currency,
                tx.payment_method or "Other",
            ]
        )

    csv_data = output.getvalue()
    today_str = date.today().isoformat()
    return Response(
        content=csv_data.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=transactions_ledger_{today_str}.csv",
        },
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return tx


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if payload.amount is not None:
        tx.amount = payload.amount
    if payload.type is not None:
        tx.type = payload.type
    if payload.category_id is not None:
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
        tx.category_id = payload.category_id
    if payload.payment_method is not None:
        tx.payment_method = payload.payment_method
    if payload.currency is not None:
        tx.currency = payload.currency
    if payload.description is not None:
        tx.description = payload.description.strip()
    if payload.transaction_date is not None:
        tx.transaction_date = payload.transaction_date

    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted successfully"}
