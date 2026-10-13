# openKcloud — kcloud-mnt 통합 관리 포털 (모노레포)

IITP 「AI반도체 클라우드 플랫폼(openKcloud)」 과제에서 오케스트로가 담당하는
**kcloud-mnt(통합 관리 포털)** 모노레포. MSA 모듈 구조와 API Gateway(Istio) 설계는
`docs/` 및 메모리 문서 참조.

## 모듈
| 모듈 | 역할 | 스택 | 상태 |
|---|---|---|---|
| [MNT-APP](MNT-APP/) | 포털 프론트 UI | Next.js 16 | 목업 v2 정렬본 |
| [MNT-CORE](MNT-CORE/) | 포털 코어 — IAM·메뉴·자원신청·마켓·감사 (**PostgreSQL 유일 소유자**) | FastAPI | 뼈대 + DB 연동 + 메뉴 API |
| [MNT-IAAS](MNT-IAAS/) | OpenStack 자원 중개 | FastAPI | 스캐폴드 |
| [MNT-PAAS](MNT-PAAS/) | Magnum/K8s 중개 | FastAPI | 스캐폴드 |
| [MNT-OBS](MNT-OBS/) | Prometheus/Loki 질의 | FastAPI | 스캐폴드 |
| [MNT-AINB](MNT-AINB/) | AI 노트북/Kubeflow 중개 | FastAPI | 귀속(기존 cmp-backend) + 자원신청 `ai-workspace` 연동 |

## 아키텍처 원칙
- **API Gateway = Istio(Envoy) + oauth2-proxy** (코드 모듈 아님). 각 모듈이 `/api/<domain>` 을
  직접 서빙 → VirtualService prefix 매칭만으로 라우팅(rewrite 불필요).
- **설정은 전부 env 주입**(12-factor): 파드 전환 시 비밀값=Secret, 주소·일반값=ConfigMap.
  각 모듈 `deploy/all.yaml` 참조. 프론트는 same-origin `/api/*` 호출로 백엔드 주소를 모른다.
- **DB는 MNT-CORE 만 소유.** 자원 실시간 상태는 저장하지 않고 상위 시스템을 라이브 조회.

## 빠른 시작
```bash
# 프론트
cd MNT-APP && npm install && npm run dev        # http://localhost:3000

# 코어 백엔드
cd MNT-CORE && pip install -r requirements.txt
cp config.env.example config.env                 # DATABASE_URL 수정
uvicorn app.main:app --reload --port 8000        # /healthz, /api/core/menus?role=admin
```

## DB (openkcloud_portal @ 관리 K8s)
- CloudNativePG · PostgreSQL 17.11 · ns `openkcloud-mnt` (`docs/포털DB_PostgreSQL_설치.md`)
- 스키마/시드: `MNT-CORE/db/ddl.sql`, `MNT-CORE/db/seed.sql`
