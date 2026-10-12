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


def _series_points(values) -> list[dict]:
    """[[ts, "val"], ...] → [{i, v}] (스파크라인용, 문자열 수치화)."""
    out = []
    for i, p in enumerate(values or []):
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            try:
                out.append({"i": i, "v": round(float(p[1]), 2)})
            except (TypeError, ValueError):
                pass
    return out


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
            # 파생 교체(2026-10): 전력모드/캡상태 · Throttling
            "power_state": next((x.get("power_state") for x in items if x.get("power_state")), None),
            "power_limit_percent": _avg([x.get("power_limit_percent") for x in items]),
            "capped_count": sum(1 for x in items if x.get("power_capped")),
            "throttled_count": sum(1 for x in items if x.get("throttled")),
            "throttle_reasons": sorted({r for x in items for r in (x.get("throttle_reasons") or [])}),
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
    """상단 KPI — 2026-10 이노그리드 업데이트 매핑:
    전력효율=/monitoring/power/efficiency, 가속기사용률=/monitoring/accelerators/utilization,
    서버총전력=/monitoring/power/summary, 정상노드=/monitoring/overview,
    저장소=/storage/ceph/capacity, 쓰로틀=/monitoring/throttling/timeseries(summary).
    """
    try:
        eff = monitor.get("/monitoring/power/efficiency").get("data", {})
        psum = monitor.get("/monitoring/power/summary").get("data", {})
        mov = monitor.get("/monitoring/overview").get("data", {})
        util = monitor.get("/monitoring/accelerators/utilization").get("data", {})
        ceph = monitor.get("/storage/ceph/capacity").get("data", {})
        thr = monitor.get("/monitoring/throttling/timeseries", params={"period": "24h", "step": "1h"}).get("summary", {})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")

    nodes = mov.get("nodes", {}) or {}
    return {
        "cluster": cluster,
        "power_efficiency_pct_per_watt": eff.get("avg_efficiency_pct_per_watt"),
        "accelerator_utilization_percent": util.get("avg_utilization_pct"),
        "total_power_watts": psum.get("server_total_watts"),
        "nodes_ready": nodes.get("healthy"),
        "nodes_total": nodes.get("total"),
        "storage_usage_percent": ceph.get("usage_percent"),
        "throttle_events": thr.get("throttle_events"),
        "cards_throttled": thr.get("cards_throttled"),
        "cards_total": thr.get("cards_total"),
    }


@router.get("/monitoring/top-hosts")
def top_hosts(limit: int = Query(5)):
    """상위 호스트 — /monitoring/accelerators/utilization?by=node 정렬."""
    try:
        d = monitor.get(
            "/monitoring/accelerators/utilization",
            params={"by": "node", "limit": limit, "sort_order": "desc"},
        ).get("data", {})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    return {"hosts": d.get("hosts", [])}


@router.get("/monitoring/error-logs")
def error_logs(limit: int = Query(4)):
    """최근 오류 로그 — /logs/search level=error 최신순."""
    try:
        d = monitor.get("/logs/search", params={"query": '{level="error"}', "limit": limit})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    return {"logs": d.get("data", [])}


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


@router.get("/monitoring/clusters")
def clusters():
    """클러스터 자원 현황 — /clusters 목록 + 클러스터별 /resource 병합.
    서비스 클러스터는 IPMI 없어 power.total_watts=null(화면 '—')."""
    try:
        lst = monitor.get("/clusters").get("data", [])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    rows = []
    for c in lst:
        name = c.get("name")
        res: dict = {}
        try:
            res = monitor.get(f"/clusters/{name}/resource").get("data", {})
        except Exception:  # noqa: BLE001 — 개별 클러스터 실패는 건너뜀
            pass
        resources = res.get("resources", {}) or {}
        nodes = resources.get("nodes", {}) or {}
        cpu = resources.get("cpu", {}) or {}
        mem = resources.get("memory", {}) or {}
        accel = resources.get("accelerators", {}) or {}
        power = res.get("power", {}) or {}
        rows.append({
            "cluster": name,
            "type": c.get("type"),
            "parent_cluster": c.get("parent_cluster"),
            "nodes_ready": nodes.get("ready"),
            "nodes_total": nodes.get("total"),
            "cpu_percent": cpu.get("utilization_percent"),
            "memory_percent": mem.get("utilization_percent"),
            "accelerator_total": accel.get("total"),
            "accelerator_util_percent": accel.get("avg_utilization_percent"),
            "power_watts": power.get("total_watts"),
            "status": c.get("status"),
        })
    return {"clusters": rows}


@router.get("/monitoring/kpi-timeseries")
def kpi_timeseries(period: str = Query("24h"), step: str = Query("1h")):
    """상단 KPI 스파크라인용 시계열 — 전력효율·저장소·가속기사용률·서버전력.
    (개별 실패는 빈 배열로 → 프론트는 해당 스파크라인 생략)"""
    def safe(path: str, **params):
        try:
            return monitor.get(path, params=params)
        except Exception:  # noqa: BLE001
            return {}

    def first_values(resp: dict):
        s = resp.get("series", [])
        return s[0].get("values", []) if s else []

    eff = safe("/monitoring/power/efficiency/timeseries", period=period, step=step)
    sto = safe("/storage/ceph/capacity/timeseries", period=period, step=step)
    acc = safe("/monitoring/accelerators/utilization/timeseries", period=period, step=step)
    pwr = safe("/monitoring/power/timeseries", period=period, step=step, aggregation="avg")

    server_vals = []
    for layer in pwr.get("layers", []):
        if layer.get("layer") == "server":
            server_vals = layer.get("values", [])
            break

    return {
        "power_efficiency": _series_points(first_values(eff)),
        "storage": _series_points(first_values(sto)),
        "accel_util": _series_points(first_values(acc)),
        "server_power": _series_points(server_vals),
    }


@router.get("/monitoring/nodes")
def nodes(cluster: str = Query("mgmt")):
    """노드 목록(전력 포함) — 호스트 맵 대체용(util 대신 power_watts 색상)."""
    try:
        d = monitor.get(f"/clusters/{cluster}/nodes")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"monitor api error: {type(e).__name__}: {e}")
    return {
        "nodes": [
            {
                "nodename": n.get("nodename"),
                "role": n.get("role"),
                "up": n.get("up"),
                "power_watts": n.get("power_watts"),
                "utilization_percent": n.get("utilization_percent"),
            }
            for n in d.get("nodes", [])
        ]
    }


@router.get("/monitoring/util-timeseries")
def util_timeseries(period: str = Query("24h"), step: str = Query("1h")):
    """벤더별 가속기 사용률 추세 — gpu/furiosa/rebellions_utilization (히트맵 대체).
    metrics/timeseries 가 호스트별로 분리를 안 줘서, 벤더 metric 3종을 타임스탬프로 병합."""
    metrics = {"gpu": "gpu_utilization", "furiosa": "furiosa_utilization", "rebellions": "rebellions_utilization"}
    merged: dict[str, dict] = {}
    for key, metric in metrics.items():
        try:
            resp = monitor.get(
                "/monitoring/metrics/timeseries",
                params={"metric": metric, "period": period, "step": step, "by": "hostname"},
            )
        except Exception:  # noqa: BLE001
            continue
        s = resp.get("series", [])
        values = s[0].get("values", []) if s else []
        for p in values:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                ts = p[0]
                row = merged.setdefault(ts, {"t": ts[11:16] if isinstance(ts, str) else ts})
                try:
                    row[key] = round(float(p[1]), 1)
                except (TypeError, ValueError):
                    pass
    return {"series": [merged[k] for k in sorted(merged.keys())]}
