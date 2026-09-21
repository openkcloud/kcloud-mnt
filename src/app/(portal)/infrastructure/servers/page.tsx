"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Server, Cpu, Zap, Activity, Search, Layers, HeartPulse, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFeatureVisible } from "@/lib/scope";
import { FeatureGate } from "@/components/feature-gate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Pool } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkline, makeSeries } from "@/components/viz/sparkline";
import { HealthRing } from "@/components/viz/health-ring";
import { cn, formatNumber, formatWatts } from "@/lib/utils";

type Server = {
  id: string;
  hostname: string;
  poolId: string;
  zoneId: string;
  status: string;
  vcpu: number;
  ramGb: number;
  diskTb: number;
  acceleratorIds: string[];
  acceleratorCount: number;
  acceleratorKinds: string[];
  vmCount: number;
  runningVms: number;
  ipAddress: string;
  powerW: number;
  uptimeDays: number;
  cpuUtil: number;
  memUtil: number;
  accelUtil: number;
};

export default function ServersPage() {
  const router = useRouter();
  const { data, isLoading } = api.infra.servers() as {
    data: { observed_at: string; items: Server[] } | undefined;
    isLoading: boolean;
  };
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState("servers");
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const healthVisible = useFeatureVisible("infra.health-check");
  const storageVisible = useFeatureVisible("infra.storage-pools");

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const items = data.items.filter((s) => !q || s.hostname.toLowerCase().includes(q.toLowerCase()));

  const totals = {
    servers: data.items.length,
    accelerators: data.items.reduce((s, x) => s + x.acceleratorCount, 0),
    vms: data.items.reduce((s, x) => s + x.vmCount, 0),
    powerKw: Math.round(data.items.reduce((s, x) => s + x.powerW, 0) / 100) / 10,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="인프라 관리"
        description={`Layer 0/L1 물리 인프라 · ${totals.servers}대 · ${totals.accelerators}장 가속기 · ${totals.vms} VM · ${totals.powerKw}kW · 단일 클러스터`}
        actions={
          <Button variant="outline" size="sm" onClick={() => toast.success("Discovery 실행 — 물리 서버·가속기 재탐색")}>
            <Activity className="size-3.5" /> Discovery 트리거
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <ChangeMark ids={["CR-INF-03", "CR-IAAS-08"]} inline>
        <TabsList>
          <TabsTrigger value="servers">물리 서버 ({data.items.length})</TabsTrigger>
          {healthVisible && <TabsTrigger value="health">자원풀 헬스체크</TabsTrigger>}
          {storageVisible && <TabsTrigger value="storage">외부 블록스토리지 자원풀</TabsTrigger>}
        </TabsList>
        </ChangeMark>

        <TabsContent value="servers" className="mt-4 space-y-4">
          {/* Filter band */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="호스트명 검색…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-56 pl-9"
                />
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {items.length}/{data.items.length}대 · observed_at <span className="font-mono">{data.observed_at}</span>
              </span>
            </div>
          </Card>

          {/* Server cards grid — Datadog Host Map 영감 */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <ServerCard key={s.id} server={s} onClick={() => router.push(`/infrastructure/servers/${s.id}`)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="mt-4">
          <FeatureGate id="infra.health-check">
            <PoolHealthPanel isAdmin={isAdmin} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <FeatureGate id="infra.storage-pools">
            <StoragePoolPanel isAdmin={isAdmin} />
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 자원풀 헬스체크 — SFR.MNT.052 Provider Health Check ('26 신규)
// 공급자 관리 메뉴가 삭제(260702 회의록 2.5, 단일 클러스터)되어 이 탭으로 이동
// ─────────────────────────────────────────────────────────────

const OS_SERVICES = ["Nova (compute)", "Neutron (networking)", "Cinder (block)", "Glance (image)", "Keystone (identity)", "Magnum (k8s)"];

function PoolHealthPanel({ isAdmin }: { isAdmin: boolean }) {
  const pools = api.iaas.pools() as { data: { items: Pool[] } | undefined; isLoading: boolean };
  const [lastRun, setLastRun] = React.useState<string | null>(null);
  if (pools.isLoading || !pools.data) return <Skeleton className="h-64" />;
  const items = pools.data.items.filter((p) => p.type === "OpenStack");

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-brand-indigo-200 bg-brand-indigo-50/50 px-3 py-2 text-[11px] text-brand-indigo-900">
        <strong>Provider Health Check (SFR.MNT.052)</strong> — OpenStack 제어면 서비스 API 응답·DB 연결·메시지 큐 상태를 주기 점검한다.
        단일 클러스터 구성이라 별도 공급자 관리 메뉴 없이 헬스체크를 이 탭에서 제공한다.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((p) => {
          const cpuPct = Math.round((p.used.vcpu / p.capacity.vcpu) * 100);
          const ramPct = Math.round((p.used.ramGb / p.capacity.ramGb) * 100);
          const warn = p.status !== "정상";
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <HeartPulse className={cn("size-4", warn ? "text-amber-600" : "text-brand-mint-600")} />
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{p.type}</Badge>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.endpoint}</div>
                </div>
                <Badge variant={warn ? "warning" : "success"}>{p.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">vCPU</span><span className="font-mono tabular-nums">{p.used.vcpu}/{p.capacity.vcpu}</span></div>
                  <Progress value={cpuPct} indicatorClassName="bg-brand-indigo-500" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">RAM (GB)</span><span className="font-mono tabular-nums">{p.used.ramGb}/{p.capacity.ramGb}</span></div>
                  <Progress value={ramPct} indicatorClassName="bg-brand-mint-500" />
                </div>
              </div>
              <div className="mt-3 grid gap-1 sm:grid-cols-2">
                {OS_SERVICES.map((svc, i) => {
                  const slow = warn && svc.startsWith("Neutron");
                  return (
                    <div key={svc} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-[11px]">
                      {slow ? <AlertCircle className="size-3.5 text-amber-600" /> : <CheckCircle2 className="size-3.5 text-brand-mint-600" />}
                      <span className="font-mono">{svc}</span>
                      <span className="ml-auto font-mono text-muted-foreground">{slow ? "1.4s" : `${8 + i * 3}ms`}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => { setLastRun(new Date().toLocaleTimeString("ko-KR")); toast.success(`${p.name} 헬스체크 완료 — ${warn ? "Neutron API 지연 감지" : "모든 서비스 정상"}`); }}>
                    <Activity className="size-3.5" /> 헬스체크 실행
                  </Button>
                )}
                <span className="ml-auto">마지막 점검 {lastRun ?? "5분 전 (주기 5분)"}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 외부 블록스토리지 자원풀 — SFR.MNT.048 ('26 신규)
// ─────────────────────────────────────────────────────────────

type StoragePool = {
  id: string; name: string; backend: string; protocol: string; capacityTb: number; usedTb: number;
  volumeType: string; status: "정상" | "주의" | "점검"; endpoint: string;
};

const STORAGE_POOLS: StoragePool[] = [
  { id: "sp-1", name: "ceph-rbd-ssd", backend: "Ceph RBD", protocol: "RBD", capacityTb: 120, usedTb: 71, volumeType: "ssd", status: "정상", endpoint: "ceph-mon-01:6789" },
  { id: "sp-2", name: "ceph-rbd-hdd", backend: "Ceph RBD", protocol: "RBD", capacityTb: 400, usedTb: 236, volumeType: "hdd", status: "정상", endpoint: "ceph-mon-01:6789" },
  { id: "sp-3", name: "san-nvme-01", backend: "외부 SAN (NVMe-oF)", protocol: "NVMe/TCP", capacityTb: 60, usedTb: 12, volumeType: "nvme", status: "주의", endpoint: "10.20.0.50:4420" },
];

function StoragePoolPanel({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = React.useState(STORAGE_POOLS);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md border border-brand-indigo-200 bg-brand-indigo-50/50 px-3 py-2 text-[11px] text-brand-indigo-900">
          <strong>외부 블록스토리지 자원풀 (SFR.MNT.048)</strong> — Cinder 백엔드로 연결된 외부 스토리지 풀을 등록·점검한다. 볼륨 타입(ssd·hdd·nvme)이 Flavor 선택 시 자동 생성되는 볼륨의 백엔드가 된다.
        </div>
        {isAdmin && (
          <Button size="sm" className="ml-auto" onClick={() => { const n = { ...STORAGE_POOLS[0], id: `sp-${Date.now()}`, name: `pool-${items.length + 1}`, usedTb: 0, status: "점검" as const }; setItems((prev) => [...prev, n]); toast.success(`자원풀 ${n.name} 등록 — 연결 테스트 진행`); }}>
            <Plus className="size-3.5" /> 자원풀 등록
          </Button>
        )}
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>자원풀</TableHead>
              <TableHead>백엔드</TableHead>
              <TableHead>프로토콜</TableHead>
              <TableHead>볼륨 타입</TableHead>
              <TableHead className="w-[220px]">사용량</TableHead>
              <TableHead>상태</TableHead>
              {isAdmin && <TableHead className="text-right">작업</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => {
              const pct = Math.round((p.usedTb / p.capacityTb) * 100);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p.endpoint}</div>
                  </TableCell>
                  <TableCell className="text-xs">{p.backend}</TableCell>
                  <TableCell><Badge variant="ghost" className="font-mono text-[10px]">{p.protocol}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-[10px]">{p.volumeType}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5" indicatorClassName={pct > 80 ? "bg-rose-500" : "bg-brand-indigo-500"} />
                      <span className="w-24 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{p.usedTb}/{p.capacityTb} TB</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={p.status === "정상" ? "success" : p.status === "주의" ? "warning" : "outline"}>{p.status}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => toast.success(`${p.name} 연결 테스트 성공`)}>연결 테스트</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-rose-600" onClick={() => { setItems((prev) => prev.filter((x) => x.id !== p.id)); toast.success(`${p.name} 제거`); }}>제거</Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ServerCard({ server: s, onClick }: { server: Server; onClick: () => void }) {
  const overallHealth = Math.max(s.cpuUtil, s.memUtil, s.accelUtil);
  const healthColor = overallHealth > 85 ? "border-rose-200" : overallHealth > 65 ? "border-amber-200" : "border-brand-mint-200";

  return (
    <button onClick={onClick} className="text-left">
      <Card className={cn("group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg", healthColor)}>
        <div
          className="absolute right-0 top-0 h-full w-1"
          style={{
            background:
              overallHealth > 85 ? "linear-gradient(180deg, #e11d48 0%, transparent 100%)" :
                overallHealth > 65 ? "linear-gradient(180deg, #f59e0b 0%, transparent 100%)" :
                  "linear-gradient(180deg, #00c896 0%, transparent 100%)",
          }}
        />
        <CardContent className="space-y-4 p-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Server className="size-5" />
              </div>
              <div>
                <div className="font-semibold leading-tight">{s.hostname}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {s.ipAddress} · uptime {s.uptimeDays}d
                </div>
              </div>
            </div>
            <Badge variant={s.status === "Up" ? "success" : "warning"} className="gap-1">
              <span className="size-1.5 rounded-full bg-current opacity-80" />
              {s.status}
            </Badge>
          </div>

          {/* Health rings — Dynatrace 영감 */}
          <div className="flex items-center justify-around rounded-lg bg-secondary/30 py-3">
            <HealthRing value={s.cpuUtil} size={64} thickness={6} label="CPU" />
            <HealthRing value={s.memUtil} size={64} thickness={6} label="MEM" />
            {s.acceleratorCount > 0 && <HealthRing value={s.accelUtil} size={64} thickness={6} label={s.acceleratorKinds[0]} />}
          </div>

          {/* Sparklines row */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <SparkCell label="CPU" data={makeSeries(s.id.length, 20, s.cpuUtil, 8)} value={`${s.cpuUtil}%`} color="var(--brand-indigo-500)" />
            <SparkCell label="MEM" data={makeSeries(s.id.length + 1, 20, s.memUtil, 6)} value={`${s.memUtil}%`} color="var(--brand-mint-500)" />
            <SparkCell label="POWER" data={makeSeries(s.id.length + 2, 20, s.powerW, 80)} value={formatWatts(s.powerW)} color="#f59e0b" />
          </div>

          {/* Allocations */}
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
            <ChangeMark ids={["CR-INF-01"]} inline><div className="flex items-center gap-1.5">
              <Cpu className="size-3.5 text-brand-mint-600" />
              <span>
                <strong className="font-mono">{s.acceleratorCount}</strong>장 가속기
                {s.acceleratorKinds.length > 0 && (
                  <span className="ml-1 text-muted-foreground">({s.acceleratorKinds.join(", ")})</span>
                )}
              </span>
            </div></ChangeMark>
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-rose-600" />
              <span>
                <strong className="font-mono">{s.runningVms}/{s.vmCount}</strong> VM 실행
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono">{s.id}</span>
            <span className="opacity-0 transition-opacity group-hover:opacity-100">
              상세 →
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function SparkCell({ label, data, value, color }: { label: string; data: number[]; value: string; color: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] font-semibold tabular-nums">{value}</span>
      </div>
      <Sparkline data={data} width={84} height={16} color={color} />
    </div>
  );
}
