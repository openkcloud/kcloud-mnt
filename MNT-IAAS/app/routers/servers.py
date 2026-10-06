"""IaaS 가상서버 — OpenStack Nova 중개(운영: 조회·전원·삭제·볼륨 연결/분리).

생성(POST servers)은 자원요청→승인 흐름에서만 다룬다(여기 없음).
환경독립: override=template.format(service="nova")+"/v2.1", catalog=service_type="compute".
가속기는 flavor extra_spec(accel:device_profile)에서 도출.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..openstack_client import get_conn

router = APIRouter(tags=["servers"])

_NOVA_MV = "2.72"  # flavor.original_name·host 등 포함 마이크로버전


def _nova_req(method: str, path: str, *, json=None):
    conn = get_conn()
    headers = {"X-OpenStack-Nova-API-Version": _NOVA_MV}
    if settings.os_endpoint_mode == "catalog":
        r = conn.session.request(
            path, method, json=json, headers=headers, raise_exc=False,
            endpoint_filter={"service_type": "compute", "interface": settings.os_interface}, timeout=20,
        )
    else:  # override
        base = settings.os_endpoint_template.format(service="nova") + "/v2.1"
        r = conn.session.request(f"{base}{path}", method, json=json, headers=headers, raise_exc=False, timeout=20)
    if not r.ok:
        raise RuntimeError((r.text or f"HTTP {r.status_code}")[:300])
    return r


def _accel_map() -> dict:
    """flavor 이름 → 가속기 device_profile (없으면 None)."""
    out: dict = {}
    try:
        flavors = _nova_req("GET", "/flavors/detail").json()["flavors"]
        for f in flavors:
            specs = _nova_req("GET", f"/flavors/{f['id']}/os-extra_specs").json().get("extra_specs", {})
            out[f.get("name")] = specs.get("accel:device_profile")
    except Exception:  # noqa: BLE001 — 가속기 표기는 부가정보
        pass
    return out


def _addresses(s: dict) -> list[dict]:
    out = []
    for net, addrs in (s.get("addresses") or {}).items():
        for a in addrs:
            out.append({"network": net, "ip": a.get("addr"), "type": a.get("OS-EXT-IPS:type")})
    return out


def _to_server(s: dict, accel_map: dict) -> dict:
    f = s.get("flavor") or {}
    fname = f.get("original_name") or f.get("id") or ""
    vols = s.get("os-extended-volumes:volumes_attached") or []
    return {
        "id": s["id"],
        "name": s.get("name") or s["id"],
        "tenantId": s.get("tenant_id") or "",
        "status": s.get("status", ""),
        "vmState": s.get("OS-EXT-STS:vm_state", ""),
        "powerState": s.get("OS-EXT-STS:power_state", 0),
        "flavorName": fname,
        "vcpus": f.get("vcpus", 0),
        "ramMb": f.get("ram", 0),
        "accelerator": accel_map.get(fname),
        "host": s.get("OS-EXT-SRV-ATTR:host") or "",
        "keyName": s.get("key_name"),
        "imageId": (s.get("image") or {}).get("id") if isinstance(s.get("image"), dict) else None,
        "addresses": _addresses(s),
        "volumeCount": len(vols),
        "createdAt": s.get("created") or "",
    }


@router.get("/servers")
def list_servers():
    """전체 프로젝트 가상서버 목록(관리자)."""
    try:
        servers = _nova_req("GET", "/servers/detail?all_tenants=1").json()["servers"]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 조회 실패: {e}")
    amap = _accel_map()
    return {"items": [_to_server(s, amap) for s in servers], "count": len(servers)}


@router.get("/servers/{server_id}")
def get_server(server_id: str):
    try:
        s = _nova_req("GET", f"/servers/{server_id}").json()["server"]
        vols = _nova_req("GET", f"/servers/{server_id}/os-volume_attachments").json().get("volumeAttachments", [])
        ifaces = _nova_req("GET", f"/servers/{server_id}/os-interface").json().get("interfaceAttachments", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 상세 조회 실패: {e}")
    d = _to_server(s, _accel_map())
    d["attachedVolumes"] = [{"volumeId": v.get("volumeId") or v.get("id"), "device": v.get("device")} for v in vols]
    d["interfaces"] = [
        {"portId": i.get("port_id"), "netId": i.get("net_id"), "state": i.get("port_state"),
         "ips": [fx.get("ip_address") for fx in (i.get("fixed_ips") or [])]}
        for i in ifaces
    ]
    d["securityGroups"] = [g.get("name") for g in (s.get("security_groups") or [])]
    return d


class AttachInterfaceBody(BaseModel):
    networkId: str


@router.post("/servers/{server_id}/interfaces")
def attach_interface(server_id: str, body: AttachInterfaceBody):
    """VM에 네트워크 인터페이스(NIC) 연결 — 포털 네트워크 선택."""
    try:
        _nova_req("POST", f"/servers/{server_id}/os-interface",
                  json={"interfaceAttachment": {"net_id": body.networkId}})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"네트워크 연결 실패: {e}")
    return get_server(server_id)


@router.delete("/servers/{server_id}/interfaces/{port_id}")
def detach_interface(server_id: str, port_id: str):
    """VM에서 네트워크 인터페이스 분리."""
    try:
        _nova_req("DELETE", f"/servers/{server_id}/os-interface/{port_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"네트워크 분리 실패: {e}")
    return {"ok": True}


class ResizeBody(BaseModel):
    flavorId: str


@router.post("/servers/{server_id}/resize")
def resize_server(server_id: str, body: ResizeBody):
    """스펙(플레이버) 변경 시작 → VM이 VERIFY_RESIZE 상태가 되면 확정/되돌리기 필요(재부팅 동반)."""
    try:
        _nova_req("POST", f"/servers/{server_id}/action", json={"resize": {"flavorRef": body.flavorId}})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"스펙 변경 실패: {e}")
    return {"ok": True}


@router.post("/servers/{server_id}/resize-confirm")
def resize_confirm(server_id: str):
    try:
        _nova_req("POST", f"/servers/{server_id}/action", json={"confirmResize": None})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"스펙 변경 확정 실패: {e}")
    return {"ok": True}


@router.post("/servers/{server_id}/resize-revert")
def resize_revert(server_id: str):
    try:
        _nova_req("POST", f"/servers/{server_id}/action", json={"revertResize": None})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"스펙 변경 되돌리기 실패: {e}")
    return {"ok": True}


@router.get("/servers/{server_id}/diagnostics")
def diagnostics(server_id: str):
    """하이퍼바이저 진단(현재 카운터) — CPU time·메모리·디스크/NIC 누적. 시계열 아님(프론트가 폴링해 속도 계산).
    실행 중(ACTIVE)이 아니면 Nova가 거부할 수 있음."""
    try:
        d = _nova_req("GET", f"/servers/{server_id}/diagnostics").json()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"진단 조회 실패(실행 중이 아닐 수 있음): {e}")
    cpu = d.get("cpu_details") or []
    mem = d.get("memory_details") or {}
    disk = d.get("disk_details") or []
    nic = d.get("nic_details") or []
    return {
        "state": d.get("state", ""),
        "uptime": d.get("uptime", 0),
        "numCpus": d.get("num_cpus") or len(cpu),
        "cpuTimeNs": sum((c.get("time") or 0) for c in cpu),
        "memoryMb": mem.get("maximum") or 0,
        "memoryUsedMb": mem.get("used") or 0,
        "diskReadBytes": sum((x.get("read_bytes") or 0) for x in disk),
        "diskWriteBytes": sum((x.get("write_bytes") or 0) for x in disk),
        "nicRxBytes": sum((x.get("rx_octets") or 0) for x in nic),
        "nicTxBytes": sum((x.get("tx_octets") or 0) for x in nic),
    }


class PowerBody(BaseModel):
    action: str  # start | stop | reboot
    hard: bool = False  # reboot 시 HARD 여부


@router.post("/servers/{server_id}/power")
def power_action(server_id: str, body: PowerBody):
    """전원 제어 — start/stop/reboot."""
    act = body.action
    if act == "start":
        payload = {"os-start": None}
    elif act == "stop":
        payload = {"os-stop": None}
    elif act == "reboot":
        payload = {"reboot": {"type": "HARD" if body.hard else "SOFT"}}
    else:
        raise HTTPException(400, "action은 start|stop|reboot 중 하나")
    try:
        _nova_req("POST", f"/servers/{server_id}/action", json=payload)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"전원 제어({act}) 실패: {e}")
    return {"ok": True}


@router.delete("/servers/{server_id}", status_code=204)
def delete_server(server_id: str):
    try:
        _nova_req("DELETE", f"/servers/{server_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 삭제 실패: {e}")
    return None


class AttachVolumeBody(BaseModel):
    volumeId: str


@router.post("/servers/{server_id}/volumes")
def attach_volume(server_id: str, body: AttachVolumeBody):
    """볼륨을 VM에 연결(attach)."""
    try:
        _nova_req("POST", f"/servers/{server_id}/os-volume_attachments",
                  json={"volumeAttachment": {"volumeId": body.volumeId}})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"볼륨 연결 실패: {e}")
    return get_server(server_id)


@router.delete("/servers/{server_id}/volumes/{volume_id}")
def detach_volume(server_id: str, volume_id: str):
    """볼륨을 VM에서 분리(detach)."""
    try:
        _nova_req("DELETE", f"/servers/{server_id}/os-volume_attachments/{volume_id}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"볼륨 분리 실패: {e}")
    return get_server(server_id)
