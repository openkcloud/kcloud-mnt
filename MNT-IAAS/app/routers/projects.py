"""IaaS 프로젝트 조회 — OpenStack Keystone 프로젝트를 MNT-IAAS가 중개한다.

로컬/외부에선 Keystone 카탈로그가 클러스터 내부 URL을 광고해 도달 불가하므로,
identity(프로젝트)는 진입 URL(os_auth_url)로 토큰 세션을 통해 직접 호출한다.

응답은 프론트 Tenant 형태로 맞춘다. 쿼터·멤버·사용량은 Keystone 범위 밖이라
0 placeholder; 추후 Nova/Cinder limits·role assignment 로 enrich.
"""
from fastapi import APIRouter, HTTPException

from ..config import settings
from ..openstack_client import get_conn

router = APIRouter(tags=["projects"])


@router.get("/projects")
def list_projects():
    try:
        conn = get_conn()
        url = settings.os_auth_url.rstrip("/") + "/projects"
        resp = conn.session.get(url, timeout=15)
        resp.raise_for_status()
        raw = resp.json().get("projects", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"OpenStack 프로젝트 조회 실패: {type(e).__name__}: {e}")

    items = [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "description": p.get("description") or "",
            "orgId": p.get("domain_id") or "",
            "enabled": p.get("enabled", True),
            # Keystone 범위 밖 — placeholder (추후 enrich)
            "quotaVcpu": 0, "quotaRamGb": 0, "quotaDiskTb": 0, "quotaAcc": 0,
            "usedVcpu": 0, "usedRamGb": 0, "usedDiskTb": 0, "usedAcc": 0,
            "members": 0,
            "createdAt": "",
        }
        for p in raw
    ]
    return {"items": items, "count": len(items)}
