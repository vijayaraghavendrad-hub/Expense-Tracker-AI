from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Category, Transaction, MLPrediction
from ..schemas import (
    CategorizeRequest,
    CategorizeResponse,
    MLFeedbackRequest,
    SpendingInsightsResponse,
    AnomalyItem,
    ForecastResponse,
)
from ..auth import get_current_user
from ..ml.classifier import classifier
from ..ml.anomaly import scan_user_anomalies
from ..ml.forecaster import calculate_expense_forecast
from ..ml.insights import generate_spending_insights

router = APIRouter(prefix="/ai", tags=["AI & Machine Learning"])


@router.post("/categorize", response_model=CategorizeResponse)
def categorize_expense(
    payload: CategorizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    FR8.1: Given free-text description, predicts expense category using TF-IDF + Logistic Regression.
    """
    user_classifier = classifier.get_user_classifier(current_user.id)
    prediction = user_classifier.predict(payload.description, amount=payload.amount)
    predicted_cat_name = prediction["predicted_category"]

    # Match with available categories in DB (user's or default)
    from sqlalchemy import or_
    available_cats = (
        db.query(Category)
        .filter(or_(Category.user_id == current_user.id, Category.user_id.is_(None)))
        .all()
    )

    matched_cat = None
    pred_lower = predicted_cat_name.lower()
    # Priority 1: exact match
    for cat in available_cats:
        if cat.name.lower() == pred_lower:
            matched_cat = cat
            break
    # Priority 2: prediction starts with category name or vice versa
    if not matched_cat:
        for cat in available_cats:
            c_lower = cat.name.lower()
            if pred_lower.startswith(c_lower) or c_lower.startswith(pred_lower):
                matched_cat = cat
                break
    # Priority 3: first word match
    if not matched_cat:
        pred_first = pred_lower.split()[0]
        for cat in available_cats:
            if cat.name.lower().split()[0] == pred_first:
                matched_cat = cat
                break

    category_id = matched_cat.id if matched_cat else None

    # Log prediction attempt
    log_entry = MLPrediction(
        user_id=current_user.id,
        description_text=payload.description.strip(),
        predicted_category=predicted_cat_name,
        confidence=prediction["confidence"],
    )
    db.add(log_entry)
    db.commit()

    return CategorizeResponse(
        predicted_category=predicted_cat_name,
        confidence=prediction["confidence"],
        category_id=category_id,
        top_candidates=prediction["top_candidates"],
    )


@router.post("/feedback")
def submit_ml_feedback(
    payload: MLFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    FR8.2 & FR8.3: Logs user override/corrections and adapts classifier weights.
    """
    # Verify transaction ownership if transaction_id is provided
    if payload.transaction_id is not None:
        tx = db.query(Transaction).filter(
            Transaction.id == payload.transaction_id,
            Transaction.user_id == current_user.id,
        ).first()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found.")

    prediction_record = MLPrediction(
        user_id=current_user.id,
        transaction_id=payload.transaction_id,
        description_text=payload.description.strip(),
        predicted_category=payload.predicted_category,
        confidence=payload.confidence or 0.0,
        was_corrected=(payload.predicted_category.lower() != payload.actual_category.lower()),
        actual_category=payload.actual_category,
    )
    db.add(prediction_record)
    db.commit()

    # Retrain classifier with user correction (per-user model)
    user_classifier = classifier.get_user_classifier(current_user.id)
    user_classifier.add_feedback_and_retrain(payload.description, payload.actual_category)

    return {
        "message": f"Feedback recorded. Model retrained on '{payload.description}' -> '{payload.actual_category}'."
    }


@router.get("/insights", response_model=SpendingInsightsResponse)
def get_insights(
    currency: str = "USD",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    FR9.1 & FR9.2: Generates plain-language explainable spending insights
    dynamically tracking the user's active currency.
    """
    effective_currency = currency or getattr(current_user, "currency", "USD") or "USD"
    insights_list = generate_spending_insights(current_user.id, db, currency=effective_currency)
    return SpendingInsightsResponse(insights=insights_list)


@router.get("/anomalies", response_model=List[AnomalyItem])
def get_anomalies(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    Returns flagged anomalous transactions for the user.
    """
    return scan_user_anomalies(current_user.id, db)


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """
    FR11.1 & FR11.2: Projects next month's estimated expense total with confidence interval.
    """
    forecast = calculate_expense_forecast(current_user.id, db)
    return forecast
