"use client";
import { ChangeMark } from "@/components/change-mark";
import * as React from "react";
import Link from "next/link";
import {
  Boxes, Building2, Cpu, Layers, FolderKanban, Plus, Inbox, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Server, Network, Loader2, Check, Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ManagementCluster, ServiceCluster, Network as NetworkT } from "@/lib/types";

type MgmtResp = { observed_at: string; is_stale: boolean; items: ManagementCluster[] };
type SvcResp = { observed_at: string; is_stale: boolean; items: ServiceCluster[] };

// ─────────────────────────────────────────────────────────────
// 서비스 클러스터 신청 — 260702 회의록 2.6
//   사용자는 클러스터를 직접 생성할 수 없다. VM 개수·Flavor·가속기를 정해 관리자에게 신청한다.
//   관리자가 승인하면 Portal → Magnum → Nova VM → Neutron → K8s Cluster(Control Plane + Worker) 순으로 생성한다.
// ─────────────────────────────────────────────────────────────

const K8S_FLAVORS = [
  { name: "k8s.m1.large", vcpu: 4, ramGb: 16, diskGb: 100, accel: false },
  { name: "k8s.c1.xlarge", vcpu: 8, ramGb: 32, diskGb: 200, accel: false },
  { name: "k8s.g1.a100", vcpu: 16, ramGb: 128, diskGb: 500, accel: true },
  { name: "k8s.n1.rngd", vcpu: 16, ramGb: 128, diskGb: 500, accel: true },
];

const ACCEL_KINDS = ["없음", "NVIDIA A100 80GB", "NVIDIA H100 80GB", "Rebellions ATOM+", "Furiosa RNGD"];

export interface ClusterRequest {
  id: string;
  name: string;
  project: string;
  requester: string;
  workers: number;
  controlPlanes: number;
  flavor: string;
  accelKind: string;
  accelCount: number;
  network: string;
  k8sVersion: string;
  status: "pending" | "provisioning" | "ready" | "rejected";
  requestedAt: string;
}

const SEED_REQUESTS: ClusterRequest[] = [
  { id: "req-1041", name: "svc-llm-eval", project: "llm-serving", requester: "윤호영 (오케스트로)", workers: 3, controlPlanes: 1, flavor: "k8s.g1.a100", accelKind: "NVIDIA A100 80GB", accelCount: 3, network: "DJ-Z1-Svc", k8sVersion: "1.31", status: "pending", requestedAt: "2026-09-14 09:12" },
  { id: "req-1040", name: "svc-edge-stt", project: "edge-inference", requester: "김바울 (이노그리드)", workers: 2, controlPlanes: 1, flavor: "k8s.n1.rngd", accelKind: "Furiosa RNGD", accelCount: 2, network: "PG-Z1-Svc", k8sVersion: "1.31", status: "pending", requestedAt: "2026-09-13 17:40" },
  { id: "req-1038", name: "svc-ai-research-2", project: "ai-research", requester: "최현화 (ETRI)", workers: 4, controlPlanes: 3, flavor: "k8s.c1.xlarge", accelKind: "없음", accelCount: 0, network: "DJ-Z1-Svc", k8sVersion: "1.30", status: "ready", requestedAt: "2026-09-10 11:05" },
];

// Magnum 생성 흐름 5단계 (ETRI 260615 §4.B 검토 의견 · 회의록 2.6)
// 렌더 밖에서 신청 ID·시각을 만든다 (react-hooks/purity)
let requestSeq = 1042;
function nextRequestMeta() {
  requestSeq += 1;
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    id: `req-${requestSeq}`,
    requestedAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const PROVISION_STEPS = [
  { key: "portal", label: "Portal", desc: "신청 승인 · 쿼터 확인 · Magnum 템플릿 선택", icon: Inbox },
  { key: "magnum", label: "OpenStack Magnum", desc: "ClusterTemplate → Cluster 생성 요청 (Heat 스택)", icon: Waypoints },
  { key: "nova", label: "Nova VM 생성", desc: "Control Plane + Worker VM · Flavor · 가속기 패스스루", icon: Server },
  { key: "neutron", label: "Neutron 연동", desc: "네트워크·서브넷·보안 그룹·Floating IP 연결", icon: Network },
  { key: "cluster", label: "Kubernetes Cluster", desc: "kubeadm 부트스트랩 · CNI · kubeconfig 발급", icon: Boxes },
];

export default function ClustersPage() {
  const mgmt = api.resourceMap.mgmtClusters() as { data: MgmtResp | undefined; isLoading: boolean };
  const svc = api.resourceMap.serviceClusters() as { data: SvcResp | undefined; isLoading: boolean };
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";

  const [requests, setRequests] = React.useState<ClusterRequest[]>(SEED_REQUESTS);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState<ClusterRequest | null>(null);

  if (mgmt.isLoading || svc.isLoading || !mgmt.data || !svc.data) return <Skeleton className="h-96" />;

  const myName = user?.displayName ?? "";
  const myRequests = requests.filter((r) => r.requester.startsWith(myName));
  const pending = requests.filter((r) => r.status === "pending");

  function submitRequest(r: ClusterRequest) {
    setRequests((prev) => [r, ...prev]);
    toast.success(`서비스 클러스터 ${r.name} 신청됨 — 관리자 승인 대기`, {
      description: `Worker ${r.workers}대 · ${r.flavor} · ${r.accelKind === "없음" ? "가속기 없음" : `${r.accelKind} × ${r.accelCount}`}`,
    });
  }

  function approve(r: ClusterRequest) {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "provisioning" } : x)));
    setProvisioning(r);
  }

  function reject(r: ClusterRequest) {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "rejected" } : x)));
    toast.error(`${r.name} 신청 반려 — 신청자에게 사유 통보`);
  }

  function finishProvision(r: ClusterRequest) {
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "ready" } : x)));
    setProvisioning(null);
    toast.success(`${r.name} 생성 완료 — kubeconfig 발급, 신청자에게 통보`);
  }

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
              <strong className="text-foreground">서비스 클러스터(svc)</strong>는 OpenStack Magnum이 프로젝트 단위로 생성한 K8s — 프로젝트가 과금 단위다.
            </p>
          </div>
        </div>
      </Card>

      {/* 260702 회의록 2.6 — 생성 주체·신청 절차 */}
      <ChangeMark ids={["CR-PAAS-06"]}>
<div className="rounded-md border border-brand-indigo-200 bg-brand-indigo-50/50 px-3 py-2 text-[11px] text-brand-indigo-900">
        <strong>생성 주체</strong> — 사용자는 클러스터를 직접 생성할 수 없고 로그인 시 <strong>사용 가능한 클러스터만</strong> 본다.
        클러스터가 필요하면 VM 개수·Flavor·가속기 종류와 개수를 정해 <strong>관리자에게 신청</strong>한다. 관리자가 승인하면
        Portal → Magnum → Nova VM → Neutron → K8s Cluster(Control Plane + Worker) 흐름으로 생성된다.
      </div>
</ChangeMark>

      {/* 사용자: 신청 / 관리자: 신청 관리 */}
      {isAdmin ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <ChangeMark ids={["CR-PAAS-06", "CR-PAAS-03"]}>
<div className="flex items-baseline gap-2">
              <Inbox className="size-4 text-brand-indigo-700" />
              <h2 className="text-sm font-semibold">클러스터 신청 관리</h2>
              <Badge variant={pending.length > 0 ? "warning" : "outline"} className="text-[10px]">대기 {pending.length}</Badge>
            </div>
</ChangeMark>
            <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
              <Plus className="size-3.5" /> 관리자 직접 생성
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>신청</TableHead>
                  <TableHead>프로젝트 · 신청자</TableHead>
                  <TableHead>노드 구성</TableHead>
                  <TableHead>가속기</TableHead>
                  <TableHead>네트워크</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-sm font-semibold">{r.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.id} · {r.requestedAt}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono">{r.project}</div>
                      <div className="text-muted-foreground">{r.requester}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      CP {r.controlPlanes} + Worker {r.workers} · {r.flavor}
                      <div className="text-[10px] text-muted-foreground">k8s v{r.k8sVersion}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.accelKind === "없음" ? <span className="text-muted-foreground">없음</span> : <span className="inline-flex items-center gap-1"><Cpu className="size-3" />{r.accelKind} × {r.accelCount}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.network}</TableCell>
                    <TableCell><RequestStatus status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 text-[11px]" onClick={() => approve(r)}>
                            <CheckCircle2 className="size-3.5" /> 승인·생성
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] text-rose-600" onClick={() => reject(r)}>
                            <XCircle className="size-3.5" /> 반려
                          </Button>
                        </div>
                      ) : r.status === "provisioning" ? (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setProvisioning(r)}>진행 보기</Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <ChangeMark ids={["CR-PAAS-06", "CR-PAAS-03"]}>
<div className="flex items-baseline gap-2">
              <Inbox className="size-4 text-brand-indigo-700" />
              <h2 className="text-sm font-semibold">내 클러스터 신청</h2>
              <Badge variant="outline" className="text-[10px]">{myRequests.length}건</Badge>
            </div>
</ChangeMark>
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              <Plus className="size-3.5" /> 서비스 클러스터 신청
            </Button>
          </div>
          {myRequests.length === 0 ? (
            <Card className="p-6 text-center text-xs text-muted-foreground">
              신청 내역이 없다. 클러스터가 필요하면 VM 개수·Flavor·가속기를 정해 신청한다.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {myRequests.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-semibold">{r.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{r.id} · {r.requestedAt}</div>
                    </div>
                    <RequestStatus status={r.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>프로젝트 <span className="font-mono text-foreground">{r.project}</span></div>
                    <div>네트워크 <span className="font-mono text-foreground">{r.network}</span></div>
                    <div>노드 <span className="font-mono text-foreground">CP {r.controlPlanes} + W {r.workers}</span></div>
                    <div>Flavor <span className="font-mono text-foreground">{r.flavor}</span></div>
                    <div className="col-span-2">가속기 <span className="font-mono text-foreground">{r.accelKind === "없음" ? "없음" : `${r.accelKind} × ${r.accelCount}`}</span></div>
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {r.status === "pending" && "관리자 승인 대기. 승인 후 Magnum이 VM·네트워크·클러스터를 생성한다."}
                    {r.status === "provisioning" && "관리자가 승인해 생성 중이다."}
                    {r.status === "ready" && "생성 완료. 아래 서비스 클러스터 목록과 kubeconfig에서 사용한다."}
                    {r.status === "rejected" && "반려됨. 사유는 알림으로 전달된다."}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Management cluster — 관리자만 */}
      {isAdmin && (
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
      )}

      {/* Service clusters */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <Boxes className="size-4 text-brand-indigo-700" />
          <h2 className="text-sm font-semibold">{isAdmin ? "서비스 클러스터 (Service Clusters)" : "내가 사용할 수 있는 서비스 클러스터"}</h2>
          <Badge variant="outline" className="font-mono text-[10px]">L3 (VM) + L4 (K8s node)</Badge>
          {!isAdmin && <span className="text-[11px] text-muted-foreground">소속 프로젝트의 클러스터만 표시</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {svc.data.items.map((c) => (
            <SvcClusterCard key={c.id} cluster={c} />
          ))}
        </div>
      </section>

      <ClusterRequestDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSubmit={submitRequest}
        requester={`${user?.displayName ?? ""} (${user?.org ?? ""})`}
        isAdmin={isAdmin}
      />
      <ProvisioningDialog request={provisioning} onClose={() => setProvisioning(null)} onDone={finishProvision} />
    </div>
  );
}

function RequestStatus({ status }: { status: ClusterRequest["status"] }) {
  const map = {
    pending: { label: "승인 대기", v: "warning" as const },
    provisioning: { label: "생성 중", v: "default" as const },
    ready: { label: "사용 가능", v: "success" as const },
    rejected: { label: "반려", v: "destructive" as const },
  };
  return <Badge variant={map[status].v} className="text-[10px]">{map[status].label}</Badge>;
}

// ─────────────────────────────────────────────────────────────
// 신청 위저드 — 기본 → 노드(VM 개수·Flavor·가속기) → 네트워크 → 확인
// ─────────────────────────────────────────────────────────────

const REQ_STEPS = [
  { key: "basic", title: "기본", icon: FolderKanban },
  { key: "nodes", title: "노드·가속기", icon: Server },
  { key: "network", title: "네트워크", icon: Network },
  { key: "review", title: "확인", icon: CheckCircle2 },
] as const;
type ReqStep = typeof REQ_STEPS[number]["key"];

const PROJECT_OPTIONS = ["ai-research", "llm-serving", "edge-inference"];

function ClusterRequestDialog({
  open, onClose, onSubmit, requester, isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: ClusterRequest) => void;
  requester: string;
  isAdmin: boolean;
}) {
  const networks = api.iaas.networks() as { data: { items: NetworkT[] } | undefined };
  const [step, setStep] = React.useState<ReqStep>("basic");
  const [name, setName] = React.useState("");
  const [project, setProject] = React.useState(PROJECT_OPTIONS[0]);
  const [k8sVersion, setK8sVersion] = React.useState("1.31");
  const [controlPlanes, setControlPlanes] = React.useState(1);
  const [workers, setWorkers] = React.useState(3);
  const [flavor, setFlavor] = React.useState(K8S_FLAVORS[0].name);
  const [accelKind, setAccelKind] = React.useState("없음");
  const [accelCount, setAccelCount] = React.useState(1);
  const [network, setNetwork] = React.useState("");

  const idx = REQ_STEPS.findIndex((s) => s.key === step);
  const selectedFlavor = K8S_FLAVORS.find((f) => f.name === flavor)!;
  const svcNetworks = (networks.data?.items ?? []).filter((n) => n.class !== "관리망");
  const canNext: Record<ReqStep, boolean> = {
    basic: name.trim().length > 0,
    nodes: workers >= 1 && (accelKind === "없음" || accelCount >= 1),
    network: !!network,
    review: true,
  };

  function reset() {
    setStep("basic"); setName(""); setProject(PROJECT_OPTIONS[0]); setK8sVersion("1.31");
    setControlPlanes(1); setWorkers(3); setFlavor(K8S_FLAVORS[0].name); setAccelKind("없음"); setAccelCount(1); setNetwork("");
  }

  function submit() {
    const net = svcNetworks.find((n) => n.id === network);
    const meta = nextRequestMeta();
    onSubmit({
      id: meta.id,
      name: name.trim(),
      project,
      requester,
      workers,
      controlPlanes,
      flavor,
      accelKind,
      accelCount: accelKind === "없음" ? 0 : accelCount,
      network: net?.name ?? network,
      k8sVersion,
      status: isAdmin ? "ready" : "pending",
      requestedAt: meta.requestedAt,
    });
    onClose();
    setTimeout(reset, 300);
  }

  const totalVcpu = (controlPlanes + workers) * selectedFlavor.vcpu;
  const totalRam = (controlPlanes + workers) * selectedFlavor.ramGb;
  const totalAccel = accelKind === "없음" ? 0 : workers * accelCount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isAdmin ? "서비스 클러스터 생성 (관리자)" : "서비스 클러스터 신청"}</DialogTitle>
          <DialogDescription>
            VM 개수와 Flavor, 가속기 종류·개수를 정한다. {isAdmin ? "관리자는 승인 없이 바로 생성한다." : "제출하면 관리자 승인 후 Magnum이 생성한다."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-y border-border py-3">
          {REQ_STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = s.key === step;
            const done = i < idx;
            return (
              <React.Fragment key={s.key}>
                <button type="button" onClick={() => (i <= idx ? setStep(s.key) : undefined)} disabled={i > idx} className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                    active && "bg-brand-indigo-600 text-white shadow-md",
                    done && "bg-brand-mint-500 text-white",
                    !active && !done && "bg-secondary text-muted-foreground",
                  )}>
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <div className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.title}</div>
                </button>
                {i < REQ_STEPS.length - 1 && <div className={cn("mx-1 mt-[-12px] h-px flex-1", done ? "bg-brand-mint-500" : "bg-border")} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="min-h-[280px] space-y-3 py-2">
          {step === "basic" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cl-name">클러스터 이름</Label>
                <Input id="cl-name" placeholder="예: svc-llm-eval" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kubernetes 버전</Label>
                <div className="flex gap-1.5">
                  {["1.30", "1.31", "1.32"].map((v) => (
                    <button key={v} type="button" onClick={() => setK8sVersion(v)} className={cn("rounded-md border px-3 py-1.5 font-mono text-xs", k8sVersion === v ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40")}>v{v}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>프로젝트 (과금 단위)</Label>
                <div className="grid gap-2 md:grid-cols-3">
                  {PROJECT_OPTIONS.map((p) => (
                    <button key={p} type="button" onClick={() => setProject(p)} className={cn("flex items-center gap-2 rounded-lg border p-3 text-left", project === p ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40")}>
                      <FolderKanban className="size-4 text-brand-indigo-600" />
                      <span className="font-mono text-sm">{p}</span>
                      {project === p && <CheckCircle2 className="ml-auto size-4 text-brand-mint-600" />}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">클러스터의 VM·가속기는 이 프로젝트의 쿼터에서 차감된다.</p>
              </div>
            </div>
          )}

          {step === "nodes" && (
            <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                <div>
                  <Label>VM 개수</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <Counter label="Control Plane" value={controlPlanes} onChange={setControlPlanes} min={1} max={3} step={2} hint="1 또는 3(HA)" />
                    <Counter label="Worker" value={workers} onChange={setWorkers} min={1} max={20} hint="1~20대" />
                  </div>
                </div>
                <div>
                  <Label>가속기 종류 · Worker당 개수</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ACCEL_KINDS.map((k) => (
                      <button key={k} type="button" onClick={() => setAccelKind(k)} className={cn("rounded-md border px-2.5 py-1.5 text-xs", accelKind === k ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40")}>
                        {k}
                      </button>
                    ))}
                  </div>
                  {accelKind !== "없음" && (
                    <div className="mt-2 w-40">
                      <Counter label="Worker당" value={accelCount} onChange={setAccelCount} min={1} max={8} hint="1~8장" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>노드 Flavor (VM 생성 수준까지 사용자가 입력)</Label>
                {K8S_FLAVORS.map((f) => (
                  <button key={f.name} type="button" onClick={() => setFlavor(f.name)} className={cn("flex w-full items-center gap-3 rounded-lg border p-2.5 text-left", flavor === f.name ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40")}>
                    <Server className="size-4 text-rose-600" />
                    <div className="flex-1">
                      <div className="font-mono text-sm font-semibold">{f.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{f.vcpu} vCPU · {f.ramGb} GB · {f.diskGb} GB{f.accel ? " · 가속기 패스스루" : ""}</div>
                    </div>
                    {flavor === f.name && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
                <div className="rounded-md border border-border bg-secondary/30 p-2.5 font-mono text-[11px] text-muted-foreground">
                  합계 · VM {controlPlanes + workers}대 · {totalVcpu} vCPU · {totalRam} GB · 가속기 {totalAccel}장 · 볼륨은 Flavor 디스크로 자동 생성
                </div>
              </div>
            </div>
          )}

          {step === "network" && (
            <>
              <div className="text-sm font-semibold">네트워크 선택</div>
              <p className="text-xs text-muted-foreground">관리자가 만든 네트워크 중에서 노드 VM이 연결될 망을 선택한다. Neutron 연동 단계에서 서브넷·보안 그룹·Floating IP가 붙는다.</p>
              <div className="grid gap-2 md:grid-cols-2">
                {svcNetworks.map((n) => (
                  <button key={n.id} type="button" onClick={() => setNetwork(n.id)} className={cn("flex items-center gap-3 rounded-lg border p-3 text-left", network === n.id ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40")}>
                    <Network className="size-4 text-sky-600" />
                    <div className="flex-1">
                      <div className="font-mono text-sm font-semibold">{n.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{n.class} · {n.cidr} · VLAN {n.vlan}</div>
                    </div>
                    {network === n.id && <CheckCircle2 className="size-4 text-brand-mint-600" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <div className="text-sm font-semibold">{isAdmin ? "생성 내용 확인" : "신청 내용 확인"}</div>
              <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
                <Row label="클러스터" value={`${name} · k8s v${k8sVersion}`} />
                <Row label="프로젝트" value={project} />
                <Row label="노드" value={`Control Plane ${controlPlanes} + Worker ${workers} · ${flavor}`} />
                <Row label="가속기" value={accelKind === "없음" ? "없음" : `${accelKind} × ${accelCount}/Worker (총 ${totalAccel}장)`} />
                <Row label="네트워크" value={svcNetworks.find((n) => n.id === network)?.name ?? "-"} />
                <Row label="처리 흐름" value={isAdmin ? "Portal → Magnum → Nova VM → Neutron → Cluster" : "신청 → 관리자 승인 → Magnum → Nova VM → Neutron → Cluster → kubeconfig 통보"} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button variant="outline" onClick={() => idx > 0 && setStep(REQ_STEPS[idx - 1].key)} disabled={idx === 0}>
            <ChevronLeft className="size-3.5" /> 이전
          </Button>
          {step === "review" ? (
            <Button onClick={submit}><CheckCircle2 className="size-3.5" /> {isAdmin ? "생성" : "신청 제출"}</Button>
          ) : (
            <Button onClick={() => setStep(REQ_STEPS[idx + 1].key)} disabled={!canNext[step]}>
              다음 <ChevronRight className="size-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Counter({ label, value, onChange, min, max, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</Button>
        <span className="w-8 text-center font-mono text-lg font-bold tabular-nums">{value}</span>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</Button>
      </div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-sm">{value || <span className="text-rose-500">(미선택)</span>}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 생성 진행 — Magnum 5단계 시각화 (관리자 승인 후 자동 진행)
// ─────────────────────────────────────────────────────────────

function ProvisioningDialog({ request, onClose, onDone }: { request: ClusterRequest | null; onClose: () => void; onDone: (r: ClusterRequest) => void }) {
  if (!request) return null;
  // 신청이 바뀌면 key로 내부 상태(진행 단계)를 초기화한다
  return <ProvisioningDialogInner key={request.id} request={request} onClose={onClose} onDone={onDone} />;
}

function ProvisioningDialogInner({ request, onClose, onDone }: { request: ClusterRequest; onClose: () => void; onDone: (r: ClusterRequest) => void }) {
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c < PROVISION_STEPS.length ? c + 1 : c));
    }, 1400);
    return () => clearInterval(timer);
  }, []);

  const done = current >= PROVISION_STEPS.length;
  const pct = Math.min(100, Math.round((current / PROVISION_STEPS.length) * 100));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {done ? <Check className="size-4 text-brand-mint-600" /> : <Loader2 className="size-4 animate-spin text-brand-indigo-600" />}
            {request.name} 생성 {done ? "완료" : "진행 중"}
          </DialogTitle>
          <DialogDescription>
            openKcloud Portal → Kubernetes 서비스 신청 → OpenStack Magnum → Nova VM 생성 · Neutron 연동 → Kubernetes Cluster(Control Plane + Worker).
          </DialogDescription>
        </DialogHeader>
        <Progress value={pct} indicatorClassName={done ? "bg-brand-mint-500" : "bg-brand-indigo-500"} />
        <ChangeMark ids={["CR-PAAS-01"]}>
        <ol className="space-y-2">
          {PROVISION_STEPS.map((s, i) => {
            const state = i < current ? "done" : i === current && !done ? "active" : "todo";
            const Icon = s.icon;
            return (
              <li key={s.key} className={cn("flex items-start gap-3 rounded-lg border p-3", state === "active" ? "border-brand-indigo-300 bg-brand-indigo-50/40" : state === "done" ? "border-brand-mint-200 bg-brand-mint-50/30" : "border-border")}>
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", state === "done" ? "bg-brand-mint-500 text-white" : state === "active" ? "bg-brand-indigo-600 text-white" : "bg-secondary text-muted-foreground")}>
                  {state === "done" ? <Check className="size-4" /> : state === "active" ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="font-mono text-[10px] text-muted-foreground">STEP {i + 1}</span> {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                  {i === 2 && (
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      CP {request.controlPlanes} + Worker {request.workers} · {request.flavor}{request.accelKind !== "없음" ? ` · ${request.accelKind} × ${request.accelCount}/Worker` : ""}
                    </div>
                  )}
                  {i === 3 && <div className="mt-1 font-mono text-[11px] text-muted-foreground">network {request.network} · 보안 그룹 default · FIP 1개(API 서버)</div>}
                  {i === 4 && state === "done" && <div className="mt-1 font-mono text-[11px] text-muted-foreground">kubeconfig 발급 · CNI Calico · 노드 {request.controlPlanes + request.workers}대 Ready</div>}
                </div>
              </li>
            );
          })}
        </ol>
        </ChangeMark>
        <DialogFooter>
          {done ? (
            <Button onClick={() => onDone(request)}><Check className="size-3.5" /> 완료 · 신청자에게 통보</Button>
          ) : (
            <Button variant="outline" onClick={onClose}>백그라운드로</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────────────────────

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
          <div className="flex items-center gap-3">
            <button type="button" className="hover:text-primary" onClick={() => toast.success(`${c.name} kubeconfig 다운로드`)}>kubeconfig</button>
            <Link href={`/iaas/projects`} className="hover:text-primary">테넌트 보기 →</Link>
          </div>
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
