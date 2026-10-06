"""IaaS 이미지 — OpenStack Glance 중개. 라이브 조회(포털 DB 캐시 없음 = 카탈로그 동기화 불필요).

환경독립: override=template.format(service="glance")+"/v2", catalog=service_type="image".
"""
import json as _json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..openstack_client import get_conn

router = APIRouter(tags=["images"])

_GB = 1024 ** 3


def _glance_req(method: str, path: str, *, params=None, data=None, headers=None):
    conn = get_conn()
    if settings.os_endpoint_mode == "catalog":
        r = conn.session.request(
            path, method, params=params, data=data, headers=headers, raise_exc=False,
            endpoint_filter={"service_type": "image", "interface": settings.os_interface}, timeout=20,
        )
    else:  # override
        base = settings.os_endpoint_template.format(service="glance") + "/v2"
        r = conn.session.request(f"{base}{path}", method, params=params, data=data, headers=headers, raise_exc=False, timeout=20)
    if not r.ok:
        raise RuntimeError((r.text or f"HTTP {r.status_code}")[:300])
    return r


def _to_image(i: dict) -> dict:
    return {
        "id": i["id"],
        "name": i.get("name") or i["id"],
        "tenantId": i.get("owner") or "",
        "os": i.get("os_distro") or "",
        "diskFormat": i.get("disk_format") or "",
        "containerFormat": i.get("container_format") or "",
        "sizeGb": round((i.get("size") or 0) / _GB, 2),
        "visibility": i.get("visibility") or "",
        "status": i.get("status") or "",
        "protected": bool(i.get("protected")),
        "minDisk": i.get("min_disk", 0),
        "minRam": i.get("min_ram", 0),
        "createdAt": i.get("created_at") or "",
    }


@router.get("/images")
def list_images():
    try:
        d = _glance_req("GET", "/images", params={"limit": 200}).json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 조회 실패: {e}")
    items = [_to_image(i) for i in d.get("images", [])]
    return {"items": items, "count": len(items)}


@router.get("/images/{image_id}")
def get_image(image_id: str):
    try:
        i = _glance_req("GET", f"/images/{image_id}").json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 상세 조회 실패: {e}")
    return _to_image(i)


class VisibilityBody(BaseModel):
    visibility: str  # public | private | shared | community


@router.patch("/images/{image_id}")
def set_visibility(image_id: str, body: VisibilityBody):
    """이미지 가시성 변경(Glance JSON-Patch)."""
    if body.visibility not in ("public", "private", "shared", "community"):
        raise HTTPException(400, "가시성 값이 올바르지 않습니다")
    patch = [{"op": "replace", "path": "/visibility", "value": body.visibility}]
    try:
        _glance_req(
            "PATCH", f"/images/{image_id}",
            data=_json.dumps(patch),
            headers={"Content-Type": "application/openstack-images-v2.1-json-patch"},
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가시성 변경 실패: {e}")
    return get_image(image_id)


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: str):
    try:
        _glance_req("DELETE", f"/images/{image_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 삭제 실패(보호(protected) 이미지면 해제 먼저): {e}")
    return None
