"use client";
import * as React from "react";
import {
  Boxes,
  Cpu,
  Search,
  MoreVertical,
  Scale,
  RefreshCw,
  Edit,
  Trash2,
  History,
  Activity,
  Terminal,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { KCluster, KWorkload } from "@/lib/types";

function WorkloadActions({ name, kind, replicas }: { name: string; kind: string; replicas: number }) {
  const [scaleOpen, setScaleOpen] = React.useState(false);
  const [newReplicas, setNewReplicas] = React.useState(replicas.toString());
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => window.location.assign(`/paas/workloads/${name}`)}>
            <Activity className="size-3.5" /> 상세 보기
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setScaleOpen(true)}>
            <Scale className="size-3.5" /> 스케일
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success(`${name} 롤아웃 재시작 — kubectl rollout restart`)}>
            <RefreshCw className="size-3.5" /> 롤아웃 재시작
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success(`${name} 매니페스트 편집기 열림`)}>
            <Edit className="size-3.5" /> YAML 편집
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success(`${name} 이전 버전으로 롤백 — revision 5 → 4`)}>
            <History className="size-3.5" /> 롤백
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success(`${name} Pod 컨테이너 셸 진입`)}>
            <Terminal className="size-3.5" /> 셸 (kubectl exec)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600" onClick={() => toast.error(`${name} 삭제 요청 — finalizer 실행 중`)}>
            <Trash2 className="size-3.5" /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={scaleOpen} onOpenChange={(o) => !o && setScaleOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>레플리카 스케일 — {name}</DialogTitle>
            <DialogDescription>{kind} 의 레플리카 개수를 변경합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>현재 레플리카</Label>
              <div className="font-mono text-2xl">{replicas}</div>
            </div>
            <div className="space-y-1.5">
              <Label>새 레플리카 수</Label>
              <Input type="number" value={newReplicas} onChange={(e) => setNewReplicas(e.target.value)} />
            </div>
            <div className="rounded-md bg-amber-50/60 border border-amber-200 p-2 text-xs text-amber-900">
              💡 HPA (Horizontal Pod Autoscaler) 가 활성화되어 있으면 자동 스케일링과 충돌할 수 있습니다.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleOpen(false)}>취소</Button>
            <Button onClick={() => {
              toast.success(`${name} → ${newReplicas} 레플리카로 스케일`);
              setScaleOpen(false);
            }}>적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function WorkloadsPage() {
  const [clusterId, setClusterId] = React.useState("all");
  const [namespace, setNamespace] = React.useState("all");
  const [q, setQ] = React.useState("");
  const clusters = api.paas.clusters() as { data: { items: KCluster[] } | undefined };
  const cleanFilters: Record<string, string> = {};
  if (clusterId !== "all") cleanFilters.clusterId = clusterId;
  if (namespace !== "all") cleanFilters.namespace = namespace;
  const { data, isLoading } = api.paas.workloads(cleanFilters) as {
    data: { items: KWorkload[] } | undefined;
    isLoading: boolean;
  };
  const items = (data?.items ?? []).filter(
    (w) => !q || w.name.toLowerCase().includes(q.toLowerCase()),
  );
  const namespaces = Array.from(new Set(data?.items.map((w) => w.namespace) ?? []));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="워크로드 이름…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pl-9"
            />
          </div>
          <Select value={clusterId} onValueChange={setClusterId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="클러스터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 클러스터</SelectItem>
              {clusters.data?.items.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={namespace} onValueChange={setNamespace}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="네임스페이스" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 네임스페이스</SelectItem>
              {namespaces.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{items.length}개</span>
        </div>
      </Card>
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>워크로드</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>네임스페이스</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>레플리카</TableHead>
                <TableHead>리소스</TableHead>
                <TableHead>가속기</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <TableRow key={w.id} className="cursor-pointer" onClick={() => window.location.assign(`/paas/workloads/${w.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-violet-100 p-1 text-violet-700">
                        <Boxes className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="flex flex-wrap gap-0.5 pt-0.5">
                          {Object.entries(w.labels).slice(0, 2).map(([k, v]) => (
                            <span key={k} className="rounded bg-secondary px-1 py-0 text-[9px] font-mono text-muted-foreground">
                              {k}={v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">{w.kind}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{w.namespace}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {w.image}
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono tabular-nums ${w.ready === w.replicas ? "text-foreground" : "text-amber-600"}`}>
                      {w.ready} / {w.replicas}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {w.cpu} / {w.mem}
                  </TableCell>
                  <TableCell>
                    {w.accelerators > 0 ? (
                      <Badge variant="success" className="gap-1">
                        <Cpu className="size-3" /> {w.accelerators}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        w.status === "Running" ? "success" :
                          w.status === "Succeeded" ? "default" :
                            w.status === "Failed" ? "destructive" : "warning"
                      }
                    >
                      {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <WorkloadActions name={w.name} kind={w.kind} replicas={w.replicas} />
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
