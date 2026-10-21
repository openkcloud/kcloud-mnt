"use client";
/**
 * 서비스 클러스터 노드 구성 입력 — Control Plane(수·스펙) · Worker 가속기 · Worker(수·스펙).
 * 사용자 신청(자원 신청 모달)과 관리자 프로비저닝(신청 관리 상세)이 같은 규칙으로 쓴다(서버 POST /tickets/cluster 확인과 같음).
 *  - Control Plane: 가속기 스펙은 고를 수 없다.
 *  - Worker: 고른 가속기(device-profile)와 다른 스펙은 고를 수 없다(흐리게 + 사유). 가속기를 바꿔 고른 스펙이 맞지 않으면 비운다.
 *  - 수: Control Plane 1 또는 3, Worker 1~20(0 은 애드온이 배치되지 않아 완성되지 않는다).
 * 신청 화면은 ClusterNodeConfigPanel(시안 2c — 항목별 직접 선택/템플릿 값 + 키페어), 관리자 화면은 ClusterNodeFields.
 */
import * as React from "react";
import { CheckCircle2, ChevronDown, Cpu, KeyRound, Search, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { accKindClass, cn } from "@/lib/utils";
import type { FlavorSummary } from "@/lib/iaas-api";
import type { ClusterTemplate } from "@/lib/paas-api";
import type { SshKey } from "@/lib/sshkey-api";

export interface ClusterNodes {
  masterCount: number;
  masterFlavorId: string;
  accel: string;           // Worker 가속기 device-profile — 없음 = ""
  nodeCount: number;
  flavorId: string;        // Worker 플레이버
}

export const MAX_WORKERS = 20;

// 예) "NPU × 1" — 종류를 모르면 "가속기"
function accelText(f: FlavorSummary) {
  return (f.accelerators ?? []).map((a) => `${a.kind} × ${a.count}`).join(" + ") || "가속기";
}

/** 가속기 선택지 — 프로젝트 플레이버들에 달린 device-profile(Cyborg 에 있는 것). */
export function accelOptions(flavors: FlavorSummary[]) {
  const seen = new Map<string, string>();
  for (const f of flavors) if (f.accelerator && !f.deviceProfileMissing && !seen.has(f.accelerator)) seen.set(f.accelerator, accelText(f));
  return [...seen].map(([dp, label]) => ({ dp, label }));
}

export function masterFlavorBlock(f: FlavorSummary): string | null {
  return f.accelerator ? "Control Plane 에는 가속기 스펙을 쓸 수 없습니다" : null;
}

export function workerFlavorBlock(f: FlavorSummary, accel: string): string | null {
  if (f.deviceProfileMissing) return "연결된 디바이스 프로파일이 존재하지 않습니다";
  if (!accel) return f.accelerator ? "가속기가 있는 스펙" : null;
  if (!f.accelerator) return "가속기가 없는 스펙";
  return f.accelerator === accel ? null : `선택한 가속기와 다른 스펙 (${f.accelerator})`;
}

export function nodesValid(v: ClusterNodes) {
  return [1, 3].includes(v.masterCount) && v.nodeCount >= 1 && v.nodeCount <= MAX_WORKERS && !!v.masterFlavorId && !!v.flavorId;
}

/** 합계 — VM 수·vCPU·RAM(GB)·Disk(GB). 스펙을 아직 안 골랐으면 null. */
export function nodeTotals(flavors: FlavorSummary[], v: ClusterNodes) {
  const m = flavors.find((f) => f.id === v.masterFlavorId);
  const w = flavors.find((f) => f.id === v.flavorId);
  if (!m || !w) return null;
  return {
    vms: v.masterCount + v.nodeCount,
    vcpu: v.masterCount * m.vcpus + v.nodeCount * w.vcpus,
    ramGb: (v.masterCount * m.ramMb + v.nodeCount * w.ramMb) / 1024,
    diskGb: v.masterCount * m.diskGb + v.nodeCount * w.diskGb,
  };
}

export function ClusterNodeFields({ flavors, value, onChange }: {
  flavors: FlavorSummary[];
  value: ClusterNodes;
  onChange: (v: ClusterNodes) => void;
}) {
  const accels = accelOptions(flavors);
  const accelLabel = accels.find((a) => a.dp === value.accel)?.label;
  const worker = flavors.find((f) => f.id === value.flavorId);
  const totals = nodeTotals(flavors, value);

  function selectAccel(dp: string) {
    onChange({ ...value, accel: dp, flavorId: worker && !workerFlavorBlock(worker, dp) ? worker.id : "" });
  }

  return (
    <div className="space-y-4">
      {/* Control Plane */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label>Control Plane</Label>
          <Counter value={value.masterCount} onChange={(n) => onChange({ ...value, masterCount: n })} min={1} max={3} step={2} hint="1 또는 3 (HA)" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {flavors.map((f) => (
            <FlavorOption key={f.id} f={f} selected={value.masterFlavorId === f.id} block={masterFlavorBlock(f)}
                          onSelect={() => onChange({ ...value, masterFlavorId: f.id })} />
          ))}
        </div>
      </div>

      {/* Worker — 가속기 먼저 */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label>Worker</Label>
          <Counter value={value.nodeCount} onChange={(n) => onChange({ ...value, nodeCount: n })} min={1} max={MAX_WORKERS} hint={`1~${MAX_WORKERS}대`} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">가속기</span>
          {[{ dp: "", label: "없음" }, ...accels].map((a) => (
            <Button key={a.dp || "none"} type="button" size="sm" variant={value.accel === a.dp ? "default" : "outline"} className="h-7 gap-1"
                    onClick={() => selectAccel(a.dp)}>
              {a.dp && <Cpu className="size-3" />}{a.label}
              {a.dp && <span className="font-mono text-[10px] opacity-70">{a.dp}</span>}
            </Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {flavors.map((f) => (
            <FlavorOption key={f.id} f={f} selected={value.flavorId === f.id} block={workerFlavorBlock(f, value.accel)}
                          onSelect={() => onChange({ ...value, flavorId: f.id })} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
        합계 {totals ? `VM ${totals.vms}대 · ${totals.vcpu} vCPU · ${totals.ramGb} GB RAM` : "— (스펙을 고르세요)"}
        {totals && value.accel && worker && ` · 가속기 ${accelLabel} × Worker ${value.nodeCount}대`}
      </div>
    </div>
  );
}

function FlavorOption({ f, selected, block, onSelect }: {
  f: FlavorSummary; selected: boolean; block: string | null; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!!block}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors",
        block && "cursor-not-allowed opacity-50",
        selected ? "border-primary bg-brand-indigo-50/40" : !block && "hover:bg-secondary/40",
      )}
    >
      <Server className="size-4 shrink-0 text-rose-600" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm font-semibold">{f.name}</span>
          {(f.accelerators ?? []).map((a) => (
            <Badge key={a.kind} variant="ghost" className={cn("h-5 shrink-0 gap-1 px-1.5 font-mono text-[10px]", accKindClass(a.kind))}>
              <Cpu className="size-3" />{a.kind} × {a.count}
            </Badge>
          ))}
          {f.accelerator && !f.accelerators?.length && (
            <Badge variant="ghost" className={cn("h-5 shrink-0 gap-1 px-1.5 font-mono text-[10px]", accKindClass(""))}><Cpu className="size-3" />가속기</Badge>
          )}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {f.vcpus} vCPU · {f.ramMb / 1024} GB RAM · {f.diskGb} GB Disk
        </div>
        {block && <div className="text-[11px] text-amber-700">{block}</div>}
      </div>
      {selected && <CheckCircle2 className="size-4 shrink-0 text-brand-mint-600" />}
    </button>
  );
}

function Counter({ value, onChange, min, max, step = 1, hint }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</Button>
      <span className="w-6 text-center font-mono text-base font-bold tabular-nums">{value}</span>
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</Button>
    </div>
  );
}

// ── 신청 화면 노드 구성(시안 2c) ─────────────────────────────────
// 왼쪽 = 노드 카드(Control Plane·Worker·키페어, 클릭하면 오른쪽 대상이 바뀜) + 총 자원, 오른쪽 = 템플릿 상세·템플릿 그대로 생성 +
// 대상의 선택 목록(스펙 표 또는 키페어 표). 본문 높이는 고정이고 오른쪽만 스크롤한다.

export type NodeRole = "cp" | "w" | "key";
export type NodeSource = "custom" | "tpl";

/** 신청 화면 노드 구성 — 항목별로 직접 고른 값 또는 템플릿 값. 노드 수는 템플릿에 없어 항상 직접 정한다. */
export interface ClusterNodeConfig {
  source: Record<NodeRole, NodeSource>;
  masterCount: number;
  masterFlavorId: string;  // 직접 선택 값
  accel: string;           // 직접 선택 값 — 없음 = ""
  nodeCount: number;
  flavorId: string;        // 직접 선택 값
  keypairId: string;       // 직접 선택 값 — 본인 SSH 키(iam_ssh_key.id)
}

export const EMPTY_NODE_CONFIG: ClusterNodeConfig = {
  source: { cp: "custom", w: "custom", key: "custom" },
  masterCount: 1, masterFlavorId: "", accel: "", nodeCount: 1, flavorId: "", keypairId: "",
};

type TemplateNodeRefs = Pick<ClusterTemplate, "master_flavor_id" | "flavor_id">;

// 템플릿 플레이버 값은 이름 또는 ID
function findFlavor(flavors: FlavorSummary[], ref: string | null | undefined) {
  return ref ? flavors.find((f) => f.id === ref || f.name === ref) : undefined;
}

/** 템플릿 값 — 템플릿 플레이버를 이 프로젝트에서 쓸 수 없으면(목록에 없음·규칙 위반) 빈 값. Worker 가속기는 그 플레이버의 것. */
function templateNodes(flavors: FlavorSummary[], t: TemplateNodeRefs) {
  const m = findFlavor(flavors, t.master_flavor_id);
  const w = findFlavor(flavors, t.flavor_id);
  const accel = w && !w.deviceProfileMissing ? w.accelerator ?? "" : "";
  return {
    masterFlavorId: m && !masterFlavorBlock(m) ? m.id : "",
    accel,
    flavorId: w && !workerFlavorBlock(w, accel) ? w.id : "",
  };
}

/** 실제로 신청할 노드 — 항목이 템플릿 값이면 템플릿 플레이버, 아니면 고른 값. Worker 템플릿 값은 가속기도 템플릿 값. */
export function effectiveNodes(flavors: FlavorSummary[], cfg: ClusterNodeConfig, t: TemplateNodeRefs): ClusterNodes {
  const tv = templateNodes(flavors, t);
  return {
    masterCount: cfg.masterCount,
    masterFlavorId: cfg.source.cp === "tpl" ? tv.masterFlavorId : cfg.masterFlavorId,
    accel: cfg.source.w === "tpl" ? tv.accel : cfg.accel,
    nodeCount: cfg.nodeCount,
    flavorId: cfg.source.w === "tpl" ? tv.flavorId : cfg.flavorId,
  };
}

/** 빠진 항목 이름 — 키페어 템플릿 값은 템플릿에 키페어가 없어도(노드 SSH 미설정) 그대로 쓴다. */
export function nodeConfigMissing(nodes: ClusterNodes, cfg: ClusterNodeConfig): string[] {
  return [
    !nodes.masterFlavorId && "Control Plane 스펙",
    !nodes.flavorId && "Worker 스펙",
    cfg.source.key === "custom" && !cfg.keypairId && "키페어",
  ].filter((x): x is string => !!x);
}

type SortKey = "cpu" | "ram" | "disk" | "name";
const SORTS: Record<SortKey, (a: FlavorSummary, b: FlavorSummary) => number> = {
  cpu: (a, b) => a.vcpus - b.vcpus || a.ramMb - b.ramMb,
  ram: (a, b) => a.ramMb - b.ramMb || a.vcpus - b.vcpus,
  disk: (a, b) => a.diskGb - b.diskGb || a.vcpus - b.vcpus,
  name: (a, b) => a.name.localeCompare(b.name),
};
const PER_PAGE = 5;
const SPEC_COLS = "grid grid-cols-[22px_minmax(0,1fr)_96px_96px_96px] items-center gap-[14px] px-4";
const KEY_COLS = "grid grid-cols-[22px_minmax(0,180px)_minmax(0,1fr)_70px] items-center gap-[14px] px-4";

function specLine(f: FlavorSummary) {
  return `${f.vcpus} vCPU / ${f.ramMb / 1024} GB RAM / ${f.diskGb} GB Disk`;
}

// 공개키 앞부분의 알고리즘 — ssh-ed25519 → ed25519, ecdsa-sha2-nistp256 → ecdsa
function keyType(k: SshKey) {
  return k.publicKey.split(" ")[0].replace(/^ssh-/, "").replace(/-.*$/, "");
}

/** 템플릿 상세 — 이 화면에서 바꾸는 항목(키 페어·Flavor·마스터 Flavor)은 뺀다. */
function templateMeta(t: ClusterTemplate): { group: string; items: [string, string][] }[] {
  const yn = (b: boolean) => (b ? "예" : "아니오");
  const v = (x: string | null) => x || "—";
  const labels = Object.entries(t.labels ?? {});
  return [
    { group: "클러스터 유형", items: [["COE", t.coe], ["클러스터 Distro", v(t.cluster_distro)], ["서버 유형", v(t.server_type)],
      ["공용", yn(t.public)], ["저장소가 사용됨", yn(t.registry_enabled)], ["TLS 가 사용되지 않음", yn(t.tls_disabled)]] },
    { group: "노드 사양", items: [["이미지 ID", v(t.image_id)], ["키 페어", v(t.keypair_id)], ["Flavor ID", v(t.flavor_id)],
      ["마스터 Flavor ID", v(t.master_flavor_id)], ["볼륨 드라이버", v(t.volume_driver)]] },
    { group: "네트워크", items: [["네트워크 드라이버", v(t.network_driver)], ["외부 네트워크 ID", v(t.external_network_id)],
      ["고정 네트워크", v(t.fixed_network)], ["Fixed 서브넷", v(t.fixed_subnet)],
      ["마스터 LB 활성화됨", yn(t.master_lb_enabled)], ["Floating IP 활성화됨", yn(t.floating_ip_enabled)]] },
    { group: "레이블", items: labels.length ? labels : [["—", ""]] },
  ];
}

export function ClusterNodeConfigPanel({ flavors, keypairs, template, value, onChange }: {
  flavors: FlavorSummary[];
  keypairs: SshKey[];
  template: ClusterTemplate;
  value: ClusterNodeConfig;
  onChange: (v: ClusterNodeConfig) => void;
}) {
  const [role, setRole] = React.useState<NodeRole>("cp");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cpu", dir: 1 });
  const [page, setPage] = React.useState(0);
  const [showUnavailable, setShowUnavailable] = React.useState(false);
  const [showMeta, setShowMeta] = React.useState(false);

  const src = value.source;
  const isTpl = src[role] === "tpl";
  const isSpec = role !== "key";
  const allTpl = Object.values(src).every((s) => s === "tpl");
  const nodes = effectiveNodes(flavors, value, template);
  const tv = templateNodes(flavors, template);
  const tplWorker = findFlavor(flavors, template.flavor_id);
  const masterF = flavors.find((f) => f.id === nodes.masterFlavorId);
  const workerF = flavors.find((f) => f.id === nodes.flavorId);
  const keyName = src.key === "tpl" ? template.keypair_id : keypairs.find((k) => k.id === value.keypairId)?.name;
  const totals = nodeTotals(flavors, nodes);

  function selectRole(r: NodeRole) {
    setRole(r);
    setQuery("");
    setShowUnavailable(false);
    setPage(0);
  }
  function setSource(r: NodeRole, s: NodeSource) {
    onChange({ ...value, source: { ...src, [r]: s } });
    setPage(0);
  }
  function selectAccel(dp: string) {
    const cur = flavors.find((f) => f.id === value.flavorId);
    onChange({ ...value, accel: dp, flavorId: cur && !workerFlavorBlock(cur, dp) ? cur.id : "" });
    setPage(0);
  }
  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    setPage(0);
  }

  // 스펙 표 — 직접 선택이면 쓸 수 있는 스펙(검색·정렬·5개씩), 템플릿 값이면 템플릿 스펙 한 줄
  const blockOf = (f: FlavorSummary) => (role === "w" ? workerFlavorBlock(f, value.accel) : masterFlavorBlock(f));
  const cmp = (a: FlavorSummary, b: FlavorSummary) => sort.dir * SORTS[sort.key](a, b);
  const q = query.trim().toLowerCase();
  const tplId = role === "w" ? tv.flavorId : tv.masterFlavorId;
  const rowsAll = !isSpec ? [] : isTpl ? flavors.filter((f) => f.id === tplId)
    : flavors.filter((f) => !blockOf(f) && f.name.toLowerCase().includes(q)).sort(cmp);
  const pages = Math.max(1, Math.ceil(rowsAll.length / PER_PAGE));
  const pageNow = Math.min(page, pages - 1);
  const rows = rowsAll.slice(pageNow * PER_PAGE, pageNow * PER_PAGE + PER_PAGE);
  const unavailable = isSpec ? flavors.filter((f) => blockOf(f)).sort(cmp) : [];
  const selectedSpec = role === "w" ? nodes.flavorId : nodes.masterFlavorId;
  const max = {
    cpu: Math.max(1, ...flavors.map((f) => f.vcpus)),
    ram: Math.max(1, ...flavors.map((f) => f.ramMb)),
    disk: Math.max(1, ...flavors.map((f) => f.diskGb)),
  };
  const tplRef = role === "w" ? template.flavor_id : template.master_flavor_id;
  const tplMissing = !tplRef ? "템플릿에 스펙이 없습니다"
    : `템플릿 스펙(${tplRef})을 이 프로젝트에서 쓸 수 없습니다${findFlavor(flavors, tplRef) ? ` — ${blockOf(findFlavor(flavors, tplRef)!)}` : ""}`;

  const accelTotal = !workerF ? "" : workerF.accelerators?.length
    ? workerF.accelerators.map((a) => `${a.kind} × ${a.count * nodes.nodeCount}`).join(" + ")
    : workerF.accelerator ? `가속기 × ${nodes.nodeCount}` : "없음";
  const cards: { k: NodeRole; title: string; range: string; value?: string | null; line?: string; count?: [number, () => void, () => void] }[] = [
    { k: "cp", title: "Control Plane", range: "1 또는 3대", value: masterF?.name, line: masterF && specLine(masterF),
      count: [value.masterCount, () => onChange({ ...value, masterCount: 1 }), () => onChange({ ...value, masterCount: 3 })] },
    { k: "w", title: "Worker", range: `1~${MAX_WORKERS}대`, value: workerF?.name,
      line: workerF && specLine(workerF) + (workerF.accelerator ? ` / ${accelText(workerF)}` : ""),
      count: [value.nodeCount, () => onChange({ ...value, nodeCount: Math.max(1, value.nodeCount - 1) }),
        () => onChange({ ...value, nodeCount: Math.min(MAX_WORKERS, value.nodeCount + 1) })] },
    { k: "key", title: "키페어", range: "",
      value: src.key === "tpl" ? (template.keypair_id || "키페어 없음") : keyName,
      line: src.key === "tpl" && !template.keypair_id ? "노드 SSH 미설정" : keyName ? "SSH 접속에 사용" : undefined },
  ];

  return (
    <div className="grid h-[601px] grid-cols-[270px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border border-border [&_*]:leading-[1.2]">
      {/* 왼쪽 — 노드 카드 + 총 자원. 높이 601px 은 가장 긴 경우(가속기 Worker 스펙 줄이 두 줄)에 맞춘 값(시안 587px 이면 넘침), 그보다 길면 스크롤 */}
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto border-r border-border bg-secondary/50 px-4 py-6 [scrollbar-width:thin]">
        <div className="px-1 pb-1.5 text-[17px] font-bold">노드 구성</div>
        {cards.map((c) => (
          <div
            key={c.k}
            role="button"
            tabIndex={0}
            onClick={() => selectRole(c.k)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectRole(c.k)}
            className={cn(
              "flex cursor-pointer flex-col gap-2.5 rounded-[10px] border-[1.5px] bg-card p-3.5 transition-[border-color,box-shadow] duration-150",
              role === c.k ? "border-primary shadow-[0_4px_12px_rgba(31,58,122,.12)]" : "border-border",
            )}
          >
            <div className="flex items-center gap-1.5">
              {c.k === "key" ? <KeyRound className="size-4 text-amber-600" /> : <Server className="size-4 text-rose-600" />}
              <span className="flex-1 whitespace-nowrap text-sm font-semibold">{c.title}</span>
              {src[c.k] === "tpl" && <TplTag />}
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">{c.range}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span title={c.value ?? undefined} className={cn("truncate font-mono text-[13px] font-semibold", !c.value && "text-orange-700")}>{c.value || "선택 필요"}</span>
              {c.line && <span className="text-xs text-muted-foreground">{c.line}</span>}
            </div>
            {c.count && (
              <div className="flex items-center gap-2">
                <div className="flex items-center overflow-hidden rounded-[7px] border border-input bg-card" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={c.count[1]} className="h-7 w-7 cursor-pointer text-[15px] text-muted-foreground hover:bg-secondary">−</button>
                  <span className="w-[30px] text-center font-mono text-[13px] font-semibold tabular-nums">{c.count[0]}</span>
                  <button type="button" onClick={c.count[2]} className="h-7 w-7 cursor-pointer text-[15px] text-muted-foreground hover:bg-secondary">+</button>
                </div>
                <span className="text-xs text-muted-foreground">대</span>
              </div>
            )}
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-2 border-t border-border px-1 pt-3.5">
          <div className="text-xs text-muted-foreground">총 자원</div>
          {([["vCPU", totals && `${totals.vcpu}`], ["RAM", totals && `${totals.ramGb} GB`], ["Disk", totals && `${totals.diskGb} GB`],
            ["가속기", totals && accelTotal]] as const).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[13px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-mono font-semibold">{v || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽 — 넘치면 여기만 스크롤 */}
      <div className="grid min-h-0 min-w-0 auto-rows-max grid-cols-[minmax(0,1fr)] content-start gap-[14px] overflow-y-auto p-6 [scrollbar-width:thin]">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowMeta((o) => !o)}
            className="flex min-w-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-border px-4 py-3.5 text-left hover:bg-secondary/50"
          >
            <span className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold">템플릿 상세</span>
              <span className="text-xs text-primary">{showMeta ? "접기" : "펼치기"}</span>
              <ChevronDown className={cn("size-3 text-primary transition-transform duration-300", showMeta && "rotate-180")} />
            </span>
            <span className="font-mono text-xs break-all text-muted-foreground">{template.name}</span>
          </button>
          <div className="flex min-w-0 items-center gap-3.5 rounded-[10px] border border-border px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="text-sm font-semibold">템플릿 그대로 생성</span>
              <span className="text-xs text-muted-foreground">템플릿 사양 그대로 생성합니다.</span>
            </div>
            <Switch
              checked={allTpl}
              onCheckedChange={(on) => { onChange({ ...value, source: on ? { cp: "tpl", w: "tpl", key: "tpl" } : { cp: "custom", w: "custom", key: "custom" } }); setPage(0); }}
              className="data-[state=checked]:bg-brand-mint-500"
              aria-label="템플릿 그대로 생성"
            />
          </div>
        </div>

        {/* 템플릿 상세 — 접힘/펼침 */}
        <div
          aria-hidden={!showMeta}
          className={cn(
            "-mt-[14px] grid transition-[grid-template-rows,opacity] duration-[350ms] ease-[cubic-bezier(.3,.7,.3,1)]",
            showMeta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pt-[14px]">
              <div className="grid grid-cols-2 gap-x-6 gap-y-[14px] rounded-[10px] border border-border bg-secondary/50 px-4 py-3.5">
                {templateMeta(template).map((g) => (
                  <div key={g.group} className="flex min-w-0 flex-col gap-1">
                    <div className="text-xs font-bold">{g.group}</div>
                    {g.items.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 text-[11px]">
                        <span title={k} className="truncate text-muted-foreground">{k}</span>
                        <span title={v} className="truncate font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 대상 헤더 + 직접 선택/템플릿 값 */}
        <div className="mt-1 flex items-center gap-2">
          <div className="text-[15px] font-semibold">{{ cp: "Control Plane 스펙", w: "Worker 스펙", key: "키페어" }[role]}</div>
          <div className="flex-1 text-xs text-muted-foreground">
            {isTpl ? "템플릿 값을 사용합니다"
              : { cp: "가속기 없는 스펙만 쓸 수 있습니다", w: "가속기를 고르면 맞는 스펙만 보입니다", key: "노드에 주입할 SSH 키페어" }[role]}
          </div>
          <div className="flex flex-none gap-0.5 rounded-lg bg-secondary p-[3px]">
            {([["custom", "직접 선택"], ["tpl", "템플릿 값"]] as const).map(([s, label]) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(role, s)}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-[5px] text-xs",
                  src[role] === s ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,.12)]" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isSpec && !isTpl && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-input px-2.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                placeholder="스펙 이름 검색"
                className="flex-1 bg-transparent text-[13px] outline-none"
              />
            </div>
            <select
              value={sort.key}
              onChange={(e) => { setSort({ key: e.target.value as SortKey, dir: 1 }); setPage(0); }}
              className="h-9 rounded-lg border border-input bg-card px-2 text-[13px]"
            >
              <option value="cpu">vCPU 순</option>
              <option value="ram">RAM 순</option>
              <option value="disk">Disk 순</option>
              <option value="name">이름 순</option>
            </select>
          </div>
        )}

        {role === "w" && !isTpl && (
          <div className="flex flex-wrap gap-1.5">
            {[{ dp: "", label: "없음" }, ...accelOptions(flavors)].map((a) => {
              const on = value.accel === a.dp;
              return (
                <button
                  key={a.dp || "none"}
                  type="button"
                  onClick={() => selectAccel(a.dp)}
                  className={cn(
                    "flex cursor-pointer items-center gap-[5px] rounded-full border px-[9px] py-[5px] text-xs",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                  )}
                >
                  <span className="font-semibold">{a.label}</span>
                  {a.dp && <span className="font-mono text-[11px] opacity-80">{a.dp}</span>}
                  {tplWorker && (tplWorker.accelerator ?? "") === a.dp && (
                    <span className="rounded border border-current px-1 text-[10px] opacity-85">템플릿</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isSpec && (
          <div className="flex flex-col overflow-hidden rounded-[10px] border border-border">
            <div className={cn(SPEC_COLS, "border-b border-border bg-secondary/50 py-[9px]")}>
              <span />
              {([["name", "스펙"], ["cpu", "vCPU"], ["ram", "RAM"], ["disk", "Disk"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => sortBy(k)}
                  className={cn("flex cursor-pointer items-center gap-1 text-left text-xs hover:text-foreground",
                    sort.key === k ? "font-semibold text-primary" : "text-muted-foreground")}
                >
                  {label}<span className="w-2 text-[10px]">{sort.key === k ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                </button>
              ))}
            </div>
            <div className="h-[230px] border-b border-border/60">
              {rows.map((f) => {
                const sel = selectedSpec === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={isTpl ? undefined : () => onChange(role === "w" ? { ...value, flavorId: f.id } : { ...value, masterFlavorId: f.id })}
                    className={cn(SPEC_COLS, "h-[46px] border-b border-border/60", isTpl ? "cursor-default" : "cursor-pointer",
                      sel ? "bg-brand-indigo-50/60" : !isTpl && "hover:bg-secondary/40")}
                  >
                    <Radio on={sel} />
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[13px] font-semibold">{f.name}</span>
                      <AccelTags f={f} />
                      {f.id === tplId && <TplTag />}
                    </span>
                    <Bar label={`${f.vcpus} vCPU`} ratio={f.vcpus / max.cpu} color="bg-[#7d93c9]" />
                    <Bar label={`${f.ramMb / 1024} GB RAM`} ratio={f.ramMb / max.ram} color="bg-[#5fc9a5]" />
                    <Bar label={`${f.diskGb} GB Disk`} ratio={f.diskGb / max.disk} color="bg-[#c3a0e0]" />
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="p-5 text-center text-[13px] text-muted-foreground">{isTpl ? tplMissing : "조건에 맞는 스펙이 없습니다"}</div>
              )}
            </div>
            {!isTpl && (
              <>
                <div className="flex items-center gap-1 border-b border-border/60 py-2 pr-3 pl-4">
                  <span className="flex-1 text-xs text-muted-foreground">총 {rowsAll.length} 개 · 현재페이지 {pageNow + 1}/{pages}</span>
                  <PageButton onClick={() => setPage(Math.max(0, pageNow - 1))} dim={pageNow === 0}>‹</PageButton>
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className={cn("h-7 min-w-7 cursor-pointer rounded-md font-mono text-xs",
                        i === pageNow ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <PageButton onClick={() => setPage(Math.min(pages - 1, pageNow + 1))} dim={pageNow === pages - 1}>›</PageButton>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUnavailable((o) => !o)}
                  className="flex w-full cursor-pointer justify-between bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground"
                >
                  <span>사용할 수 없는 스펙 {unavailable.length}개</span>
                  <span>{showUnavailable ? "접기" : "보기"}</span>
                </button>
                {showUnavailable && unavailable.map((f) => (
                  <div key={f.id} className={cn(SPEC_COLS, "min-h-[46px] cursor-not-allowed border-t border-border/60 bg-secondary/30 py-1.5")}>
                    <span className="size-4 rounded-full border-[1.6px] border-border bg-secondary" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[13px] font-semibold text-muted-foreground/70">{f.name}</span>
                        <span className="opacity-60"><AccelTags f={f} /></span>
                      </span>
                      <span className="text-[11px] text-orange-500">{blockOf(f)}</span>
                    </span>
                    <Bar label={`${f.vcpus} vCPU`} ratio={f.vcpus / max.cpu} color="bg-[#7d93c9]" dim />
                    <Bar label={`${f.ramMb / 1024} GB RAM`} ratio={f.ramMb / max.ram} color="bg-[#5fc9a5]" dim />
                    <Bar label={`${f.diskGb} GB Disk`} ratio={f.diskGb / max.disk} color="bg-[#c3a0e0]" dim />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 키페어 표 — 직접 선택은 본인 SSH 키, 템플릿 값은 템플릿 키페어 한 줄 */}
        {role === "key" && (
          <div className="flex flex-col overflow-hidden rounded-[10px] border border-border">
            <div className={cn(KEY_COLS, "border-b border-border bg-secondary/50 py-[9px] text-xs text-muted-foreground")}>
              <span /><span>이름</span><span>지문(FINGERPRINT)</span><span>타입</span>
            </div>
            {isTpl ? (
              template.keypair_id ? (
                <div className={cn(KEY_COLS, "h-[46px] cursor-default border-b border-border/60 bg-brand-indigo-50/60")}>
                  <Radio on />
                  <KeyName name={template.keypair_id} tpl />
                  <span className="font-mono text-[11px] text-muted-foreground">—</span>
                  <span className="font-mono text-xs text-muted-foreground">ssh</span>
                </div>
              ) : (
                <div className="p-5 text-center text-[13px] text-muted-foreground">템플릿에 키페어가 없습니다 — 노드에 SSH 키를 넣지 않습니다</div>
              )
            ) : keypairs.length === 0 ? (
              <div className="p-5 text-center text-[13px] text-muted-foreground">
                등록된 키페어가 없습니다. <span className="font-semibold">키페어</span> 메뉴에서 생성할 수 있습니다.
              </div>
            ) : keypairs.map((k) => {
              const sel = value.keypairId === k.id;
              return (
                <div
                  key={k.id}
                  onClick={() => onChange({ ...value, keypairId: k.id })}
                  className={cn(KEY_COLS, "h-[46px] cursor-pointer border-b border-border/60",
                    sel ? "bg-brand-indigo-50/60" : "hover:bg-secondary/40")}
                >
                  <Radio on={sel} />
                  <KeyName name={k.name} />
                  <span title={k.fingerprint} className="truncate font-mono text-[11px] text-muted-foreground">{k.fingerprint}</span>
                  <span className="font-mono text-xs text-muted-foreground">{keyType(k)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TplTag() {
  return <span className="whitespace-nowrap rounded bg-brand-indigo-100/70 px-[5px] py-px text-[10px] font-semibold text-primary">템플릿</span>;
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cn("flex size-4 items-center justify-center rounded-full border-[1.6px]", on ? "border-primary" : "border-muted-foreground/40")}>
      {on && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

function AccelTags({ f }: { f: FlavorSummary }) {
  if (!f.accelerator) return null;
  const list = f.accelerators?.length ? f.accelerators : [{ kind: "", count: 0 }];
  return list.map((a) => (
    <span key={a.kind || "acc"} className={cn("rounded px-1.5 py-px font-mono text-[11px] whitespace-nowrap", accKindClass(a.kind))}>
      {a.kind ? `${a.kind} × ${a.count}` : "가속기"}
    </span>
  ));
}

function Bar({ label, ratio, color, dim }: { label: string; ratio: number; color: string; dim?: boolean }) {
  return (
    <span className={cn("flex flex-col gap-1", dim && "opacity-55")}>
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className="h-1 overflow-hidden rounded-sm bg-secondary">
        <span className={cn("block h-full", color)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </span>
    </span>
  );
}

function KeyName({ name, tpl }: { name: string; tpl?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <KeyRound className="size-3.5 flex-none text-amber-600" />
      <span className="truncate font-mono text-[13px] font-semibold">{name}</span>
      {tpl && <TplTag />}
    </span>
  );
}

function PageButton({ onClick, dim, children }: { onClick: () => void; dim: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("size-7 cursor-pointer rounded-md text-[15px] text-muted-foreground hover:bg-secondary", dim && "opacity-30")}>
      {children}
    </button>
  );
}
