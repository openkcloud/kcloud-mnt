# AI 노트북(MNT-AINB) 포털 통합 — 1차 통합본

2026-10-12 요청(develop 기준 통합)에 대한 1차 결과다.
브랜치 `feature/ainb-integration`(develop `3030d0d` 기준) → develop 병합 요청(PR) · 그랜드파워솔루션 · 2026-10-14

## 1. 요청 대비 반영
| 요청 | 반영 |
|---|---|
| develop 기준 | `feature/ainb-integration` 브랜치. develop 기존 코드는 연결에 필요한 곳만 고쳤다 |
| 화면은 MNT-APP | AI 노트북 메뉴(워크스페이스·개발환경·학습·모델 배포·성능 분석)를 MNT-APP 으로 이식, `/api/ainb` 실데이터로 동작 |
| cmp-backend → MNT-AINB | `MNT-AINB/` 모듈(FastAPI). 내부 라우트는 그대로 두고 외부 경로만 `/api/ainb` |
| 단일 게이트웨이 | 차트 `backends.ainb` — VirtualService 에 `/api/ainb` 와 `/notebook/`(노트북 IDE) 추가. 포털과 같은 주소라 CORS 불필요 |
| 공통 인증 | MNT-AINB 자체 계정 제거. 포털 로그인 때 MNT-CORE 계정으로 확인한 뒤 IDE 접속용 세션 쿠키만 발급(6장) |
| 신청·승인 상태는 포털 DB | 자원신청 유형 `ai-workspace`(`tkt_request`) + Temporal 워크플로 `AiWorkspaceProvision`. 진행 단계는 `tkt_provision_step`·`tkt_provision_substep` |

## 2. AI 워크스페이스 신청 → 생성 (워크스페이스 = 프로젝트 1:1)
1. **사용자** — AI 노트북 › 워크스페이스 › `워크스페이스 신청`(자원 신청 마법사의 `AI 워크스페이스` 탭도 같다). 프로젝트·사용 목적·한도(vCPU·메모리·가속기·저장)를 넣는다. 이미 워크스페이스가 있는 프로젝트는 고를 수 없다.
2. **관리자** — 신청 관리 › `승인` → `생성 시작`(이때 한도 조정 가능). 진행은 VM 과 같은 진행 창에서 본다.
3. **워크플로** — `AiWorkspaceProvision`(MNT-CORE, 큐 `okc-core`)이 MNT-AINB 활동(큐 `okc-ainb`)을 부른다.
   - 신청 확인(이름·한도) → 워크스페이스 생성(Profile·네임스페이스·ResourceQuota) → 사용 준비 확인(네임스페이스 Active·쿼터 적용)
   - 실패하면 이번 회차가 만든 Profile 을 지우고 '실패'로 둔다 → 관리자가 다시 `생성 시작`(재시도)
4. **연결** — Profile 라벨 `openkcloud.io/project-id`(프로젝트 ID)·주석 `openkcloud.io/project-name`. 화면은 이 라벨로 포털 프로젝트와 워크스페이스를 잇는다. 워크스페이스 이름 = 프로젝트 이름(소문자·숫자·하이픈 63자).

## 3. 테스트배드 적용 — `포털_배포_가이드.md` 에 더할 것
### 3-1. 최초 1회 (1장 (10) 다음)
```bash
# (11) 공통코드 — 자원신청 유형 ai-workspace, 진행 단계 코드 (여러 번 돌려도 같음)
kubectl -n openkcloud-mnt exec -i openkcloud-db-1 -- \
  env PGPASSWORD="${PGPW}" psql -h openkcloud-db-rw -U portal_user -d openkcloud_portal < MNT-CORE/db/ai_workspace.sql

# (12) 앱 시크릿 — MNT-AINB. 세션 서명 키를 고정해야 재배포 뒤에도 IDE 로그인이 유지된다
kubectl -n openkcloud-mnt create secret generic mnt-ainb-secret \
  --from-literal=CMP_SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=MODEL_STORE_KEY='<MinIO 접근 키>' --from-literal=MODEL_STORE_SECRET='<MinIO 비밀 키>'

# (13) 서비스 클러스터(k8s-okc-nb) kubeconfig — MNT-AINB 가 Profile·노트북을 만드는 대상
kubectl -n openkcloud-mnt create secret generic mnt-ainb-kubeconfig --from-file=config=<서비스 클러스터 kubeconfig>
#   관리 클러스터 파드에서 이 kubeconfig 의 API 서버 주소에 닿는지 먼저 확인한다
```
- MinIO 계정: 서비스 클러스터의 Kubeflow Pipelines MinIO(`minio-service.kubeflow`). 학습 결과·모델 저장과 모델 배포(KServe)에 쓴다.
- 서비스 클러스터에 Notebook·Profile 컨트롤러 말고는 없으므로, 학습·모델 배포 화면을 쓰려면 `MNT-AINB/deploy/kubeflow/install.sh` 로 나머지를 설치한다(`MNT-AINB/README.md`).

### 3-2. values.yaml (`backends.ainb.env`) 확인
| 키 | 기본값 | 뜻 |
|---|---|---|
| `PUBLIC_BASE_URL` | `https://portal.kcloud.etri:25443` | 브라우저가 여는 포털 주소 — IDE·모델 엔드포인트 안내용 |
| `DEFAULT_NAMESPACE` | `okc` | 기본 워크스페이스(테스트배드 Profile `okc`) |
| `ACCEL_RESOURCE` | `furiosa.ai/rngd` | 가속기 자원 이름(device plugin 설치 후 노출되는 이름) |
| `KUBECONFIG` | `/etc/mnt-ainb/kubeconfig/config` | (13) 시크릿이 마운트되는 자리 |
- MNT-CORE 의 `AINB_API_BASE` 는 `http://mnt-ainb.openkcloud-mnt.svc.cluster.local` 로 채워 두었다.
- `replicas: 1` 고정 — IDE 연결(port-forward)·성능 분석 상태를 프로세스가 들고 있다.

### 3-3. 빌드·배포·검증
```bash
./scripts/build-push.sh          # 전체 기본값에 ainb(MNT-AINB → 이미지 mnt-ainb) 추가됨
helm upgrade --install openkcloud-portal charts/openkcloud-portal -n openkcloud-mnt --set global.image.tag=$TAG

kubectl -n openkcloud-mnt exec deploy/mnt-ainb -- python -c \
  "import urllib.request as u; print(u.urlopen('http://localhost:8000/healthz').read().decode())"   # {"ok":true}
kubectl -n openkcloud-mnt exec deploy/mnt-ainb -- kubectl get profiles    # 서비스 클러스터 Profile 이 보이면 kubeconfig 정상
# Temporal: 배포 가이드 3장 확인 명령에서 --task-queue okc-ainb → Pollers 에 activity 가 보이면 AINB 워커 연결
```
브라우저: 포털 › AI 노트북 › 워크스페이스 — 관리자는 전체 워크스페이스, 사용자는 자기 프로젝트 것만 보인다.

## 4. API (추가·변경분)
| API | 내용 |
|---|---|
| `POST /api/core/tickets/ai-workspace` | 신청. `{requestedBy, projectId, purpose, cpu, memoryGi, acceleratorCount, storageGi}` → 201. 멤버 아님 403, 처리 중인 신청(대기·승인·생성 중·실패)이 있거나 그 프로젝트의 워크스페이스가 이미 있으면 409. 워크스페이스를 지운 프로젝트는 다시 신청할 수 있다 |
| `PATCH /api/core/tickets/{id}` | 승인·반려 — 기존 그대로 |
| `POST /api/core/tickets/{id}/provision-ai-workspace` | 생성 시작·재시도(관리자). `{processedBy, expectedStatus, cpu?, memoryGi?, acceleratorCount?, storageGi?}` — 비운 값은 신청 값 |
| `GET /api/core/tickets/{id}/steps` | 진행 단계 — 기존 그대로(코드 그룹 `TKT_PROVISION_STEP_AINB`·`TKT_PROVISION_SUBSTEP_AINB`) |
| `GET /api/ainb/workspace-name-check?name=&projectId=` | 이름 사용 가능 여부 + 그 프로젝트의 워크스페이스(라벨)가 이미 있는지 `{available, reason}` |
| `GET /api/ainb/profiles` | 항목에 `projectId`·`projectName` 추가 |
| `POST /api/ainb/auth/login` · `logout`, `GET /api/ainb/auth/me` | IDE 세션 쿠키 발급·해제·확인 |
| 그 밖의 `/api/ainb/*` | 기존 cmp-backend `/api/v1/*` 와 같다(접두어만 다름) |
| `/notebook/{ns}/{name}/*` | 노트북 IDE 프록시(HTTP·WebSocket) — 세션 쿠키 필요 |

## 5. 시험 결과 (개발 PC)
환경: PostgreSQL 17 시험 DB(운영 DB 기준 `tkt_*` 컬럼을 가정해 만듦), Temporal 개발 서버, MNT-IAAS 대역(프로젝트 2개), Kubeflow(Notebook·Profile 컨트롤러)가 있는 쿠버네티스, 게이트웨이와 같은 경로 규칙의 시험용 프록시.

| 항목 | 결과 |
|---|---|
| 로그인 | 틀린 비밀번호 401, 맞으면 200 + 세션 쿠키 |
| 신청 API | 201, 처리 중인 신청이 있는 프로젝트 409, 워크스페이스가 있는 프로젝트 409, 일반 사용자의 승인 시도 403 |
| 화면 — 사용자 신청 | 워크스페이스가 있거나 신청이 처리 중인 프로젝트는 선택 불가, 신청 뒤 '승인 대기' 표시 |
| 화면 — 관리자 | 유형 'AI 워크스페이스' 표시, 승인 → 생성 시작(vCPU 1→2 조정) → 3/3 단계 완료(약 4.5초) |
| 반려 | 사유 없으면 확정 불가, 사용자 화면에 반려 사유 표시, 반려 뒤 같은 프로젝트 재신청 가능 |
| 실패 → 재시도 | 같은 이름·다른 프로젝트의 워크스페이스가 있을 때 '실패'와 사유 표시, 정리 단계는 그 워크스페이스를 지우지 않음, 치운 뒤 재시도 → 2차 시도 완료 |
| 삭제 뒤 재신청 | 워크스페이스를 지운 프로젝트는 '완료' 신청 기록이 있어도 다시 신청 가능 |
| 클러스터 | Profile 라벨 `project-id`, ResourceQuota `cpu 2 / memory 1Gi / requests.storage 1Gi`, 가속기 1장이면 `requests.<가속기 자원>: 1` 추가(0이면 항목 없음) |
| 화면 — 사용자 확인 | 프로젝트 선택에 새 워크스페이스가 나타나고 전환된다 |
| 노트북 | 생성 → 1분 안에 실행 → IDE(VS Code)가 포털 안에서 `/notebook/{ns}/{name}/` 로 열림 → 정지 → 시작 → 삭제(볼륨까지 정리) |
| IDE 경로 | 쿠키 없으면 401 + 로그인 안내 화면, 있으면 프록시 통과 |
| 배포 형태 화면 | `build:gateway` 정적 빌드를 nginx 와 같은 규칙으로 서빙 — AI 노트북 화면 7개(개요·워크스페이스·개발환경·학습·실험·모델 배포·성능 분석) 오류 없음, 백엔드 호출 모두 200 |
| 차트 | `helm template` — mnt-ainb Deployment·Service, VirtualService 경로 `/api/ainb`·`/notebook/` |
| 이미지 | `docker build` 후 uid 10001 로 기동, `/healthz`·`/api/ainb/profiles` 정상 |
| 프런트 | 정적 빌드 통과, 바뀐 파일 eslint 새 경고 없음 |

## 6. Keycloak 적용 전 임시 인증
- AI 노트북 계정은 따로 두지 않는다. 포털 로그인(MNT-CORE) 직후 화면이 같은 계정으로 `POST /api/ainb/auth/login` 을 부르고, MNT-AINB 는 MNT-CORE 로그인 API 로 확인한 뒤 서명한 세션 쿠키(`okc_session`, HttpOnly, 8시간)를 준다. 실패해도 포털 로그인은 유지되고 IDE 만 막힌다.
- 쿠키는 노트북 IDE 프록시(`/notebook/*`)만 검사한다. IDE 는 브라우저가 직접 여는 주소라 화면의 토큰을 실어 보낼 수 없기 때문이다.
- `/api/ainb/*` 는 아직 요청자를 확인하지 않는다(포털 다른 모듈과 같은 단계). '내 프로젝트만 보기'는 화면이 거른다.
- 10/13 회신(포털 로그인 세션 스토어 `openkcloud-auth` 값 사용)대로 AI 노트북 화면은 그 값(사용자·역할)을 그대로 쓴다. 위 세션 쿠키는 브라우저 저장소 값을 실어 보낼 수 없는 IDE 경로 때문에 덧붙인 것이다.
- Keycloak·oauth2-proxy 연동 뒤에는 게이트웨이가 넘기는 사용자 정보로 바꾸고 이 쿠키는 없앤다.

## 7. 확인 부탁·남은 일
1. **DB 컬럼** — 저장소 `ddl.sql` 에 `tkt_*` 테이블이 없어, VM 프로비저닝 코드가 쓰는 운영 DB 컬럼(`cmn_code.upper_code`, `tkt_provision_step.step_group_code`, `tkt_provision_substep.substep_group_code`)을 기준으로 `ai_workspace.sql`·진행 단계 기록을 작성했다. 실제 스키마와 맞는지 확인 부탁드린다.
2. **관리자 직접 생성** — 기존 `워크스페이스 생성(관리자)` 버튼은 프로젝트 라벨 없이 만든다 → 포털 프로젝트와 연결되지 않는다. 신청 경로를 쓰거나, 필요하면 프로젝트 선택을 넣겠다.
3. **주소 변경** — 정적 내보내기에서 동적 경로를 쓸 수 없어 `/ai-development/notebooks/{id}` → `/ai-development/notebooks/detail/?id=`, `/notebooks/{id}/ide` → `/notebooks/ide/?id=` 로 바꿨다.
4. **시간 표시** — 신청 일시가 DB 시각(UTC) 그대로 보인다. 신청 관리 화면의 기존 표시(`fmtDt`)와 같은 방식이라 맞춰 두었다(VM 상세처럼 고칠 때 함께).
5. **가속기** — 서비스 클러스터에 Furiosa device plugin 이 설치돼야 `furiosa.ai/rngd` 가 노출되고 가속기 노트북이 뜬다.
6. **이미지 수신** — 테스트배드에서 외부 이미지 수신이 불안정하면 `deploy/kubeflow/images.txt` 의 이미지를 Harbor 로 옮긴 뒤 매니페스트 image 를 바꾼다.
7. **기존 화면 그대로 둔 것** — 노트북 삭제 확인은 브라우저 기본 확인창(`window.confirm`)이다. '마지막 활동'은 백엔드가 날짜만 주므로 '몇 시간 전' 표시가 정확하지 않다.

## 8. 바뀐 파일
- `MNT-AINB/` — 신규 모듈(앱·Temporal 활동·Dockerfile·`deploy/`·`README.md`)
- `MNT-CORE/` — `routers/tickets.py`(ai-workspace 신청·생성 시작), `workflows/ai_workspace_provision.py`, `workflows/activities.py`·`runtime.py`, `db/ai_workspace.sql`
- `MNT-APP/` — AI 노트북 화면(`app/(portal)/ai-development/*`, `app/(fullscreen)/notebooks/ide`), 신청 관리(`ticket/requests`), 자원 신청 마법사, `lib/ainb-api.ts`·`project-context.ts`·`auth.ts`·`notebook-api.ts`·`ticket-api.ts`
- `charts/openkcloud-portal/` — `backends.ainb`, kubeconfig 마운트, 게이트웨이 추가 경로
- `scripts/build-push.sh` — 모듈 `ainb` 추가
