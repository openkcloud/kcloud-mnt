"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Diff, X, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChangeMode } from "@/lib/change-mode";
import { changesForPath, STATUS_LABEL, type CrStatus } from "@/lib/change-requests";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/change-mark";

/** 헤더 토글 버튼 — 현재 화면의 변경 요구사항 건수를 같이 보여준다 */
export function ChangeModeToggle() {
  const pathname = usePathname();
  const on = useChangeMode((s) => s.on);
  const toggle = useChangeMode((s) => s.toggle);
  const count = changesForPath(pathname).length;
  return (
    <Button
      variant={on ? "default" : "outline"}
      size="sm"
      className={cn("h-8 gap-1.5 text-xs", on && "bg-amber-500 text-amber-950 hover:bg-amber-500/90")}
      onClick={toggle}
      title="초기 전달본 대비 바뀐 부분을 요구사항 코드와 함께 화면에 표시한다"
    >
      <Diff className="size-3.5" />
      변경 표시
      {count > 0 && (
        <span className={cn("rounded px-1 font-mono text-[10px]", on ? "bg-amber-950/15" : "bg-muted")}>{count}</span>
      )}
    </Button>
  );
}

/** 변경 표시 모드가 켜지면 화면 우하단에 뜨는 목록 패널 */
export function ChangePanel() {
  const pathname = usePathname();
  const on = useChangeMode((s) => s.on);
  const select = useChangeMode((s) => s.select);
  const setOn = useChangeMode((s) => s.setOn);
  const [collapsed, setCollapsed] = React.useState(false);
  if (!on) return null;
  const items = changesForPath(pathname);
  const byStatus = items.reduce<Partial<Record<CrStatus, number>>>((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {});

  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-amber-300 bg-card shadow-xl"
      aria-label="이 화면의 변경 요구사항"
    >
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
        <ListChecks className="size-4 text-amber-700" />
        <div className="flex-1 text-xs">
          <div className="font-semibold text-amber-950">이 화면의 변경 요구사항 {items.length}건</div>
          <div className="font-mono text-[10px] text-amber-900/70">{pathname}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((c) => !c)} title={collapsed ? "펼치기" : "접기"}>
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setOn(false)} title="변경 표시 끄기">
          <X className="size-3.5" />
        </Button>
      </div>
      {!collapsed && (
        <>
          {items.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">이 화면은 초기 전달본과 같다.</div>
          ) : (
            <ul className="max-h-[44vh] divide-y divide-border overflow-y-auto">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c.id)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60"
                  >
                    <span className="mt-0.5 shrink-0 rounded border border-amber-400 bg-amber-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-amber-900">{c.id}</span>
                    <span className="flex-1">
                      <span className="block leading-snug">{c.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {c.sources.map((s) => `${s.doc.split("-")[0]} ${s.ref}`).join(" · ")}
                      </span>
                    </span>
                    <StatusBadge status={c.status} className="shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              {(Object.keys(byStatus) as CrStatus[]).map((k) => `${STATUS_LABEL[k]} ${byStatus[k]}`).join(" · ")}
            </span>
            <Link href="/changes" className="text-brand-indigo-700 hover:underline">전체 대비표</Link>
          </div>
        </>
      )}
    </aside>
  );
}
