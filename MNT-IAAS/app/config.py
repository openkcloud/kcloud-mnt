"""MNT-IAAS 설정 — OpenStack 중개. 전부 env 주입(파드: ConfigMap/Secret)."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "mnt-iaas"
    api_prefix: str = "/api/iaas"
    cors_origins: str = ""

    # OpenStack 인증 (OS_PASSWORD 는 Secret 주입)
    os_auth_url: str = ""          # 예: https://keystone-api.openstack.internal:25443/v3
    os_username: str = ""
    os_password: str = ""
    os_project_name: str = ""
    os_user_domain_name: str = "Default"
    os_project_domain_name: str = "Default"
    os_region_name: str = ""
    # TLS 검증. 사내 root CA(kcloud-root-ca) 신뢰 전까지는 true 로 우회.
    os_insecure: bool = True

    # ── 서비스 엔드포인트 해석 전략 (환경 독립성의 핵심) ──────────────
    # override : 로컬/외부 — 진입 URL(ingress)로 직접 질의. 카탈로그 내부 URL 도달 불가 우회.
    #            os_endpoint_template 로 서비스별 base 구성.
    # catalog  : 테스트배드 파드(관리 K8s 내부) — Keystone 카탈로그 자동발견(표준).
    #            파드는 OpenStack과 같은 클러스터라 내부 엔드포인트 도달 가능.
    # ※ 코드는 동일, 배포 시 이 값만 ConfigMap 으로 교체한다.
    os_endpoint_mode: str = "override"
    os_endpoint_template: str = "https://{service}-api.openstack.internal:25443"
    os_interface: str = "internal"   # catalog 모드에서 쓸 엔드포인트 interface

    # MNT-CORE 주소 (ConfigMap)
    core_api_base: str = ""

    class Config:
        env_file = "config.env"
        env_file_encoding = "utf-8"


settings = Settings()
