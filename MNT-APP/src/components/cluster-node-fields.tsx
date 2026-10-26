"use client";
/**
 * 서비스 클러스터 노드 구성 입력 — Control Plane(수·스펙) · Worker 가속기 · Worker(수·스펙) · 키페어.
 * 사용자 신청(자원 신청 모달)과 관리자 프로비저닝(신청 상세)이 같은 규칙으로 쓴다(서버 POST /tickets/cluster 확인과 같음).
 *  - Control Plane: 가속기 스펙은 고를 수 없다.
 *  - Worker: 고른 가속기(device-profile)와 다른 스펙은 고를 수 없다(흐리게 + 사유). 가속기를 바꿔 고른 스펙이 맞지 않으면 비운다.
 *  - 수: Control Plane 1 또는 3, Worker 1~20(0 은 애드온이 배치되지 않아 완성되지 않는다).
 * 신청 화면은 ClusterNodeConfigPanel(시안 2c), 관리자 화면은 cluster-ticket-review(시안 1b) — 아래 공용 조각(노드 카드·세그먼트·
 * 스펙 표·키페어 표·페이지네이션 등)을 함께 쓴다.
 */
import * as React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Cpu, KeyRound, Search, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { accKindClass, cn } from "@/lib/utils";
import { accelLabelResolver, useAccelModels, useDeviceProfiles, type FlavorSummary } from "@/lib/iaas-api";
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

/** device-profile → 가속기 모델명(RNGD·ATOM·A30 … — IaaS 가속기 장치 현황과 같은 매핑). 모르면 null. */
export function useAccelModel() {
  const { data: profiles } = useDeviceProfiles();
  const { data: models } = useAccelModels();
  const label = accelLabelResolver(profiles, models);
  return (dp: string | null | undefined) => {
    const m = label(dp);
    return m && m !== dp ? m : null;
  };
}

/** 가속기 선택지 — 프로젝트 플레이버들에 달린 device-profile(Cyborg 에 있는 것)을 종류·모델·노드당 개수로 푼 것. */
export interface AccelChoice { dp: string; kind: string; model: string; count: string }
export function accelChoices(flavors: FlavorSummary[], modelOf: (dp: string) => string | null): AccelChoice[] {
  const seen = new Map<string, AccelChoice>();
  for (const f of flavors) {
    if (!f.accelerator || f.deviceProfileMissing || seen.has(f.accelerator)) continue;
    const list = f.accelerators ?? [];
    seen.set(f.accelerator, {
      dp: f.accelerator,
      kind: list.map((a) => a.kind).join("+") || "가속기",
      model: modelOf(f.accelerator) ?? "모델 미상",
      count: list.map((a) => a.count).join("+") || "?",
    });
  }
  return [...seen.values()];
}

/** 같은 가속기 묶음인지 — 종류·모델·노드당 개수가 같으면 프로파일이 달라도 같다(신청 화면 — 사용자는 프로파일을 몰라도 된다). */
export function accelGroup(choices: AccelChoice[]) {
  const key = new Map(choices.map((c) => [c.dp, `${c.kind}|${c.model}|${c.count}`]));
  return (a: string, b: string) => a === b || (key.has(a) && key.get(a) === key.get(b));
}

export function masterFlavorBlock(f: FlavorSummary): string | null {
  return f.accelerator ? "Control Plane 에는 가속기 스펙을 쓸 수 없습니다" : null;
}

/** Worker 로 쓸 수 없는 이유 — same 은 가속기(device-profile) 비교(기본 = 같은 프로파일, 신청 화면 = 같은 묶음 accelGroup). */
export function workerFlavorBlock(f: FlavorSummary, accel: string, same: (a: string, b: string) => boolean = (a, b) => a === b): string | null {
  if (f.deviceProfileMissing) return "연결된 디바이스 프로파일이 존재하지 않습니다";
  if (!accel) return f.accelerator ? "가속기가 있는 스펙" : null;
  if (!f.accelerator) return "가속기가 없는 스펙";
  return same(f.accelerator, accel) ? null : "선택한 가속기와 다른 스펙";
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

/** Worker 가속기 합계 — 예) "NPU(RNGD) × 3". 가속기가 없으면 "없음". */
export function accelTotal(worker: FlavorSummary, nodeCount: number, model?: string | null) {
  return worker.accelerators?.length
    ? worker.accelerators.map((a) => `${a.kind}${model ? `(${model})` : ""} × ${a.count * nodeCount}`).join(" + ")
    : worker.accelerator ? `가속기 × ${nodeCount}` : "없음";
}

export function specLine(f: FlavorSummary) {
  return `${f.vcpus} vCPU / ${f.ramMb / 1024} GB RAM / ${f.diskGb} GB Disk`;
}

// 공개키 앞부분의 알고리즘 — ssh-ed25519 → ed25519, ecdsa-sha2-nistp256 → ecdsa
export function keyType(publicKey: string) {
  return publicKey.split(" ")[0].replace(/^ssh-/, "").replace(/-.*$/, "");
}

// ── 공용 조각 ─────────────────────────────────────────────────────

export const PER_PAGE = 4; // 표 본문 높이 h-[184px] = 4줄 × 46px

/** 한 쪽 rows — 페이지가 줄어 범위를 넘으면 마지막 페이지. page 가 null(쪽을 아직 넘기지 않음)이면 골라진 행이 있는 쪽. */
export function paginate<T>(all: T[], page: number | null, isSelected?: (row: T) => boolean) {
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const at = page ?? Math.max(0, Math.floor(all.findIndex((r) => !!isSelected?.(r)) / PER_PAGE));
  const now = Math.min(at, pages - 1);
  return { rows: all.slice(now * PER_PAGE, now * PER_PAGE + PER_PAGE), page: now, pages };
}

/** 기준 값 태그 — "템플릿"(신청 화면) · "신청"(관리자 화면). */
export function RefTag({ label }: { label: string }) {
  return <span className="whitespace-nowrap rounded bg-brand-indigo-100/70 px-[5px] py-px text-[10px] font-semibold text-primary">{label}</span>;
}

export function ChangedTag() {
  return <span className="whitespace-nowrap rounded bg-[#fdf0e3] px-[5px] py-px text-[10px] font-semibold text-[#9a4a0b]">변경</span>;
}

/** 스위치(템플릿 그대로 · 신청 값 그대로)와 무관하게 항상 직접 고르는 항목(네트워크). */
export function ManualTag() {
  return <span className="whitespace-nowrap rounded bg-secondary px-[5px] py-px text-[10px] font-semibold text-muted-foreground">직접 선택</span>;
}

export function Radio({ on, off }: { on: boolean; off?: boolean }) {
  return (
    <span className={cn("flex size-4 items-center justify-center rounded-full border-[1.6px]",
      on ? "border-primary" : off ? "border-border bg-secondary" : "border-muted-foreground/40")}>
      {on && <span className="size-2 rounded-full bg-primary" />}
    </span>
  );
}

/** 가속기 배지 — [아이콘] NPU(모델명) × N, 종류를 모르면 '가속기'. 신청 목록·신청·승인 화면 공용. */
export function AccelBadge({ kind, model, count, title }: { kind?: string; model?: string | null; count?: number; title?: string }) {
  return (
    <Badge variant="ghost" title={title} className={cn("h-5 w-fit shrink-0 gap-1 px-1.5 font-mono text-[10px]", accKindClass(kind))}>
      <Cpu className="size-3" />{kind ? `${kind}${model ? `(${model})` : ""} × ${count}` : "가속기"}
    </Badge>
  );
}

/** 플레이버의 가속기 배지 — n 은 노드 수(총 자원). */
export function AccelTags({ f, model, n = 1 }: { f: FlavorSummary; model: string | null; n?: number }) {
  if (!f.accelerator) return null;
  const list = f.accelerators?.length ? f.accelerators : [{ kind: "", count: 0 }];
  return list.map((a) => <AccelBadge key={a.kind || "acc"} kind={a.kind} model={model} count={a.count * n} title={f.accelerator ?? undefined} />);
}

/** 노드 카드 스펙 줄 아래 가속기 배지 — 가속기 스펙일 때만. */
export function WorkerAccel({ f, model }: { f: FlavorSummary; model: string | null }) {
  return f.accelerator ? <span className="mt-1 flex flex-wrap gap-1"><AccelTags f={f} model={model} /></span> : null;
}

/** 총 자원의 가속기 — 노드 수만큼 곱한 배지, 없으면 '없음'. */
export function TotalAccel({ f, model, n }: { f: FlavorSummary; model: string | null; n: number }) {
  return f.accelerator ? <span className="flex flex-wrap justify-end gap-1"><AccelTags f={f} model={model} n={n} /></span> : "없음";
}

/** 스펙 표의 스펙명 칸 — 1행 스펙명(+기준 태그), 2행 가속기 NPU(모델명) × N, 3행 사유(쓸 수 없는 스펙). */
function SpecNameCell({ f, model, tag, reason, dim }: {
  f: FlavorSummary; model: string | null; tag?: React.ReactNode; reason?: string | null; dim?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("truncate font-mono text-[13px] font-semibold", dim && "text-muted-foreground/70")}>{f.name}</span>
        {tag}
      </span>
      {f.accelerator && <span className={cn("flex flex-wrap gap-1", dim && "opacity-60")}><AccelTags f={f} model={model} /></span>}
      {reason && <span className="text-[11px] text-orange-500">{reason}</span>}
    </span>
  );
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

function PageButton({ onClick, dim, title, children }: { onClick: () => void; dim: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={dim ? undefined : onClick} title={title} aria-label={title}
      className={cn("size-7 rounded-md text-[15px] text-muted-foreground", dim ? "cursor-default opacity-30" : "cursor-pointer hover:bg-secondary")}>
      {children}
    </button>
  );
}

const PAGE_GROUP = 5; // 페이지 번호는 5개씩 묶어 보인다

/** 페이지네이션 줄 — "총 N 개 · 현재페이지 p/P"  « ‹ 1 2 3 4 5 › ». 번호는 현재 페이지가 속한 5개 묶음만,
 *  5쪽이 넘으면 « » 로 앞·뒤 묶음의 첫 쪽으로 간다. */
export function Pager({ total, page, pages, onPage }: { total: number; page: number; pages: number; onPage: (p: number) => void }) {
  const start = Math.floor(page / PAGE_GROUP) * PAGE_GROUP;
  const end = Math.min(pages, start + PAGE_GROUP);
  return (
    <div className="flex items-center gap-1 border-b border-border/60 py-2 pr-3 pl-4">
      <span className="flex-1 text-xs text-muted-foreground">총 {total} 개 · 현재페이지 {page + 1}/{pages}</span>
      {pages > PAGE_GROUP && <PageButton onClick={() => onPage(start - PAGE_GROUP)} dim={start === 0} title="이전 5페이지">«</PageButton>}
      <PageButton onClick={() => onPage(Math.max(0, page - 1))} dim={page === 0}>‹</PageButton>
      {Array.from({ length: end - start }, (_, k) => start + k).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPage(i)}
          className={cn("h-7 min-w-7 cursor-pointer rounded-md font-mono text-xs",
            i === page ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
        >
          {i + 1}
        </button>
      ))}
      <PageButton onClick={() => onPage(Math.min(pages - 1, page + 1))} dim={page === pages - 1}>›</PageButton>
      {pages > PAGE_GROUP && <PageButton onClick={() => onPage(end)} dim={end === pages} title="다음 5페이지">»</PageButton>}
    </div>
  );
}

/** 검색 입력(높이 36px) — children 은 오른쪽에 붙는 것(정렬 선택 등). */
export function SearchInput({ value, onChange, placeholder, children }: {
  value: string; onChange: (v: string) => void; placeholder: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-input px-2.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-[13px] outline-none" />
      </div>
      {children}
    </div>
  );
}

/** [A | B] 세그먼트. */
export function Segment<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-none gap-0.5 rounded-lg bg-secondary p-[3px]">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-[5px] text-xs",
            value === v ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,.12)]" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 오른쪽 피커 머리 — 제목 · 힌트 · 오른쪽(세그먼트 등). */
export function PickerHeader({ title, hint, children }: { title: React.ReactNode; hint: string; children?: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="flex-1 text-xs text-muted-foreground">{hint}</div>
      {children}
    </div>
  );
}

/** 왼쪽 노드 카드 — 누르면 오른쪽 피커 대상이 바뀐다. 범위 문구는 머리(신청 화면) 또는 수량 줄 끝(관리자 화면).
 *  status(신청 화면): done = 초록 체크, missing = 빨간 카드 + 느낌표(값 자리에 placeholder). optional = '옵션' 태그. */
export function NodeCard({ icon, title, required, optional, tag, range, rangeAt = "head", value, valueMuted, placeholder = "선택 필요",
  line, was, count, status, selected, onSelect, className }: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  optional?: boolean;
  tag?: React.ReactNode;
  range?: string;
  rangeAt?: "head" | "count";
  value?: string | null;
  valueMuted?: boolean;                      // 값이 '사용 안 함' 같은 안내 — 흐린 보통 글자
  placeholder?: string;                      // 값이 없을 때(빨간 글자)
  line?: React.ReactNode;
  was?: string;                              // 바꾸기 전 값(취소선)
  count?: [number, () => void, () => void];  // [수, −, +]
  status?: "done" | "missing";
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const missing = status === "missing";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      className={cn(
        "flex flex-none cursor-pointer flex-col gap-2.5 rounded-[10px] border-[1.5px] p-3.5 transition-[border-color,background-color] duration-150",
        // 테두리 색은 important — globals.css 의 레이어 밖 `* { border-color }` 가 Tailwind 유틸리티(@layer)를 이긴다
        selected ? "border-primary!" : missing ? "border-[#f1aca5]!" : "border-border hover:border-primary/40!",
        missing ? "bg-[#fff5f4]" : selected ? "bg-brand-indigo-50/50" : "bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn("flex flex-1 items-center gap-1.5 whitespace-nowrap text-sm font-semibold", missing && "text-[#b42318]")}>
          <span>{title}{required && <span className="ml-0.5 text-[#d92d20]">*</span>}</span>
          {optional && <span className="rounded bg-[#eceff3] px-[5px] py-px text-[10px] font-semibold text-[#5b6470]">옵션</span>}
        </span>
        {tag}
        {range && rangeAt === "head" && <span className="whitespace-nowrap text-[11px] text-muted-foreground">{range}</span>}
        {status === "done" && <CheckCircle2 className="size-[18px] flex-none fill-brand-mint-500 text-white" />}
        {missing && <AlertCircle className="size-[18px] flex-none fill-[#d92d20] text-white" />}
        {selected && <ChevronRight className="-mr-1 size-4 flex-none text-primary" />}
      </div>
      <div className="flex flex-col gap-0.5">
        {value ? (
          <span title={value} className={cn("truncate text-[13px]", valueMuted ? "text-muted-foreground" : "font-mono font-semibold")}>{value}</span>
        ) : (
          <span className="text-[13px] font-semibold text-[#d92d20]">{placeholder}</span>
        )}
        {line && <span className={cn("text-xs", missing ? "text-[#d92d20]" : "text-muted-foreground")}>{line}</span>}
        {was && <span title={was} className="truncate font-mono text-[11px] text-[#9aa3ad] line-through">신청 {was}</span>}
      </div>
      {count && (
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-[7px] border border-input bg-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={count[1]} className="h-7 w-7 cursor-pointer text-[15px] text-muted-foreground hover:bg-secondary">−</button>
            <span className="w-[30px] text-center font-mono text-[13px] font-semibold tabular-nums">{count[0]}</span>
            <button type="button" onClick={count[2]} className="h-7 w-7 cursor-pointer text-[15px] text-muted-foreground hover:bg-secondary">+</button>
          </div>
          <span className="flex-1 text-xs text-muted-foreground">대</span>
          {range && rangeAt === "count" && <span className="whitespace-nowrap text-[11px] text-muted-foreground">{range}</span>}
        </div>
      )}
    </div>
  );
}

/** 노드 구성 머리 — 제목 + '필수 n/m 완료' + 필수 항목별 진행 막대(고르면 초록). 신청 화면·관리자 화면 공용. */
export function RequiredProgress({ title, items }: { title: string; items: boolean[] }) {
  return (
    <>
      <div className="flex items-baseline justify-between px-1">
        <span className="text-[17px] font-bold">{title}</span>
        <span className="text-xs text-muted-foreground">필수 <b className="text-foreground">{items.filter(Boolean).length}/{items.length}</b> 완료</span>
      </div>
      <div className="mb-1 grid gap-1.5 px-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((ok, i) => <span key={i} className={cn("h-1 rounded-full", ok ? "bg-brand-mint-500" : "bg-border")} />)}
      </div>
    </>
  );
}

export const serverIcon = <Server className="size-4 text-rose-600" />;
export const keyIcon = <KeyRound className="size-4 text-amber-600" />;

/** 왼쪽 아래 총 자원 — was 가 있으면 바뀐 값(신청 값 취소선 + 주황 글자). */
export function TotalsBlock({ rows }: { rows: { k: string; v?: React.ReactNode; was?: string }[] }) {
  return (
    <div className="mt-auto flex flex-none flex-col gap-2 border-t border-border px-1 pt-3.5">
      <div className="text-xs text-muted-foreground">총 자원</div>
      {rows.map(({ k, v, was }) => (
        <div key={k} className="flex items-center gap-2 text-[13px]">
          <span className="flex-1 text-muted-foreground">{k}</span>
          {was && <span className="font-mono text-[11px] text-[#9aa3ad] line-through">{was}</span>}
          <span className={cn("font-mono font-semibold", was && "text-[#9a4a0b]")}>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
}

/** 펼치기 카드(템플릿 상세 · 신청 내용) — 1행 제목 + 펼치기/접기, 2행 템플릿명. */
export function ExpandCard({ title, sub, open, onToggle }: { title: string; sub: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex min-w-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-border px-4 py-3.5 text-left hover:bg-secondary/50"
    >
      <span className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <span className="text-xs text-primary">{open ? "접기" : "펼치기"}</span>
        <ChevronDown className={cn("size-3 text-primary transition-transform duration-300", open && "rotate-180")} />
      </span>
      <span className="font-mono text-xs break-all text-muted-foreground">{sub}</span>
    </button>
  );
}

/** 스위치 카드(템플릿 그대로 생성 · 신청 값 그대로). */
export function SwitchCard({ title, desc, checked, onCheckedChange }: {
  title: string; desc: string; checked: boolean; onCheckedChange: (on: boolean) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-[10px] border border-border px-4 py-3.5">
      <div className="flex flex-1 flex-col gap-[3px]">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs break-keep text-muted-foreground">{desc}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-brand-mint-500" aria-label={title} />
    </div>
  );
}

/** 펼침 패널 — 접힌 높이 0 ↔ 내용 높이(그리드 행 애니메이션). 오른쪽 영역 gap(14px)을 접혀 있을 때 없앤다. */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "-mt-[14px] grid transition-[grid-template-rows,opacity] duration-[350ms] ease-[cubic-bezier(.3,.7,.3,1)]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="pt-[14px]">{children}</div>
      </div>
    </div>
  );
}

/** 그룹별 키-값 2열 표(템플릿 상세 · 신청 내용). 키·값이 길면 말줄임 + title. */
export function MetaGrid({ groups, keyCol = "grid-cols-[120px_minmax(0,1fr)]" }: {
  groups: { group: string; items: { k: React.ReactNode; v: React.ReactNode; key?: string }[] }[];
  keyCol?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-[14px] rounded-[10px] border border-border bg-secondary/50 px-4 py-3.5">
      {groups.map((g) => (
        <div key={g.group} className="flex min-w-0 flex-col gap-1">
          <div className="text-xs font-bold">{g.group}</div>
          {g.items.map(({ k, v, key }) => (
            <div key={key ?? String(k)} className={cn("grid gap-2 text-[11px]", keyCol)}>
              <span title={typeof k === "string" ? k : undefined} className="truncate text-muted-foreground">{k}</span>
              <span title={typeof v === "string" ? v : undefined} className="truncate font-mono">{v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 가속기 칩 — 고르면 남색 테두리·바탕, 기준 값이면 태그. */
function AccelChip({ on, onClick, tag, title, children }: {
  on: boolean; onClick: () => void; tag?: React.ReactNode; title?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-[7px] text-[13px]",
        on ? "border-primary! bg-brand-indigo-50 font-semibold text-primary" : "bg-card hover:bg-secondary/60")}>
      {children}{tag}
    </button>
  );
}

/**
 * Worker 가속기 고르기(펼치기·접기, 처음엔 펼침) — 가속기 종류 → 모델 → 노드당 개수(showProfile 이면 같은 셋인 프로파일이 여럿일 때
 * 프로파일까지 — 관리자 화면). 값은 device-profile 하나: 위 단계를 바꾸면 아래는 기준 값(refAccel) → 지금 값과 같은 모델·개수 →
 * 첫 번째 순으로 채운다. 기준 값과 같은 칩에는 refLabel 태그.
 */
function AccelPicker({ choices, accel, onAccel, refAccel, refLabel, showProfile }: {
  choices: AccelChoice[]; accel: string; onAccel: (dp: string) => void; refAccel?: string; refLabel: string; showProfile: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  const cur = choices.find((c) => c.dp === accel);
  const ref = choices.find((c) => c.dp === refAccel);
  const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const tag = (match: boolean) => (match ? <RefTag label={refLabel} /> : undefined);
  function pick(match: (c: AccelChoice) => boolean) {
    const cands = choices.filter(match);
    const c = cands.find((x) => x.dp === refAccel) ?? cands.find((x) => cur && x.model === cur.model && x.count === cur.count)
      ?? cands.find((x) => cur && x.count === cur.count) ?? cands[0];
    if (c) onAccel(c.dp);
  }
  const sameKind = (c: AccelChoice) => !!cur && c.kind === cur.kind;
  const sameModel = (c: AccelChoice) => sameKind(c) && c.model === cur!.model;
  const sameCount = (c: AccelChoice) => sameModel(c) && c.count === cur!.count;
  const profiles = showProfile ? choices.filter(sameCount) : [];
  const row = (label: string, chips: React.ReactNode) => (
    <>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{chips}</div>
    </>
  );
  const summary = cur ? `${cur.kind}(${cur.model}) × ${cur.count}` : accel === "" ? "없음" : "—";
  return (
    <div className="rounded-[10px] border border-border bg-secondary/30">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left">
        <span className="text-sm font-semibold">가속기</span>
        <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{summary}</span>
        <span className="text-xs text-primary">{open ? "접기" : "펼치기"}</span>
        <ChevronDown className={cn("size-3 text-primary transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-[350ms] ease-[cubic-bezier(.3,.7,.3,1)]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-t border-border px-4 py-3">
      {row("가속기 종류", <>
        <AccelChip on={accel === ""} onClick={() => onAccel("")} tag={tag(refAccel === "")}>없음</AccelChip>
        {uniq(choices.map((c) => c.kind)).map((k) => (
          <AccelChip key={k} on={cur?.kind === k} onClick={() => pick((c) => c.kind === k)} tag={tag(ref?.kind === k)}>{k}</AccelChip>
        ))}
      </>)}
      {cur && row("모델", uniq(choices.filter(sameKind).map((c) => c.model)).map((m) => (
        <AccelChip key={m} on={cur.model === m} onClick={() => pick((c) => sameKind(c) && c.model === m)}
          tag={tag(!!ref && sameKind(ref) && ref.model === m)}>{m}</AccelChip>
      )))}
      {cur && row("노드당 개수", uniq(choices.filter(sameModel).map((c) => c.count)).map((n) => (
        <AccelChip key={n} on={cur.count === n} onClick={() => pick((c) => sameModel(c) && c.count === n)}
          tag={tag(!!ref && sameModel(ref) && ref.count === n)}>{n}개</AccelChip>
      )))}
      {/* 종류·모델·개수가 같은 프로파일이 여럿일 때만(관리자 화면) — 어느 프로파일인지 고른다 */}
      {profiles.length > 1 && row("프로파일", profiles.map((c) => (
        <AccelChip key={c.dp} on={accel === c.dp} onClick={() => onAccel(c.dp)} tag={tag(refAccel === c.dp)}>
          <span className="font-mono text-xs">{c.dp}</span>
        </AccelChip>
      )))}
          </div>
        </div>
      </div>
    </div>
  );
}

type SortKey = "cpu" | "ram" | "disk" | "name";
const SORTS: Record<SortKey, (a: FlavorSummary, b: FlavorSummary) => number> = {
  cpu: (a, b) => a.vcpus - b.vcpus || a.ramMb - b.ramMb,
  ram: (a, b) => a.ramMb - b.ramMb || a.vcpus - b.vcpus,
  disk: (a, b) => a.diskGb - b.diskGb || a.vcpus - b.vcpus,
  name: (a, b) => a.name.localeCompare(b.name),
};
const SPEC_COLS = "grid grid-cols-[22px_minmax(0,1fr)_96px_96px_96px] items-center gap-[14px] px-4";

/**
 * 스펙 피커 — 직접 선택이면 검색·(Worker)가속기 칩·스펙 표(5개씩)·사용할 수 없는 스펙, 기준 값(fixed)이면 기준 스펙 한 줄(클릭 불가).
 * 오른쪽 영역 그리드의 자식들로 펼쳐진다. 검색어·정렬·페이지는 안에서 갖고, 대상(역할·출처)이 바뀌면 부모가 key 로 새로 그린다.
 */
export function SpecPicker({ flavors, role, fixed, fixedEmpty, selected, onSelect, accel, onAccel, refLabel, refId, refAccel,
  sortSelect, compactFixed, groupAccel }: {
  flavors: FlavorSummary[];
  role: "cp" | "w";
  fixed: boolean;
  fixedEmpty?: string;        // 기준 스펙이 목록에 없을 때 문구
  selected: string;
  onSelect: (id: string) => void;
  accel: string;              // Worker 직접 선택 가속기
  onAccel: (dp: string) => void;
  refLabel: string;           // 기준 값 태그("템플릿" | "신청")
  refId: string;              // 기준 스펙 — 태그가 붙고, fixed 면 이 한 줄
  refAccel?: string;          // 기준 가속기(칩 태그) — 없으면 태그 없음
  sortSelect?: boolean;       // 검색 옆 정렬 선택
  compactFixed?: boolean;     // fixed 면 표 높이를 한 줄로
  groupAccel?: boolean;       // 가속기를 종류·모델·개수 묶음으로(프로파일 줄 없음) — 신청 화면
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cpu", dir: 1 });
  const [page, setPage] = React.useState<number | null>(null);
  const [showUnavailable, setShowUnavailable] = React.useState(false);
  const modelOf = useAccelModel();
  const choices = accelChoices(flavors, modelOf);
  const same = groupAccel ? accelGroup(choices) : undefined;

  const blockOf = (f: FlavorSummary) => (role === "w" ? workerFlavorBlock(f, accel, same) : masterFlavorBlock(f));
  const cmp = (a: FlavorSummary, b: FlavorSummary) => sort.dir * SORTS[sort.key](a, b);
  const q = query.trim().toLowerCase();
  const all = fixed ? flavors.filter((f) => f.id === refId)
    : flavors.filter((f) => !blockOf(f) && f.name.toLowerCase().includes(q)).sort(cmp);
  const { rows, page: pageNow, pages } = paginate(all, page, (f) => f.id === selected);
  const unavailable = fixed ? [] : flavors.filter((f) => blockOf(f)).sort(cmp);
  const max = {
    cpu: Math.max(1, ...flavors.map((f) => f.vcpus)),
    ram: Math.max(1, ...flavors.map((f) => f.ramMb)),
    disk: Math.max(1, ...flavors.map((f) => f.diskGb)),
  };
  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    setPage(0);
  }

  return (
    <>
      {!fixed && (
        <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder="스펙 이름 검색">
          {sortSelect && (
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
          )}
        </SearchInput>
      )}

      {role === "w" && !fixed && (
        <AccelPicker choices={choices} accel={accel} onAccel={(dp) => { onAccel(dp); setPage(0); }}
          refAccel={refAccel} refLabel={refLabel} showProfile={!groupAccel} />
      )}

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
        <div className={cn("border-b border-border/60", fixed && compactFixed ? "" : "h-[184px]")}>
          {rows.map((f) => {
            const sel = selected === f.id;
            return (
              <div
                key={f.id}
                onClick={fixed ? undefined : () => onSelect(f.id)}
                className={cn(SPEC_COLS, "h-[46px] border-b border-border/60 last:border-b-0", fixed ? "cursor-default" : "cursor-pointer",
                  sel ? "bg-brand-indigo-50/60" : !fixed && "hover:bg-secondary/40")}
              >
                <Radio on={sel} />
                <SpecNameCell f={f} model={modelOf(f.accelerator)} tag={f.id === refId && <RefTag label={refLabel} />} />
                <Bar label={`${f.vcpus} vCPU`} ratio={f.vcpus / max.cpu} color="bg-[#7d93c9]" />
                <Bar label={`${f.ramMb / 1024} GB RAM`} ratio={f.ramMb / max.ram} color="bg-[#5fc9a5]" />
                <Bar label={`${f.diskGb} GB Disk`} ratio={f.diskGb / max.disk} color="bg-[#c3a0e0]" />
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="p-5 text-center text-[13px] text-muted-foreground">{fixed ? fixedEmpty : "조건에 맞는 스펙이 없습니다"}</div>
          )}
        </div>
        {!fixed && (
          <>
            <Pager total={all.length} page={pageNow} pages={pages} onPage={setPage} />
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
                <Radio on={false} off />
                <SpecNameCell f={f} model={modelOf(f.accelerator)} reason={blockOf(f)} dim />
                <Bar label={`${f.vcpus} vCPU`} ratio={f.vcpus / max.cpu} color="bg-[#7d93c9]" dim />
                <Bar label={`${f.ramMb / 1024} GB RAM`} ratio={f.ramMb / max.ram} color="bg-[#5fc9a5]" dim />
                <Bar label={`${f.diskGb} GB Disk`} ratio={f.diskGb / max.disk} color="bg-[#c3a0e0]" dim />
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}

export interface KeyRow { id: string; name: string; fingerprint: string; type: string }

/**
 * 키페어 표 — 이름 · 지문 · 타입. onSelect 가 없으면 고를 수 없는 기준 값 표시. paged 면 검색 + 5개씩.
 * 오른쪽 영역 그리드의 자식들로 펼쳐진다(검색 줄 · 표).
 */
export function KeypairTable({ rows: list, selected, onSelect, refId, refLabel, paged, empty, nameCol = "minmax(0,180px)" }: {
  rows: KeyRow[];
  selected: string | null;
  onSelect?: (id: string) => void;
  refId?: string | null;
  refLabel: string;
  paged?: boolean;
  empty: React.ReactNode;
  nameCol?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState<number | null>(null);
  const q = query.trim().toLowerCase();
  const all = paged ? list.filter((k) => k.name.toLowerCase().includes(q)) : list;
  const { rows, page: pageNow, pages } = paged ? paginate(all, page, (k) => k.id === selected) : { rows: all, page: 0, pages: 1 };
  const cols = { gridTemplateColumns: `22px ${nameCol} minmax(0,1fr) 70px` };
  const colsClass = "grid items-center gap-[14px] px-4";

  return (
    <>
      {paged && <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder="키페어 이름 검색" />}
      <div className="flex flex-col overflow-hidden rounded-[10px] border border-border">
        <div style={cols} className={cn(colsClass, "border-b border-border bg-secondary/50 py-[9px] text-xs text-muted-foreground")}>
          <span /><span>이름</span><span>지문(FINGERPRINT)</span><span>타입</span>
        </div>
        <div className={cn(paged && "h-[184px] border-b border-border/60")}>
          {rows.map((k) => {
            const sel = selected === k.id;
            return (
              <div
                key={k.id}
                style={cols}
                onClick={onSelect && (() => onSelect(k.id))}
                className={cn(colsClass, "h-[46px] border-b border-border/60", onSelect ? "cursor-pointer" : "cursor-default",
                  sel ? "bg-brand-indigo-50/60" : onSelect && "hover:bg-secondary/40", !paged && "last:border-b-0")}
              >
                <Radio on={sel} />
                <span className="flex min-w-0 items-center gap-1.5">
                  <KeyRound className="size-3.5 flex-none text-amber-600" />
                  <span className="truncate font-mono text-[13px] font-semibold">{k.name}</span>
                  {k.id === refId && <RefTag label={refLabel} />}
                </span>
                <span title={k.fingerprint} className="truncate font-mono text-[11px] text-muted-foreground">{k.fingerprint}</span>
                <span className="font-mono text-xs text-muted-foreground">{k.type}</span>
              </div>
            );
          })}
          {rows.length === 0 && <div className="p-5 text-center text-[13px] text-muted-foreground">{list.length ? "조건에 맞는 키페어가 없습니다" : empty}</div>}
        </div>
        {paged && <Pager total={all.length} page={pageNow} pages={pages} onPage={setPage} />}
      </div>
    </>
  );
}

// ── 신청 화면 노드 구성(시안 2c) ─────────────────────────────────
// 왼쪽 = 노드 카드(Control Plane·Worker·키페어, 클릭하면 오른쪽 대상이 바뀜) + 총 자원, 오른쪽 = 템플릿 그대로 생성·템플릿 상세 +
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
  keypairId: string;       // 직접 선택 값 — 본인 SSH 키(iam_ssh_key.id), 관리자는 OpenStack 키페어 이름
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

/** 빠진 스펙 이름 — 키페어는 고르지 않아도 된다(템플릿 키페어가 들어간다). */
export function nodeConfigMissing(nodes: ClusterNodes): string[] {
  return [!nodes.masterFlavorId && "Control Plane 스펙", !nodes.flavorId && "Worker 스펙"].filter((x): x is string => !!x);
}

/** 템플릿 상세 — 템플릿 속성 전부(Horizon 클러스터 템플릿 상세와 같은 묶음). */
function templateMeta(t: ClusterTemplate) {
  const yn = (b: boolean) => (b ? "예" : "아니오");
  const v = (x: string | null) => x || "—";
  const labels = Object.entries(t.labels ?? {});
  const items = (list: [string, string][]) => list.map(([k, val]) => ({ k, v: val }));
  return [
    { group: "클러스터 유형", items: items([["COE", t.coe], ["클러스터 Distro", v(t.cluster_distro)], ["서버 유형", v(t.server_type)],
      ["공용", yn(t.public)], ["저장소가 사용됨", yn(t.registry_enabled)], ["TLS 가 사용되지 않음", yn(t.tls_disabled)]]) },
    { group: "노드 사양", items: items([["이미지 ID", v(t.image_id)], ["키 페어", v(t.keypair_id)], ["Flavor ID", v(t.flavor_id)],
      ["마스터 Flavor ID", v(t.master_flavor_id)], ["볼륨 드라이버", v(t.volume_driver)]]) },
    { group: "네트워크", items: items([["네트워크 드라이버", v(t.network_driver)], ["외부 네트워크 ID", v(t.external_network_id)],
      ["고정 네트워크", v(t.fixed_network)], ["Fixed 서브넷", v(t.fixed_subnet)],
      ["마스터 LB 활성화됨", yn(t.master_lb_enabled)], ["Floating IP 활성화됨", yn(t.floating_ip_enabled)]]) },
    { group: "레이블", items: items(labels.length ? labels : [["—", ""]]) },
  ];
}

/** 신청 화면 노드 구성 — 망·서브넷은 묻지 않는다(관리자가 프로비저닝 때 고른다 — 사용자가 내부망/인터넷망을 고르면 헷갈릴 위험). */
export function ClusterNodeConfigPanel({ flavors, keypairs, template, value, onChange }: {
  flavors: FlavorSummary[];
  keypairs: SshKey[];
  template: ClusterTemplate;
  value: ClusterNodeConfig;
  onChange: (v: ClusterNodeConfig) => void;
}) {
  const [role, setRole] = React.useState<NodeRole>("cp");
  const [showMeta, setShowMeta] = React.useState(false);
  const modelOf = useAccelModel();

  const src = value.source;
  const allTpl = Object.values(src).every((s) => s === "tpl");
  const nodes = effectiveNodes(flavors, value, template);
  const tv = templateNodes(flavors, template);
  const tplWorker = findFlavor(flavors, template.flavor_id);
  const masterF = flavors.find((f) => f.id === nodes.masterFlavorId);
  const workerF = flavors.find((f) => f.id === nodes.flavorId);
  const totals = nodeTotals(flavors, nodes);
  // 키페어 — 템플릿 값이거나 고르지 않으면 템플릿 키페어(없으면 노드에 SSH 키를 넣지 않음)
  const keyName = src.key === "custom" ? keypairs.find((k) => k.id === value.keypairId)?.name : undefined;
  const keyNone = template.keypair_id ? `템플릿 키페어(${template.keypair_id})가 적용됩니다` : "노드에 SSH 키를 넣지 않습니다";
  // 필수 항목(Control Plane·Worker 스펙) 진행 — 빠진 카드는 빨갛게, 템플릿 값을 못 쓰면 직접 선택으로 안내
  const required = [!!nodes.masterFlavorId, !!nodes.flavorId];
  const missingLine = (r: "cp" | "w") => src[r] === "tpl" ? "템플릿 스펙을 사용할 수 없습니다" : "필수 항목입니다. 오른쪽 목록에서 고르세요";

  function setSource(r: NodeRole, s: NodeSource) {
    onChange({ ...value, source: { ...src, [r]: s } });
  }
  // 가속기는 종류·모델·개수 묶음으로 본다 — 같은 묶음이면 고른 스펙을 두고, 스펙을 고르면 그 스펙의 프로파일을 값으로
  const sameAccel = accelGroup(accelChoices(flavors, modelOf));
  function selectAccel(dp: string) {
    const cur = flavors.find((f) => f.id === value.flavorId);
    onChange({ ...value, accel: dp, flavorId: cur && !workerFlavorBlock(cur, dp, sameAccel) ? cur.id : "" });
  }
  function selectWorker(id: string) {
    onChange({ ...value, flavorId: id, accel: flavors.find((f) => f.id === id)?.accelerator ?? value.accel });
  }

  const tplRef = role === "w" ? template.flavor_id : template.master_flavor_id;
  const tplRefFlavor = findFlavor(flavors, tplRef);
  const tplBlock = tplRefFlavor && (role === "w" ? workerFlavorBlock(tplRefFlavor, tplRefFlavor.accelerator ?? "") : masterFlavorBlock(tplRefFlavor));
  const tplMissing = !tplRef ? "템플릿에 스펙이 없습니다"
    : `템플릿 스펙(${tplRef})을 이 프로젝트에서 쓸 수 없습니다${tplBlock ? ` — ${tplBlock}` : ""}`;
  const card = "gap-2 px-3.5 py-3"; // 승인 화면(1b)과 같은 카드 크기

  return (
    <div className="grid h-[652px] grid-cols-[270px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-xl border border-border [&_*]:leading-[1.2]">
      {/* 왼쪽 — 노드 카드 + 총 자원(승인 화면 1b 와 같은 배치). 높이 652px 은 네트워크 카드가 있던 때 가장 긴 경우(가속기
          Worker 스펙 줄 두 줄 + 키페어 비움 안내)에 맞춘 값 — 오른쪽 스펙 표 높이와 맞아 그대로 둔다. 그보다 길면 왼쪽만 스크롤 */}
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-secondary/50 px-4 py-[18px] [scrollbar-width:thin]">
        <RequiredProgress title="노드 구성" items={required} />
        <NodeCard className={card} icon={serverIcon} title="Control Plane" required range="1 또는 3대" rangeAt="count"
          tag={src.cp === "tpl" && <RefTag label="템플릿" />} status={masterF ? "done" : "missing"} placeholder="스펙을 고르세요"
          value={masterF?.name} line={masterF ? specLine(masterF) : missingLine("cp")} selected={role === "cp"} onSelect={() => setRole("cp")}
          count={[value.masterCount, () => onChange({ ...value, masterCount: 1 }), () => onChange({ ...value, masterCount: 3 })]} />
        <NodeCard className={card} icon={serverIcon} title="Worker" required range={`1~${MAX_WORKERS}대`} rangeAt="count"
          tag={src.w === "tpl" && <RefTag label="템플릿" />} status={workerF ? "done" : "missing"} placeholder="스펙을 고르세요"
          value={workerF?.name} line={workerF ? <>{specLine(workerF)}<WorkerAccel f={workerF} model={modelOf(workerF.accelerator)} /></>
            : missingLine("w")}
          selected={role === "w"} onSelect={() => setRole("w")}
          count={[value.nodeCount, () => onChange({ ...value, nodeCount: Math.max(1, value.nodeCount - 1) }),
            () => onChange({ ...value, nodeCount: Math.min(MAX_WORKERS, value.nodeCount + 1) })]} />
        <NodeCard className={card} icon={keyIcon} title="키페어" optional tag={src.key === "tpl" && <RefTag label="템플릿" />}
          value={src.key === "tpl" ? (template.keypair_id || "키페어 없음") : keyName ?? "사용 안 함"}
          valueMuted={src.key === "tpl" ? !template.keypair_id : !keyName}
          line={src.key === "tpl" ? (template.keypair_id ? undefined : "노드 SSH 미설정") : keyName ? undefined : keyNone}
          selected={role === "key"} onSelect={() => setRole("key")} />
        <TotalsBlock rows={[
          { k: "vCPU", v: totals && `${totals.vcpu}` }, { k: "RAM", v: totals && `${totals.ramGb} GB` },
          { k: "Disk", v: totals && `${totals.diskGb} GB` },
          { k: "가속기", v: totals && workerF && <TotalAccel f={workerF} model={modelOf(workerF.accelerator)} n={nodes.nodeCount} /> },
        ]} />
      </div>

      {/* 오른쪽 — 넘치면 여기만 스크롤 */}
      <div className="grid min-h-0 min-w-0 auto-rows-max grid-cols-[minmax(0,1fr)] content-start gap-[14px] overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
        <div className="grid grid-cols-2 gap-3">
          <SwitchCard title="템플릿 그대로 생성" desc="템플릿 사양 그대로 생성합니다." checked={allTpl}
            onCheckedChange={(on) => onChange({ ...value, source: on ? { cp: "tpl", w: "tpl", key: "tpl" } : { cp: "custom", w: "custom", key: "custom" } })} />
          <ExpandCard title="템플릿 상세" sub={template.name} open={showMeta} onToggle={() => setShowMeta((o) => !o)} />
        </div>
        <Collapse open={showMeta}><MetaGrid groups={templateMeta(template)} /></Collapse>

        <PickerHeader
          title={{ cp: "Control Plane 스펙", w: "Worker 스펙", key: "키페어" }[role]}
          hint={src[role] === "tpl" ? "템플릿 값을 사용합니다"
            : { cp: "가속기 없는 스펙만 쓸 수 있습니다", w: "가속기를 고르면 맞는 스펙만 보입니다", key: "노드에 주입할 SSH 키페어 · 다시 누르면 선택 해제" }[role]}
        >
          <Segment options={[["custom", "직접 선택"], ["tpl", "템플릿 값"]] as const} value={src[role]} onChange={(s) => setSource(role, s)} />
        </PickerHeader>

        {role !== "key" ? (
          <SpecPicker
            key={`${role}-${src[role]}`}
            flavors={flavors}
            role={role}
            fixed={src[role] === "tpl"}
            fixedEmpty={tplMissing}
            selected={role === "w" ? nodes.flavorId : nodes.masterFlavorId}
            onSelect={(id) => (role === "w" ? selectWorker(id) : onChange({ ...value, masterFlavorId: id }))}
            accel={value.accel}
            onAccel={selectAccel}
            refLabel="템플릿"
            refId={role === "w" ? tv.flavorId : tv.masterFlavorId}
            refAccel={tplWorker ? tplWorker.accelerator ?? "" : undefined}
            sortSelect
            groupAccel
          />
        ) : src.key === "tpl" ? (
          /* 템플릿 값 — 템플릿 키페어 한 줄 */
          <KeypairTable
            rows={template.keypair_id ? [{ id: "tpl", name: template.keypair_id, fingerprint: "—", type: "ssh" }] : []}
            selected="tpl" refId="tpl" refLabel="템플릿"
            empty="템플릿에 키페어가 없습니다 — 노드에 SSH 키를 넣지 않습니다"
          />
        ) : (
          /* 직접 선택 — 본인 SSH 키(관리자는 OpenStack 키페어). 고른 행을 다시 누르면 해제(템플릿 키페어) */
          <KeypairTable
            rows={keypairs.map((k) => ({ id: k.id, name: k.name, fingerprint: k.fingerprint, type: keyType(k.publicKey) }))}
            selected={value.keypairId} refLabel="템플릿"
            onSelect={(id) => onChange({ ...value, keypairId: value.keypairId === id ? "" : id })}
            empty={<>등록된 키페어가 없습니다. <span className="font-semibold">키페어</span> 메뉴에서 생성할 수 있습니다.</>}
          />
        )}
      </div>
    </div>
  );
}
