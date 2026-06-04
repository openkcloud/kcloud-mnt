"use client";
import * as React from "react";
import {
  GitBranch,
  Play,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, relativeTime } from "@/lib/utils";
import type { KFPipeline } from "@/lib/types";

const PIPELINE_DAG: Record<string, { id: string; name: string; type: "data" | "compute" | "ml" | "deploy"; status: "ok" | "running" | "failed" | "pending" }[]> = {
  "pl-1": [
    { id: "s1", name: "load-dataset", type: "data", status: "ok" },
    { id: "s2", name: "tokenize", type: "data", status: "ok" },
    { id: "s3", name: "LoRA finetune", type: "ml", status: "running" },
    { id: "s4", name: "eval", type: "compute", status: "pending" },
    { id: "s5", name: "register-model", type: "deploy", status: "pending" },
    { id: "s6", name: "deploy-kserve", type: "deploy", status: "pending" },
  ],
  "pl-2": [
    { id: "s1", name: "audio-clean", type: "data", status: "ok" },
    { id: "s2", name: "quantize-int8", type: "ml", status: "ok" },
    { id: "s3", name: "compile-atom", type: "compute", status: "ok" },
    { id: "s4", name: "wer-test", type: "compute", status: "ok" },
    { id: "s5", name: "deploy-edge", type: "deploy", status: "ok" },
  ],
  "pl-3": [
    { id: "s1", name: "spawn-vllm", type: "compute", status: "ok" },
    { id: "s2", name: "warmup", type: "compute", status: "ok" },
    { id: "s3", name: "load-test", type: "compute", status: "ok" },
    { id: "s4", name: "report", type: "data", status: "ok" },
  ],
  "pl-4": [
    { id: "s1", name: "build-gemv-kernel", type: "compute", status: "ok" },
    { id: "s2", name: "run-on-pim", type: "compute", status: "failed" },
    { id: "s3", name: "compare-baseline", type: "compute", status: "pending" },
  ],
};

export default function PipelinesPage() {
  const { data, isLoading } = api.kubeflow.pipelines() as {
    data: { items: KFPipeline[] } | undefined;
    isLoading: boolean;
  };
  const [selected, setSelected] = React.useState<string | undefined>();
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const active = selected ? data.items.find((p) => p.id === selected) : data.items[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* Pipeline list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>파이프라인</span>
            <Badge variant="ghost">{data.items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {data.items.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  "block w-full px-5 py-3 text-left transition-colors hover:bg-secondary/40",
                  active?.id === p.id && "bg-secondary/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <GitBranch className="size-4 mt-0.5 text-violet-600" />
                    <div>
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </div>
                  {p.acceleratorKind && (
                    <Badge variant="outline" className="font-mono text-[10px]">{p.acceleratorKind}</Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <span><strong className="font-mono">{p.steps}</strong> steps</span>
                  <span><strong className="font-mono">{p.runs}</strong> runs</span>
                  <span className={p.successRate > 0.9 ? "text-brand-mint-700" : "text-amber-600"}>
                    {(p.successRate * 100).toFixed(0)}% success
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active pipeline DAG */}
      {active && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{active.name}</CardTitle>
                <CardDescription>{active.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">YAML 다운로드</Button>
                <Button size="sm">
                  <Play className="size-3.5" /> 새 실행
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="flex min-w-max items-center gap-2">
                  {(PIPELINE_DAG[active.id] ?? []).map((step, i, arr) => (
                    <React.Fragment key={step.id}>
                      <PipelineStep step={step} />
                      {i < arr.length - 1 && (
                        <div className="flex h-px w-12 items-center justify-center bg-border" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="runs">
            <TabsList>
              <TabsTrigger value="runs">실행 이력</TabsTrigger>
              <TabsTrigger value="schedule">스케줄</TabsTrigger>
              <TabsTrigger value="artifacts">아티팩트</TabsTrigger>
            </TabsList>
            <TabsContent value="runs">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <div className={cn(
                          "flex size-7 items-center justify-center rounded-full",
                          i === 0 ? "bg-brand-mint-100 text-brand-mint-700" :
                            i === 4 ? "bg-rose-100 text-rose-700" : "bg-brand-indigo-100 text-brand-indigo-700",
                        )}>
                          {i === 4 ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-mono text-sm">{active.name}-run-{(active.runs - i).toString().padStart(3, "0")}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{active.steps} steps</span>
                            <span className="mx-1">·</span>
                            <span>실행 시간 {Math.floor(Math.random() * 60) + 5}분</span>
                            <span className="mx-1">·</span>
                            <span>{relativeTime(new Date(Date.now() - i * 12 * 3600000))}</span>
                          </div>
                        </div>
                        <Badge variant={i === 4 ? "destructive" : i === 0 ? "warning" : "success"}>
                          {i === 4 ? "Failed" : i === 0 ? "Running" : "Succeeded"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="schedule">
              <Card>
                <CardContent className="space-y-3 p-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">트리거</span>
                    <Badge variant="success">활성</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cron 표현식</span>
                    <span className="font-mono">0 2 * * *</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">다음 실행</span>
                    <span>매일 02:00 KST</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="artifacts">
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {[
                      { name: "model.safetensors", size: "14.2 GB", type: "model" },
                      { name: "config.json", size: "2.1 KB", type: "config" },
                      { name: "tokenizer.json", size: "1.8 MB", type: "tokenizer" },
                      { name: "metrics.json", size: "12 KB", type: "metrics" },
                    ].map((a) => (
                      <div key={a.name} className="flex items-center gap-3 px-5 py-2.5">
                        <Database className="size-4 text-brand-indigo-600" />
                        <span className="flex-1 font-mono text-sm">{a.name}</span>
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">{a.size}</span>
                        <Button variant="ghost" size="sm">다운로드</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

function PipelineStep({
  step,
}: {
  step: { id: string; name: string; type: "data" | "compute" | "ml" | "deploy"; status: "ok" | "running" | "failed" | "pending" };
}) {
  const typeColor = {
    data: "border-sky-200 bg-sky-50 text-sky-800",
    compute: "border-violet-200 bg-violet-50 text-violet-800",
    ml: "border-brand-mint-200 bg-brand-mint-50 text-brand-mint-800",
    deploy: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const statusIcon = {
    ok: <CheckCircle2 className="size-3.5 text-brand-mint-600" />,
    running: <span className="size-2 animate-pulse rounded-full bg-amber-500" />,
    failed: <XCircle className="size-3.5 text-rose-600" />,
    pending: <Clock className="size-3.5 text-muted-foreground" />,
  };
  return (
    <div
      className={cn(
        "flex min-w-[160px] flex-col gap-1 rounded-lg border px-3 py-2.5 transition-shadow hover:shadow-md",
        typeColor[step.type],
      )}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-80">
        <span>{step.type}</span>
        {statusIcon[step.status]}
      </div>
      <div className="text-sm font-semibold leading-tight">{step.name}</div>
    </div>
  );
}
