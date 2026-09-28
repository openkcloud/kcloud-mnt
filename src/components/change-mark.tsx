"use client";
import * as React from "react";
import Link from "next/link";
import { GitCommit, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChangeMode } from "@/lib/change-mode";
import { CR_MAP, SOURCES, AREA_LABEL, STATUS_LABEL, type ChangeRequest, type CrStatus } from "@/lib/change-requests";
import { FEATURE_MAP, SCOPE_LABEL } from "@/lib/scope";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export const STATUS_STYLE: Record<CrStatus, string> = {
  reflected: "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-sky-200 bg-sky-50 text-sky-700",
  excluded: "border-rose-200 bg-rose-50 text-rose-700",
  planned: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: CrStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** 변경 요구사항 코드 배지. 누르면 상세 시트가 열린다. */
export function ChangeBadge({ id, className }: { id: string; className?: string }) {
  const select = useChangeMode((s) => s.select);
  const cr = CR_MAP[id];
  if (!cr) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); select(id); }}
      title={`${cr.id} ${cr.title}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-amber-900 shadow-sm hover:bg-amber-200",
        className,
      )}
    >
      {cr.id}
    </button>
  );
}

/**
 * 변경 표시 모드가 켜져 있을 때 자식 영역에 점선 테두리와 코드 배지를 붙인다.
 * 꺼져 있으면 자식만 그대로 그린다.
 */
export function ChangeMark({
  ids,
  children,
  className,
  inline,
}: {
  ids: string[];
  children: React.ReactNode;
  className?: string;
  /** 인라인 요소(버튼 등)를 감쌀 때 */
  inline?: boolean;
}) {
  const on = useChangeMode((s) => s.on);
  const valid = ids.filter((i) => CR_MAP[i]);
  if (!on || valid.length === 0) return <>{children}</>;
  return (
    <div
      className={cn(
        "relative rounded-md outline outline-2 outline-dashed outline-amber-400/90 outline-offset-2",
        inline ? "inline-block" : "block",
        className,
      )}
      data-change-ids={valid.join(",")}
    >
      <div className="absolute -top-2.5 right-1 z-20 flex gap-1">
        {valid.map((id) => <ChangeBadge key={id} id={id} />)}
      </div>
      {children}
    </div>
  );
}

/** 상세 시트 — 헤더/패널/배지 어디서 골라도 여기서 연다. 포털 레이아웃에 한 번만 둔다. */
export function ChangeDetailSheet() {
  const selected = useChangeMode((s) => s.selected);
  const select = useChangeMode((s) => s.select);
  const cr = selected ? CR_MAP[selected] : undefined;
  return (
    <Sheet open={!!cr} onOpenChange={(o) => !o && select(null)}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {cr && <ChangeDetail cr={cr} />}
      </SheetContent>
    </Sheet>
  );
}

export function ChangeDetail({ cr, compact }: { cr: ChangeRequest; compact?: boolean }) {
  const feature = cr.feature ? FEATURE_MAP[cr.feature] : undefined;
  return (
    <>
      {!compact && (
        <SheetHeader className="border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-900">{cr.id}</span>
            <StatusBadge status={cr.status} />
            <span className="text-xs text-muted-foreground">{AREA_LABEL[cr.area]}</span>
          </div>
          <SheetTitle className="text-lg leading-snug">{cr.title}</SheetTitle>
          <SheetDescription>화면 {cr.pages.map((p) => <code key={p} className="mr-1 rounded bg-muted px-1 font-mono text-[11px]">{p}</code>)}</SheetDescription>
        </SheetHeader>
      )}
      <div className={cn("space-y-4 text-sm", compact ? "" : "p-6")}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">초기 전달본 (v1.0)</div>
            <div className="text-xs leading-relaxed">{cr.before}</div>
          </div>
          <div className="hidden items-center md:flex"><ArrowRight className="size-4 text-muted-foreground" /></div>
          <div className={cn("rounded-md border p-3", cr.status === "excluded" ? "bg-rose-50/50" : "bg-brand-mint-50/40")}>
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">반영본 (v2.0)</div>
            <div className="text-xs leading-relaxed">{cr.after}</div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">출처</div>
          <ul className="space-y-1.5">
            {cr.sources.map((s, i) => (
              <li key={i} className="rounded-md border border-border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-[10px]">{s.doc}</Badge>
                  <span className="font-medium">{s.ref}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{SOURCES[s.doc].date} · {SOURCES[s.doc].org}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{s.said}</div>
              </li>
            ))}
          </ul>
        </div>

        {cr.history.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">반영 이력</div>
            <ol className="space-y-1 text-xs">
              {cr.history.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-[100px] shrink-0 font-mono text-muted-foreground">{h.date}</span>
                  <span className="flex-1">{h.note || "반영"}</span>
                  {h.commit && <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"><GitCommit className="size-3" />{h.commit}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {(feature || cr.decision) && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {feature && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground">형상</span>
                  <Badge variant="outline" className={cn("text-[10px]", feature.scope === "final" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-700")}>
                    {SCOPE_LABEL[feature.scope]} · {feature.label}
                  </Badge>
                </span>
              )}
              {cr.decision && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground">결정 필요 사안</span>
                  {cr.decision.map((d) => <Badge key={d} variant="outline" className="font-mono text-[10px]">#{d}</Badge>)}
                </span>
              )}
            </div>
          </>
        )}

        {!compact && (
          <div className="flex items-center gap-3 border-t border-border pt-3 text-xs">
            <Link href={`/changes?cr=${cr.id}`} className="inline-flex items-center gap-1 text-brand-indigo-700 hover:underline">
              대비표에서 초기 화면과 비교 <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
