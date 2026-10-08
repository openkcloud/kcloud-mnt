#!/bin/bash
set -e
R=/opt/okc-rehearsal; B=$R/bin/k3d
before=$(sha256sum /root/.kube/config | cut -d' ' -f1); cp -a /root/.kube/config $R/live-kubeconfig.bak
$B cluster list | grep -q '^okc-rehearsal ' && { echo "이미 있음"; } || \
$B cluster create okc-rehearsal --image rancher/k3s:v1.34.11-k3s1 --servers 1 --agents 0 --no-lb \
  --api-port 127.0.0.1:6560 -p "127.0.0.1:18080:80@server:0:direct" \
  --k3s-arg "--cluster-cidr=10.52.0.0/16@server:0" --k3s-arg "--service-cidr=10.53.0.0/16@server:0" \
  --kubeconfig-update-default=false --kubeconfig-switch-context=false --wait --timeout 300s
$B kubeconfig get okc-rehearsal > $R/kubeconfig; chmod 600 $R/kubeconfig
after=$(sha256sum /root/.kube/config | cut -d' ' -f1)
[ "$before" = "$after" ] && echo "운영 kubeconfig 변경 없음" || { echo "!! 운영 kubeconfig가 바뀜 — 백업으로 되돌림"; cp -a $R/live-kubeconfig.bak /root/.kube/config; }
echo "연습 클러스터 API: $(kubectl --kubeconfig $R/kubeconfig config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
kubectl --kubeconfig $R/kubeconfig get nodes -o custom-columns=NAME:.metadata.name,VER:.status.nodeInfo.kubeletVersion,READY:.status.conditions[-1].type --no-headers
echo "운영 클러스터 노드(확인용):"; kubectl --kubeconfig /root/.kube/config get nodes --no-headers | awk '{print "  "$1" "$2}'
$B image import okc-ai-backend:0.2 okc-ai-portal:0.2 -c okc-rehearsal 2>&1 | tail -2
