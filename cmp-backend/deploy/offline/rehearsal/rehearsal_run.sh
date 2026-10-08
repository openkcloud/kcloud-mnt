#!/bin/bash
# 설치 실행 + 메모리 보호(여유 1200MB 미만이면 연습 클러스터 정지)
R=/opt/okc-rehearsal; L=$R/install.log; : > $L
( while sleep 10; do a=$(free -m | awk '/Mem:/{print $7}'); if [ "$a" -lt 1200 ]; then echo "[$(date +%T)] !! 메모리 여유 ${a}MB — 운영 보호를 위해 연습 클러스터 정지" | tee -a $L; $R/bin/k3d cluster stop okc-rehearsal >> $L 2>&1; exit 0; fi; done ) &
WD=$!
KUBECONFIG=$R/kubeconfig VALUES=$R/values.env bash /mnt/c/Okestro/cmp-backend/deploy/offline/install.sh >> $L 2>&1; rc=$?
kill $WD 2>/dev/null
echo "[$(date +%T)] install.sh 종료 코드 $rc" | tee -a $L
free -m | awk '/Mem:/{print "메모리 여유 "$7"MB"}' | tee -a $L
exit $rc
