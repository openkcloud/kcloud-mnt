# MNT-AINB — AI 노트북(Kubeflow) 중개 백엔드

기존 `cmp-backend`(feature/cmp-backend 브랜치)를 포털 모듈로 정리한 것입니다. 화면은 MNT-APP의 AI 노트북 메뉴(`/ai-development/*`)입니다.

| 항목 | 내용 |
|---|---|
| 외부 경로 | `/api/ainb/*`(게이트웨이 접두어를 그대로 서빙) · 노트북 IDE 프록시 `/notebook/{ns}/{name}/*` |
| 대상 | 서비스 클러스터의 Kubeflow — Notebook·Profile 컨트롤러, Pipelines(Argo), Katib, KServe |
| 상태 저장 | 없음 — 쿠버네티스 자원을 실시간으로 조회합니다. 신청·승인은 포털 자원신청(MNT-CORE `tkt_request`, type `ai-workspace`)에서 관리합니다 |
| 인증 | 자체 계정 없음. `POST /api/ainb/auth/login`이 MNT-CORE `/api/core/auth/login`으로 확인한 뒤 IDE 프록시용 세션 쿠키(`okc_session`)만 발급합니다 |
| 프로비저닝 | Temporal 작업 워커(큐 `okc-ainb`) — 워크플로 `AiWorkspaceProvision`(MNT-CORE)이 호출합니다 |

## 실행 (로컬)
```bash
cd MNT-AINB && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp config.env.example config.env     # KUBECONFIG·CORE_API_BASE·TEMPORAL_API_BASE 등
.venv/bin/uvicorn app.main:app --reload --port 8300 --env-file config.env
```
- 프런트(MNT-APP)는 `NEXT_PUBLIC_AINB_API=http://localhost:8300`으로 지정합니다(빈 값이면 same-origin 게이트웨이를 사용합니다).
- 내부 라우트는 `/api/v1/*`를 유지하며, `API_PREFIX`(기본 `/api/ainb`)로 들어온 요청의 접두어만 변환합니다.

## AI 워크스페이스 = 프로젝트 1:1
1. 사용자: `POST /api/core/tickets/ai-workspace` — 프로젝트 owner·member만 신청할 수 있으며 프로젝트당 1개입니다. 워크스페이스 이름은 프로젝트 이름(영문 소문자·숫자·하이픈)을 사용합니다.
2. 관리자: `PATCH /api/core/tickets/{id}`로 승인한 뒤 `POST /api/core/tickets/{id}/provision-ai-workspace`로 생성을 시작합니다(자원 한도 조정 가능).
3. 워크플로 `AiWorkspaceProvision`: `core.init_steps_ainb` → `ainb.create_workspace`(Profile, 자원 한도, 라벨 `openkcloud.io/project-id`) → `ainb.wait_ready` → 완료 순서로 진행합니다. 실패 시 해당 회차에서 생성한 Profile을 삭제하고 '실패'로 기록합니다.
4. 화면은 `GET /api/ainb/profiles`의 `projectId`로 포털 프로젝트와 워크스페이스를 연결합니다.
- 공통코드(유형·진행 단계)는 `MNT-CORE/db/ai_workspace.sql`을 1회 적용합니다.

## 배포
- 차트 `charts/openkcloud-portal`의 `backends.ainb`(게이트웨이 경로 `/api/ainb`, `/notebook/`)를 사용합니다.
- 서비스 클러스터 kubeconfig Secret: `kubectl -n openkcloud-mnt create secret generic mnt-ainb-kubeconfig --from-file=config=<kubeconfig>`
  — `KUBECONFIG`를 지정하면 파드 안에서도 관리 클러스터가 아닌 해당 클러스터를 조작합니다(노트북·MinIO는 port-forward 경유).
- Secret `mnt-ainb-secret`: `CMP_SESSION_SECRET`, `MODEL_STORE_KEY`, `MODEL_STORE_SECRET`
- IDE 연결과 성능 분석 상태를 프로세스가 보관하므로 1대로만 운영합니다.

## 서비스 클러스터 Kubeflow 구성요소
테스트배드에는 Notebook·Profile 컨트롤러만 설치되어 있습니다. 파이프라인·HPO·모델 배포를 사용하시려면 `deploy/kubeflow/`로 나머지 구성요소를 설치해야 합니다.
```bash
cp deploy/kubeflow/values.env.example deploy/kubeflow/values.env
KUBECONFIG=<서비스 클러스터> VALUES=deploy/kubeflow/values.env \
  deploy/kubeflow/install.sh crd notebook profile kfp katib certmanager kserve verify   # okcai 단계는 사용하지 않습니다(포털 차트로 배포)
```
- 이미지 목록은 `deploy/kubeflow/images.txt`(필수 약 12GB)입니다. 이미지 수신이 불안정한 경우 Harbor로 옮긴 뒤 매니페스트의 image 항목을 변경해 주시기 바랍니다.
- `furiosa.ai/rngd`는 서비스 클러스터에 Furiosa device plugin이 설치되어야 노출되며, 설치 후 `ACCEL_RESOURCE`로 지정합니다.

## 남은 사항
- Keycloak·oauth2-proxy 연동 후: 로그인 쿠키 대신 게이트웨이가 전달하는 사용자 정보로 IDE 프록시를 인증하도록 변경
- API(`/api/ainb/*`)는 현재 요청자를 확인하지 않습니다(포털의 다른 모듈과 같은 단계). 목록을 본인 프로젝트로 거르는 처리는 화면에서 하고 있으며, 게이트웨이 인증 연동 후 서버에서 거르도록 변경할 예정입니다.
- NPU 노트북 이미지(SDK)와 성능 분석의 NPU 지표(현재 GPU 실측은 nvidia-smi 기반)
