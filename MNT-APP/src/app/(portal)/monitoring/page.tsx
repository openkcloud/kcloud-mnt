"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  Database,
  HardDrive,
  Zap,
  Info,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { cn, formatNumber } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  useAcceleratorSummary,
  useMonitoringOverview,
  usePowerBreakdown,
  usePowerTimeseries,
  type VendorMetrics,
} from "@/lib/obs-api";

// Datadog "Top List" style data
const TOP_HOSTS = [
  { name: "gpu-node-02.openkcloud", value: 92, unit: "%" },
  { name: "gpu-node-01.openkcloud", value: 78, unit: "%" },
  { name: "atom-node-01.openkcloud", value: 64, unit: "%" },
  { name: "atom-node-02.openkcloud", value: 51, unit: "%" },
  { name: "npu-node-01.openkcloud", value: 42, unit: "%" },
  { name: "pim-node-01.openkcloud", value: 18, unit: "%" },
];
// 클러스터 자원 현황 — GET /clusters/{cluster}/resource
const CLUSTER_RESOURCE = [
  { cluster: "mgmt", type: "management", nodes: "8 / 8", cpu: "1.8%", mem: "6.5%", acc: "4장 · 0%", watts: 2306.0 },
  { cluster: "l40s", type: "service", nodes: "1 / 1", cpu: "—", mem: "12.4%", acc: "1장 · 0%", watts: 144.9 },
  { cluster: "furiosa", type: "service", nodes: "1 / 1", cpu: "—", mem: "8.1%", acc: "2장 · 0%", watts: 41.3 },
  { cluster: "furiosa-1348", type: "service", nodes: "1 / 1", cpu: "—", mem: "7.3%", acc: "1장 · 0%", watts: 36.7 },
  { cluster: "rebellions", type: "service", nodes: "1 / 1", cpu: "—", mem: "5.2%", acc: "1장 · 0%", watts: 18.4 },
];

// 최근 오류 로그 — GET /logs/search?log_level=error
const RECENT_ERRORS = [
  { ts: "16:22:41", level: "error", cluster: "mgmt", message: "neutron-server: connection to RabbitMQ timed out (attempt 3/5)", field: "" },
  { ts: "16:19:08", level: "error", cluster: "l40s", message: "NVRM: Xid (PCI:0000:00:05): 43, pid=12894, Ch 00000018", field: "XID 43" },
  { ts: "16:14:52", level: "warning", cluster: "furiosa", message: "furiosa-device-plugin: device npu0 temperature 79C approaching limit", field: "" },
  { ts: "16:08:30", level: "error", cluster: "mgmt", message: "kubelet: Memory cgroup out of memory: Killed process 20481 (python3)", field: "OOM" },
];

// Heatmap data — 24h × hosts
const HOST_NAMES = ["gpu-01", "gpu-02", "npu-01", "atom-01", "atom-02", "pim-01"];
const HEATMAP = HOST_NAMES.map((h) =>
  Array.from({ length: 24 }, (_, i) => ({
    host: h,
    hour: i,
    value: Math.round(
      30 + Math.sin((i / 24) * Math.PI * 2 + HOST_NAMES.indexOf(h)) * 25 + (i % 4) * 4,
    ),
  })),
);

// 가속기 3종 공통 지표 — 공통 6종 + 파생 2종
const COMMON_METRICS = [
  { name: "온도", unit: "℃", rngd: "54", atom: "47", l40s: "63", note: "임계 85" },
  { name: "전력", unit: "W", rngd: "118.6", atom: "61.2", l40s: "242.8", note: "실시간" },
  { name: "사용률", unit: "%", rngd: "48", atom: "39", l40s: "71", note: "코어 사용률" },
  { name: "메모리 사용량", unit: "", rngd: "22.6 GB", atom: "7.8 GB", l40s: "28.4 GiB", note: "총량 대비" },
  { name: "메모리 총량", unit: "", rngd: "51.0 GB", atom: "16.9 GB", l40s: "46.1 GiB", note: "장치 탑재 용량" },
  { name: "health", unit: "", rngd: "1 정상", atom: "1 정상", l40s: "1 정상", note: "1 = 정상" },
  { name: "전력효율(파생)", unit: "%/W", rngd: "0.40", atom: "0.64", l40s: "0.29", note: "사용률 ÷ 전력" },
  { name: "TDP 대비 전력(파생)", unit: "%", rngd: "65.9", atom: "72.0", l40s: "69.4", note: "TDP 180W · 85W · 350W" },
];

// MNT-OBS 가속기 공통 지표 응답(벤더별)을 표 8행으로 변환. 데이터 없으면 목업 폴백.
function fmtGB(bytes: number | null | undefined) {
  return bytes ? `${(bytes / 1e9).toFixed(1)} GB` : "—";
}
function fmtN(x: number | null | undefined, digits: number) {
  return x == null ? "—" : x.toFixed(digits);
}
function buildAccelRows(v?: Record<string, VendorMetrics>) {
  if (!v) return COMMON_METRICS;
  const cell = (vendor: string, fn: (m: VendorMetrics) => string) => {
    const m = v[vendor];
    return m ? fn(m) : "—";
  };
  const defs: { name: string; unit: string; note: string; get: (m: VendorMetrics) => string }[] = [
    { name: "온도", unit: "℃", note: "임계 85", get: (m) => m.temperature_celsius.toFixed(1) },
    { name: "전력", unit: "W", note: "장치당 평균", get: (m) => m.power_watts.toFixed(1) },
    { name: "사용률", unit: "%", note: "코어 사용률", get: (m) => m.utilization_percent.toFixed(0) },
    { name: "메모리 사용량", unit: "", note: "총량 대비", get: (m) => fmtGB(m.memory_used_bytes) },
    { name: "메모리 총량", unit: "", note: "장치 탑재 용량", get: (m) => fmtGB(m.memory_total_bytes) },
    { name: "health", unit: "", note: "정상/전체", get: (m) => `${m.healthy_count}/${m.count} 정상` },
    { name: "전력효율(파생)", unit: "%/W", note: "사용률 ÷ 전력", get: (m) => m.efficiency_pct_per_watt.toFixed(2) },
    { name: "TDP 대비 전력(파생)", unit: "%", note: "전력 ÷ TDP", get: (m) => m.tdp_ratio_pct.toFixed(1) },
  ];
  return defs.map((d) => ({
    name: d.name,
    unit: d.unit,
    note: d.note,
    rngd: cell("furiosa", d.get),
    atom: cell("rebellions", d.get),
    l40s: cell("nvidia", d.get),
  }));
}

// Sparkline series
function sparkline(seed: number, len = 24, base = 50, amp = 30) {
  return Array.from({ length: len }, (_, i) => ({
    i,
    v: base + Math.sin(i / 3 + seed) * amp + (Math.sin(seed * i) * 5),
  }));
}

export default function MonitoringOverviewPage() {
  const { data: accel } = useAcceleratorSummary("mgmt");
  const commonMetrics = buildAccelRows(accel?.vendors);
  const { data: ov } = useMonitoringOverview("mgmt");
  const { data: powerTs } = usePowerTimeseries();
  const psLast = powerTs?.series?.[powerTs.series.length - 1];
  return (
    <div className="space-y-4">
      {/* KPI band — Datadog "Query Value" widgets */}
      <ChangeMark ids={["CR-OBS-01", "CR-OBS-02", "CR-OBS-03"]}>
<div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
        <strong>구성 기준</strong> — 이 화면의 모든 항목은 <strong>모니터링 API v2</strong>가 실제로 주는 응답 필드로만 구성했다. 카드·표마다 조회 경로를 함께 표시한다.
        서비스 응답 지연(P50/P95/P99)·에러율·추론 RPS는 API에 없어 화면에서 뺐고, 전력 효율 · 저장소 사용률 · 쓰로틀링 횟수로 대신한다.
        저장소 사용률은 노드 로컬 디스크 기준이며(공유 스토리지 용량 API는 준비 중), 쓰로틀링 횟수는 가속기 부가 메트릭이라 벤더에 따라 값이 없을 수 있다.
      </div>
</ChangeMark>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <QueryValue label="전력 효율" value={fmtN(ov?.power_efficiency_pct_per_watt, 2)} unit="%/W" delta={0} sparkData={sparkline(1, 24, 42, 6)} color="mint" connected={!!ov} />
        <QueryValue label="저장소 사용률" value="62" unit="%" delta={0} sparkData={sparkline(2, 24, 60, 4)} color="indigo" connected={false} />
        <QueryValue label="쓰로틀 장치" value={accel ? String(accel.throttled_count) : "—"} unit={accel ? `/ ${accel.accelerator_count}대` : "대"} delta={0} sparkData={sparkline(3, 24, 12, 8)} color="rose" connected={!!accel} />
        <QueryValue label="가속기 사용률" value={fmtN(ov?.accelerator_utilization_percent, 0)} unit="%" delta={0} sparkData={sparkline(4, 24, 65, 15)} color="violet" connected={!!ov} />
        <QueryValue label="서버 총 전력" value={ov?.total_power_watts != null ? (ov.total_power_watts / 1000).toFixed(2) : "—"} unit="kW" delta={0} sparkData={sparkline(5, 24, 9, 1.2)} color="amber" connected={!!ov} />
        <QueryValue label="정상 노드" value={ov?.nodes_ready != null ? `${ov.nodes_ready} / ${ov.nodes_total}` : "—"} unit="" delta={0} sparkData={sparkline(6, 24, 6, 0)} color="sky" connected={!!ov} />
      </div>

      {/* 가속기 3종 공통 지표 — 2차 워크샵 이노그리드 p.22~23 (CR-OBS-04) */}
      <ChangeMark ids={["CR-OBS-04"]}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            가속기 공통 지표
            <span className="flex items-center gap-1.5">
              <InfoHint
                text={
                  accel?.source_clusters?.length
                    ? `집계 클러스터 (${accel.source_clusters.length}개)\n${accel.source_clusters.join(", ")}\n\nmgmt 관리도메인 하위 서비스클러스터의 가속기를 벤더(RNGD·ATOM·L40S)로 묶어 집계합니다.`
                    : "mgmt 관리도메인 하위 서비스클러스터의 가속기를 벤더별로 집계합니다."
                }
              />
              <StatusTag connected />
            </span>
          </CardTitle>
          <CardDescription>공통 6종 + 파생 2종을 GPU·NPU 같은 지표 이름으로 조회한다.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">지표</th>
                <th className="py-1.5 pr-3 font-medium">Furiosa RNGD (NPU)</th>
                <th className="py-1.5 pr-3 font-medium">Rebellions ATOM (NPU)</th>
                <th className="py-1.5 pr-3 font-medium">NVIDIA L40S (GPU)</th>
                <th className="py-1.5 font-medium">비고</th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top">
              {commonMetrics.map((m) => (
                <tr key={m.name} className="border-b border-border/60 last:border-0">
                  <td className="font-medium">{m.name}<span className="ml-1 text-muted-foreground">{m.unit}</span></td>
                  <td className="font-mono tabular-nums">{m.rngd}</td>
                  <td className="font-mono tabular-nums">{m.atom}</td>
                  <td className="font-mono tabular-nums">{m.l40s}</td>
                  <td className="text-muted-foreground">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      </ChangeMark>

      {/* Hexagonal host map + Heatmap */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              호스트 맵
              <StatusTag />
            </CardTitle>
            <CardDescription>노드별 가속기 사용률 — 색상 = 부하</CardDescription>
          </CardHeader>
          <CardContent>
            <HexHostMap />
            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-brand-mint-400" /> &lt; 40%
              </div>
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-amber-400" /> 40-75%
              </div>
              <div className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-rose-500" /> &gt; 75%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              활용률 히트맵 (24h × 호스트)
              <StatusTag />
            </CardTitle>
            <CardDescription>metric=gpu_utilization · period=24h · step=1h 응답을 호스트×시간으로 편다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Heatmap />
          </CardContent>
        </Card>
      </div>

      {/* Top lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              상위 호스트 — 가속기 사용률
              <StatusTag />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TOP_HOSTS.map((h, i) => (
              <TopRow key={h.name} idx={i + 1} name={h.name} value={h.value} unit={h.unit} max={100} />
            ))}
          </CardContent>
        </Card>

        <PowerBreakdownCard />
      </div>

      {/* 전력 시계열 + 최근 오류 로그 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              전력 시계열 — 계층별
              <span className="flex items-center gap-1.5">
                <InfoHint text={"server(IPMI 실측) ⊃ cpu(Kepler 추정) + accelerator(벤더 exporter) + 기타.\n포함 관계라 합산하지 않고 독립 3라인으로 표시합니다.\n원천: /monitoring/power/timeseries (24h·1h·avg)"} />
                <StatusTag connected={!!powerTs} />
              </span>
            </CardTitle>
            <CardDescription>server(IPMI 실측) · cpu(추정) · accelerator(벤더 exporter) 세 계층을 같은 축에 둔다. period·step·aggregation으로 구간을 바꾼다.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                server: { label: "server", color: "var(--brand-indigo-500)" },
                cpu: { label: "cpu", color: "#f59e0b" },
                accelerator: { label: "accelerator", color: "var(--brand-mint-500)" },
              }}
              className="h-[220px] w-full"
            >
              <LineChart data={powerTs?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}W`} />
                <RTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="server" stroke="var(--brand-indigo-500)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cpu" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="accelerator" stroke="var(--brand-mint-500)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
            <div className="mt-3 flex items-center gap-6 text-xs">
              <Marker label="server" value={psLast?.server != null ? `${Math.round(psLast.server).toLocaleString()} W` : "—"} color="bg-brand-indigo-500" />
              <Marker label="cpu" value={psLast?.cpu != null ? `${Math.round(psLast.cpu).toLocaleString()} W` : "—"} color="bg-amber-500" />
              <Marker label="accelerator" value={psLast?.accelerator != null ? `${Math.round(psLast.accelerator).toLocaleString()} W` : "—"} color="bg-brand-mint-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              최근 오류 로그
              <StatusTag />
            </CardTitle>
            <CardDescription>log_level=error 최신순. 자동 추출 필드(XID·OOM)는 배지로 표시.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {RECENT_ERRORS.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                <AlertCircle className={cn("mt-0.5 size-4 shrink-0", e.level === "error" ? "text-rose-600" : "text-amber-600")} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="truncate text-[12px] leading-tight">{e.message}</div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <span>{e.ts}</span>
                    <span>·</span>
                    <span>{e.cluster}</span>
                    {e.field && <Badge variant="warning" className="ml-0.5 px-1 py-0 text-[9px]">{e.field}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 클러스터 자원 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            클러스터 자원 현황
            <StatusTag />
          </CardTitle>
          <CardDescription>관리 클러스터 1개 + 서비스 클러스터 4개. 서비스 클러스터는 쿠버네티스·IPMI가 없어 CPU·서버 전력이 비어 있다.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">클러스터</th>
                <th className="py-1.5 pr-3 font-medium">종류</th>
                <th className="py-1.5 pr-3 font-medium">노드 (Ready/전체)</th>
                <th className="py-1.5 pr-3 font-medium">CPU 사용률</th>
                <th className="py-1.5 pr-3 font-medium">메모리 사용률</th>
                <th className="py-1.5 pr-3 font-medium">가속기</th>
                <th className="py-1.5 font-medium">전력</th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-1.5 [&_td]:pr-3">
              {CLUSTER_RESOURCE.map((c) => (
                <tr key={c.cluster} className="border-b border-border/60 last:border-0">
                  <td className="font-mono font-medium">{c.cluster}</td>
                  <td>
                    <Badge variant={c.type === "management" ? "default" : "outline"} className="text-[10px]">
                      {c.type === "management" ? "관리" : "서비스"}
                    </Badge>
                  </td>
                  <td className="font-mono tabular-nums">{c.nodes}</td>
                  <td className="font-mono tabular-nums">{c.cpu}</td>
                  <td className="font-mono tabular-nums">{c.mem}</td>
                  <td className="font-mono tabular-nums">{c.acc}</td>
                  <td className="font-mono tabular-nums">{formatNumber(c.watts)} W</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}

// ────── Datadog-style components ──────
/** 전력 분해 — dimension 파라미터를 바꿔 같은 응답을 다른 기준으로 본다 */
function PowerBreakdownCard() {
  const DIMS = [
    { key: "vendor", label: "벤더별" },
    { key: "cluster", label: "클러스터별" },
    { key: "node", label: "노드별" },
    { key: "accelerator", label: "카드별" },
  ];
  const [dim, setDim] = React.useState("vendor");
  const { data } = usePowerBreakdown(dim);
  const items = data?.items ?? [];
  const max = items.length ? Math.max(...items.map((i) => i.watts)) : 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          전력 분해
          <span className="flex items-center gap-1.5">
            <InfoHint text={"dimension(벤더·클러스터·노드·카드)으로 쪼개는 기준을 바꿉니다.\nlayer: server(IPMI) / cpu(추정) / accelerator(벤더).\n원천: /monitoring/power/breakdown"} />
            <StatusTag connected={!!data} />
          </span>
        </CardTitle>
        <CardDescription>dimension 파라미터로 쪼개는 기준을 바꾼다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {DIMS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDim(d.key)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] transition-colors",
                dim === d.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">데이터 없음</div>
        ) : (
          items.map((it, i) => (
            <TopRow key={`${it.key}-${i}`} idx={i + 1} name={`${it.key}  ·  ${it.layer}`} value={it.watts} unit="W" max={max} color="mint" />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// 카드 우측 상단 연동 상태 뱃지 (API 경로 표기 대체)
function StatusTag({ connected }: { connected?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
        connected
          ? "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-700"
          : "border-border bg-muted text-muted-foreground",
      )}
      title={connected ? "실 API 연동됨" : "목업 (연동 예정)"}
    >
      <span className={cn("size-1.5 rounded-full", connected ? "bg-brand-mint-500" : "bg-muted-foreground/40")} />
      {connected ? "연동" : "목업"}
    </span>
  );
}

// 집계 범위/소스 안내 — 인포 아이콘에 올리면 툴팁으로 포함 클러스터·산출 기준 표시
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex cursor-help text-muted-foreground hover:text-foreground" aria-label="집계 정보">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-line text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function QueryValue({
  label,
  value,
  unit,
  delta,
  sparkData,
  color,
  connected,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number;
  sparkData: { i: number; v: number }[];
  /** 실 API 연동 여부 */
  connected?: boolean;
  color: "indigo" | "mint" | "rose" | "violet" | "amber" | "sky";
}) {
  const colorMap = {
    indigo: "var(--brand-indigo-500)",
    mint: "var(--brand-mint-500)",
    rose: "#e11d48",
    violet: "#7c3aed",
    amber: "#d97706",
    sky: "#0284c7",
  };
  const positive = delta > 0;
  return (
    <Card className="relative p-3">
      <span className="absolute right-2 top-2">
        <StatusTag connected={connected} />
      </span>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <div className="-mx-1 -mb-1 mt-1 h-10">
        <ChartContainer
          config={{ v: { label, color: colorMap[color] } }}
          className="h-full w-full"
        >
          <LineChart data={sparkData}>
            <Line type="monotone" dataKey="v" stroke={colorMap[color]} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ChartContainer>
      </div>
      {delta !== 0 && (
        <div className={cn("flex items-center gap-0.5 text-[10px]", positive ? "text-rose-600" : "text-brand-mint-700")}>
          {positive ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
          {Math.abs(delta)}% vs 1h
        </div>
      )}
    </Card>
  );
}

function TopRow({
  idx,
  name,
  value,
  unit,
  max,
  color = "indigo",
}: {
  idx: number;
  name: string;
  value: number;
  unit: string;
  max: number;
  color?: "indigo" | "mint";
}) {
  const pct = (value / max) * 100;
  const bg = color === "mint" ? "bg-brand-mint-500" : "bg-brand-indigo-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">#{idx}</span>
          <span className="font-mono">{name}</span>
        </span>
        <span className="font-mono font-medium tabular-nums">
          {formatNumber(value)} {unit}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", bg)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HexHostMap() {
  // Generate a small grid of hosts
  const hosts = Array.from({ length: 24 }, (_, i) => {
    const v = Math.round(
      30 + Math.sin(i / 4) * 30 + (i % 6) * 5 + Math.random() * 8,
    );
    return { i, v, label: i < 8 ? `gpu-${(i + 1).toString().padStart(2, "0")}` : i < 16 ? `npu-${(i - 7).toString().padStart(2, "0")}` : `pim-${(i - 15).toString().padStart(2, "0")}` };
  });
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {hosts.map((h) => {
        const color =
          h.v > 75 ? "bg-rose-500" : h.v > 40 ? "bg-amber-400" : "bg-brand-mint-400";
        return (
          <div
            key={h.i}
            className={cn(
              "group relative flex aspect-square items-center justify-center rounded-md text-[9px] font-mono font-medium text-white transition-transform hover:scale-110",
              color,
            )}
            title={`${h.label}: ${h.v}%`}
          >
            {h.v}
          </div>
        );
      })}
    </div>
  );
}

function Heatmap() {
  const max = 100;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[80px_1fr] gap-2">
        <div />
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px text-[8px] text-muted-foreground">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center">
              {h % 4 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
      </div>
      {HEATMAP.map((row) => (
        <div key={row[0].host} className="grid grid-cols-[80px_1fr] items-center gap-2">
          <div className="text-right font-mono text-[10px] text-muted-foreground">
            {row[0].host}
          </div>
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px">
            {row.map((cell) => {
              const intensity = cell.value / max;
              return (
                <div
                  key={cell.hour}
                  className="aspect-square rounded-[2px]"
                  title={`${cell.host} ${cell.hour}h: ${cell.value}%`}
                  style={{
                    background:
                      intensity > 0.75
                        ? `rgba(225, 29, 72, ${0.4 + intensity * 0.6})`
                        : intensity > 0.4
                          ? `rgba(245, 158, 11, ${0.3 + intensity * 0.5})`
                          : `rgba(0, 200, 150, ${0.2 + intensity * 0.4})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Marker({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-3 rounded-sm", color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
