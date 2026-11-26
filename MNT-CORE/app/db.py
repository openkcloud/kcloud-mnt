"""SQLAlchemy 엔진·세션. DATABASE_URL 하나로 어디서든(로컬/파드) 동작한다."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # 끊어진 커넥션 자동 감지(파드 재시작·네트워크 단절 대비)
    pool_size=5,
    max_overflow=5,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI 의존성 — 요청 단위 세션."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
