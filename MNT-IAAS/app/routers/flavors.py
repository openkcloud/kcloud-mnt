"""IaaS 플레이버 — OpenStack Nova 중개. 가속기는 flavor extra_specs(accel:device_profile)=Cyborg device-profile.

플레이버는 '전역(admin)' 자원 — 프로젝트 소속 아님(프로젝트 컬럼 없음).
환경독립: override=template.format(service=...)+버전, catalog=service_type.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..openstack_client import get_conn

router = APIRouter(tags=["flavors"])


def _os_req(service: str, stype: str, ver: str, method: str, path: str, *, json=None):
    conn = get_conn()
    if settings.os_endpoint_mode == "catalog":
        r = conn.session.request(
            f"{ver}{path}", method, json=json, raise_exc=False,
            endpoint_filter={"service_type": stype, "interface": settings.os_interface}, timeout=20,
        )
    else:  # override
        base = settings.os_endpoint_template.format(service=service) + ver
        r = conn.session.request(f"{base}{path}", method, json=json, raise_exc=False, timeout=20)
    if not r.ok:
        raise RuntimeError((r.text or f"HTTP {r.status_code}")[:300])
    return r


def _nova(method: str, path: str, *, json=None):
    return _os_req("nova", "compute", "/v2.1", method, path, json=json)


def _cyborg(method: str, path: str):
    return _os_req("cyborg", "accelerator", "/v2", method, path)


def _to_flavor(f: dict, accel: str | None) -> dict:
    return {
        "id": f["id"],
        "name": f.get("name") or f["id"],
        "vcpus": f.get("vcpus", 0),
        "ramMb": f.get("ram", 0),
        "diskGb": f.get("disk", 0),
        "isPublic": bool(f.get("os-flavor-access:is_public", True)),
        "accelerator": accel,  # 가속기 device-profile(없으면 None)
    }


@router.get("/flavors")
def list_flavors():
    """플레이버 목록 + 가속기(device_profile) extra_spec."""
    try:
        flavors = _nova("GET", "/flavors/detail").json()["flavors"]
        items = []
        for f in flavors:
            specs = _nova("GET", f"/flavors/{f['id']}/os-extra_specs").json().get("extra_specs", {})
            items.append(_to_flavor(f, specs.get("accel:device_profile")))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"플레이버 조회 실패: {e}")
    return {"items": items, "count": len(items)}


@router.get("/device-profiles")
def list_device_profiles():
    """Cyborg device-profiles — 플레이버 생성 시 가속기 선택용."""
    try:
        dps = _cyborg("GET", "/device_profiles").json().get("device_profiles", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"device-profile 조회 실패: {e}")
    return {"items": [{"name": d["name"], "uuid": d.get("uuid")} for d in dps]}


class CreateFlavorBody(BaseModel):
    name: str
    vcpus: int
    ramMb: int
    diskGb: int
    isPublic: bool = True
    deviceProfile: str | None = None  # 가속기 device-profile 이름(선택)


@router.post("/flavors", status_code=201)
def create_flavor(body: CreateFlavorBody):
    if not body.name.strip():
        raise HTTPException(400, "플레이버 이름이 필요합니다")
    if body.vcpus <= 0 or body.ramMb <= 0:
        raise HTTPException(400, "vCPU/RAM 은 1 이상이어야 합니다")
    payload = {"flavor": {
        "name": body.name.strip(), "vcpus": body.vcpus, "ram": body.ramMb,
        "disk": body.diskGb, "os-flavor-access:is_public": body.isPublic,
    }}
    try:
        f = _nova("POST", "/flavors", json=payload).json()["flavor"]
        if body.deviceProfile:
            _nova("POST", f"/flavors/{f['id']}/os-extra_specs",
                  json={"extra_specs": {"accel:device_profile": body.deviceProfile}})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"플레이버 생성 실패: {e}")
    return _to_flavor(f, body.deviceProfile)


@router.delete("/flavors/{flavor_id}", status_code=204)
def delete_flavor(flavor_id: str):
    try:
        _nova("DELETE", f"/flavors/{flavor_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"플레이버 삭제 실패: {e}")
    return None
