import calendar
from datetime import date, timedelta
import random
from sqlalchemy.orm import Session
from .models import Transaction, Category, Budget, RecurringExpense


def seed_demo_data(user_id: int, db: Session):
    """
    Populates 6 months of rich, realistic transaction data, active budgets,
    recurring bills, and flagged anomalies for a stellar demo experience.
    """
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    cat_map = {c.name: c.id for c in categories}

    today = date.today()

    # Clear existing data for fresh seed
    db.query(Transaction).filter(Transaction.user_id == user_id).delete()
    db.query(Budget).filter(Budget.user_id == user_id).delete()
    db.query(RecurringExpense).filter(RecurringExpense.user_id == user_id).delete()

    # 1. Seed Budgets for current month
    budget_allocations = [
        ("Food & Dining", 650.0),
        ("Shopping", 400.0),
        ("Travel & Transport", 250.0),
        ("Entertainment", 200.0),
        ("Bills & Utilities", 300.0),
        ("Subscriptions", 120.0),
        ("Health & Wellness", 150.0),
    ]
    for name, amt in budget_allocations:
        if name in cat_map:
            b = Budget(
                user_id=user_id,
                category_id=cat_map[name],
                amount=amt,
                month=today.month,
                year=today.year,
            )
            db.add(b)

    # 2. Seed Recurring Expenses
    recurring_items = [
        ("Rent & Housing", 1450.0, "monthly", date(today.year, today.month, 1), "Downtown 1BR Apartment Rent"),
        ("Subscriptions", 22.99, "monthly", today + timedelta(days=5), "Netflix Premium 4K"),
        ("Subscriptions", 10.99, "monthly", today + timedelta(days=12), "Spotify Individual"),
        ("Bills & Utilities", 85.00, "monthly", today + timedelta(days=8), "Comcast High-Speed Internet"),
        ("Health & Wellness", 65.00, "monthly", today + timedelta(days=15), "Fitness Center Membership"),
    ]
    for cat_name, amt, freq, next_d, desc in recurring_items:
        if cat_name in cat_map:
            rec = RecurringExpense(
                user_id=user_id,
                category_id=cat_map[cat_name],
                amount=amt,
                frequency=freq,
                next_date=next_d,
                description=desc,
                is_active=True,
            )
            db.add(rec)

    # 3. Seed 6 Months of Historical Transactions
    # Each month gets 2 salary deposits ($3,200 each = $6,400 monthly income)
    # Plus regular realistic expense transactions
    sample_expenses = [
        ("Food & Dining", "Whole Foods Weekly Groceries", 112.40, "Credit Card"),
        ("Food & Dining", "Trader Joe's essentials and snacks", 68.20, "Debit Card"),
        ("Food & Dining", "Starbucks morning cold brew", 6.75, "UPI"),
        ("Food & Dining", "Chipotle burrito bowl and drink", 14.50, "Debit Card"),
        ("Food & Dining", "Dinner at Italian Osteria with wine", 78.00, "Credit Card"),
        ("Food & Dining", "Uber Eats sushi dinner", 38.50, "Credit Card"),
        ("Travel & Transport", "Shell gas fuel refill", 48.00, "Credit Card"),
        ("Travel & Transport", "Uber ride downtown meeting", 18.50, "Credit Card"),
        ("Travel & Transport", "City subway monthly card reload", 45.00, "Debit Card"),
        ("Shopping", "Amazon home organizer and charging cable", 34.99, "Credit Card"),
        ("Shopping", "Target casual wardrobe basics", 72.50, "Credit Card"),
        ("Shopping", "Nike running socks and gym shirt", 55.00, "Debit Card"),
        ("Bills & Utilities", "Electric and power utility statement", 92.30, "Bank Transfer"),
        ("Bills & Utilities", "Mobile unlimited 5G cellular bill", 60.00, "Auto-Debit"),
        ("Entertainment", "AMC IMAX movie tickets & popcorn", 32.00, "Credit Card"),
        ("Entertainment", "Steam Indie PC game purchase", 19.99, "Credit Card"),
        ("Health & Wellness", "CVS pharmacy vitamins & essentials", 24.50, "Debit Card"),
        ("Rent & Housing", "Monthly apartment lease payment", 1450.00, "Bank Transfer"),
        ("Subscriptions", "GitHub Copilot developer monthly", 10.00, "Credit Card"),
        ("Subscriptions", "iCloud 200GB storage plan", 2.99, "Credit Card"),
    ]

    for month_offset in range(5, -1, -1):
        # Calculate target month date
        m = today.month - month_offset
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        # Income: Bi-weekly Salary
        sal_date_1 = date(y, m, 5)
        sal_date_2 = date(y, m, 20)
        if sal_date_1 <= today:
            db.add(
                Transaction(
                    user_id=user_id,
                    amount=3200.0,
                    type="income",
                    category_id=cat_map.get("Salary"),
                    payment_method="Bank Transfer",
                    description="Bi-Weekly Payroll Salary Direct Deposit",
                    transaction_date=sal_date_1,
                    is_anomaly=False,
                )
            )
        if sal_date_2 <= today:
            db.add(
                Transaction(
                    user_id=user_id,
                    amount=3200.0,
                    type="income",
                    category_id=cat_map.get("Salary"),
                    payment_method="Bank Transfer",
                    description="Bi-Weekly Payroll Salary Direct Deposit",
                    transaction_date=sal_date_2,
                    is_anomaly=False,
                )
            )

        # In alternate months, add a small Freelance income
        if month_offset % 2 == 1:
            freelance_date = date(y, m, 14)
            if freelance_date <= today:
                db.add(
                    Transaction(
                        user_id=user_id,
                        amount=850.0,
                        type="income",
                        category_id=cat_map.get("Freelance"),
                        payment_method="Bank Transfer",
                        description="Freelance Frontend UI Contract Payment",
                        transaction_date=freelance_date,
                        is_anomaly=False,
                    )
                )

        # Expenses for this month
        _, actual_max_day = calendar.monthrange(y, m)
        max_day = actual_max_day
        if month_offset == 0:
            max_day = min(today.day, actual_max_day)

        # Add recurring rent
        rent_date = date(y, m, 1)
        if rent_date <= today:
            db.add(
                Transaction(
                    user_id=user_id,
                    amount=1450.0,
                    type="expense",
                    category_id=cat_map.get("Rent & Housing"),
                    payment_method="Bank Transfer",
                    description="Downtown 1BR Apartment Rent",
                    transaction_date=rent_date,
                    is_anomaly=False,
                )
            )

        # Distribute realistic transactions
        for cat_name, desc_text, base_amt, p_method in sample_expenses:
            if cat_name == "Rent & Housing":
                continue  # already added
            t_day = random.randint(2, max_day)
            t_date = date(y, m, t_day)
            if t_date > today:
                continue

            # slight realistic variance
            variance = random.uniform(0.9, 1.15)
            actual_amt = round(base_amt * variance, 2)

            db.add(
                Transaction(
                    user_id=user_id,
                    amount=actual_amt,
                    type="expense",
                    category_id=cat_map.get(cat_name),
                    payment_method=p_method,
                    description=desc_text,
                    transaction_date=t_date,
                    is_anomaly=False,
                )
            )

    # 4. Realistic higher-value purchases flagged as anomalies
    anom_date_1 = today - timedelta(days=4)
    db.add(
        Transaction(
            user_id=user_id,
            amount=385.00,
            type="expense",
            category_id=cat_map.get("Food & Dining"),
            payment_method="Credit Card",
            description="L'Artisan Omakase Tasting Menu & Wine (Anniversary)",
            transaction_date=anom_date_1,
            is_anomaly=True,
            anomaly_reason="$385.00 is 4.9x higher than your typical Food & Dining expense (median: $78.00)",
        )
    )

    anom_date_2 = today - timedelta(days=11)
    db.add(
        Transaction(
            user_id=user_id,
            amount=1199.00,
            type="expense",
            category_id=cat_map.get("Shopping"),
            payment_method="Credit Card",
            description="Apple Store Ultra HD Studio Monitor",
            transaction_date=anom_date_2,
            is_anomaly=True,
            anomaly_reason="$1199.00 significantly exceeds your normal Shopping spending limit (avg: $54.16)",
        )
    )

    db.commit()
