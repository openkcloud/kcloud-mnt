"""Keystone 토큰 + Magnum REST 클라이언트 (httpx).

MNT-IAAS 는 Nova/Cinder/Neutron 등 다양한 서비스라 openstacksdk 를 쓰지만,
MNT-PAAS 는 Magnum REST 몇 개만 호출하므로 httpx 로 가볍게 간다
(MNT-OBS MonitorClient 와 같은 토큰 캐시·만료 재발급 패턴).

엔드포인트 해석은 MNT-IAAS 와 동일한 2-모드:
  override : 진입 URL(ingress) 직접 — os_endpoint_template.format(service="magnum")
  catalog  : 토큰 카탈로그의 container-infra public URL 자동발견
"""
from __future__ import annotations

import threading
import time

import httpx

from .config import settings

# Magnum 마이크로버전 — nodegroups 등 최신 리소스 사용
_API_VERSION = {"OpenStack-API-Version": "container-infra latest"}


class MagnumClient:
    def __init__(self, project_id: str | None = None) -> None:
        self._project_id = project_id  # None 이면 설정의 프로젝트(이름) 스코프
        self._token: str | None = None
        self._magnum_url: str | None = None  # catalog 모드에서 토큰과 함께 갱신
        self._exp: float = 0.0
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=30, verify=not settings.os_insecure)

    def _login(self) -> None:
        """Keystone 패스워드 인증(프로젝트 스코프) → 토큰·만료·카탈로그."""
        r = self._client.post(
            f"{settings.os_auth_url}/auth/tokens",
            json={
                "auth": {
                    "identity": {
                        "methods": ["password"],
                        "password": {"user": {
                            "name": settings.os_username,
                            "domain": {"name": settings.os_user_domain_name},
                            "password": settings.os_password,
                        }},
                    },
                    "scope": {"project": {"id": self._project_id} if self._project_id else {
                        "name": settings.os_project_name,
                        "domain": {"name": settings.os_project_domain_name},
                    }},
                }
            },
        )
        r.raise_for_status()
        self._token = r.headers["X-Subject-Token"]
        body = r.json()["token"]
        # 만료 60초 전에 미리 갱신 (기본 수명을 모르면 50분)
        try:
            from datetime import datetime, timezone
            exp = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
            self._exp = exp.timestamp() - 60
        except Exception:  # noqa: BLE001
            self._exp = time.time() + 50 * 60

        if settings.os_endpoint_mode == "catalog":
            for svc in body.get("catalog", []):
                if svc.get("type") in ("container-infra", "container_infra"):
                    for ep in svc.get("endpoints", []):
                        if ep.get("interface") == "public":
                            self._magnum_url = ep["url"].rstrip("/")
        else:
            base = settings.os_endpoint_template.format(service="magnum").rstrip("/")
            self._magnum_url = f"{base}/v1"

    def _ensure_token(self) -> None:
        if not self._token or time.time() >= self._exp:
            with self._lock:
                if not self._token or time.time() >= self._exp:
                    self._login()

    def request(self, method: str, path: str, json: dict | None = None) -> dict:
        """Magnum /v1 하위 호출. path 예: /clusters, /clusters/{id}/nodegroups."""
        self._ensure_token()
        headers = {"X-Auth-Token": self._token, **_API_VERSION}
        url = f"{self._magnum_url}{path}"
        r = self._client.request(method, url, headers=headers, json=json)
        if r.status_code == 401:  # 토큰 조기 만료 → 1회 재로그인
            with self._lock:
                self._login()
            headers["X-Auth-Token"] = self._token
            r = self._client.request(method, url, headers=headers, json=json)
        r.raise_for_status()
        return r.json() if r.content else {}

    def get(self, path: str) -> dict:
        return self.request("GET", path)


magnum = MagnumClient()

_project_clients: dict[str, MagnumClient] = {}
_project_lock = threading.Lock()


def for_project(project_id: str) -> MagnumClient:
    """특정 프로젝트로 스코프된 클라이언트(캐시). Magnum 인증서(CA 조회·CSR 서명)는 클러스터 소유 프로젝트
    스코프에서만 된다(다른 프로젝트 스코프면 'Cluster could not be found'). MNT-IAAS get_conn_for_project 와 같은 전제:
    서비스 계정이 해당 도메인에 inherited role 보유(모든 프로젝트 스코프 가능)."""
    with _project_lock:
        cli = _project_clients.get(project_id)
        if cli is None:
            cli = _project_clients[project_id] = MagnumClient(project_id)
        return cli
