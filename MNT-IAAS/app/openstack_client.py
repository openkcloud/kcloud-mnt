"""openstacksdk 연결 — 설정(env)으로 OpenStack Connection을 만든다.

지금은 서비스 계정(예: extadmin) 하나로 대표 호출(관리자 스코프).
연결은 토큰 재사용을 위해 프로세스 1회 생성 후 캐시한다.
"""
import openstack
from openstack.config import loader as _loader  # noqa: F401 (사이드이펙트 없음, 버전 호환 확인용)

from .config import settings

_conn: "openstack.connection.Connection | None" = None
_proj_conns: "dict[str, openstack.connection.Connection]" = {}


def get_conn() -> "openstack.connection.Connection":
    global _conn
    if _conn is None:
        _conn = openstack.connection.Connection(
            auth_url=settings.os_auth_url,
            username=settings.os_username,
            password=settings.os_password,
            project_name=settings.os_project_name,
            user_domain_name=settings.os_user_domain_name,
            project_domain_name=settings.os_project_domain_name,
            region_name=settings.os_region_name or None,
            identity_api_version="3",
            verify=not settings.os_insecure,
        )
    return _conn


def get_conn_for_project(project_id: str) -> "openstack.connection.Connection":
    """특정 프로젝트로 스코프된 연결(캐시). Cinder·Nova 처럼 '토큰 스코프 프로젝트'에만
    생성되는 서비스에서, 서비스 계정(extadmin)을 그 프로젝트로 스코프해 자원을 만든다.
    전제: extadmin 이 해당 도메인에 inherited role 보유(모든 프로젝트 스코프 가능)."""
    conn = _proj_conns.get(project_id)
    if conn is None:
        conn = openstack.connection.Connection(
            auth_url=settings.os_auth_url,
            username=settings.os_username,
            password=settings.os_password,
            project_id=project_id,  # project_name 대신 id 로 스코프
            user_domain_name=settings.os_user_domain_name,
            region_name=settings.os_region_name or None,
            identity_api_version="3",
            verify=not settings.os_insecure,
        )
        _proj_conns[project_id] = conn
    return conn
