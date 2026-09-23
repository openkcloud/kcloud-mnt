"use client";
import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Boxes,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  FolderKanban,
  Network,
  Cpu,
  Wifi,
  Globe,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import Link from "next/link";
import { ResourceRequestWizard } from "@/components/resource-request-wizard";
import { cn } from "@/lib/utils";
import { nodes, vms, accelerators } from "@/mocks/fixtures";
import { useProvisioning, type ProvStep } from "@/lib/provisioning";
import type { ResourceRequest, RequestStatus } from "@/lib/types";

// 신청 → 프로비저닝 단계 목록 (조건부 단계 포함)
function buildProvSteps(r: ResourceRequest): ProvStep[] {
  const steps: ProvStep[] = [
    { key: "create", label: "가상머신 생성", detail: "nova boot · 키페어 주입" },
    { key: "network", label: "네트워크 연결", detail: r.floatingIp ? "인터넷망 · 공인 IP 연결" : "내부망 고정 IP 할당" },
  ];
  if ((r.storageGb ?? 0) > 0) steps.push({ key: "storage", label: "스토리지 연결", detail: `데이터 볼륨 ${fmtStorageGb(r.storageGb)} attach` });
  if (r.acceleratorKind) steps.push({ key: "accel", label: "가속기 바인딩", detail: `${r.acceleratorKind} 패스스루` });
  steps.push({ key: "boot", label: "부팅 완료", detail: "OS 부팅 · 상태 Running" });
  return steps;
}

type RequestsResp = { items: ResourceRequest[]; total: number };

// ── 상태 표시 ──
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "대기중",
  provisioning: "프로비저닝중",
  completed: "완료",
  rejected: "반려됨",
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const variant =
    status === "completed" ? "success" :
    status === "rejected" ? "destructive" :
    status === "provisioning" ? "default" :
    "outline";
  return (
    <Badge variant={variant} className="gap-1 whitespace-nowrap">
      {status === "provisioning" && <Loader2 className="size-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}

// 상태 컬럼 헤더 — 물음표 호버 시 상태 프로세스 안내
function StatusHelpHead() {
  return (
    <span className="inline-flex items-center gap-1">
      상태
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="상태 안내" className="cursor-help text-muted-foreground/50 hover:text-muted-foreground">
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[270px] px-3 py-2.5">
          <div className="space-y-2">
            <div className="font-semibold">신청 처리 상태 흐름</div>
            <div className="flex flex-wrap items-center gap-x-1 text-background/60">
              대기중 <span>→</span> 프로비저닝중 <span>→</span> 완료
            </div>
            <ul className="space-y-1 text-background/80">
              <li><span className="font-medium text-background">대기중</span> · 신청 접수, 관리자 승인 대기</li>
              <li><span className="font-medium text-background">프로비저닝중</span> · 승인됨, 가상머신 생성·연결 진행</li>
              <li><span className="font-medium text-background">완료</span> · 생성 완료, 사용 가능</li>
              <li><span className="font-medium text-background">반려됨</span> · 승인 거부 (사유 표시)</li>
            </ul>
            <div className="text-amber-300">승인하면 즉시 프로비저닝이 시작됩니다.</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function TypeBadge({ type }: { type: "vm" | "cluster" }) {
  return type === "vm" ? (
    <Badge variant="ghost" className="gap-1 font-mono">
      <Server className="size-3" /> VM
    </Badge>
  ) : (
    <Badge variant="ghost" className="gap-1 font-mono">
      <Boxes className="size-3" /> K8s
    </Badge>
  );
}

function specSummary(r: ResourceRequest) {
  if (r.type === "vm") {
    return `${r.flavorName ?? "—"} · ${r.acceleratorKind ?? "—"}×${r.acceleratorCount ?? 0}`;
  }
  return `Worker×${r.nodeCount ?? 0} · ${r.acceleratorKind ?? "—"}×${r.acceleratorCount ?? 0}`;
}

function fmtDt(iso: string) {
  return iso.replace("T", " ").slice(0, 16);
}

function fmtStorageGb(gb?: number) {
  if (!gb || gb <= 0) return "없음";
  return gb >= 1024 ? `${(gb / 1024).toLocaleString()} TB` : `${gb} GB`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="text-right text-sm">{children}</div>
    </div>
  );
}

function accKindClass(kind?: string) {
  return kind === "GPU" ? "bg-green-100 text-green-800"
    : kind === "NPU" ? "bg-purple-100 text-purple-800"
    : kind === "PIM" ? "bg-amber-100 text-amber-800"
    : "bg-slate-100 text-slate-700";
}

function RequestDetailBody({ r }: { r: ResourceRequest }) {
  const isVm = r.type === "vm";
  const isInternet = !!r.networkName?.endsWith("-public");
  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-gradient-to-br from-brand-indigo-50/70 to-transparent p-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-100 text-brand-indigo-700">
          {isVm ? <Server className="size-5" /> : <Boxes className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{isVm ? (r.vmName || "가상머신") : "K8s 클러스터"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <FolderKanban className="size-3" />
            <span className="font-mono">{r.projectName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{r.requestedByName}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono">{fmtDt(r.requestedAt)}</span>
          </div>
        </div>
      </div>

      {isVm ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* 네트워크 · 접속 */}
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Network className="size-3.5 text-sky-600" /> 네트워크 · 접속
            </div>
            <Field label="네트워크">
              <Badge variant="ghost" className={cn("gap-1", isInternet ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
                {isInternet ? <Globe className="size-3" /> : <Wifi className="size-3" />}
                {isInternet ? "인터넷망" : "내부망"}
              </Badge>
            </Field>
            <Field label="공인 IP">
              {r.floatingIp
                ? <Badge variant="success">발급 요청</Badge>
                : <span className="text-muted-foreground">미신청</span>}
            </Field>
            <Field label="키페어">
              <span className="font-mono">{r.keypairName ?? <span className="text-muted-foreground">미선택</span>}</span>
            </Field>
          </div>

          {/* 스펙 */}
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="size-3.5 text-rose-600" /> 스펙
            </div>
            <Field label="스펙"><span className="font-mono">{r.flavorName ?? "—"}</span></Field>
            <Field label="vCPU"><span className="font-mono">{r.vcpu ?? "—"} vCPU</span></Field>
            <Field label="메모리"><span className="font-mono">{r.ramGb ?? "—"} GB</span></Field>
            <Field label="시스템 디스크"><span className="font-mono">{r.diskGb ? `${r.diskGb} GB` : "—"}</span></Field>
            <Field label="추가 스토리지"><span className="font-mono">{fmtStorageGb(r.storageGb)}</span></Field>
            <Field label="가속기">
              {r.acceleratorKind
                ? <Badge variant="ghost" className={cn("gap-1 font-mono", accKindClass(r.acceleratorKind))}><Cpu className="size-3" />{r.acceleratorKind} × {r.acceleratorCount ?? 1}</Badge>
                : <span className="text-muted-foreground">없음</span>}
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Boxes className="size-3.5 text-brand-indigo-600" /> 클러스터 구성
          </div>
          <Field label="클러스터 이름"><span className="font-mono">{r.clusterName ?? "—"}</span></Field>
          <Field label="Kubernetes 버전"><span className="font-mono">{r.k8sVersion ? `v${r.k8sVersion}` : "—"}</span></Field>
          <Field label="마스터 노드">{r.masterCount ?? 0} 대</Field>
          <Field label="워커 노드">{r.nodeCount ?? 0} 대</Field>
          <Field label="노드 Flavor"><span className="font-mono">{r.flavorName ?? "—"}</span></Field>
          <Field label="가속기">{r.acceleratorKind ? `${r.acceleratorKind} × ${r.acceleratorCount ?? 1}` : "없음"}</Field>
        </div>
      )}

      {/* 처리 결과 */}
      {(r.reviewedByName || r.rejectReason) && (
        <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Clock className="size-3.5 text-muted-foreground" /> 처리 결과
          </div>
          {r.reviewedByName && <Field label="처리자">{r.reviewedByName} · <span className="font-mono">{fmtDt(r.reviewedAt ?? "")}</span></Field>}
          {r.rejectReason && <Field label="반려 사유"><span className="text-rose-600">{r.rejectReason}</span></Field>}
        </div>
      )}
    </div>
  );
}

// flavor명 → 특정 가속기 모델 키워드 (패스스루 노드 매칭용)
function accelKeyword(flavorName?: string) {
  const f = (flavorName ?? "").toLowerCase();
  if (f.includes("a100")) return "A100";
  if (f.includes("l40s")) return "L40S";
  if (f.includes("rngd")) return "RNGD";
  if (f.includes("atom")) return "ATOM";
  return null;
}

function CapacityBar({ label, used, add, cap, unit }: { label: string; used: number; add: number; cap: number; unit: string }) {
  const after = used + add;
  const usedPct = Math.min(100, (used / cap) * 100);
  const afterPct = Math.min(100, (after / cap) * 100);
  const over = after > cap;
  const tight = !over && afterPct > 85;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {used.toLocaleString()} <span className="text-muted-foreground">→</span>{" "}
          <span className={cn("font-medium", over ? "text-rose-600" : tight ? "text-amber-600" : "text-emerald-700")}>{after.toLocaleString()}</span>
          {" "}/ {cap.toLocaleString()} {unit}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 bg-brand-indigo-400" style={{ width: `${usedPct}%` }} />
        <div className={cn("absolute inset-y-0", over ? "bg-rose-400" : tight ? "bg-amber-400" : "bg-emerald-400")} style={{ left: `${usedPct}%`, width: `${Math.max(0, afterPct - usedPct)}%` }} />
      </div>
    </div>
  );
}

// 배치·가용량 what-if (관리자 승인 판단용) — 할당(allocation) 기준
function PlacementCapacity({ r }: { r: ResourceRequest }) {
  const OVC = 4; // vCPU 오버커밋 비율
  const needAccel = !!r.acceleratorKind;
  const needCount = r.acceleratorCount ?? 1;
  const kw = accelKeyword(r.flavorName);

  const usageOf = (nodeId: string) =>
    vms.filter((v) => v.nodeId === nodeId).reduce(
      (a, v) => ({ vcpu: a.vcpu + (v.vcpu ?? 0), ram: a.ram + (v.ramGb ?? 0) }),
      { vcpu: 0, ram: 0 },
    );
  const freeAccelsOn = (nodeId: string) =>
    accelerators.filter((a) => a.nodeId === nodeId && a.status === "Idle" && (kw ? a.model.includes(kw) : a.kind === r.acceleratorKind));

  const candidates = needAccel
    ? nodes.filter((n) => freeAccelsOn(n.id).length >= needCount)
    : nodes.filter((n) => n.acceleratorIds.length === 0);
  const fits = (n: (typeof nodes)[number]) => {
    const u = usageOf(n.id);
    return u.vcpu + (r.vcpu ?? 0) <= n.vcpu * OVC && u.ram + (r.ramGb ?? 0) <= n.ramGb;
  };
  const target = candidates.find(fits) ?? candidates[0];

  return (
    <div className="space-y-2.5 rounded-xl border border-border p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Server className="size-3.5 text-brand-indigo-600" /> 배치 · 가용량 미리보기
      </div>
      {!target ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {needAccel
            ? `요청한 가속기(${r.acceleratorKind}${kw ? ` ${kw}` : ""}) 여유가 있는 노드가 없습니다. 가속기 소진 — 반려하거나 회수 후 재시도가 필요합니다.`
            : "배치 가능한 일반 노드가 없습니다."}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">예상 배치 노드</span>
            <span className="font-mono">{target.hostname}</span>
          </div>
          <CapacityBar label={`vCPU (오버커밋 ${OVC}:1)`} used={usageOf(target.id).vcpu} add={r.vcpu ?? 0} cap={target.vcpu * OVC} unit="vCPU" />
          <CapacityBar label="메모리" used={usageOf(target.id).ram} add={r.ramGb ?? 0} cap={target.ramGb} unit="GB" />
          {needAccel && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">가속기 ({r.acceleratorKind}{kw ? ` ${kw}` : ""}, 패스스루)</span>
              <span className="font-mono">
                여유 {freeAccelsOn(target.id).length} <span className="text-muted-foreground">→</span>{" "}
                <span className={cn("font-medium", freeAccelsOn(target.id).length - needCount <= 0 ? "text-amber-600" : "text-emerald-700")}>
                  {freeAccelsOn(target.id).length - needCount}
                </span>
                {" "}({needCount}개 할당)
              </span>
            </div>
          )}
          {(r.storageGb ?? 0) > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">추가 스토리지</span>
              <span className="font-mono">{fmtStorageGb(r.storageGb)} · Cinder 풀 할당</span>
            </div>
          )}
          {candidates.length > 1 && (
            <p className="text-[10px] text-muted-foreground">후보 노드 {candidates.length}곳 · 스케줄러 자동 배치 (오버라이드 가능)</p>
          )}
        </>
      )}
    </div>
  );
}

// 프로비저닝 진행 사이드 시트 — 목록에서 열고닫아도 진행 유지
function ProvisioningSheet({ req, open, onClose }: { req: ResourceRequest | null; open: boolean; onClose: () => void }) {
  const entry = useProvisioning((s) => (req ? s.map[req.id] : undefined));
  const steps = entry?.steps ?? (req ? buildProvSteps(req) : []);
  // 스토어 진행값이 없으면(시드 데이터) 요청 상태로 대체
  const done = entry?.status === "completed" || (!entry && req?.status === "completed");
  const current = entry ? entry.current : done ? steps.length : 0;
  const doneCount = done ? steps.length : current;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-brand-indigo-600" /> 프로비저닝 진행
            {done ? (
              <Badge variant="success" className="ml-auto">완료</Badge>
            ) : (
              <Badge variant="default" className="ml-auto gap-1"><Loader2 className="size-3 animate-spin" />진행중</Badge>
            )}
          </SheetTitle>
          <SheetDescription className="font-mono">
            {req && <>{req.vmName ?? req.id} · {req.projectName}</>}
          </SheetDescription>
          {/* 진행률 바 */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{doneCount} / {steps.length} 단계</span>
              <span className="font-mono tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all duration-500", done ? "bg-brand-mint-500" : "bg-brand-indigo-500")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </SheetHeader>

        {/* 단계 타임라인 */}
        <div className="p-5">
          {steps.map((s, i) => {
            const state = done || i < current ? "done" : i === current ? "active" : "pending";
            const last = i === steps.length - 1;
            return (
              <div key={s.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                    state === "done" ? "bg-brand-mint-100 text-brand-mint-700"
                      : state === "active" ? "bg-brand-indigo-100 text-brand-indigo-700"
                      : "bg-secondary text-muted-foreground/60",
                  )}>
                    {state === "done" ? <CheckCircle2 className="size-4" />
                      : state === "active" ? <Loader2 className="size-4 animate-spin" />
                      : <span className="size-1.5 rounded-full bg-current" />}
                  </div>
                  {!last && <div className={cn("my-1 w-0.5 grow rounded-full", state === "done" ? "bg-brand-mint-300" : "bg-border")} />}
                </div>
                <div className={cn("flex-1", last ? "pb-0" : "pb-5")}>
                  <div className={cn(
                    "text-sm",
                    state === "active" ? "font-semibold text-foreground"
                      : state === "pending" ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}>
                    {s.label}
                  </div>
                  {s.detail && <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>}
                </div>
              </div>
            );
          })}

          {done && (
            <div className="mt-1 rounded-xl border border-brand-mint-200 bg-brand-mint-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-mint-800">
                <CheckCircle2 className="size-4" /> 프로비저닝 완료
              </div>
              <p className="mt-1 text-xs text-muted-foreground">가상머신이 생성되어 사용할 수 있습니다.</p>
              <Link href="/iaas/instances" onClick={onClose} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                <Server className="size-3.5" /> 생성된 가상머신 보기
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────── 관리자 뷰 ───────────
function AdminView() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [q, setQ] = React.useState("");

  const filters: Record<string, string> = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (typeFilter !== "all") filters.type = typeFilter;

  const { data, isLoading } = api.ticket.requests(filters) as {
    data: RequestsResp | undefined;
    isLoading: boolean;
  };

  // 낙관적 업데이트를 위한 로컬 오버라이드
  const [localOverrides, setLocalOverrides] = React.useState<Record<string, RequestStatus>>({});

  const reviewMutation = api.ticket.reviewRequest();

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    id: string;
    action: "approve" | "reject";
    name: string;
    req: ResourceRequest;
  } | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [detail, setDetail] = React.useState<ResourceRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [sheetReq, setSheetReq] = React.useState<ResourceRequest | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const startProv = useProvisioning((s) => s.start);
  const provMap = useProvisioning((s) => s.map);

  function openDetail(r: ResourceRequest) {
    setDetail(r);
    setDetailOpen(true);
  }
  function openSheet(r: ResourceRequest) {
    setSheetReq(r);
    setSheetOpen(true);
  }
  function closeConfirm() {
    // 닫힘 애니메이션 동안 데이터 유지 (라벨 깜빡임 방지)
    setConfirmDialog((c) => (c ? { ...c, open: false } : null));
  }

  const items = (data?.items ?? []).filter(
    (r) => !q || r.requestedByName.includes(q) || r.projectName.includes(q) || r.id.includes(q),
  ).map((r) => {
    // 프로비저닝 진행 상태가 있으면 그걸 우선 반영, 없으면 승인/반려 오버라이드
    const st = provMap[r.id]?.status ?? localOverrides[r.id];
    return st ? { ...r, status: st as RequestStatus } : r;
  });

  const pending = items.filter((r) => r.status === "pending").length;
  const completed = items.filter((r) => r.status === "provisioning" || r.status === "completed").length;
  const rejected = items.filter((r) => r.status === "rejected").length;

  function openConfirm(r: ResourceRequest, action: "approve" | "reject") {
    setRejectReason("");
    setConfirmDialog({ open: true, id: r.id, action, name: r.vmName ?? `클러스터 신청`, req: r });
  }

  async function handleConfirm() {
    if (!confirmDialog) return;
    const { id, action, req } = confirmDialog;
    closeConfirm();
    if (action === "approve") {
      // 승인 = 프로비저닝 개시 → 진행 시뮬레이션 + 사이드 시트 오픈
      startProv(id, buildProvSteps(req));
      openSheet(req);
    } else {
      setLocalOverrides((prev) => ({ ...prev, [id]: "rejected" }));
    }
    try {
      await reviewMutation.mutateAsync({ id, action, reason: rejectReason || undefined });
      toast.success(action === "approve" ? "승인 — 프로비저닝을 시작합니다" : "반려 처리됨", {
        description: `신청 ID: ${id}`,
      });
    } catch {
      if (action !== "approve") setLocalOverrides((prev) => { const n = { ...prev }; delete n[id]; return n; });
      toast.error("처리 실패");
    }
  }

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <StatBlock label="대기중" value={pending} color="warning" />
        <StatBlock label="진행·완료" value={completed} color="mint" />
        <StatBlock label="반려됨" value={rejected} color="rose" />
      </div>

      {/* 필터 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="신청자·프로젝트·ID 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-60 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="provisioning">프로비저닝중</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="rejected">반려됨</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 유형</SelectItem>
              <SelectItem value="vm">VM</SelectItem>
              <SelectItem value="cluster">K8s 클러스터</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{items.length}건</span>
        </div>
      </Card>

      {/* 테이블 */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>신청 ID</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>신청자</TableHead>
                <TableHead>프로젝트</TableHead>
                <TableHead>스펙</TableHead>
                <TableHead>신청 일시</TableHead>
                <TableHead><StatusHelpHead /></TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const actionable = r.status === "pending";
                const inProvision = r.status === "provisioning" || r.status === "completed";
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell><TypeBadge type={r.type} /></TableCell>
                    <TableCell className="text-sm">{r.requestedByName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.projectName}</TableCell>
                    <TableCell className="font-mono text-xs">{specSummary(r)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{fmtDt(r.requestedAt)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actionable ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-brand-mint-300 text-brand-mint-700 hover:bg-brand-mint-50"
                            onClick={() => openConfirm(r, "approve")}
                          >
                            <CheckCircle2 className="size-3.5" /> 승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => openConfirm(r, "reject")}
                          >
                            <XCircle className="size-3.5" /> 반려
                          </Button>
                        </div>
                      ) : inProvision ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openSheet(r)}>
                          {r.status === "provisioning" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                          진행 보기
                        </Button>
                      ) : r.status === "rejected" && r.rejectReason ? (
                        <span className="text-xs text-muted-foreground">{r.rejectReason}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    조건에 맞는 신청이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 승인·반려 확인 다이얼로그 */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={(o) => !o && closeConfirm()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "approve" ? "자원 신청 승인" : "자원 신청 반려"}
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono font-semibold">{confirmDialog?.name}</span> 신청을{" "}
              {confirmDialog?.action === "approve" ? "승인" : "반려"}합니다.
              {confirmDialog?.action === "approve" && (
                <span className="mt-1.5 block text-amber-700">
                  승인하면 <span className="font-semibold">즉시 프로비저닝이 실행</span>됩니다. (가상머신 생성·네트워크·스토리지·가속기 바인딩)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog?.action === "reject" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">반려 사유 <span className="text-muted-foreground">(선택)</span></label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="예: 프로젝트 쿼터 초과, 가속기 미할당 등"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>취소</Button>
            <Button
              variant={confirmDialog?.action === "approve" ? "default" : "destructive"}
              onClick={handleConfirm}
            >
              {confirmDialog?.action === "approve" ? "승인 · 프로비저닝 시작" : "반려 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 프로비저닝 진행 사이드 시트 */}
      <ProvisioningSheet req={sheetReq} open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* 신청 상세 — 사용자가 신청한 전체 내용 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              신청 상세 {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>
              {detail?.status === "pending" ? "신청 내용을 확인하고 승인 또는 반려하세요." : "신청 내용입니다."}
            </DialogDescription>
          </DialogHeader>
          {detail && <RequestDetailBody r={detail} />}
          {detail?.type === "vm" && detail.status === "pending" && (
            <PlacementCapacity r={detail} />
          )}
          {detail?.status === "pending" && (
            <DialogFooter>
              <Button
                variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => { if (detail) { setDetailOpen(false); openConfirm(detail, "reject"); } }}
              >
                <XCircle className="size-3.5" /> 반려
              </Button>
              <Button
                onClick={() => { if (detail) { setDetailOpen(false); openConfirm(detail, "approve"); } }}
              >
                <CheckCircle2 className="size-3.5" /> 승인
              </Button>
            </DialogFooter>
          )}
          {(detail?.status === "provisioning" || detail?.status === "completed") && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { if (detail) { setDetailOpen(false); openSheet(detail); } }}>
                <Server className="size-3.5" /> 진행 상황 보기
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────── 사용자 뷰 ───────────
function UserView({ userId }: { userId: string }) {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [detail, setDetail] = React.useState<ResourceRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const filters: Record<string, string> = { requestedBy: userId };
  if (statusFilter !== "all") filters.status = statusFilter;

  const { data, isLoading } = api.ticket.requests(filters) as {
    data: RequestsResp | undefined;
    isLoading: boolean;
  };

  const items = data?.items ?? [];
  const pending = items.filter((r) => r.status === "pending").length;
  const inProgress = items.filter((r) => r.status === "provisioning").length;
  const done = items.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* 안내 배너 */}
      <Card className="flex items-start gap-3 border-brand-indigo-200 bg-brand-indigo-50/40 p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-brand-indigo-600" />
        <p className="text-sm text-brand-indigo-800">
          자원 신청 후 관리자 승인 시 프로비저닝이 시작됩니다.
          키페어는 신청 전에 미리 <a href="/iaas/keypairs" className="underline">키페어 관리</a>에서 생성해두세요.
        </p>
      </Card>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <StatBlock label="대기중" value={pending} color="warning" />
        <StatBlock label="프로비저닝중" value={inProgress} color="indigo" />
        <StatBlock label="완료" value={done} color="mint" />
      </div>

      {/* 필터 + 신청 버튼 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="provisioning">프로비저닝중</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="rejected">반려됨</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{items.length}건</span>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" /> 자원 신청
            </Button>
          </div>
        </div>
      </Card>

      {/* 내 신청 목록 */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>신청 ID</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>프로젝트</TableHead>
                <TableHead>스펙</TableHead>
                <TableHead>신청 일시</TableHead>
                <TableHead><StatusHelpHead /></TableHead>
                <TableHead>관리자 피드백</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => { setDetail(r); setDetailOpen(true); }}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                  <TableCell><TypeBadge type={r.type} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.projectName}</TableCell>
                  <TableCell className="font-mono text-xs">{specSummary(r)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmtDt(r.requestedAt)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.status === "rejected" && r.rejectReason ? (
                      <span className="text-rose-600">{r.rejectReason}</span>
                    ) : r.reviewedByName ? (
                      `${r.reviewedByName} · ${fmtDt(r.reviewedAt ?? "")}`
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    신청 내역이 없습니다. 위의 "자원 신청" 버튼으로 신청하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 내 신청 상세 (읽기 전용) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              신청 상세 {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>내가 신청한 내용입니다.</DialogDescription>
          </DialogHeader>
          {detail && <RequestDetailBody r={detail} />}
        </DialogContent>
      </Dialog>

      <ResourceRequestWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

// ─────────── 공통 StatBlock ───────────
function StatBlock({
  label, value, color,
}: {
  label: string; value: number; color: "warning" | "mint" | "rose" | "indigo";
}) {
  const map = {
    warning: "bg-amber-50 text-amber-700",
    mint: "bg-brand-mint-50 text-brand-mint-700",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-brand-indigo-50 text-brand-indigo-700",
  };
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-2xl font-bold tabular-nums ${map[color]}`}>
        {value}
      </div>
    </Card>
  );
}

// ─────────── 페이지 진입점 ───────────
export default function RequestsPage() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-4">
      <PageHeader
        title={isAdmin ? "신청 관리" : "자원 요청 관리"}
        description={
          isAdmin
            ? "사용자 VM·K8s 클러스터 자원 신청을 검토하고 승인·반려합니다."
            : "VM 또는 K8s 클러스터 자원을 신청하고 처리 현황을 확인합니다."
        }
      />
      {isAdmin ? <AdminView /> : <UserView userId={user?.id ?? ""} />}
    </div>
  );
}
