import pytest
from app.ml.classifier import classifier
from app.ml.forecaster import get_next_month_label


def test_classifier_predictions():
    # Test food prediction
    pred_food = classifier.predict("Starbucks vanilla latte and muffin")
    assert pred_food["predicted_category"] == "Food & Dining"
    assert pred_food["confidence"] > 0.3

    # Test travel prediction
    pred_travel = classifier.predict("Uber trip to airport terminal")
    assert pred_travel["predicted_category"] == "Travel & Transport"
    assert pred_travel["confidence"] > 0.3

    # Test subscriptions
    pred_sub = classifier.predict("Netflix 4k monthly streaming subscription")
    assert pred_sub["predicted_category"] == "Subscriptions"

    # Test utilities
    pred_bill = classifier.predict("Electric and power utility statement bill")
    assert pred_bill["predicted_category"] == "Bills & Utilities"


def test_classifier_feedback_adaptation():
    # Test adaptation on a novel keyword
    query = "XYZ quantum keyboard accessory"
    before = classifier.predict(query)
    classifier.add_feedback_and_retrain(query, "Shopping")
    after = classifier.predict(query)
    assert after["predicted_category"] == "Shopping"


def test_next_month_label():
    assert get_next_month_label("2026-08") == "2026-09"
    assert get_next_month_label("2026-12") == "2027-01"
