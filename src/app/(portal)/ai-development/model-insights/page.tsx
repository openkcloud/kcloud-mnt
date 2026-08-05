"use client";
import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Cpu,
  Database,
  Zap,
  ChevronRight,
  Lightbulb,
  Activity,
  GitBranch,
  Clock,
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
import { useQuery } from "@tanstack/react-query";

// ─── Pipeline stage breakdown ───
const PIPELINE_STAGES = [
  { stage: "load-dataset", durSec: 320, pct: 9, status: "ok" as const, type: "data" },
  { stage: "tokenize", durSec: 184, pct: 5, status: "ok" as const, type: "data" },
  { stage: "LoRA finetune", durSec: 2140, pct: 60, status: "warning" as const, type: "ml" },
  { stage: "eval", durSec: 412, pct: 12, status: "ok" as const, type: "compute" },
  { stage: "register-model", durSec: 38, pct: 1, status: "ok" as const, type: "deploy" },
  { stage: "deploy-kserve", durSec: 460, pct: 13, status: "ok" as const, type: "deploy" },
];

// ─── Inference latency breakdown ───
const LATENCY_BREAKDOWN = [
  { stage: "Tokenize", ms: 12, pct: 1, color: "var(--brand-indigo-300)" },
  { stage: "Embedding", ms: 28, pct: 2, color: "var(--brand-indigo-400)" },
  { stage: "Attention (Layer 0-15)", ms: 184, pct: 19, color: "var(--brand-indigo-500)" },
  { stage: "Attention (Layer 16-31)", ms: 322, pct: 33, color: "#e11d48" },
  { stage: "FFN", ms: 218, pct: 22, color: "var(--brand-indigo-600)" },
  { stage: "Sampling", ms: 84, pct: 9, color: "var(--brand-mint-500)" },
  { stage: "Detokenize", ms: 32, pct: 3, color: "var(--brand-mint-400)" },
  { stage: "기타 (overhead)", ms: 100, pct: 10, color: "#94a3b8" },
];

const LATENCY_TREND = Array.from({ length: 60 }, (_, i) => ({
  t: `${(60 - i)}m`,
  p50: 220 + Math.sin(i / 5) * 30 + Math.random() * 20,
  p95: 620 + Math.sin(i / 4) * 80 + Math.random() * 40,
  p99: 820 + Math.sin(i / 6) * 120 + (i > 45 ? 200 : 0) + Math.random() * 60,
})).reverse();

const HOTSPOTS = [
  { component: "Attention Layer 22 (GQA)", hostMs: 84, gpu: "acc-a100-1-3", reason: "KV cache 미스율 41%" },
  { component: "Attention Layer 28 (GQA)", hostMs: 76, gpu: "acc-a100-1-3", reason: "KV cache 미스율 38%" },
  { component: "FFN Layer 24 (SwiGLU)", hostMs: 58, gpu: "acc-a100-1-3", reason: "memory bandwidth 89%" },
  { component: "Tokenizer (BPE)", hostMs: 12, gpu: "CPU", reason: "single-thread bottleneck" },
];

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_KF_API}/api/v1/metrics/gpu`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: GpuMetric[] }>;
    },
    enabled: !!process.env.NEXT_PUBLIC_KF_API,
    refetchInterval: 3000,
  });
  if (!process.env.NEXT_PUBLIC_KF_API || !data) return null;
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
              <strong className="text-foreground">학습 파이프라인 각 단계</strong>와 <strong className="text-foreground">추론 단계별 지연</strong>을
              상관 분석해서 자동으로 병목 컴포넌트를 식별합니다.
              옵저버빌리티 시그널(메트릭·로그·트레이스)을 ML 워크플로우 컨텍스트로 재해석합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inference">
        <TabsList>
          <TabsTrigger value="inference">추론 병목 (Inference)</TabsTrigger>
          <TabsTrigger value="pipeline">파이프라인 병목 (Training)</TabsTrigger>
        </TabsList>

        {/* ── Inference ── */}
        <TabsContent value="inference" className="mt-4 space-y-4">
          {/* Davis insight */}
          <Card className="overflow-hidden border-rose-200 bg-gradient-to-br from-rose-50 to-transparent">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Critical</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">AI Davis Insight</Badge>
                      <span className="text-xs text-muted-foreground">12분 전 자동 감지</span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold leading-tight">
                      vllm-solar-10b 추론 지연 P99이 SLO를 18% 초과하고 있습니다.
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      트레이스 1,240건과 호스트 메트릭 시리즈 32종을 상관 분석한 결과,
                      <strong className="text-foreground"> Attention Layer 22/28에서 KV cache 미스가 폭증</strong>한 것이 주 원인입니다.
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <Evidence label="근본 원인" value="KV Cache 미스율" detail="38-41% (정상: 8%)" color="rose" />
                    <Evidence label="영향받는 요청" value="2,184 req / 1h" detail="전체 18.4%" color="amber" />
                    <Evidence label="비즈니스 영향" value="SLO 위반" detail="P99 < 1s 미달" color="rose" />
                  </div>

                  <div className="space-y-2 rounded-lg border border-rose-200 bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Lightbulb className="size-3.5 text-amber-600" />
                      권장 조치
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="size-3 mt-0.5 shrink-0 text-brand-indigo-500" />
                        KV cache 크기를 <strong className="text-foreground">32GB → 48GB</strong>로 확장 (acc-a100-1-3 유휴 메모리 16GB 활용)
                      </li>
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="size-3 mt-0.5 shrink-0 text-brand-indigo-500" />
                        vLLM <strong className="text-foreground">PagedAttention</strong> block size를 16 → 32로 조정
                      </li>
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="size-3 mt-0.5 shrink-0 text-brand-indigo-500" />
                        <strong className="text-foreground">Rebellions REBEL Quad</strong>로 한 레플리카 이전 (전성비 +22%)
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm">권장 조치 자동 적용</Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/monitoring/traces">트레이스 보기</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Latency breakdown + trend */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>응답 시간 트렌드</CardTitle>
                <CardDescription>지난 60분 · P50 / P95 / P99 · 1초 SLO 라인</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    p50: { label: "P50", color: "var(--brand-mint-500)" },
                    p95: { label: "P95", color: "var(--brand-indigo-500)" },
                    p99: { label: "P99", color: "#e11d48" },
                  }}
                  className="h-[240px] w-full"
                >
                  <LineChart data={LATENCY_TREND}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                    <RTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ReferenceLine y={1000} stroke="#e11d48" strokeDasharray="4 4" label={{ value: "SLO 1s", fill: "#e11d48", fontSize: 10, position: "right" }} />
                    <Line type="monotone" dataKey="p50" stroke="var(--brand-mint-500)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="p95" stroke="var(--brand-indigo-500)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p99" stroke="#e11d48" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>1 token 지연 분해 (TPOT)</CardTitle>
                <CardDescription>
                  vllm-solar-10b · <strong className="text-foreground">TPOT (Time Per Output Token)</strong> = 980ms 평균 · 단계별 기여도
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary/30 p-2 text-[11px]">
                  <div>
                    <div className="font-mono font-semibold">TTFT</div>
                    <div className="text-muted-foreground">Time To First Token — 첫 토큰까지 지연 (prompt 처리 포함)</div>
                    <div className="mt-0.5 font-mono">142ms</div>
                  </div>
                  <div>
                    <div className="font-mono font-semibold">TPOT</div>
                    <div className="text-muted-foreground">Time Per Output Token — 토큰 1개 생성 평균 시간</div>
                    <div className="mt-0.5 font-mono">980ms</div>
                  </div>
                  <div>
                    <div className="font-mono font-semibold">E2E Latency</div>
                    <div className="text-muted-foreground">요청 전체 완료 시간 (TTFT + TPOT × 출력 토큰 수)</div>
                    <div className="mt-0.5 font-mono">3.4s / 512 tok</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {LATENCY_BREAKDOWN.map((s) => (
                    <div key={s.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                          {s.stage}
                        </span>
                        <span className="font-mono tabular-nums">
                          <strong>{s.ms}ms</strong>
                          <span className="ml-1 text-muted-foreground">({s.pct}%)</span>
                        </span>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900">
                  <strong>KV Cache 미스율 산출 방식:</strong> vLLM 표준 메트릭 <code className="font-mono text-[10px] bg-white/50 px-1 rounded">gpu_cache_usage_perc</code> +
                  <code className="font-mono text-[10px] bg-white/50 px-1 rounded ml-1">num_preemptions_total</code>을 조합해 계산한다.
                  Attention Layer 프로파일링은 <strong>1분 주기 샘플링</strong> (실시간 아님) — 추론 오버헤드 최소화.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hot spots */}
          <Card>
            <CardHeader>
              <CardTitle>핫스팟 — 모델 그래프 노드별 GPU 시간</CardTitle>
              <CardDescription>Method Hotspots — 가장 느린 컴포넌트 순위</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {HOTSPOTS.map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Badge variant="ghost" className="font-mono">#{i + 1}</Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{h.component}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {h.gpu} · {h.reason}
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="text-right font-mono text-sm font-semibold tabular-nums">{h.hostMs} ms</div>
                    <Progress
                      value={(h.hostMs / 84) * 100}
                      indicatorClassName={i < 2 ? "bg-rose-500" : i < 3 ? "bg-amber-500" : "bg-brand-mint-500"}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4" />
                llama-3-finetune-pipeline · 실행 #014
              </CardTitle>
              <CardDescription>총 60분 18초 — 각 단계 시간 비중</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PIPELINE_STAGES.map((s) => (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                            s.type === "data" && "bg-sky-100 text-sky-800",
                            s.type === "ml" && "bg-brand-mint-50 text-brand-mint-700",
                            s.type === "compute" && "bg-violet-100 text-violet-800",
                            s.type === "deploy" && "bg-rose-100 text-rose-800",
                          )}
                        >
                          {s.type}
                        </span>
                        <span className="font-mono">{s.stage}</span>
                        {s.status === "warning" && (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <AlertTriangle className="size-3" /> 병목
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono tabular-nums text-foreground">
                        <strong>{Math.floor(s.durSec / 60)}분 {s.durSec % 60}초</strong>
                        <span className="ml-1 text-xs text-muted-foreground">({s.pct}%)</span>
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          s.status === "warning" ? "bg-amber-500" : "bg-brand-indigo-500",
                        )}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pipeline-specific Davis insight */}
          <Card className="overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-transparent">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">Warning</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">Pipeline Insight</Badge>
                    </div>
                    <h2 className="mt-1 text-lg font-bold leading-tight">
                      LoRA finetune 단계가 전체 시간의 60%를 차지합니다.
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <strong className="text-foreground">acc-a100-1-3</strong>의 GPU 활용률이 평균 62%로,
                      파이프라인 동안 약 <strong className="text-foreground">810초의 유휴 시간</strong>이 발생했습니다.
                      배치 크기를 키우거나, REBEL Quad로 분산 학습 시 전체 시간을 25-30% 단축할 수 있습니다.
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <Evidence label="GPU 평균 활용률" value="62%" detail="이상치 비교 ↓18%" color="amber" />
                    <Evidence label="유휴 시간" value="810초" detail="전체 22.7%" color="amber" />
                    <Evidence label="개선 잠재" value="~25-30%" detail="배치 키우기 + 분산" color="indigo" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/ai-development/pipelines">파이프라인 편집</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>실행 시간 추이 (최근 10회)</CardTitle>
              <CardDescription>같은 파이프라인의 run별 총 소요시간</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ secs: { label: "초", color: "var(--brand-indigo-500)" } }}
                className="h-[200px] w-full"
              >
                <BarChart
                  data={Array.from({ length: 10 }, (_, i) => ({
                    run: `#${(14 - 9 + i).toString().padStart(3, "0")}`,
                    secs: 3000 + Math.sin(i / 2) * 400 + (i === 9 ? 600 : 0) + Math.random() * 200,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="run" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 60)}m`} />
                  <RTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="secs" radius={[4, 4, 0, 0]} fill="var(--brand-indigo-500)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
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
