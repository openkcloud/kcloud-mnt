"""서비스 클러스터 내부 K8s 리소스 조회 — 선택된 클러스터의 API 를 직접 질의.

경로 규칙: /clusters/{id}/... (프론트의 전역 클러스터 선택기와 1:1).
쓰기(CRUD)는 다음 단계 — 여기는 읽기만.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..k8s_client import k8s_get

router = APIRouter(tags=["k8s"])


def _err(e: Exception) -> HTTPException:  # noqa: ANN001
    return HTTPException(status_code=502, detail=f"k8s api error: {type(e).__name__}: {e}")


def _ns_path(base_all: str, base_ns: str, namespace: str | None) -> str:
    return base_ns.format(ns=namespace) if namespace else base_all


# 가속기 리소스 키(limits) — 벤더 디바이스 플러그인
_ACCEL_KEYS = ("nvidia.com/gpu", "furiosa.ai/npu", "furiosa.ai/rngd", "rebellions.ai/atom", "samsung.com/pim")


def _accel_of(containers: list[dict]) -> dict | None:
    for c in containers:
        limits = (c.get("resources") or {}).get("limits") or {}
        for k in _ACCEL_KEYS:
            if k in limits:
                return {"kind": k, "count": int(limits[k])}
    return None


def _requests_of(containers: list[dict]) -> dict:
    cpu = mem = ""
    for c in containers:
        req = (c.get("resources") or {}).get("requests") or {}
        cpu = cpu or req.get("cpu", "")
        mem = mem or req.get("memory", "")
    return {"cpu": cpu, "memory": mem}


@router.get("/clusters/{cluster_id}/namespaces")
def namespaces(cluster_id: str):
    try:
        d = k8s_get(cluster_id, "/api/v1/namespaces")
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    return {"items": [n["metadata"]["name"] for n in d.get("items", [])]}


@router.get("/clusters/{cluster_id}/workloads")
def workloads(cluster_id: str, namespace: str | None = Query(None)):
    """Deployment·StatefulSet·DaemonSet·Job·CronJob 통합 목록."""
    kinds = [
        ("Deployment", "/apis/apps/v1/deployments", "/apis/apps/v1/namespaces/{ns}/deployments"),
        ("StatefulSet", "/apis/apps/v1/statefulsets", "/apis/apps/v1/namespaces/{ns}/statefulsets"),
        ("DaemonSet", "/apis/apps/v1/daemonsets", "/apis/apps/v1/namespaces/{ns}/daemonsets"),
        ("Job", "/apis/batch/v1/jobs", "/apis/batch/v1/namespaces/{ns}/jobs"),
        ("CronJob", "/apis/batch/v1/cronjobs", "/apis/batch/v1/namespaces/{ns}/cronjobs"),
    ]
    out: list[dict] = []
    try:
        for kind, all_p, ns_p in kinds:
            for it in k8s_get(cluster_id, _ns_path(all_p, ns_p, namespace)).get("items", []):
                meta, spec, status = it.get("metadata", {}), it.get("spec", {}), it.get("status", {})
                if kind == "CronJob":
                    tpl = spec.get("jobTemplate", {}).get("spec", {}).get("template", {}).get("spec", {})
                else:
                    tpl = spec.get("template", {}).get("spec", {})
                containers = tpl.get("containers", []) or []

                if kind == "Deployment" or kind == "StatefulSet":
                    ready, total = status.get("readyReplicas", 0), spec.get("replicas", 0)
                    state = "Running" if ready and ready == total else ("Pending" if total else "Stopped")
                elif kind == "DaemonSet":
                    ready, total = status.get("numberReady", 0), status.get("desiredNumberScheduled", 0)
                    state = "Running" if ready and ready == total else "Pending"
                elif kind == "Job":
                    ready, total = status.get("succeeded", 0) or status.get("active", 0), spec.get("completions", 1) or 1
                    state = "Succeeded" if status.get("succeeded") else ("Failed" if status.get("failed") else "Running")
                else:  # CronJob
                    ready, total = len(status.get("active", []) or []), 0
                    state = "Suspended" if spec.get("suspend") else "Running"

                out.append({
                    "name": meta.get("name", ""),
                    "namespace": meta.get("namespace", ""),
                    "kind": kind,
                    "image": containers[0].get("image", "") if containers else "",
                    "ready": ready,
                    "total": total,
                    "requests": _requests_of(containers),
                    "accelerator": _accel_of(containers),
                    "schedule": spec.get("schedule", "") if kind == "CronJob" else "",
                    "status": state,
                    "labels": meta.get("labels") or {},
                    "createdAt": meta.get("creationTimestamp", ""),
                })
    except Exception as e:  # noqa: BLE001
        raise _err(e)
    return {"items": out}


@router.get("/clusters/{cluster_id}/services")
def services(cluster_id: str, namespace: str | None = Query(None)):
    """Service + Ingress."""
    try:
        svc = k8s_get(cluster_id, _ns_path("/api/v1/services", "/api/v1/namespaces/{ns}/services", namespace))
        ing = k8s_get(cluster_id, _ns_path(
            "/apis/networking.k8s.io/v1/ingresses", "/apis/networking.k8s.io/v1/namespaces/{ns}/ingresses", namespace))
    except Exception as e:  # noqa: BLE001
        raise _err(e)

    services_out = []
    for it in svc.get("items", []):
        meta, spec, status = it.get("metadata", {}), it.get("spec", {}), it.get("status", {})
        lb = (status.get("loadBalancer") or {}).get("ingress") or []
        services_out.append({
            "name": meta.get("name", ""),
            "namespace": meta.get("namespace", ""),
            "type": spec.get("type", "ClusterIP"),
            "clusterIp": spec.get("clusterIP", ""),
            "externalIp": (lb[0].get("ip") or lb[0].get("hostname")) if lb else "",
            "ports": [
                {"port": p.get("port"), "targetPort": str(p.get("targetPort", "")), "protocol": p.get("protocol", "TCP")}
                for p in spec.get("ports", []) or []
            ],
            "selector": spec.get("selector") or {},
            "createdAt": meta.get("creationTimestamp", ""),
        })

    ingresses_out = []
    for it in ing.get("items", []):
        meta, spec = it.get("metadata", {}), it.get("spec", {})
        rules = spec.get("rules", []) or []
        ingresses_out.append({
            "name": meta.get("name", ""),
            "namespace": meta.get("namespace", ""),
            "className": spec.get("ingressClassName", ""),
            "hosts": [r.get("host", "*") for r in rules],
            "tls": bool(spec.get("tls")),
            "ruleCount": len(rules),
            "createdAt": meta.get("creationTimestamp", ""),
        })
    return {"services": services_out, "ingresses": ingresses_out}


@router.get("/clusters/{cluster_id}/storage")
def storage(cluster_id: str, namespace: str | None = Query(None)):
    """PVC(네임스페이스) + PV·StorageClass(클러스터 전역, 조회용)."""
    try:
        pvc = k8s_get(cluster_id, _ns_path(
            "/api/v1/persistentvolumeclaims", "/api/v1/namespaces/{ns}/persistentvolumeclaims", namespace))
        pv = k8s_get(cluster_id, "/api/v1/persistentvolumes")
        sc = k8s_get(cluster_id, "/apis/storage.k8s.io/v1/storageclasses")
    except Exception as e:  # noqa: BLE001
        raise _err(e)

    pvcs = [{
        "name": m["metadata"].get("name", ""),
        "namespace": m["metadata"].get("namespace", ""),
        "status": m.get("status", {}).get("phase", ""),
        "volumeName": m.get("spec", {}).get("volumeName", ""),
        "capacity": (m.get("status", {}).get("capacity") or {}).get("storage", "")
            or (m.get("spec", {}).get("resources", {}).get("requests") or {}).get("storage", ""),
        "accessModes": m.get("spec", {}).get("accessModes", []) or [],
        "storageClass": m.get("spec", {}).get("storageClassName", ""),
        "createdAt": m["metadata"].get("creationTimestamp", ""),
    } for m in pvc.get("items", [])]

    pvs = [{
        "name": m["metadata"].get("name", ""),
        "capacity": (m.get("spec", {}).get("capacity") or {}).get("storage", ""),
        "accessModes": m.get("spec", {}).get("accessModes", []) or [],
        "reclaimPolicy": m.get("spec", {}).get("persistentVolumeReclaimPolicy", ""),
        "status": m.get("status", {}).get("phase", ""),
        "claim": (lambda c: f"{c.get('namespace','')}/{c.get('name','')}" if c else "")(m.get("spec", {}).get("claimRef")),
        "storageClass": m.get("spec", {}).get("storageClassName", ""),
        "csiDriver": (m.get("spec", {}).get("csi") or {}).get("driver", ""),
        "createdAt": m["metadata"].get("creationTimestamp", ""),
    } for m in pv.get("items", [])]

    scs = [{
        "name": m["metadata"].get("name", ""),
        "provisioner": m.get("provisioner", ""),
        "reclaimPolicy": m.get("reclaimPolicy", ""),
        "bindingMode": m.get("volumeBindingMode", ""),
        "isDefault": (m["metadata"].get("annotations") or {}).get(
            "storageclass.kubernetes.io/is-default-class") == "true",
        "parameters": m.get("parameters") or {},
    } for m in sc.get("items", [])]

    return {"pvcs": pvcs, "pvs": pvs, "storageClasses": scs}


@router.get("/clusters/{cluster_id}/configs")
def configs(cluster_id: str, namespace: str | None = Query(None)):
    """ConfigMap + Secret — 키 목록만(값은 반환하지 않음, 상세·쓰기는 다음 단계)."""
    try:
        cm = k8s_get(cluster_id, _ns_path("/api/v1/configmaps", "/api/v1/namespaces/{ns}/configmaps", namespace))
        sec = k8s_get(cluster_id, _ns_path("/api/v1/secrets", "/api/v1/namespaces/{ns}/secrets", namespace))
    except Exception as e:  # noqa: BLE001
        raise _err(e)

    cms = [{
        "name": m["metadata"].get("name", ""),
        "namespace": m["metadata"].get("namespace", ""),
        "keys": sorted((m.get("data") or {}).keys()),
        "createdAt": m["metadata"].get("creationTimestamp", ""),
    } for m in cm.get("items", [])]

    secrets = [{
        "name": m["metadata"].get("name", ""),
        "namespace": m["metadata"].get("namespace", ""),
        "type": m.get("type", ""),
        "keys": sorted((m.get("data") or {}).keys()),
        "createdAt": m["metadata"].get("creationTimestamp", ""),
    } for m in sec.get("items", [])]

    return {"configmaps": cms, "secrets": secrets}
