from .auth import router as auth_router
from .transactions import router as transactions_router
from .categories import router as categories_router
from .budgets import router as budgets_router
from .recurring import router as recurring_router
from .analytics import router as analytics_router
from .ai import router as ai_router

__all__ = [
    "auth_router",
    "transactions_router",
    "categories_router",
    "budgets_router",
    "recurring_router",
    "analytics_router",
    "ai_router",
]
