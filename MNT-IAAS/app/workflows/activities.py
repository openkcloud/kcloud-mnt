"""IAAS 워커가 실행하는 OpenStack 작업 — MNT-CORE 의 VM 프로비저닝 워크플로가 이름(iaas.*)으로 부른다.

기존 API 함수를 그대로 재활용한다. 실패 구분:
  - 다시 해도 소용없는 실패(없는 플레이버, 생성 거절, 볼륨 error 등) → ApplicationError(non_retryable)
  - 연결 끊김 같은 일시 오류 → 그대로 올려 워크플로의 재시도 정책을 따른다(만드는 작업은 워크플로가 재시도하지 않음)
"""
import re
import time
from urllib.parse import quote

from fastapi import HTTPException
from temporalio import activity
from temporalio.exceptions import ApplicationError

from ..routers import networks, servers, volumes
from ..routers.images import _glance_req


def _fail(msg: str) -> ApplicationError:
    return ApplicationError(msg, non_retryable=True)


@activity.defn(name="iaas.check_flavor")
def check_flavor(flavor_id: str) -> str:
    """플레이버 존재 확인 → 이름."""
    try:
        f = servers._nova_req("GET", f"/flavors/{flavor_id}").json()["flavor"]
    except RuntimeError as e:  # Nova 가 거절(없는 플레이버 등)
        raise _fail(f"플레이버 확인 실패: {e}")
    return f.get("name") or flavor_id


@activity.defn(name="iaas.check_image")
def check_image(image_id: str) -> str:
    """이미지 존재·사용 가능(active) 확인 → 이름."""
    try:
        img = _glance_req("GET", f"/images/{image_id}").json()
    except RuntimeError as e:  # Glance 가 거절(없는 이미지 등) — 오류 본문이 HTML 이라 태그를 걷어낸다
        raise _fail("이미지 확인 실패: " + " ".join(re.sub(r"<[^>]+>", " ", str(e)).split()))
    if img.get("status") != "active":
        raise _fail(f"이미지를 사용할 수 없는 상태입니다(status={img.get('status')})")
    return img.get("name") or image_id


@activity.defn(name="iaas.create_boot_volume")
def create_boot_volume(project_id: str, name: str, size_gb: int, image_id: str) -> str:
    """부팅 볼륨 생성(이미지 지정) → 볼륨 ID."""
    try:
        return volumes.create_volume(volumes.CreateVolumeBody(
            name=name, size=size_gb, projectId=project_id, imageRef=image_id))["id"]
    except HTTPException as e:
        raise _fail(e.detail)


@activity.defn(name="iaas.wait_volume")
def wait_volume(project_id: str, volume_id: str, deadline: float) -> str | None:
    """볼륨이 available 이 될 때까지 대기. deadline(epoch 초)은 워크플로가 정한 절대 시각.
    준비되면 None. deadline 까지 준비되지 않으면 그때 상태를 돌려준다 — 아직 만드는 중이라 지우지 않는다
    (더 기다릴지는 워크플로가 정함). error 면 볼륨을 지우고 실패."""
    try:
        servers._wait_volume_available(project_id, volume_id, timeout=max(0.0, deadline - time.time()),
                                       tick=activity.heartbeat)
    except servers.VolumeTimeout as e:
        return e.status
    except servers.VolumeNotReady as e:
        raise _fail(f"부팅 볼륨 준비 실패: {e}" + servers._discard_volume(volume_id))
    return None


@activity.defn(name="iaas.create_server")
def create_server(project_id: str, spec: dict, volume_id: str) -> str:
    """VM 생성 요청(Nova 1회) → 서버 ID. 실패하면 부팅 볼륨을 지운다."""
    try:
        return servers._boot_server(project_id, servers.CreateServerBody(**spec), volume_id)
    except HTTPException as e:
        raise _fail(e.detail)


@activity.defn(name="iaas.watch_server")
def watch_server(server_id: str, last: str, max_seconds: float, interval: int) -> dict:
    """서버 상태(status·taskState·host)가 last 와 달라지면 바로, 아니면 max_seconds 뒤 현재 상태를 돌려준다."""
    end = time.monotonic() + max_seconds
    while True:
        s = servers._to_server(servers._nova_req("GET", f"/servers/{server_id}").json()["server"], {})
        snap = {"status": s["status"], "taskState": s["taskState"], "host": s["host"], "fault": s["fault"]}
        key = f"{s['status']}/{s['taskState'] or ''}/{s['host']}"
        if key != last or time.monotonic() >= end:
            return {**snap, "key": key}
        activity.heartbeat(key)
        time.sleep(interval)


@activity.defn(name="iaas.server_detail")
def server_detail(server_id: str) -> dict:
    """연결 인터페이스(포트·IP)·볼륨(장치)·보안그룹 — 진행 표시 값."""
    d = servers._server_detail(server_id, {})
    return {k: d[k] for k in ("interfaces", "attachedVolumes", "securityGroups")}


@activity.defn(name="iaas.arq_states")
def arq_states(server_id: str) -> list[str]:
    """가속기 요청(Cyborg ARQ) 상태 목록 — 예: ["Bound"]."""
    return [a["state"] for a in servers.list_server_arqs(server_id)["items"]]


@activity.defn(name="iaas.attach_fip")
def attach_fip(project_id: str, floating_network_id: str, port_id: str) -> dict:
    """Floating IP 확보 → VM 포트에 연결. 연결이 실패하면 확보한 IP 를 반납한다."""
    try:
        fip = networks.allocate_fip(networks.AllocateFipBody(projectId=project_id, floatingNetworkId=floating_network_id))
    except HTTPException as e:
        raise _fail(e.detail)
    try:
        networks.update_fip(fip["id"], networks.AssociateFipBody(portId=port_id))
    except HTTPException as e:
        try:
            networks.release_fip(fip["id"])
            note = " — 확보한 IP 는 반납함"
        except HTTPException as e2:
            note = f" — 확보한 IP({fip.get('floating_ip_address')}) 반납 실패, 직접 정리 필요: {e2.detail}"
        raise _fail(e.detail + note)
    return {"id": fip["id"], "ip": fip.get("floating_ip_address")}


def _gone(e: Exception) -> bool:
    """이미 없는 자원(404)인지 — Nova·Cinder·Neutron 모두 오류 문구에 'could not be found' 가 들어간다."""
    return "could not be found" in (e.detail if isinstance(e, HTTPException) else str(e))


def _wait_until_gone(get, deadline: float, label: str):
    """get() 이 404 가 될 때까지 대기(삭제 완료 확인)."""
    while True:
        try:
            get()
        except RuntimeError as e:
            if _gone(e):
                return
            raise
        if time.time() > deadline:
            raise RuntimeError(f"{label} 삭제가 제한 시간 안에 끝나지 않았습니다")
        activity.heartbeat(label)
        time.sleep(3)


@activity.defn(name="iaas.cleanup")
def cleanup(project_id: str, res: dict, deadline: float) -> list[str]:
    """실패한 회차가 만든 자원 정리 — FIP 반납 → VM 삭제(완료까지 대기, 부팅 볼륨은 Nova 가 함께 삭제)
    → VM 없이 남은 부팅 볼륨 삭제. 이미 없으면 지운 것으로 보므로 여러 번 실행해도 결과가 같다.
    res: floatingIpId · serverId · volumeId, VM 생성 요청 후 서버 ID 를 못 받았으면 serverName(이름으로 찾아 삭제).
    실제로 지운 자원 이름 목록을 돌려준다."""
    done = []
    if res.get("floatingIpId"):
        try:
            networks.release_fip(res["floatingIpId"])
            done.append("Floating IP")
        except HTTPException as e:
            if not _gone(e):
                raise
    server_ids = [res["serverId"]] if res.get("serverId") else []
    if not server_ids and res.get("serverName"):  # 생성 요청 응답이 끊겨도 Nova 가 만들었을 수 있다
        query = f"all_tenants=1&project_id={quote(project_id, safe='')}&name={quote('^' + re.escape(res['serverName']) + '$', safe='')}"
        server_ids = [x["id"] for x in servers._nova_req("GET", f"/servers?{query}").json()["servers"]]
    for sid in server_ids:
        try:
            servers.delete_server(sid)
            done += ["VM", "부팅 볼륨"]  # 부팅 볼륨은 인스턴스 삭제 시 함께 삭제(delete_on_termination)
        except HTTPException as e:
            if not _gone(e):
                raise
        _wait_until_gone(lambda: servers._nova_req("GET", f"/servers/{sid}"), deadline, "VM")
    if res.get("volumeId"):
        vid = res["volumeId"]
        while True:  # VM 과 함께 지워지는 중이면 기다리고, 붙지 않은 채 남아 있으면 직접 지운다
            try:
                status = volumes._cinder_req("GET", f"/volumes/{vid}", project_id=project_id).json()["volume"]["status"]
            except RuntimeError as e:
                if _gone(e):
                    break
                raise
            if status in ("available", "error"):
                try:
                    volumes.delete_volume(vid)
                    if "부팅 볼륨" not in done:
                        done.append("부팅 볼륨")
                except HTTPException:
                    pass  # Nova 가 먼저 지우기 시작했을 수 있다 — 다시 확인
            if time.time() > deadline:
                raise RuntimeError(f"부팅 볼륨 삭제가 제한 시간 안에 끝나지 않았습니다(status={status})")
            activity.heartbeat(status)
            time.sleep(3)
    return list(dict.fromkeys(done))


ALL = [check_flavor, check_image, create_boot_volume, wait_volume, create_server, watch_server, server_detail,
       arq_states, attach_fip, cleanup]
