"""인프라 모니터링 — KCloud Monitor v2 중개·집계.

가속기 공통 지표: 가속기는 mgmt 의 자식 서비스 클러스터(furiosa/furiosa-okc-nb/l40s/rebellions)
노드에 있으므로, 해당 클러스터들을 순회해 가속기를 모아 벤더별로 집계한다.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..monitor_client import monitor

router = APIRouter(tags=["monitoring"])

# 벤더 → 화면 표기(목업 3열과 일치)
VENDOR_LABEL = {
    "furiosa": "Furiosa RNGD (NPU)",
    "rebellions": "Rebellions ATOM (NPU)",
    "nvidia": "NVIDIA L40S (GPU)",
}


def _collect_accelerators(cluster: str) -> list[dict]:
    """cluster(mgmt) 및 그 자식 서비스 클러스터의 모든 가속기를 모은다."""
    clusters = monitor.get("/clusters").get("data", [])
    targets = [
        c["name"] for c in clusters
        if c.get("name") == cluster or c.get("parent_cluster") == cluster
    ]
    accels: list[dict] = []
    for sc in targets:
        nodes = monitor.get(f"/clusters/{sc}/nodes").get("nodes", [])
        for n in nodes:
            nm = n.get("nodename")
            if not nm:
                continue
            data = monitor.get(f"/clusters/{sc}/nodes/{nm}/accelerators").get("data", [])
            accels.extend(data)
    return accels


def _avg(xs: list) -> float:
    vals = [x for x in xs if isinstance(x, (int, float))]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


@router.get("/monitoring/accelerator-summary")
def accelerator_summary(cluster: str = Query("mgmt")):
    """벤더별 가속기 공통 6종 + 파생 2종 집계."""
    try:
        accels = _collect_accelerators(cluster)
    except Exception as e:  # noqa: BLE001 — 상류(Monitor v2) 오류를 502로 전달
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")

    groups: dict[str, list[dict]] = {}
    for a in accels:
        groups.setdefault(a.get("vendor") or "unknown", []).append(a)

    vendors = {}
    for vendor, items in groups.items():
        vendors[vendor] = {
            "vendor": vendor,
            "model": items[0].get("model"),
            "label": VENDOR_LABEL.get(vendor, vendor),
            "count": len(items),
            # 공통 6종
            "temperature_celsius": _avg([x.get("temperature_celsius") for x in items]),
            "power_watts": _avg([x.get("power_watts") for x in items]),
            "utilization_percent": _avg([x.get("utilization_percent") for x in items]),
            "memory_used_bytes": _avg([x.get("memory_used_bytes") for x in items]),
            "memory_total_bytes": items[0].get("memory_total_bytes"),
            "healthy_count": sum(1 for x in items if x.get("healthy")),
            # 파생 2종
            "tdp_ratio_pct": _avg([x.get("power_limit_percent") for x in items]),
            "efficiency_pct_per_watt": _avg([
                (x.get("utilization_percent") or 0) / x["power_watts"]
                for x in items if x.get("power_watts")
            ]),
        }

    return {
        "cluster": cluster,
        "vendors": vendors,
        "accelerator_count": len(accels),
        "throttled_count": sum(1 for a in accels if a.get("throttled")),
        # 집계에 포함된 실제 클러스터(인포 아이콘 표시용)
        "source_clusters": sorted({a.get("cluster") for a in accels if a.get("cluster")}),
    }


@router.get("/monitoring/overview")
def overview(cluster: str = Query("mgmt")):
    """상단 KPI — 전력효율·가속기사용률·서버총전력·정상노드 (제공 중 4종)."""
    try:
        res = monitor.get(f"/clusters/{cluster}/resource").get("data", {})
        eff = monitor.get("/monitoring/power/efficiency").get("data", {})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")

    resources = res.get("resources", {}) or {}
    accel = resources.get("accelerators", {}) or {}
    nodes = resources.get("nodes", {}) or {}
    power = res.get("power", {}) or {}
    return {
        "cluster": cluster,
        "power_efficiency_pct_per_watt": eff.get("avg_efficiency_pct_per_watt"),
        "accelerator_utilization_percent": accel.get("avg_utilization_percent"),
        "total_power_watts": power.get("total_watts"),
        "nodes_ready": nodes.get("ready"),
        "nodes_total": nodes.get("total"),
    }


@router.get("/monitoring/power/breakdown")
def power_breakdown(dimension: str = Query("vendor")):
    """전력 분해 — dimension(vendor|cluster|node|accelerator)별 watts/layer 목록."""
    try:
        d = monitor.get("/monitoring/power/breakdown", params={"dimension": dimension})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    return {"dimension": d.get("dimension", dimension), "items": d.get("items", [])}


@router.get("/monitoring/power/timeseries")
def power_timeseries(period: str = Query("24h"), step: str = Query("1h"), aggregation: str = Query("avg")):
    """전력 시계열 3계층(server/cpu/accelerator) — 타임스탬프 기준으로 병합, 문자열 watts→수치."""
    try:
        d = monitor.get(
            "/monitoring/power/timeseries",
            params={"period": period, "step": step, "aggregation": aggregation},
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    merged: dict[str, dict] = {}
    for layer in d.get("layers", []):
        name = layer.get("layer")
        for point in layer.get("values", []):
            if not isinstance(point, (list, tuple)) or len(point) < 2:
                continue
            ts, val = point[0], point[1]
            row = merged.setdefault(ts, {"t": ts[11:16] if isinstance(ts, str) else ts})
            try:
                row[name] = round(float(val), 1)
            except (TypeError, ValueError):
                pass
    series = [merged[k] for k in sorted(merged.keys())]
    return {"series": series}
