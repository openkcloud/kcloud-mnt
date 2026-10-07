"use client";
/**
 * MNT-OBS 연동 — 옵저버빌리티(KCloud Monitor v2 중개)는 MNT-OBS 모듈을 통해 가져온다.
 *
 * 주소(NEXT_PUBLIC_OBS_API):
 *   - 미설정        → http://localhost:8003 (로컬 dev, MNT-OBS 직접)
 *   - ""(빈값)      → same-origin 상대경로 (/api/obs) — 게이트웨이 운영
 *   - "http://..."  → 고정 주소
 */
import { useQuery } from "@tanstack/react-query";
import { usePollingInterval } from "@/lib/polling";

const RAW = process.env.NEXT_PUBLIC_OBS_API;
export const OBS_BASE = RAW === undefined ? "http://localhost:8003" : RAW;

export interface VendorMetrics {
  vendor: string;
  model: string | null;
  label: string;
  count: number;
  temperature_celsius: number;
  power_watts: number;
  utilization_percent: number;
  memory_used_bytes: number;
  memory_total_bytes: number | null;
  healthy_count: number;
  tdp_ratio_pct: number;
  efficiency_pct_per_watt: number;
}

export interface AcceleratorSummary {
  cluster: string;
  vendors: Record<string, VendorMetrics>;
  accelerator_count: number;
  throttled_count: number;
  source_clusters: string[];
}

export interface PowerBreakdownItem {
  key: string;
  watts: number;
  layer: string;
}
export interface PowerBreakdown {
  dimension: string;
  items: PowerBreakdownItem[];
}
export interface PowerSeriesRow {
  t: string;
  server?: number;
  cpu?: number;
  accelerator?: number;
}
export interface PowerTimeseries {
  series: PowerSeriesRow[];
}

async function obsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OBS_BASE}/api/obs${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OBS ${res.status}`);
  return res.json() as Promise<T>;
}

export function useAcceleratorSummary(cluster = "mgmt") {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["obs-accel-summary", cluster],
    queryFn: () => obsFetch<AcceleratorSummary>(`/monitoring/accelerator-summary?cluster=${cluster}`),
    refetchInterval: pollMs || false,
  });
}

export interface MonitoringOverview {
  cluster: string;
  power_efficiency_pct_per_watt: number | null;
  accelerator_utilization_percent: number | null;
  total_power_watts: number | null;
  nodes_ready: number | null;
  nodes_total: number | null;
}

export function useMonitoringOverview(cluster = "mgmt") {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["obs-overview", cluster],
    queryFn: () => obsFetch<MonitoringOverview>(`/monitoring/overview?cluster=${cluster}`),
    refetchInterval: pollMs || false,
  });
}

export function usePowerBreakdown(dimension: string) {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["obs-power-breakdown", dimension],
    queryFn: () => obsFetch<PowerBreakdown>(`/monitoring/power/breakdown?dimension=${dimension}`),
    refetchInterval: pollMs || false,
  });
}

export function usePowerTimeseries(period = "24h", step = "1h") {
  const pollMs = usePollingInterval((s) => s.intervalMs);
  return useQuery({
    queryKey: ["obs-power-timeseries", period, step],
    queryFn: () => obsFetch<PowerTimeseries>(`/monitoring/power/timeseries?period=${period}&step=${step}&aggregation=avg`),
    refetchInterval: pollMs || false,
  });
}
