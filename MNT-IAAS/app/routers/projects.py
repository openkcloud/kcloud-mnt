"""IaaS 프로젝트 조회 — OpenStack Keystone 프로젝트 + Nova/Cinder 쿼터를 중개.

identity(프로젝트)는 진입 URL(os_auth_url)로 직접 질의(카탈로그 우회).
쿼터·사용량은 openstack_quota.get_project_quota (환경별 override/catalog 분기).
프론트 Tenant(flat) 형태로 정규화해 프로젝트 목록·신청 화면이 공통 사용.
"""
from fastapi import APIRouter, HTTPException

from ..config import settings
from ..openstack_client import get_conn
from ..openstack_quota import get_project_quota

router = APIRouter(tags=["projects"])


def _to_tenant(p: dict, quota: dict | None) -> dict:
    """Keystone 프로젝트(+선택적 쿼터)를 프론트 Tenant(flat)로 변환."""
    t = {
        "id": p.get("id"),
        "name": p.get("name"),
        "description": p.get("description") or "",
        "orgId": p.get("domain_id") or "",
        "enabled": p.get("enabled", True),
        # 쿼터·사용량 (없으면 0 placeholder)
        "quotaVcpu": 0, "quotaRamGb": 0, "quotaDiskTb": 0, "quotaAcc": 0,
        "usedVcpu": 0, "usedRamGb": 0, "usedDiskTb": 0, "usedAcc": 0,
        "members": 0,       # 추후 Keystone role assignment
        "createdAt": "",    # Keystone 프로젝트엔 생성일 없음
    }
    if quota:
        t["quotaVcpu"] = quota["vcpu"]["quota"]
        t["usedVcpu"] = quota["vcpu"]["used"]
        t["quotaRamGb"] = quota["ramGb"]["quota"]
        t["usedRamGb"] = quota["ramGb"]["used"]
        # Cinder 는 GB → 화면 Tenant 는 TB
        t["quotaDiskTb"] = round(quota["diskGb"]["quota"] / 1024, 2)
        t["usedDiskTb"] = round(quota["diskGb"]["used"] / 1024, 2)
        # 가속기(quotaAcc)는 Cyborg 연동 시 — 지금은 0
    return t


def _fetch_projects() -> list[dict]:
    conn = get_conn()
    url = settings.os_auth_url.rstrip("/") + "/projects"
    r = conn.session.get(url, timeout=15)
    r.raise_for_status()
    return r.json().get("projects", [])


@router.get("/projects")
def list_projects(detail: bool = False):
    """프로젝트 목록. detail=true 면 각 프로젝트 쿼터까지 합쳐 반환(N+1)."""
    try:
        raw = _fetch_projects()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"OpenStack 프로젝트 조회 실패: {type(e).__name__}: {e}")
    items = [_to_tenant(p, get_project_quota(p["id"]) if detail else None) for p in raw]
    return {"items": items, "count": len(items)}


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    """프로젝트 상세 + 쿼터·사용량."""
    try:
        raw = _fetch_projects()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"OpenStack 프로젝트 조회 실패: {type(e).__name__}: {e}")
    p = next((x for x in raw if x["id"] == project_id), None)
    if not p:
        raise HTTPException(404, f"프로젝트 없음: {project_id}")
    return _to_tenant(p, get_project_quota(project_id))
