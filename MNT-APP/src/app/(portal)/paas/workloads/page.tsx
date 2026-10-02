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
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
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
  const [createOpen, setCreateOpen] = React.useState(false);
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
      <PageHeader
        title="워크로드"
        description="Deployment · StatefulSet · DaemonSet · Job · CronJob 통합 관리"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 워크로드 생성
          </Button>
        }
      />
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
      <CreateWorkloadDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clusters={clusters.data?.items ?? []}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 워크로드 생성 다이얼로그 — ETRI 260615 §8.i 반영
// ─────────────────────────────────────────────────────────────
type WorkloadKind = "Deployment" | "StatefulSet" | "DaemonSet" | "Job" | "CronJob";

const KIND_DESC: Record<WorkloadKind, string> = {
  Deployment: "무상태 앱 · 롤링 업데이트 · 스케일링에 적합 (웹·API 서비스)",
  StatefulSet: "안정된 네트워크 ID·영구 스토리지가 필요한 앱 (DB·큐)",
  DaemonSet: "모든 노드에 하나씩 실행 (로그 수집기·모니터링 에이전트)",
  Job: "1회 실행 후 종료 (배치 작업·데이터 처리)",
  CronJob: "주기적 스케줄 실행 (백업·정기 리포트)",
};

function CreateWorkloadDialog({
  open, onClose, clusters,
}: {
  open: boolean;
  onClose: () => void;
  clusters: KCluster[];
}) {
  const [step, setStep] = React.useState(1);
  const [kind, setKind] = React.useState<WorkloadKind>("Deployment");
  const [name, setName] = React.useState("");
  const [ns, setNs] = React.useState("default");
  const [clusterId, setClusterId] = React.useState(clusters[0]?.id ?? "");
  const [image, setImage] = React.useState("nginx:1.27");
  const [replicas, setReplicas] = React.useState("3");
  const [cpu, setCpu] = React.useState("500m");
  const [mem, setMem] = React.useState("512Mi");
  const [gpuCount, setGpuCount] = React.useState("0");
  const [gpuKind, setGpuKind] = React.useState("NVIDIA A100");
  const [schedule, setSchedule] = React.useState("0 2 * * *");

  const reset = () => {
    setStep(1);
    setKind("Deployment");
    setName("");
    setNs("default");
    setImage("nginx:1.27");
    setReplicas("3");
    setCpu("500m");
    setMem("512Mi");
    setGpuCount("0");
    setSchedule("0 2 * * *");
  };

  const submit = () => {
    toast.success(
      `${kind}/${name} 생성 요청 — ${ns} 네임스페이스, ${image}` +
        (gpuCount !== "0" ? `, ${gpuCount}× ${gpuKind}` : ""),
    );
    reset();
    onClose();
  };

  const showReplicas = kind === "Deployment" || kind === "StatefulSet";
  const showSchedule = kind === "CronJob";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            워크로드 생성 <span className="text-xs text-muted-foreground">· {step}/2 단계</span>
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "워크로드 유형과 기본 정보를 입력하기" : "리소스와 가속기를 지정하기"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>워크로드 유형</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {(["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"] as WorkloadKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                      kind === k
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{KIND_DESC[kind]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>클러스터</Label>
                <Select value={clusterId} onValueChange={setClusterId}>
                  <SelectTrigger><SelectValue placeholder="클러스터 선택" /></SelectTrigger>
                  <SelectContent>
                    {clusters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>네임스페이스</Label>
                <Input value={ns} onChange={(e) => setNs(e.target.value)} placeholder="default" />
              </div>
            </div>
            <div>
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" />
            </div>
            <div>
              <Label>컨테이너 이미지</Label>
              <Input value={image} onChange={(e) => setImage(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-2">
            {showReplicas && (
              <div>
                <Label>레플리카 수</Label>
                <Input type="number" value={replicas} onChange={(e) => setReplicas(e.target.value)} min="1" />
              </div>
            )}
            {showSchedule && (
              <div>
                <Label>스케줄 (Cron 표현식)</Label>
                <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="font-mono text-xs" />
                <p className="mt-1 text-[11px] text-muted-foreground">예: 0 2 * * * → 매일 새벽 2시</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPU 요청</Label>
                <Input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="500m" className="font-mono" />
              </div>
              <div>
                <Label>메모리 요청</Label>
                <Input value={mem} onChange={(e) => setMem(e.target.value)} placeholder="512Mi" className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-dashed border-border p-3">
              <div className="text-xs font-medium">AI 가속기 (선택 사항)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">개수</Label>
                  <Input type="number" value={gpuCount} onChange={(e) => setGpuCount(e.target.value)} min="0" max="8" />
                </div>
                <div>
                  <Label className="text-[11px]">종류</Label>
                  <Select value={gpuKind} onValueChange={setGpuKind} disabled={gpuCount === "0"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NVIDIA A100">NVIDIA A100</SelectItem>
                      <SelectItem value="NVIDIA H100">NVIDIA H100</SelectItem>
                      <SelectItem value="Furiosa RNGD">Furiosa RNGD</SelectItem>
                      <SelectItem value="Rebellions ATOM">Rebellions ATOM</SelectItem>
                      <SelectItem value="Samsung HBM-PIM">Samsung HBM-PIM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                가속기 개수 &gt; 0 지정 시 nodeSelector·tolerations가 자동 주입됨
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)} className="mr-auto">
              이전
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>취소</Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!name.trim()}>
              다음
            </Button>
          ) : (
            <Button onClick={submit}>생성</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
