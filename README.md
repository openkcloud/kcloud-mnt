# openKcloud - kcloud-mnt 통합 관리 포털

**kcloud-mnt**는 openKcloud의 통합 관리 포털 모노레포입니다.
이종 AI반도체(GPU·NPU·PIM) 기반 IaaS(OpenStack)·PaaS(Kubernetes/Magnum)·AI 개발환경(Kubeflow)·관측(Prometheus/Loki)을
하나의 포털에서 신청·승인·운영할 수 있도록 MSA 백엔드(FastAPI)와 웹 UI(Next.js)로 구성합니다.

- 현재 버전: **v0.2.0** (openKcloud 3차 통합 릴리즈)
- 라이선스: Apache License 2.0

## 접속 주소 (ETRI 테스트배드)

| 서비스 | 주소 | 비고 |
|---|---|---|
| 통합 관리 포털 | `https://portal.kcloud.etri:25443` | Keycloak 로그인(주소창 호스트 유지) |
| 워크플로(Temporal) 화면 | `https://temporal.kcloud.etri:25443` | 로그인 없음 - 사내망에서만 |
| 인증 서버(Keycloak) 관리 | `https://keycloak.kcloud.etri:25443/admin` | 관리자 전용 |

> 테스트배드(ETRI 관리망)는 공인 DNS가 없습니다. 접속 PC의 hosts 파일에 호스트를 등록해야 열립니다
> - 등록 값은 [`docs/포털_배포_가이드.md`](docs/포털_배포_가이드.md) 0장 참고. 계정은 포털 관리자에게 요청하세요.

## 모듈

| 모듈 | 역할 | 스택 | v0.2.0 상태 |
|---|---|---|---|
| [MNT-APP](MNT-APP/) | 포털 웹 UI | Next.js 16 · React 19 · TypeScript | Keycloak 로그인, DB 기반 메뉴, IaaS·PaaS·AI 노트북 실연동 화면 |
| [MNT-CORE](MNT-CORE/) | 포털 코어 - IAM·메뉴·공통코드·자원신청·감사 (**PostgreSQL 유일 소유자**) | FastAPI | 동작 - 토큰 검증·세션 관리, 자원신청 스테퍼, 프로비저닝 워커 |
| [MNT-IAAS](MNT-IAAS/) | OpenStack 자원 중개 | FastAPI | 동작 - 프로젝트·가상서버·네트워크·볼륨·보안그룹·쿼터·스냅샷 |
| [MNT-PAAS](MNT-PAAS/) | Magnum/Kubernetes 중개 | FastAPI | 클러스터·템플릿·노드그룹·워크로드(파드) 관리 |
| [MNT-OBS](MNT-OBS/) | 모니터링 질의(KCloud Monitor v2·Prometheus/Loki) | FastAPI | 모니터링 API 연동 |
| [MNT-AINB](MNT-AINB/) | AI 노트북(Kubeflow) 중개 | FastAPI | 노트북·IDE 프록시, 자원신청 `ai-workspace` 연동 |
| [MNT-WORKFLOW](MNT-WORKFLOW/) | 자원 프로비저닝 워크플로 서버 | Temporal(공식 이미지) | 테스트배드 배포 |
| [charts/](charts/) | Helm 차트 - 포털 전체(`openkcloud-portal`), Keycloak·로그인 테마 | Helm | - |

## 아키텍처 원칙
- **API Gateway = Istio(Envoy).** 각 모듈이 `/api/<domain>`을 직접 서빙하고, VirtualService prefix 매칭만으로 라우팅합니다.
- **인증 = Keycloak(OIDC Authorization Code + PKCE).** MNT-CORE가 토큰·세션을 검증하고, 다른 모듈은 `/api/core/auth/me`로 사용자를 확인합니다.
- **자원 프로비저닝 = Temporal 워크플로.** 신청·승인 후 VM·AI 워크스페이스 생성은 MNT-CORE/MNT-IAAS/MNT-AINB 워커가 처리합니다.
- **DB는 MNT-CORE만 소유.** 자원 실시간 상태는 저장하지 않고 상위 시스템(OpenStack·K8s·모니터링)을 라이브 조회합니다.
- **설정은 전부 환경변수 주입(12-factor).** 비밀값은 배포 시점에 Secret으로 주입하며 저장소에 커밋하지 않습니다.

## 빠른 시작 (로컬 개발)
```bash
# 프론트
cd MNT-APP && npm install && npm run dev          # http://localhost:3000 → Keycloak 로그인

# 코어 백엔드
cd MNT-CORE && pip install -r requirements.txt
cp config.env.example config.env                  # DATABASE_URL, KEYCLOAK_* 설정
uvicorn app.main:app --reload --port 8000         # /healthz (그 밖의 API는 로그인 토큰 필요)
```
IaaS·워크플로 실행, DB 스키마·마이그레이션, 개발용 Keycloak 설정은 [`docs/인계_현재맥락.md`](docs/인계_현재맥락.md) 5장을 참고하세요.

## 배포 (관리 K8s)
```bash
./scripts/build-push.sh                           # 모듈 이미지 빌드 → Harbor push
helm upgrade --install openkcloud-portal charts/openkcloud-portal \
  -n openkcloud-mnt --set global.image.tag=$(git rev-parse --short HEAD)
```
상세 절차·검증·롤백은 [`docs/포털_배포_가이드.md`](docs/포털_배포_가이드.md).

## DB
- PostgreSQL 17 (CloudNativePG, ns `openkcloud-mnt`) - [`docs/포털DB_PostgreSQL_설치.md`](docs/포털DB_PostgreSQL_설치.md)
- 스키마/시드: `MNT-CORE/db/ddl.sql`, `MNT-CORE/db/seed.sql`, 마이그레이션 `MNT-CORE/db/migration_*.sql`

## 릴리즈
| 버전 | 일자 | 내용 |
|---|---|---|
| v0.2.0 | 2026-11-26 | openKcloud 3차 통합 릴리즈 - MSA 백엔드 실연동, Keycloak 인증, Temporal 프로비저닝 |

## 문의
오케스트로㈜ - openKcloud 통합 관리 포털 담당
