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

def create_working_engine(url: str):
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL configurations
        kwargs["pool_pre_ping"] = True
        kwargs["pool_recycle"] = 300
        kwargs["pool_size"] = 3
        kwargs["max_overflow"] = 2
        kwargs["pool_timeout"] = 5
        kwargs["connect_args"] = {
            "connect_timeout": 5,
            "options": "-c search_path=public",
        }

    eng = create_engine(url, **kwargs)
    try:
        with eng.connect() as conn:
            pass
        return eng, url
    except Exception as err:
        if not url.startswith("sqlite"):
            print(f"Warning: Primary database connection failed ({err}). Falling back to local SQLite database.")
            sqlite_url = "sqlite:///./expense_tracker.db"
            eng = create_engine(sqlite_url, connect_args={"check_same_thread": False})
            return eng, sqlite_url
        raise

engine, ACTIVE_DATABASE_URL = create_working_engine(DATABASE_URL)

if ACTIVE_DATABASE_URL.startswith("sqlite"):
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

