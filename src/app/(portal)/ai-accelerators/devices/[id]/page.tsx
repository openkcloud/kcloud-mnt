"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Cpu,
  Server,
  ChevronLeft,
  ArrowRight,
  Thermometer,
  Zap,
  Settings,
  RefreshCw,
  Activity,
  Container as ContainerIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { HealthRing } from "@/components/viz/health-ring";
import { Sparkline, makeSeries } from "@/components/viz/sparkline";
import { cn } from "@/lib/utils";

type AccDetail = {
  observed_at: string;
  accelerator: any;
  host: any;
  passthrough?: any;
  vm?: any;
};

export default function AcceleratorDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = api.infra.acceleratorDetail(params.id) as { data: AccDetail | undefined; isLoading: boolean };
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const a = data.accelerator;
  const series = Array.from({ length: 60 }, (_, i) => ({
    t: `${(60 - i)}m`,
    util: Math.max(0, a.utilization + Math.sin(i / 4) * 18 + Math.random() * 6 - 3),
    power: Math.max(0, a.powerW + Math.sin(i / 5) * 30 + Math.random() * 12 - 6),
    temp: Math.max(40, a.temperatureC + Math.sin(i / 6) * 4 + Math.random() * 2 - 1),
  })).reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/ai-accelerators/devices" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3" /> 디바이스 인벤토리
          </Link>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-11 items-center justify-center rounded-lg",
              a.kind === "GPU" ? "bg-brand-indigo-100 text-brand-indigo-700" :
                a.kind === "NPU" ? "bg-brand-mint-50 text-brand-mint-700" : "bg-violet-100 text-violet-700",
            )}>
              <Cpu className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{a.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{a.id}</span>
                <span>·</span>
                <span>{a.vendor} {a.kind}</span>
              </div>
            </div>
            <Badge variant={a.status === "Allocated" ? "default" : "secondary"} className="ml-2 gap-1">
              <span className="size-1.5 rounded-full bg-current opacity-80" />
              {a.status}
            </Badge>
            <Badge variant="ghost" className="font-mono text-[10px]">LA</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Settings className="size-3.5" /> 설정</Button>
          <Button variant="outline" size="sm"><RefreshCw className="size-3.5" /> 드라이버 리로드</Button>
        </div>
      </div>

      {/* Breadcrumb hierarchy */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 text-xs">
          {data.host && (
            <Link href={`/infrastructure/servers/${data.host.id}`} className="group flex items-center gap-1.5 rounded-md border border-border bg-slate-50 px-2 py-1 hover:border-primary/40">
              <Server className="size-3 text-slate-600" />
              <span className="font-mono">L0 · {data.host.hostname}</span>
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <span className="text-muted-foreground">›</span>
          <div className="flex items-center gap-1.5 rounded-md border border-brand-mint-200 bg-brand-mint-50 px-2 py-1">
            <Cpu className="size-3 text-brand-mint-700" />
            <span className="font-mono">LA · {a.id}</span>
          </div>
          {data.vm && (
            <>
              <span className="text-muted-foreground">› passthrough_to ›</span>
              <Link href={`/iaas/instances/${data.vm.id}`} className="group flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 hover:border-primary/40">
                <Server className="size-3 text-rose-700" />
                <span className="font-mono">L3 · {data.vm.name}</span>
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
          {a.allocatedToWorkload && (
            <>
              <span className="text-muted-foreground">› allocated_to ›</span>
              <div className="flex items-center gap-1.5 rounded-md border border-brand-indigo-200 bg-brand-indigo-50 px-2 py-1">
                <ContainerIcon className="size-3 text-brand-indigo-700" />
                <span className="font-mono">L5 · {a.allocatedToWorkload}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Health rings — Dynatrace style */}
      <Card>
        <CardContent className="grid grid-cols-3 gap-6 p-5">
          <HealthBlock label="활용률" value={a.utilization} unit="%" />
          <HealthBlock
            label="온도"
            value={a.temperatureC}
            unit="°C"
            thresholds={{ warning: 70, critical: 80 }}
            scale={100}
          />
          <HealthBlock
            label="전력"
            value={a.powerW}
            unit="W"
            thresholds={{ warning: 250, critical: 280 }}
            scale={300}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>활용률 추이 (60분)</CardTitle>
            <CardDescription>DCGM·Furiosa SDK · 1초 간격</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ util: { label: "Utilization %", color: "var(--brand-mint-500)" } }}
              className="h-[220px] w-full"
            >
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="utilg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-mint-500)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--brand-mint-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Area type="monotone" dataKey="util" stroke="var(--brand-mint-500)" strokeWidth={2} fill="url(#utilg)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>전력·온도 추이</CardTitle>
            <CardDescription>Kepler 추정 + DCGM 측정</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                power: { label: "Power W", color: "#f59e0b" },
                temp: { label: "Temp °C", color: "#e11d48" },
              }}
              className="h-[220px] w-full"
            >
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}W`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}°`} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <ReferenceLine yAxisId="right" y={80} stroke="#e11d48" strokeDasharray="4 4" />
                <Line yAxisId="left" type="monotone" dataKey="power" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#e11d48" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">디바이스 정보</TabsTrigger>
          <TabsTrigger value="binding">바인딩 이력</TabsTrigger>
          <TabsTrigger value="logs">XID/ECC 로그</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">하드웨어</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Pair label="모델" value={a.model} mono />
                <Pair label="벤더" value={a.vendor} />
                <Pair label="메모리" value={`${a.memoryGb} GB`} mono />
                <Pair label="PCI BDF" value={a.pciAddress ?? "—"} mono />
                <Pair label="드라이버" value={a.driverVersion} mono />
                <Pair label="펌웨어" value={a.firmwareVersion} mono />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">정책·할당</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Pair label="공유 모드" value={a.sharing} />
                <Pair label="매핑" value={a.multiplexing} mono />
                <Pair label="할당 상태" value={a.allocationState ?? "—"} mono />
                <Pair label="파티션 모드" value={a.partitionMode ?? "(없음)"} mono />
                <Pair label="할당 테넌트" value={a.allocatedToTenant ?? "—"} mono />
                <Pair label="할당 워크로드" value={a.allocatedToWorkload ?? "—"} mono />
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {a.capabilities?.map((c: string) => (
                  <Badge key={c} variant="outline" className="font-mono text-[11px]">{c}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="binding">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  { t: "2026-06-02 14:22", action: "allocated", target: "vllm-solar-10b · llm-serving", actor: "kube-scheduler" },
                  { t: "2026-06-02 11:14", action: "released", target: "data-prep-cronjob", actor: "kube-scheduler" },
                  { t: "2026-06-02 11:10", action: "allocated", target: "data-prep-cronjob", actor: "kube-scheduler" },
                  { t: "2026-06-02 09:38", action: "passthrough_attached", target: data.vm?.name ?? "vm-001", actor: "nova-compute" },
                  { t: "2026-06-02 09:30", action: "discovery", target: data.host?.hostname ?? "—", actor: "nvidia-device-plugin" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-2.5 font-mono text-xs">
                    <span className="text-muted-foreground tabular-nums">{e.t}</span>
                    <Badge variant={e.action === "allocated" ? "success" : e.action === "released" ? "secondary" : "default"} className="text-[10px]">
                      {e.action}
                    </Badge>
                    <span className="flex-1">{e.target}</span>
                    <span className="text-muted-foreground">{e.actor}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="overflow-hidden bg-slate-950 text-slate-100">
            <div className="divide-y divide-slate-800 font-mono text-[11px]">
              {[
                { ts: "14:22:18.412", lvl: "INFO", msg: `${a.kind} ${a.id} utilization=${a.utilization}% temp=${a.temperatureC}C power=${a.powerW}W` },
                { ts: "14:21:48.118", lvl: "INFO", msg: "DCGM scrape successful (24 metrics)" },
                { ts: "14:21:18.812", lvl: "INFO", msg: `ECC errors: single_bit=0 double_bit=0` },
                { ts: "14:20:48.412", lvl: "DEBUG", msg: "Driver version check: OK (550.127.05)" },
                { ts: "14:20:18.118", lvl: "INFO", msg: `Container ${a.allocatedToWorkload ?? "—"} bound` },
              ].map((l, i) => (
                <div key={i} className="grid grid-cols-[120px_70px_1fr] gap-3 px-4 py-1.5">
                  <span className="text-slate-500">{l.ts}</span>
                  <span className={cn("rounded text-center text-[9px] font-semibold uppercase", l.lvl === "DEBUG" ? "bg-slate-700 text-slate-400" : "bg-sky-500/20 text-sky-300")}>{l.lvl}</span>
                  <span>{l.msg}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HealthBlock({
  label,
  value,
  unit,
  thresholds,
  scale = 100,
}: {
  label: string;
  value: number;
  unit: string;
  thresholds?: { warning: number; critical: number };
  scale?: number;
}) {
  const pct = (value / scale) * 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <HealthRing
        value={pct}
        size={110}
        thickness={9}
        label={label}
        unit={unit}
        thresholds={{ warning: thresholds ? (thresholds.warning / scale) * 100 : 70, critical: thresholds ? (thresholds.critical / scale) * 100 : 85 }}
      />
      <div className="font-mono text-xs tabular-nums">
        <strong>{value}</strong> <span className="text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Pair({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm", mono && "font-mono")}>{value}</span>
    </div>
  );
}
