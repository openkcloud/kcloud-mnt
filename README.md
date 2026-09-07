# openKcloud CMP 백엔드 — AI 노트북(AI 개발환경) API

> **과제**: AI반도체 클라우드 플랫폼 구축 및 최적화 기술 개발 (IITP)
> **담당**: AI 노트북 파트 (Kubeflow 기반 AI 개발환경)
> **역할**: 포털 프론트엔드(`openkcloud` repo)와 Kubernetes/Kubeflow 사이의 게이트웨이

## 1. 아키텍처

```
브라우저 (포털 localhost:3000 · Next.js)
   │  REST (5s 폴링) + iframe(IDE)
   ▼
CMP 백엔드 (이 저장소 · FastAPI :8000)  ← 상태 저장소 없음(stateless)
   │  ├ /api/v1/*        자원 CRUD·메트릭 (K8s API 호출)
   │  ├ /notebook/*      IDE 리버스 프록시 (HTTP+WebSocket, 세션 인증)
   │  └ 세션 인증        HMAC 토큰, okc_session HttpOnly 쿠키
   ▼
Kubernetes (k3s) — 단일 진실 원천
   ├ Kubeflow Notebook Controller v1.10   (Notebook CRD → Pod/Service)
   ├ Kubeflow Profile Controller v1.10    (Profile CRD → NS+Quota+RBAC)
   ├ Kubeflow Pipelines 2.4 + Argo        (워크플로우, MySQL+MinIO 내장)
   ├ Katib v0.17                          (HPO, MySQL 내장)
   ├ KServe v0.14 (RawDeployment)         (모델 서빙, cert-manager 필요)
   ├ vLLM (Deployment)                    (LLM 실측: TTFT/TPOT/KV cache)
   └ NVIDIA device plugin + gpu-metrics DaemonSet
```

## 2. API 레퍼런스

| 영역 | 엔드포인트 | 설명 |
|---|---|---|
| 인증 | `POST /api/v1/auth/login` `logout` `GET me` | 세션 쿠키 발급/폐기/확인 |
| 노트북 | `GET/POST /api/v1/notebooks`, `GET/DELETE /{name}`, `GET /{name}/connect`, `POST /{name}/start·stop·restart` | Notebook CRD 관리, connect=IDE URL 발급 |
| 노트북 상세 | `GET /{name}/files`, `GET /{name}/stats` | 작업공간 파일(pod exec), CPU/MEM(metrics-server) |
| 스냅샷 | `GET/POST /{name}/snapshots`, `POST /{id}/restore`, `DELETE /{id}` | 작업공간 백업·복원 (MinIO 보관) |
| 노트북 진단 | `GET /{name}/events`, `GET /{name}/env`, `GET /{name}/gpu`, `GET /{name}/download` | Pod 이벤트·환경변수·노드 GPU 실측·파일 다운로드 |
| 리소스 변경 | `PATCH /{name}/resources` | CPU·MEM·GPU 재할당 (Pod 재생성, 볼륨 유지) |
| 모델 저장소 | `GET /api/v1/models`, `POST /models/import` | 노트북 폴더 → MinIO(s3://models) 등록 |
| 자원 현황 | `GET /api/v1/resources/gpu-availability` | 클러스터 GPU 총량·사용량·점유 워크로드 |
| Profile | `GET/POST /api/v1/profiles`, `PATCH/DELETE /{name}` | Profile CRD·쿼터 수정 (⚠삭제=네임스페이스 통삭제) |
| 파이프라인 | `GET /api/v1/pipelines`, `POST /upload`, `POST/GET /{id}/runs` | KFP v2beta1 프록시 |
| | `GET /{id}/dag`, `GET /{id}/yaml`, `GET /{id}/artifacts` | 단계 그래프 추출·정의 다운로드·산출물 |
| 스케줄 | `GET/POST /{id}/schedules`, `POST /schedules/{sid}/toggle`, `DELETE` | 정기 실행(RecurringRun) 관리 |
| 실험(HPO) | `GET/POST /api/v1/experiments`, `DELETE /{name}` | Katib Experiment CRD |
| 서빙 | `GET/POST /api/v1/serving`, `DELETE /{name}`, `POST /{name}/predict` | KServe InferenceService + 예측 프록시 |
| 메트릭 | `GET /api/v1/metrics/gpu` | 노드별 nvidia-smi 실측 |
| | `GET /api/v1/metrics/llm`, `POST /llm/chat` | vLLM TTFT/TPOT/E2E/KV cache |
| | `GET /api/v1/metrics/pipeline-runs` | Argo 단계별 시간·병목 |
| 벤치마크 | `POST /api/v1/benchmarks/run`, `GET /api/v1/benchmarks` | 노드별 GPU 실측(TFLOPS·대역폭) |
| | `POST /api/v1/benchmarks/model/{name}/run`, `GET /model` | 모델 부하 테스트(RPS·p50/95/99) |
| IDE | `ALL /notebook/{ns}/{name}/{path}` (HTTP+WS) | 인증 검증 후 노트북으로 프록시. Jupyter는 NB_PREFIX 경로 유지, code-server는 prefix 제거, 프레임 차단 헤더(X-Frame-Options/CSP) 제거 |

## 3. 설치·실행

### 3-1. 표준 클러스터 (테스트베드/운영 — A100 등)

전제: K8s 클러스터, GPU Operator(또는 device plugin), kubeconfig.

```bash
# 1) Kubeflow 스택 설치 (버전 고정)
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.24/manifests/charts/base/files/crd-all.gen.yaml   # Istio CRD (Profile controller 의존)
kubectl apply -k "github.com/kubeflow/kubeflow/components/notebook-controller/config/overlays/standalone?ref=v1.10.0"
kubectl create ns kubeflow
kubectl apply -k "github.com/kubeflow/kubeflow/components/profile-controller/config/overlays/kubeflow?ref=v1.10.0"
kubectl apply -k "github.com/kubeflow/pipelines/manifests/kustomize/cluster-scoped-resources?ref=2.4.0"
kubectl apply -k "github.com/kubeflow/pipelines/manifests/kustomize/env/platform-agnostic?ref=2.4.0"
kubectl apply -k "github.com/kubeflow/katib.git/manifests/v1beta1/installs/katib-standalone?ref=v0.17.0"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
kubectl apply --server-side -f https://github.com/kserve/kserve/releases/download/v0.14.1/kserve.yaml
kubectl apply --server-side -f https://github.com/kserve/kserve/releases/download/v0.14.1/kserve-cluster-resources.yaml
# KServe RawDeployment 모드: inferenceservice-config의 deploy.defaultDeploymentMode 변경
#   (ingress 항목에 ingressGateway 필드 필수 — 없으면 컨트롤러 기동 실패)

# ⚠ KFP 2.4.0 이미지 2개가 gcr.io에서 삭제됨 — 교체 필요:
kubectl -n kubeflow set image deploy/minio minio=docker.io/minio/minio:RELEASE.2019-08-14T20-37-41Z
#   argoexec → quay.io/argoproj/argoexec:v3.4.17 (workflow-controller args + configmap 양쪽)

# 2) 백엔드
python -m venv venv && venv/bin/pip install fastapi "uvicorn[standard]" kubernetes httpx websockets
cp config.env.example config.env    # 환경값 입력 (아래 4장)
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --env-file config.env

# 3) 프론트 (openkcloud repo)
echo "NEXT_PUBLIC_KF_API=http://<백엔드주소>:8000" > .env.local
npm install && npm run dev
```

### 3-2. GPU 메트릭 수집 (선택)

```yaml
# gpu-metrics DaemonSet: GPU를 스케줄상 점유하지 않고 nvidia-smi만 조회
# runtimeClassName: nvidia + env NVIDIA_VISIBLE_DEVICES=all (resources에 gpu 요청 없음)
```

## 4. 환경 설정 (config.env)

`config.env.example` 참고. 핵심 원칙: **미설정 = 표준 클러스터 기본값**.

| 변수 | 용도 | 표준 클러스터 |
|---|---|---|
| `PUBLIC_BASE_URL` | IDE·엔드포인트 URL 발급 기준 | 백엔드 외부 주소 |
| `CORS_ORIGINS` | 포털 origin | 포털 주소 |
| `DEV_PIN_NODE` | [로컬 전용] Pod 노드 고정 | **비움** |
| `POD_HTTP_PROXY` | [로컬 전용] Pod egress 프록시 | **비움** |
| `LLM_SERVICE` / `LLM_MODEL` | LLM 실측 대상 | 배포한 vLLM에 맞춤 |
| `BENCH_IMAGE` | GPU 벤치 Job 이미지 | PyTorch+CUDA 이미지 |

## 5. 로컬 WSL 개발환경의 알려진 제약과 우회 (원청 환경 무관)

| 제약 | 우회 (코드에 opt-in으로 구현됨) |
|---|---|
| 크로스노드 Pod 네트워크(VXLAN 8472/udp) 수신 불가 | `DEV_PIN_NODE`로 컨트롤플레인 계열 Pod 고정. 노트북 접속은 kubelet 터널이라 무관 |
| Pod 외부 인터넷 TCP egress 불가 | 호스트 tinyproxy + `POD_HTTP_PROXY` env 주입 |
| ClusterIP 크로스노드 접근 불가 | 백엔드가 kubectl port-forward로 우회 (vLLM 등) |
| 브라우저에서 동적 포트 접근 불안정 | 모든 IDE 트래픽을 백엔드(:8000) 리버스 프록시로 단일화 |

## 6. 운영 전환 시 교체 지점 (로드맵)

- IDE 프록시/인증 → **Istio VirtualService + oauth2-proxy** (아키텍처상 동일 위치)
- 세션 계정(하드코딩 2개) → **IAM 연동**
- 모델 저장소(호스트 http) → **MinIO/S3·사내 레지스트리**
- `/api/v1/*` 엔드포인트 인증 추가 (현재 IDE 프록시만 보호)
- Portal DB 신설: 사용자·과금·감사 로그 (자원 상태는 계속 K8s가 원천)
- 모델 부하테스트 결과 영속화 (현재 인메모리)
- NPU(Rebellions)/PIM: 디바이스 플러그인 + SDK 이미지 추가 시 동일 구조로 확장
