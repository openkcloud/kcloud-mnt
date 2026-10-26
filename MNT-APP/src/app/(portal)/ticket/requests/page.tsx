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
  Disc3,
  KeyRound,
  ShieldCheck,
  RotateCcw,
  Building2,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Check,
  Circle,
  BrainCircuit,
  Copy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  useCancelProvisionQueue, useOrgs, useProvisionAiWorkspaceTicket, useProvisionClusterTicket, useProvisionTicket,
  useReviewTicket, useTickets, useTicketSteps, type ProvisionClusterInput,
} from "@/lib/ticket-api";
import { useIpCheck, usePlacementPreview, useProjectNetworks, useProjectSecurityGroups } from "@/lib/iaas-api";
import type { PlacementPreview } from "@/lib/iaas-api";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useRouter } from "next/navigation";
import { ResourceRequestWizard } from "@/components/resource-request-wizard";
import {
  WorkspaceLimitFields, limitsBody, limitsOf, limitsOk, limitsText, toLimitsInput, type WorkspaceLimitsInput,
} from "@/components/workspace-requests";
import { ClusterReviewContent, isClusterReview, type ClusterProvisionValue } from "@/components/cluster-ticket-review";
import { AccelBadge, useAccelModel } from "@/components/cluster-node-fields";
import { accKindClass, cn, formatDateTime } from "@/lib/utils";
import type {
  ClusterProvisionSpec, ProvisionSpec, ProvisionStep, ProvisionStepsResp, ProvStepStatus, ResourceRequest, RequestStatus,
  RequestType,
} from "@/lib/types";

// ── 상태 표시 ──
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "대기중",
  approved: "승인",
  provisioning: "생성중",
  completed: "완료",
  failed: "실패",
  rejected: "반려됨",
};

// 진행 보기 가능한 상태 — 프로비저닝(Temporal)·진행 팝업 연결 전이라 approved 는 제외 (연결 시 추가)
const IN_PROVISION: RequestStatus[] = ["provisioning", "completed", "failed"];

function StatusBadge({ status }: { status: RequestStatus }) {
  const variant =
    status === "completed" ? "success" :
    status === "rejected" || status === "failed" ? "destructive" :
    status === "provisioning" || status === "approved" ? "default" :
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
              대기중 <span>→</span> 승인 <span>→</span> 생성중 <span>→</span> 완료/실패
            </div>
            <ul className="space-y-1 text-background/80">
              <li><span className="font-medium text-background">대기중</span> · 신청 접수, 관리자 승인 대기</li>
              <li><span className="font-medium text-background">승인</span> · 승인됨, 관리자 프로비저닝 대기</li>
              <li><span className="font-medium text-background">생성중</span> · 자원 생성·연결 진행</li>
              <li><span className="font-medium text-background">완료</span> · 생성 완료, 사용 가능</li>
              <li><span className="font-medium text-background">실패</span> · 프로비저닝 실패 (재시도 가능)</li>
              <li><span className="font-medium text-background">반려됨</span> · 승인 또는 프로비저닝 단계에서 거부 (사유 표시)</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

// 승인 설정 → 프로비저닝 API 요청 형식(네트워크 이름·종류 등은 서버가 라이브 조회로 다시 채운다)
// 클러스터 프로비저닝 설정(provision_spec) → 프로비저닝(재시도) 요청 본문
function clusterSpecOf(r: ResourceRequest) {
  return r.provisionSpec as unknown as ClusterProvisionSpec | undefined; // 클러스터 신청은 provision_spec 형태가 다르다
}
function toClusterProvisionBody(p: ClusterProvisionSpec): ProvisionClusterInput["provisionSpec"] {
  return {
    networkId: p.networkId, subnetId: p.subnetId, masterCount: p.masterCount, masterFlavorId: p.masterFlavorId,
    nodeCount: p.nodeCount, flavorId: p.flavorId,
    // 지난 회차에 넣은 키페어 — 기록이 있을 때만(없으면 서버가 신청 값을 쓴다)
    ...("keypairName" in p ? { novaKeypair: p.keypairName ?? null } : {}),
  };
}

function toProvisionBody(spec: ProvisionSpec) {
  return {
    networkId: spec.networkId, floatingNetworkId: spec.floatingNetworkId, fixedIp: spec.fixedIp, securityGroups: spec.securityGroups,
    host: spec.host,
  };
}

// 신청 ID · 자원 이름 — 누르면 복사(행 클릭의 상세 열기 대신)
function CopyCell({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <TableCell
      title={`클릭해서 ${label} 복사`}
      className={cn("group cursor-pointer font-mono text-xs hover:text-primary", className)}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        toast.success(`${label} 복사됨`, { description: value });
      }}
    >
      {/* 칸 전체가 복사 영역 — 마우스를 올리면 값·아이콘에 배경(테마 색 border: 라이트 #e2e8f0) */}
      <span className="-mx-1.5 rounded-md px-1.5 py-1 transition-colors group-hover:bg-border">
        {value}
        <Copy className="ml-1 inline-block size-3 align-[-2px] text-muted-foreground group-hover:text-primary" />
      </span>
    </TableCell>
  );
}

function TypeBadge({ type }: { type: RequestType }) {
  return type === "vm" ? (
    <Badge variant="ghost" className="gap-1 font-mono">
      <Server className="size-3" /> VM
    </Badge>
  ) : type === "cluster" ? (
    <Badge variant="ghost" className="gap-1 font-mono">
      <Boxes className="size-3" /> K8s
    </Badge>
  ) : (
    <Badge variant="ghost" className="gap-1 whitespace-nowrap">
      <BrainCircuit className="size-3" /> AI 워크스페이스
    </Badge>
  );
}

// 목록 '자원 이름' 칸 — VM 이름 · 클러스터 이름 · 워크스페이스 이름
function nameOf(r: ResourceRequest) {
  return (r.type === "vm" ? r.vmName : r.type === "cluster" ? r.clusterName : r.workspaceName) || "—";
}

// 목록 '프로젝트 · 신청자' 칸 — 두 줄: 프로젝트 / 신청자 (신청자 본인 조직)
function ProjectRequesterCell({ r }: { r: ResourceRequest }) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-xs">{r.projectName}</div>
      <div className="text-[11px] text-muted-foreground">{r.requestedByName}{r.requesterOrgName ? ` (${r.requesterOrgName})` : ""}</div>
    </div>
  );
}

// 목록 스펙 칸 — VM: 플레이버 + 가속기 배지 / 클러스터: 노드 수 + Worker 플레이버 + 가속기 배지 / AI 워크스페이스: 한도
function SpecCell({ r }: { r: ResourceRequest }) {
  const modelOf = useAccelModel();
  if (r.type === "ai-workspace") return <>{limitsText(limitsOf(r))}</>;
  const accels = r.accelerators?.length ? r.accelerators
    : r.acceleratorKind ? [{ kind: r.acceleratorKind, count: r.acceleratorCount ?? 1 }] // 목업 티켓
    : [];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {r.type === "cluster" && <span className="text-muted-foreground">CP×{r.masterCount ?? 0} / Worker×{r.nodeCount ?? 0}</span>}
      {r.flavorName ?? "—"}
      {accels.map((a) => <AccelBadge key={a.kind} kind={a.kind} model={modelOf(r.deviceProfile)} count={a.count} />)}
      {/* 가속기는 있으나 종류를 모를 때(종류 저장 전 티켓) */}
      {!accels.length && r.deviceProfile && <AccelBadge />}
    </span>
  );
}

function fmtDt(iso: string) {
  return formatDateTime(iso); // 한국 시각 — 문자열을 잘라 쓰면 서버 시간대(UTC) 그대로 보인다
}

// 반려 사유 — 승인 단계 또는 프로비저닝 단계
function rejectReasonOf(r: ResourceRequest) {
  return r.approvedRejectReason ?? r.provisioningRejectReason;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="text-right text-sm">{children}</div>
    </div>
  );
}

// 망 종류 배지 — 외부(external) 망만 인터넷망
function NetKindBadge({ internet }: { internet: boolean }) {
  return (
    <Badge variant="ghost" className={cn("gap-1", internet ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
      {internet ? <Globe className="size-3" /> : <Wifi className="size-3" />}
      {internet ? "인터넷망" : "내부망"}
    </Badge>
  );
}

// 사용자 희망 망 배지
function NetworkWish({ r }: { r: ResourceRequest }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <NetKindBadge internet={r.networkType === "external"} />
      {r.floatingIp && <Badge variant="success">공인 IP 희망</Badge>}
    </span>
  );
}

// 가속기 배지 묶음 — VM·클러스터 Worker 스펙 공용
function AccelBadges({ r }: { r: ResourceRequest }) {
  const modelOf = useAccelModel();
  return r.accelerators?.length
    ? (
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        {r.accelerators.map((a) => <AccelBadge key={a.kind} kind={a.kind} model={modelOf(r.deviceProfile)} count={a.count} />)}
      </span>
    )
    : r.deviceProfile
    ? <AccelBadge />
    : <span className="text-muted-foreground">없음</span>;
}

function RequestDetailBody({ r }: { r: ResourceRequest }) {
  const router = useRouter();
  const isVm = r.type === "vm";
  const isWs = r.type === "ai-workspace";
  const p = r.provisionSpec;
  const cp = r.type === "cluster" ? clusterSpecOf(r) : undefined;
  // 생성 완료된 VM — 누르면 IaaS > 가상서버 상세로(가상서버 상세의 네트워크·볼륨 행과 같은 방식)
  const serverId = isVm && r.status === "completed" ? r.result?.serverId : undefined;
  return (
    <div className="space-y-3">
      {/* Hero */}
      <div
        onClick={serverId ? () => router.push(`/iaas/instances/detail/?id=${serverId}`) : undefined}
        title={serverId ? "가상서버 상세 열기" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-gradient-to-br from-brand-indigo-50/70 to-transparent p-3.5",
          serverId && "group cursor-pointer transition-colors hover:bg-secondary/60",
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-indigo-100 text-brand-indigo-700">
          {isVm ? <Server className="size-5" /> : isWs ? <BrainCircuit className="size-5" /> : <Boxes className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-base font-semibold", serverId && "underline-offset-2 group-hover:underline")}>
            {isVm ? (r.vmName || "가상머신") : isWs ? (r.workspaceName || "AI 워크스페이스") : (r.clusterName || "서비스 클러스터")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {r.orgName && <><Building2 className="size-3" /><span>{r.orgName}</span><span className="text-muted-foreground/40">·</span></>}
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
          {/* 스펙 */}
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="size-3.5 text-rose-600" /> 스펙
            </div>
            <Field label="스펙"><span className="font-mono">{r.flavorName ?? "—"}</span></Field>
            <Field label="vCPU · 메모리"><span className="font-mono">{r.vcpu ?? "—"} vCPU / {r.ramGb ?? "—"} GB</span></Field>
            <Field label="디스크">
              <span className="font-mono">{r.diskGb ? `${r.diskGb} GB` : r.volumeGb ? `부팅 볼륨 ${r.volumeGb} GB` : "—"}</span>
            </Field>
            <Field label="가속기">
              {r.accelerators?.length || r.deviceProfile
                ? <AccelBadges r={r} />
                : r.acceleratorKind
                ? <AccelBadge kind={r.acceleratorKind} count={r.acceleratorCount ?? 1} />
                : <span className="text-muted-foreground">없음</span>}
            </Field>
          </div>

          {/* 템플릿 · 접속 */}
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Disc3 className="size-3.5 text-indigo-600" /> 템플릿 · 접속
            </div>
            <Field label="템플릿"><span className="font-mono">{r.imageName ?? "—"}</span></Field>
            <Field label="cloud-init">
              {r.cloudInit === false
                ? <Badge variant="warning">없음 · 키페어 미적용</Badge>
                : <span className="text-muted-foreground">포함</span>}
            </Field>
            <Field label="키페어">
              <span className="inline-flex items-center gap-1 font-mono">
                {r.keypairName ? <><KeyRound className="size-3 text-amber-600" />{r.keypairName}</> : <span className="text-muted-foreground">미선택</span>}
              </span>
            </Field>
            <Field label="희망 네트워크"><NetworkWish r={r} /></Field>
          </div>
        </div>
      ) : isWs ? (
        <div className="space-y-2.5 rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <BrainCircuit className="size-3.5 text-brand-indigo-600" /> AI 워크스페이스
          </div>
          <Field label="워크스페이스 (네임스페이스)"><span className="font-mono">{r.result?.namespace ?? r.workspaceName ?? "—"}</span></Field>
          <Field label="사용 목적">{r.purpose || <span className="text-muted-foreground">—</span>}</Field>
          <Field label="신청 한도"><span className="font-mono">{limitsText(r)}</span></Field>
          {/* 관리자가 생성 시작 때 조정한 한도 */}
          {r.provisionSpec && <Field label="생성 한도"><span className="font-mono">{limitsText(limitsOf(r))}</span></Field>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Boxes className="size-3.5 text-brand-indigo-600" /> 클러스터
            </div>
            <Field label="템플릿"><span className="font-mono">{r.templateName ?? "—"}</span></Field>
            <Field label="Kubernetes 버전">
              <span className="font-mono">{(r.kubeVersion ?? r.k8sVersion) ? `v${r.kubeVersion ?? r.k8sVersion}` : "—"}</span>
            </Field>
            <Field label="네임스페이스"><span className="font-mono">{r.result?.namespace ?? r.namespace ?? "—"}</span></Field>
            <Field label="용도">{r.purpose || <span className="text-muted-foreground">—</span>}</Field>
          </div>
          <div className="space-y-2.5 rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Server className="size-3.5 text-rose-600" /> 노드 (신청)
            </div>
            <Field label="Control Plane">
              <span className="font-mono">{r.masterCount ?? 0} 대 / {r.masterFlavorName ?? r.masterFlavorId ?? "—"}</span>
            </Field>
            <Field label="Worker"><span className="font-mono">{r.nodeCount ?? 0} 대 / {r.flavorName ?? "—"}</span></Field>
            <Field label="Worker 가속기"><AccelBadges r={r} /></Field>
            <Field label="키페어">
              <span className="inline-flex items-center gap-1 font-mono">
                {r.keypairName ? <><KeyRound className="size-3 text-amber-600" />{r.keypairName}</> : <span className="text-muted-foreground">템플릿 키페어</span>}
              </span>
            </Field>
          </div>
        </div>
      )}

      {/* 클러스터 — 관리자가 고른 망·서브넷, 조정한 노드, 결과 */}
      {cp && (
        <div className="space-y-2.5 rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Network className="size-3.5 text-sky-600" /> 프로비저닝 설정
          </div>
          <Field label="네트워크 · 서브넷"><span className="font-mono">{cp.networkName} · {cp.subnetCidr}</span></Field>
          <Field label="Control Plane"><span className="font-mono">{cp.masterCount} 대 / {cp.masterFlavorName}</span></Field>
          <Field label="Worker"><span className="font-mono">{cp.nodeCount} 대 / {cp.flavorName}</span></Field>
          {r.result?.apiAddress && <Field label="API 주소"><span className="font-mono text-brand-mint-700">{r.result.apiAddress}</span></Field>}
          {r.result?.clusterId && <Field label="클러스터 ID"><span className="font-mono text-xs">{r.result.clusterId}</span></Field>}
        </div>
      )}

      {/* 관리자 할당 · 프로비저닝 결과 */}
      {isVm && p && (
        <div className="space-y-2.5 rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Network className="size-3.5 text-sky-600" /> 할당 네트워크
          </div>
          <Field label="네트워크">
            <span className="inline-flex items-center gap-1.5">
              <NetKindBadge internet={p.networkKind === "external"} /><span className="font-mono">{p.networkName}</span>
            </span>
          </Field>
          <Field label="보안그룹"><span className="font-mono">{p.securityGroups.length ? p.securityGroups.join(", ") : "—"}</span></Field>
          {/* 받은 IP(완료 전이면 직접 입력한 IP) — 직접 입력이면 고정 IP, 아니면 DHCP 자동 할당 */}
          {(r.result?.fixedIp ?? p.fixedIp) && (
            <Field label="IP">
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{p.fixedIp ? "고정 IP" : "DHCP"}</Badge>
                <span className="font-mono">{r.result?.fixedIp ?? p.fixedIp}</span>
              </span>
            </Field>
          )}
          {r.result?.floatingIp && <Field label="Floating IP"><span className="font-mono text-brand-mint-700">{r.result.floatingIp}</span></Field>}
        </div>
      )}

    </div>
  );
}

// 처리 결과 — 승인·프로비저닝·반려 기록과 실패 사유. 신청 상세의 맨 아래(버튼 바로 위)에 표시
function ProcessResult({ r }: { r: ResourceRequest }) {
  if (!(r.approvedByName || r.provisioningByName || r.approvedRejectByName || r.provisioningRejectByName || r.errorMessage)) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Clock className="size-3.5 text-muted-foreground" /> 처리 결과
      </div>
      {r.approvedByName && <Field label="승인">{r.approvedByName} · <span className="font-mono">{fmtDt(r.approvedAt ?? "")}</span></Field>}
      {r.provisioningByName && <Field label="프로비저닝">{r.provisioningByName} · <span className="font-mono">{fmtDt(r.provisioningAt ?? "")}</span></Field>}
      {r.approvedRejectByName && <Field label="반려 (승인 단계)">{r.approvedRejectByName} · <span className="font-mono">{fmtDt(r.approvedRejectAt ?? "")}</span></Field>}
      {r.provisioningRejectByName && <Field label="반려 (프로비저닝 단계)">{r.provisioningRejectByName} · <span className="font-mono">{fmtDt(r.provisioningRejectAt ?? "")}</span></Field>}
      {rejectReasonOf(r) && <Field label="반려 사유"><span className="text-rose-600">{rejectReasonOf(r)}</span></Field>}
      {r.errorMessage && <Field label="실패 사유"><span className="text-rose-600">{r.errorMessage}</span></Field>}
    </div>
  );
}

function ipInCidr(ip: string, cidr: string) {
  const toNum = (s: string) => {
    const parts = s.split(".");
    if (parts.length !== 4 || parts.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
    return parts.reduce((a, x) => a * 256 + Number(x), 0);
  };
  const [base, bitsStr] = cidr.split("/");
  const n = toNum(ip);
  const b = toNum(base);
  const bits = Number(bitsStr);
  if (n === null || b === null) return false;
  const size = 2 ** (32 - bits);
  const start = b - (b % size);
  return n > start && n < start + size - 1;
}

// 승인 입력 — 네트워크 · IP 방식 · 보안그룹 (티켓 프로젝트 기준 라이브 조회)
function ApprovalForm({ r, onChange }: { r: ResourceRequest; onChange: (spec: ProvisionSpec | null) => void }) {
  const { data: networks = [], isLoading: netLoading, error: netError } = useProjectNetworks(r.projectId);
  const { data: sgs = [], error: sgError } = useProjectSecurityGroups(r.projectId);
  const externals = networks.filter((n) => n.kind === "external");

  // 재시도(실패한 신청)면 이전 회차의 승인 설정으로 채워 두고 고칠 수 있게 한다
  const prev = r.provisionSpec;
  const [networkId, setNetworkId] = React.useState(prev?.networkId ?? "");
  const [fipOn, setFipOn] = React.useState(prev ? !!prev.floatingNetworkId : !!r.floatingIp);
  const [fipNetId, setFipNetId] = React.useState(prev?.floatingNetworkId ?? "");
  const [ipManual, setIpManual] = React.useState(!!prev?.fixedIp);
  const [fixedIp, setFixedIp] = React.useState(prev?.fixedIp ?? "");
  const [sgNames, setSgNames] = React.useState<string[]>(prev?.securityGroups ?? ["default"]);

  const net = networks.find((n) => n.id === networkId);
  const isExternal = net?.kind === "external";
  const fipNet = externals.find((n) => n.id === fipNetId) ?? externals[0];
  const ipInRange = !!net && net.cidr.split(", ").some((c) => ipInCidr(fixedIp, c)); // 서브넷이 여러 개면 ", " 로 연결됨

  // 직접 입력 IP — '중복 확인' 버튼을 누른 IP 로 사용 여부 조회. 입력을 바꾸면 다시 확인해야 한다.
  const [checkedIp, setCheckedIp] = React.useState("");
  const ipCheckReady = ipManual && ipInRange && checkedIp === fixedIp;
  const {
    data: ipCheck, isFetching: ipChecking, isError: ipCheckFailed, error: ipCheckError, refetch: recheckIp,
  } = useIpCheck(networkId, checkedIp, ipCheckReady);
  const ipValid = !ipManual || (ipCheckReady && !ipChecking && ipCheck?.available === true);

  React.useEffect(() => {
    // 네트워크·보안그룹(1개 이상) 필수, FIP 를 켰는데 풀이 없으면 진행 불가
    if (!net || !ipValid || (!isExternal && fipOn && !fipNet) || sgNames.length === 0) return onChange(null);
    onChange({
      networkId: net.id,
      networkName: net.name,
      networkKind: net.kind,
      fixedIp: ipManual ? fixedIp : undefined, // 직접 입력 — 망 종류와 무관
      ...(!isExternal && fipOn && fipNet ? { floatingNetworkId: fipNet.id, floatingNetworkName: fipNet.name } : {}),
      securityGroups: sgNames,
    });
  }, [net, isExternal, fipOn, fipNet, ipManual, fixedIp, ipValid, sgNames, onChange]);

  // 사용자 희망(내부망/인터넷망)과 같은 말로 표시 — 외부(external) 망만 인터넷망
  const kindLabel = { project: "내부망", shared: "내부망 · 공유", external: "인터넷망" } as const;

  return (
    <div className="space-y-3 rounded-xl border border-brand-indigo-200 bg-brand-indigo-50/30 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Network className="size-3.5 text-brand-indigo-600" /> 승인 설정
        </div>
        <span className="text-[11px] text-muted-foreground">사용자 희망: <NetworkWish r={r} /></span>
      </div>

      {/* 네트워크 */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium">네트워크 <span className="text-rose-500">*</span></div>
        {netLoading ? <Skeleton className="h-16" /> : netError ? (
          <p className="text-xs text-rose-500">네트워크를 불러오지 못했습니다 ({netError.message}).</p>
        ) : (
          <div className="grid gap-1.5">
            {networks.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { setNetworkId(networkId === n.id ? "" : n.id); setIpManual(false); setFixedIp(""); }} // 다시 누르면 해제
                // 선택 표시는 ring·배경·체크로 — 테두리색 클래스는 전역 border-color 규칙에 덮인다
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  networkId === n.id ? "bg-brand-indigo-50 ring-2 ring-primary" : "bg-background hover:bg-secondary/40",
                )}
              >
                {networkId === n.id
                  ? <CircleCheck className="size-4 shrink-0 text-primary" />
                  : <Circle className="size-4 shrink-0 text-muted-foreground/40" />}
                {n.kind === "external" ? <Globe className="size-4 shrink-0 text-amber-600" /> : <Wifi className="size-4 shrink-0 text-sky-600" />}
                <span className={cn("flex-1 font-mono text-sm", networkId === n.id && "font-semibold text-brand-indigo-900")}>{n.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{n.cidr}</span>
                {/* 색상은 '사용자 희망' 배지와 동일 — 인터넷망 amber, 내부망 sky */}
                <Badge variant="ghost" className={cn("text-[10px]", n.kind === "external" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
                  {kindLabel[n.kind]}
                </Badge>
              </button>
            ))}
          </div>
        )}
        {!netLoading && !netError && networks.length > 0 && !net && <p className="text-xs text-rose-500">네트워크를 선택하세요.</p>}
      </div>

      {/* IP — 자동 할당(DHCP) 또는 직접 입력(고정 IP) */}
      {net && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {[{ v: false, l: "자동 할당" }, { v: true, l: "직접 입력" }].map((o) => (
              <Button key={o.l} type="button" size="sm" variant={ipManual === o.v ? "default" : "outline"} className="h-7" onClick={() => setIpManual(o.v)}>
                {o.l}
              </Button>
            ))}
            {ipManual && (
              <>
                <Input
                  value={fixedIp}
                  onChange={(e) => setFixedIp(e.target.value.trim())}
                  placeholder={net.cidr.split("/")[0].replace(/\d+$/, "10")}
                  className="h-7 w-40 font-mono text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={!ipInRange || (ipChecking && checkedIp === fixedIp)}
                  onClick={() => (checkedIp === fixedIp ? recheckIp() : setCheckedIp(fixedIp))}
                >
                  중복 확인
                </Button>
              </>
            )}
          </div>
          {ipManual && fixedIp && (
            !ipInRange ? <p className="text-xs text-rose-500">{net.cidr} 범위의 호스트 IP를 입력하세요.</p>
              : !ipCheckReady ? <p className="text-xs text-muted-foreground">중복 확인을 눌러 IP 사용 여부를 확인하세요.</p>
              : ipChecking ? <p className="text-xs text-muted-foreground">IP 사용 여부 확인 중…</p>
              : ipCheckFailed ? <p className="text-xs text-rose-500">IP 중복 확인에 실패했습니다{ipCheckError?.message ? ` (${ipCheckError.message})` : ""}. 중복 확인을 다시 눌러 주세요.</p>
              : ipCheck?.available ? <p className="text-xs text-brand-mint-700">사용 가능한 IP입니다.</p>
              : <p className="text-xs text-rose-500">{ipCheck?.reason ?? "사용할 수 없는 IP입니다."}</p>
          )}
        </div>
      )}
      {/* Floating IP — 내부·공유망만(외부망은 받은 IP 가 곧 공인 IP) */}
      {net && !isExternal && (
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={fipOn} onChange={(e) => setFipOn(e.target.checked)} className="size-3.5 accent-primary" />
            Floating IP 연결
          </label>
          {fipOn && (
            <Select value={fipNet?.id ?? ""} onValueChange={setFipNetId}>
              <SelectTrigger className="h-8 w-56 font-mono text-xs"><SelectValue placeholder="FIP 풀 (external 망)" /></SelectTrigger>
              <SelectContent>
                {externals.map((n) => <SelectItem key={n.id} value={n.id} className="font-mono text-xs">{n.name} · {n.cidr}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* 보안그룹 */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium">보안그룹 <span className="text-rose-500">*</span></div>
        {sgError && <p className="text-xs text-rose-500">보안그룹을 불러오지 못했습니다 ({sgError.message}).</p>}
        <div className="flex flex-wrap gap-1.5">
          {sgs.map((g) => {
            const on = sgNames.includes(g.name);
            return (
              <Tooltip key={g.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSgNames((cur) => (on ? cur.filter((x) => x !== g.name) : [...cur, g.name]))}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                      on ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90" : "bg-background hover:bg-secondary/40",
                    )}
                  >
                    {on ? <Check className="size-3" /> : <ShieldCheck className="size-3 text-muted-foreground" />} {g.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{g.description}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {!sgError && sgs.length > 0 && sgNames.length === 0 && <p className="text-xs text-rose-500">보안그룹을 하나 이상 선택하세요.</p>}
      </div>
    </div>
  );
}

function CapacityBar({ label, used, add, cap, unit }: { label: React.ReactNode; used: number; add: number; cap: number; unit: string }) {
  const after = used + add;
  const pct = (v: number) => (cap > 0 ? Math.min(100, (v / cap) * 100) : v > 0 ? 100 : 0); // 쿼터 0 대비
  const usedPct = pct(used);
  const afterPct = pct(after);
  const over = after > cap;
  const tight = !over && afterPct > 85;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="min-w-0 text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono">
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

// 프로젝트 쿼터 한 줄 — 무제한(-1)이면 막대 없이 사용량만
function QuotaBar({ label, q, add, unit }: { label: string; q: { quota: number; used: number }; add: number; unit: string }) {
  if (q.quota < 0) {
    return (
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{q.used.toLocaleString()} → {(q.used + add).toLocaleString()} {unit} · 무제한</span>
      </div>
    );
  }
  return <CapacityBar label={label} used={q.used} add={add} cap={q.quota} unit={unit} />;
}

// 배치·가용량 미리보기(관리자 승인 판단용) — 후보 노드(Placement, Nova 스케줄러와 같은 질의) + 프로젝트 쿼터. MNT-IAAS 라이브 조회.
// 실제 노드는 스케줄러가 후보 중에서 정하므로 노드마다 탭으로 보여준다(처음엔 여유가 가장 큰 후보). 후보가 아닌 노드는 '불가'와 이유.
// onState 로 알린다 — ok: 프로비저닝해도 되는지(미리보기를 읽었고 프로젝트 쿼터를 넘지 않음),
// pin: 노드 지정 권한이 있으면 고른 노드(프로비저닝 때 넘김, 권한이 없으면 null → 스케줄러가 고름).
type PlacementState = { ok: boolean; pin: PlacementPreview["nodes"][number] | null };
function PlacementCapacity({ r, onState }: { r: ResourceRequest; onState: (s: PlacementState) => void }) {
  const { data, isLoading, error } = usePlacementPreview(r.flavorId, r.projectId);
  const [host, setHost] = React.useState(r.provisionSpec?.host); // 재시도면 지난 회차에 고른 노드부터
  const addVcpu = r.vcpu ?? 0;
  const addRamGb = r.ramGb ?? 0;
  const bootGb = r.volumeGb || r.diskGb || 0; // 부팅 볼륨 = 플레이버 디스크(0이면 신청 입력값)
  const gb = (mb: number) => Math.round(mb / 1024);
  const cur = data?.nodes.find((c) => c.host === host) ?? data?.nodes[0]; // 다시 조회해 빠진 노드면 첫 노드
  const candidates = data?.nodes.filter((c) => c.candidate) ?? [];
  const pinned = data?.hostPinning && cur ? cur : null;
  // 프로젝트 쿼터 — 막대와 초과 판정이 같은 목록을 쓴다(무제한 -1 은 초과 없음)
  const quotaRows = data?.quota ? [
    { label: "vCPU", q: data.quota.vcpu, add: addVcpu, unit: "vCPU" },
    { label: "메모리", q: data.quota.ramGb, add: addRamGb, unit: "GB" },
    { label: "인스턴스", q: data.quota.instances, add: 1, unit: "개" },
    { label: "볼륨 용량", q: data.quota.diskGb, add: bootGb, unit: "GB" },
    { label: "볼륨 수", q: data.quota.volumes, add: 1, unit: "개" },
  ] : [];
  const quotaOver = quotaRows.filter((x) => x.q.quota >= 0 && x.q.used + x.add > x.q.quota).map((x) => x.label);
  const ok = !!data && quotaOver.length === 0;
  React.useEffect(() => onState({ ok, pin: pinned }), [ok, pinned, onState]);
  const accelShort = data?.accelerators.find((a) => a.free < a.count);
  const blocked = (c: PlacementPreview["nodes"][number]) => { // 후보가 아닌 이유 — 막대와 같은 기준
    const why = [
      c.disabled && "꺼 둔 노드",
      c.vcpu.used + addVcpu > c.vcpu.capacity && "vCPU 부족",
      c.ramMb.used + addRamGb * 1024 > c.ramMb.capacity && "메모리 부족",
      ...(data?.accelerators ?? []).map((a, i) =>
        c.accel[i].capacity - c.accel[i].used < a.count && (c.accel[i].capacity ? `${a.kind} 여유 부족` : `${a.kind} 장치 없음`)),
    ].filter(Boolean);
    return why.length ? why.join(", ") : "배치 조건 불충족";
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-border p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Server className="size-3.5 text-brand-indigo-600" /> 배치 · 가용량 미리보기
      </div>
      {isLoading ? <Skeleton className="h-24" /> : error ? (
        <p className="text-xs text-rose-500">가용량을 불러오지 못했습니다 ({error.message}). 확인할 수 없어 프로비저닝할 수 없습니다.</p>
      ) : data && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">후보 노드</span>
            <span className="font-mono">{candidates.length}대 <span className="text-muted-foreground">/ 전체 {data.nodes.length}대</span></span>
          </div>
          {!data.hostPinning && candidates.length > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-amber-700">
              <AlertCircle className="size-3.5 shrink-0" />자원풀 권한이 부족하여 후보 노드중 하나에 스케줄링 됩니다.
            </p>
          )}
          {candidates.length === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {accelShort
                ? `요청한 가속기(${accelShort.kind} ${accelShort.count}장${r.deviceProfile ? ` · ${r.deviceProfile}` : ""}) 여유가 있는 노드가 없습니다 — 전체 ${accelShort.total}장 중 여유 ${accelShort.free}장. 반려하거나 회수 후 다시 시도하세요.`
                : "vCPU·메모리 여유가 있는 노드가 없습니다."}
            </div>
          )}
          {cur && (
            <Tabs value={cur.host} onValueChange={setHost}>
              <TabsList className="h-auto max-w-full flex-wrap justify-start">
                {data.nodes.map((c) => (
                  <TabsTrigger
                    key={c.host} value={c.host}
                    className={cn(
                      "group px-2.5 font-mono text-xs data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground",
                      !c.candidate && "text-muted-foreground/70",
                    )}
                  >
                    {c.host}
                    {!c.candidate && <span className="font-sans text-[10px] text-rose-500 group-data-[state=active]:text-primary-foreground/80">불가</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
              {data.nodes.map((c) => (
                <TabsContent key={c.host} value={c.host} className="mt-2.5 space-y-2.5">
                  {!c.candidate && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-600">
                      <AlertCircle className="size-3.5 shrink-0" />배치 불가 — {blocked(c)}{data.hostPinning && " · 후보 노드를 골라야 프로비저닝할 수 있습니다"}
                    </p>
                  )}
                  <CapacityBar label="vCPU" used={c.vcpu.used} add={addVcpu} cap={c.vcpu.capacity} unit="vCPU" />
                  <CapacityBar label="메모리" used={gb(c.ramMb.used)} add={addRamGb} cap={gb(c.ramMb.capacity)} unit="GB" />
                  {data.accelerators.map((a, i) => (
                    <CapacityBar
                      key={`${a.resourceClass}-${i}`}
                      label={
                        <span className="flex min-w-0 items-center gap-1.5">
                          가속기
                          <Badge variant="ghost" className={cn("h-5 shrink-0 gap-1 px-1.5 text-[10px]", accKindClass(a.kind))}>
                            <Cpu className="size-3" />{a.kind}
                          </Badge>
                          <span className="truncate font-mono">
                            {r.deviceProfile}{a.traits.length > 0 && `(${a.traits.join(", ")})`}
                          </span>
                        </span>
                      }
                      used={c.accel[i].used} add={a.count} cap={c.accel[i].capacity} unit="장"
                    />
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
          {bootGb > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">부팅 볼륨</span>
              <span className="font-mono">{bootGb} GB · Cinder 풀 할당</span>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground">프로젝트 쿼터</div>
            {data.quotaError ? (
              <p className="text-xs text-rose-500">쿼터를 불러오지 못했습니다 ({data.quotaError}).</p>
            ) : (
              <>
                {quotaOver.length > 0 && (
                  <p className="flex items-start gap-1 text-[11px] text-rose-600">
                    <AlertCircle className="mt-px size-3.5 shrink-0" />
                    프로젝트 쿼터({quotaOver.join(", ")})를 초과해 프로비저닝할 수 없습니다. 쿼터를 늘리거나 반려하세요.
                  </p>
                )}
                {quotaRows.map((x) => <QuotaBar key={x.label} label={x.label} q={x.q} add={x.add} unit={x.unit} />)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// 프로비저닝 진행 사이드 시트 — 큰 단계 5개 + 세부 단계, MNT-CORE(tkt_provision_step) 폴링
function fmtSec(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

/** 보이는 단계의 소요 시간 — 끝났으면 기록된 시각끼리, 진행 중이면 화면 시계(t)까지. */
function stepDurationMs(s: ProvisionStep, t: number) {
  if (!s.startedAt || s.status === "waiting") return undefined;
  const end = s.status === "running" ? t : s.endedAt ? Date.parse(s.endedAt) : NaN;
  return Number.isFinite(end) ? end - Date.parse(s.startedAt) : undefined;
}

// 진행 중엔 서버 시각보다 1.5초 늦게 그린다 — 조회(1초)가 먼저 와 있어, 끝난 단계를 모른 채 시간을 더 세다 되돌아가지 않게
const LIVE_DELAY_MS = 1500;

type StepsData = ProvisionStepsResp & { receivedAt: number };

/** 화면 시계 t 에서 보이는 상태 — 기록된 시작·종료 시각으로 정한다(Infinity 면 기록 그대로). */
function shownStatus(x: { status: ProvStepStatus; startedAt?: string; endedAt?: string }, t: number): ProvStepStatus {
  if (t === Infinity || x.status === "waiting" || x.status === "skipped" || !x.startedAt) return x.status;
  if (Date.parse(x.startedAt) > t) return "waiting";
  return x.endedAt && Date.parse(x.endedAt) <= t ? x.status : "running";
}

/** 진행 창의 화면 시계(서버 시각, ms) — 진행 중에만 서버 시각보다 LIVE_DELAY_MS 늦게 따라간다.
 *  서버가 확인해 준 시각(응답의 now)을 넘지 않고(응답이 늦으면 잠깐 멈춤), 뒤로 가지 않는다.
 *  끝난 신청을 열었거나 끝난 뒤 다 따라잡으면 Infinity — 기록된 값을 그대로 보여 준다. */
function useShownClock(data: StepsData | undefined) {
  const [clock, setClock] = React.useState<{ attempt?: number; t: number }>({ t: Infinity });
  const live = data?.status === "provisioning";
  const following = live || Number.isFinite(clock.t);
  React.useEffect(() => {
    if (!data || !following) return;
    const horizon = Date.parse(data.now);
    const times = data.items.flatMap((s) => [s, ...s.details]).flatMap((x) => [x.startedAt, x.endedAt]);
    const lastEvent = Math.max(-Infinity, ...times.filter((v): v is string => !!v).map(Date.parse));
    const tick = () => setClock((c) => {
      const target = Math.min(horizon + (performance.now() - data.receivedAt) - LIVE_DELAY_MS, horizon);
      const fresh = c.attempt !== data.attempt || !Number.isFinite(c.t);  // 새로 진행 중 — 지금부터 따라간다
      const t = fresh ? target : Math.max(c.t, target);
      return { attempt: data.attempt, t: !live && t >= lastEvent ? Infinity : t };  // 끝났고 다 따라잡음
    });
    const id = window.setInterval(tick, 100);
    const first = window.requestAnimationFrame(tick);
    return () => {
      window.clearInterval(id);
      window.cancelAnimationFrame(first);
    };
  }, [data, following, live]);
  // 진행 중인데 아직 따라가기 전(첫 응답 직후 한 번) — 응답 기준 시각으로 그려 앞선 상태가 비치지 않게
  if (live && (clock.attempt !== data.attempt || !Number.isFinite(clock.t))) return Date.parse(data.now) - LIVE_DELAY_MS;
  return clock.t;
}

function StepIcon({ status }: { status: ProvStepStatus }) {
  return status === "done" ? <CircleCheck className="size-5 text-foreground" />
    : status === "running" ? <Loader2 className="size-5 animate-spin text-brand-mint-500" />
    : status === "failed" ? <CircleX className="size-5 text-rose-600" />
    : status === "skipped" ? <CircleMinus className="size-5 text-muted-foreground/50" />
    : <CircleDashed className="size-5 text-muted-foreground/40" />;
}

function SubIcon({ status }: { status: ProvStepStatus }) {
  return status === "done" ? <Check className="size-3.5 text-brand-mint-600" />
    : status === "running" ? <Loader2 className="size-3.5 animate-spin text-brand-mint-500" />
    : status === "failed" ? <XCircle className="size-3.5 text-rose-600" />
    : <span className="mx-[5px] size-1 rounded-full bg-muted-foreground/40" />;
}

/** 시작·재시도 알림 — 시작 직후 받아 둔 진행 기록으로: 시작 대기(예약)면 '프로비저닝을 예약했습니다'(시작한 것으로
 *  오해하지 않게), 바로 시작했으면 started. 설명은 신청 ID 와 몇 번째 시도인지(2회차부터). */
function toastStarted(qc: QueryClient, id: string, started: string) {
  const s = qc.getQueryData<ProvisionStepsResp>(["tickets", "steps", id]);
  const attempt = s?.attempt ?? 1;
  toast.success(s?.status === "provisioning" && s.queue ? "프로비저닝을 예약했습니다" : started, {
    description: `신청 ID: ${id}${attempt > 1 ? ` · ${attempt}차 시도` : ""}`,
  });
}

function fmtWait(sec: number) {
  const m = Math.floor(sec / 60);
  return m ? `${m}분 ${sec % 60}초` : `${sec}초`;
}

/** VM 시작 대기(예약) 모달 — 동시에 진행할 수 있는 프로비저닝이 모두 진행 중이라 자리를 기다리는 동안.
 *  자리가 나면 진행 화면으로 바뀐다. 닫아도(바깥·ESC) 예약은 그대로 — 목록의 진행 버튼으로 다시 본다.
 *  예상 대기 시간은 프로비저닝을 누른 시점의 값 그대로(서버가 신청에 남김) — 현재 대기 시간이 넘어가도 둔다. */
function QueueDialog({ queue, open, onClose, onCancel, cancelling }: {
  queue: { waitedSec: number; expectedSec: number }; open: boolean; onClose: () => void;
  onCancel?: () => void; cancelling: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="max-w-md">
        <DialogHeader>
          <DialogTitle>워크플로 예약 중…</DialogTitle>
          <DialogDescription>동시에 진행할 수 있는 VM 프로비저닝이 모두 진행 중입니다. 자리가 나면 자동으로 시작합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">예상 대기 시간</span>
            <span className="font-mono tabular-nums">약 {fmtWait(queue.expectedSec)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">현재 대기 시간</span>
            <span className="font-mono tabular-nums">{fmtWait(queue.waitedSec)}</span>
          </div>
        </div>
        {onCancel && (
          <DialogFooter>
            <Button onClick={onCancel} disabled={cancelling}>
              <X className="size-4" /> {cancelling ? "취소하는 중…" : "예약 취소"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProvisioningSheet({ req, open, onClose, canRetry }: {
  req: ResourceRequest | null; open: boolean; onClose: () => void; canRetry?: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useTicketSteps(open ? req?.id : undefined);
  const isWs = req?.type === "ai-workspace";
  const isCluster = req?.type === "cluster";
  const retry = useProvisionTicket();
  const retryWs = useProvisionAiWorkspaceTicket();
  const retryCluster = useProvisionClusterTicket();
  const user = useAuth((s) => s.user);
  const retrying = isWs ? retryWs : isCluster ? retryCluster : retry;
  const cancelQueue = useCancelProvisionQueue();
  const t = useShownClock(data);
  // 화면 시계 기준으로 보이는 단계 — 아직 오지 않은 시각의 값·오류는 감춘다
  const steps = (data?.items ?? []).map((s) => {
    const st = shownStatus(s, t);
    return {
      ...s,
      status: st,
      error: st === "failed" ? s.error : undefined,
      details: s.details.map((d) => {
        const ds = shownStatus(d, t);
        return { ...d, status: ds, value: ds === d.status ? d.value : undefined };
      }),
    };
  });
  // 재시도는 새 진행 기록을 받을 때까지 요청 중(이전 화면 그대로) — 기록을 끝내 받지 못했으면 '생성 중'으로 본다
  const serverStatus = data?.status ?? (retrying.isSuccess ? "provisioning" : req?.status);
  // 화면 시계가 따라가는 동안은 끝났어도 '생성 중' — 마지막 단계가 보이게 끝난 뒤 완료·실패로
  const status = Number.isFinite(t) ? "provisioning" : serverStatus;
  const attempt = data?.attempt ?? 1;
  const done = status === "completed";
  const failed = status === "failed";

  // 진행률: 단계 수는 완료·건너뜀 기준, 퍼센트는 세부 단계 기준
  const finishedSteps = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const subs = steps.filter((s) => s.status !== "skipped").flatMap((s) => s.details);
  const pct = subs.length ? Math.round((subs.filter((d) => d.status === "done").length / subs.length) * 100) : 0;
  const totalMs = done && steps.length
    ? Math.max(...steps.map((s) => (s.endedAt ? Date.parse(s.endedAt) : 0))) - Math.min(...steps.filter((s) => s.startedAt).map((s) => Date.parse(s.startedAt!)))
    : undefined;

  // 펼침: 진행 중엔 진행·실패 단계만, 모두 완료되면 전부 닫힘.
  // 사용자가 누른 값은 같은 티켓 상태 동안만 유지 — 완료로 바뀌면 초기화되어 모두 닫힌다.
  // (티켓이 바뀌면 key 로 다시 마운트되어 초기화)
  const [toggled, setToggled] = React.useState<{ status?: RequestStatus; map: Record<number, boolean> }>({ map: {} });
  const isOpen = (s: ProvisionStep) =>
    (toggled.status === status ? toggled.map[s.seq] : undefined) ?? (!done && (s.status === "running" || s.status === "failed"));

  // 상태가 바뀌면 목록도 갱신
  React.useEffect(() => {
    if (serverStatus) qc.invalidateQueries({ queryKey: ["tickets", "list"] });
  }, [serverStatus, qc]);

  // 예약 취소 결과 — 되돌려졌으면(생성 중이 아님) 닫고, 그사이 시작했으면 알리고 진행 화면으로
  const cancelSent = cancelQueue.isSuccess;
  const resetCancel = cancelQueue.reset;
  React.useEffect(() => {
    if (!cancelSent || !data) return;
    if (data.status !== "provisioning") {
      toast.success("예약을 취소했습니다", { description: `신청 ID: ${req?.id}` });
      resetCancel();
      onClose();
    } else if (data.items.length) {
      toast.info("이미 시작되어 취소하지 못했습니다");
      resetCancel();
    }
  }, [cancelSent, data, req?.id, resetCancel, onClose]);

  // 재시도 — 이전 승인 설정 그대로 새 회차로 처음부터(실패한 회차의 자원은 이미 정리됨)
  function handleRetry() {
    // AI 워크스페이스 — 지난 회차에 확정한 한도를 그대로 보낸다(빼면 서버가 신청 값으로 시작한다)
    if (req?.type === "ai-workspace") {
      retryWs.mutate(
        { id: req.id, processedBy: user?.username ?? "", expectedStatus: "failed", ...limitsOf(req) },
        {
          onSuccess: () => toastStarted(qc, req.id, "재시도를 시작했습니다"),
          onError: (e) => toast.error("재시도하지 못했습니다", {
            description: <span className="whitespace-pre-line">{e.message}</span>,
          }),
        },
      );
      return;
    }
    // 클러스터 — 지난 회차의 망·서브넷·노드 구성 그대로
    if (req?.type === "cluster") {
      const cp = clusterSpecOf(req);
      if (!cp) return;
      retryCluster.mutate(
        { id: req.id, expectedStatus: "failed", provisionSpec: toClusterProvisionBody(cp) },
        {
          onSuccess: () => toastStarted(qc, req.id, "재시도를 시작했습니다"),
          onError: (e) => toast.error("재시도하지 못했습니다", {
            description: <span className="whitespace-pre-line">{e.message}</span>,
          }),
        },
      );
      return;
    }
    if (!req?.provisionSpec) return;
    retry.mutate(
      { id: req.id, expectedStatus: "failed", provisionSpec: toProvisionBody(req.provisionSpec) },
      {
        onSuccess: () => toastStarted(qc, req.id, "재시도를 시작했습니다"),
        onError: (e) => toast.error("재시도하지 못했습니다", {
          description: e instanceof Error ? <span className="whitespace-pre-line">{e.message}</span> : undefined,
        }),
      },
    );
  }

  // 생성 중인데 첫 조회 전 — 예약 모달인지 진행 화면인지 아직 모른다(잘못 띄웠다가 바꾸지 않게)
  if (open && req?.status === "provisioning" && !data) return null;
  // 시작 대기(예약) 중 — 진행 화면 대신 예약 모달(취소는 관리자 화면에서만)
  if (data?.status === "provisioning" && data.queue) {
    return (
      <QueueDialog
        queue={data.queue}
        open={open}
        onClose={onClose}
        cancelling={cancelQueue.isPending || cancelQueue.isSuccess}
        onCancel={canRetry && req ? () => cancelQueue.mutate(req.id, {
          onError: (e) => toast.error("예약을 취소하지 못했습니다", { description: e.message }),
        }) : undefined}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 pr-6 text-base">
            {isWs ? <BrainCircuit className="size-4 text-brand-indigo-600" />
              : isCluster ? <Boxes className="size-4 text-brand-indigo-600" />
              : <Server className="size-4 text-brand-indigo-600" />} 프로비저닝 진행
            <span className="ml-auto">
              {status === "provisioning" ? (
                <Badge variant="default" className="gap-1.5"><span className="size-1.5 rounded-full bg-brand-indigo-500" />진행 중</Badge>
              ) : status && <StatusBadge status={status} />}
            </span>
          </SheetTitle>
          <div className="flex items-center gap-2">
            <SheetDescription className="font-mono">
              {req && <>{req.vmName ?? req.workspaceName ?? req.clusterName ?? req.id} · {req.projectName}</>}
            </SheetDescription>
            {attempt > 1 && (
              <Badge variant="secondary" className="text-[10px]">{attempt}차 시도{status === "provisioning" ? " 중" : ""}</Badge>
            )}
          </div>
          {/* 진행률 바 */}
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{finishedSteps} / {steps.length} 단계</span>
              <span className="font-mono tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all duration-500", failed ? "bg-rose-400" : "bg-brand-mint-500")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </SheetHeader>

        {/* 단계 */}
        <div className="space-y-1 p-3">
          {status === "approved" && (
            <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> 승인됨 — 프로비저닝 워크플로 시작 대기 중
            </div>
          )}
          {/* 시작(재시도) 직후 — 이번 회차 단계가 등록되기 전 */}
          {status === "provisioning" && steps.length === 0 && (
            <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {!data ? "시작하는 중…" : attempt > 1 ? `${attempt}차 시도를 시작하는 중…` : "프로비저닝을 시작하는 중…"}
            </div>
          )}
          {steps.map((s) => {
            const expanded = isOpen(s);
            const dur = stepDurationMs(s, t);
            const muted = s.status === "waiting" || s.status === "skipped";
            return (
              <div key={s.seq} className={cn("rounded-lg px-2 py-2.5", s.status === "running" && "bg-secondary/40", s.status === "failed" && "bg-rose-50/60")}>
                <button
                  type="button"
                  onClick={() => setToggled((t) => ({ status, map: { ...(t.status === status ? t.map : {}), [s.seq]: !expanded } }))}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className="mt-0.5 shrink-0"><StepIcon status={s.status} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", muted && "font-medium text-muted-foreground", s.status === "failed" && "text-rose-700")}>
                      {s.message}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground/70">{s.code}</span>
                  </span>
                  <span className="mt-0.5 flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {/* 1초 안에 끝난 단계 — 상태 확인(1초) 사이에 끝나 0.0s 인 것도, 0.5s 처럼 기록된 것도 */}
                    {s.status === "skipped" ? "건너뜀" : dur !== undefined && (s.status !== "running" && dur < 1000 ? "1초 미만" : fmtSec(dur))}
                    <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                  </span>
                </button>
                {expanded && (
                  <div className="ml-8 mt-2 space-y-1.5 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                    {s.status === "skipped" && (
                      <p className="text-xs text-muted-foreground">가속기가 없는 스펙이라 이 단계를 건너뜁니다.</p>
                    )}
                    {s.details.map((d) => (
                      <div key={d.code} className="flex items-center gap-2 text-xs">
                        <span className="flex size-4 shrink-0 items-center justify-center"><SubIcon status={d.status} /></span>
                        <span className={cn("flex-1", d.status === "waiting" || d.status === "skipped" ? "text-muted-foreground" : "text-foreground", d.status === "failed" && "text-rose-700")}>
                          {d.label}
                        </span>
                        <span className="font-mono text-muted-foreground">{d.status === "waiting" ? "—" : d.value}</span>
                      </div>
                    ))}
                    {s.error && <div className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{s.error}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          {failed && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                <AlertCircle className="size-4" /> 프로비저닝 실패
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{data?.errorMessage ?? "실패한 단계를 확인하세요."}</p>
              {canRetry && (
                <Button size="sm" className="mt-3 h-7 gap-1.5" onClick={handleRetry} disabled={retrying.isPending}>
                  <RotateCcw className="size-3.5" /> {retrying.isPending ? "요청 중…" : "재시도"}
                </Button>
              )}
            </div>
          )}

          {done && (
            <div className="rounded-xl border border-brand-mint-200 bg-brand-mint-50/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-mint-800">
                <CheckCircle2 className="size-4" /> 프로비저닝 완료
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {isWs ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">네임스페이스</span><span className="font-mono">{data?.result?.namespace ?? req?.workspaceName ?? "—"}</span></div>
                ) : isCluster ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">클러스터</span><span className="font-mono">{data?.result?.clusterName ?? req?.clusterName ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">네임스페이스</span><span className="font-mono">{data?.result?.namespace ?? req?.namespace ?? "—"}</span></div>
                    {data?.result?.apiAddress && <div className="flex justify-between"><span className="text-muted-foreground">API 주소</span><span className="font-mono">{data.result.apiAddress}</span></div>}
                  </>
                ) : (
                  <>
                    {data?.result?.fixedIp && <div className="flex justify-between"><span className="text-muted-foreground">고정 IP</span><span className="font-mono">{data.result.fixedIp}</span></div>}
                    {data?.result?.floatingIp && <div className="flex justify-between"><span className="text-muted-foreground">Floating IP</span><span className="font-mono">{data.result.floatingIp}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">키페어</span><span className="font-mono">{req?.keypairName ?? "미지정"}</span></div>
                  </>
                )}
                {totalMs !== undefined && <div className="flex justify-between"><span className="text-muted-foreground">총 소요 시간</span><span className="font-mono">{fmtSec(totalMs)}</span></div>}
              </div>
              <Link href={isWs ? "/ai-development/profiles" : isCluster ? "/paas/clusters" : "/iaas/instances"} onClick={onClose} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                {isWs ? <><BrainCircuit className="size-3.5" /> AI 워크스페이스 보기</>
                  : isCluster ? <><Boxes className="size-3.5" /> 클러스터 보기</>
                  : <><Server className="size-3.5" /> 생성된 가상머신 보기</>}
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// 신청 유형 필터 — 관리자·사용자 뷰 공용
function TypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="유형" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체 유형</SelectItem>
        <SelectItem value="vm">VM</SelectItem>
        <SelectItem value="cluster">K8s 클러스터</SelectItem>
        <SelectItem value="ai-workspace">AI 워크스페이스</SelectItem>
      </SelectContent>
    </Select>
  );
}

// 목록 검색 — 신청자·프로젝트·ID (관리자·사용자 뷰 공용)
function matchesQuery(r: ResourceRequest, q: string) {
  return !q || r.requestedByName.includes(q) || r.projectName.includes(q) || r.id.includes(q);
}
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        placeholder="신청자·프로젝트·ID 검색…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-60 pl-9"
      />
    </div>
  );
}

// ─────────── 관리자 뷰 ───────────
function AdminView() {
  const [wizardOpen, setWizardOpen] = React.useState(false); // 관리자도 신청(조직이 할당된 모든 프로젝트)
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [orgFilter, setOrgFilter] = React.useState("all");
  const [q, setQ] = React.useState("");

  const filters: Record<string, string> = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (typeFilter !== "all") filters.type = typeFilter;
  if (orgFilter !== "all") filters.orgId = orgFilter;

  // 전체 신청 = MNT-CORE 실제 티켓 (목업 폴백 없음)
  const { data, isLoading, error } = useTickets(filters);
  const { data: orgs = [] } = useOrgs();
  const reviewMutation = useReviewTicket();
  const provisionMutation = useProvisionTicket();
  const provisionWsMutation = useProvisionAiWorkspaceTicket();
  const provisionClusterMutation = useProvisionClusterTicket();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);

  const [detail, setDetail] = React.useState<ResourceRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [spec, setSpec] = React.useState<ProvisionSpec | null>(null);
  // 배치·가용량 미리보기 — 읽었는지, 고른 노드(노드 지정 권한이 있을 때만, null 이면 스케줄러가 고름)
  const [placement, setPlacement] = React.useState<PlacementState>({ ok: false, pin: null });
  // AI 워크스페이스 생성 시작 — 신청(또는 지난 회차) 한도로 채워 두고 조정할 수 있게 한다
  const [wsLimits, setWsLimits] = React.useState<WorkspaceLimitsInput | null>(null);
  const [sheetReq, setSheetReq] = React.useState<ResourceRequest | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // 승인·반려 버튼 모두 상세 모달을 연다 (반려는 사유 입력 펼침)
  function openDetail(r: ResourceRequest, mode?: "reject") {
    setDetail(r);
    setRejecting(mode === "reject");
    setRejectReason("");
    setSpec(null);
    setPlacement({ ok: false, pin: null });
    setWsLimits(r.type === "ai-workspace" ? toLimitsInput(limitsOf(r)) : null);
    setDetailOpen(true);
  }
  function openSheet(r: ResourceRequest) {
    setSheetReq(r);
    setSheetOpen(true);
  }

  const items = (data?.items ?? []).filter((r) => matchesQuery(r, q));

  const pending = items.filter((r) => r.status === "pending").length;
  const inProgress = items.filter((r) => ["approved", "provisioning", "completed"].includes(r.status)).length;
  const failed = items.filter((r) => r.status === "failed").length;
  const rejected = items.filter((r) => r.status === "rejected").length;

  async function review(action: "approve" | "reject", reason = rejectReason) {
    if (!detail) return;
    const r = detail;
    try {
      await reviewMutation.mutateAsync({
        id: r.id,
        action,
        reason: action === "reject" ? reason.trim() : undefined,
        expectedStatus: r.status,
      });
      setDetailOpen(false);
      if (action === "approve") {
        toast.success("승인되었습니다", { description: `신청 ID: ${r.id}` });
      } else {
        toast.success("반려 처리됨", { description: `신청 ID: ${r.id}` });
      }
    } catch (e) {
      toast.error("처리하지 못했습니다", { description: e instanceof Error ? e.message : undefined });
    }
  }

  // 승인(VM) → 생성 중: 승인 설정으로 Temporal 워크플로 시작 후 진행 시트를 연다
  // 승인(AI 워크스페이스) → 생성 중: 확정한 한도로 시작 / 승인(클러스터) → 생성 중: 망·서브넷·노드 구성으로 시작
  // (실패 → 재시도도 같은 경로)
  async function provision(clusterSpec?: ClusterProvisionValue) {
    if (!detail) return;
    const r = detail;
    const isWs = r.type === "ai-workspace";
    const isCluster = r.type === "cluster";
    if (isWs ? !wsLimits || !limitsOk(wsLimits) : isCluster ? !clusterSpec : !spec) return;
    try {
      const started = isCluster
        ? await provisionClusterMutation.mutateAsync({ id: r.id, expectedStatus: r.status, provisionSpec: clusterSpec! })
        : isWs
        ? await provisionWsMutation.mutateAsync({
            id: r.id,
            processedBy: user?.username ?? "",
            expectedStatus: r.status,
            ...limitsBody(wsLimits!),
          })
        : await provisionMutation.mutateAsync({
            id: r.id,
            expectedStatus: r.status,
            provisionSpec: { ...toProvisionBody(spec!), host: placement.pin?.host },
          });
      setDetailOpen(false);
      toastStarted(qc, r.id,
        r.status === "failed" ? "재시도를 시작했습니다" : isWs ? "워크스페이스 생성을 시작했습니다"
          : isCluster ? "클러스터 생성을 시작했습니다" : "프로비저닝을 시작했습니다");
      openSheet(started);
    } catch (e) {
      toast.error(r.status === "failed" ? "재시도하지 못했습니다" : "프로비저닝을 시작하지 못했습니다", {
        description: e instanceof Error ? <span className="whitespace-pre-line">{e.message}</span> : undefined, // 서버 사유의 줄바꿈 유지
      });
    }
  }

  // 대기 → 승인·반려, 승인(VM) → 프로비저닝·반려. 승인 설정은 프로비저닝 단계에서 입력
  // AI 워크스페이스: 승인 → 생성 시작(한도 조정)·반려, 실패 → 한도 확인 후 재시도·반려
  const isPending = detail?.status === "pending";
  const isApprovedVm = detail?.status === "approved" && detail.type === "vm";
  const isFailedVm = detail?.status === "failed" && detail.type === "vm";  // 실패 → 승인 설정 확인 후 재시도·반려
  const canProvisionVm = isApprovedVm || isFailedVm;
  const canProvisionWs = detail?.type === "ai-workspace" && (detail.status === "approved" || detail.status === "failed");
  const canProvision = canProvisionVm || canProvisionWs; // 클러스터 대기·승인·실패는 ClusterReviewContent(시안 1a·1b)
  const canProcess = isPending || canProvision;

  return (
    <div className="space-y-4">
      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="대기중" value={pending} color="warning" />
        <StatBlock label="진행·완료" value={inProgress} color="mint" />
        <StatBlock label="실패" value={failed} color="rose" />
        <StatBlock label="반려됨" value={rejected} color="indigo" />
      </div>

      {/* 필터 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} />
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="조직" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 조직</SelectItem>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <TypeSelect value={typeFilter} onChange={setTypeFilter} />
          <span className="text-xs text-muted-foreground">{items.length}건</span>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" /> 자원 신청
            </Button>
          </div>
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
                <TableHead>프로젝트 · 신청자</TableHead>
                <TableHead>자원 이름</TableHead>
                <TableHead>스펙</TableHead>
                <TableHead>신청 일시</TableHead>
                <TableHead><StatusHelpHead /></TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const actionable = r.status === "pending";
                const isWsRow = r.type === "ai-workspace";
                const provisionable = r.status === "approved";
                const inProvision = IN_PROVISION.includes(r.status);
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <CopyCell value={r.id} label="신청 ID" className="whitespace-nowrap font-semibold" />
                    <TableCell><TypeBadge type={r.type} /></TableCell>
                    <TableCell><ProjectRequesterCell r={r} /></TableCell>
                    <CopyCell value={nameOf(r)} label="자원 이름" />
                    <TableCell className="font-mono text-xs"><SpecCell r={r} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{fmtDt(r.requestedAt)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actionable ? (
                        <div className="flex justify-end gap-2">
                          {/* 신청 상세의 승인 버튼과 같은 기본(채움) 버튼 */}
                          <Button size="sm" className="h-7 gap-1" onClick={() => openDetail(r)}>
                            <CheckCircle2 className="size-3.5" /> 승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => openDetail(r, "reject")}
                          >
                            <XCircle className="size-3.5" /> 반려
                          </Button>
                        </div>
                      ) : provisionable ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-brand-indigo-200 text-brand-indigo-700 hover:bg-brand-indigo-50"
                            onClick={() => openDetail(r)}
                          >
                            {isWsRow ? <><BrainCircuit className="size-3.5" /> 생성 시작</>
                              : r.type === "cluster" ? <><Boxes className="size-3.5" /> 프로비저닝</>
                              : <><Server className="size-3.5" /> 프로비저닝</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                            onClick={() => openDetail(r, "reject")}
                          >
                            <XCircle className="size-3.5" /> 반려
                          </Button>
                        </div>
                      ) : inProvision ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openSheet(r)}>
                          {r.status === "completed" ? <CheckCircle2 className="size-3.5" />
                            : r.status === "failed" ? <AlertCircle className="size-3.5 text-rose-600" />
                            : <Loader2 className="size-3.5 animate-spin" />}
                          진행 보기
                        </Button>
                      ) : r.status === "rejected" && rejectReasonOf(r) ? (
                        <span className="text-xs text-muted-foreground">{rejectReasonOf(r)}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className={cn("py-12 text-center text-sm", error ? "text-rose-600" : "text-muted-foreground")}>
                    {error ? `신청 목록을 불러오지 못했습니다 (${error.message}).` : "조건에 맞는 신청이 없습니다."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 프로비저닝 진행 사이드 시트 */}
      <ProvisioningSheet key={sheetReq?.id} req={sheetReq} open={sheetOpen} onClose={() => setSheetOpen(false)} canRetry />

      {/* 신청 상세 — 대기: 승인·반려 / 승인(VM): 승인 설정 후 프로비저닝·반려 / 실패(VM): 승인 설정 후 재시도·반려
          / 승인·실패(AI 워크스페이스): 한도 확인·조정 후 생성 시작(재시도)·반려
          / 클러스터 대기·승인·실패: 시안 1a·1b(ClusterReviewContent) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        {detail && isClusterReview(detail) ? (
          <ClusterReviewContent
            key={detail.id}
            r={detail}
            badge={<StatusBadge status={detail.status} />}
            reviewing={reviewMutation.isPending}
            provisioning={provisionClusterMutation.isPending}
            onApprove={() => review("approve")}
            onReject={(reason) => review("reject", reason)}
            onProvision={(s) => provision(s)}
          />
        ) : (
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              신청 상세 {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>
              {isPending ? "신청 내용을 확인하고 승인하거나 반려하세요."
                : isApprovedVm ? "승인 설정(네트워크·보안그룹)을 지정해 프로비저닝하거나 반려하세요."
                : isFailedVm ? "승인 설정을 확인·수정해 재시도하거나 반려하세요. 실패한 회차가 만든 자원은 정리되었습니다."
                : canProvisionWs && detail.status === "failed" ? "워크스페이스 한도를 확인·수정해 재시도하거나 반려하세요."
                : canProvisionWs ? "워크스페이스 한도(vCPU·메모리·가속기·저장)를 확인·조정한 뒤 생성을 시작하거나 반려하세요."
                : "신청 내용입니다."}
            </DialogDescription>
          </DialogHeader>
          {detail && <RequestDetailBody r={detail} />}
          {canProvisionVm && <PlacementCapacity key={`placement-${detail.id}`} r={detail} onState={setPlacement} />}
          {canProvisionVm && !rejecting && <ApprovalForm key={detail.id} r={detail} onChange={setSpec} />}
          {canProvisionWs && !rejecting && wsLimits && (
            <div className="space-y-2.5 rounded-xl border border-brand-indigo-200 bg-brand-indigo-50/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <BrainCircuit className="size-3.5 text-brand-indigo-600" /> 워크스페이스 한도 (생성 시 적용)
              </div>
              <WorkspaceLimitFields value={wsLimits} onChange={setWsLimits} />
              {!limitsOk(wsLimits) && (
                <p className="text-xs text-rose-500">vCPU·메모리·저장은 1 이상, 가속기는 0 이상의 정수로 입력하세요.</p>
              )}
            </div>
          )}
          {canProcess && rejecting && (
            <div className="space-y-2">
              <label className="text-sm font-medium">반려 사유 <span className="text-rose-500">(필수)</span></label>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="예: 프로젝트 쿼터 초과, 가속기 미할당 등"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {detail && <ProcessResult r={detail} />}
          {canProcess && (
            <DialogFooter>
              {rejecting ? (
                <>
                  <Button variant="outline" onClick={() => setRejecting(false)}>취소</Button>
                  <Button variant="destructive" onClick={() => review("reject")} disabled={reviewMutation.isPending || !rejectReason.trim()}>
                    <XCircle className="size-3.5" /> 반려 확정
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => setRejecting(true)}
                  >
                    <XCircle className="size-3.5" /> 반려
                  </Button>
                  {isPending ? (
                    <Button onClick={() => review("approve")} disabled={reviewMutation.isPending}>
                      <CheckCircle2 className="size-3.5" /> 승인
                    </Button>
                  ) : canProvisionWs ? (
                    <Button onClick={() => provision()} disabled={!wsLimits || !limitsOk(wsLimits) || provisionWsMutation.isPending}>
                      {detail.status === "failed" ? <RotateCcw className="size-3.5" /> : <BrainCircuit className="size-3.5" />}
                      {provisionWsMutation.isPending ? "시작 중…" : detail.status === "failed" ? "재시도" : "생성 시작"}
                    </Button>
                  ) : (
                    <Button onClick={() => provision()} disabled={!spec || !placement.ok || placement.pin?.candidate === false || provisionMutation.isPending}>
                      {isFailedVm ? <RotateCcw className="size-3.5" /> : <Server className="size-3.5" />}
                      {provisionMutation.isPending ? "시작 중…" : isFailedVm ? "재시도" : "프로비저닝"}
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          )}
          {detail && IN_PROVISION.includes(detail.status) && detail.status !== "failed" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDetailOpen(false); openSheet(detail); }}>
                <Server className="size-3.5" /> 진행 상황 보기
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
        )}
      </Dialog>

      <ResourceRequestWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

// ─────────── 사용자 뷰 ───────────
function UserView({ username }: { username: string }) {
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [detail, setDetail] = React.useState<ResourceRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // 내 신청 = MNT-CORE 실제 티켓 (목업 폴백 없음). 신청자는 서버가 토큰으로 정한다
  const filters: Record<string, string> = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (typeFilter !== "all") filters.type = typeFilter;
  const { data, isLoading, error } = useTickets(filters, !!username);

  const items = (data?.items ?? []).filter((r) => matchesQuery(r, q));
  const pending = items.filter((r) => r.status === "pending").length;
  const inProgress = items.filter((r) => r.status === "approved" || r.status === "provisioning").length;
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
        <StatBlock label="진행중" value={inProgress} color="indigo" />
        <StatBlock label="완료" value={done} color="mint" />
      </div>

      {/* 필터 + 신청 버튼 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <TypeSelect value={typeFilter} onChange={setTypeFilter} />
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
                <TableHead>프로젝트 · 신청자</TableHead>
                <TableHead>자원 이름</TableHead>
                <TableHead>스펙</TableHead>
                <TableHead>신청 일시</TableHead>
                <TableHead><StatusHelpHead /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => { setDetail(r); setDetailOpen(true); }}>
                  <CopyCell value={r.id} label="신청 ID" className="whitespace-nowrap font-semibold" />
                  <TableCell><TypeBadge type={r.type} /></TableCell>
                  <TableCell><ProjectRequesterCell r={r} /></TableCell>
                  <CopyCell value={nameOf(r)} label="자원 이름" />
                  <TableCell className="font-mono text-xs"><SpecCell r={r} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmtDt(r.requestedAt)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className={cn("py-12 text-center text-sm", error ? "text-rose-600" : "text-muted-foreground")}>
                    {error
                      ? `신청 목록을 불러오지 못했습니다 (${error.message}).`
                      : "신청 내역이 없습니다. 위의 \"자원 신청\" 버튼으로 신청하세요."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 내 신청 상세 (읽기 전용) — 완료 시 사용 키페어·할당 IP 확인 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              신청 상세 {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>내가 신청한 내용입니다.</DialogDescription>
          </DialogHeader>
          {detail && <RequestDetailBody r={detail} />}
          {detail && <ProcessResult r={detail} />}
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
        title={isAdmin ? "자원 신청 관리" : "자원 요청 관리"}
        description={
          isAdmin
            ? "사용자 VM·K8s 클러스터·AI 워크스페이스 자원 신청을 검토하고 승인·반려합니다."
            : "VM·K8s 클러스터·AI 워크스페이스 자원을 신청하고 처리 현황을 확인합니다."
        }
      />
      {isAdmin ? <AdminView /> : <UserView username={user?.username ?? ""} />}
    </div>
  );
}
