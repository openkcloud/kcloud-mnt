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
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import type { ProvisionSpec, ProvisionStep, ProvStepStatus, ResourceRequest, RequestStatus } from "@/lib/types";

type RequestsResp = { items: ResourceRequest[]; total: number };

// ── 상태 표시 ──
const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "대기중",
  approved: "승인",
  provisioning: "생성중",
  completed: "완료",
  failed: "실패",
  rejected: "반려됨",
};

// 진행 보기 가능한 상태
const IN_PROVISION: RequestStatus[] = ["approved", "provisioning", "completed", "failed"];

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
              <li><span className="font-medium text-background">승인</span> · 승인됨, 프로비저닝 시작 대기</li>
              <li><span className="font-medium text-background">생성중</span> · 가상머신 생성·연결 진행</li>
              <li><span className="font-medium text-background">완료</span> · 생성 완료, 사용 가능</li>
              <li><span className="font-medium text-background">실패</span> · 프로비저닝 실패 (재시도 가능)</li>
              <li><span className="font-medium text-background">반려됨</span> · 승인 거부 (사유 표시)</li>
            </ul>
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

// 사용자 희망 망 배지
function NetworkWish({ r }: { r: ResourceRequest }) {
  const internet = r.networkType === "internet";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="ghost" className={cn("gap-1", internet ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
        {internet ? <Globe className="size-3" /> : <Wifi className="size-3" />}
        {internet ? "인터넷망" : "내부망"}
      </Badge>
      {r.floatingIp && <Badge variant="success">공인 IP 희망</Badge>}
    </span>
  );
}

function ipModeLabel(p: ProvisionSpec) {
  if (p.networkKind === "external") return p.fixedIp ? `Static IP (직접 입력 ${p.fixedIp})` : "Static IP (자동 할당)";
  return p.floatingNetworkName ? `Floating IP (${p.floatingNetworkName})` : "사설 IP만";
}

function RequestDetailBody({ r }: { r: ResourceRequest }) {
  const isVm = r.type === "vm";
  const p = r.provisionSpec;
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
            <Field label="vCPU · 메모리"><span className="font-mono">{r.vcpu ?? "—"} vCPU · {r.ramGb ?? "—"} GB</span></Field>
            <Field label="디스크">
              <span className="font-mono">{r.diskGb ? `${r.diskGb} GB` : r.volumeGb ? `부팅 볼륨 ${r.volumeGb} GB` : "—"}</span>
            </Field>
            <Field label="가속기">
              {r.acceleratorKind
                ? <Badge variant="ghost" className={cn("gap-1 font-mono", accKindClass(r.acceleratorKind))}><Cpu className="size-3" />{r.acceleratorKind} × {r.acceleratorCount ?? 1}</Badge>
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

      {/* 관리자 할당 · 프로비저닝 결과 */}
      {isVm && p && (
        <div className="space-y-2.5 rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Network className="size-3.5 text-sky-600" /> 할당 네트워크
          </div>
          <Field label="네트워크"><span className="font-mono">{p.networkName}</span></Field>
          <Field label="IP 방식">{ipModeLabel(p)}</Field>
          <Field label="보안그룹"><span className="font-mono">{p.securityGroups.length ? p.securityGroups.join(", ") : "—"}</span></Field>
          {r.result?.fixedIp && <Field label="고정 IP"><span className="font-mono">{r.result.fixedIp}</span></Field>}
          {r.result?.floatingIp && <Field label="Floating IP"><span className="font-mono text-brand-mint-700">{r.result.floatingIp}</span></Field>}
        </div>
      )}

      {/* 처리 결과 */}
      {(r.reviewedByName || r.rejectReason || r.errorMessage) && (
        <div className="space-y-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Clock className="size-3.5 text-muted-foreground" /> 처리 결과
          </div>
          {r.reviewedByName && <Field label="처리자">{r.reviewedByName} · <span className="font-mono">{fmtDt(r.reviewedAt ?? "")}</span></Field>}
          {r.rejectReason && <Field label="반려 사유"><span className="text-rose-600">{r.rejectReason}</span></Field>}
          {r.errorMessage && <Field label="실패 사유"><span className="text-rose-600">{r.errorMessage}</span></Field>}
        </div>
      )}
    </div>
  );
}

// IPv4 가 CIDR 범위 안의 호스트 주소인지 (네트워크·브로드캐스트 주소 제외)
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
  const { data: netData, isLoading: netLoading } = api.iaas.projectNetworks(r.projectId);
  const { data: sgData } = api.iaas.projectSecurityGroups(r.projectId);
  const networks = netData?.items ?? [];
  const sgs = sgData?.items ?? [];
  const externals = networks.filter((n) => n.kind === "external");

  const [networkId, setNetworkId] = React.useState("");
  const [fipOn, setFipOn] = React.useState(!!r.floatingIp);
  const [fipNetId, setFipNetId] = React.useState("");
  const [ipManual, setIpManual] = React.useState(false);
  const [fixedIp, setFixedIp] = React.useState("");
  const [sgNames, setSgNames] = React.useState<string[]>(["default"]);

  const net = networks.find((n) => n.id === networkId);
  const isExternal = net?.kind === "external";
  const fipNet = externals.find((n) => n.id === fipNetId) ?? externals[0];
  const ipInRange = !!net && ipInCidr(fixedIp, net.cidr);

  // 직접 입력 IP — '중복 확인' 버튼을 누른 IP 로 사용 여부 조회. 입력을 바꾸면 다시 확인해야 한다.
  const [checkedIp, setCheckedIp] = React.useState("");
  const ipCheckReady = isExternal && ipManual && ipInRange && checkedIp === fixedIp;
  const { data: ipCheck, isFetching: ipChecking } = api.iaas.ipCheck(networkId, checkedIp, ipCheckReady);
  const ipValid = !ipManual || (ipCheckReady && !ipChecking && ipCheck?.available === true);

  React.useEffect(() => {
    if (!net || !ipValid) return onChange(null);
    onChange({
      networkId: net.id,
      networkName: net.name,
      networkKind: net.kind,
      ...(isExternal
        ? { fixedIp: ipManual ? fixedIp : undefined }
        : fipOn && fipNet ? { floatingNetworkId: fipNet.id, floatingNetworkName: fipNet.name } : {}),
      securityGroups: sgNames,
    });
  }, [net, isExternal, fipOn, fipNet, ipManual, fixedIp, ipValid, sgNames, onChange]);

  const kindLabel = { project: "프로젝트", shared: "공유", external: "External" } as const;

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
        {netLoading ? <Skeleton className="h-16" /> : (
          <div className="grid gap-1.5">
            {networks.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { setNetworkId(n.id); setIpManual(false); setFixedIp(""); }}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left transition-colors",
                  networkId === n.id ? "border-primary bg-brand-indigo-50/40" : "border-border hover:bg-secondary/40",
                )}
              >
                {n.kind === "external" ? <Globe className="size-4 shrink-0 text-amber-600" /> : <Wifi className="size-4 shrink-0 text-sky-600" />}
                <span className="flex-1 font-mono text-sm">{n.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{n.cidr}</span>
                <Badge variant={n.kind === "external" ? "warning" : n.kind === "shared" ? "secondary" : "outline"} className="text-[10px]">
                  {kindLabel[n.kind]}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* IP 방식 */}
      {net && (isExternal ? (
        <div className="space-y-1.5">
          <div className="text-xs font-medium">Static IP</div>
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
                  onClick={() => setCheckedIp(fixedIp)}
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
              : ipCheck?.available ? <p className="text-xs text-brand-mint-700">사용 가능한 IP입니다.</p>
              : <p className="text-xs text-rose-500">{ipCheck?.reason ?? "IP를 확인할 수 없습니다."}</p>
          )}
        </div>
      ) : (
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
      ))}

      {/* 보안그룹 */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium">보안그룹</div>
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
                      on ? "border-primary bg-brand-indigo-50 text-brand-indigo-800" : "border-border bg-background hover:bg-secondary/40",
                    )}
                  >
                    <ShieldCheck className="size-3" /> {g.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{g.description}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
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
          {(r.volumeGb ?? 0) > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">부팅 볼륨</span>
              <span className="font-mono">{r.volumeGb} GB · Cinder 풀 할당</span>
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

// 프로비저닝 진행 사이드 시트 — 큰 단계 5개 + 세부 단계, 서버(tkt_provision_step) 폴링
function fmtSec(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function stepDurationMs(s: ProvisionStep) {
  if (!s.startedAt) return undefined;
  const end = s.endedAt ? Date.parse(s.endedAt) : Date.now();
  return end - Date.parse(s.startedAt);
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

function ProvisioningSheet({ req, open, onClose, canRetry }: {
  req: ResourceRequest | null; open: boolean; onClose: () => void; canRetry?: boolean;
}) {
  const qc = useQueryClient();
  const { data } = api.ticket.steps(open ? req?.id : undefined);
  const retry = api.ticket.retry();
  const steps = data?.items ?? [];
  const status = data?.status ?? req?.status;
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
    if (status) qc.invalidateQueries({ queryKey: ["ticket", "requests"] });
  }, [status, qc]);

  function handleRetry() {
    if (!req) return;
    retry.mutate(req.id, {
      onSuccess: () => toast.success("재시도 — 실패한 단계부터 다시 진행합니다"),
      onError: () => toast.error("재시도 실패"),
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 pr-6 text-base">
            <Server className="size-4 text-brand-indigo-600" /> 프로비저닝 진행
            <span className="ml-auto">
              {status === "provisioning" ? (
                <Badge variant="default" className="gap-1.5"><span className="size-1.5 rounded-full bg-brand-indigo-500" />진행 중</Badge>
              ) : status && <StatusBadge status={status} />}
            </span>
          </SheetTitle>
          <div className="flex items-center gap-2">
            <SheetDescription className="font-mono">
              {req && <>{req.vmName ?? req.id} · {req.projectName}</>}
            </SheetDescription>
            {(data?.attempt ?? 1) > 1 && (
              <Badge variant="secondary" className="text-[10px]">{data?.attempt}차 시도</Badge>
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
          {steps.map((s) => {
            const expanded = isOpen(s);
            const dur = stepDurationMs(s);
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
                    {s.status === "skipped" ? "건너뜀" : dur !== undefined && fmtSec(dur)}
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
                <Button size="sm" className="mt-3 h-7 gap-1.5" onClick={handleRetry} disabled={retry.isPending}>
                  <RotateCcw className="size-3.5" /> {retry.isPending ? "요청 중…" : "실패 단계부터 재시도"}
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
                {data?.result?.fixedIp && <div className="flex justify-between"><span className="text-muted-foreground">고정 IP</span><span className="font-mono">{data.result.fixedIp}</span></div>}
                {data?.result?.floatingIp && <div className="flex justify-between"><span className="text-muted-foreground">Floating IP</span><span className="font-mono">{data.result.floatingIp}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">키페어</span><span className="font-mono">{req?.keypairName ?? "미지정"}</span></div>
                {totalMs !== undefined && <div className="flex justify-between"><span className="text-muted-foreground">총 소요 시간</span><span className="font-mono">{fmtSec(totalMs)}</span></div>}
              </div>
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
  const reviewer = useAuth((s) => s.user);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [orgFilter, setOrgFilter] = React.useState("all");
  const [q, setQ] = React.useState("");

  const filters: Record<string, string> = {};
  if (statusFilter !== "all") filters.status = statusFilter;
  if (typeFilter !== "all") filters.type = typeFilter;
  if (orgFilter !== "all") filters.orgId = orgFilter;

  const { data, isLoading } = api.ticket.requests(filters) as {
    data: RequestsResp | undefined;
    isLoading: boolean;
  };
  const { data: orgData } = api.ticket.orgs();
  const reviewMutation = api.ticket.reviewRequest();

  const [detail, setDetail] = React.useState<ResourceRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [spec, setSpec] = React.useState<ProvisionSpec | null>(null);
  const [sheetReq, setSheetReq] = React.useState<ResourceRequest | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // 승인·반려 버튼 모두 상세 모달을 연다 (반려는 사유 입력 펼침)
  function openDetail(r: ResourceRequest, mode?: "reject") {
    setDetail(r);
    setRejecting(mode === "reject");
    setRejectReason("");
    setSpec(null);
    setDetailOpen(true);
  }
  function openSheet(r: ResourceRequest) {
    setSheetReq(r);
    setSheetOpen(true);
  }

  const items = (data?.items ?? []).filter(
    (r) => !q || r.requestedByName.includes(q) || r.projectName.includes(q) || r.id.includes(q),
  );

  const pending = items.filter((r) => r.status === "pending").length;
  const inProgress = items.filter((r) => ["approved", "provisioning", "completed"].includes(r.status)).length;
  const failed = items.filter((r) => r.status === "failed").length;
  const rejected = items.filter((r) => r.status === "rejected").length;

  async function review(action: "approve" | "reject") {
    if (!detail) return;
    const r = detail;
    try {
      await reviewMutation.mutateAsync({
        id: r.id,
        action,
        reason: action === "reject" ? rejectReason || undefined : undefined,
        provisionSpec: action === "approve" ? spec ?? undefined : undefined,
        reviewedBy: reviewer?.id,
        reviewedByName: reviewer?.displayName,
      });
      setDetailOpen(false);
      if (action === "approve") {
        toast.success("승인 — 프로비저닝을 시작합니다", { description: `신청 ID: ${r.id}` });
        if (r.type === "vm") openSheet({ ...r, status: "approved", provisionSpec: spec ?? undefined });
      } else {
        toast.success("반려 처리됨", { description: `신청 ID: ${r.id}` });
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message.startsWith("409") ? "고정 IP가 이미 사용 중입니다. 다른 IP를 지정하세요." : "처리 실패");
    }
  }

  const isPendingVm = detail?.status === "pending" && detail.type === "vm";

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
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="신청자·프로젝트·ID 검색…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-60 pl-9"
            />
          </div>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="조직" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 조직</SelectItem>
              {(orgData?.items ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
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
                <TableHead>조직</TableHead>
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
                const inProvision = r.type === "vm" && IN_PROVISION.includes(r.status);
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.id}</TableCell>
                    <TableCell><TypeBadge type={r.type} /></TableCell>
                    <TableCell className="text-sm">{r.orgName ?? "—"}</TableCell>
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
                            onClick={() => openDetail(r)}
                          >
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
                      ) : inProvision ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openSheet(r)}>
                          {r.status === "completed" ? <CheckCircle2 className="size-3.5" />
                            : r.status === "failed" ? <AlertCircle className="size-3.5 text-rose-600" />
                            : <Loader2 className="size-3.5 animate-spin" />}
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
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    조건에 맞는 신청이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 프로비저닝 진행 사이드 시트 */}
      <ProvisioningSheet key={sheetReq?.id} req={sheetReq} open={sheetOpen} onClose={() => setSheetOpen(false)} canRetry />

      {/* 신청 상세 — 신청 내용 확인 + 승인 설정 후 승인·반려 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              신청 상세 {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>
              {detail?.status === "pending" ? "신청 내용을 확인하고 네트워크를 지정해 승인하거나 반려하세요." : "신청 내용입니다."}
            </DialogDescription>
          </DialogHeader>
          {detail && <RequestDetailBody r={detail} />}
          {isPendingVm && <PlacementCapacity r={detail} />}
          {isPendingVm && !rejecting && <ApprovalForm key={detail.id} r={detail} onChange={setSpec} />}
          {detail?.status === "pending" && rejecting && (
            <div className="space-y-2">
              <label className="text-sm font-medium">반려 사유 <span className="text-muted-foreground">(선택)</span></label>
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
          {detail?.status === "pending" && (
            <DialogFooter>
              {rejecting ? (
                <>
                  <Button variant="outline" onClick={() => setRejecting(false)}>취소</Button>
                  <Button variant="destructive" onClick={() => review("reject")} disabled={reviewMutation.isPending}>
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
                  <Button
                    onClick={() => review("approve")}
                    disabled={reviewMutation.isPending || (detail.type === "vm" && !spec)}
                  >
                    <CheckCircle2 className="size-3.5" /> 승인 · 프로비저닝 시작
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
          {detail?.type === "vm" && IN_PROVISION.includes(detail.status) && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDetailOpen(false); openSheet(detail); }}>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
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
