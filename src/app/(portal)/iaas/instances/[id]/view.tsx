"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Server,
  Cpu,
  Layers,
  ChevronLeft,
  Play,
  Square,
  RefreshCw,
  ArrowRight,
  Container as ContainerIcon,
  Copy,
  TerminalSquare,
  HardDrive,
  MoreVertical,
  Power,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { HealthRing } from "@/components/viz/health-ring";
import { Sparkline, makeSeries } from "@/components/viz/sparkline";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SSH_USER = "ubuntu";
function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} 복사됨`, { description: text });
}

type VMDetail = {
  observed_at: string;
  vm: any;
  host: any;
  accelerators: any[];
  passthroughs: any[];
  serviceCluster: any;
  workloads: any[];
  dataVolumes?: { id: string; name: string; sizeGb: number; type: string; status: string }[];
};

const fmtStorage = (gb: number) => (gb >= 1024 ? `${(gb / 1024).toLocaleString()} TB` : `${gb} GB`);

export default function VMDetailPage() {
  const params = useParams<{ id: string }>();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const { data, isLoading } = api.infra.vmDetail(params.id) as { data: VMDetail | undefined; isLoading: boolean };
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const dataVolumes = data.dataVolumes ?? [];
  const extraStorageGb = dataVolumes.reduce((s, v) => s + (v.sizeGb ?? 0), 0);

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
            <ChevronLeft className="size-3" /> 가상서버 목록
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
            {isAdmin && <Badge variant="ghost" className="font-mono text-[10px]">L3</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.vm.status === "Running" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => toast.success(`${data.vm.name} 정지 요청`)}>
                <Square className="size-3.5" /> 정지
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.success(`${data.vm.name} 재시작 요청`)}>
                <RefreshCw className="size-3.5" /> 재시작
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => toast.success(`${data.vm.name} 시작 요청`)}>
              <Play className="size-3.5" /> 시작
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="size-3.5" /> 작업
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>전원</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast.success(`${data.vm.name} 시작 요청`)}>
                <Play className="size-4" /> 시작
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`${data.vm.name} 정지 요청 (soft)`)}>
                <Square className="size-4" /> 정지
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.warning(`${data.vm.name} 강제 종료 요청`)}>
                <Power className="size-4" /> 강제 종료
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success(`${data.vm.name} 재시작 요청`)}>
                <RefreshCw className="size-4" /> 재시작
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>리소스 조정 (관리자)</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => toast.success("vCPU 변경 다이얼로그")}>vCPU 변경</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("메모리 변경 다이얼로그")}>메모리 변경</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("디스크 추가 다이얼로그")}>디스크 추가</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("가속기 추가 다이얼로그")}>가속기 추가</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hierarchy breadcrumb (L0 → L3 → L4 → L5) — 인프라 계보(관리자 전용) */}
      {isAdmin && (
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
      )}

      {/* KPI band */}
      <Card>
        <CardContent className={cn("grid grid-cols-2 gap-6 p-5", extraStorageGb > 0 ? "md:grid-cols-5" : "md:grid-cols-4")}>
          <HealthBlock label="vCPU" value={68} sub={`${data.vm.vcpu} cores 할당`} />
          <HealthBlock label="메모리" value={72} sub={`${data.vm.ramGb} GB`} />
          <HealthBlock label="시스템 디스크" value={42} sub={`${data.vm.diskGb} GB`} />
          {extraStorageGb > 0 && (
            <HealthBlock label="추가 스토리지" value={63} sub={`${fmtStorage(extraStorageGb)} · ${dataVolumes.length}개`} />
          )}
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
            <CardTitle className="text-base">가상서버 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Pair label="프로젝트" value={data.vm.openstackProject ?? data.vm.tenantId} mono />
            <Pair label="스펙" value={data.vm.flavor} mono />
            <Pair label="시스템 디스크" value={`${data.vm.diskGb} GB`} mono />
            <Pair
              label="추가 스토리지"
              value={extraStorageGb > 0 ? `${fmtStorage(extraStorageGb)} · 볼륨 ${dataVolumes.length}개` : "없음"}
              mono
            />
            {isAdmin && <Pair label="하이퍼바이저" value={data.host?.hostname ?? data.vm.nodeId} mono />}
            {isAdmin && <Pair label="K8s 클러스터" value={data.serviceCluster?.name ?? "—"} mono />}
            {isAdmin && <Pair label="역할" value={data.vm.clusterRole ?? "—"} />}
            <Pair label="사설 IP" value={data.vm.ipAddresses?.[0] ?? "—"} mono />
            <Pair
              label="공인 IP"
              value={data.vm.publicIp ? (
                <span className="inline-flex items-center gap-1.5">
                  {data.vm.publicIp}
                  <button type="button" onClick={() => copyText(data.vm.publicIp, "공인 IP")} className="cursor-pointer text-muted-foreground hover:text-foreground" title="공인 IP 복사">
                    <Copy className="size-3" />
                  </button>
                </span>
              ) : "미할당"}
              mono
            />
            <Pair
              label="키페어"
              value={data.vm.keyName ? (
                <Link href="/iaas/keypairs" className="hover:text-primary hover:underline" title="키페어 메뉴에서 보기">
                  {data.vm.keyName}
                </Link>
              ) : "—"}
              mono
            />
            <Pair label="생성" value={data.vm.createdAt?.slice(0, 10)} />
            <Pair label="가동시간" value={`${data.vm.uptimeHours}h`} />
            {data.vm.publicIp && data.vm.keyName && (
              <button
                type="button"
                onClick={() => copyText(`ssh -i ${data.vm.keyName}.pem ${SSH_USER}@${data.vm.publicIp}`, "SSH 접속 명령")}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-[11px] hover:bg-secondary"
                title="SSH 접속 명령 복사"
              >
                <span className="truncate">ssh -i {data.vm.keyName}.pem {SSH_USER}@{data.vm.publicIp}</span>
                <TerminalSquare className="size-3.5 shrink-0" />
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 연결된 리소스 — 섹션 카드 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 가속기 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4 text-brand-mint-600" /> 가속기
              <Badge variant="secondary" className="ml-auto font-mono">{data.passthroughs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.passthroughs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                연결된 가속기가 없습니다.
              </div>
            ) : (
              data.passthroughs.map((pt) => {
                const acc = data.accelerators.find((a) => a.id === pt.acceleratorId);
                return (
                  <div key={pt.acceleratorId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{acc?.name ?? pt.acceleratorId}</div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {pt.acceleratorId}{isAdmin && ` · ${pt.hostPciBdf}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Sparkline data={makeSeries(pt.acceleratorId.length, 12, acc?.utilization ?? 50, 12)} width={40} height={14} color="var(--brand-mint-500)" />
                      <span className="font-mono text-xs tabular-nums">{acc?.utilization ?? 0}%</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">{acc?.powerW ?? 0}W</span>
                      <Badge variant="success" className="text-[10px]">{pt.state}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 스토리지 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="size-4 text-brand-indigo-600" /> 스토리지
              <Badge variant="secondary" className="ml-auto font-mono">{dataVolumes.length}</Badge>
            </CardTitle>
            <CardDescription>
              시스템 디스크 <span className="font-mono">{data.vm.diskGb} GB</span>
              {extraStorageGb > 0 && <> · 추가 <span className="font-mono">{fmtStorage(extraStorageGb)}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dataVolumes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                추가 스토리지 볼륨이 없습니다.
              </div>
            ) : (
              dataVolumes.map((vol) => (
                <div key={vol.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{vol.name}</div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">{vol.id}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm tabular-nums">{fmtStorage(vol.sizeGb)}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{vol.type.toUpperCase()}</Badge>
                    <Badge variant={vol.status === "in-use" ? "success" : "secondary"} className="text-[10px]">{vol.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 실행 컨테이너 — 전체폭 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ContainerIcon className="size-4 text-brand-indigo-600" /> 실행 컨테이너
            <Badge variant="secondary" className="ml-auto font-mono">{data.workloads.length}</Badge>
          </CardTitle>
        </CardHeader>
        {data.workloads.length === 0 ? (
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              이 VM에서 실행 중인 컨테이너가 없습니다.
            </div>
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
