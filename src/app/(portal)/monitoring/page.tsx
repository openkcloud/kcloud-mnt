"use client";
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
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

// Datadog "Top List" style data
const TOP_HOSTS = [
  { name: "gpu-node-02.openkcloud", value: 92, unit: "%" },
  { name: "gpu-node-01.openkcloud", value: 78, unit: "%" },
  { name: "atom-node-01.openkcloud", value: 64, unit: "%" },
  { name: "atom-node-02.openkcloud", value: 51, unit: "%" },
  { name: "npu-node-01.openkcloud", value: 42, unit: "%" },
  { name: "pim-node-01.openkcloud", value: 18, unit: "%" },
];
const TOP_SVCS = [
  { name: "vllm-solar-10b", value: 1240, unit: "req/m" },
  { name: "stt-atom-edge", value: 880, unit: "req/m" },
  { name: "stt-rngd-prod", value: 560, unit: "req/m" },
  { name: "kserve-furiosa-rngd", value: 320, unit: "req/m" },
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

// Distribution data
const LATENCY_DIST = Array.from({ length: 20 }, (_, i) => ({
  bucket: `${i * 50}-${(i + 1) * 50}`,
  ms: i * 50 + 25,
  count: Math.round(Math.exp(-Math.pow(i - 6, 2) / 8) * 1200 + Math.random() * 80),
}));

// Sparkline series
function sparkline(seed: number, len = 24, base = 50, amp = 30) {
  return Array.from({ length: len }, (_, i) => ({
    i,
    v: base + Math.sin(i / 3 + seed) * amp + (Math.sin(seed * i) * 5),
  }));
}

export default function MonitoringOverviewPage() {
  return (
    <div className="space-y-4">
      {/* KPI band — Datadog "Query Value" widgets */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <QueryValue label="Avg P99 지연" value="820" unit="ms" delta={-12} sparkData={sparkline(1, 24, 800, 100)} color="indigo" />
        <QueryValue label="에러율" value="0.34" unit="%" delta={-8} sparkData={sparkline(2, 24, 0.4, 0.2)} color="rose" />
        <QueryValue label="추론 RPS" value="2.3K" unit="req/s" delta={18} sparkData={sparkline(3, 24, 60, 30)} color="mint" />
        <QueryValue label="GPU 사용률" value="68" unit="%" delta={5} sparkData={sparkline(4, 24, 65, 15)} color="violet" />
        <QueryValue label="전력 (실시간)" value="9.2" unit="kW" delta={-3} sparkData={sparkline(5, 24, 9, 1.2)} color="amber" />
        <QueryValue label="활성 호스트" value="6" unit="대" delta={0} sparkData={sparkline(6, 24, 6, 0)} color="sky" />
      </div>

      {/* Hexagonal host map + Heatmap */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>호스트 맵</CardTitle>
            <CardDescription>가속기 활용률 — 색상 = 부하</CardDescription>
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
            <CardTitle>활용률 히트맵 (24h × 호스트)</CardTitle>
            <CardDescription>Datadog 스타일 — 시간×자원 부하 분포</CardDescription>
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
              <Badge variant="ghost" className="font-mono">avg(rate.gpu.util)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TOP_HOSTS.map((h, i) => (
              <TopRow key={h.name} idx={i + 1} name={h.name} value={h.value} unit={h.unit} max={100} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              상위 추론 서비스 — 분당 요청
              <Badge variant="ghost" className="font-mono">sum(serving.requests)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TOP_SVCS.map((h, i) => (
              <TopRow key={h.name} idx={i + 1} name={h.name} value={h.value} unit={h.unit} max={1500} color="mint" />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Distribution + Errors */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>응답 시간 분포 (지난 1시간)</CardTitle>
            <CardDescription>모든 추론 서비스 합산 · P50/P95/P99 표시</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ count: { label: "요청 수", color: "var(--brand-indigo-500)" } }}
              className="h-[220px] w-full"
            >
              <BarChart data={LATENCY_DIST}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ms" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <RTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {LATENCY_DIST.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.ms > 900 ? "#dc2626" :
                          d.ms > 600 ? "#f59e0b" : "var(--brand-indigo-500)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-3 flex items-center gap-6 text-xs">
              <Marker label="P50" value="220ms" color="bg-brand-indigo-500" />
              <Marker label="P95" value="620ms" color="bg-amber-500" />
              <Marker label="P99" value="820ms" color="bg-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>활성 문제</CardTitle>
            <CardDescription>옵저버빌리티 알람 · 자동 우선순위</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { sev: "critical", title: "Neutron API 지연 > 1s", svc: "pool-3", ago: "12m" },
              { sev: "warning", title: "GPU 온도 78°C 임계 근접", svc: "acc-a100-1-2", ago: "30m" },
              { sev: "warning", title: "테넌트 쿼터 92% 도달", svc: "proj-llm-serving", ago: "1h" },
              { sev: "info", title: "K8s 1.30.5 업그레이드 진행", svc: "k8s-3", ago: "2h" },
            ].map((p, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                <AlertCircle
                  className={cn(
                    "size-4 shrink-0 mt-0.5",
                    p.sev === "critical" ? "text-rose-600" :
                      p.sev === "warning" ? "text-amber-600" : "text-sky-600",
                  )}
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-medium leading-tight">{p.title}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{p.svc} · {p.ago}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ────── Datadog-style components ──────
function QueryValue({
  label,
  value,
  unit,
  delta,
  sparkData,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number;
  sparkData: { i: number; v: number }[];
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
    <Card className="p-3">
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
