"""MNT-CORE — openKcloud 포털 코어 백엔드.

소유: IAM(사용자·역할)·메뉴·자원신청 워크플로우·마켓·감사 (PostgreSQL 유일 소유자).
자원의 실시간 상태는 저장하지 않는다 — IaaS/PaaS 모듈이 상위 시스템을 라이브 조회.

실행(로컬):
  pip install -r requirements.txt
  cp config.env.example config.env   # 값 수정
  uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .db import engine
from .routers import auth, codes, members, menus, ssh_keys, tickets

app = FastAPI(title="MNT-CORE", version="0.1.0")

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/healthz")
def healthz():
    """liveness/readiness — DB 연결까지 확인한다."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:  # noqa: BLE001 — 상태 보고 목적
        db_status = f"error: {type(e).__name__}"
    return {"service": settings.service_name, "status": "ok", "db": db_status}


app.include_router(menus.router, prefix=settings.api_prefix)
app.include_router(codes.router, prefix=settings.api_prefix)
app.include_router(ssh_keys.router, prefix=settings.api_prefix)
app.include_router(members.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(tickets.router, prefix=settings.api_prefix)
