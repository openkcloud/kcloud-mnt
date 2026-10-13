"use client";
/**
 * 워크로드 — 선택한 서비스 클러스터의 Deployment·StatefulSet·DaemonSet·Job·CronJob 라이브 조회 + 쓰기.
 * 네임스페이스 리소스는 사용자 self-service: 생성(기본 Deployment)·스케일·재시작·삭제.
 * 레이아웃·폰트는 IaaS 목록 화면 규약(툴바 Card + 테이블 Card)과 동일.
 */
import * as React from "react";
import { Search, Loader2, Layers, Plus, Scale, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm";
import { ClusterScopeBar, useClusterScope } from "@/components/paas/cluster-scope-bar";
import {
  useWorkloads, useCreateWorkload, useScaleWorkload, useRestartWorkload, useDeleteWorkload,
  useNamespaces, type WorkloadRow,
} from "@/lib/paas-api";

const KINDS = ["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"] as const;
const SCALABLE = new Set(["Deployment", "StatefulSet"]);
const RESTARTABLE = new Set(["Deployment", "StatefulSet", "DaemonSet"]);

function stVariant(s: string): "success" | "warning" | "destructive" | "secondary" {
  if (s === "Running" || s === "Succeeded") return "success";
  if (s === "Pending") return "warning";
  if (s === "Failed") return "destructive";
  return "secondary";
}

export default function WorkloadsPage() {
  const { clusterId } = useClusterScope();
  const [namespace, setNamespace] = React.useState("all");
  const [kind, setKind] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [scaleTarget, setScaleTarget] = React.useState<WorkloadRow | null>(null);

  const workloads = useWorkloads(clusterId, namespace === "all" ? undefined : namespace);
  const restart = useRestartWorkload(clusterId);
  const del = useDeleteWorkload(clusterId);
  const confirm = useConfirm();
  const busy = restart.isPending || del.isPending;

  const items = (workloads.data ?? []).filter(
    (w) =>
      (kind === "all" || w.kind === kind) &&
      (!q || w.name.includes(q) || w.image.includes(q)),
  );

  async function doRestart(w: WorkloadRow) {
    if (!(await confirm({ title: "롤아웃 재시작", confirmLabel: "재시작", description: `${w.name} 을(를) 재시작할까요? 파드가 순차 교체됩니다.` }))) return;
    restart.mutate({ kind: w.kind, namespace: w.namespace, name: w.name },
      { onSuccess: () => toast.success(`${w.name} 재시작 요청됨`), onError: (e) => toast.error("재시작 실패", { description: String((e as Error).message) }) });
  }
  async function doDelete(w: WorkloadRow) {
    if (!(await confirm({ title: "워크로드 삭제", destructive: true, confirmLabel: "삭제", description: `${w.name} 을(를) 삭제할까요? 되돌릴 수 없습니다.` }))) return;
    del.mutate({ kind: w.kind, namespace: w.namespace, name: w.name },
      { onSuccess: () => toast.success(`${w.name} 삭제 요청됨`), onError: (e) => toast.error("삭제 실패", { description: String((e as Error).message) }) });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ClusterScopeBar
          queryKeys={[["paas-workloads"], ["paas-namespaces"]]}
          namespace={namespace}
          onNamespaceChange={setNamespace}
          trailing={
            <Button size="sm" disabled={!clusterId} onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> 워크로드 생성
            </Button>
          }
        >
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-36"><SelectValue placeholder="유형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="워크로드 검색…" value={q} onChange={(e) => setQ(e.target.value)} className="w-52 pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">총 {items.length}개</span>
        </ClusterScopeBar>
      </Card>

      <Card>
        {!clusterId ? (
          <EmptyBox text="먼저 서비스 클러스터를 선택하세요." />
        ) : workloads.isLoading ? (
          <Skeleton className="h-64" />
        ) : workloads.isError ? (
          <EmptyBox text="워크로드 조회 실패 — 클러스터 API 응답 오류." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>워크로드</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>네임스페이스</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>레플리카</TableHead>
                <TableHead>요청 자원</TableHead>
                <TableHead>가속기</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <Row
                  key={`${w.kind}/${w.namespace}/${w.name}`}
                  w={w} busy={busy}
                  onScale={() => setScaleTarget(w)}
                  onRestart={() => doRestart(w)}
                  onDelete={() => doDelete(w)}
                />
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    조건에 맞는 워크로드가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {createOpen && <CreateDialog clusterId={clusterId} defaultNs={namespace === "all" ? "default" : namespace} onClose={() => setCreateOpen(false)} />}
      {scaleTarget && <ScaleDialog clusterId={clusterId} w={scaleTarget} onClose={() => setScaleTarget(null)} />}
    </div>
  );
}

function Row({
  w, busy, onScale, onRestart, onDelete,
}: {
  w: WorkloadRow; busy: boolean; onScale: () => void; onRestart: () => void; onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-brand-indigo-600" />
          <span className="max-w-[220px] truncate font-mono text-sm font-semibold">{w.name}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant="outline" className="text-[10px]">{w.kind}</Badge></TableCell>
      <TableCell className="font-mono text-xs">{w.namespace}</TableCell>
      <TableCell className="max-w-[240px] truncate font-mono text-[11px] text-muted-foreground">{w.image}</TableCell>
      <TableCell className="font-mono text-xs">
        {w.kind === "CronJob" ? (w.schedule || "—") : `${w.ready}/${w.total}`}
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">
        {[w.requests.cpu, w.requests.memory].filter(Boolean).join(" · ") || "—"}
      </TableCell>
      <TableCell>
        {w.accelerator ? (
          <Badge variant="default" className="font-mono text-[10px]">{w.accelerator.kind} × {w.accelerator.count}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={stVariant(w.status)} className="text-[10px]">
          {w.status === "Pending" && <Loader2 className="size-3 animate-spin" />}
          {w.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-0.5">
          {SCALABLE.has(w.kind) && (
            <Button variant="ghost" size="icon-sm" title="레플리카 조정" disabled={busy} onClick={onScale}><Scale className="size-3.5" /></Button>
          )}
          {RESTARTABLE.has(w.kind) && (
            <Button variant="ghost" size="icon-sm" title="재시작" disabled={busy} onClick={onRestart}><RotateCw className="size-3.5" /></Button>
          )}
          <Button variant="ghost" size="icon-sm" title="삭제" disabled={busy} onClick={onDelete}><Trash2 className="size-3.5 text-rose-600" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ScaleDialog({ clusterId, w, onClose }: { clusterId: string; w: WorkloadRow; onClose: () => void }) {
  const scale = useScaleWorkload(clusterId);
  const [replicas, setReplicas] = React.useState(String(w.total));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>레플리카 조정</DialogTitle>
          <DialogDescription className="font-mono text-xs">{w.kind} · {w.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label>레플리카 수</Label>
          <Input type="number" min={0} value={replicas} onChange={(e) => setReplicas(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            disabled={scale.isPending}
            onClick={() => scale.mutate(
              { kind: w.kind, namespace: w.namespace, name: w.name, replicas: Number(replicas) },
              { onSuccess: () => { toast.success(`${w.name} → ${replicas} 레플리카`); onClose(); }, onError: (e) => toast.error("조정 실패", { description: String((e as Error).message) }) },
            )}
          >
            {scale.isPending && <Loader2 className="size-3.5 animate-spin" />} 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ clusterId, defaultNs, onClose }: { clusterId: string; defaultNs: string; onClose: () => void }) {
  const create = useCreateWorkload(clusterId);
  const namespaces = useNamespaces(clusterId);
  const [form, setForm] = React.useState({
    namespace: defaultNs, name: "", image: "", replicas: "1",
    cpu: "", memory: "", acceleratorKind: "none", acceleratorCount: "1",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    create.mutate({
      namespace: form.namespace, name: form.name, image: form.image,
      replicas: Number(form.replicas) || 1,
      cpu: form.cpu || undefined, memory: form.memory || undefined,
      acceleratorKind: form.acceleratorKind === "none" ? undefined : form.acceleratorKind,
      acceleratorCount: form.acceleratorKind === "none" ? 0 : Number(form.acceleratorCount),
    }, {
      onSuccess: () => { toast.success(`${form.name} 생성됨`); onClose(); },
      onError: (e) => toast.error("생성 실패", { description: String((e as Error).message) }),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>워크로드 생성</DialogTitle>
          <DialogDescription>Deployment 를 생성합니다. (다른 종류는 YAML 적용 예정)</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>네임스페이스</Label>
              <Select value={form.namespace} onValueChange={(v) => set("namespace", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(namespaces.data ?? [form.namespace]).map((ns) => (
                    <SelectItem key={ns} value={ns} className="font-mono text-xs">{ns}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>이름</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="my-app" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>이미지</Label>
            <Input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="nginx:1.27" className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>레플리카</Label>
              <Input type="number" min={0} value={form.replicas} onChange={(e) => set("replicas", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPU 요청</Label>
              <Input value={form.cpu} onChange={(e) => set("cpu", e.target.value)} placeholder="500m" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>메모리 요청</Label>
              <Input value={form.memory} onChange={(e) => set("memory", e.target.value)} placeholder="512Mi" className="font-mono text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>가속기</Label>
              <Select value={form.acceleratorKind} onValueChange={(v) => set("acceleratorKind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  <SelectItem value="nvidia.com/gpu">nvidia.com/gpu</SelectItem>
                  <SelectItem value="furiosa.ai/rngd">furiosa.ai/rngd</SelectItem>
                  <SelectItem value="rebellions.ai/atom">rebellions.ai/atom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.acceleratorKind !== "none" && (
              <div className="space-y-1.5">
                <Label>가속기 개수</Label>
                <Input type="number" min={1} value={form.acceleratorCount} onChange={(e) => set("acceleratorCount", e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button disabled={create.isPending || !form.name || !form.image} onClick={submit}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />} 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyBox({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}
