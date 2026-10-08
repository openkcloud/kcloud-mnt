"""IaaS 가상서버 — OpenStack Nova 중개(운영: 조회·전원·삭제·볼륨 연결/분리).

생성(POST projects/{id}/servers)은 자원요청→승인 흐름에서만 호출한다.
환경독립: override=template.format(service="nova")+"/v2.1", catalog=service_type="compute".
가속기는 flavor extra_spec(accel:device_profile)에서 도출.
"""
import base64
import json as _json
import re
import time
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..openstack_client import get_conn, get_conn_for_project, os_request
from .flavors import _cyborg
from .volumes import CreateVolumeBody, _cinder_req, create_volume, delete_volume

router = APIRouter(tags=["servers"])

_NOVA_MV = "2.72"  # flavor.original_name·host 등 포함 마이크로버전


def _nova_req(method: str, path: str, *, json=None, project_id: str | None = None, microversion: str = _NOVA_MV,
              timeout: int = 20):
    """project_id 지정 시 그 프로젝트로 스코프해 호출(생성이 그 프로젝트 소유로 들어감 — volumes._cinder_req 와 같은 방식).
    조회는 연결 끊김 시 1회 재시도, 생성·조작은 재시도 없이 새 연결로 보낸다(os_request)."""
    conn = get_conn_for_project(project_id) if project_id else get_conn()
    headers = {"X-OpenStack-Nova-API-Version": microversion}
    if settings.os_endpoint_mode == "catalog":
        r = os_request(conn, path, method, json=json, headers=headers, raise_exc=False,
                       endpoint_filter={"service_type": "compute", "interface": settings.os_interface}, timeout=timeout)
    else:  # override
        base = settings.os_endpoint_template.format(service="nova") + "/v2.1"
        r = os_request(conn, f"{base}{path}", method, json=json, headers=headers, raise_exc=False, timeout=timeout)
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
        "taskState": s.get("OS-EXT-STS:task_state"),  # scheduling·networking·block_device_mapping·spawning … (진행 중일 때)
        "fault": (s.get("fault") or {}).get("message"),  # 빌드 실패 사유(ERROR 일 때)
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


@router.get("/projects/{project_id}/server-names")
def list_server_names(project_id: str, name: str | None = None):
    """프로젝트의 가상서버 이름 목록(경량, Nova 1회) — 자원신청 VM 이름 중복 확인용.
    name 을 주면 Nova 이름 필터(정규식 ^이름$)로 그 이름의 서버만 조회 — VM 이 많아도 결과 0~1건, 목록 1000건 제한과 무관."""
    query = f"all_tenants=1&project_id={quote(project_id, safe='')}"
    if name:
        query += f"&name={quote('^' + re.escape(name) + '$', safe='')}"
    try:
        servers = _nova_req("GET", f"/servers?{query}").json()["servers"]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 조회 실패: {e}")
    return {"names": [s.get("name") for s in servers]}


class CreateServerBody(BaseModel):
    name: str                         # 서버 이름 = hostname
    flavorId: str
    imageId: str
    volumeGb: int                     # 부팅 볼륨 크기(GB) — 항상 Cinder 부팅 볼륨
    networkId: str
    fixedIp: str | None = None        # 고정 IP(없으면 자동 할당)
    securityGroups: list[str] = []    # 보안그룹 이름(프로젝트 기준)
    publicKey: str | None = None      # cloud-init 으로 주입할 SSH 공개키


def _cloud_init_user_data(public_key: str) -> str:
    """SSH 공개키를 등록하는 cloud-config(base64). Nova key_name 대신 사용 — 키는 포털 DB 가 원장."""
    # 키를 JSON 문자열(= 유효한 YAML 문자열)로 감싼다 — 키 주석에 ': '·줄바꿈이 있어도 YAML 이 깨지지 않게
    cfg = "#cloud-config\nssh_authorized_keys:\n  - " + _json.dumps(public_key.strip()) + "\n"
    return base64.b64encode(cfg.encode()).decode()


class VolumeNotReady(RuntimeError):
    """볼륨이 error 가 됐거나 제한 시간 안에 준비되지 않음 — 다시 확인해도 소용없는 실패(조회 오류와 구분)."""


def _wait_volume_available(project_id: str, volume_id: str, *, timeout: float = 300, interval: int = 3, tick=None):
    """볼륨이 사용 가능(available)해질 때까지 대기 — 이미지 내려받기·변환(creating·downloading) 포함.
    tick 은 확인할 때마다 호출(워크플로 작업의 heartbeat)."""
    deadline = time.monotonic() + timeout
    while True:
        status = _cinder_req("GET", f"/volumes/{volume_id}", project_id=project_id).json()["volume"]["status"]
        if status == "available":
            return
        if status == "error":
            raise VolumeNotReady("Cinder 볼륨 생성 오류(status=error)")
        if time.monotonic() > deadline:
            raise VolumeNotReady(f"{round(timeout)}초 안에 준비되지 않음(status={status})")
        if tick:
            tick(status)
        time.sleep(interval)


def _discard_volume(volume_id: str) -> str:
    """생성 실패 시 부팅 볼륨 삭제 — 결과를 오류 메시지에 덧붙일 문구로 돌려준다.
    Nova 가 이미 볼륨을 잡았거나(reserved·in-use) 아직 만드는 중이면 Cinder 가 삭제를 거부한다(남은 볼륨은 직접 정리)."""
    try:
        delete_volume(volume_id)
        return f" — 부팅 볼륨({volume_id})은 삭제함"
    except HTTPException as e:
        return f" — 부팅 볼륨({volume_id})이 남아 있음({e.detail})"


@router.post("/projects/{project_id}/servers", status_code=202)
def create_server(project_id: str, body: CreateServerBody):
    """VM 생성 — ① 부팅 볼륨(이미지→Cinder 볼륨, 이름 `{이름}-boot-vol`)을 만들어 사용 가능해질 때까지 기다린 뒤
    ② Nova 1회 요청으로 그 볼륨(인스턴스 삭제 시 볼륨 삭제)·네트워크(+고정 IP)·보안그룹·hostname·SSH 공개키(cloud-init)를
    넣어 생성한다. ①·②가 실패하면 ①의 볼륨을 지운다. 진행 상태는 GET /servers/{id} 의 taskState 로 확인.
    hostname 지정은 마이크로버전 2.90 이상."""
    vol = create_volume(CreateVolumeBody(name=f"{body.name}-boot-vol", size=body.volumeGb, projectId=project_id,
                                         imageRef=body.imageId))
    try:
        _wait_volume_available(project_id, vol["id"])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"부팅 볼륨 준비 실패: {e}" + _discard_volume(vol["id"]))
    return {"id": _boot_server(project_id, body, vol["id"])}


def _boot_server(project_id: str, body: CreateServerBody, volume_id: str) -> str:
    """준비된 부팅 볼륨으로 Nova 생성 요청(1회) → 서버 ID. 실패하면 그 볼륨을 지우고 502."""
    network = {"uuid": body.networkId, **({"fixed_ip": body.fixedIp} if body.fixedIp else {})}
    server = {
        "name": body.name,
        "hostname": body.name,
        "flavorRef": body.flavorId,
        "block_device_mapping_v2": [{
            "boot_index": 0, "uuid": volume_id, "source_type": "volume", "destination_type": "volume",
            "delete_on_termination": True,
        }],
        "networks": [network],
        **({"security_groups": [{"name": n} for n in body.securityGroups]} if body.securityGroups else {}),
        **({"user_data": _cloud_init_user_data(body.publicKey)} if body.publicKey else {}),
    }
    try:
        # 응답 대기 60초 — 짧으면 Nova 는 만들었는데 포털은 실패로 알 수 있다(재시도 전 같은 이름 서버 확인은 호출부 몫)
        s = _nova_req("POST", "/servers", json={"server": server}, project_id=project_id, microversion="2.90",
                      timeout=60).json()["server"]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 생성 요청 실패: {e}" + _discard_volume(volume_id))
    return s["id"]


@router.get("/servers/{server_id}/accelerator-requests")
def list_server_arqs(server_id: str):
    """가상서버의 가속기 요청(Cyborg ARQ) — 상태: Initial → Bound(바인딩 완료) 등."""
    try:
        arqs = _cyborg("GET", f"/accelerator_requests?instance={quote(server_id, safe='')}").json().get("arqs", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가속기 요청 조회 실패: {e}")
    return {"items": [{"deviceProfile": a.get("device_profile_name"), "state": a.get("state"), "host": a.get("hostname")}
                      for a in arqs]}


@router.get("/servers/{server_id}")
def get_server(server_id: str):
    return _server_detail(server_id, _accel_map())


def _server_detail(server_id: str, accel_map: dict) -> dict:
    """서버 + 연결 볼륨·인터페이스·보안그룹."""
    try:
        s = _nova_req("GET", f"/servers/{server_id}").json()["server"]
        vols = _nova_req("GET", f"/servers/{server_id}/os-volume_attachments").json().get("volumeAttachments", [])
        ifaces = _nova_req("GET", f"/servers/{server_id}/os-interface").json().get("interfaceAttachments", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"가상서버 상세 조회 실패: {e}")
    d = _to_server(s, accel_map)
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
