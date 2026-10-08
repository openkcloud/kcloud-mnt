#!/bin/bash
# 연습용 설정값 — 시험용 비밀번호는 여기서 무작위로 만들고 화면에 찍지 않는다
set -e
R=/opt/okc-rehearsal; mkdir -p $R; umask 077
if [ ! -f $R/values.env ]; then
  pa=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 16)
  pu=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 16)
  cat > $R/values.env <<V
OKC_HOST=okc-ai.localhost
PUBLIC_BASE_URL=http://okc-ai.localhost:18080
CMP_USERS='admin:${pa}:admin,user:${pu}:user'
ACCEL_RESOURCE=nvidia.com/gpu
GPU_RUNTIME_CLASS=
OKC_BACKEND_IMAGE=okc-ai-backend:0.2
OKC_PORTAL_IMAGE=okc-ai-portal:0.2
PROTECT_SERVER=https://127.0.0.1:6443
V
fi
echo "values.env 준비 (권한 $(stat -c %a $R/values.env))"
