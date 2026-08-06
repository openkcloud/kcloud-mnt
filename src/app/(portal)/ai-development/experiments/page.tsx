"use client";
import * as React from "react";
import { FlaskConical, Target, Plus, Zap, Award, Cpu, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { KFExperiment } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KF_BASE, KF_ENABLED } from "@/lib/kf";

// ─────────────────────────────────────────────────────────────
// Benchmark 시연 데이터 — ETRI 260615 §6.C.iii 반영
// ─────────────────────────────────────────────────────────────
const HW_BENCHMARKS = [
  { name: "MLPerf Inference 4.1 · Llama-3.1 8B", hw: "NVIDIA A100 40GB", tokens_s: 3421, latency_ms: 42, notes: "TP=1, batch=32" },
  { name: "MLPerf Inference 4.1 · Llama-3.1 8B", hw: "NVIDIA H100 80GB", tokens_s: 8752, latency_ms: 18, notes: "TP=1, batch=64" },
  { name: "MLPerf Inference 4.1 · Llama-3.1 8B", hw: "Rebellions REBEL Quad", tokens_s: 5218, latency_ms: 24, notes: "batch=32, INT8" },
  { name: "MLPerf Inference 4.1 · Llama-3.1 8B", hw: "Furiosa RNGD × 2", tokens_s: 3892, latency_ms: 31, notes: "batch=16" },
  { name: "MLPerf Training 3.1 · ResNet-50", hw: "NVIDIA A100 × 8", tokens_s: 2450, latency_ms: 0, notes: "images/s, mixed precision" },
  { name: "MLPerf Training 3.1 · BERT-Large", hw: "NVIDIA H100 × 8", tokens_s: 1820, latency_ms: 0, notes: "steps/s, TF32" },
];

const MODEL_BENCHMARKS = [
  { model: "Llama-3.1 70B", bench: "MMLU (5-shot)", score: 82.3, unit: "%", target: 80 },
  { model: "Llama-3.1 70B", bench: "HumanEval", score: 78.4, unit: "%", target: 75 },
  { model: "Llama-3.1 70B", bench: "GSM8K", score: 87.1, unit: "%", target: 85 },
  { model: "Solar-10.7B", bench: "MMLU (5-shot)", score: 66.2, unit: "%", target: 65 },
  { model: "Qwen2.5-14B", bench: "MMLU (5-shot)", score: 72.1, unit: "%", target: 70 },
  { model: "Qwen2.5-14B", bench: "HumanEval", score: 71.8, unit: "%", target: 70 },
];

export default function ExperimentsPage() {
  const { data, isLoading } = api.kubeflow.experiments() as {
    data: { items: KFExperiment[] } | undefined;
    isLoading: boolean;
  };
  const [createOpen, setCreateOpen] = React.useState(false);
  const qc = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function removeExperiment(name: string, namespace: string) {
    if (!KF_ENABLED) {
      toast.info("mock 모드 — 삭제는 실백엔드 연동 시 동작합니다");
      return;
    }
    if (!window.confirm(`"${name}" 실험을 삭제할까요?\n실행된 시도(Trial) 기록도 함께 사라집니다.`))
      return;
    setBusy(name);
    try {
      const res = await fetch(
        `${KF_BASE}/api/v1/experiments/${name}?namespace=${encodeURIComponent(namespace)}`,
        { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : `${res.status}`);
      }
      toast.success(`"${name}" 실험을 삭제했습니다`);
      qc.invalidateQueries({ queryKey: ["kf", "experiments"] });
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Experiments — Hyperparameter Optimization (HPO)"
        description="Katib 기반 HPO 실험 + 하드웨어·모델 벤치마크"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> 실험 정의
          </Button>
        }
      />

      <Tabs defaultValue="hpo">
        <TabsList>
          <TabsTrigger value="hpo">HPO 실험 ({data.items.length})</TabsTrigger>
          <TabsTrigger value="hw">하드웨어 벤치마크 (MLPerf)</TabsTrigger>
          <TabsTrigger value="model">모델 성능 벤치마크</TabsTrigger>
        </TabsList>

        <TabsContent value="hpo">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>실험</TableHead>
                  <TableHead>파이프라인</TableHead>
                  <TableHead>목표</TableHead>
                  <TableHead>현재 최고치</TableHead>
                  <TableHead>진척률</TableHead>
                  <TableHead>시도</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="w-16 text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((e) => {
                  const isMax = e.objective.includes("maximize");
                  const progress = isMax
                    ? Math.min(100, Math.round((e.bestMetric / e.goal) * 100))
                    : Math.min(100, Math.round((e.goal / e.bestMetric) * 100));
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FlaskConical className="size-4 text-amber-600" />
                          <span className="font-medium">{e.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.pipelineId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Target className="size-3.5 text-muted-foreground" />
                          <span className="text-xs">{e.objective}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">{e.goal}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{e.bestMetric}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="w-24" indicatorClassName="bg-amber-500" />
                          <span className="font-mono text-xs tabular-nums">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{e.trials}</TableCell>
                      <TableCell>
                        <Badge
                          variant={e.status === "Succeeded" ? "success" : e.status === "Failed" ? "destructive" : "warning"}
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === e.name}
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => removeExperiment(e.name, e.namespace ?? "")}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hw" className="space-y-4">
          <LiveHwBenchmark />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4 text-amber-600" />
                하드웨어 벤치마크 — MLPerf (참고 자료)
              </CardTitle>
              <CardDescription>
                이종 AI 가속기(NVIDIA A100/H100·Rebellions REBEL Quad·Furiosa RNGD)의 표준 벤치마크 결과 비교
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>벤치마크</TableHead>
                    <TableHead>하드웨어</TableHead>
                    <TableHead className="text-right">Throughput</TableHead>
                    <TableHead className="text-right">Latency (ms)</TableHead>
                    <TableHead>비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {HW_BENCHMARKS.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{b.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="size-3.5 text-brand-mint-600" />
                          <span className="font-mono text-xs">{b.hw}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {b.tokens_s.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {b.latency_ms || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="model" className="space-y-4">
          <LiveModelBenchmark />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4 text-brand-indigo-600" />
                모델 성능 벤치마크 (참고 자료)
              </CardTitle>
              <CardDescription>
                MMLU · HumanEval · GSM8K 등 대표 벤치마크로 모델 품질 비교
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>모델</TableHead>
                    <TableHead>벤치마크</TableHead>
                    <TableHead className="text-right">점수</TableHead>
                    <TableHead>목표 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODEL_BENCHMARKS.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{b.model}</TableCell>
                      <TableCell className="text-xs">{b.bench}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">
                        {b.score}{b.unit}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, (b.score / b.target) * 100)}
                            className="w-24"
                            indicatorClassName={b.score >= b.target ? "bg-brand-mint-500" : "bg-amber-500"}
                          />
                          <span className={`font-mono text-[10px] tabular-nums ${b.score >= b.target ? "text-brand-mint-700" : "text-amber-600"}`}>
                            목표 {b.target}{b.unit}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateExperimentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 실측 하드웨어 벤치마크 — 클러스터 GPU에서 직접 실행 (matmul·대역폭)
// ─────────────────────────────────────────────────────────────
interface HwBenchResult {
  node: string;
  status: string;
  gpu: string;
  fp32Tflops: number | null;
  fp16Tflops: number | null;
  memBwGbs: number | null;
  vramGb: number | null;
}

function LiveHwBenchmark() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["bench", "hw"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/benchmarks`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: HwBenchResult[] }>;
    },
    enabled: KF_ENABLED,
    refetchInterval: 10000,
  });
  if (!KF_ENABLED) return null;

  async function run() {
    try {
      const res = await fetch(`${KF_BASE}/api/v1/benchmarks/run`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success("벤치마크 실행 시작 — 노드별 GPU Job 생성됨 (약 1분)");
      qc.invalidateQueries({ queryKey: ["bench", "hw"] });
    } catch (e) {
      toast.error(`실행 실패: ${(e as Error).message}`);
    }
  }

  return (
    <Card className="border-brand-mint-200">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-brand-mint-600" />
            클러스터 GPU 실측 벤치마크
            <Badge variant="success" className="text-[10px]">실측</Badge>
          </CardTitle>
          <CardDescription>
            현재 클러스터 가속기에서 직접 실행한 결과 — 행렬곱 연산 성능(TFLOPS)·메모리 대역폭
          </CardDescription>
        </div>
        <Button size="sm" onClick={run}>
          <Zap className="size-3.5" /> 벤치마크 실행
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GPU</TableHead>
              <TableHead>노드</TableHead>
              <TableHead className="text-right">FP32 (TFLOPS)</TableHead>
              <TableHead className="text-right">FP16 (TFLOPS)</TableHead>
              <TableHead className="text-right">메모리 대역폭</TableHead>
              <TableHead className="text-right">VRAM</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((b) => (
              <TableRow key={b.node}>
                <TableCell className="font-mono text-xs">{b.gpu}</TableCell>
                <TableCell className="font-mono text-xs">{b.node}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{b.fp32Tflops ?? "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{b.fp16Tflops ?? "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{b.memBwGbs ? `${b.memBwGbs} GB/s` : "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{b.vramGb ? `${b.vramGb} GB` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.status === "Done" ? "success" : b.status === "Failed" ? "destructive" : "warning"}>
                    {b.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                  아직 실측 결과가 없습니다 — &quot;벤치마크 실행&quot;을 눌러주세요
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 실측 모델 성능 벤치마크 — 배포된 InferenceService 부하 테스트
// ─────────────────────────────────────────────────────────────
interface ServingItem { id: string; name: string; status: string; modelName: string }
interface ModelBenchResult {
  name: string; requests: number; concurrency: number; rps: number;
  avgMs: number; p50Ms: number; p95Ms: number; p99Ms: number;
  errorRate: number; at: string;
}

function LiveModelBenchmark() {
  const qc = useQueryClient();
  const [running, setRunning] = React.useState<string | null>(null);
  const { data: servings } = api.kubeflow.serving() as {
    data: { items: ServingItem[] } | undefined;
  };
  const { data: results } = useQuery({
    queryKey: ["bench", "model"],
    queryFn: async () => {
      const res = await fetch(`${KF_BASE}/api/v1/benchmarks/model`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ items: ModelBenchResult[] }>;
    },
    enabled: KF_ENABLED,
  });
  if (!KF_ENABLED) return null;
  const ready = (servings?.items ?? []).filter((s) => s.status === "Ready");
  const byName = new Map((results?.items ?? []).map((r) => [r.name, r]));

  async function run(name: string) {
    setRunning(name);
    try {
      const res = await fetch(
        `${KF_BASE}/api/v1/benchmarks/model/${name}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests: 100, concurrency: 10 }),
        },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const r = (await res.json()) as ModelBenchResult;
      toast.success(`${name} 부하 테스트 완료 — ${r.rps} RPS · p95 ${r.p95Ms}ms`);
      qc.invalidateQueries({ queryKey: ["bench", "model"] });
    } catch (e) {
      toast.error(`테스트 실패: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card className="border-brand-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-brand-indigo-600" />
          배포 모델 부하 테스트
          <Badge variant="success" className="text-[10px]">실측</Badge>
        </CardTitle>
        <CardDescription>
          현재 Serving 중인 모델에 100회 동시 호출(동시성 10) — 처리량·지연 분포·오류율 실측
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>모델</TableHead>
              <TableHead className="text-right">RPS</TableHead>
              <TableHead className="text-right">p50</TableHead>
              <TableHead className="text-right">p95</TableHead>
              <TableHead className="text-right">p99</TableHead>
              <TableHead className="text-right">오류율</TableHead>
              <TableHead className="text-right">측정 시각</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ready.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                  Ready 상태의 배포 모델이 없습니다 — Serving 탭에서 먼저 배포하세요
                </TableCell>
              </TableRow>
            )}
            {ready.map((s) => {
              const r = byName.get(s.name);
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{s.name}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">({s.modelName})</span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r?.rps ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r ? `${r.p50Ms}ms` : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r ? `${r.p95Ms}ms` : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r ? `${r.p99Ms}ms` : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r ? `${(r.errorRate * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{r?.at ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={running === s.name}
                            onClick={() => run(s.name)}>
                      {running === s.name ? "측정 중…" : "부하 테스트"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 실험 정의 다이얼로그 — ETRI 260615 §6.C.i 반영
// ─────────────────────────────────────────────────────────────
function CreateExperimentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [workspace, setWorkspace] = React.useState("ai-research");
  const { data: wsData } = api.kubeflow.profiles() as {
    data: { items: { name: string }[] } | undefined;
  };
  const workspaces = wsData?.items.map((w) => w.name) ?? ["ai-research"];
  const [objective, setObjective] = React.useState<"maximize" | "minimize">("maximize");
  const [metric, setMetric] = React.useState("accuracy");
  const [goal, setGoal] = React.useState("0.95");
  const [maxTrials, setMaxTrials] = React.useState("50");
  const [algorithm, setAlgorithm] = React.useState<"random" | "bayesian" | "grid" | "hyperband" | "tpe">("bayesian");

  const qc = useQueryClient();
  const [busy, setBusy] = React.useState(false);

  // K8s 리소스 이름 규칙 — 노트북과 동일 (소문자·숫자·하이픈)
  const validName = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
  const nameError =
    name.trim() === ""
      ? ""
      : /[A-Z]/.test(name)
        ? "대문자는 사용할 수 없습니다 — 소문자로 입력하세요"
        : /[^a-z0-9-]/.test(name)
          ? "영문 소문자·숫자·하이픈(-)만 사용할 수 있습니다 (밑줄·한글·공백 불가)"
          : !validName
            ? "이름은 영문/숫자로 시작하고 끝나야 합니다"
            : "";

  const submit = async () => {
    if (!validName) return;
    if (!KF_ENABLED) {
      toast.success(`HPO 실험 '${name}' 등록됨 (mock)`, {
        description: `${algorithm} · ${objective} ${metric} → ${goal} · 최대 ${maxTrials}회 시도`,
      });
      onClose();
      return;
    }
    setBusy(true);
    try {
      const algoMap: Record<string, string> = {
        bayesian: "bayesianoptimization", tpe: "tpe", random: "random",
        grid: "grid", hyperband: "hyperband",
      };
      const res = await fetch(`${KF_BASE}/api/v1/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          namespace: workspace,
          metric,
          objectiveType: objective,
          goal: Number(goal),
          algorithm: algoMap[algorithm],
          maxTrials: Number(maxTrials),
          parallelTrials: 2,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      toast.success(`HPO 실험 '${name}' 시작 — Trial 실행 중`);
      qc.invalidateQueries({ queryKey: ["kf", "experiments"] });
      setName("");
      onClose();
    } catch (e) {
      toast.error(`실험 등록 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>실험 정의 (Hyperparameter Optimization)</DialogTitle>
          <DialogDescription>
            Katib 기반 HPO 실험을 새로 정의한다. 파이프라인의 파라미터 공간을 탐색해 최적값을 찾음.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>실험 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="lora-lr-tuning-v3 (소문자·숫자·하이픈)"
                   aria-invalid={!!nameError} />
            {nameError ? (
              <p className="mt-1 text-[11px] text-rose-600">{nameError}</p>
            ) : name.trim() === "" ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                이름을 입력하면 등록 버튼이 활성화됩니다
              </p>
            ) : null}
          </div>
          <div>
            <Label>실행 워크스페이스</Label>
            <Select value={workspace} onValueChange={setWorkspace}>
              <SelectTrigger><SelectValue placeholder="워크스페이스 선택" /></SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              선택한 워크스페이스의 자원으로 Trial이 실행됩니다
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>탐색 알고리즘</Label>
              <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as typeof algorithm)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bayesian">Bayesian Optimization</SelectItem>
                  <SelectItem value="tpe">TPE (Tree-structured Parzen)</SelectItem>
                  <SelectItem value="random">Random Search</SelectItem>
                  <SelectItem value="grid">Grid Search</SelectItem>
                  <SelectItem value="hyperband">Hyperband</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>최대 시도 횟수</Label>
              <Input type="number" value={maxTrials} onChange={(e) => setMaxTrials(e.target.value)} min="1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>목표 유형</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as "maximize" | "minimize")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maximize">Maximize</SelectItem>
                  <SelectItem value="minimize">Minimize</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>메트릭</Label>
              <Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="accuracy" className="font-mono text-xs" />
            </div>
            <div>
              <Label>목표값</Label>
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900">
            파라미터 공간(learning rate, batch size 등)은 다음 단계에서 지정한다 — 여기선 실험 뼈대만 등록.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit} disabled={busy || !validName}>
            {busy ? "등록 중…" : "실험 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
