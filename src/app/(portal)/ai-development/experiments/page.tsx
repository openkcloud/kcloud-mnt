"use client";
import * as React from "react";
import { ChangeMark } from "@/components/change-mark";
import { FlaskConical, Target, Plus, Zap, Award, Cpu } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KFExperiment } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Benchmark 시연 데이터 — ETRI 260615 §6.C.iii 반영
// ─────────────────────────────────────────────────────────────
const HW_BENCHMARKS = [
  {
    name: "MLPerf Inference 4.1 · Llama-3.1 8B",
    hw: "NVIDIA A100 40GB",
    tokens_s: 3421,
    latency_ms: 42,
    notes: "TP=1, batch=32",
  },
  {
    name: "MLPerf Inference 4.1 · Llama-3.1 8B",
    hw: "NVIDIA H100 80GB",
    tokens_s: 8752,
    latency_ms: 18,
    notes: "TP=1, batch=64",
  },
  {
    name: "MLPerf Inference 4.1 · Llama-3.1 8B",
    hw: "Rebellions REBEL Quad",
    tokens_s: 5218,
    latency_ms: 24,
    notes: "batch=32, INT8",
  },
  {
    name: "MLPerf Inference 4.1 · Llama-3.1 8B",
    hw: "Furiosa RNGD × 2",
    tokens_s: 3892,
    latency_ms: 31,
    notes: "batch=16",
  },
  {
    name: "MLPerf Training 3.1 · ResNet-50",
    hw: "NVIDIA A100 × 8",
    tokens_s: 2450,
    latency_ms: 0,
    notes: "images/s, mixed precision",
  },
  {
    name: "MLPerf Training 3.1 · BERT-Large",
    hw: "NVIDIA H100 × 8",
    tokens_s: 1820,
    latency_ms: 0,
    notes: "steps/s, TF32",
  },
];

const MODEL_BENCHMARKS = [
  {
    model: "Llama-3.1 70B",
    bench: "MMLU (5-shot)",
    score: 82.3,
    unit: "%",
    target: 80,
  },
  {
    model: "Llama-3.1 70B",
    bench: "HumanEval",
    score: 78.4,
    unit: "%",
    target: 75,
  },
  {
    model: "Llama-3.1 70B",
    bench: "GSM8K",
    score: 87.1,
    unit: "%",
    target: 85,
  },
  {
    model: "Solar-10.7B",
    bench: "MMLU (5-shot)",
    score: 66.2,
    unit: "%",
    target: 65,
  },
  {
    model: "Qwen2.5-14B",
    bench: "MMLU (5-shot)",
    score: 72.1,
    unit: "%",
    target: 70,
  },
  {
    model: "Qwen2.5-14B",
    bench: "HumanEval",
    score: 71.8,
    unit: "%",
    target: 70,
  },
];

export default function ExperimentsPage() {
  const { data, isLoading } = api.kubeflow.experiments() as {
    data: { items: KFExperiment[] } | undefined;
    isLoading: boolean;
  };
  const [createOpen, setCreateOpen] = React.useState(false);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Experiments — Hyperparameter Optimization (HPO)"
        description="Katib 기반 HPO 실험 + 하드웨어·모델 벤치마크"
        actions={
          <ChangeMark ids={["CR-AID-03"]} inline>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> 실험 정의
            </Button>
          </ChangeMark>
        }
      />

      <Tabs defaultValue="hpo">
        <ChangeMark ids={["CR-AID-04", "CR-AID-05"]} inline>
          <TabsList>
            <TabsTrigger value="hpo">
              HPO 실험 ({data.items.length})
            </TabsTrigger>
            <TabsTrigger value="hw">하드웨어 벤치마크 (MLPerf)</TabsTrigger>
            <TabsTrigger value="model">모델 성능 벤치마크</TabsTrigger>
          </TabsList>
        </ChangeMark>

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
                      <TableCell className="font-mono text-xs">
                        {e.pipelineId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Target className="size-3.5 text-muted-foreground" />
                          <span className="text-xs">{e.objective}</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {e.goal}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {e.bestMetric}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={progress}
                            className="w-24"
                            indicatorClassName="bg-amber-500"
                          />
                          <span className="font-mono text-xs tabular-nums">
                            {progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {e.trials}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            e.status === "Succeeded"
                              ? "success"
                              : e.status === "Failed"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hw">
          <ChangeMark ids={["CR-AID-05"]}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="size-4 text-amber-600" />
                  하드웨어 벤치마크 — MLPerf
                </CardTitle>
                <CardDescription>
                  이종 AI 가속기(NVIDIA A100/H100·Rebellions REBEL Quad·Furiosa
                  RNGD)의 표준 벤치마크 결과 비교
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
                        <TableCell className="text-xs text-muted-foreground">
                          {b.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </ChangeMark>
        </TabsContent>

        <TabsContent value="model">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4 text-brand-indigo-600" />
                모델 성능 벤치마크
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
                      <TableCell className="font-mono text-xs">
                        {b.model}
                      </TableCell>
                      <TableCell className="text-xs">{b.bench}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">
                        {b.score}
                        {b.unit}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, (b.score / b.target) * 100)}
                            className="w-24"
                            indicatorClassName={
                              b.score >= b.target
                                ? "bg-brand-mint-500"
                                : "bg-amber-500"
                            }
                          />
                          <span
                            className={`font-mono text-[10px] tabular-nums ${b.score >= b.target ? "text-brand-mint-700" : "text-amber-600"}`}
                          >
                            목표 {b.target}
                            {b.unit}
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

      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 실험 정의 다이얼로그 — ETRI 260615 §6.C.i 반영
// ─────────────────────────────────────────────────────────────
function CreateExperimentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [pipeline, setPipeline] = React.useState("pl-1");
  const [objective, setObjective] = React.useState<"maximize" | "minimize">(
    "maximize",
  );
  const [metric, setMetric] = React.useState("accuracy");
  const [goal, setGoal] = React.useState("0.95");
  const [maxTrials, setMaxTrials] = React.useState("50");
  const [algorithm, setAlgorithm] = React.useState<
    "random" | "bayesian" | "grid" | "hyperband" | "tpe"
  >("bayesian");

  const submit = () => {
    if (!name.trim()) return;
    toast.success(`HPO 실험 '${name}' 등록됨`, {
      description: `${algorithm} · ${objective} ${metric} → ${goal} · 최대 ${maxTrials}회 시도`,
    });
    setName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>실험 정의 (Hyperparameter Optimization)</DialogTitle>
          <DialogDescription>
            Katib 기반 HPO 실험을 새로 정의한다. 파이프라인의 파라미터 공간을
            탐색해 최적값을 찾음.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>실험 이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="lora-lr-tuning-v3"
            />
          </div>
          <div>
            <Label>대상 파이프라인</Label>
            <Select value={pipeline} onValueChange={setPipeline}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pl-1">pl-1 · LoRA 파인튜닝</SelectItem>
                <SelectItem value="pl-2">
                  pl-2 · Whisper 양자화·엣지 배포
                </SelectItem>
                <SelectItem value="pl-3">pl-3 · vLLM 부하 테스트</SelectItem>
                <SelectItem value="pl-4">pl-4 · PIM 커널 벤치</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>탐색 알고리즘</Label>
              <Select
                value={algorithm}
                onValueChange={(v) => setAlgorithm(v as typeof algorithm)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bayesian">
                    Bayesian Optimization
                  </SelectItem>
                  <SelectItem value="tpe">
                    TPE (Tree-structured Parzen)
                  </SelectItem>
                  <SelectItem value="random">Random Search</SelectItem>
                  <SelectItem value="grid">Grid Search</SelectItem>
                  <SelectItem value="hyperband">Hyperband</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>최대 시도 횟수</Label>
              <Input
                type="number"
                value={maxTrials}
                onChange={(e) => setMaxTrials(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>목표 유형</Label>
              <Select
                value={objective}
                onValueChange={(v) =>
                  setObjective(v as "maximize" | "minimize")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maximize">Maximize</SelectItem>
                  <SelectItem value="minimize">Minimize</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>메트릭</Label>
              <Input
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder="accuracy"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>목표값</Label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900">
            파라미터 공간(learning rate, batch size 등)은 다음 단계에서 지정한다
            — 여기선 실험 뼈대만 등록.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>실험 등록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
