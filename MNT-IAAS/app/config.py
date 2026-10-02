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

    # MNT-CORE 주소 (ConfigMap)
    core_api_base: str = ""

    class Config:
        env_file = "config.env"
        env_file_encoding = "utf-8"


settings = Settings()
