"""MNT-IAAS — OpenStack(IaaS) 중개 백엔드.

IaaS 관련 OpenStack 호출은 전부 이 모듈에서. 프론트는 MNT-IAAS만 호출한다.
실행(로컬): uvicorn app.main:app --reload --port 8001
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .openstack_client import get_conn
from .routers import projects

app = FastAPI(title="MNT-IAAS", version="0.1.0")

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
    """liveness/readiness — OpenStack(Keystone) 인증까지 확인."""
    try:
        get_conn().identity.get_token()
        os_status = "ok"
    except Exception as e:  # noqa: BLE001 — 상태 보고 목적
        os_status = f"error: {type(e).__name__}"
    return {"service": settings.service_name, "status": "ok", "openstack": os_status}


app.include_router(projects.router, prefix=settings.api_prefix)
