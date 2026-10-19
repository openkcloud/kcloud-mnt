"""클러스터 템플릿(Magnum ClusterTemplate) — 조회 + 관리자 CRUD.

클러스터 생성의 설계도(이미지·플레이버·네트워크·드라이버·라벨 등). Horizon 의
Cluster Templates 화면과 동일 범위. 조회는 로그인 사용자(클러스터 신청 화면), 생성·수정·삭제는 관리자.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import require_admin
from ..openstack_client import magnum

router = APIRouter(tags=["cluster-templates"])


def _err(e: Exception) -> HTTPException:  # noqa: ANN001
    if isinstance(e, httpx.HTTPStatusError):
        try:
            d = e.response.json()
            msg = (d.get("errors") or [{}])[0].get("detail") or d.get("title") or e.response.text
        except Exception:  # noqa: BLE001
            msg = e.response.text
        return HTTPException(status_code=e.response.status_code, detail=msg)
    return HTTPException(status_code=502, detail=f"magnum api error: {type(e).__name__}: {e}")


# 목록·상세에 쓰는 필드(Horizon 표시 항목)
_FIELDS = [
    "name", "coe", "image_id", "flavor_id", "master_flavor_id", "keypair_id",
    "external_network_id", "fixed_network", "fixed_subnet", "dns_nameserver",
    "network_driver", "volume_driver", "docker_storage_driver", "docker_volume_size",
    "cluster_distro", "server_type", "public", "hidden", "tls_disabled",
    "floating_ip_enabled", "master_lb_enabled", "registry_enabled", "labels",
]
# 생성·수정에서 사용자가 지정 가능한 필드(그 외는 Magnum 기본값)
_WRITABLE = [
    "name", "coe", "image_id", "flavor_id", "master_flavor_id", "keypair_id",
    "external_network_id", "fixed_network", "fixed_subnet", "dns_nameserver",
    "network_driver", "volume_driver", "docker_storage_driver", "docker_volume_size",
    "server_type", "public", "hidden", "tls_disabled",
    "floating_ip_enabled", "master_lb_enabled", "labels",
]


def _summary(t: dict) -> dict:
    out = {"id": t["uuid"], "createdAt": t.get("created_at") or "", "updatedAt": t.get("updated_at") or ""}
    for f in _FIELDS:
        out[f] = t.get(f)
    return out


@router.get("/clustertemplates")
def list_templates():
    try:
        items = magnum.get("/clustertemplates").get("clustertemplates", [])
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    return {"items": [_summary(t) for t in items]}


@router.get("/clustertemplates/{template_id}")
def get_template(template_id: str):
    try:
        return _summary(magnum.get(f"/clustertemplates/{template_id}"))
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@router.post("/clustertemplates", status_code=201, dependencies=[Depends(require_admin)])
def create_template(body: dict = Body(...)):
    """템플릿 생성. 빈 값은 빼서 Magnum 기본값에 맡긴다. coe 기본=kubernetes."""
    payload = {k: v for k, v in body.items() if k in _WRITABLE and v not in (None, "", {})}
    payload.setdefault("coe", "kubernetes")
    try:
        return magnum.request("POST", "/clustertemplates", json=payload)
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@router.patch("/clustertemplates/{template_id}", dependencies=[Depends(require_admin)])
def update_template(template_id: str, body: dict = Body(...)):
    """수정 — Magnum 은 JSON Patch(RFC 6902) 를 받는다. 넘어온 쓰기 가능 필드를 replace."""
    patch = [
        {"op": "replace", "path": f"/{k}", "value": v}
        for k, v in body.items() if k in _WRITABLE
    ]
    if not patch:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다.")
    try:
        return magnum.request("PATCH", f"/clustertemplates/{template_id}", json=patch)
    except Exception as e:  # noqa: BLE001
        raise _err(e)


@router.delete("/clustertemplates/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: str):
    try:
        return magnum.request("DELETE", f"/clustertemplates/{template_id}")
    except Exception as e:  # noqa: BLE001
        raise _err(e)
