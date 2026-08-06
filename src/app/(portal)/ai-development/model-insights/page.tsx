"use client";
import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Database,
  Zap,
  ChevronRight,
  Lightbulb,
  GitBranch,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { LlmChatDialog } from "@/components/llm-chat-dialog";
import { KF_BASE, KF_ENABLED } from "@/lib/kf";

// ─── Pipeline stage breakdown ───
// ─── Inference latency breakdown ───

interface GpuMetric {
  node: string;
  gpu: string;
  utilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  tempC: number;
  powerW: number;
}

/** 실측 GPU 상태 스트립 — 클러스터 양쪽 노드의 nvidia-smi 라이브 (3s 폴링) */
function LiveGpuStrip() {
  const { data } = useQuery({
    queryKey: ["metrics", "gpu"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/gpu`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: GpuMetric[] }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 3000,
  });
  if (!KF_ENABLED || !data) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.items.map((g) => (
        <Card key={g.node} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-brand-mint-500" />
                <span className="text-sm font-semibold">{g.gpu}</span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                node/{g.node} · 실측 (nvidia-smi)
              </div>
            </div>
            <Badge variant="success" className="font-mono text-[10px]">LIVE</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <LiveStat label="사용률" value={`${g.utilPct}%`} />
            <LiveStat label="VRAM" value={`${(g.memUsedMb / 1024).toFixed(1)}/${(g.memTotalMb / 1024).toFixed(0)}GB`} />
            <LiveStat label="온도" value={`${g.tempC}°C`} />
            <LiveStat label="전력" value={`${Math.round(g.powerW)}W`} />
          </div>
          <Progress value={g.utilPct} className="mt-2 h-1.5" />
        </Card>
      ))}
    </div>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

interface LlmMetrics {
  model: string; engine: string; node: string; requests: number;
  ttftMs: number | null; tpotMs: number | null; e2eMs: number | null;
  tokensPerSec: number | null; promptTokens: number; generationTokens: number;
  kvCacheUsagePct: number; runningReqs: number;
}

interface LlmDetail {
  model: string;
  requests: number;
  latency: {
    ttftMs: number | null; tpotMs: number | null; e2eMs: number | null;
    p50Ms: number | null; p95Ms: number | null; p99Ms: number | null;
    ttftP95Ms: number | null; tpotP95Ms: number | null;
  };
  breakdown: { stage: string; ms: number; key: string }[];
  cache: { gpuUsagePct: number; prefixHitPct: number | null; cpuUsagePct: number };
  queue: { running: number; waiting: number; swapped: number; preemptions: number };
  throughput: { genTokPerSec: number; promptTokPerSec: number;
                avgOutputTokens: number; p95OutputTokens: number | null };
  series: { t: string; p50: number; p95: number; p99: number }[];
}

function useLlmDetail() {
  return useQuery({
    queryKey: ["metrics", "llm-detail"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/llm/detail`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<LlmDetail>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 10000,
    retry: false,
  });
}

interface ProfileHotspot {
  component: string; ms: number; pct: number; calls: number;
  reason: string; ops: string[];
}
interface ProfileResult {
  samples: number; maxTokens: number; totalMs: number; events: number;
  hotspots: ProfileHotspot[];
}
interface ProfileState {
  running: boolean; at: string | null; error: string | null;
  result: ProfileResult | null; kernelLevel: boolean; kernelNote: string;
}

interface InsightItem {
  severity: "critical" | "warning" | "info" | "ok";
  title: string;
  detail: string;
  evidence: { label: string; value: string; detail?: string }[];
  actions: string[];
}

const SEV: Record<InsightItem["severity"], {
  badge: "destructive" | "warning" | "outline" | "success";
  label: string; card: string; icon: string;
}> = {
  critical: { badge: "destructive", label: "심각", card: "border-rose-200 bg-gradient-to-br from-rose-50 to-transparent", icon: "bg-rose-100 text-rose-700" },
  warning: { badge: "warning", label: "주의", card: "border-amber-200 bg-gradient-to-br from-amber-50 to-transparent", icon: "bg-amber-100 text-amber-700" },
  info: { badge: "outline", label: "참고", card: "border-sky-200 bg-gradient-to-br from-sky-50 to-transparent", icon: "bg-sky-100 text-sky-700" },
  ok: { badge: "success", label: "정상", card: "border-brand-mint-200 bg-gradient-to-br from-brand-mint-50 to-transparent", icon: "bg-brand-mint-100 text-brand-mint-700" },
};

/** 실측 파이프라인 소견 — Argo 실행 기록에서 직접 도출 (임의 수치 없음) */
function LivePipelineInsight() {
  const { data } = useQuery({
    queryKey: ["metrics", "pipeline-runs"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/pipeline-runs`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: WfRun[] }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 15000,
    retry: false,
  });
  const runs = data?.items ?? [];
  if (!KF_ENABLED || !runs.length) return null;

  const failed = runs.filter((r) => r.phase === "Failed");
  const worst = [...runs].sort((a, b) => b.bottleneckPct - a.bottleneckPct)[0];
  const avgSec = Math.round(runs.reduce((a, r) => a + r.totalSec, 0) / runs.length);
  const critical = failed.length > 0;

  return (
    <Card className={cn(
      "overflow-hidden",
      critical ? "border-rose-200 bg-gradient-to-br from-rose-50 to-transparent"
               : "border-amber-200 bg-gradient-to-br from-amber-50 to-transparent",
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            critical ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
          )}>
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={critical ? "destructive" : "warning"}>
                  {critical ? "심각" : "주의"}
                </Badge>
                <Badge variant="success" className="text-[10px]">실측 기반 자동 진단</Badge>
              </div>
              <h2 className="mt-1 text-lg font-bold leading-tight">
                {critical
                  ? `최근 실행 ${runs.length}건 중 ${failed.length}건이 실패했습니다`
                  : `학습 시간의 ${worst.bottleneckPct}%가 '${worst.bottleneck}' 단계에 몰려 있습니다`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {critical
                  ? `실패한 워크플로우: ${failed.map((r) => r.workflow).join(", ")} — 해당 단계 로그를 먼저 확인하세요.`
                  : `${worst.workflow} 기준 총 ${worst.totalSec}초 중 ${worst.bottleneck} 단계가 가장 오래 걸렸습니다. 이 단계를 줄이는 것이 전체 시간 단축에 가장 효과가 큽니다.`}
              </p>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Evidence label="병목 단계" value={worst.bottleneck}
                        detail={`전체의 ${worst.bottleneckPct}%`} color="amber" />
              <Evidence label="평균 실행 시간" value={`${avgSec}초`}
                        detail={`최근 ${runs.length}회 기준`} color="indigo" />
              <Evidence label="성공 / 실패"
                        value={`${runs.length - failed.length} / ${failed.length}`}
                        detail="최근 실행" color={critical ? "rose" : "indigo"} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/ai-development/pipelines">파이프라인 편집</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/monitoring/logs">실행 로그 보기</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ServingMetric {
  name: string; namespace: string; format: string; accelerator: string;
  requests: number; totalMs: number; p95Ms: number | null;
  breakdown: { stage: string; ms: number; key: string }[];
}

/** 배포된 모델 서비스의 추론 지표 — KServe 래퍼 실측 */
function LiveServingMetrics() {
  const { data } = useQuery({
    queryKey: ["metrics", "serving"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/serving`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: ServingMetric[] }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 10000,
    retry: false,
  });
  if (!KF_ENABLED || !data?.items?.length) return null;

  const COLORS: Record<string, string> = {
    pre: "#94a3b8",
    infer: "var(--brand-indigo-500)",
    post: "var(--brand-mint-500)",
  };

  return (
    <Card className="border-brand-mint-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4 text-brand-mint-600" />
          배포 모델 추론 성능
          <Badge variant="success" className="text-[10px]">실측</Badge>
        </CardTitle>
        <CardDescription>
          우리가 학습시켜 배포한 모델들 — 요청 1건이 전처리·추론·후처리에
          각각 얼마나 쓰는지 보여줍니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.items.map((m) => {
          const total = m.breakdown.reduce((a, b) => a + b.ms, 0) || 1;
          return (
            <div key={`${m.namespace}/${m.name}`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{m.format}</Badge>
                  <Badge variant="outline" className="text-[10px]">{m.accelerator}</Badge>
                  누적 {m.requests}건 · 평균{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {m.totalMs}ms
                  </span>
                  {m.p95Ms != null && <>· P95 {m.p95Ms}ms</>}
                </span>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-md">
                {m.breakdown.map((b) => (
                  <div key={b.key}
                       style={{ width: `${Math.max((b.ms / total) * 100, 1)}%`,
                                background: COLORS[b.key] }}
                       className="flex items-center justify-center text-[10px] font-semibold text-white"
                       title={`${b.stage}: ${b.ms}ms`}>
                    {(b.ms / total) * 100 >= 15 ? `${Math.round((b.ms / total) * 100)}%` : ""}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {m.breakdown.map((b) => (
                  <span key={b.key} className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-sm" style={{ background: COLORS[b.key] }} />
                    {b.stage} {b.ms}ms
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-[11px] leading-snug text-muted-foreground">
          추론 구간이 대부분이면 모델이나 가속기가 병목이고, 전처리가 길면
          입력 데이터 처리(이미지 변환 등)가 병목입니다.
        </p>
      </CardContent>
    </Card>
  );
}

/** 실측 병목 소견 — 살아있는 지표에 규칙을 적용해 자동 생성 (임의 수치 없음) */
function LiveInsights() {
  const { data } = useQuery({
    queryKey: ["metrics", "llm-insights"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/llm/insights`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{
        sloP99Ms: number; model: string; at: string; items: InsightItem[];
      }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 15000,
    retry: false,
  });
  if (!KF_ENABLED || !data?.items?.length) return null;

  return (
    <div className="space-y-3">
      {data.items.map((it, i) => {
        const sv = SEV[it.severity];
        return (
          <Card key={i} className={cn("overflow-hidden", sv.card)}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", sv.icon)}>
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={sv.badge}>{sv.label}</Badge>
                      <Badge variant="success" className="text-[10px]">실측 기반 자동 진단</Badge>
                      <span className="text-xs text-muted-foreground">{data.at} 기준</span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold leading-tight">{it.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{it.detail}</p>
                  </div>

                  {it.evidence.length > 0 && (
                    <div className="grid gap-2 md:grid-cols-3">
                      {it.evidence.map((e) => (
                        <div key={e.label} className="rounded-lg border border-border bg-card p-2.5">
                          <div className="text-[10px] uppercase text-muted-foreground">{e.label}</div>
                          <div className="font-mono text-base font-bold tabular-nums">{e.value}</div>
                          {e.detail && <div className="text-[11px] text-muted-foreground">{e.detail}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {it.actions.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Lightbulb className="size-3.5 text-amber-600" />
                        권장 조치
                      </div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {it.actions.map((a) => (
                          <li key={a} className="flex items-start gap-1.5">
                            <ChevronRight className="mt-0.5 size-3 shrink-0 text-brand-indigo-500" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {i === 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/ai-development/serving">서빙 상태 보기</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/monitoring/traces">트레이스 보기</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** 실측 핫스팟 — vLLM 내장 torch profiler를 필요할 때만 켜서 연산별 시간 측정 */
function LiveHotspots() {
  const qc = useQueryClient();
  const { data: st } = useQuery({
    queryKey: ["metrics", "llm-profile"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/llm/profile`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<ProfileState>;
    },
    enabled: KF_ENABLED,
    retry: false,
  });
  const run = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${KF_BASE}/api/v1/metrics/llm/profile?samples=3&max_tokens=48`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error((await res.json()).detail ?? `${res.status}`);
      return res.json() as Promise<ProfileResult>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metrics", "llm-profile"] }),
  });

  if (!KF_ENABLED) return null;
  const r = run.data ?? st?.result ?? null;
  const max = r?.hotspots?.[0]?.ms || 1;

  return (
    <Card className="border-brand-mint-200">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              핫스팟 — 연산별 소요 시간
              <Badge variant="success" className="text-[10px]">실측</Badge>
            </CardTitle>
            <CardDescription>
              추론을 실제로 3회 실행하면서 어떤 연산이 시간을 쓰는지 측정합니다.
              프로파일러는 추론을 느리게 만들기 때문에 <b>누를 때만</b> 동작합니다.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? "측정 중… (약 40초)" : r ? "다시 측정" : "프로파일링 실행"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {run.isError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            측정 실패: {(run.error as Error).message}
          </div>
        )}
        {!r && !run.isPending && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            아직 측정 기록이 없습니다 — 위 버튼을 누르면 실제 추론을 추적해 결과를 보여줍니다.
          </div>
        )}
        {r && (
          <>
            <div className="pb-1 text-[11px] text-muted-foreground">
              샘플 {r.samples}회 · 최대 {r.maxTokens}토큰 · 추적 이벤트 {r.events.toLocaleString()}건 ·
              합계 {r.totalMs}ms{st?.at ? ` · 측정 시각 ${st.at}` : ""}
            </div>
            {r.hotspots.map((h, i) => (
              <div key={h.component} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Badge variant="ghost" className="font-mono">#{i + 1}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{h.component}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {h.reason} · {h.calls.toLocaleString()}회 호출 · {h.ops.join(", ")}
                  </div>
                </div>
                <div className="w-36">
                  <div className="text-right font-mono text-sm font-semibold tabular-nums">
                    {h.ms} ms <span className="text-muted-foreground">({h.pct}%)</span>
                  </div>
                  <Progress
                    value={(h.ms / max) * 100}
                    indicatorClassName={i === 0 ? "bg-rose-500" : i < 3 ? "bg-amber-500" : "bg-brand-mint-500"}
                  />
                </div>
              </div>
            ))}
          </>
        )}
        {st && !st.kernelLevel && (
          <p className="rounded-md border border-sky-200 bg-sky-50/70 p-2 text-[11px] leading-snug text-sky-900">
            <b>측정 범위 안내:</b> {st.kernelNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 실측 응답 시간 분포 — vLLM 히스토그램에서 계산한 분위수 */
function LiveLatencySection() {
  const { data: d } = useLlmDetail();
  if (!KF_ENABLED || !d) return null;
  const BR_COLORS: Record<string, string> = {
    ttft: "var(--brand-indigo-500)",
    decode: "var(--brand-mint-500)",
    other: "#94a3b8",
  };
  const total = d.breakdown.reduce((a, b) => a + b.ms, 0) || 1;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-brand-mint-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            응답 시간 분포
            <Badge variant="success" className="text-[10px]">실측</Badge>
          </CardTitle>
          <CardDescription>
            누적 {d.requests}건의 실제 요청 · P50/P95/P99 (백엔드 수집 시계열)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {([["P50", d.latency.p50Ms], ["P95", d.latency.p95Ms],
               ["P99", d.latency.p99Ms]] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/40 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {v != null ? `${v}ms` : "—"}
                </div>
              </div>
            ))}
          </div>
          {d.series.length > 1 ? (
            <ChartContainer
              config={{
                p50: { label: "P50", color: "var(--brand-mint-500)" },
                p95: { label: "P95", color: "var(--brand-indigo-500)" },
                p99: { label: "P99", color: "#e11d48" },
              }}
              className="h-[200px] w-full"
            >
              <LineChart data={d.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                       tickFormatter={(v) => `${v}ms`} />
                <RTooltip content={<ChartTooltipContent indicator="line" />} />
                <ReferenceLine
                  y={1000}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  label={{ value: "목표 1s", fill: "#e11d48", fontSize: 10, position: "right" }}
                />
                <Line type="monotone" dataKey="p50" stroke="var(--brand-mint-500)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="p95" stroke="var(--brand-indigo-500)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99" stroke="#e11d48" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              시계열을 모으는 중입니다 — 잠시 후 그래프가 그려집니다
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-brand-mint-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            응답 지연 구간 분해
            <Badge variant="success" className="text-[10px]">실측</Badge>
          </CardTitle>
          <CardDescription>
            평균 {d.latency.e2eMs ?? "—"}ms가 어디서 소요되는지 —
            TTFT {d.latency.ttftMs ?? "—"}ms · TPOT {d.latency.tpotMs ?? "—"}ms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary/30 p-2 text-[11px]">
            <div>
              <div className="font-mono font-semibold">TTFT</div>
              <div className="text-muted-foreground">Time To First Token — 첫 토큰까지 (프롬프트 처리 포함)</div>
              <div className="mt-0.5 font-mono">{d.latency.ttftMs ?? "—"}ms</div>
            </div>
            <div>
              <div className="font-mono font-semibold">TPOT</div>
              <div className="text-muted-foreground">Time Per Output Token — 토큰 1개 생성 평균</div>
              <div className="mt-0.5 font-mono">{d.latency.tpotMs ?? "—"}ms</div>
            </div>
            <div>
              <div className="font-mono font-semibold">E2E</div>
              <div className="text-muted-foreground">요청 전체 완료 시간 (TTFT + TPOT × 출력 토큰)</div>
              <div className="mt-0.5 font-mono">
                {d.latency.e2eMs ?? "—"}ms / {d.throughput.avgOutputTokens} tok
              </div>
            </div>
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-md">
            {d.breakdown.map((b) => (
              <div key={b.key}
                   style={{ width: `${Math.max((b.ms / total) * 100, 2)}%`,
                            background: BR_COLORS[b.key] }}
                   className="flex items-center justify-center text-[10px] font-semibold text-white"
                   title={`${b.stage}: ${b.ms}ms`}>
                {(b.ms / total) * 100 >= 15 ? `${Math.round((b.ms / total) * 100)}%` : ""}
              </div>
            ))}
          </div>
          {d.breakdown.map((b) => (
            <div key={b.key} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 rounded-sm" style={{ background: BR_COLORS[b.key] }} />
              <span className="flex-1">{b.stage}</span>
              <span className="font-mono tabular-nums">{b.ms}ms</span>
              <span className="w-10 text-right font-mono text-muted-foreground tabular-nums">
                {Math.round((b.ms / total) * 100)}%
              </span>
            </div>
          ))}
          <p className="text-[11px] leading-snug text-muted-foreground">
            첫 토큰까지가 길면 대기·프롬프트 처리가 병목이고, 디코드가 길면 생성 속도가 병목입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** KV cache·대기열·처리량 실측 — ETRI 검토의견(KV cache 지표 검증) 대응 */
function LiveCacheQueueSection() {
  const { data: d } = useLlmDetail();
  if (!KF_ENABLED || !d) return null;
  const cells: { label: string; value: string; hint: string }[] = [
    { label: "KV Cache 사용률", value: `${d.cache.gpuUsagePct}%`, hint: "GPU 캐시 점유" },
    { label: "Prefix 적중률",
      value: d.cache.prefixHitPct == null ? "측정 대기" : `${d.cache.prefixHitPct}%`,
      hint: "반복 프롬프트 재사용" },
    { label: "처리 중", value: `${d.queue.running}건`, hint: "동시 처리 요청" },
    { label: "대기열", value: `${d.queue.waiting}건`, hint: "순서 기다리는 요청" },
    { label: "선점 발생", value: `${d.queue.preemptions}회`, hint: "메모리 부족 중단" },
    { label: "생성 처리량", value: `${d.throughput.genTokPerSec} tok/s`, hint: "초당 토큰 생성" },
  ];
  return (
    <Card className="border-brand-mint-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4 text-brand-mint-600" />
          KV Cache · 대기열 · 처리량
          <Badge variant="success" className="text-[10px]">실측</Badge>
        </CardTitle>
        <CardDescription>
          vLLM이 제공하는 표준 지표입니다 — 요청당 평균 출력 {d.throughput.avgOutputTokens} 토큰
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg bg-secondary/40 p-3 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">{c.label}</div>
              <div className="mt-0.5 font-mono text-base font-bold tabular-nums">{c.value}</div>
              <div className="text-[10px] text-muted-foreground">{c.hint}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** 파이프라인 실행 시간 추이 — KFP 실행 기록 실측 */
function LiveRunHistory() {
  const { data } = useQuery({
    queryKey: ["metrics", "run-history"],
    queryFn: async () => {
      const list = await fetch(`${KF_BASE}/api/v1/pipelines`).then((r) => r.json());
      const withRuns = (list.items ?? []).filter((p: { runs: number }) => p.runs > 0);
      if (!withRuns.length) return { name: "", items: [] };
      const target = withRuns[withRuns.length - 1];
      const res = await fetch(`${KF_BASE}/api/v1/pipelines/${target.id}/run-history`);
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      return { name: target.name as string, items: d.items };
    },
    enabled: KF_ENABLED,
    refetchInterval: 30000,
    retry: false,
  });
  if (!KF_ENABLED || !data?.items?.length) return null;
  return (
    <Card className="border-brand-mint-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          실행 시간 추이
          <Badge variant="success" className="text-[10px]">실측</Badge>
        </CardTitle>
        <CardDescription>{data.name} · 최근 {data.items.length}회 실행의 총 소요시간</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ durSec: { label: "소요(초)", color: "var(--brand-indigo-500)" } }}
                        className="h-[200px] w-full">
          <BarChart data={data.items}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="at" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                   tickFormatter={(v) => `${v}s`} />
            <RTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="durSec" fill="var(--brand-indigo-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** 실측 LLM 추론 지표 — 클러스터에 배포된 vLLM의 표준 메트릭 (TTFT·TPOT·E2E) */
function LiveLlmCard() {
  const [testing, setTesting] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["metrics", "llm"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/llm`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<LlmMetrics>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 5000,
    retry: false,
  });
  if (!KF_ENABLED || !data) return null;

  async function fireTest() {
    setTesting(true);
    try {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "클라우드에서 GPU를 효율적으로 쓰는 팁을 한 문장으로.", maxTokens: 64 }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await res.json();
      refetch();
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="border-brand-mint-200">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-brand-mint-600" />
            실측 LLM 추론 지표
            <Badge variant="success" className="text-[10px]">LIVE</Badge>
          </CardTitle>
          <CardDescription>
            {data.model} · {data.engine} · {data.node} — 누적 {data.requests}건 평균
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fireTest} disabled={testing}>
            {testing ? "호출 중…" : "테스트 요청 보내기"}
          </Button>
          <Button size="sm" onClick={() => setChatOpen(true)}>
            <MessageSquare className="size-3.5" /> AI와 대화하기
          </Button>
        </div>
        <LlmChatDialog open={chatOpen} onOpenChange={(o) => { setChatOpen(o); if (!o) refetch(); }}
                       model={data.model} node={data.node} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <LlmStat label="TTFT" hint="첫 토큰까지" value={data.ttftMs != null ? `${data.ttftMs}ms` : "—"} />
          <LlmStat label="TPOT" hint="토큰당 생성" value={data.tpotMs != null ? `${data.tpotMs}ms` : "—"} />
          <LlmStat label="E2E 지연" hint="요청→완료" value={data.e2eMs != null ? `${data.e2eMs}ms` : "—"} />
          <LlmStat label="처리량" hint="tokens/sec" value={data.tokensPerSec != null ? `${data.tokensPerSec}` : "—"} />
          <LlmStat label="KV Cache" hint="사용률" value={`${data.kvCacheUsagePct}%`} />
          <LlmStat label="생성 토큰" hint="누적" value={`${data.generationTokens}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function LlmStat({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-3 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

interface WfStep { name: string; durSec: number; pct: number; phase: string }
interface WfRun {
  workflow: string; phase: string; startedAt: string; totalSec: number;
  steps: WfStep[]; bottleneck: string; bottleneckPct: number;
}

/** 실측 파이프라인 병목 — Argo Workflow 단계별 실행시간 분해 */
function LivePipelineBottleneck() {
  const { data } = useQuery({
    queryKey: ["metrics", "pipeline-runs"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/metrics/pipeline-runs`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: WfRun[] }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 10000,
    retry: false,
  });
  if (!KF_ENABLED || !data?.items.length) return null;
  const barColors = ["bg-brand-indigo-400", "bg-brand-mint-500", "bg-violet-400",
                     "bg-amber-400", "bg-sky-400"];
  return (
    <Card className="border-brand-mint-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="size-4 text-brand-mint-600" />
          실측 파이프라인 단계 분석
          <Badge variant="success" className="text-[10px]">LIVE</Badge>
        </CardTitle>
        <CardDescription>
          최근 실행된 워크플로우의 단계별 소요시간 (Argo 실측) — 가장 오래 걸린 단계가 병목
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.items.map((run) => (
          <div key={run.workflow} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs">{run.workflow}</span>
              <span className="text-xs text-muted-foreground">
                총 {run.totalSec}초 ·{" "}
                <span className="font-semibold text-amber-700">
                  병목: {run.bottleneck} ({run.bottleneckPct}%)
                </span>
                <Badge className="ml-2 text-[10px]"
                       variant={run.phase === "Succeeded" ? "success"
                                : run.phase === "Failed" ? "destructive" : "warning"}>
                  {run.phase}
                </Badge>
              </span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-md">
              {run.steps.map((s, i) => (
                <div key={s.name}
                     className={cn("flex items-center justify-center text-[10px] font-semibold text-white",
                                   barColors[i % barColors.length])}
                     style={{ width: `${Math.max(s.pct, 4)}%` }}
                     title={`${s.name}: ${s.durSec}s (${s.pct}%)`}>
                  {s.pct >= 12 ? `${s.name} ${s.pct}%` : ""}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {run.steps.map((s, i) => (
                <span key={s.name} className="inline-flex items-center gap-1">
                  <span className={cn("size-2 rounded-sm", barColors[i % barColors.length])} />
                  {s.name} {s.durSec}s
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ModelInsightsPage() {
  return (
    <div className="space-y-4">
      {/* 실측 GPU 라이브 */}
      <LiveGpuStrip />
      {/* Intro */}
      <Card className="border-sky-200 bg-gradient-to-br from-sky-50/60 to-transparent">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Sparkles className="size-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              ML 워크플로우 병목 분석
              <Badge variant="ghost" className="font-mono text-[10px]">Davis AI</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">모델을 만들어 배포하기까지의 각 단계</strong>와 <strong className="text-foreground">배포된 모델의 응답 지연</strong>을
              상관 분석해서 자동으로 병목 컴포넌트를 식별합니다.
              옵저버빌리티 시그널(메트릭·로그·트레이스)을 ML 워크플로우 컨텍스트로 재해석합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inference">
        <TabsList>
          <TabsTrigger value="inference">추론 병목 (서비스 응답)</TabsTrigger>
          <TabsTrigger value="pipeline">파이프라인 병목 (학습→배포)</TabsTrigger>
        </TabsList>

        {/* ── Inference ── */}
        <TabsContent value="inference" className="mt-4 space-y-4">
          <LiveServingMetrics />
          <LiveLlmCard />
          <LiveLatencySection />
          <LiveCacheQueueSection />
          <LiveInsights />

          <LiveHotspots />

        </TabsContent>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <LivePipelineBottleneck />
          <LiveRunHistory />
          <LivePipelineInsight />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Evidence({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: "rose" | "amber" | "indigo";
}) {
  const map = {
    rose: "border-rose-200 bg-rose-50/60",
    amber: "border-amber-200 bg-amber-50/60",
    indigo: "border-brand-indigo-200 bg-brand-indigo-50/60",
  };
  return (
    <div className={cn("rounded-lg border p-3", map[color])}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
      <div className="font-mono text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}
