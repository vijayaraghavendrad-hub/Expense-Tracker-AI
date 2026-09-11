from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Category
from ..schemas import UserCreate, UserLogin, UserResponse, Token, UserUpdate
from ..auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEFAULT_CATEGORIES = [
    # Expense
    {"name": "Food & Dining", "type": "expense", "icon": "utensils", "color": "#f97316"},
    {"name": "Travel & Transport", "type": "expense", "icon": "car", "color": "#06b6d4"},
    {"name": "Shopping", "type": "expense", "icon": "shopping-bag", "color": "#8b5cf6"},
    {"name": "Bills & Utilities", "type": "expense", "icon": "zap", "color": "#eab308"},
    {"name": "Entertainment", "type": "expense", "icon": "film", "color": "#ec4899"},
    {"name": "Education", "type": "expense", "icon": "book-open", "color": "#3b82f6"},
    {"name": "Health & Wellness", "type": "expense", "icon": "heart", "color": "#10b981"},
    {"name": "Rent & Housing", "type": "expense", "icon": "home", "color": "#6366f1"},
    {"name": "Subscriptions", "type": "expense", "icon": "calendar", "color": "#14b8a6"},
    {"name": "Other", "type": "expense", "icon": "tag", "color": "#71717a"},
    # Income
    {"name": "Salary", "type": "income", "icon": "briefcase", "color": "#10b981"},
    {"name": "Freelance", "type": "income", "icon": "laptop", "color": "#06b6d4"},
    {"name": "Investments", "type": "income", "icon": "trending-up", "color": "#8b5cf6"},
    {"name": "Other Income", "type": "income", "icon": "dollar-sign", "color": "#3b82f6"},
]


def initialize_user_categories(user_id: int, db: Session):
    existing = db.query(Category).filter(Category.user_id == user_id).first()
    if existing:
        return
    for item in DEFAULT_CATEGORIES:
        category = Category(
            user_id=user_id,
            name=item["name"],
            type=item["type"],
            icon=item["icon"],
            color=item["color"],
            is_default=True,
        )
        db.add(category)
    db.flush()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    try:
        user = User(
            name=payload.name,
            email=payload.email.lower(),
            password_hash=get_password_hash(payload.password),
        )
        db.add(user)
        db.flush()

        # Populate default categories for new user
        initialize_user_categories(user.id, db)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == payload.email.lower()).first()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    try:
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/demo-login", response_model=Token)
def demo_login(db: Session = Depends(get_db)):
    """Logs into the pre-configured Demo Account (creates & seeds if not exists)."""
    from ..seed import seed_demo_data

    demo_email = "demo@smartexpense.ai"
    try:
        user = db.query(User).filter(User.email == demo_email).first()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error. Please try again.",
        )

    if not user:
        try:
            user = User(
                name="Alex Morgan",
                email=demo_email,
                password_hash=get_password_hash("demopassword123"),
            )
            db.add(user)
            db.flush()
            initialize_user_categories(user.id, db)
            seed_demo_data(user.id, db)
            db.commit()
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create demo account. Please try again.",
            )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.currency is not None:
        current_user.currency = payload.currency.upper()
    if payload.email is not None and payload.email.lower() != current_user.email:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already taken.")
        current_user.email = payload.email.lower()

    db.commit()
    db.refresh(current_user)
    return current_user
