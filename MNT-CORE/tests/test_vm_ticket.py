"""VM 신청 — 이름 중복 확인(가짜 MNT-IAAS Nova 이름 조회)."""
import pytest
from conftest import PROJECT, bearer, make_token, sql

from app.routers import tickets

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
