"""openstacksdk 연결 — 설정(env)으로 OpenStack Connection을 만든다.

지금은 서비스 계정(예: extadmin) 하나로 대표 호출(관리자 스코프).
연결은 토큰 재사용을 위해 프로세스 1회 생성 후 캐시한다.
"""
import openstack
from openstack.config import loader as _loader  # noqa: F401 (사이드이펙트 없음, 버전 호환 확인용)

from .config import settings

_conn: "openstack.connection.Connection | None" = None


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
