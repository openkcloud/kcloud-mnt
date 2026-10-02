"use client";
import * as React from "react";
import Link from "next/link";
import { Boxes, Building2, Cpu, Layers, Network, FolderKanban } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ManagementCluster, ServiceCluster } from "@/lib/types";

type MgmtResp = { observed_at: string; is_stale: boolean; items: ManagementCluster[] };
type SvcResp = { observed_at: string; is_stale: boolean; items: ServiceCluster[] };

export default function ClustersPage() {
  const mgmt = api.resourceMap.mgmtClusters() as { data: MgmtResp | undefined; isLoading: boolean };
  const svc = api.resourceMap.serviceClusters() as { data: SvcResp | undefined; isLoading: boolean };

  if (mgmt.isLoading || svc.isLoading || !mgmt.data || !svc.data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-8">
      {/* Innogrid spec callout */}
      <Card className="border-brand-mint-200 bg-gradient-to-br from-brand-mint-50/60 to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-mint-100 text-brand-mint-700">
            <Layers className="size-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              관리 클러스터 + 서비스 클러스터 — 2-tier 모델
              <Badge variant="ghost" className="font-mono text-[10px]">/api/v2/clusters</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">관리 클러스터(mgmt)</strong>는 물리 서버 + OpenStack 제어면. {" "}
              <strong className="text-foreground">서비스 클러스터(svc)</strong>는 OpenStack Magnum이 프로젝트 단위로 생성한 K8s — 프로젝트가 과금 단위입니다.
            </p>
          </div>
        </div>
      </Card>

      {/* Management cluster */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Building2 className="size-4 text-slate-700" />
          <h2 className="text-sm font-semibold">관리 클러스터 (Management Cluster)</h2>
          <Badge variant="outline" className="font-mono text-[10px]">L0 + L1 + L2/L2b</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {mgmt.data.items.map((c) => (
            <MgmtClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      </section>

      {/* Service clusters */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Boxes className="size-4 text-brand-indigo-700" />
          <h2 className="text-sm font-semibold">서비스 클러스터 (Service Clusters)</h2>
          <Badge variant="outline" className="font-mono text-[10px]">L3 (VM) + L4 (K8s node)</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {svc.data.items.map((c) => (
            <SvcClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MgmtClusterCard({ cluster: c }: { cluster: ManagementCluster }) {
  return (
    <Card className="overflow-hidden border-slate-300/60">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">{c.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                management · OpenStack 운영
              </div>
            </div>
          </div>
          <Badge variant={c.status === "healthy" ? "success" : "warning"} className="gap-1">
            <span className="size-1.5 rounded-full bg-current opacity-80" />
            {c.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{c.description}</p>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/30 p-3">
          <Metric label="물리 노드" value={c.nodeCount} icon={Layers} />
          <Metric label="가속기" value={c.gpuCount} icon={Cpu} />
          <Metric label="전력" value={`${(c.totalPowerWatts / 1000).toFixed(1)}kW`} />
        </div>

        <div>
          <div className="text-[10px] uppercase text-muted-foreground">자식 서비스 클러스터</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.serviceClusters.map((sc) => (
              <Badge key={sc} variant="ghost" className="font-mono text-[10px]">
                {sc}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SvcClusterCard({ cluster: c }: { cluster: ServiceCluster }) {
  const cpuPct = Math.round((c.usedCpu / c.totalCpu) * 100);
  const memPct = Math.round((c.usedMemGb / c.totalMemGb) * 100);
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                c.status === "healthy" ? "bg-brand-mint-50 text-brand-mint-700" :
                  c.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
              )}
            >
              <Boxes className="size-5" />
            </div>
            <div>
              <div className="font-semibold leading-tight">{c.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                k8s v{c.k8sVersion} · {c.cni}
              </div>
            </div>
          </div>
          <Badge variant={c.status === "healthy" ? "success" : "warning"} className="gap-1">
            <span className="size-1.5 rounded-full bg-current opacity-80" />
            {c.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{c.description}</p>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/30 p-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              <Building2 className="size-3" /> 부모 클러스터
            </div>
            <div className="font-mono font-semibold">{c.parentCluster}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
              <FolderKanban className="size-3" /> OpenStack 프로젝트 (과금)
            </div>
            <div className="font-mono font-semibold">{c.openstackProject}</div>
          </div>
        </div>

        <div className="space-y-2">
          <ResourceRow label="vCPU" pct={cpuPct} used={c.usedCpu} total={c.totalCpu} color="indigo" />
          <ResourceRow label="메모리 (GB)" pct={memPct} used={c.usedMemGb} total={c.totalMemGb} color="mint" />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Metric label="VM/노드" value={c.nodeCount} />
          <Metric label="가속기" value={c.gpuCount} icon={Cpu} />
          <Metric label="전력" value={`${(c.totalPowerWatts / 1000).toFixed(1)}kW`} />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono">{c.id}</span>
          <Link href={`/iaas/projects`} className="hover:text-primary">테넌트 보기 →</Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
        {Icon && <Icon className="size-3" />} {label}
      </div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ResourceRow({
  label,
  pct,
  used,
  total,
  color,
}: {
  label: string;
  pct: number;
  used: number;
  total: number;
  color: "indigo" | "mint";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{used}/{total} · {pct}%</span>
      </div>
      <Progress value={pct} indicatorClassName={color === "mint" ? "bg-brand-mint-500" : "bg-brand-indigo-500"} />
    </div>
  );
}
