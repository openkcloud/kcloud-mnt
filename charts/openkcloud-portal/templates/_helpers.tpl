{{/* 공통 라벨 */}}
{{- define "okc.labels" -}}
app.kubernetes.io/part-of: openkcloud-portal
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* 워커 전용 affinity (global.nodeSelectorWorkerOnly) */}}
{{- define "okc.workerAffinity" -}}
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node-role.kubernetes.io/control-plane
              operator: DoesNotExist
{{- end -}}
