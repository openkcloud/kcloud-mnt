# 설치 연습 클러스터 (개발 PC)

ETRI에 설치하기 전에 개발 PC WSL 도커 안에 빈 k3d 클러스터(K8s v1.34.11)를 만들어 `../install.sh`를 처음부터 돌려 보는 용도다. 운영 클러스터와 분리되어 있고, 운영 kubeconfig(`/root/.kube/config`)는 건드리지 않는다.

순서 (WSL, root):

```bash
sysctl -w fs.inotify.max_user_instances=1024 fs.inotify.max_user_watches=1048576   # 개발 PC 한도 초과 대비
bash rehearsal_prepare.sh     # /opt/okc-rehearsal/values.env 생성 (시험용 무작위 비밀번호)
bash rehearsal_cluster.sh     # k3d 클러스터 생성 + 우리 이미지 0.2 가져오기 (k3d: /opt/okc-rehearsal/bin/k3d v5.9.0)
/opt/okc-rehearsal/bin/k3d image import /mnt/c/Okestro/etri-bundle/images/minio-RELEASE.2019-08-14T20-37-41Z.tar -c okc-rehearsal   # Docker Hub에서 지워진 MinIO
bash rehearsal_run.sh         # install.sh 실행 (메모리 여유 1200MB 미만이면 자동 정지)
bash hello_pipeline.sh        # 시험용 파이프라인 컴파일 (python:3.11-slim 컨테이너 안에서)
bash smoke.sh                 # 기능 시험 6종
/opt/okc-rehearsal/bin/k3d cluster delete okc-rehearsal   # 끝나면 삭제 (이미지 약 25GB)
```

2026-09-29 첫 연습: 설치 9분, 기능 시험 6종 통과. 2026-09-30 디스크 확보를 위해 삭제.
