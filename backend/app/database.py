import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env if present
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except Exception as e:
        print(f"Notice: Could not load .env file: {e}")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expense_tracker.db")

engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Supabase Transaction-Mode Pooler (port 6543):
    # - Supports many concurrent clients (no session-mode 15-client cap)
    # - Does NOT support prepared statements → use NullPool or small pool
    # - Keep pool small: Supabase free tier allows ~60 server connections total
    engine_kwargs["pool_pre_ping"] = True      # detect stale connections
    engine_kwargs["pool_recycle"] = 300        # recycle every 5 min
    engine_kwargs["pool_size"] = 3             # keep only 3 persistent conns
    engine_kwargs["max_overflow"] = 2          # allow 2 burst connections
    engine_kwargs["pool_timeout"] = 10         # fail fast if no conn available
    engine_kwargs["connect_args"] = {
        "connect_timeout": 10,
        "options": "-c search_path=public",
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

