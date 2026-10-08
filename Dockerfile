# openKcloud AI 노트북 — CMP 백엔드 이미지
#   빌드:  docker build -t okc-ai-backend:0.1 .
#   실행:  클러스터 안에서 Deployment로 (deploy/k8s/backend.yaml)
#          ServiceAccount 권한으로 쿠버네티스 API에 접속한다 (IN_CLUSTER 자동 감지)
FROM python:3.12-slim

# 노트북 IDE 연결·파일 복사에 kubectl(port-forward, exec)을 쓴다
ARG KUBECTL_VERSION=v1.31.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL -o /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
 && chmod +x /usr/local/bin/kubectl \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .

# 세션 키 파일 위치(CMP_SESSION_SECRET을 주면 파일은 쓰지 않는다)
ENV CMP_SECRET_FILE=/tmp/.cmp-secret \
    PYTHONUNBUFFERED=1
EXPOSE 8000
USER 1000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
