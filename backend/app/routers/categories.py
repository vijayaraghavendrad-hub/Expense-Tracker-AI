from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Category, User, Transaction
from ..schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from ..auth import get_current_user

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=List[CategoryResponse])
def get_categories(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    from sqlalchemy import or_
    categories = (
        db.query(Category)
        .filter(
            or_(
                Category.user_id == current_user.id,
                Category.user_id.is_(None),
            )
        )
        .order_by(Category.type.desc(), Category.name.asc())
        .all()
    )
    return categories


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            Category.name.ilike(payload.name.strip()),
            Category.type == payload.type,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{payload.name}' already exists for {payload.type}.",
        )

    cat = Category(
        user_id=current_user.id,
        name=payload.name.strip(),
        type=payload.type,
        icon=payload.icon or "tag",
        color=payload.color or "#6b7280",
        is_default=False,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")

    if payload.name:
        cat.name = payload.name.strip()
    if payload.type:
        cat.type = payload.type
    if payload.icon:
        cat.icon = payload.icon
    if payload.color:
        cat.color = payload.color

    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")

    # Nullify transactions pointing to this category before deleting
    db.query(Transaction).filter(Transaction.category_id == category_id).update(
        {"category_id": None}
    )
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted successfully"}
