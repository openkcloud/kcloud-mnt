# AI 노트북 — ETRI 테스트베드 포팅 가이드

작성 2026-09-28 · 개정 2026-09-29 (전체 기능 한 번에 이전으로 변경) · 대상: openKcloud AI 노트북(포털 화면 + CMP 백엔드 + Kubeflow 구성요소)

## 1. 범위와 일정

**10월 15일까지 AI 노트북 전체 기능을 ETRI 환경에 한 번에 옮긴다.** ① 워크스페이스 · ② 개발환경(노트북·IDE) · ③ 학습(파이프라인·HPO) · ④ 모델 배포 · ⑤ 성능 분석 모두 대상이다. 9/28에 적었던 두 단계 안은 폐기했다(2026-09-29 결정).

| 날짜 | 할 일 |
|---|---|
| 10/2(금)까지 | 설치 묶음(이미지·매니페스트)과 설치 순서 완성, 이 PC의 빈 클러스터에서 처음부터 설치 연습 |
| 10/3~5 연휴 | 연습에서 나온 문제 해결 (주말 작업) |
| 계정 받는 날 | ETRI 설치 착수 |
| **10/12(월)** | **우리 쪽 설치 완료 목표** — 2026-09-29 메일로 오케스트로에 통보 |
| 10/13~14 | 확인·보완 여유 |
| 10/15 | 공식 마감: ETRI 환경 포팅 (오케스트로 마일스톤) |
| 이후 | 10/23 전체 통합·시험 절차서 → 11/2~3 중 하루 1차 공인인증시험 → 11/10 DevDay 시연 |

- 10월 공휴일: 10/3~5(개천절 대체공휴일 10/5), 10/9~11(한글날). 9/29~10/15 평일은 11일뿐이다.
- 일정 출처: 오케스트로 9/16 발표자료(7·10·12쪽), 9/16 회의록 초안 2.6절.
- 발표자료 12쪽 ETRI 질의 Q2 답변에 "AI 노트북 CRD 제어·상태 조회·IDE 프록시를 service K8s 구동 형상으로, 10/15 ETRI 환경 포팅에서 확인"이 명시되어 있다. 백엔드의 클러스터 안 실행 모드(ServiceAccount 자동 감지)가 이 요구에 해당한다.

## 2. ETRI에 확인할 것

2026-09-29 메일로 요청했다. 10/8 회신: ETRI 안에서 환경을 논의하는 중이고, 대부분은 환경 접근이 열린 뒤에 답할 수 있다.

- [ ] 쿠버네티스 종류·버전과 우리가 받을 권한 — CRD 설치·ClusterRole 생성이 필요하므로 **클러스터 관리자 권한**, 어려우면 ETRI가 대신 설치
- [ ] Kubeflow 구성요소가 이미 있는지 (있으면 버전)
- [ ] 인터넷·이미지 저장소 접근 가능 여부 — 불가하면 이미지·매니페스트 파일 반입(4장)
- [ ] 노트북 저장공간 스토리지 종류 (기본 StorageClass, ReadWriteOnce)
- [ ] 포털 접속 주소 (도메인, 인그레스 컨트롤러, TLS 인증서)
- [ ] **작업환경 계정** — 당사 접속 IP를 전달했고(9/28·9/29), IP 등록 후 계정을 받기로 함
- [ ] AI 노트북에 쓸 NPU 종류와 해당 서버의 드라이버 버전 (SDK 버전을 드라이버에 맞추기 위함)

이미 확인한 것:

- **NPU 자원 이름** (ETRI 공개 저장소 kcloud-operator 설치 설정): Rebellions ATOM `rebellions.ai/ATOM`, Furiosa RNGD `furiosa.ai/rngd`, Tenstorrent `tenstorrent.com/blackhole`.
- **NPU SDK**: Furiosa RNGD와 Tenstorrent는 공개 배포본으로 직접 확보한다. Rebellions는 핵심 컴파일러(`rebel-compiler`)만 제조사 승인 계정이 필요해 오케스트로에 전달을 요청했다.
- **ETRI service K8s 버전**: v1.34/1.35 (kcloud-magnum-capi-helm 기준). 우리 구성요소는 이보다 새 버전인 v1.36에서 이미 돌고 있어 API 호환 위험은 낮다. 설치 연습 때 한 번 더 확인한다.

## 3. 구성요소와 버전 (개발 환경에서 검증된 조합)

전부 필수다.

| 구성요소 | 버전 |
|---|---|
| Kubernetes | v1.36.2 (k3s) — ETRI v1.34/1.35 |
| cert-manager | v1.16.2 |
| Istio CRD | release-1.24 (Profile 컨트롤러 의존, Istio 본체는 불필요) |
| Notebook 컨트롤러 | kubeflow v1.10.0 |
| Profile 컨트롤러 + KFAM | kubeflow v1.10.0 |
| Kubeflow Pipelines | 2.4.0 (Argo workflow-controller·argoexec v3.4.17, MySQL 8.0.26, ML Metadata 1.14.0) |
| MinIO | RELEASE.2019-08-14 (KFP 내장, 모델 저장소 겸용) |
| Katib | v0.17.0 (DB MySQL 8.0.29) |
| KServe | v0.14.1 (RawDeployment 모드) |
| AI 노트북 백엔드 | okc-ai-backend:0.1 |
| AI 노트북 포털 | okc-ai-portal:0.1 |

## 4. 이미지와 매니페스트 준비

### 4-1. 우리 이미지

이 PC(WSL 도커)에서 빌드한다.

```bash
# 백엔드
cd cmp-backend && docker build -t okc-ai-backend:0.1 .
# 포털 (same-origin 모드: 포털과 백엔드를 한 주소로 연다)
cd openkcloud && docker build -t okc-ai-portal:0.1 .
```

### 4-2. 가져갈 이미지 목록 (2026-09-29 조사)

이 PC 클러스터에서 쓰는 이미지 44개에, 기능을 실행할 때만 내려받는 이미지를 더했다. 용량은 containerd 또는 Docker Hub의 압축 크기라 파일로 내보내면 더 커질 수 있다. 전체 목록은 `deploy/offline/images.txt`에 구분별로 정리했고, 반입 스크립트는 주석과 [불필요] 구역을 건너뛴다.

| 구분 | 개수 | 용량 | ETRI에 필요 여부 |
|---|---|---|---|
| Kubeflow·KServe·cert-manager 등 스택 | 30 | 약 2.3GB | 필수 |
| 우리 이미지 (백엔드 434MB, 포털 1.74GB) | 2 | 약 2.2GB | 필수 |
| 기능 실행 때 내려받는 이미지: 파이프라인 launcher, HPO 알고리즘 3종(random·grid·bayesian)과 지표 수집기, HPO 시험용 python:3.11-slim, 모델 배포 sklearn·xgboost·tensorflow 런타임 | 9 | 약 1.3GB | 필수 |
| 노트북 CPU용 2종(codeserver-python, jupyter-scipy), torchserve-kfs 0.9.0, jupyter-pytorch-cuda-full(데모 학습 파이프라인·실측 HPO가 사용, CPU에서도 동작) | 4 | 약 6.6GB | 필수 |
| vllm-openai v0.6.3, torchserve-kfs 0.9.0-gpu | 2 | 약 8.7GB | GPU 노드를 쓸 때만. NPU는 vllm-rbln·furiosa-llm 이미지 별도 |
| kfp-visualization-server 2.4.0 | 1 | 약 1.6GB | 선택 |
| k3s 시스템 (rancher/*, coredns, traefik, metrics-server, local-path) | 6 | 약 0.3GB | 불필요 — ETRI 클러스터 것 사용 |
| NVIDIA device plugin, cuda base | 2 | 약 0.3GB | 불필요 — ETRI는 kcloud-operator가 관리 |

- 필수 합계는 45개, 약 12.3GB다. GPU용까지 가져가면 약 21GB다.
- 사용자가 올리는 파이프라인 YAML이 다른 이미지를 쓰면 그 이미지도 따로 반입해야 한다.
- 인터넷·레지스트리가 되면: ETRI(또는 사설) 레지스트리에 태그를 바꿔 push하고 `okc-ai.yaml`과 Kubeflow 매니페스트의 image를 그 주소로 바꾼다.
- 폐쇄망이면: `docker save … -o 파일.tar`로 묶어 반입하고, 각 노드에서 `ctr -n k8s.io images import 파일.tar` (k3s는 `k3s ctr images import`).

### 4-3. 매니페스트

README 3-1의 설치 명령은 `kubectl apply -k github.com/…`처럼 인터넷에서 매니페스트를 받는다. 폐쇄망에 대비해 **파일로 받아 두었다**(2026-09-29, `deploy/offline/manifests/` 9개). 반입할 때는 이미지 주소 교체까지 반영한다.

| 파일 | 내용 |
|---|---|
| 01-istio-crd-1.24.yaml | Istio CRD (Profile 컨트롤러 의존) |
| 02-notebook-controller-v1.10.0.yaml | Notebook 컨트롤러 (standalone) |
| 03-profile-controller-v1.10.0.yaml | Profile 컨트롤러 + KFAM |
| 04-kfp-cluster-scoped-2.4.0.yaml | KFP 클러스터 범위 자원 (CRD 등) |
| 05-kfp-platform-agnostic-2.4.0.yaml | KFP 본체 |
| 06-katib-standalone-v0.17.0.yaml | Katib |
| 07-cert-manager-v1.16.2.yaml | cert-manager |
| 08-kserve-v0.14.1.yaml | KServe |
| 09-kserve-cluster-resources-v0.14.1.yaml | KServe 기본 서빙 런타임 |
| 10-vllm-openai-runtime.yaml | LLM 배포용 vLLM 서빙 런타임 (개발 클러스터에서 직접 만들어 쓰던 것을 파일로 정리) |

- `05-kfp-platform-agnostic-2.4.0.yaml`은 gcr.io에서 지워진 이미지 2개를 이미 바꿔 두었다: MinIO → `docker.io/minio/minio:RELEASE.2019-08-14T20-37-41Z`, argoexec → `quay.io/argoproj/argoexec:v3.4.17`.
- **그 MinIO 이미지도 Docker Hub에서 삭제되었다**(2026-09-29 확인). 개발 PC 운영 클러스터에 남은 사본을 `C:\Okestro\etri-bundle\images\`에 파일로 꺼내 두었고, ETRI에 인터넷이 되더라도 이 파일로 넣어야 한다. 나머지 45개는 인터넷 저장소에 있음을 확인했다.

## 5. 설치

`deploy/offline/install.sh` 하나로 설치한다. 매니페스트는 파일에서 읽고, 여러 번 돌려도 된다.

```bash
cp deploy/offline/values.env.example deploy/offline/values.env   # 값 채우기 (저장소에 올리지 않음)
KUBECONFIG=<ETRI kubeconfig> VALUES=deploy/offline/values.env deploy/offline/install.sh
# 단계를 골라 다시 돌릴 수도 있다
KUBECONFIG=… deploy/offline/install.sh kserve okcai verify
```

| 단계 | 하는 일 |
|---|---|
| crd | Istio CRD |
| notebook | Notebook 컨트롤러 |
| profile | kubeflow 네임스페이스, Profile 컨트롤러 + KFAM |
| kfp | KFP 2.4.0, argoexec 설정 |
| katib | Katib |
| certmanager | cert-manager, 웹훅 준비 대기 |
| kserve | KServe, 서빙 런타임, vLLM 런타임, RawDeployment 전환 |
| okcai | AI 노트북 — `okc-ai.yaml`에 values 값을 넣어 적용, MinIO 접근키는 KFP 비밀에서 자동으로 읽음 |
| verify | 정상이 아닌 파드·Deployment 출력 |

- `KUBECONFIG`를 일부러 요구한다. 기본 설정 파일로 엉뚱한 클러스터에 설치하지 않기 위해서다. `PROTECT_SERVER`에 적은 API 주소에는 설치를 거부한다.
- 개발 클러스터에만 있는 설정은 옮기지 않는다: 워크플로 기본값의 `runtimeClassName: nvidia`와 `gps-ud56fin` 노드 고정, GPU 메트릭 DaemonSet, NVIDIA device plugin.

### 반드시 바꿀 값 (`okc-ai.yaml`)

| 위치 | 키 | 설명 |
|---|---|---|
| Secret | `CMP_SESSION_SECRET` | 임의의 긴 문자열 (로그인 세션 서명) |
| Secret | `CMP_USERS` | `아이디:비밀번호:역할` 콤마 구분. 역할은 admin/user. IAM 연동 전 임시 |
| Secret | `MODEL_STORE_KEY/SECRET` | MinIO 접근키 |
| ConfigMap | `PUBLIC_BASE_URL`, `CORS_ORIGINS` | 브라우저가 여는 포털 주소 |
| ConfigMap | `ACCEL_RESOURCE` | 가속기 자원 이름. GPU `nvidia.com/gpu`, NPU는 2장의 자원 이름 |
| ConfigMap | `GPU_RUNTIME_CLASS` | 기본 빈 값. NVIDIA 런타임클래스가 따로 있는 클러스터만 `nvidia` |
| Ingress | `host` | 포털 도메인. `/api`·`/notebook`은 백엔드, 나머지는 포털 |

## 6. NPU 적용 시 할 일

1. `ACCEL_RESOURCE`를 NPU 자원 이름으로 바꾼다 — 노트북 생성, 쿼터(`requests.<이름>`), 서빙, 가용량 계산이 모두 이 값을 쓴다. 한 설치에서 가속기 종류는 하나다.
2. NPU SDK가 들어간 노트북 이미지를 만들고, 포털 노트북 템플릿의 "RBLN ATOM SDK" 카드를 그 이미지로 연결한다. SDK 버전은 NPU 서버 드라이버 버전에 맞춘다 (예: ETRI node5 ATOM+는 6월 기준 드라이버 3.0.0 ↔ SDK 0.10.3).
3. 성능 분석의 "GPU 실측"은 `nvidia-smi` 기반이라 NPU에서는 동작하지 않는다 — NPU 모니터링 도구(또는 이노그리드 모니터링 API의 가속기 지표)로 바꾸는 작업이 따로 필요하다.
4. GPU time-slicing 설정(`deploy/nvidia-device-plugin-timeslicing.yaml`)은 GPU 전용이므로 적용하지 않는다.

## 7. 학습 파이프라인(데모 dm-code-train) ETRI판

개발 PC용 파이프라인 파일에는 개발 환경 전용 값이 박혀 있어 그대로 쓰면 안 된다: 개발 PC의 호스트 프록시(포트 3128)와 클러스터 밖 백엔드 주소(포트 8000). 2026-09-29에 `pipelines/dm_train_pipeline.py`를 환경변수로 값을 받도록 바꿨다(개발 PC 값으로 컴파일하면 기존 YAML과 같음을 확인).

```bash
# ETRI판 (프록시 없음, 백엔드는 클러스터 안 okc-ai-backend.okc-ai.svc:8000)
PIPELINE_OUT=dm_train_pipeline_etri.yaml python dm_train_pipeline.py
# GPU가 없으면 CPU로 학습
TRAIN_ACCEL= PIPELINE_OUT=dm_train_pipeline_etri.yaml python dm_train_pipeline.py
```

- 컴파일은 kfp 2.7.0이 필요하고 파이썬 3.12 이하에서 된다. WSL 기본 파이썬(3.14)에서는 설치가 안 되어 `python:3.11-slim` 컨테이너 안에서 컴파일했다.
- **인터넷 의존**: 각 단계가 실행 중에 pip로 kfp·minio·httpx·torch-model-archiver를 받고, 학습 단계는 ResNet18 사전학습 가중치를 내려받는다. ETRI가 폐쇄망이면 이 패키지와 가중치를 미리 넣은 학습 이미지를 만들어 `TRAIN_IMAGE`로 지정해야 한다(남은 일).
- 데이터셋 `s3://datasets/dm-code/dm_dataset.tgz`는 개발 PC MinIO에만 있다. ETRI MinIO에 따로 올려야 한다(남은 일).

## 8. 이 PC에서 검증한 것

2026-09-28 — 이 PC의 k3s에 `okc-ai` 네임스페이스로 설치해 확인했다.

- 목록 API 6종(워크스페이스·노트북·서비스·실험·파이프라인·GPU)이 개발 서버와 같은 결과
- 인그레스 한 주소로 포털 화면(/login, /ai-development) 200
- 로그인(틀린 비밀번호 401, 맞는 비밀번호 200)
- 노트북 IDE 주소 발급과 IDE 열기(JupyterLab) 200 — 클러스터 안 백엔드의 kubectl port-forward 경유

2026-09-29 — **처음부터 설치 연습** (이 PC 도커 안 별도 클러스터 k3d, ETRI와 같은 **K8s v1.34.11**, 운영 클러스터와 분리).

- `install.sh` 9단계 전부 성공, 약 9분 (12:13 → 12:22). 모든 파드 Running.
- 기능 시험 (포털 인그레스로만 호출)

| 항목 | 결과 |
|---|---|
| 화면 3개(로그인, AI 노트북, 워크스페이스), API 목록 8종 | 모두 200 |
| 로그인 (맞는/틀린 비밀번호) | 200 / 401 |
| 워크스페이스 생성 | 네임스페이스·자원 한도 생성 |
| 노트북 생성 → IDE 열기 | Running, IDE 200 |
| HPO 실험 (random, 2회) | 2회 모두 성공 |
| 노트북 파일 → 모델 저장소 → sklearn 배포 → 예측 | 새 워크스페이스에 저장소 계정 자동 생성, 예측 응답 정상 |
| 파이프라인 업로드 → 실행 | SUCCEEDED |

- 연습에서 찾아 고친 것
  1. MinIO 이미지가 Docker Hub에서 삭제됨 → 개발 PC 사본을 파일로 반입 (4-3).
  2. 새 워크스페이스에서 저장소 모델 배포가 실패함(저장소 계정이 손으로 만든 3개 네임스페이스에만 있었음) → 백엔드가 배포 때 자동으로 만들도록 수정, 연습에서 확인.
  3. KFP 매니페스트의 삭제된 gcr 이미지 2개 → 파일에서 교체.
  4. 파이프라인 파일의 개발 PC 전용 프록시·백엔드 주소 → 환경변수로 컴파일 (7장).
  5. vLLM 서빙 런타임이 개발 클러스터에만 있었음 → `10-vllm-openai-runtime.yaml`로 정리.
  6. 이 PC의 파일 감시(inotify) 한도가 이미 초과 상태(128개 중 130개 사용)여서 연습 클러스터가 뜨지 않았음 → 런타임으로 1024까지 올림. 개발 PC 문제이며 ETRI와는 무관하다.
- 연습 클러스터는 9/30 개발 PC 디스크 확보를 위해 지웠다. 다시 세우는 순서는 `deploy/offline/rehearsal/README.md`에 있다(약 15~20분).

2026-09-29 — 버전·이미지 조사.

- 서버 v1.36.2+k3s1, 노드 3대(yoon은 v1.36.3), containerd 2.3.2
- 사용 중 이미지 44개를 4-2의 표로 분류

## 9. 알려진 제약

- 백엔드는 **1대로만** 운영한다 — 노트북 연결(port-forward)과 접속 기록을 프로세스가 들고 있다.
- 로그인은 임시 방식(계정 목록 + 서명 쿠키)이다. 프로젝트 소속·권한은 포털 인증 체계가 정해지면 연결한다. 오케스트로 발표자료에는 포털·AI 노트북 API·IDE를 Keycloak 한 realm으로 묶는 계획이 있다.
- 포털 이미지가 1.7GB로 크다 — Next.js standalone 출력으로 줄일 수 있다(후속).
- 성능 분석의 GPU 실측·부하 테스트·프로파일링은 NVIDIA GPU 전제다(6장 3번).
- 백엔드 권한(ClusterRole)은 호출하는 API 기준으로 좁혀 두었지만 네임스페이스 생성·삭제를 동반하는 Profile 관리 때문에 범위가 넓은 편이다.
