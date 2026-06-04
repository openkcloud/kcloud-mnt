"use client";
import * as React from "react";
import {
  Play,
  Square,
  Pause,
  RefreshCw,
  Move,
  Server,
  Cpu,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { Tenant, VM } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function InstancesPage() {
  const [tenantId, setTenantId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");

  const projects = api.iaas.projects() as { data: { items: Tenant[] } | undefined };
  const cleanFilters: Record<string, string> = {};
  if (tenantId !== "all") cleanFilters.tenantId = tenantId;
  if (status !== "all") cleanFilters.status = status;
  const { data, isLoading } = api.iaas.instances(cleanFilters) as {
    data: { items: VM[]; total: number } | undefined;
    isLoading: boolean;
  };

  const items = (data?.items ?? []).filter(
    (v) => !q || v.name.toLowerCase().includes(q.toLowerCase()),
  );

  const counts = {
    total: data?.total ?? 0,
    running: data?.items.filter((v) => v.status === "Running").length ?? 0,
    stopped: data?.items.filter((v) => v.status === "Stopped").length ?? 0,
    error: data?.items.filter((v) => v.status === "Error").length ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatBlock label="전체" value={counts.total} color="indigo" icon={Server} />
        <StatBlock label="Running" value={counts.running} color="mint" />
        <StatBlock label="Stopped" value={counts.stopped} color="slate" />
        <StatBlock label="Error" value={counts.error} color="rose" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="VM 이름 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="프로젝트" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 프로젝트</SelectItem>
              {projects.data?.items.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="Running">Running</SelectItem>
              <SelectItem value="Stopped">Stopped</SelectItem>
              <SelectItem value="Paused">Paused</SelectItem>
              <SelectItem value="Error">Error</SelectItem>
              <SelectItem value="Building">Building</SelectItem>
              <SelectItem value="Migrating">Migrating</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length}개 결과
          </span>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VM</TableHead>
                <TableHead>OpenStack 프로젝트</TableHead>
                <TableHead>Flavor / 리소스</TableHead>
                <TableHead>서비스 K8s</TableHead>
                <TableHead>GPU Passthrough</TableHead>
                <TableHead>OS · IP</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => window.location.assign(`/iaas/instances/${v.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-brand-indigo-100 p-1 text-brand-indigo-700">
                        <Server className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium">{v.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{v.id} · {v.clusterRole ?? "—"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{v.openstackProject ?? v.tenantId}</div>
                    <div className="text-[10px] text-muted-foreground">{v.hypervisor ?? v.nodeId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{v.flavor}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {v.vcpu}vCPU · {v.ramGb}GB · {v.diskGb}GB
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.serviceClusterId ? (
                      <div>
                        <Badge variant="default" className="font-mono text-[10px]">{v.serviceClusterId}</Badge>
                        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          L3 → L4 ({v.clusterRole ?? "worker"})
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">일반 VM</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.gpuPassthrough && v.gpuPassthrough.length > 0 ? (
                      <div className="space-y-0.5">
                        {v.gpuPassthrough.slice(0, 2).map((pt) => (
                          <div key={pt.acceleratorId} className="flex items-center gap-1">
                            <Cpu className="size-3 text-brand-mint-600" />
                            <span className="font-mono text-[10px]">{pt.acceleratorId}</span>
                            <Badge variant="success" className="text-[9px]">
                              {pt.state === "allocated_to_container" ? "in-use" : pt.state}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : v.acceleratorIds.length > 0 ? (
                      <Badge variant="ghost" className="gap-1">
                        <Cpu className="size-3" /> {v.acceleratorIds.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{v.os}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{v.ipAddresses[0]}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        v.status === "Running" ? "success" :
                          v.status === "Stopped" ? "secondary" :
                            v.status === "Error" ? "destructive" :
                              v.status === "Migrating" ? "warning" : "outline"
                      }
                      className="gap-1"
                    >
                      {v.status === "Running" && <span className="size-1.5 rounded-full bg-brand-mint-500" />}
                      {v.status}
                    </Badge>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {formatNumber(v.uptimeHours)}h
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Play className="size-4" /> 시작
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Square className="size-4" /> 정지
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pause className="size-4" /> 일시정지
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <RefreshCw className="size-4" /> 재시작
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Move className="size-4" /> 마이그레이션
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: "indigo" | "mint" | "slate" | "rose";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const map = {
    indigo: "bg-brand-indigo-100 text-brand-indigo-800",
    mint: "bg-brand-mint-50 text-brand-mint-700",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
        {Icon && (
          <div className={`flex size-9 items-center justify-center rounded-md ${map[color]}`}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
    </Card>
  );
}
