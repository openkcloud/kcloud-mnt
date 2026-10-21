"""VM 신청 — 이름 중복 확인(가짜 MNT-IAAS Nova 이름 조회) · 관리자 OpenStack 키페어."""
import pytest
from conftest import PROJECT, add_member, bearer, make_token, sql

from app.config import settings
from app.routers import tickets
from app.workflows import runtime

ADMIN = bearer(make_token("admin"))


@pytest.fixture
def nova(monkeypatch):
    """Nova 에 있는 VM 이름(바꿔 가며 시험)."""
    names: set[str] = set()

    def iaas(path, token):
        assert "/server-names?name=" in path, path
        return {"names": [n for n in names if n == path.split("=", 1)[1]]}

    monkeypatch.setattr(tickets, "_iaas", iaas)
    return names


def _vm_ticket(status: str, name: str = "test-vm"):
    sql("""INSERT INTO tkt_request (id, type, status, project_id, requested_by, request_spec)
           SELECT 'req-990101-401', 'vm', :st, :p, id, jsonb_build_object('vmName', CAST(:n AS text))
             FROM iam_user WHERE username = 'admin'""", st=status, p=PROJECT, n=name)


def _check(client, name: str = "test-vm") -> dict:
    return client.get("/api/core/tickets/vm-name-check", params={"projectId": PROJECT, "name": name}, headers=ADMIN).json()


@pytest.mark.parametrize("status,available", [
    ("pending", False), ("approved", False), ("provisioning", False), ("failed", False),  # 진행 중(실패는 재시도 대상)
    ("completed", True), ("rejected", True),  # 완료는 Nova 로 본다 — VM 을 지웠으면 다시 쓸 수 있다
])
def test_VM_이름_확인은_진행_중_신청만_막는다(client, nova, status, available):
    _vm_ticket(status)
    assert _check(client) == {"available": available, "reason": None if available else tickets._TICKET_NAME_TAKEN}


def test_VM_이름_확인_Nova_에_있으면_중복(client, nova):
    nova.add("test-vm")
    _vm_ticket("completed")
    assert _check(client) == {"available": False, "reason": tickets._SERVER_NAME_TAKEN}
    assert _check(client, "test-other")["available"] is True


# ── 관리자 OpenStack(Nova) 키페어 ─────────────────────────────────

VM_BODY = {"projectId": PROJECT, "vmName": "test-vm-key", "flavorId": "f", "imageId": "i", "networkType": "internal",
           "novaKeypair": "gy-yang-pub"}


@pytest.fixture
def iaas_vm(monkeypatch):
    """VM 신청 확인용 MNT-IAAS(프로젝트·플레이버·이미지·VM 이름·Nova 키페어) — Nova 키페어 목록을 돌려준다(바꿔 가며 시험)."""
    keypairs = [{"name": "gy-yang-pub", "publicKey": "ssh-ed25519 AAAA nova@h"}]
    fake = {"/projects": {"items": [{"id": PROJECT, "name": "okc_test_prj"}]},
            f"/projects/{PROJECT}/flavors": {"items": [{"id": "f", "name": "m1.small", "vcpus": 1, "ramMb": 1024,
                                                        "diskGb": 10, "accelerator": None}]},
            f"/projects/{PROJECT}/images": {"items": [{"id": "i", "name": "ubuntu", "minDisk": 1, "minVolumeGb": 1,
                                                       "cloudInit": True}]}}

    def iaas(path, token):
        if "/server-names?name=" in path:
            return {"names": []}
        return {"items": keypairs} if path == "/keypairs" else fake[path]

    monkeypatch.setattr(tickets, "_iaas", iaas)
    yield keypairs
    sql("DELETE FROM tkt_request WHERE type = 'vm' AND request_spec->>'vmName' = 'test-vm-key'")


def test_VM_신청_OpenStack_키페어는_관리자만(client, iaas_vm):
    add_member("ek.lee")
    r = client.post("/api/core/tickets", json=VM_BODY, headers=bearer(make_token()))
    assert (r.status_code, r.json()["detail"]) == (403, "OpenStack 키페어는 관리자만 지정할 수 있습니다")
    r = client.post("/api/core/tickets", json={**VM_BODY, "novaKeypair": "nope"}, headers=ADMIN)
    assert (r.status_code, r.json()["detail"]) == (400, "OpenStack 키페어를 찾을 수 없습니다")
    r = client.post("/api/core/tickets", json=VM_BODY, headers=ADMIN)
    assert r.status_code == 201, r.text
    t = r.json()
    assert (t["novaKeypair"], t["keypairName"], "keypairId" in t) == ("gy-yang-pub", "gy-yang-pub", False)


def test_VM_프로비저닝_OpenStack_키페어(client, iaas_vm, monkeypatch):
    started = []

    async def start(workflow_id, inp):
        started.append(inp)

    monkeypatch.setattr(settings, "temporal_api_base", "temporal.test:7233")
    monkeypatch.setattr(runtime, "start_vm_provision", start)
    monkeypatch.setattr(tickets, "_verified_provision_spec", lambda *a, **k: {
        "networkId": "net-1", "networkName": "net", "networkKind": "internal", "securityGroups": []})
    sql("""INSERT INTO tkt_request (id, type, status, project_id, requested_by, request_spec)
           SELECT 'req-990101-402', 'vm', 'approved', :p, id, CAST(:s AS jsonb) FROM iam_user WHERE username = 'admin'""",
        p=PROJECT, s='{"vmName": "test-vm-key", "flavorId": "f", "imageId": "i", "diskGb": 10, '
                     '"novaKeypair": "gy-yang-pub", "keypairName": "gy-yang-pub"}')
    body = {"provisionSpec": {"networkId": "net-1"}}
    r = client.post("/api/core/tickets/req-990101-402/provision", json=body, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert (started[0]["publicKey"], started[0]["keypairLabel"]) == ("ssh-ed25519 AAAA nova@h", "gy-yang-pub")
    # 신청 뒤 Nova 에서 지웠으면 시작하지 않는다
    sql("UPDATE tkt_request SET status = 'failed' WHERE id = 'req-990101-402'")
    iaas_vm.clear()
    r = client.post("/api/core/tickets/req-990101-402/provision", json=body, headers=ADMIN)
    assert (r.status_code, r.json()["detail"]) == (409, "신청한 키페어(gy-yang-pub)가 삭제되어 주입할 수 없습니다")
    assert len(started) == 1
