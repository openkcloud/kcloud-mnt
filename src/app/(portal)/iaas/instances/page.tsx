"use client";
import * as React from "react";
import {
  Play,
  Square,
  Pause,
  RefreshCw,
  Server,
  Cpu,
  Search,
  KeyRound,
  Copy,
  TerminalSquare,
  Power,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { VM, Accelerator } from "@/lib/types";
import { formatNumber, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const SSH_USER = "ubuntu"; // 이미지 기본 로그인 계정

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} 복사됨`, { description: text });
}

// 모델 문자열에서 용량 suffix 제거 (A100-SXM4-80GB → A100-SXM4)
function shortModel(m: string) {
  return m.replace(/[- ]?\d+GB\b.*$/i, "").trim() || m;
}

function accKindClass(kind?: string) {
  return kind === "GPU" ? "bg-green-100 text-green-800"
    : kind === "NPU" ? "bg-purple-100 text-purple-800"
    : kind === "PIM" ? "bg-amber-100 text-amber-800"
    : "bg-slate-100 text-slate-700";
}

export default function InstancesPage() {
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const myId = useAuth((s) => s.user?.email?.split("@")[0] ?? "");
  const [accFilter, setAccFilter] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");

  const cleanFilters: Record<string, string> = {};
  if (status !== "all") cleanFilters.status = status;
  const { data, isLoading } = api.iaas.instances(cleanFilters) as {
    data: { items: VM[]; total: number } | undefined;
    isLoading: boolean;
  };

  // 가속기 id → 상세(vendor/kind/model) 매핑
  const accData = api.accelerators.list() as { data: { items: Accelerator[] } | undefined };
  const accMap = React.useMemo(() => {
    const m = new Map<string, Accelerator>();
    (accData.data?.items ?? []).forEach((a) => m.set(a.id, a));
    return m;
  }, [accData.data]);

  // 사용자는 자신이 생성한 VM만 (관리자는 전체)
  const roleScoped = isAdmin
    ? (data?.items ?? [])
    : (data?.items ?? []).filter((v) => v.owner === myId);

  // 가속기 종류 필터 옵션 — 전체 가속기 인벤토리에서 도출 (VM 배정과 무관하게 안정적)
  const accOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    (accData.data?.items ?? []).forEach((a) => {
      m.set(`${a.kind}|${a.vendor}|${a.model}`, `${a.kind} · ${a.vendor} ${shortModel(a.model)}`);
    });
    return Array.from(m, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [accData.data]);

  const matchAcc = React.useCallback(
    (v: VM) => {
      if (accFilter === "all") return true;
      if (accFilter === "none") return v.acceleratorIds.length === 0;
      return v.acceleratorIds.some((id) => {
        const a = accMap.get(id);
        return a && `${a.kind}|${a.vendor}|${a.model}` === accFilter;
      });
    },
    [accFilter, accMap],
  );

  const items = roleScoped
    .filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase()))
    .filter(matchAcc);

  const counts = {
    total: roleScoped.length,
    running: roleScoped.filter((v) => v.status === "Running").length,
    stopped: roleScoped.filter((v) => v.status === "Stopped").length,
    error: roleScoped.filter((v) => v.status === "Error").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="전체" value={counts.total} accent="indigo" icon={Server} />
        <StatCard label="Running" value={counts.running} accent="mint" icon={Play} />
        <StatCard label="Stopped" value={counts.stopped} accent="sky" icon={Power} />
        <StatCard label="Error" value={counts.error} accent="rose" icon={AlertTriangle} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="가상머신 이름 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Select value={accFilter} onValueChange={setAccFilter}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="가속기" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 가속기</SelectItem>
              <SelectItem value="none">가속기 없음</SelectItem>
              {accOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
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
                <TableHead>가상머신</TableHead>
                <TableHead>프로젝트</TableHead>
                <TableHead>스펙</TableHead>
                {isAdmin && <TableHead>서비스 K8s</TableHead>}
                <TableHead>가속기</TableHead>
                <TableHead>OS · 접속 정보</TableHead>
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
                    {isAdmin && (
                      <div className="text-[10px] text-muted-foreground">{v.hypervisor ?? v.nodeId}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{v.flavor}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {v.vcpu}vCPU · {v.ramGb}GB · {v.diskGb}GB
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {v.serviceClusterId ? (
                        <div>
                          <Badge variant="default" className="font-mono text-[10px]">{v.serviceClusterId}</Badge>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            L3 → L4 ({v.clusterRole ?? "worker"})
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">일반 가상머신</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {v.acceleratorIds.length > 0 ? (
                      <div className="space-y-0.5">
                        {v.acceleratorIds.slice(0, 2).map((id) => {
                          const a = accMap.get(id);
                          const pt = v.gpuPassthrough?.find((p) => p.acceleratorId === id);
                          return (
                            <div key={id} className="flex items-center gap-1">
                              <Badge variant="ghost" className={cn("h-5 gap-1 px-1.5 font-mono text-[10px]", accKindClass(a?.kind))}>
                                <Cpu className="size-3" />
                                {a ? `${a.kind} · ${a.vendor} ${shortModel(a.model)}` : id}
                              </Badge>
                              {isAdmin && pt && (
                                <Badge variant="success" className="text-[9px]">
                                  {pt.state === "allocated_to_container" ? "in-use" : pt.state}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                        {v.acceleratorIds.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{v.acceleratorIds.length - 2}개 더</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="text-xs">{v.os}</div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <span className="text-muted-foreground/60">사설</span> {v.ipAddresses[0]}
                    </div>
                    {v.publicIp && (
                      <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700">
                        <span className="text-emerald-600/70">공인</span> {v.publicIp}
                        <button
                          type="button"
                          onClick={() => copyText(v.publicIp!, "공인 IP")}
                          className="cursor-pointer text-emerald-600/70 hover:text-emerald-800"
                          title="공인 IP 복사"
                        >
                          <Copy className="size-2.5" />
                        </button>
                      </div>
                    )}
                    {v.keyName && (
                      <Link
                        href="/iaas/keypairs"
                        className="flex w-fit items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary hover:underline"
                        title="키페어 메뉴에서 보기"
                      >
                        <KeyRound className="size-2.5 text-amber-600" /> {v.keyName}
                      </Link>
                    )}
                    {v.publicIp && v.keyName && (
                      <button
                        type="button"
                        onClick={() => copyText(`ssh -i ${v.keyName}.pem ${SSH_USER}@${v.publicIp}`, "SSH 접속 명령")}
                        className="mt-0.5 flex cursor-pointer items-center gap-1 rounded border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-foreground hover:bg-secondary"
                        title="SSH 접속 명령 복사"
                      >
                        <TerminalSquare className="size-2.5" /> SSH 복사
                      </button>
                    )}
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
