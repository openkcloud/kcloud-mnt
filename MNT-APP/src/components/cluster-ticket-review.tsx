"use client";
/**
 * 서비스 클러스터 신청 상세(관리자) — 시안 design_handoff_ticket_review.
 *  1a 승인(대기중): 신청 내용 읽기 전용 → 승인·반려.
 *  1b 프로비저닝 결정(승인·실패): 왼쪽 카드(네트워크·Control Plane·Worker·키페어) + 오른쪽 피커. 노드 구성은 신청 값 그대로
 *     또는 조정, 키페어는 신청자 키(사용자 = 포털 SSH 키, 관리자 = OpenStack 키페어)·템플릿 키페어 중에서 고르고 비울 수도 있다.
 *     실패(재시도)는 지난 회차 값으로 채운다.
 * 스펙 표·키페어 표·페이지네이션·세그먼트는 신청 화면(시안 2c)과 같은 조각(cluster-node-fields).
 * 망·서브넷(DHCP·Floating IP)·쿼터·이름·키페어는 프로비저닝 요청 때 서버가 다시 확인한다(실패하면 사유가 오류로 온다).
 */
import * as React from "react";
import { AlertCircle, Boxes, Building2, CheckCircle2, FileText, FolderKanban, KeyRound, Network, RotateCcw, Server, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccelBadge, AccelTags, ChangedTag, Collapse, ExpandCard, KeypairTable, MAX_WORKERS, ManualTag, MetaGrid, NodeCard, Pager, PickerHeader,
  Radio, RefTag, SearchInput, Segment, SpecPicker, SwitchCard, TotalAccel, TotalsBlock, WorkerAccel, accelTotal, keyIcon, keyType,
  masterFlavorBlock, RequiredProgress, nodeTotals, paginate, serverIcon, specLine, useAccelModel, workerFlavorBlock, type KeyRow,
} from "@/components/cluster-node-fields";
import { useNetwork, useNovaKeypairs, useProjectFlavors, useProjectNetworks, type FlavorSummary, type NovaKeypair } from "@/lib/iaas-api";
import { useClusterTemplate, type ClusterTemplate } from "@/lib/paas-api";
import type { ProvisionClusterInput } from "@/lib/ticket-api";
import type { ClusterProvisionSpec, ResourceRequest } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export type ClusterProvisionValue = ProvisionClusterInput["provisionSpec"];

/** 이 모달로 보는 신청 — 클러스터의 대기중(1a)·승인(1b)·실패(1b 재시도). 나머지 상태는 기존 상세. */
export function isClusterReview(r: ResourceRequest) {
  return r.type === "cluster" && ["pending", "approved", "failed"].includes(r.status);
}

const TPL_KEY = "@template"; // 키페어 목록의 템플릿 키페어 행(키페어 이름·ID 와 겹치지 않는 값)

// ── 공통 ──────────────────────────────────────────────────────────

/** 망·서브넷 유형 배지 — 인터넷망(게이트웨이 IP 를 가진 라우터에 외부 게이트웨이, 외부망 자체 포함) · 내부망. */
function NetTypeBadge({ type }: { type: "internet" | "internal" }) {
  return (
    <span className={cn("w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", {
      internet: "bg-[#fdf3dc] text-[#8a5a00]", internal: "bg-[#e3f1fb] text-[#1769aa]",
    }[type])}>
      {{ internet: "인터넷망", internal: "내부망" }[type]}
    </span>
  );
}

function PurposeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[5px] border border-input px-1.5 py-px text-[11px] text-primary hover:bg-brand-indigo-50"
    >
      <FileText className="size-2.5" />보기
    </button>
  );
}

/** 용도 전체 — 부모 모달 위에 겹쳐 연다(줄바꿈 유지, 넘치면 본문만 스크롤). */
function PurposeDialog({ open, onOpenChange, clusterName, purpose }: {
  open: boolean; onOpenChange: (o: boolean) => void; clusterName?: string; purpose: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-[480px] flex-col gap-0 overflow-hidden rounded-xl p-0">
        <div className="flex items-baseline gap-2 border-b border-border/70 px-5 py-4 pr-12">
          <DialogTitle className="text-[17px] font-bold">용도</DialogTitle>
          <span className="truncate font-mono text-xs text-muted-foreground">{clusterName}</span>
        </div>
        <DialogDescription asChild className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-[1.75] whitespace-pre-wrap text-foreground">
          <div>{purpose}</div>
        </DialogDescription>
        <div className="flex justify-end border-t border-border/70 bg-secondary/30 px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 신청 정보 카드 — 클러스터명 · 조직 · 프로젝트 · 신청자 · 신청 일시. 1b 는 오른쪽에 처리 결과. */
function HeroCard({ r, compact, result }: { r: ResourceRequest; compact?: boolean; result?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-[#fafbfc] px-[18px] py-4">
      <div className={cn("flex flex-none items-center justify-center rounded-[10px] bg-brand-indigo-100/70 text-primary", compact ? "size-10" : "size-11")}>
        <Boxes className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-bold", compact ? "text-base" : "text-[17px]")}>{r.clusterName || "서비스 클러스터"}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {r.orgName && <><Building2 className="size-3" /><span>{r.orgName}</span><span className="text-muted-foreground/40">·</span></>}
          <FolderKanban className="size-3" />
          <span className="font-mono">{r.projectName}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{r.requestedByName}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono">{formatDateTime(r.requestedAt)}</span>
        </div>
      </div>
      {result && <div className="flex-none self-stretch border-l border-border pl-4 text-right">{result}</div>}
    </div>
  );
}

// 신청 키페어 표시 — 이름과 출처
function requestKeyLabel(r: ResourceRequest, template?: ClusterTemplate) {
  if (r.keypairId) return { name: r.keypairName ?? r.keypairId, from: "신청자 SSH 키" };
  if (r.novaKeypair) return { name: r.novaKeypair, from: "OpenStack 키페어" };
  return { name: template ? template.keypair_id || "키페어 없음" : "—", from: "템플릿 키페어" };
}

// 예) "NPU(RNGD) × 1" — 노드 구성의 가속기 표시와 같은 형식(모델명을 모르면 "NPU × 1")
function reqAccel(r: ResourceRequest, model: string | null) {
  return r.accelerators?.length
    ? r.accelerators.map((a) => <AccelBadge key={a.kind} kind={a.kind} model={model} count={a.count} title={r.deviceProfile ?? undefined} />)
    : r.deviceProfile ? <AccelBadge title={r.deviceProfile} /> : null;
}

// ── 1a 승인 ───────────────────────────────────────────────────────

function ApproveBody({ r, onPurpose }: { r: ResourceRequest; onPurpose: () => void }) {
  const { data: flavors = [] } = useProjectFlavors(r.projectId);
  const { data: template } = useClusterTemplate(r.templateId ?? null);
  const master = flavors.find((f) => f.id === r.masterFlavorId);
  const worker = flavors.find((f) => f.id === r.flavorId);
  const key = requestKeyLabel(r, template);
  const modelOf = useAccelModel();
  const accel = reqAccel(r, modelOf(r.deviceProfile));
  const kube = r.kubeVersion ?? r.k8sVersion;
  const nodes = { masterCount: r.masterCount ?? 1, masterFlavorId: r.masterFlavorId ?? "", accel: r.deviceProfile ?? "",
    nodeCount: r.nodeCount ?? 1, flavorId: r.flavorId ?? "" };
  const totals = nodeTotals(flavors, nodes);
  // 스펙 줄 — 프로젝트 플레이버에서(디스크 포함), 없으면 신청에 남긴 vCPU·RAM
  const line = (f: FlavorSummary | undefined, vcpu?: number, ramGb?: number) => f ? specLine(f) : vcpu ? `${vcpu} vCPU / ${ramGb} GB RAM` : "";

  const clusterRows: [string, React.ReactNode][] = [
    ["템플릿", <span key="t" className="font-mono text-[13px] font-semibold [overflow-wrap:anywhere]">{r.templateName ?? "—"}</span>],
    ["Kubernetes 버전", <span key="k" className="font-mono">{kube ? `v${kube}` : "—"}</span>],
    ["프로젝트", <span key="p" className="font-mono">{r.projectName}</span>],
    ["네임스페이스", <span key="n" className="font-mono">{r.namespace ?? "—"}</span>],
  ];
  return (
    <div className="grid gap-[14px] px-7 pt-5 pb-6">
      <HeroCard r={r} />
      <div className="grid grid-cols-2 gap-[14px]">
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border px-[18px] py-4">
          <div className="flex items-center gap-1.5 text-sm font-bold"><Boxes className="size-4 text-primary" />클러스터</div>
          {clusterRows.map(([k, v]) => (
            <div key={k} className="grid min-h-6 grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5">
              <span className="text-[13px] text-muted-foreground">{k}</span>
              <span className="text-right text-[13px]">{v}</span>
            </div>
          ))}
          <div className="grid min-h-6 grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">용도 {r.purpose && <PurposeButton onClick={onPurpose} />}</span>
            <span title={r.purpose} className="truncate text-right text-sm font-medium">{r.purpose || "—"}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border px-[18px] py-4">
          <div className="flex items-center gap-1.5 text-sm font-bold"><Server className="size-4 text-rose-600" />노드 (신청)</div>
          {([
            ["Control Plane", `${r.masterCount ?? 0} 대 / ${r.masterFlavorName ?? r.masterFlavorId ?? "—"}`, line(master, r.masterVcpu, r.masterRamGb)],
            ["Worker", `${r.nodeCount ?? 0} 대 / ${r.flavorName ?? "—"}`, line(worker, r.vcpu, r.ramGb)],
          ] as const).map(([k, v, sub]) => (
            <div key={k} className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-px text-[13px] text-muted-foreground">{k}</span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[13px] font-semibold">{v}</span>
                {sub && <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">{sub}</span>}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-px text-[13px] text-muted-foreground">Worker 가속기</span>
            <span className="flex flex-col items-end gap-0.5">
              {accel ? <span className="flex flex-wrap justify-end gap-1">{accel}</span>
                : <span className="text-[13px] text-muted-foreground">없음</span>}
            </span>
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-px text-[13px] text-muted-foreground">키페어</span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-1 font-mono text-[13px] font-semibold"><KeyRound className="size-[13px] text-amber-600" />{key.name}</span>
              <span className="text-[11px] text-muted-foreground">{key.from}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-[10px] border border-border/70 bg-secondary/50 px-4 py-[11px]">
        <span className="text-xs text-muted-foreground">총 자원</span>
        <span className="flex-1 text-right font-mono text-xs font-semibold">
          {totals
            ? <>{[`VM ${totals.vms}대`, `${totals.vcpu} vCPU`, `${totals.ramGb} GB RAM`, `${totals.diskGb} GB Disk`].join(" / ")}
              {worker?.accelerator && <> / <AccelTags f={worker} model={modelOf(worker.accelerator)} n={nodes.nodeCount} /></>}</>
            : "—"}
        </span>
      </div>
    </div>
  );
}

// ── 1b 프로비저닝 결정 ──────────────────────────────────────────

type Role = "net" | "cp" | "w" | "key";
type Src = "req" | "custom";
// 필수 스펙이 비었을 때 카드 안내 — 신청 값을 이 프로젝트에서 못 쓰면 / 직접 고를 차례면
const MISSING_LINE: Record<Src, string> = { req: "신청 스펙을 사용할 수 없습니다", custom: "필수 항목입니다. 오른쪽 목록에서 고르세요" };
type PanelState = {
  role: Role;
  net: string; subnet: string; autoNet: string; // autoNet: 이 망을 고를 때 DHCP 서브넷이 하나뿐이면 그것으로(서브넷을 직접 고르기 전까지)
  cpSrc: Src; cp: string; cpn: number;
  wSrc: Src; w: string; accel: string; wn: number;
  keySrc: Src; key: string | null;              // null = 고르지 않음
};
export type ProvisionPanelState = { spec: ClusterProvisionValue | null; ready: boolean; text: string };

const NET_COLS = "grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1.2fr)_112px] items-center gap-[14px] px-4";
const SUB_COLS = "grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_64px_56px] items-center gap-[14px] px-4";

/** 1b 본문 — 데이터(스펙·키페어·템플릿)를 받은 뒤 그려 신청(재시도면 지난 회차) 값으로 채운다. */
function ProvisionPanel({ r, onState, onPurpose }: {
  r: ResourceRequest; onState: (s: ProvisionPanelState) => void; onPurpose: () => void;
}) {
  const flavorsQ = useProjectFlavors(r.projectId);
  const keysQ = useNovaKeypairs();
  const templateQ = useClusterTemplate(r.templateId ?? null);
  const loading = flavorsQ.isLoading || keysQ.isLoading || templateQ.isLoading;
  const error = flavorsQ.error ?? keysQ.error;
  if (loading) return <Skeleton className="mx-7 mt-3.5 h-[660px] rounded-xl" />;
  if (error || !flavorsQ.data || !keysQ.data) {
    return (
      <div className="mx-7 mt-3.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        프로비저닝 설정을 불러오지 못했습니다{error ? ` (${error.message})` : ""}.
      </div>
    );
  }
  return <ProvisionPanelBody r={r} flavors={flavorsQ.data} keys={keysQ.data} template={templateQ.data} onState={onState} onPurpose={onPurpose} />;
}

function ProvisionPanelBody({ r, flavors, keys, template, onState, onPurpose }: {
  r: ResourceRequest; flavors: FlavorSummary[]; keys: NovaKeypair[]; template?: ClusterTemplate;
  onState: (s: ProvisionPanelState) => void; onPurpose: () => void;
}) {
  const networksQ = useProjectNetworks(r.projectId);
  const modelOf = useAccelModel();
  const tplKey = template?.keypair_id || null;
  const tplMissing = !!tplKey && !keys.some((k) => k.name === tplKey); // 키페어를 넘기지 않으면 Magnum 이 넣는 키 — 없으면 생성이 거절됨
  // 신청 값 — 키페어는 이름(관리자 = OpenStack 키페어, 사용자 = 포털 SSH 키 — 같은 이름의 OpenStack 키페어를 쓴다), 없으면 템플릿 키페어
  const REQ = {
    cp: r.masterFlavorId ?? "", cpn: r.masterCount ?? 1, w: r.flavorId ?? "", wn: r.nodeCount ?? 1, accel: r.deviceProfile ?? "",
    key: r.keypairName ?? (tplKey ? TPL_KEY : null),
  };
  const prev = r.status === "failed" ? (r.provisionSpec as unknown as ClusterProvisionSpec | undefined) : undefined;

  const [st, setSt] = React.useState<PanelState>(() => {
    const cp = prev?.masterFlavorId ?? REQ.cp;
    const w = prev?.flavorId ?? REQ.w;
    // 지난 회차 키페어 — 기록이 있을 때만(키페어를 바꿀 수 있게 되기 전 기록은 신청 값)
    const key = prev && "keypairName" in prev ? prev.keypairName ?? (tplKey ? TPL_KEY : null) : REQ.key;
    return {
      role: "net", net: prev?.networkId ?? "", subnet: prev?.subnetId ?? "", autoNet: "",
      cpSrc: cp === REQ.cp ? "req" : "custom", cp, cpn: prev?.masterCount ?? REQ.cpn,
      wSrc: w === REQ.w ? "req" : "custom", w, accel: w === REQ.w ? REQ.accel : flavors.find((f) => f.id === w)?.accelerator ?? "",
      wn: prev?.nodeCount ?? REQ.wn,
      keySrc: key === REQ.key ? "req" : "custom", key,
    };
  });
  const [showDetail, setShowDetail] = React.useState(false);
  const set = (o: Partial<PanelState>) => setSt((s) => ({ ...s, ...o }));

  // 실제 값 — 출처가 신청 값이면 신청 값. 키페어를 비우면 템플릿 키페어가 들어간다(서버에 키페어를 보내지 않음과 같음)
  const cp = st.cpSrc === "req" ? REQ.cp : st.cp;
  const w = st.wSrc === "req" ? REQ.w : st.w;
  const accel = st.wSrc === "req" ? REQ.accel : st.accel;
  const key = st.keySrc === "req" ? REQ.key : st.key;
  const keyApplied = key ?? (tplKey ? TPL_KEY : null);
  const cpF = flavors.find((f) => f.id === cp && !masterFlavorBlock(f));
  const wF = flavors.find((f) => f.id === w && !workerFlavorBlock(f, accel));
  const reqCpF = flavors.find((f) => f.id === REQ.cp);
  const reqWF = flavors.find((f) => f.id === REQ.w);

  // 망·서브넷 — 노드는 프로젝트·공유망. 공유된 외부망은 흐리게만 보인다(노드를 바로 붙이면 API 로드밸런서 주소에 밖에서
  // 닿지 못함 — 2026-10-22 시험). 서브넷은 DHCP 가 켜지고 인터넷망(외부 게이트웨이 라우터)인 것만 — API 에 Floating IP 를 붙인다
  const nodeNets = (networksQ.data ?? []).filter((n) => n.kind !== "external" || n.shared);
  const net = nodeNets.find((n) => n.id === st.net);
  const netBlocked = net?.kind === "external"; // 재시도 때 지난 회차 값으로 들어올 수 있다
  const { data: netDetail, isLoading: subnetLoading } = useNetwork(st.net || undefined);
  const subnets = netDetail?.id === st.net ? netDetail.subnets : [];
  const usable = (s: { dhcp: boolean; internet?: boolean }) => s.dhcp && !!s.internet;
  const usableSubnets = subnets.filter(usable);
  const subnetId = st.subnet || (st.autoNet === st.net && usableSubnets.length === 1 ? usableSubnets[0].id : "");
  const subnet = subnets.find((s) => s.id === subnetId && usable(s));
  const netName = net?.name ?? (prev?.networkId === st.net ? prev?.networkName : undefined);
  const subnetCidr = subnet?.cidr ?? (prev?.subnetId === subnetId && subnetId ? prev?.subnetCidr : undefined);

  // 키페어 행 — OpenStack(Nova) 키페어(이름으로 찾아 그대로 넣는다 — 새로 만들지 않음) + 템플릿 키페어
  const keyRows: KeyRow[] = [
    ...keys.map((k) => ({ id: k.name, name: k.name, fingerprint: k.fingerprint, type: k.type || keyType(k.publicKey) })),
    ...(tplKey ? [{ id: TPL_KEY, name: tplKey, fingerprint: tplMissing ? "템플릿 키페어 — OpenStack 에 없음" : "템플릿 키페어", type: "ssh" }] : []),
  ];
  const keyName = (k: string | null) => k === null ? "사용 안 함" : k === TPL_KEY ? tplKey ?? "—" : k;
  // 비웠을 때 실제로 들어가는 것 — 템플릿에 키페어가 있으면 Magnum 이 그것을 넣는다
  const keyNone = tplKey ? `템플릿 키페어(${tplKey})가 적용됩니다` : "노드에 SSH 키를 넣지 않습니다";
  // 신청 키(특히 사용자 포털 SSH 키)·템플릿 키 이름의 OpenStack 키페어가 없으면 넣을 수 없다 — 직접 선택으로 바꿔야 한다
  const keyMissing = (k: string | null) => k !== null && (k === TPL_KEY ? tplMissing : !keys.some((x) => x.name === k));
  const reqKeyRow: KeyRow | undefined = REQ.key === null ? undefined : keyRows.find((k) => k.id === REQ.key)
    ?? { id: REQ.key, name: REQ.key, fingerprint: "OpenStack 에 없음 — 직접 선택으로 다른 키페어를 고르세요", type: "—" };

  // 변경·완료
  const keyChanged = keyApplied !== REQ.key;
  const cpChanged = cp !== REQ.cp || st.cpn !== REQ.cpn;
  const wChanged = w !== REQ.w || st.wn !== REQ.wn || accel !== REQ.accel;
  const changes = [cp !== REQ.cp, st.cpn !== REQ.cpn, w !== REQ.w, st.wn !== REQ.wn, accel !== REQ.accel, keyChanged].filter(Boolean).length;
  // 필수 항목(네트워크·Control Plane·Worker) 진행 — 신청 화면 노드 구성과 같은 표시
  const required = [!!st.net && !netBlocked && !!subnet, !!cpF, !!wF];
  const missing = [!st.net && "네트워크", netBlocked && "네트워크(외부망)", !!st.net && !netBlocked && !subnet && "서브넷",
    !cpF && "Control Plane 스펙", !wF && "Worker 스펙",
    keyMissing(keyApplied) && "키페어(OpenStack 에 없음)"].filter((x): x is string => !!x);
  const ready = missing.length === 0;
  const keyBody = { novaKeypair: keyApplied === null || keyApplied === TPL_KEY ? null : keyApplied };
  const spec: ClusterProvisionValue | null = ready
    ? { networkId: st.net, subnetId, masterCount: st.cpn, masterFlavorId: cp, nodeCount: st.wn, flavorId: w, ...(keyChanged ? keyBody : {}) }
    : null;
  const text = ready ? `VM ${st.cpn + st.wn}대 프로비저닝 준비됨${changes ? ` · 신청 대비 변경 ${changes}건` : ""}` : `선택 필요: ${missing.join(", ")}`;
  const stateKey = JSON.stringify({ spec, ready, text });
  React.useEffect(() => { onState(JSON.parse(stateKey)); }, [stateKey, onState]);

  // 신청 값 그대로 — 세 출처가 신청 값이고 수도 신청 값일 때. 끄면 지금 값을 직접 선택 값으로 채운다
  const asReq = st.cpSrc === "req" && st.wSrc === "req" && st.keySrc === "req" && st.cpn === REQ.cpn && st.wn === REQ.wn;
  const toCustom = (r2: "cp" | "w" | "key"): Partial<PanelState> =>
    r2 === "cp" ? { cpSrc: "custom", cp } : r2 === "w" ? { wSrc: "custom", w, accel } : { keySrc: "custom", key };
  const role = st.role;
  const src = role === "cp" ? st.cpSrc : role === "w" ? st.wSrc : st.keySrc;

  const now = nodeTotals(flavors, { masterCount: st.cpn, masterFlavorId: cpF?.id ?? "", accel, nodeCount: st.wn, flavorId: wF?.id ?? "" });
  const req = nodeTotals(flavors, { masterCount: REQ.cpn, masterFlavorId: REQ.cp, accel: REQ.accel, nodeCount: REQ.wn, flavorId: REQ.w });
  const totalRow = (k: string, v?: string, reqV?: string) => ({ k, v, was: v && reqV && v !== reqV ? reqV : undefined });
  const accelNow = now && wF ? accelTotal(wF, st.wn, modelOf(wF.accelerator)) : undefined;
  const accelReq = req && reqWF ? accelTotal(reqWF, REQ.wn, modelOf(reqWF.accelerator)) : undefined;

  return (
    // 높이 660px — 시안 640px 에서 네트워크를 고른 상태(서브넷 줄) + 가속기 Worker 스펙 줄 두 줄이 레티나(카드 테두리 1.5px)에서도
    // 넘치지 않게. '변경' 줄이 생기거나 키페어를 비우면 왼쪽만 스크롤
    <div className="mx-7 mt-3.5 grid h-[660px] grid-cols-[270px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border border-border [&_*]:leading-[1.2]">
      {/* 왼쪽 — 프로비저닝 설정 카드 + 총 자원. 카드에 원래 값 줄이 생기면 길어져 넘치면 스크롤 */}
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-secondary/50 px-4 py-[18px] [scrollbar-width:thin]">
        <RequiredProgress title="프로비저닝 설정" items={required} />
        <NodeCard className="gap-2 px-3.5 py-3" icon={<Network className="size-4 text-primary" />} title="네트워크" required
          tag={<ManualTag />} status={required[0] ? "done" : "missing"} placeholder="네트워크를 고르세요"
          value={st.net ? netName ?? st.net : null}
          line={!st.net ? MISSING_LINE.custom : netBlocked ? "외부망은 쓸 수 없습니다. 다른 네트워크를 고르세요"
            : subnet && subnetCidr ? `서브넷 ${subnetCidr}` : "서브넷을 고르세요"}
          selected={role === "net"} onSelect={() => set({ role: "net" })} />
        <NodeCard className="gap-2 px-3.5 py-3" icon={serverIcon} title="Control Plane" required range="1 또는 3대" rangeAt="count"
          tag={cpChanged ? <ChangedTag /> : <RefTag label="신청 값" />} status={cpF ? "done" : "missing"} placeholder="스펙을 고르세요"
          value={cpF && `${st.cpn} 대 / ${cpF.name}`} line={cpF ? specLine(cpF) : MISSING_LINE[st.cpSrc]}
          was={cpChanged ? `${REQ.cpn} 대 / ${reqCpF?.name ?? r.masterFlavorName ?? REQ.cp}` : undefined}
          count={[st.cpn, () => set({ cpn: 1 }), () => set({ cpn: 3 })]} selected={role === "cp"} onSelect={() => set({ role: "cp" })} />
        <NodeCard className="gap-2 px-3.5 py-3" icon={serverIcon} title="Worker" required range={`1~${MAX_WORKERS}대`} rangeAt="count"
          tag={wChanged ? <ChangedTag /> : <RefTag label="신청 값" />} status={wF ? "done" : "missing"} placeholder="스펙을 고르세요"
          value={wF && `${st.wn} 대 / ${wF.name}`}
          line={wF ? <>{specLine(wF)}<WorkerAccel f={wF} model={modelOf(wF.accelerator)} /></> : MISSING_LINE[st.wSrc]}
          was={wChanged ? `${REQ.wn} 대 / ${reqWF?.name ?? r.flavorName ?? REQ.w}` : undefined}
          count={[st.wn, () => set({ wn: Math.max(1, st.wn - 1) }), () => set({ wn: Math.min(MAX_WORKERS, st.wn + 1) })]}
          selected={role === "w"} onSelect={() => set({ role: "w" })} />
        <NodeCard className="gap-2 px-3.5 py-3" icon={keyIcon} title="키페어" optional
          tag={keyChanged ? <ChangedTag /> : <RefTag label="신청 값" />} status={keyMissing(keyApplied) ? "missing" : undefined}
          value={keyName(key)} valueMuted={key === null}
          line={keyMissing(keyApplied)
            ? keyApplied === TPL_KEY ? `템플릿 키페어(${tplKey})가 OpenStack 에 없습니다. 직접 선택에서 다른 키페어를 고르세요`
              : "OpenStack 에 없는 키페어입니다. 직접 선택으로 바꾸세요"
            : key === null ? keyNone : undefined}
          was={keyChanged ? keyName(REQ.key) : undefined}
          selected={role === "key"} onSelect={() => set({ role: "key" })} />
        <TotalsBlock rows={[
          totalRow("VM", now ? `${now.vms}대` : undefined, req ? `${req.vms}대` : undefined),
          totalRow("vCPU", now ? `${now.vcpu}` : undefined, req ? `${req.vcpu}` : undefined),
          totalRow("RAM", now ? `${now.ramGb} GB` : undefined, req ? `${req.ramGb} GB` : undefined),
          totalRow("Disk", now ? `${now.diskGb} GB` : undefined, req ? `${req.diskGb} GB` : undefined),
          { ...totalRow("가속기", accelNow, accelReq), v: now && wF ? <TotalAccel f={wF} model={modelOf(wF.accelerator)} n={st.wn} /> : undefined },
        ]} />
      </div>

      {/* 오른쪽 — 넘치면 여기만 스크롤 */}
      <div className="grid min-h-0 min-w-0 auto-rows-max grid-cols-[minmax(0,1fr)] content-start gap-[14px] overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        <div className="grid grid-cols-2 gap-3">
          <SwitchCard title="신청 값 그대로" desc="신청한 노드 구성 그대로 프로비저닝합니다. 네트워크는 직접 고릅니다." checked={asReq}
            onCheckedChange={(on) => set(on ? { cpSrc: "req", wSrc: "req", keySrc: "req", cpn: REQ.cpn, wn: REQ.wn }
              : { ...toCustom("cp"), ...toCustom("w"), ...toCustom("key") })} />
          <ExpandCard title="신청 내용" sub={r.templateName ?? "—"} open={showDetail} onToggle={() => setShowDetail((o) => !o)} />
        </div>
        <Collapse open={showDetail}>
          <MetaGrid keyCol="grid-cols-[100px_minmax(0,1fr)]" groups={[
            { group: "클러스터", items: [
              { k: "템플릿", v: r.templateName ?? "—" },
              { k: "Kubernetes 버전", v: (r.kubeVersion ?? r.k8sVersion) ? `v${r.kubeVersion ?? r.k8sVersion}` : "—" },
              { k: "네임스페이스", v: r.namespace ?? "—" },
              { key: "용도", k: <span className="flex items-center gap-1.5">용도 {r.purpose && <PurposeButton onClick={onPurpose} />}</span>, v: r.purpose || "—" },
            ] },
            { group: "노드 (신청)", items: [
              { k: "Control Plane", v: `${REQ.cpn} 대 / ${r.masterFlavorName ?? REQ.cp}` },
              { k: "Worker", v: `${REQ.wn} 대 / ${r.flavorName ?? REQ.w}` },
              { k: "Worker 가속기", v: reqAccel(r, modelOf(r.deviceProfile)) ?? "없음" },
              { k: "키페어", v: REQ.key === null ? "없음" : `${keyName(REQ.key)}${REQ.key === TPL_KEY ? " (템플릿)" : ""}` },
            ] },
          ]} />
        </Collapse>

        {role === "net" ? (
          <>
            <PickerHeader title="네트워크" hint="노드를 붙일 네트워크·서브넷" />
            <div className="flex gap-2 rounded-[10px] border border-[#f6dfa4] bg-[#fff8e6] px-3.5 py-3">
              <AlertCircle className="mt-px size-3.5 flex-none text-[#b7791f]" />
              <p className="text-xs text-[#7a4f06]">노드가 OpenStack API·DNS 에 닿지 못하면 생성이 끝나지 않습니다.</p>
            </div>
            <NetworkPicker networks={nodeNets} loading={networksQ.isLoading} error={networksQ.error?.message} selected={st.net}
              onSelect={(id) => set({ net: id, subnet: id === st.net ? st.subnet : "", autoNet: id === st.net ? st.autoNet : id })} />
            <div className="mt-1 text-[15px] font-semibold">서브넷<span className="ml-0.5 text-[#d92d20]">*</span></div>
            {!st.net ? (
              <div className="rounded-[10px] border-[1.5px] border-dashed border-border p-5 text-center text-[13px] text-muted-foreground">네트워크를 먼저 고르세요</div>
            ) : (
              <>
                <div className="-mt-2 text-xs text-muted-foreground">{netName ?? st.net} 의 서브넷 · DHCP 가 켜진 인터넷망 서브넷만 고를 수 있습니다</div>
                <div className="flex flex-col overflow-hidden rounded-[10px] border border-border">
                  <div className={cn(SUB_COLS, "border-b border-border bg-secondary/50 py-[9px] text-xs text-muted-foreground")}>
                    <span /><span>CIDR</span><span>이름</span><span>유형</span><span>DHCP</span>
                  </div>
                  {subnetLoading ? <Skeleton className="m-3 h-10" /> : subnets.map((sn) => {
                    const sel = subnetId === sn.id;
                    const ok = usable(sn);
                    const why = !sn.dhcp ? "DHCP 가 꺼진 서브넷에는 노드가 주소를 받지 못합니다"
                      : !sn.internet ? "외부 게이트웨이 라우터에 연결되지 않아 클러스터 API 에 Floating IP 를 붙일 수 없습니다" : null;
                    return (
                      <div
                        key={sn.id}
                        onClick={ok ? () => set({ subnet: sn.id }) : undefined}
                        className={cn(SUB_COLS, "min-h-[46px] border-b border-border/60 py-1.5 last:border-b-0",
                          !ok ? "cursor-not-allowed bg-[#fcfcfd]" : sel ? "cursor-pointer bg-brand-indigo-50/60" : "cursor-pointer hover:bg-secondary/40")}
                      >
                        <Radio on={sel} off={!ok} />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className={cn("font-mono text-[13px] font-semibold", !ok && "text-[#9aa3ad]")}>{sn.cidr}</span>
                          {why && <span className="text-[11px] text-[#e8823f]">{why}</span>}
                        </span>
                        <span className={cn("truncate text-xs", ok ? "text-muted-foreground" : "text-[#b3bac2]")}>{sn.name || "—"}</span>
                        <NetTypeBadge type={sn.internet ? "internet" : "internal"} />
                        <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          sn.dhcp ? "bg-[#dff6ee] text-[#0f7a58]" : "bg-[#f1f3f6] text-[#7b858f]")}>{sn.dhcp ? "켜짐" : "꺼짐"}</span>
                      </div>
                    );
                  })}
                  {!subnetLoading && subnets.length === 0 && <div className="p-5 text-center text-[13px] text-muted-foreground">서브넷이 없습니다</div>}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <PickerHeader
              title={{ cp: "Control Plane 스펙", w: "Worker 스펙", key: "키페어" }[role]}
              hint={src === "req" ? "신청 값을 사용합니다"
                : { cp: "가속기 없는 스펙만 쓸 수 있습니다", w: "가속기를 고르면 맞는 스펙만 보입니다", key: "노드에 넣을 OpenStack 키페어 · 다시 누르면 선택 해제" }[role]}
            >
              <Segment options={[["req", "신청 값"], ["custom", "직접 선택"]] as const} value={src}
                onChange={(s) => set(s === "req" ? { [role === "cp" ? "cpSrc" : role === "w" ? "wSrc" : "keySrc"]: "req" } : toCustom(role))} />
            </PickerHeader>
            {role !== "key" ? (
              <SpecPicker
                key={`${role}-${src}`}
                flavors={flavors}
                role={role}
                fixed={src === "req"}
                fixedEmpty={`신청 스펙(${role === "w" ? r.flavorName ?? REQ.w : r.masterFlavorName ?? REQ.cp})을 이 프로젝트에서 쓸 수 없습니다`}
                selected={role === "w" ? w : cp}
                onSelect={(id) => set(role === "w" ? { w: id } : { cp: id })}
                accel={accel}
                onAccel={(dp) => set({ accel: dp, w: (() => { const f = flavors.find((x) => x.id === st.w); return f && !workerFlavorBlock(f, dp) ? f.id : ""; })() })}
                refLabel="신청"
                refId={role === "w" ? REQ.w : REQ.cp}
                refAccel={REQ.accel}
                compactFixed
              />
            ) : src === "req" ? (
              <KeypairTable key="key-req" rows={reqKeyRow ? [reqKeyRow] : []} selected={REQ.key} refId={REQ.key} refLabel="신청" nameCol="minmax(0,200px)"
                empty="신청 키페어가 없습니다 — 템플릿에도 키페어가 없어 노드에 SSH 키를 넣지 않습니다" />
            ) : (
              <KeypairTable key="key-custom" rows={keyRows} selected={st.key} refId={REQ.key} refLabel="신청" nameCol="minmax(0,200px)" paged
                onSelect={(id) => set({ key: st.key === id ? null : id })}
                empty="OpenStack 키페어가 없습니다" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 네트워크 표 — 검색 · 5개씩. 유형: 서브넷마다 인터넷망(게이트웨이 IP 를 가진 라우터에 외부 게이트웨이)·내부망 — 섞여 있으면
 *  둘 다. 외부망(router:external)은 '인터넷망'으로 표시하되 흐리게(고를 수 없음). 공유된 망은 이름 옆에 '공유' 태그. */
function NetworkPicker({ networks, loading, error, selected, onSelect }: {
  networks: { id: string; name: string; kind: string; cidr: string; shared?: boolean; access?: ("internet" | "internal")[] }[];
  loading: boolean; error?: string; selected: string; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState<number | null>(null);
  const q = query.trim().toLowerCase();
  const all = networks.filter((n) => n.name.toLowerCase().includes(q));
  const { rows, page: pageNow, pages } = paginate(all, page, (n) => n.id === selected);
  return (
    <>
      <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder="네트워크 이름 검색" />
      <div className="flex flex-col overflow-hidden rounded-[10px] border border-border">
        <div className={cn(NET_COLS, "border-b border-border bg-secondary/50 py-[9px] text-xs text-muted-foreground")}>
          <span /><span>이름</span><span>서브넷</span><span>유형</span>
        </div>
        <div className="h-[184px] border-b border-border/60">
          {loading ? <Skeleton className="m-3 h-20" /> : error ? (
            <div className="p-5 text-center text-[13px] text-rose-600">네트워크를 불러오지 못했습니다 ({error}).</div>
          ) : rows.map((n) => {
            const sel = selected === n.id;
            const blocked = n.kind === "external";
            return (
              <div key={n.id} onClick={blocked ? undefined : () => onSelect(n.id)}
                className={cn(NET_COLS, "h-[46px] border-b border-border/60 last:border-b-0",
                  blocked ? "cursor-not-allowed bg-[#fcfcfd]" : sel ? "cursor-pointer bg-brand-indigo-50/60" : "cursor-pointer hover:bg-secondary/40")}>
                <Radio on={sel} off={blocked} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate font-mono text-[13px] font-semibold", blocked && "text-[#9aa3ad]")}>{n.name}</span>
                    {n.shared && <span className="flex-none rounded bg-violet-100 px-[5px] py-px text-[10px] font-semibold text-violet-800">공유</span>}
                  </span>
                  {blocked && <span title="외부망에 노드를 바로 붙이면 클러스터 API 주소(로드밸런서)에 밖에서 닿지 못합니다"
                    className="truncate text-[11px] text-[#e8823f]">API 주소에 밖에서 닿지 못합니다</span>}
                </span>
                <span title={n.cidr} className="truncate font-mono text-[11px] text-muted-foreground">{n.cidr || "—"}</span>
                <span className="flex flex-wrap gap-1">
                  {blocked ? <NetTypeBadge type="internet" />
                    : n.access?.length ? n.access.map((t) => <NetTypeBadge key={t} type={t} />)
                    : <span className="text-[11px] text-muted-foreground">—</span>}
                </span>
              </div>
            );
          })}
          {!loading && !error && rows.length === 0 && <div className="p-5 text-center text-[13px] text-muted-foreground">조건에 맞는 네트워크가 없습니다</div>}
        </div>
        <Pager total={all.length} page={pageNow} pages={pages} onPage={setPage} />
      </div>
    </>
  );
}

// ── 모달 ──────────────────────────────────────────────────────────

/**
 * 클러스터 신청 상세 모달 내용(DialogContent) — 대기중이면 1a(승인·반려), 승인·실패면 1b(프로비저닝·재시도·반려).
 * 반려는 사유 입력을 펼친다(사유 필수). 1b 의 입력 상태는 반려 입력 중에도 숨겨 둘 뿐 유지한다.
 */
export function ClusterReviewContent({ r, badge, reviewing, provisioning, onApprove, onReject, onProvision }: {
  r: ResourceRequest;
  badge: React.ReactNode;
  reviewing: boolean;
  provisioning: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onProvision: (spec: ClusterProvisionValue) => void;
}) {
  const isPending = r.status === "pending";
  const isFailed = r.status === "failed";
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [purposeOpen, setPurposeOpen] = React.useState(false);
  const [panel, setPanel] = React.useState<ProvisionPanelState>({ spec: null, ready: false, text: "" });

  return (
    <DialogContent
      className={cn("max-h-[95vh] gap-0 overflow-y-auto rounded-[14px] p-0 outline-none", isPending ? "max-w-[760px]" : "max-w-[1000px]")}
      onOpenAutoFocus={(e) => e.preventDefault()} // 첫 버튼(용도 보기)에 포커스 테두리가 생기지 않게 — Tab 이동·Esc 는 그대로
    >
      <div className="px-7 pt-6 pr-12">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">신청 상세 {badge}</DialogTitle>
        <DialogDescription className="mt-1.5 text-sm">
          {isPending ? "신청 내용을 확인하고 승인하거나 반려하세요."
            : isFailed ? "프로비저닝 설정을 확인·수정해 재시도하거나 반려하세요. 실패한 회차의 클러스터는 삭제되었습니다(정리 실패면 실패 사유에 표시)."
            : "노드를 붙일 네트워크·서브넷을 고르고 노드 구성을 확인·조정한 뒤 프로비저닝하거나 반려하세요."}
        </DialogDescription>
      </div>

      {isPending ? (
        !rejecting && <ApproveBody r={r} onPurpose={() => setPurposeOpen(true)} />
      ) : (
        <>
          <div className="mx-7 mt-4">
            <HeroCard r={r} compact result={r.approvedByName && (
              <>
                <div className="text-[11px] text-muted-foreground">처리 결과</div>
                <div className="mt-1 text-xs font-semibold">
                  승인 · {r.approvedByName} · <span className="font-mono font-medium">{formatDateTime(r.approvedAt)}</span>
                </div>
              </>
            )} />
          </div>
          {isFailed && r.errorMessage && (
            <div className="mx-7 mt-3 flex gap-2 rounded-[10px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              <XCircle className="mt-px size-3.5 flex-none" /><span className="whitespace-pre-line">실패 사유: {r.errorMessage}</span>
            </div>
          )}
          <div className={cn(rejecting && "hidden")}>
            <ProvisionPanel r={r} onState={setPanel} onPurpose={() => setPurposeOpen(true)} />
          </div>
        </>
      )}

      {rejecting && (
        <div className="mx-7 mt-4 space-y-2">
          <label className="text-sm font-medium">반려 사유 <span className="text-rose-500">(필수)</span></label>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
            placeholder="예: 프로젝트 쿼터 초과, 가속기 미할당 등"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div className={cn("flex items-center gap-2 border-t border-border bg-[#fafbfc] px-7 py-3.5", isPending && !rejecting ? "" : "mt-[18px]")}>
        <span className={cn("flex-1 text-[13px]", panel.ready ? "text-[#0f7a58]" : "text-[#d92d20]")}>
          {!isPending && !rejecting && panel.text}
        </span>
        {rejecting ? (
          <>
            <Button variant="outline" onClick={() => setRejecting(false)}>취소</Button>
            <Button variant="destructive" onClick={() => onReject(reason.trim())} disabled={reviewing || !reason.trim()}>
              <XCircle className="size-3.5" /> 반려 확정
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setRejecting(true)}>
              <XCircle className="size-3.5" /> 반려
            </Button>
            {isPending ? (
              <Button onClick={onApprove} disabled={reviewing}><CheckCircle2 className="size-3.5" /> 승인</Button>
            ) : (
              <Button onClick={() => panel.spec && onProvision(panel.spec)} disabled={!panel.spec || provisioning}>
                {isFailed ? <RotateCcw className="size-3.5" /> : <Boxes className="size-3.5" />}
                {provisioning ? "시작 중…" : isFailed ? "재시도" : "프로비저닝"}
              </Button>
            )}
          </>
        )}
      </div>

      <PurposeDialog open={purposeOpen} onOpenChange={setPurposeOpen} clusterName={r.clusterName} purpose={r.purpose ?? ""} />
    </DialogContent>
  );
}
