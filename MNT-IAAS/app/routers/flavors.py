"""IaaS 플레이버 — OpenStack Nova 중개. 가속기는 flavor extra_specs(accel:device_profile)=Cyborg device-profile.

플레이버는 '전역(admin)' 자원 — 프로젝트 소속 아님(프로젝트 컬럼 없음).
환경독립: override=template.format(service=...)+버전, catalog=service_type.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import require_admin
from ..config import settings
from ..openstack_client import get_conn

router = APIRouter(tags=["flavors"])


def _os_req(service: str, stype: str, ver: str, method: str, path: str, *, json=None, headers=None):
    conn = get_conn()
    if settings.os_endpoint_mode == "catalog":
        r = conn.session.request(
            f"{ver}{path}", method, json=json, headers=headers, raise_exc=False,
            endpoint_filter={"service_type": stype, "interface": settings.os_interface}, timeout=20,
            connect_retries=1 if method == "GET" else 0,  # 조회만 재시도(간헐 연결 끊김 대비)
        )
    else:  # override
        base = settings.os_endpoint_template.format(service=service) + ver
        r = conn.session.request(f"{base}{path}", method, json=json, headers=headers, raise_exc=False, timeout=20,
                                 connect_retries=1 if method == "GET" else 0)
    if not r.ok:
        raise RuntimeError((r.text or f"HTTP {r.status_code}")[:300])
    return r


def _nova(method: str, path: str, *, json=None):
    return _os_req("nova", "compute", "/v2.1", method, path, json=json)


# Cyborg microversion — 값은 '숫자만'(접두어 금지). 이름 조회·일부 기능에 2.2+ 필요(미충족 시 406).
def _cyborg(method: str, path: str, *, json=None):
    return _os_req("cyborg", "accelerator", "/v2", method, path, json=json,
                   headers={"OpenStack-API-Version": "2.2"})


# device-profile group 의 resource class → 화면 가속기 종류
_ACCEL_KIND = {"PGPU": "GPU", "CUSTOM_AICHIP": "NPU"}


def _dp_accelerators(groups: list[dict] | None) -> list[dict]:
    """device-profile groups → [{kind, count}]. 예) [{"resources:CUSTOM_AICHIP": "1", ...}] → [{NPU, 1}].
    group 마다 resources:<class>=<개수> 를 종류별로 합산. 모르는 class 는 class 이름 그대로 표시."""
    counts: dict[str, int] = {}
    for g in groups or []:
        for key, val in g.items():
            if key.startswith("resources:"):
                rc = key.split(":", 1)[1]
                kind = _ACCEL_KIND.get(rc, rc)
                counts[kind] = counts.get(kind, 0) + int(val)
    return [{"kind": k, "count": c} for k, c in counts.items()]


def _to_flavor(f: dict, accel: str | None, accelerators: list[dict] | None = None, dp_missing: bool = False) -> dict:
    return {
        "id": f["id"],
        "name": f.get("name") or f["id"],
        "vcpus": f.get("vcpus", 0),
        "ramMb": f.get("ram", 0),
        "diskGb": f.get("disk", 0),
        "isPublic": bool(f.get("os-flavor-access:is_public", True)),
        "accelerator": accel,  # 가속기 device-profile(없으면 None)
        "accelerators": accelerators or [],  # device-profile 의 가속기 종류·개수 [{kind: GPU|NPU, count}]
        "deviceProfileMissing": dp_missing,  # 가리키는 device-profile 이 Cyborg 에 없음 — 이 플레이버로는 VM 을 만들 수 없다
    }


@router.get("/flavors")
def list_flavors():
    """플레이버 목록 + 가속기(device_profile) extra_spec + 가속기 종류(GPU/NPU)."""
    try:
        # 가속기 종류는 부가정보 — Cyborg 조회가 실패해도 플레이버 목록은 돌려준다
        dps = {d["name"]: _dp_accelerators(d.get("groups"))
               for d in _cyborg("GET", "/device_profiles").json().get("device_profiles", [])}
    except Exception:  # noqa: BLE001
        dps = None  # 조회 실패 — device-profile 이 없는지 알 수 없다
    try:
        flavors = _nova("GET", "/flavors/detail").json()["flavors"]
        items = []
        for f in flavors:
            specs = _nova("GET", f"/flavors/{f['id']}/os-extra_specs").json().get("extra_specs", {})
            dp = specs.get("accel:device_profile")
            missing = bool(dp) and dps is not None and dp not in dps
            items.append(_to_flavor(f, dp, (dps or {}).get(dp), missing))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"플레이버 조회 실패: {e}")
    return {"items": items, "count": len(items)}


@router.get("/device-profiles")
def list_device_profiles():
    """Cyborg device-profiles — 플레이버 생성 시 선택용 + 디바이스 프로파일 관리 화면용."""
    try:
        dps = _cyborg("GET", "/device_profiles").json().get("device_profiles", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"device-profile 조회 실패: {e}")
    return {"items": [{
        "name": d["name"],
        "uuid": d.get("uuid"),
        "description": d.get("description"),
        "accelerators": _dp_accelerators(d.get("groups")),  # [{kind, count}]
        "groups": d.get("groups") or [],                    # 원본(화면 상세용)
    } for d in dps]}


class DpTrait(BaseModel):
    name: str                   # 예: CUSTOM_FURIOSA_0001
    policy: str = "required"    # required | forbidden


# 가속기 사양 — Cyborg 규칙상 group 1개 = 장치 1개(개수 고정 1)라, 수량은 group 복제 수로 표현한다.
class DpAccelerator(BaseModel):
    resourceClass: str          # 예: PGPU(GPU), CUSTOM_AICHIP(NPU)
    quantity: int = 1           # 장치 수 — 이 수만큼 count=1 group 을 만든다
    traits: list[DpTrait] = []


class CreateDeviceProfileBody(BaseModel):
    name: str
    description: str | None = None
    accelerators: list[DpAccelerator]


@router.post("/device-profiles", status_code=201, dependencies=[Depends(require_admin)])
def create_device_profile(body: CreateDeviceProfileBody):
    if not body.name.strip():
        raise HTTPException(400, "프로파일 이름이 필요합니다")
    if not body.accelerators:
        raise HTTPException(400, "가속기를 하나 이상 지정해야 합니다")
    groups: list[dict] = []
    for a in body.accelerators:
        rc = a.resourceClass.strip()
        if not rc or a.quantity < 1:
            raise HTTPException(400, "리소스 클래스와 1 이상의 수량이 필요합니다")
        traits: dict[str, str] = {}
        for t in a.traits:
            if not t.name.strip():
                continue
            if t.policy not in ("required", "forbidden"):
                raise HTTPException(400, "트레잇 정책은 required 또는 forbidden 이어야 합니다")
            traits[f"trait:{t.name.strip()}"] = t.policy
        # group 1개 = 장치 1개(재고 1) → 수량만큼 동일 group 복제, 각 개수는 반드시 "1"
        for _ in range(a.quantity):
            groups.append({f"resources:{rc}": "1", **traits})
    payload = {"name": body.name.strip(), "groups": groups}
    if body.description:
        payload["description"] = body.description.strip()
    try:
        # Cyborg POST /device_profiles 는 '원소 1개 배열' 바디를 받는다(객체 직접 전송 시 400)
        r = _cyborg("POST", "/device_profiles", json=[payload]).json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"device-profile 생성 실패: {e}")
    created = r.get("device_profiles", r) if isinstance(r, dict) else r
    first = created[0] if isinstance(created, list) and created else created
    return {"name": body.name.strip(), "uuid": (first or {}).get("uuid") if isinstance(first, dict) else None}


def _flavors_using(dp_name: str) -> list[str]:
    """accel:device_profile 로 이 프로파일을 참조하는 플레이버 이름 목록."""
    out: list[str] = []
    for f in _nova("GET", "/flavors/detail").json()["flavors"]:
        specs = _nova("GET", f"/flavors/{f['id']}/os-extra_specs").json().get("extra_specs", {})
        if specs.get("accel:device_profile") == dp_name:
            out.append(f.get("name") or f["id"])
    return out


@router.delete("/device-profiles/{uuid}", status_code=204, dependencies=[Depends(require_admin)])
def delete_device_profile(uuid: str, force: bool = Query(False)):
    # 참조 무결성: Cyborg 는 참조 중인 프로파일도 즉시 지운다 → 삭제 전 flavor 참조를 선검증(가이드 권장).
    if not force:
        try:
            dps = _cyborg("GET", "/device_profiles").json().get("device_profiles", [])
            name = next((d["name"] for d in dps if d.get("uuid") == uuid), None)
            used = _flavors_using(name) if name else []
        except Exception:  # noqa: BLE001
            used = []  # 조회 실패 시 삭제를 막지는 않는다(아래에서 시도)
        if used:
            raise HTTPException(409, f"이 프로파일을 참조하는 플레이버가 있습니다: {', '.join(used)}. 먼저 연결을 해제하거나 강제 삭제하세요.")
    try:
        _cyborg("DELETE", f"/device_profiles/{uuid}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"device-profile 삭제 실패: {e}")
    return None


class CreateFlavorBody(BaseModel):
    name: str
    vcpus: int
    ramMb: int
    diskGb: int
    isPublic: bool = True
    deviceProfile: str | None = None  # 가속기 device-profile 이름(선택)


@router.post("/flavors", status_code=201, dependencies=[Depends(require_admin)])
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


@router.delete("/flavors/{flavor_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_flavor(flavor_id: str):
    try:
        _nova("DELETE", f"/flavors/{flavor_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"플레이버 삭제 실패: {e}")
    return None
