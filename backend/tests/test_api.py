import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_demo_login_and_data_flow():
    # 1. Demo Login
    res = client.post("/api/auth/demo-login")
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Profile
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "demo@smartexpense.ai"

    # 3. Get Categories
    cats_res = client.get("/api/categories/", headers=headers)
    assert cats_res.status_code == 200
    cats = cats_res.json()
    assert len(cats) > 0

    # 4. Get Transactions (pre-seeded with demo data)
    tx_res = client.get("/api/transactions/", headers=headers)
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    assert tx_data["total"] > 0
    assert len(tx_data["items"]) > 0

    # 5. Test AI Categorization endpoint
    cat_res = client.post(
        "/api/ai/categorize",
        json={"description": "Whole foods organic apples and milk"},
        headers=headers,
    )
    assert cat_res.status_code == 200
    assert cat_res.json()["predicted_category"] == "Food & Dining"

    # 6. Test AI Insights
    insights_res = client.get("/api/ai/insights", headers=headers)
    assert insights_res.status_code == 200
    insights = insights_res.json()["insights"]
    assert len(insights) > 0

    # 7. Test AI Forecast
    forecast_res = client.get("/api/ai/forecast", headers=headers)
    assert forecast_res.status_code == 200
    forecast_data = forecast_res.json()
    assert forecast_data["next_month_estimate"] > 0

    # 8. Test Analytics Summary
    summary_res = client.get("/api/analytics/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_balance" in summary
    assert "total_expenses" in summary

    # 9. Test Budget Progress
    budget_res = client.get("/api/budgets/progress", headers=headers)
    assert budget_res.status_code == 200
    assert isinstance(budget_res.json(), list)
