"use client";
import * as React from "react";
import Link from "next/link";
import { ExternalLink, Columns2, Filter, GitCommit, ListChecks, Diff, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANGE_REQUESTS, SOURCES, AREA_LABEL, AREA_ORDER, STATUS_LABEL, countByStatus, groupByArea,
  type ChangeRequest, type CrArea, type CrStatus, type SourceId,
} from "@/lib/change-requests";
import { INITIAL_VERSION, CURRENT_VERSION, snapshotUrl } from "@/lib/versions";
import { useChangeMode } from "@/lib/change-mode";
import { PageHeader } from "@/components/page-header";
import { ChangeDetail, StatusBadge, STATUS_STYLE } from "@/components/change-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_ORDER: CrStatus[] = ["reflected", "partial", "pending", "excluded", "planned"];

// 이 화면은 클라이언트에서만 렌더된다(포털 레이아웃이 로그인 전에는 스피너를 그린다).
function initialCrFromUrl(): string {
  if (typeof window === "undefined") return CHANGE_REQUESTS[0].id;
  const q = new URLSearchParams(window.location.search).get("cr");
  return q && CHANGE_REQUESTS.some((c) => c.id === q) ? q : CHANGE_REQUESTS[0].id;
}

export default function ChangesPage() {
  const [selectedId, setSelectedId] = React.useState<string>(initialCrFromUrl);
  const [area, setArea] = React.useState<"all" | CrArea>("all");
  const [status, setStatus] = React.useState<"all" | CrStatus>("all");
  const [source, setSource] = React.useState<"all" | SourceId>("all");
  const [q, setQ] = React.useState("");
  const on = useChangeMode((s) => s.on);
  const setOn = useChangeMode((s) => s.setOn);

  const filtered = CHANGE_REQUESTS.filter((c) =>
    (area === "all" || c.area === area) &&
    (status === "all" || c.status === status) &&
    (source === "all" || c.sources.some((s) => s.doc === source)) &&
    (!q || `${c.id} ${c.title} ${c.before} ${c.after} ${c.sources.map((s) => s.ref + s.said).join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const groups = groupByArea(filtered);
  const counts = countByStatus();
  const selected = CHANGE_REQUESTS.find((c) => c.id === selectedId) ?? CHANGE_REQUESTS[0];

  function pick(id: string) {
    setSelectedId(id);
    try { history.replaceState(null, "", `?cr=${id}`); } catch { /* noop */ }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="변경 요구사항 대비표"
        description={
          <>
            초기 전달본 <span className="font-mono">{INITIAL_VERSION.id}</span>({INITIAL_VERSION.date}) 대비 반영본 <span className="font-mono">{CURRENT_VERSION.id}</span>({CURRENT_VERSION.date})의 변경 요구사항 {CHANGE_REQUESTS.length}건.
            코드를 고르면 출처·이전/이후·이력과 함께 초기 화면과 현재 화면을 나란히 본다. 각 화면에서는 헤더의 &ldquo;변경 표시&rdquo;를 켜면 같은 코드가 배지로 붙는다.
          </>
        }
        actions={
          <>
            <Button variant={on ? "default" : "outline"} size="sm" className={cn("h-8 gap-1.5 text-xs", on && "bg-amber-500 text-amber-950 hover:bg-amber-500/90")} onClick={() => setOn(!on)}>
              <Diff className="size-3.5" /> 화면 안 변경 표시 {on ? "켜짐" : "꺼짐"}
            </Button>
            <Badge variant="outline" className="h-8 gap-1.5 px-3 font-mono text-[11px]">
              <FileText className="size-3.5" /> docs/변경요구사항_대비표.md
            </Badge>
          </>
        }
      />

      {/* 요약 */}
      <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
        <Card>
          <CardContent className="grid grid-cols-5 gap-2 p-4">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(status === s ? "all" : s)}
                className={cn("rounded-lg border p-2 text-center transition-colors", status === s ? "border-brand-indigo-500 ring-2 ring-brand-indigo-500/20" : "border-border hover:bg-muted/40")}
              >
                <div className="font-mono text-xl font-bold tabular-nums">{counts[s]}</div>
                <span className={cn("mt-1 inline-block rounded border px-1.5 text-[10px]", STATUS_STYLE[s])}>{STATUS_LABEL[s]}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(SOURCES) as SourceId[]).map((id) => {
              const s = SOURCES[id];
              const n = CHANGE_REQUESTS.filter((c) => c.sources.some((x) => x.doc === id)).length;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSource(source === id ? "all" : id)}
                  className={cn("rounded-lg border p-2.5 text-left transition-colors", source === id ? "border-brand-indigo-500 ring-2 ring-brand-indigo-500/20" : "border-border hover:bg-muted/40")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold">{id}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{n}건</span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{s.title}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{s.date} · {s.kind}</div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* 좌: 목록 */}
        <Card className="lg:sticky lg:top-0 lg:self-start">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="size-4" /> 코드별 목록</CardTitle>
              <span className="text-xs text-muted-foreground">{filtered.length} / {CHANGE_REQUESTS.length}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="코드·제목·출처 검색"
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-xs"
              />
              <Select value={area} onValueChange={(v) => setArea(v as "all" | CrArea)}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 영역</SelectItem>
                  {AREA_ORDER.map((a) => <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(status !== "all" || source !== "all" || area !== "all" || q) && (
              <Button variant="ghost" size="sm" className="h-7 w-fit gap-1 text-xs" onClick={() => { setStatus("all"); setSource("all"); setArea("all"); setQ(""); }}>
                <Filter className="size-3" /> 필터 해제
              </Button>
            )}
          </CardHeader>
          <CardContent className="max-h-[64vh] space-y-3 overflow-y-auto pt-0">
            {groups.map((g) => (
              <div key={g.area}>
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{AREA_LABEL[g.area]}</div>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                        c.id === selected.id ? "bg-brand-indigo-50 text-brand-indigo-900" : "hover:bg-muted",
                      )}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold text-amber-800">{c.id}</span>
                      <span className="flex-1 leading-snug">{c.title}</span>
                      <StatusBadge status={c.status} className="shrink-0 px-1 py-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">조건에 맞는 항목이 없다.</div>}
          </CardContent>
        </Card>

        {/* 우: 상세 + 화면 비교 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-900">{selected.id}</span>
                <StatusBadge status={selected.status} />
                <span className="text-xs text-muted-foreground">{AREA_LABEL[selected.area]}</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {selected.pages.map((p) => (
                    <Link key={p} href={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted/70">{p}</Link>
                  ))}
                </span>
              </div>
              <CardTitle className="text-lg leading-snug">{selected.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangeDetail cr={selected} compact />
            </CardContent>
          </Card>

          <ScreenCompare key={selected.id} cr={selected} />
        </div>
      </div>

      {/* 버전 단계(참고) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">반영 단계</CardTitle>
          <CardDescription>{INITIAL_VERSION.id} {INITIAL_VERSION.label}({INITIAL_VERSION.date}, <span className="font-mono">{INITIAL_VERSION.commit}</span>) → {CURRENT_VERSION.id} {CURRENT_VERSION.label}({CURRENT_VERSION.date})</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 md:grid-cols-4">
            {(CURRENT_VERSION.steps ?? []).map((s, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-xs">
                <div className="font-mono text-[11px] text-muted-foreground">{s.date}</div>
                <div className="mt-0.5 font-medium leading-snug">{s.label}</div>
                {s.commit && <div className="mt-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]"><GitCommit className="size-3" />{s.commit}</div>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 화면 비교 — 초기 전달본 스냅샷 iframe · 현재 화면 iframe
// ─────────────────────────────────────────────────────────────

const REMOVED_PAGES: Record<string, string> = {
  "/ai-accelerators": "CR-IAAS-07",
  "/iaas/providers": "CR-IAAS-08",
};

function ScreenCompare({ cr }: { cr: ChangeRequest }) {
  const [scale, setScale] = React.useState<0.5 | 0.75 | 1>(0.5);
  const [pageIdx, setPageIdx] = React.useState(0); // 부모가 key={cr.id}로 초기화한다

  // 삭제된 화면은 초기 스냅샷의 옛 경로를 보여준다
  const removedPath = Object.entries(REMOVED_PAGES).find(([, id]) => id === cr.id)?.[0];
  const page = cr.pages[Math.min(pageIdx, cr.pages.length - 1)];
  const prevPath = removedPath ?? page;
  const newPage = ["/changes", "/settings", "/iaas/routers", "/iaas/security-groups", "/iaas/keypairs"].includes(page) && page !== "/settings" ? true : false;
  const prevUrl = INITIAL_VERSION.snapshotBase && !newPage ? snapshotUrl(INITIAL_VERSION.snapshotBase, prevPath) : null;
  const thisUrl = removedPath ? null : `${page}/`;
  const both = !!prevUrl && !!thisUrl;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Columns2 className="size-4" /> 화면 비교</CardTitle>
          <CardDescription>
            {both
              ? `왼쪽 ${INITIAL_VERSION.id} 스냅샷 · 오른쪽 ${CURRENT_VERSION.id} 현재 화면. 두 화면 모두 클릭해 둘러볼 수 있다. 오른쪽에서 &ldquo;변경 표시&rdquo;를 켜면 배지가 보인다.`
              : prevUrl
                ? `${INITIAL_VERSION.id} 스냅샷. 반영본에는 이 화면이 없다.`
                : `${CURRENT_VERSION.id} 화면. 초기 전달본에는 이 화면이 없다.`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {cr.pages.length > 1 && (
            <Select value={String(pageIdx)} onValueChange={(v) => setPageIdx(Number(v))}>
              <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cr.pages.map((p, i) => <SelectItem key={p} value={String(i)}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-1">
            {([0.5, 0.75, 1] as const).map((s) => (
              <Button key={s} variant={scale === s ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => setScale(s)}>
                {Math.round(s * 100)}%
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {both ? (
          <Tabs defaultValue="side">
            <TabsList className="mb-3">
              <TabsTrigger value="side">나란히</TabsTrigger>
              <TabsTrigger value="prev">초기 {INITIAL_VERSION.id}</TabsTrigger>
              <TabsTrigger value="this">반영본 {CURRENT_VERSION.id}</TabsTrigger>
            </TabsList>
            <TabsContent value="side">
              <div className="grid gap-3 xl:grid-cols-2">
                <FramePane label={`${INITIAL_VERSION.id} · ${INITIAL_VERSION.label}`} url={prevUrl!} scale={scale} tone="prev" />
                <FramePane label={`${CURRENT_VERSION.id} · ${CURRENT_VERSION.label}`} url={thisUrl!} scale={scale} tone="this" />
              </div>
            </TabsContent>
            <TabsContent value="prev"><FramePane label={`${INITIAL_VERSION.id} · ${INITIAL_VERSION.label}`} url={prevUrl!} scale={scale} tone="prev" tall /></TabsContent>
            <TabsContent value="this"><FramePane label={`${CURRENT_VERSION.id} · ${CURRENT_VERSION.label}`} url={thisUrl!} scale={scale} tone="this" tall /></TabsContent>
          </Tabs>
        ) : (
          <FramePane
            label={prevUrl ? `${INITIAL_VERSION.id} · ${INITIAL_VERSION.label}` : `${CURRENT_VERSION.id} · ${CURRENT_VERSION.label}`}
            url={(prevUrl ?? thisUrl)!}
            scale={scale}
            tone={prevUrl ? "prev" : "this"}
            tall
          />
        )}
      </CardContent>
    </Card>
  );
}

function FramePane({ label, url, scale, tone, tall }: { label: string; url: string; scale: number; tone: "prev" | "this"; tall?: boolean }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("inline-flex items-center gap-1.5 font-medium", tone === "prev" ? "text-muted-foreground" : "text-brand-indigo-700")}>
          <span className={cn("size-1.5 rounded-full", tone === "prev" ? "bg-muted-foreground/60" : "bg-brand-indigo-500")} />
          {label}
        </span>
        <Link href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          새 탭 <ExternalLink className="size-3" />
        </Link>
      </div>
      <div className={cn("relative w-full overflow-hidden rounded-md border bg-muted/30", tall ? "h-[720px]" : "h-[560px]")}>
        <iframe
          src={url}
          title={label}
          className="absolute left-0 top-0 origin-top-left border-0 bg-background"
          style={{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
