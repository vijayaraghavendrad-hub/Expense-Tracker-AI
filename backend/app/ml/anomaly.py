from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import Transaction, Category


def check_transaction_anomaly(
    user_id: int,
    amount: float,
    category_id: Optional[int],
    db: Session,
    exclude_transaction_id: Optional[int] = None,
) -> Tuple[bool, Optional[str], float]:
    """
    Evaluates whether a transaction is an anomaly compared to past spending in the same category.
    Returns: (is_anomaly, reason, anomaly_score)
    """
    if not category_id or amount <= 0:
        return False, None, 0.0

    category = db.query(Category).filter(Category.id == category_id).first()
    category_name = category.name if category else "this category"

    query = db.query(Transaction.amount).filter(
        Transaction.user_id == user_id,
        Transaction.category_id == category_id,
        Transaction.type == "expense",
    )
    if exclude_transaction_id:
        query = query.filter(Transaction.id != exclude_transaction_id)

    amounts = [row[0] for row in query.all()]

    # If there are fewer than 4 historical transactions, apply a simple heuristic relative to typical category norms
    if len(amounts) < 4:
        # High absolute threshold fallback
        if amount > 1500:
            return True, f"${amount:.2f} is unusually high for initial transactions in {category_name}", 2.5
        return False, None, 0.0

    import numpy as np
    amounts_arr = np.array(amounts, dtype=float)
    q25, q50, q75 = np.percentile(amounts_arr, [25, 50, 75])
    iqr = q75 - q25
    mean = np.mean(amounts_arr)
    std = np.std(amounts_arr)

    # Anomaly checks:
    # 1. IQR extreme outlier: amount > Q75 + 2.5 * IQR (if IQR > 0)
    # 2. Z-Score outlier: (amount - mean) / std > 2.8 (if std > 0)
    # 3. Median multiplier: amount > 3.5 * median and amount > mean + 50
    iqr_threshold = q75 + (2.5 * iqr) if iqr > 5 else (q50 * 3.5)
    z_score = (amount - mean) / std if std > 1.0 else 0.0

    is_anomaly = False
    reason = None
    score = 0.0

    if z_score >= 2.8 and amount > q50 * 2.0:
        is_anomaly = True
        score = float(round(z_score, 2))
        reason = f"${amount:.2f} is {amount / (q50 or 1.0):.1f}x higher than your typical {category_name} expense (median: ${q50:.2f})"
    elif amount > iqr_threshold and amount > mean * 2.0:
        is_anomaly = True
        score = float(round((amount - q50) / (iqr if iqr > 0 else q50), 2))
        reason = f"${amount:.2f} significantly exceeds your normal {category_name} spending limit (avg: ${mean:.2f})"

    return is_anomaly, reason, score


def scan_user_anomalies(user_id: int, db: Session) -> List[dict]:
    """
    Scans all past transactions for a user and flags anomalies.
    """
    from sqlalchemy.orm import joinedload
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.type == "expense")
        .options(joinedload(Transaction.category))
        .order_by(Transaction.transaction_date.desc())
        .all()
    )

    anomalies = []
    for tx in transactions:
        if tx.is_anomaly:
            category_name = tx.category.name if tx.category else "Uncategorized"
            anomalies.append(
                {
                    "transaction_id": tx.id,
                    "description": tx.description,
                    "amount": tx.amount,
                    "category_name": category_name,
                    "transaction_date": tx.transaction_date,
                    "reason": tx.anomaly_reason or "Unusually high spending pattern detected",
                    "score": 3.0,
                }
            )

    return anomalies
