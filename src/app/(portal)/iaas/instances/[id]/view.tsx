"use client";
import { toast } from "sonner";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Server,
  Cpu,
  Layers,
  Network,
  HardDrive,
  ChevronLeft,
  Play,
  Square,
  Move,
  RefreshCw,
  Settings,
  ArrowRight,
  Container as ContainerIcon,
  Building2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { HealthRing } from "@/components/viz/health-ring";
import { Sparkline, makeSeries } from "@/components/viz/sparkline";
import { cn } from "@/lib/utils";

type VMDetail = {
  observed_at: string;
  vm: any;
  host: any;
  accelerators: any[];
  passthroughs: any[];
  serviceCluster: any;
  workloads: any[];
};

export default function VMDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = api.infra.vmDetail(params.id) as { data: VMDetail | undefined; isLoading: boolean };
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const series = Array.from({ length: 60 }, (_, i) => ({
    t: `${(60 - i)}m`,
    cpu: 40 + Math.sin(i / 4) * 25 + Math.random() * 8,
    mem: 60 + Math.cos(i / 5) * 12 + Math.random() * 4,
    net: 80 + Math.sin(i / 3) * 60 + Math.random() * 15,
  })).reverse();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/iaas/instances" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3" /> VM 목록
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <Server className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{data.vm.name}</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{data.vm.id} · {data.vm.flavor}</span>
                <span>·</span>
                <span>{data.vm.os}</span>
              </div>
            </div>
            <Badge variant={data.vm.status === "Running" ? "success" : "secondary"} className="ml-2 gap-1">
              <span className="size-1.5 rounded-full bg-current opacity-80" />
              {data.vm.status}
            </Badge>
            <Badge variant="ghost" className="font-mono text-[10px]">L3</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("라이브 마이그레이션 대상 호스트 선택")}>
            <Move className="size-3.5" /> 마이그레이션
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("설정 편집 다이얼로그")}>
            <Settings className="size-3.5" /> 설정
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("재시작 요청을 보냈다")}>
            <RefreshCw className="size-3.5" /> 재시작
          </Button>
        </div>
      </div>

      {/* Hierarchy breadcrumb (L0 → L3 → L4 → L5) */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-xs">
          {data.host && (
            <Link href={`/infrastructure/servers/${data.host.id}`} className="group flex items-center gap-1.5 rounded-md border border-border bg-slate-50 px-2 py-1 hover:border-primary/40">
              <Server className="size-3 text-slate-600" />
              <span className="font-mono">L0 · {data.host.hostname}</span>
              <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <ChevronRightIcon />
          <div className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1">
            <Server className="size-3 text-rose-600" />
            <span className="font-mono">L3 · {data.vm.name}</span>
          </div>
          {data.serviceCluster && (
            <>
              <ChevronRightIcon />
              <Link href={`/paas/clusters`} className="group flex items-center gap-1.5 rounded-md border border-border bg-amber-50 px-2 py-1 hover:border-primary/40">
                <Layers className="size-3 text-amber-700" />
                <span className="font-mono">L4 · {data.serviceCluster.name}</span>
                <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
          {data.workloads.length > 0 && (
            <>
              <ChevronRightIcon />
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-brand-indigo-50 px-2 py-1">
                <ContainerIcon className="size-3 text-brand-indigo-700" />
                <span className="font-mono">L5 · {data.workloads.length} 컨테이너</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* KPI band */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4">
          <HealthBlock label="vCPU" value={68} sub={`${data.vm.vcpu} cores 할당`} />
          <HealthBlock label="메모리" value={72} sub={`${data.vm.ramGb} GB`} />
          <HealthBlock label="디스크" value={42} sub={`${data.vm.diskGb} GB`} />
          <HealthBlock label="네트워크" value={28} sub={data.vm.ipAddresses?.[0] ?? "—"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>실시간 메트릭</CardTitle>
            <CardDescription>지난 60분 · CPU · 메모리 · 네트워크</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                cpu: { label: "CPU %", color: "var(--brand-indigo-500)" },
                mem: { label: "MEM %", color: "var(--brand-mint-500)" },
                net: { label: "NET Mbps", color: "#f59e0b" },
              }}
              className="h-[260px] w-full"
            >
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="vmcpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-indigo-500)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand-indigo-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}M`} />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
                <Area yAxisId="left" type="monotone" dataKey="cpu" stroke="var(--brand-indigo-500)" strokeWidth={2} fill="url(#vmcpu)" />
                <Line yAxisId="left" type="monotone" dataKey="mem" stroke="var(--brand-mint-500)" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">VM 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Pair label="OpenStack 프로젝트" value={data.vm.openstackProject ?? data.vm.tenantId} mono />
            <Pair label="하이퍼바이저" value={data.host?.hostname ?? data.vm.nodeId} mono />
            <Pair label="K8s 클러스터" value={data.serviceCluster?.name ?? "—"} mono />
            <Pair label="역할" value={data.vm.clusterRole ?? "—"} />
            <Pair label="Flavor" value={data.vm.flavor} mono />
            <Pair label="IP 주소" value={data.vm.ipAddresses?.[0] ?? "—"} mono />
            <Pair label="생성" value={data.vm.createdAt?.slice(0, 10)} />
            <Pair label="가동시간" value={`${data.vm.uptimeHours}h`} />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="passthrough">
        <TabsList>
          <TabsTrigger value="passthrough">
            <Cpu className="size-3.5" /> GPU 패스스루 ({data.passthroughs.length})
          </TabsTrigger>
          <TabsTrigger value="workloads">
            <ContainerIcon className="size-3.5" /> 실행 컨테이너 ({data.workloads.length})
          </TabsTrigger>
          <TabsTrigger value="actions">
            <Settings className="size-3.5" /> 설정·액션
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passthrough">
          <Card>
            {data.passthroughs.length === 0 ? (
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                이 VM에 패스스루된 가속기가 없습니다.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>가속기 ID</TableHead>
                    <TableHead>모델</TableHead>
                    <TableHead>호스트 PCI</TableHead>
                    <TableHead>활용률</TableHead>
                    <TableHead>전력</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.passthroughs.map((pt) => {
                    const acc = data.accelerators.find((a) => a.id === pt.acceleratorId);
                    return (
                      <TableRow key={pt.acceleratorId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Cpu className="size-4 text-brand-mint-600" />
                            <span className="font-mono text-xs">{pt.acceleratorId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{acc?.name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[10px]">{pt.hostPciBdf}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Sparkline data={makeSeries(pt.acceleratorId.length, 12, acc?.utilization ?? 50, 12)} width={48} height={14} color="var(--brand-mint-500)" />
                            <span className="font-mono text-xs">{acc?.utilization ?? 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{acc?.powerW ?? 0}W</TableCell>
                        <TableCell>
                          <Badge variant="success" className="font-mono text-[10px]">{pt.state}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="workloads">
          <Card>
            {data.workloads.length === 0 ? (
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                이 VM에서 실행 중인 컨테이너가 없습니다.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>워크로드</TableHead>
                    <TableHead>네임스페이스</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>레플리카</TableHead>
                    <TableHead>가속기</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.workloads.map((w) => (
                    <TableRow key={w.id} className="cursor-pointer" onClick={() => window.location.assign(`/paas/workloads/${w.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ContainerIcon className="size-4 text-brand-indigo-600" />
                          <span className="font-medium">{w.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{w.namespace}</TableCell>
                      <TableCell><Badge variant="outline">{w.kind}</Badge></TableCell>
                      <TableCell className="font-mono">{w.ready}/{w.replicas}</TableCell>
                      <TableCell>
                        {w.accelerators > 0 ? (
                          <Badge variant="success" className="gap-1"><Cpu className="size-3" />{w.accelerators}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell><Badge variant={w.status === "Running" ? "success" : "warning"}>{w.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">전원 관리</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("노트북 서버 시작을 요청했다")}>
                  <Play className="size-3.5" /> 시작
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("ACPI 정지 요청을 보냈다")}>
                  <Square className="size-3.5" /> 정지 (soft)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("강제 종료(hard stop) 요청을 보냈다")}>
                  <Square className="size-3.5" /> 강제 종료
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("재시작 요청을 보냈다")}>
                  <RefreshCw className="size-3.5" /> 재시작
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">리소스 조정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("vCPU 변경 — resize 후 재시작 필요")}>vCPU 변경</Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("메모리 변경 — resize 후 재시작 필요")}>메모리 변경</Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("볼륨 추가 다이얼로그")}>디스크 추가</Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.success("가속기 패스스루 추가 — 관리자 승인 후 적용")}>GPU 패스스루 추가</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HealthBlock({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <HealthRing value={value} size={86} thickness={7} label={label} />
      <div className="text-center font-mono text-[10px] text-muted-foreground">{sub}</div>
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

function ChevronRightIcon() {
  return <span className="text-muted-foreground">›</span>;
}
