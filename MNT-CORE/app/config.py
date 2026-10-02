"""MNT-CORE 환경 설정.

모든 값은 환경변수로 주입한다(12-factor). 파드 전환 시:
  - 비밀값(DATABASE_URL)        → Secret
  - 주소·일반값(*_API_BASE 등)  → ConfigMap
로컬 개발은 config.env 를 만들어 --env-file 로 주입하거나 export 한다.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── DB (Secret 주입 대상) ─────────────────────────────────
    # 운영(파드): postgresql+psycopg://portal_user:****@openkcloud-db-rw.openkcloud-mnt:5432/openkcloud_portal
    database_url: str = "postgresql+psycopg://portal_user:CHANGE_ME@localhost:5432/openkcloud_portal"

    # ── 서비스 메타 ──────────────────────────────────────────
    service_name: str = "mnt-core"
    api_prefix: str = "/api/core"

    # ── CORS (ConfigMap) ─────────────────────────────────────
    # 게이트웨이(single-origin) 구성이면 비워도 된다. 콤마 구분.
    cors_origins: str = "http://localhost:3000"

    # ── 다른 MNT 모듈 호출 주소 (ConfigMap 동적 주입) ────────
    # 파드: http://mnt-iaas.<ns>.svc.cluster.local 형식
    iaas_api_base: str = ""
    paas_api_base: str = ""
    obs_api_base: str = ""
    ainb_api_base: str = ""

    class Config:
        env_file = "config.env"
        env_file_encoding = "utf-8"


settings = Settings()
