"""IaaS 이미지 — OpenStack Glance 중개. 라이브 조회(포털 DB 캐시 없음 = 카탈로그 동기화 불필요).

환경독립: override=template.format(service="glance")+"/v2", catalog=service_type="image".
"""
import json as _json
import math

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import Caller, caller, ensure_project, project_member, require_admin, scoped
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
            connect_retries=1 if method == "GET" else 0,  # 조회만 재시도(간헐 연결 끊김 대비)
        )
    else:  # override
        base = settings.os_endpoint_template.format(service="glance") + "/v2"
        r = conn.session.request(f"{base}{path}", method, params=params, data=data, headers=headers, raise_exc=False, timeout=20,
                                 connect_retries=1 if method == "GET" else 0)
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
        # 부팅 볼륨 최소 크기 = max(min_disk, 가상 크기, 파일 크기) 올림 — Cinder 는 둘 다 볼륨 크기와 비교.
        # 가상 크기가 없는 이미지(location 등록·오래된 업로드 등)는 파일 크기로 대신한다
        "minVolumeGb": max(i.get("min_disk") or 0,
                           math.ceil((i.get("virtual_size") or i.get("size") or 0) / _GB),
                           math.ceil((i.get("size") or 0) / _GB)),
        "minRam": i.get("min_ram", 0),
        "createdAt": i.get("created_at") or "",
    }


_PUBLIC = ("public", "community")  # 모든 프로젝트가 쓰는 이미지


@router.get("/images")
def list_images(c: Caller = Depends(caller)):
    """이미지 목록 — 사용자는 공개 이미지 + 소속 프로젝트 소유 이미지."""
    try:
        d = _glance_req("GET", "/images", params={"limit": 200}).json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 조회 실패: {e}")
    return scoped(c, [_to_image(i) for i in d.get("images", [])], also=lambda x: x["visibility"] in _PUBLIC)


@router.get("/projects/{project_id}/images", dependencies=[Depends(project_member)])
def list_project_images(project_id: str):
    """프로젝트가 쓸 수 있는 active 이미지 — public + 프로젝트 소유 + 공유받은 것(거절 제외). 자원신청 템플릿용.
    서비스 계정이 관리자라 Glance 가 전체를 돌려주므로 여기서 거른다.
    cloudInit: 기본 true, Glance 속성 okc_cloud_init=false 인 이미지만 false(키페어 주입 불가)."""
    try:
        images, params = [], {"limit": 200, "status": "active"}
        while True:  # 관리자 계정은 전체 이미지가 보이므로 페이지(next)를 끝까지 따라간다
            page = _glance_req("GET", "/images", params=params).json()
            images += page.get("images", [])
            if not page.get("next") or not page.get("images"):
                break
            params["marker"] = images[-1]["id"]
        out = []
        for i in images:
            if i.get("visibility") == "public" or i.get("owner") == project_id:
                out.append(i)
            elif i.get("visibility") == "shared":
                members = _glance_req("GET", f"/images/{i['id']}/members").json().get("members", [])
                if any(m.get("member_id") == project_id and m.get("status") != "rejected" for m in members):
                    out.append(i)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 조회 실패: {e}")
    items = [{**_to_image(i), "cloudInit": str(i.get("okc_cloud_init", "")).lower() != "false"} for i in out]
    return {"items": items, "count": len(items)}


@router.get("/images/{image_id}")
def get_image(image_id: str, c: Caller = Depends(caller)):
    try:
        i = _glance_req("GET", f"/images/{image_id}").json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 상세 조회 실패: {e}")
    d = _to_image(i)
    if d["visibility"] not in _PUBLIC:
        ensure_project(c, d["tenantId"])
    return d


class VisibilityBody(BaseModel):
    visibility: str  # public | private | shared | community


@router.patch("/images/{image_id}", dependencies=[Depends(require_admin)])
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


@router.delete("/images/{image_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_image(image_id: str):
    try:
        _glance_req("DELETE", f"/images/{image_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"이미지 삭제 실패(보호(protected) 이미지면 해제 먼저): {e}")
    return None
