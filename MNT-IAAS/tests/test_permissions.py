"""역할별 권한 — API 65개 전부. 사용자(gy.yang)는 소속 프로젝트(p-mine) 자원의 조회와
가상서버 상세의 사용자 기능(콘솔·전원·네트워크/볼륨 연결·분리)만, 나머지 쓰기와 라우터는 관리자만."""
import httpx
import pytest
from conftest import ADMIN, MINE, OTHER, USER, _blocked, client_as

from app import auth
from app.routers import flavors, images, networks, projects, servers

A, D = "허용", "거부"
P = "/api/iaas"

CASES = [
    # 가상서버
    ("GET", "/servers", None, A),
    ("GET", f"/projects/{MINE}/server-names", None, A), ("GET", f"/projects/{OTHER}/server-names", None, D),
    ("POST", f"/projects/{MINE}/servers", {"name": "v", "flavorId": "f", "imageId": "i", "volumeGb": 1, "networkId": "n"}, D),
    ("GET", "/servers/mine-s/accelerator-requests", None, A), ("GET", "/servers/other-s/accelerator-requests", None, D),
    ("GET", "/servers/mine-s", None, A), ("GET", "/servers/other-s", None, D),
    ("POST", "/servers/mine-s/interfaces", {"networkId": "mine-net"}, A),
    ("POST", "/servers/mine-s/interfaces", {"networkId": "ext-net"}, A),       # 외부망(다른 프로젝트 소유)은 연결 가능
    ("POST", "/servers/mine-s/interfaces", {"networkId": "other-net"}, D),
    ("POST", "/servers/other-s/interfaces", {"networkId": "mine-net"}, D),
    ("DELETE", "/servers/mine-s/interfaces/port1", None, A), ("DELETE", "/servers/other-s/interfaces/port1", None, D),
    ("POST", "/servers/mine-s/resize", {"flavorId": "f"}, D),
    ("POST", "/servers/mine-s/resize-confirm", None, D), ("POST", "/servers/mine-s/resize-revert", None, D),
    ("GET", "/servers/mine-s/diagnostics", None, A), ("GET", "/servers/other-s/diagnostics", None, D),
    ("POST", "/servers/mine-s/power", {"action": "stop"}, A), ("POST", "/servers/other-s/power", {"action": "stop"}, D),
    ("GET", "/servers/mine-s/console", None, A), ("GET", "/servers/other-s/console", None, D),
    ("DELETE", "/servers/mine-s", None, D),
    ("POST", "/servers/mine-s/volumes", {"volumeId": "mine-v"}, A),
    ("POST", "/servers/mine-s/volumes", {"volumeId": "other-v"}, D),
    ("DELETE", "/servers/mine-s/volumes/mine-v", None, A), ("DELETE", "/servers/other-s/volumes/v", None, D),
    # 볼륨
    ("GET", "/volumes", None, A), ("GET", "/volume-types", None, A), ("GET", "/storage-capacity", None, A),
    ("GET", "/volumes/mine-v", None, A), ("GET", "/volumes/other-v", None, D),
    ("POST", "/volumes", {"name": "x", "size": 1, "projectId": MINE}, D),
    ("DELETE", "/volumes/mine-v", None, D), ("POST", "/volumes/mine-v/extend", {"newSize": 2}, D),
    ("POST", "/snapshots", {"volumeId": "mine-v", "name": "s"}, D), ("DELETE", "/snapshots/sn", None, D),
    # 네트워크·보안그룹·FIP·라우터
    ("GET", "/networks", None, A),
    ("POST", "/networks", {"name": "n", "projectId": MINE}, D),
    ("POST", "/networks/mine-net/subnets", {"name": "s", "cidr": "10.0.0.0/24"}, D),
    ("DELETE", "/networks/mine-net", None, D),
    ("GET", "/networks/mine-net", None, A), ("GET", "/networks/other-net", None, D),
    ("GET", "/networks/ext-net", None, D),                                     # 공유·외부망 상세(다른 프로젝트 포트)는 관리자만
    ("GET", "/security-groups", None, A),
    ("GET", "/security-groups/mine-sg", None, A), ("GET", "/security-groups/other-sg", None, D),
    ("POST", "/security-groups", {"name": "g", "projectId": MINE}, D),
    ("POST", "/security-groups/mine-sg/rules", {"direction": "ingress"}, D),   # 보안그룹은 사용자 조회만
    ("DELETE", "/security-group-rules/r1", None, D), ("DELETE", "/security-groups/mine-sg", None, D),
    ("GET", f"/projects/{MINE}/fip-targets", None, A), ("GET", f"/projects/{OTHER}/fip-targets", None, D),
    ("POST", "/floatingips", {"projectId": MINE}, D), ("DELETE", "/floatingips/f1", None, D),
    ("PUT", "/floatingips/f1", {"portId": "p"}, D),
    ("GET", "/routers", None, D), ("GET", "/routers/r1", None, D),
    ("POST", "/routers", {"name": "r", "projectId": MINE}, D), ("DELETE", "/routers/r1", None, D),
    ("PUT", "/routers/r1/add-interface", {"subnetId": "s"}, D), ("PUT", "/routers/r1/remove-interface", {"subnetId": "s"}, D),
    ("GET", f"/projects/{MINE}/subnets", None, A), ("GET", f"/projects/{OTHER}/subnets", None, D),
    ("GET", f"/projects/{MINE}/networks", None, A), ("GET", f"/projects/{OTHER}/networks", None, D),
    ("GET", f"/projects/{MINE}/security-groups", None, A), ("GET", f"/projects/{OTHER}/security-groups", None, D),
    ("GET", "/networks/mine-net/ip-check?ip=10.0.0.1", None, D),
    ("GET", "/networks/mine-net/fip-reachable?floatingNetworkId=x", None, D),
    # 프로젝트
    ("GET", "/projects", None, A),
    ("POST", "/projects", {"name": "p"}, D), ("PATCH", f"/projects/{MINE}", {"description": "d"}, D),
    ("DELETE", f"/projects/{MINE}", None, D),
    ("GET", f"/projects/{MINE}", None, A), ("GET", f"/projects/{OTHER}", None, D),
    # 이미지 (GET /images/{id} 는 공개 여부를 봐야 해서 아래 따로)
    ("GET", "/images", None, A),
    ("GET", f"/projects/{MINE}/images", None, A), ("GET", f"/projects/{OTHER}/images", None, D),
    ("PATCH", "/images/i1", {"visibility": "public"}, D), ("DELETE", "/images/i1", None, D),
    # 플레이버
    ("GET", "/flavors", None, A), ("GET", "/device-profiles", None, A),
    ("POST", "/flavors", {"name": "f", "vcpus": 1, "ramMb": 512, "diskGb": 1}, D), ("DELETE", "/flavors/f1", None, D),
]


def _call(client, method, path, body):
    return client.request(method, P + path, json=body)


@pytest.mark.parametrize("method,path,body,expected", CASES, ids=[f"{m} {p} {b or ''}" for m, p, b, _ in CASES])
def test_사용자_권한(method, path, body, expected):
    r = _call(client_as(USER), method, path, body)
    if expected == D:
        assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN", r.text
    else:
        assert r.status_code not in (401, 403), r.text  # 권한 통과 — 이후 OpenStack 단계는 막혀 502 등


@pytest.mark.parametrize("method,path,body,expected", CASES, ids=[f"{m} {p} {b or ''}" for m, p, b, _ in CASES])
def test_관리자는_모두_통과(method, path, body, expected):
    r = _call(client_as(ADMIN), method, path, body)
    assert r.status_code not in (401, 403), r.text


def test_모든_API가_시험표에_있음():
    """API 를 새로 추가하면 이 표에도 권한 규칙을 넣게 한다(경로 템플릿 {x} 를 한 마디로 맞춰 본다)."""
    import re
    from app.main import app
    called = {(m, P + p.split("?")[0]) for m, p, *_ in CASES} | {("GET", P + "/images/pub")}
    missing = []
    for path, ops in app.openapi()["paths"].items():
        if path == "/healthz":
            continue
        rx = re.compile("^" + re.sub(r"\{[^}]+\}", "[^/]+", path) + "$")
        missing += [(m.upper(), path) for m in ops if not any(cm == m.upper() and rx.match(cp) for cm, cp in called)]
    assert not missing, f"권한 시험표에 없는 API: {missing}"


# ── 목록 거르기 ──────────────────────────────────────────────────

def test_가상서버_목록은_소속_프로젝트만(monkeypatch):
    fake = {"/servers/detail?all_tenants=1": {"servers": [{"id": "a", "tenant_id": MINE}, {"id": "b", "tenant_id": OTHER}]},
            "/flavors/detail": {"flavors": []}}
    monkeypatch.setattr(servers, "_nova_req", lambda m, path, **k: type("R", (), {"json": lambda self: fake[path]})())
    assert [s["id"] for s in client_as(USER).get(P + "/servers").json()["items"]] == ["a"]
    assert len(client_as(ADMIN).get(P + "/servers").json()["items"]) == 2


def test_네트워크_목록은_소속_망과_공유_외부망(monkeypatch):
    nets = [{"id": "mine", "project_id": MINE}, {"id": "other", "project_id": OTHER},
            {"id": "ext", "project_id": OTHER, "router:external": True}, {"id": "shr", "project_id": OTHER, "shared": True}]
    fake = {"/networks": {"networks": nets}, "/subnets": {"subnets": []}, "/ports": {"ports": []}}
    monkeypatch.setattr(networks, "_neutron_get", lambda path, params=None: fake[path])
    assert [n["id"] for n in client_as(USER).get(P + "/networks").json()["items"]] == ["mine", "ext", "shr"]


def test_이미지는_공개와_소속_프로젝트_것(monkeypatch):
    imgs = [{"id": "pub", "owner": OTHER, "visibility": "public"}, {"id": "mine", "owner": MINE, "visibility": "private"},
            {"id": "oth", "owner": OTHER, "visibility": "private"}]

    def glance(method, path, **k):
        data = {"images": imgs} if path == "/images" else next(i for i in imgs if path.endswith(i["id"]))
        return type("R", (), {"json": lambda self: data})()

    monkeypatch.setattr(images, "_glance_req", glance)
    user = client_as(USER)
    assert [i["id"] for i in user.get(P + "/images").json()["items"]] == ["pub", "mine"]
    assert user.get(P + "/images/pub").status_code == 200
    assert user.get(P + "/images/oth").status_code == 403


def test_프로젝트_목록은_소속만(monkeypatch):
    monkeypatch.setattr(projects, "_fetch_projects", lambda: [{"id": MINE, "name": "m"}, {"id": OTHER, "name": "o"}])
    assert [p["id"] for p in client_as(USER).get(P + "/projects").json()["items"]] == [MINE]


def test_플레이버가_가리키는_디바이스_프로파일이_없음(monkeypatch):
    fl = [{"id": "f1", "name": "rngd"}, {"id": "f2", "name": "2rngd"}, {"id": "f3", "name": "plain"}]
    specs = {"f1": {"accel:device_profile": "dp-rngd"}, "f2": {"accel:device_profile": "dp-2rngd"}, "f3": {}}

    def nova(method, path, **k):
        data = {"flavors": fl} if path == "/flavors/detail" else {"extra_specs": specs[path.split("/")[2]]}
        return type("R", (), {"json": lambda self: data})()

    def cyborg(method, path):
        data = {"device_profiles": [{"name": "dp-rngd", "groups": [{"resources:CUSTOM_AICHIP": "1"}]}]}
        return type("R", (), {"json": lambda self: data})()

    monkeypatch.setattr(flavors, "_nova", nova)
    monkeypatch.setattr(flavors, "_cyborg", cyborg)
    items = client_as(USER).get(P + "/flavors").json()["items"]
    assert {f["name"]: f["deviceProfileMissing"] for f in items} == {"rngd": False, "2rngd": True, "plain": False}

    monkeypatch.setattr(flavors, "_cyborg", _blocked)  # Cyborg 조회 실패면 없다고 단정하지 않는다
    assert not any(f["deviceProfileMissing"] for f in client_as(USER).get(P + "/flavors").json()["items"])


# ── 사용자 확인(MNT-CORE /auth/me) ───────────────────────────────

def _core(monkeypatch, handler):
    calls = []

    def h(request):
        calls.append(request.headers.get("authorization"))
        return handler(request)

    monkeypatch.setattr(auth, "_client", httpx.AsyncClient(transport=httpx.MockTransport(h)))
    return calls


def test_CORE_판정과_캐시(monkeypatch):
    from app.main import app
    from fastapi.testclient import TestClient
    calls = _core(monkeypatch, lambda r: httpx.Response(200, json={"username": "gy.yang", "role": "user",
                                                                   "projectIds": [MINE]}))
    c = TestClient(app)
    for _ in range(2):
        assert c.get(P + f"/projects/{OTHER}/subnets", headers={"Authorization": "Bearer t1"}).status_code == 403
    assert calls == ["Bearer t1"]  # 같은 토큰은 캐시(5초)


def test_CORE_거부는_그대로_전달(monkeypatch):
    from app.main import app
    from fastapi.testclient import TestClient
    _core(monkeypatch, lambda r: httpx.Response(401, json={"detail": "다른곳에서 로그인되었습니다.",
                                                           "code": "SESSION_ENDED", "reason": "duplicate"}))
    r = TestClient(app).get(P + "/flavors", headers={"Authorization": "Bearer t2"})
    assert r.status_code == 401
    assert r.json() == {"detail": "다른곳에서 로그인되었습니다.", "code": "SESSION_ENDED", "reason": "duplicate"}
    assert TestClient(app).get(P + "/flavors").json()["code"] == "TOKEN_REQUIRED"
