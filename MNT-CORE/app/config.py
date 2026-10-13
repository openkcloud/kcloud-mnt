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

    # ── Temporal 서버 주소(gRPC, ConfigMap) — 프로비저닝 워크플로(MNT-WORKFLOW) ──
    # 로컬: localhost:7233 (MNT-WORKFLOW/run-local.sh) / 파드: mnt-workflow.<ns>.svc.cluster.local:7233
    temporal_api_base: str = ""

    # ── Keycloak(OIDC) — 토큰 검증·관리 API(서비스 계정). 비밀키만 Secret, 나머지 ConfigMap ──
    # 로컬: http://keycloak.dev.okestro:8080/realms/openkcloud_realm
    # 파드: 발급자는 외부 주소(https://portal.kcloud.etri:25443/auth/realms/openkcloud_realm),
    #       JWKS 는 클러스터 내부(http://keycloak-http.<ns>.svc.cluster.local/realms/openkcloud_realm/...)
    keycloak_issuer: str = ""
    keycloak_jwks_url: str = ""
    keycloak_audience: str = "mnt-core-client"     # API 토큰 aud 에 이 값이 있어야 통과
    keycloak_client_id: str = "mnt-core-client"    # 서비스 계정(관리 API 호출용)
    keycloak_client_secret: str = ""

    class Config:
        env_file = "config.env"
        env_file_encoding = "utf-8"


settings = Settings()
