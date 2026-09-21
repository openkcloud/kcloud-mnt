"use client";
import * as React from "react";
import { ChangeMark } from "@/components/change-mark";
import {
  GitBranch,
  Play,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Sparkles,
  Upload,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [uploadOpen, setUploadOpen] = React.useState(false);
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const active = selected ? data.items.find((p) => p.id === selected) : data.items[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <UploadPipelineDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {/* Pipeline list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>파이프라인</span>
            <div className="flex items-center gap-2">
              <Badge variant="ghost">{data.items.length}</Badge>
              <ChangeMark ids={["CR-AID-02"]} inline><Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-3.5" /> YAML 업로드
              </Button></ChangeMark>
            </div>
          </CardTitle>
          <CardDescription className="text-[11px]">
            KFP Python DSL로 컴파일된 YAML 파일을 직접 업로드할 수 있다.
          </CardDescription>
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
                <Button variant="outline" size="sm" onClick={() => toast.success("pipeline.yaml 다운로드")}>YAML 다운로드</Button>
                <Button size="sm" onClick={() => toast.success("파이프라인 실행 run-015 생성")}>
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
                        <Button variant="ghost" size="sm" onClick={() => toast.success("아티팩트 다운로드")}>다운로드</Button>
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

// ─────────────────────────────────────────────────────────────
// YAML 업로드 다이얼로그 — ETRI 260615 §6.B 반영
// ─────────────────────────────────────────────────────────────

function UploadPipelineDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [ns, setNs] = React.useState("ai-research");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [pastedYaml, setPastedYaml] = React.useState("");
  const [mode, setMode] = React.useState<"file" | "paste">("file");

  const submit = () => {
    if (!name.trim()) return;
    if (mode === "file" && !fileName) return;
    if (mode === "pastedYaml" && !pastedYaml.trim()) return;
    toast.success(`Pipeline '${name}' 업로드 완료`, {
      description: `${ns} 네임스페이스 · ${mode === "file" ? fileName : "붙여넣은 YAML"} · 검증 진행 중`,
    });
    setName("");
    setFileName(null);
    setPastedYaml("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="size-5 text-brand-indigo-600" />
            Pipeline YAML 업로드
          </DialogTitle>
          <DialogDescription>
            KFP Python DSL로 컴파일된 YAML 파일 또는 매니페스트를 직접 붙여넣어 등록한다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>파이프라인 이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-training-pipeline" />
            </div>
            <div>
              <Label>네임스페이스</Label>
              <Input value={ns} onChange={(e) => setNs(e.target.value)} placeholder="ai-research" />
            </div>
          </div>

          <div className="flex gap-1 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn(
                "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors",
                mode === "file" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              파일 업로드
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={cn(
                "flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors",
                mode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              YAML 붙여넣기
            </button>
          </div>

          {mode === "file" && (
            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50">
              <input
                type="file"
                accept=".yaml,.yml"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
              <div className="text-sm font-medium">
                {fileName ?? "파일을 여기로 드래그하거나 클릭하여 선택"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">.yaml · .yml · KFP v2 매니페스트</div>
            </label>
          )}

          {mode === "paste" && (
            <div>
              <Label className="text-[11px]">YAML 내용</Label>
              <textarea
                value={pastedYaml}
                onChange={(e) => setPastedYaml(e.target.value)}
                className="mt-1 min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
                placeholder={`apiVersion: argoproj.io/v1alpha1\nkind: Workflow\nmetadata:\n  name: my-training-pipeline\n...`}
              />
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900">
            업로드 후 자동 검증 — DSL 스키마 · 아티팩트 참조 · 자원 요구사항 유효성 확인 후 카탈로그에 등록된다.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>
            <Upload className="size-3.5" /> 업로드 · 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
