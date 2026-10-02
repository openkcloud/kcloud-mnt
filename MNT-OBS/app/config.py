"""MNT-OBS 설정 — Prometheus/Loki 질의. 전부 env 주입(파드: ConfigMap)."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "mnt-obs"
    api_prefix: str = "/api/obs"
    cors_origins: str = ""

    prometheus_url: str = ""       # 예: http://prometheus.monitoring.svc:9090
    loki_url: str = ""             # 예: http://loki.monitoring.svc:3100

    core_api_base: str = ""

    class Config:
        env_file = "config.env"
        env_file_encoding = "utf-8"


settings = Settings()
