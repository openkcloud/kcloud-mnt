"use client";
import { Send, Activity, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { KFInferenceService } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KF_ENABLED } from "@/lib/kf";

/** 데모 호출 — sklearn iris 입력 형식 (KServe v1 protocol) */
async function testCall(s: KFInferenceService) {
  try {
    const t0 = performance.now();
    const res = await fetch(s.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [[6.8, 2.8, 4.8, 1.4], [6.0, 3.4, 4.5, 1.6]] }),
    });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    toast.success(`${s.name} 응답 ${ms}ms`, {
      description: `predictions: ${JSON.stringify(json.predictions ?? json).slice(0, 80)}`,
    });
  } catch (e) {
    toast.error(`호출 실패: ${(e as Error).message}`);
  }
}

export default function ServingPage() {
  const { data, isLoading } = api.kubeflow.serving() as {
    data: { items: KFInferenceService[] } | undefined;
    isLoading: boolean;
  };
  if (isLoading || !data) return <Skeleton className="h-96" />;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.items.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <Send className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {s.modelName} · {s.modelVersion}
                  </div>
                </div>
              </div>
              <Badge variant={s.status === "Ready" ? "success" : s.status === "Failed" ? "destructive" : "warning"} className="gap-1">
                {s.status === "Ready" && <span className="size-1.5 rounded-full bg-brand-mint-500" />}
                {s.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-secondary/40 p-3">
              <Metric label="레플리카" value={s.replicas} />
              <Metric label="평균 RPS" value={formatNumber(s.rpsAvg)} />
              <Metric label="p95 지연" value={`${s.p95LatencyMs}ms`} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <Badge variant="outline" className="gap-1">
                <Cpu className="size-3" /> {s.acceleratorKind ?? "CPU"}
              </Badge>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Activity className="size-3" />
                실시간
              </div>
            </div>

            <div className="rounded-md bg-card border border-border p-2 font-mono text-[11px] text-muted-foreground">
              {s.endpoint}
            </div>

            {KF_ENABLED && s.status === "Ready" && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => testCall(s)}>
                <Send className="size-3" /> API 호출 테스트
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
