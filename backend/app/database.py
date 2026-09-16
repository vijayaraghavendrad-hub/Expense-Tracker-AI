import os
from pathlib import Path
from sqlalchemy import create_engine, event
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
                    v = v.strip().strip("'\"")
                    os.environ.setdefault(k.strip(), v)
    except Exception as e:
        print(f"Notice: Could not load .env file: {e}")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expense_tracker.db")

engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Render PostgreSQL (or any managed PostgreSQL):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 3
    engine_kwargs["max_overflow"] = 2
    engine_kwargs["pool_timeout"] = 10
    engine_kwargs["connect_args"] = {
        "connect_timeout": 10,
        "options": "-c search_path=public",
    }

engine = create_engine(DATABASE_URL, **engine_kwargs)

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

