from datetime import date, timedelta
from typing import Dict, List
import numpy as np
from sklearn.linear_model import Ridge
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Transaction


def calculate_expense_forecast(user_id: int, db: Session, projection_horizon: int = 3) -> Dict:
    """
    Computes historical monthly spending series and uses a recency-weighted Ridge Regression model
    to project a multi-month efficient spending trajectory with expanding confidence bounds.
    Universal PostgreSQL and SQLite compatibility.
    """
    # Fetch monthly expense totals using cross-platform extract
    results = (
        db.query(
            func.extract("year", Transaction.transaction_date).label("y"),
            func.extract("month", Transaction.transaction_date).label("m"),
            func.sum(Transaction.amount).label("total_expense"),
        )
        .filter(Transaction.user_id == user_id, Transaction.type == "expense")
        .group_by("y", "m")
        .order_by("y", "m")
        .all()
    )

    if not results or len(results) == 0:
        return {
            "next_month_estimate": 0.0,
            "lower_bound": 0.0,
            "upper_bound": 0.0,
            "confidence_level": "Preliminary",
            "historical_points": [],
            "projected_points": [],
        }

    months = [f"{int(r[0])}-{int(r[1]):02d}" for r in results]
    expenses = [float(r[2]) for r in results]

    historical_points = [
        {
            "month_label": m,
            "predicted_expense": round(exp, 2),
            "lower_bound": round(exp, 2),
            "upper_bound": round(exp, 2),
            "is_projected": False,
        }
        for m, exp in zip(months, expenses)
    ]

    last_month_str = months[-1]

    # Handle 1 data point: project flat with slight conservative growth
    if len(expenses) == 1:
        base = expenses[0]
        projected_points = []
        curr_m = last_month_str
        for i in range(1, projection_horizon + 1):
            curr_m = get_next_month_label(curr_m)
            variance = 0.08 * i
            projected_points.append(
                {
                    "month_label": curr_m,
                    "predicted_expense": round(base, 2),
                    "lower_bound": round(max(0.0, base * (1.0 - variance)), 2),
                    "upper_bound": round(base * (1.0 + variance), 2),
                    "is_projected": True,
                }
            )

        return {
            "next_month_estimate": round(base, 2),
            "lower_bound": round(base * 0.90, 2),
            "upper_bound": round(base * 1.10, 2),
            "confidence_level": "Preliminary",
            "historical_points": historical_points,
            "projected_points": projected_points,
        }

    # Recency-weighted regression
    n = len(expenses)
    X = np.arange(n).reshape(-1, 1)
    y = np.array(expenses)

    # Linearly increasing sample weights from 0.5 to 1.0
    sample_weights = np.linspace(0.5, 1.0, n)

    # Ridge regularizer prevents wild steep extrapolation
    model = Ridge(alpha=1.0)
    model.fit(X, y, sample_weight=sample_weights)

    predictions_history = model.predict(X)
    residuals = y - predictions_history
    std_residual = float(np.std(residuals)) if len(residuals) > 1 else float(y.mean() * 0.1)

    projected_points = []
    curr_m = last_month_str
    next_month_est = 0.0
    next_lower = 0.0
    next_upper = 0.0

    for step in range(1, projection_horizon + 1):
        idx = np.array([[n - 1 + step]])
        pred = float(model.predict(idx)[0])
        # Smooth floor
        pred = max(25.0, pred)

        # Standard error scales with sqrt(step) for realistic trajectory bounds
        margin = max(std_residual * 1.645 * np.sqrt(step), pred * (0.06 + 0.03 * step))
        lower = max(0.0, pred - margin)
        upper = pred + margin

        curr_m = get_next_month_label(curr_m)

        if step == 1:
            next_month_est = pred
            next_lower = lower
            next_upper = upper

        projected_points.append(
            {
                "month_label": curr_m,
                "predicted_expense": round(pred, 2),
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2),
                "is_projected": True,
            }
        )

    confidence = "High" if n >= 6 else ("Moderate" if n >= 3 else "Preliminary")

    return {
        "next_month_estimate": round(next_month_est, 2),
        "lower_bound": round(next_lower, 2),
        "upper_bound": round(next_upper, 2),
        "confidence_level": confidence,
        "historical_points": historical_points,
        "projected_points": projected_points,
    }


def get_next_month_label(current_month_str: str) -> str:
    """e.g. '2026-08' -> '2026-09'"""
    try:
        parts = current_month_str.split("-")
        year, month = int(parts[0]), int(parts[1])
        if month == 12:
            return f"{year + 1}-01"
        else:
            return f"{year}-{month + 1:02d}"
    except Exception:
        today = date.today()
        if today.month == 12:
            return f"{today.year + 1}-01"
        return f"{today.year}-{today.month + 1:02d}"

