import os
import sys
import time
import threading
from pathlib import Path
from fastapi import FastAPI, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .models import User
from .auth import get_current_user
from .seed import seed_demo_data
from .routers import (
    auth_router,
    transactions_router,
    categories_router,
    budgets_router,
    recurring_router,
    analytics_router,
    ai_router,
)

# Create database tables — wrapped so startup doesn't crash on transient DB errors
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create database tables on startup: {e}", file=sys.stderr)

app = FastAPI(
    title="Smart Expense Tracker API",
    description="AI-Powered Personal Finance Management System API",
    version="1.0.0",
)

# CORS configuration — restrict in production
cors_origins = os.getenv("CORS_ORIGINS", "")
if cors_origins:
    ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
else:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(budgets_router, prefix="/api")
app.include_router(recurring_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(ai_router, prefix="/api")

# System Lifecycle & Auto-Shutdown state
last_heartbeat = time.time()
auto_shutdown_enabled = os.getenv("ENABLE_AUTO_SHUTDOWN", "0") == "1"


def do_shutdown():
    time.sleep(0.5)
    print("Initiating clean shutdown of Smart Expense Tracker...")
    sys.exit(0)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Smart Expense Tracker Backend", "version": "1.0.0"}


@app.post("/api/system/heartbeat")
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return {"status": "alive", "timestamp": last_heartbeat}


@app.post("/api/system/leave")
def client_leave():
    return {"status": "noted"}


@app.post("/api/system/shutdown")
def trigger_shutdown(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    background_tasks.add_task(do_shutdown)
    return {"message": "Server shutting down..."}


@app.post("/api/demo/seed")
def reload_sample_data(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Refreshes the user's data with realistic demo data."""
    seed_demo_data(current_user.id, db)
    return {"message": "Demo data successfully seeded with 6 months of historical transactions and analytics."}


# Watchdog thread for auto-shutdown when browser window is closed
def auto_shutdown_watchdog():
    # Allow 40 seconds initial window for browser to open and load
    time.sleep(40)
    while True:
        time.sleep(4)
        if auto_shutdown_enabled:
            idle_seconds = time.time() - last_heartbeat
            if idle_seconds > 12:
                print(f"No active browser tabs for {int(idle_seconds)}s. Auto-stopping server.")
                sys.exit(0)


if auto_shutdown_enabled:
    watchdog_thread = threading.Thread(target=auto_shutdown_watchdog, daemon=True)
    watchdog_thread.start()

# Mount frontend/dist if it exists so app can run fully on a single port (8000)
project_root = Path(__file__).resolve().parent.parent.parent
dist_dir = project_root / "frontend" / "dist"
assets_dir = dist_dir / "assets"

if dist_dir.exists() and (dist_dir / "index.html").exists():
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": "Not Found"})
        target_file = dist_dir / full_path
        if full_path and target_file.exists() and not target_file.is_dir():
            return FileResponse(str(target_file))
        return FileResponse(str(dist_dir / "index.html"))
